"""In-process OCR engine: preprocessing, Tesseract + regex fallback, and Gemini Vision.

Ported from the project's reconstructed OCR scripts to work on in-memory image bytes
(no Django, no file paths) — the gate-in router already renders a PDF's first page to
PNG before any adapter sees it, so this module only ever handles a single image.
"""

import io
import json
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

_MAX_OCR_DIM = 2000
_MAX_GEMINI_DIM = 1024
_MIN_OCR_CONFIDENCE = 20


def _gemini_api_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "").strip()


def _tesseract_cmd() -> str:
    return os.environ.get("TESSERACT_CMD", "").strip()


def is_gemini_available() -> bool:
    if not _gemini_api_key():
        return False
    try:
        from google import genai  # noqa: F401
        return True
    except ImportError:
        return False


# --------------------------------------------------------------------------
# Preprocessing
# --------------------------------------------------------------------------
def _preprocess_image(image_bytes: bytes):
    import cv2
    import numpy as np

    buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image for OCR preprocessing")

    h, w = img.shape[:2]
    longest = max(h, w)
    if longest > _MAX_OCR_DIM:
        scale = _MAX_OCR_DIM / longest
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoised = cv2.GaussianBlur(gray, (3, 3), 0)
    thresh = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )

    try:
        thresh = _deskew_image(thresh)
    except Exception as exc:
        logger.warning(f"Deskew failed: {exc}")

    return thresh


def _deskew_image(image):
    import cv2
    import numpy as np

    coords = np.column_stack(np.where(image > 0))
    if len(coords) < 100:
        return image

    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    if abs(angle) < 0.5:
        return image

    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(image, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


# --------------------------------------------------------------------------
# Tesseract engine — offline, free; spatial layout reconstruction
# --------------------------------------------------------------------------
def _group_into_rows(words, line_gap):
    rows = []
    current_row = [words[0]]
    ref_y = words[0]["mid_y"]
    for word in words[1:]:
        if abs(word["mid_y"] - ref_y) <= line_gap:
            current_row.append(word)
            ref_y = sum(w["mid_y"] for w in current_row) / len(current_row)
        else:
            rows.append(sorted(current_row, key=lambda w: w["left"]))
            current_row = [word]
            ref_y = word["mid_y"]
    rows.append(sorted(current_row, key=lambda w: w["left"]))
    return rows


def _split_into_columns(row, gap_threshold):
    if not row:
        return []
    groups = [[row[0]]]
    for word in row[1:]:
        if word["left"] - groups[-1][-1]["right"] > gap_threshold:
            groups.append([word])
        else:
            groups[-1].append(word)
    return groups


def _parse_key_values(lines):
    kv = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if ": " in line:
            key, value = line.split(": ", 1)
            key, value = key.strip(), value.strip()
            if key and value and len(key) <= 60 and not key.startswith("|"):
                kv[key] = value
            i += 1
            continue

        stripped = line.strip().rstrip(":")
        is_label = bool(re.match(r"^[A-Z][A-Z0-9 /\-\.]{2,50}$", stripped)) and len(stripped.split()) <= 7

        if is_label and i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if next_line and not re.match(r"^[A-Z][A-Z0-9 /\-\.]{2,50}$", next_line.rstrip(":")):
                kv[stripped] = next_line
                i += 2
                continue
        i += 1
    return kv


def _extract_text_with_tesseract(image_bytes: bytes) -> dict:
    import pytesseract

    tesseract_cmd = _tesseract_cmd()
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    img_to_use = _preprocess_image(image_bytes)
    data = pytesseract.image_to_data(
        img_to_use, config="--oem 3 --psm 3", output_type=pytesseract.Output.DICT, lang="eng"
    )

    words = []
    for i in range(len(data["text"])):
        conf = int(data["conf"][i])
        text = str(data["text"][i]).strip()
        if conf < _MIN_OCR_CONFIDENCE or not text:
            continue
        h = data["height"][i]
        words.append({
            "text": text,
            "left": data["left"][i],
            "top": data["top"][i],
            "right": data["left"][i] + data["width"][i],
            "bottom": data["top"][i] + h,
            "mid_y": data["top"][i] + h // 2,
            "conf": conf,
        })

    if not words:
        return {"text": "", "confidence": 0, "key_values": {}}

    avg_h = sum(w["bottom"] - w["top"] for w in words) / len(words)
    line_gap = max(4, avg_h * 0.55)
    words.sort(key=lambda w: (w["mid_y"], w["left"]))
    rows = _group_into_rows(words, line_gap)

    img_right = max(w["right"] for w in words)
    col_gap_threshold = img_right * 0.12

    reconstructed_lines = []
    for row in rows:
        groups = _split_into_columns(row, col_gap_threshold)
        group_texts = [" ".join(w["text"] for w in g) for g in groups]
        if len(group_texts) == 2:
            reconstructed_lines.append(f"{group_texts[0]}: {group_texts[1]}")
        elif len(group_texts) > 2:
            reconstructed_lines.append(" | ".join(group_texts))
        else:
            reconstructed_lines.append(group_texts[0] if group_texts else "")

    reconstructed_text = "\n".join(line for line in reconstructed_lines if line)
    key_values = _parse_key_values(reconstructed_lines)
    avg_conf = sum(w["conf"] for w in words) / len(words)

    return {"text": reconstructed_text, "confidence": round(avg_conf, 2), "key_values": key_values}


# --------------------------------------------------------------------------
# Regex field extraction — fallback when Gemini isn't configured
# --------------------------------------------------------------------------
def extract_invoice_fields(raw_text: str) -> dict:
    """Extract structured fields from OCR text via regex. Tuned for Indian invoices."""
    fields = {}
    if not raw_text:
        return fields

    gstin_matches = re.findall(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b", raw_text)
    if gstin_matches:
        fields["gstin"] = list(set(gstin_matches))

    pan_matches = re.findall(r"\b[A-Z]{5}\d{4}[A-Z]\b", raw_text)
    if pan_matches:
        fields["pan"] = list(set(pan_matches))

    invoice_patterns = [
        r"INVOICE\s*NO[.:\-\s]+([A-Z0-9/\-]+)",
        r"Invoice\s*No[.:\-\s]+([A-Z0-9/\-]+)",
        r"Bill\s*No[.:\-\s]+([A-Z0-9/\-]+)",
        r"Invoice\s*Number[.:\-\s]+([A-Z0-9/\-]+)",
    ]
    for pattern in invoice_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            fields["invoice_number"] = match.group(1).strip()
            break

    date_patterns = [r"\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b", r"\b(\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4})\b"]
    dates_found = []
    for pattern in date_patterns:
        dates_found.extend(re.findall(pattern, raw_text))
    if dates_found:
        fields["dates_found"] = list(set(dates_found))

    amount_patterns = [
        r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)",
        r"Total[:\s]+(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d+)?)",
        r"Amount[:\s]+(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d+)?)",
    ]
    all_amounts = []
    for pattern in amount_patterns:
        all_amounts.extend(re.findall(pattern, raw_text, re.IGNORECASE))
    if all_amounts:
        fields["amounts"] = list(set(all_amounts))

    for pattern in [r"A/[Cc]\s*No[.:\s]+(\d{9,18})", r"Account\s*No[.:\s]+(\d{9,18})"]:
        match = re.search(pattern, raw_text)
        if match:
            fields["account_number"] = match.group(1)
            break

    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    for line in lines[:5]:
        if line.isupper() and 5 < len(line) < 60:
            fields["probable_vendor_name"] = line
            break

    tax_matches = re.findall(r"(CGST|SGST|IGST|GST)\s*@?\s*(\d+(?:\.\d+)?)\s*%", raw_text, re.IGNORECASE)
    if tax_matches:
        fields["tax_rates"] = [{"type": t[0].upper(), "rate": t[1]} for t in tax_matches]

    return fields


def _structure_extracted_data(raw_text: str, fields: dict, layout_kv: Optional[dict] = None) -> dict:
    all_fields = dict(layout_kv or {})
    all_fields.update({k: v for k, v in fields.items() if k not in all_fields})
    return {
        "document_type": "invoice" if all_fields else "unknown",
        "all_fields": all_fields,
        "line_items": [],
        "raw_text": raw_text,
        "extraction_method": "tesseract_spatial_regex",
    }


def _scan_with_tesseract(image_bytes: bytes) -> dict:
    result = _extract_text_with_tesseract(image_bytes)
    fields = extract_invoice_fields(result["text"])
    structured_data = _structure_extracted_data(result["text"], fields, layout_kv=result.get("key_values"))
    return {
        "raw_text": result["text"],
        "extracted_data": structured_data,
        "confidence_score": result["confidence"],
        "engine_used": "tesseract_regex",
    }


# --------------------------------------------------------------------------
# Gemini Vision engine — cloud, structured field extraction
# --------------------------------------------------------------------------
EXTRACTION_PROMPT = """You are an expert document digitization system. Extract ALL data from this document image — it may be an invoice, bill, tax receipt, or construction document with HORIZONTAL layout (key: value on same line), VERTICAL layout (key on one row, value below), TABLE format, or a MIX of all three.

Return ONLY a valid JSON object (no markdown, no code fences, no explanation):
{
  "document_type": "invoice|tax_invoice|receipt|bill|work_order|other",
  "all_fields": {
    "invoice_number":      null,
    "invoice_date":        null,
    "vendor_name":         null,
    "vendor_gstin":        null,
    "vendor_pan":          null,
    "vendor_address":      null,
    "vendor_phone":        null,
    "vendor_email":        null,
    "buyer_name":          null,
    "buyer_gstin":         null,
    "buyer_pan":           null,
    "buyer_address":       null,
    "buyer_phone":         null,
    "buyer_email":         null,
    "buyer_state":         null,
    "po_number":           null,
    "work_order_number":   null,
    "project_name":        null,
    "place_of_supply":     null,
    "billing_year":        null,
    "delivery_note":       null,
    "dispatch_date":       null,
    "dispatch_doc_number": null,
    "transport_mode":      null,
    "vehicle_number":      null,
    "bank_name":           null,
    "account_number":      null,
    "ifsc_code":           null,
    "branch":              null,
    "taxable_amount":      null,
    "cgst_percentage":     null,
    "cgst_amount":         null,
    "sgst_percentage":     null,
    "sgst_amount":         null,
    "igst_percentage":     null,
    "igst_amount":         null,
    "total_tax_amount":    null,
    "total_amount":        null,
    "amount_in_words":     null,
    "currency":            null
  },
  "line_items": [
    {
      "sr_no": "",
      "description": "",
      "hsn_sac": "",
      "unit": "",
      "rate": "",
      "qty": "",
      "amount": ""
    }
  ],
  "extras": {
    "handwritten_text": [],
    "stamp_text": [],
    "signatures_present": false,
    "other_notes": []
  },
  "raw_text": "complete text in reading order"
}

Rules — READ CAREFULLY:
1. `all_fields` uses FIXED predefined keys only — NEVER create new keys or use document label names as keys.
   Map whatever label appears in the document to the correct predefined key, matching common Indian invoice/challan
   labels for each (e.g. po_number <- "PO No"/"Purchase Order No"/"Order No"; dispatch_doc_number <- "Challan No"/
   "Delivery Doc No"; vendor_name <- the firm name on the letterhead issuing the document; buyer_name <- "Bill To"/
   "Customer"/"Consignee").
2. If a field is not found in the document, set its value to null. NEVER omit a predefined key.
3. For horizontal layout: look for label: value on the same line. For vertical layout: label on one row, value below.
4. `line_items` is the billed-items table: first column is a serial number and the table has Rate/Amount/Qty columns.
   Return [] if no valid billing table exists.
5. Preserve exact values — numbers, GST numbers, PAN, dates, amounts — character for character.
6. Return ONLY valid JSON. No extra text outside the JSON."""


def _parse_json_response(text: str) -> Optional[dict]:
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    text = re.sub(r"```\s*$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return None
    return None


def _resize_for_gemini(img):
    from PIL import Image

    w, h = img.size
    longest = max(w, h)
    if longest > _MAX_GEMINI_DIM:
        scale = _MAX_GEMINI_DIM / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


def _scan_with_gemini(image_bytes: bytes) -> dict:
    from google import genai
    from PIL import Image

    client = genai.Client(api_key=_gemini_api_key())
    img = _resize_for_gemini(Image.open(io.BytesIO(image_bytes)))

    response = client.models.generate_content(model="gemini-2.5-flash", contents=[EXTRACTION_PROMPT, img])
    text = response.text.strip()
    data = _parse_json_response(text)
    if data is None:
        logger.error(f"Failed to parse Gemini JSON. Raw response snippet: {text[:300]}")
        data = {"document_type": "unknown", "all_fields": {}, "line_items": [], "raw_text": text}

    return {
        "raw_text": data.get("raw_text", ""),
        "extracted_data": data,
        "confidence_score": 95.0,
        "engine_used": "gemini",
    }


# --------------------------------------------------------------------------
# Unified entry point
# --------------------------------------------------------------------------
def scan_image(image_bytes: bytes, engine: str = "auto") -> dict:
    """
    Scan a single image and return structured OCR results.

    engine: "auto" uses Gemini when GEMINI_API_KEY is set, else Tesseract + regex.
    Returns {"raw_text", "extracted_data", "confidence_score", "engine_used"}.
    """
    use_gemini = engine == "gemini" or (engine == "auto" and is_gemini_available())
    if use_gemini:
        return _scan_with_gemini(image_bytes)
    return _scan_with_tesseract(image_bytes)
