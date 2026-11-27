# Reconstructed from compiled bytecode (.pyc) — verify before relying on exact behavior.
"""
Google Gemini Vision OCR Engine - FREE tier available.
Get your API key from: https://aistudio.google.com/app/apikey

Free tier: 15 requests/minute, 1,500 requests/day
"""

import os
import re
import json
import logging

from PIL import Image
from django.conf import settings

logger = logging.getLogger(__name__)

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
      "amount": "",
      "previous_qty": "",
      "current_qty": "",
      "cumulative_qty": "",
      "previous_amount": "",
      "current_amount": "",
      "cumulative_amount": ""
    }
  ],
  "hsn_list": [
    {
      "hsn_sac_code": "",
      "description": "",
      "unit": "",
      "qty": "",
      "rate": "",
      "taxable_value": "",
      "cgst_rate": "",
      "cgst_amount": "",
      "sgst_rate": "",
      "sgst_amount": "",
      "igst_rate": "",
      "igst_amount": "",
      "total": ""
    }
  ],
  "summary": {
    "taxable_amount": "",
    "tax_breakdown": [{"type": "CGST/SGST/IGST", "rate": "", "amount": ""}],
    "total_amount": "",
    "amount_in_words": ""
  },
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
   Map whatever label appears in the document to the correct predefined key:
   - invoice_number      ← "Invoice No", "Invoice Number", "Bill No", "Invoice #", "Ref No", "Document No"
   - invoice_date        ← "Invoice Date", "Date", "Bill Date", "Dated", "Date of Invoice"
   - vendor_name         ← the firm name on the letterhead/header (the one issuing the invoice), "From", "Vendor", "Supplier", "Seller", "Issued By"
   - vendor_gstin        ← "GSTIN/UIN OF VENDOR", "Vendor GSTIN", "Supplier GSTIN", "Our GSTIN", "GSTIN" in the vendor section
   - vendor_pan          ← "PAN", "Vendor PAN", "Supplier PAN", "Company PAN" in the vendor section
   - vendor_address      ← vendor's full address block
   - vendor_phone        ← vendor's "Mob", "Mobile", "Tel", "Phone", "Contact"
   - vendor_email        ← vendor's email address
   - buyer_name          ← "To", "Bill To", "Client", "Customer", "Customer Name", "Company Name" (buyer section), "Buyer", "Consignee", "Party Name", "Issued To"
   - buyer_gstin         ← "GSTIN/UIN", "Buyer GSTIN", "Client GSTIN", "Customer GSTIN" in the buyer section
   - buyer_pan           ← "Buyer PAN", "Client PAN" in the buyer section
   - buyer_address       ← buyer's full address block
   - buyer_phone         ← buyer's contact number
   - buyer_email         ← buyer's email address
   - buyer_state         ← buyer's state name or code
   - po_number           ← "PO No", "Purchase Order No", "Buyer's Order No", "Order No"
   - work_order_number   ← "Work Order No", "WO No", "WD No", "Work Order Number", "Work Order Ref", "W/O No"
   - project_name        ← "Project Name", "Project", "Site Name", "Name of Work", "Name of Project", "Work Description", "Job Name", "SITE NAME", "Destination"
   - place_of_supply     ← "Place of Supply", "State of Supply"
   - billing_year        ← "Billing Year", "Financial Year", "FY"
   - delivery_note       ← "Delivery Note", "Delivery Note No", "DN No"
   - dispatch_date       ← "Dispatch Date", "Dispatched On", "Shipping Date"
   - dispatch_doc_number ← "Dispatch Doc No", "Delivery Doc No", "Challan No"
   - transport_mode      ← "Mode of Transport", "Dispatched Through", "Carrier", "Transport"
   - vehicle_number      ← "Vehicle No", "Lorry No", "LR No"
   - bank_name           ← "Bank Name", "Bank"
   - account_number      ← "Account No", "A/C No", "A/C", "Bank Account"
   - ifsc_code           ← "IFSC", "IFSC Code", "Branch Code"
   - branch              ← "Branch", "Bank Branch"
   - taxable_amount      ← "Taxable Value", "Taxable Amount", "Basic Amount", "Sub Total", "Total Taxable Value", "Assessable Value"
   - cgst_percentage     ← "CGST %", "CGST Rate", "CGST @ 9%", "Central Tax %", "OUTPUT CGST %"
   - cgst_amount         ← "CGST Amount", "CGST", "Central Tax Amount"
   - sgst_percentage     ← "SGST %", "SGST Rate", "SGST @ 9%", "State Tax %", "OUTPUT SGST %"
   - sgst_amount         ← "SGST Amount", "SGST", "State Tax Amount"
   - igst_percentage     ← "IGST %", "IGST Rate", "Integrated Tax %"
   - igst_amount         ← "IGST Amount", "IGST", "Integrated Tax"
   - total_tax_amount    ← "Total Tax", "Tax Amount", "Total GST", "Total Tax Amount"
   - total_amount        ← "Total", "Grand Total", "Net Payable", "Net Amount Receivable", "Amount Payable", "Total Invoice Value", "Balance Due", "Amount Chargeable"
   - amount_in_words     ← "Amount in Words", "Rupees in Words", "In Words", "Amount in words :-"
   - currency            ← "Currency"; default to "INR" if the document is an Indian invoice and no currency is stated
2. If a field is not found in the document, set its value to null. NEVER omit a predefined key.
3. For horizontal layout: look for label: value on the same line.
4. For vertical layout: label on one row, value below it.
5. For tables — look at the FIRST COLUMN HEADER to decide which array to use (a document can have BOTH):
   - `hsn_list` — use this when the FIRST column header contains "HSN" or "SAC" (e.g. "HSN/SACCode", "HSN/SAC", "HSN Code", "SAC Code"), OR when the cell values in the first column start with "HSN " (e.g. "HSN 995411") or are 6–8 digit numeric HSN codes (e.g. "68159910"). This covers both (a) the main HSN-grouped service/goods table and (b) the HSN-wise tax summary table at the bottom of an invoice (columns: HSN/SAC, Taxable Value, CGST Rate, CGST Amount, SGST/UTGST Rate, SGST/UTGST Amount, Total). Use "" for any column not present in that specific table.
   - `line_items` — use this ONLY when the FIRST column header is a serial number label (e.g. "SI No.", "Sr. No.", "S.No.", "Sl. No.", "#", "No.") or the first column contains sequential integers (1, 2, 3 …), AND the table contains billing/pricing columns such as Rate, Amount, Price, Qty, Unit. Include ALL columns: sr_no, description, hsn_sac, unit, rate, qty, amount, and any previous/current/cumulative variants. Use "" for absent columns. For the `description` field in line_items, map any of these column headers: "Description", "Description of Goods", "Goods Description", "Item Description", "Particulars", "Work Description", "Work Discription".
   - DECISION RULE: If FIRST column = HSN/SAC code or "HSN …" text → `hsn_list`. If FIRST column = serial number AND table has Rate/Amount/Price columns → `line_items`. Never put HSN-keyed rows into `line_items`.
   - EXCLUDE from line_items: any table whose columns are primarily physical measurements or dimensions (e.g. Length, Width, Height, Nos, Smtr, S foot, Area, Volume, Running Meter) even if it has a serial number column — these are measurement records, not billed items. Return [] for line_items if no valid billing table exists.
6. For handwritten text or rubber stamp text: put in `extras.handwritten_text` or `extras.stamp_text`.
7. Preserve exact values — numbers, GST numbers, PAN, dates, amounts — character for character.
8. Return ONLY valid JSON. No extra text outside the JSON."""


def is_gemini_available():
    """Check if Gemini is configured and available."""
    if not settings.GEMINI_API_KEY:
        return False
    try:
        from google import genai
        return True
    except ImportError:
        return False


_QUICK_PROMPT = """Extract the following fields from this document. Return ONLY valid JSON — no markdown, no explanation.

{
  "buyer_name":      null,
  "project_name":    null,
  "invoice_number":  null,
  "invoice_date":    null,
  "taxable_amount":  null,
  "cgst_percentage": null,
  "cgst_amount":     null,
  "sgst_percentage": null,
  "sgst_amount":     null,
  "total_amount":    null
}

Rules:
- buyer_name:      the name of the CUSTOMER / CLIENT who is being billed (may be labelled "To", "Bill To", "Client",
                   "Customer", "Customer Name", "Client Name", "Buyer", "Party Name", "Issued To", etc.)
                   Do NOT use the vendor / supplier / issuer name here.
- project_name:    the name of the customer's project / site / work (may be labelled "Project Name", "Project",
                   "Site Name", "Work Order", "Work Description", "Name of Work", "Description of Work",
                   "SITE NAME", "WO Description", "Job Name", "Consignee", "Ship To", "Delivery Address",
                   "Site Address", etc.)
- invoice_number:  the invoice / bill number (may be labelled "Invoice No", "Bill No", "Invoice #", "Ref No", etc.)
- invoice_date:    the invoice / bill date (may be labelled "Invoice Date", "Date", "Bill Date", "Dated", etc.)
- cgst_percentage: CGST tax rate, e.g. "9%" (may be labelled "CGST@9%", "CGST @ 9%", "Central Tax %", "CGST Rate", "OUTPUT CGST %", etc.)
- cgst_amount:     CGST tax amount in numbers (may be labelled "CGST Amount", "Central Tax", "CGST", etc.)
- sgst_percentage: SGST tax rate, e.g. "9%" (may be labelled "SGST@9%", "SGST @ 9%", "State Tax %", "SGST Rate", "OUTPUT SGST %", etc.)
- sgst_amount:     SGST tax amount in numbers (may be labelled "SGST Amount", "State Tax", "SGST", etc.)
- taxable_amount:  the pre-tax / taxable amount (may be labelled "Basic Amount", "Taxable Value", "Taxable Amount",
                   "Sub Total", "Amount Before Tax", "Net Amount", "Basic Value", "Assessable Value", "Total Taxable Value", etc.)
- total_amount:    the final payable amount including all taxes (may be labelled "Total", "Grand Total", "Net Payable",
                   "Amount Payable", "Amount with Taxes", "Total Invoice Value", "Net Amount Receivable", "Balance Due",
                   "Amount Chargeable", etc.)

Use exact numeric values from the document (no currency symbols). Use null for any field not found."""


_MAX_QUICK_DIM = 800


def extract_invoice_key_fields(file_path):
    """
    Fast path: asks only for invoice_number + invoice_date.
    PDFs are uploaded directly to the Gemini Files API \u2014 no poppler required.
    Images are resized to 800 px before sending.
    Streams the response and stops the moment both fields appear.
    """
    if not is_gemini_available():
        raise RuntimeError("Gemini API not configured.")

    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    file_path = str(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    uploaded_file = None

    try:
        if ext == ".pdf":
            uploaded_file = client.files.upload(
                file=file_path, config={"mime_type": "application/pdf"}
            )
            content = [_QUICK_PROMPT, uploaded_file]
        else:
            img = Image.open(file_path)
            w, h = img.size
            longest = max(w, h)
            if longest > _MAX_QUICK_DIM:
                scale = _MAX_QUICK_DIM / longest
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            content = [_QUICK_PROMPT, img]

        accumulated = ""
        fields = {}
        _QUICK_FIELDS = (
            "buyer_name",
            "project_name",
            "invoice_number",
            "invoice_date",
            "taxable_amount",
            "cgst_percentage",
            "cgst_amount",
            "sgst_percentage",
            "sgst_amount",
            "total_amount",
        )

        for chunk in client.models.generate_content_stream(
            model="gemini-2.5-flash", contents=content
        ):
            try:
                accumulated += chunk.text
            except Exception:
                continue

            data = _parse_json_response(accumulated)
            if data:
                fields = data
                if all(fields.get(f) for f in _QUICK_FIELDS):
                    logger.info("Quick extract: all fields found, stopping stream early.")
                    break
    finally:
        if uploaded_file:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception:
                pass

    logger.info(f"Quick extract result: {fields}")

    return {
        "document_type": "invoice",
        "all_fields": {
            "buyer_name": fields.get("buyer_name"),
            "project_name": fields.get("project_name"),
            "invoice_number": fields.get("invoice_number"),
            "invoice_date": fields.get("invoice_date"),
            "taxable_amount": fields.get("taxable_amount"),
            "cgst_percentage": fields.get("cgst_percentage"),
            "cgst_amount": fields.get("cgst_amount"),
            "sgst_percentage": fields.get("sgst_percentage"),
            "sgst_amount": fields.get("sgst_amount"),
            "total_amount": fields.get("total_amount"),
        },
        "extraction_method": "gemini_quick",
    }


def extract_with_gemini_text(text_data):
    """
    Send plain text (e.g. Excel cell dump) to Gemini for field extraction.
    No image \u2014 uses the text generation API instead of vision.
    """
    if not is_gemini_available():
        raise RuntimeError("Gemini API not configured.")

    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    prompt = (
        EXTRACTION_PROMPT
        + "\n\nDocument content (extracted from Excel / spreadsheet):\n"
        + text_data
    )

    response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    data = _parse_json_response(response.text.strip())

    if data is not None:
        logger.info("Gemini text extraction successful")
        return data

    logger.error("Gemini text extraction: could not parse JSON response")
    return {
        "document_type": "unknown",
        "all_fields": {},
        "line_items": [],
        "hsn_list": [],
        "raw_text": text_data,
        "parse_error": "Gemini returned non-JSON response",
    }


def _fill_hsn_descriptions(data):
    """
    Post-processing: if any hsn_list entry has no description,
    copy it from the matching line_item by HSN/SAC code.
    """
    line_items = data.get("line_items", [])
    hsn_lookup = {
        str(item.get("hsn_sac", "")).strip(): item.get("description", "")
        for item in line_items
        if item.get("hsn_sac") and item.get("description")
    }

    for hsn_entry in data.get("hsn_list", []):
        if not hsn_entry.get("description"):
            code = str(hsn_entry.get("hsn_sac_code", "")).strip()
            if code in hsn_lookup:
                hsn_entry["description"] = hsn_lookup[code]

    return data


def extract_with_gemini(file_path):
    """
    Extract structured data using Google Gemini Vision.

    Args:
        file_path: Path to image or PDF

    Returns:
        dict with extracted structured data
    """
    if not is_gemini_available():
        raise RuntimeError(
            "Gemini API not configured. Set GEMINI_API_KEY in .env file. "
            "Get free key at: https://aistudio.google.com/app/apikey"
        )

    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    file_path = str(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    logger.info(f"Starting Gemini OCR on {file_path}")

    if ext == ".pdf":
        return _extract_pdf_with_gemini(file_path, client)

    if ext in (".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"):
        return _extract_image_with_gemini(file_path, client)

    raise ValueError(f"Unsupported file type: {ext}")


_MAX_GEMINI_DIM = 1024


def _resize_for_gemini(img):
    """Downscale to max 1024px on the longest side before sending to the API."""
    w, h = img.size
    longest = max(w, h)
    if longest > _MAX_GEMINI_DIM:
        scale = _MAX_GEMINI_DIM / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


def _extract_image_with_gemini(image_path, client):
    """Extract from a single image."""
    img = Image.open(image_path)
    img = _resize_for_gemini(img)

    response = client.models.generate_content(
        model="gemini-2.5-flash", contents=[EXTRACTION_PROMPT, img]
    )
    text = response.text.strip()

    data = _parse_json_response(text)
    if data is not None:
        logger.info("Gemini extraction successful")
        return _fill_hsn_descriptions(data)

    logger.error(f"Failed to parse Gemini JSON. Raw response snippet: {text[:300]}")
    return {
        "document_type": "unknown",
        "all_fields": {},
        "line_items": [],
        "hsn_list": [],
        "raw_text": text,
        "parse_error": "Gemini returned non-JSON response",
    }


def _parse_json_response(text):
    """
    Robustly extract a JSON object from a Gemini response.
    Handles markdown code fences, leading/trailing prose, and
    responses where the JSON is embedded in explanation text.
    """
    import re

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


def _extract_pdf_with_gemini(pdf_path, client):
    """
    Upload PDF directly to Gemini Files API \u2014 no poppler required.
    Falls back to pdf2image page-by-page conversion if the upload fails.
    """
    try:
        uploaded = client.files.upload(
            file=pdf_path, config={"mime_type": "application/pdf"}
        )
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash", contents=[EXTRACTION_PROMPT, uploaded]
            )
            data = _parse_json_response(response.text.strip())

            if data is not None:
                logger.info("Gemini PDF extraction via Files API successful")
                data = _fill_hsn_descriptions(data)
                try:
                    client.files.delete(name=uploaded.name)
                except Exception:
                    pass
                return data
        finally:
            try:
                client.files.delete(name=uploaded.name)
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Gemini Files API upload failed ({e}), falling back to pdf2image")

    import fitz
    import tempfile

    doc = fitz.open(pdf_path)
    mat = fitz.Matrix(2.7777777777777777, 2.7777777777777777)
    images = []
    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        images.append(Image.frombytes("RGB", [pix.width, pix.height], pix.samples))
    doc.close()

    all_pages = []
    combined_raw_text = []

    with tempfile.TemporaryDirectory() as temp_dir:
        for i, img in enumerate(images):
            logger.info(f"Processing page {i + 1}/{len(images)} with Gemini")

            temp_path = os.path.join(temp_dir, f"page_{i}.png")
            img.save(temp_path)

            page_data = _extract_image_with_gemini(temp_path, client)
            page_data["page_number"] = i + 1
            all_pages.append(page_data)

            if "raw_text" in page_data:
                combined_raw_text.append(f"--- Page {i + 1} ---\n{page_data['raw_text']}")

    merged_all_fields = {}
    merged_line_items = []
    merged_hsn_list = []

    for page_data in all_pages:
        for k, v in page_data.get("all_fields", {}).items():
            if not merged_all_fields.get(k) and v:
                merged_all_fields[k] = v
        merged_line_items.extend(page_data.get("line_items", []))
        merged_hsn_list.extend(page_data.get("hsn_list", []))

    doc_type = next(
        (p.get("document_type") for p in all_pages if p.get("document_type") not in ("other", None)),
        all_pages[0].get("document_type", "unknown"),
    )

    return {
        "document_type": doc_type,
        "all_fields": merged_all_fields,
        "line_items": merged_line_items,
        "hsn_list": merged_hsn_list,
        "summary": all_pages[0].get("summary", {}),
        "extras": all_pages[0].get("extras", {}),
        "raw_text": "\n\n".join(combined_raw_text),
    }
