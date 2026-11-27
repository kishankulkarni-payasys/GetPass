"""Regex field extraction for scanned documents (Doc Scan).

Edit FIELD_PATTERNS to match the fields on your own documents.
"""

import re
from typing import Optional

FIELD_PATTERNS = {
    # Used by the gate-in PO-scan button as a fallback when the structured OCR
    # adapter doesn't return a po_number (see NewEntryScreen.tsx's runPoOcr).
    "po_number": (
        r"(?:\bP\.?\s*O\.?\s*(?:No\.?(?=\s|[:#\-]|$)|Number\b)|"
        r"\bPurchase\s*Order\s*(?:No\.?(?=\s|[:#\-]|$)|Number\b))"
        r"\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,30})"
    ),
    "name": r"Name\s*[:\-]\s*([A-Za-z .]{2,60})",
    "aadhaar": r"\b(\d{4}\s?\d{4}\s?\d{4})\b",
    "mobile": r"\b((?:\+91[\s-]?)?[6-9]\d{9})\b",
    "date": r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b",
    "amount": r"(?:Total|Amount)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
    "email": r"\b([\w.+-]+@[\w-]+\.[\w.]+)\b",
}


def parse_fields(text: str) -> dict:
    fields = {}
    for key, pattern in FIELD_PATTERNS.items():
        match = re.search(pattern, text, re.IGNORECASE)
        fields[key] = match.group(1).strip() if match else None
    return fields


_PO_LABEL_RE = re.compile(r"^p\.?o\.?$", re.IGNORECASE)
_NO_LABEL_RE = re.compile(r"^(?:no\.?,?:?|number)$", re.IGNORECASE)
_PO_VALUE_RE = re.compile(r"^[A-Z0-9][A-Z0-9\-\/]{3,30}$", re.IGNORECASE)


def find_po_number_by_position(ocr_data: dict) -> Optional[str]:
    """Pair a "PO NO" label with the value on its own text line, by word position.

    Multi-column documents (e.g. tax invoices with a buyer-details column next
    to an invoice-details column on the same rows) can get their columns
    interleaved by Tesseract's reading order, so the word *array order* can't
    be trusted to put a label right before its value - a later word in the
    array (from a different column) can sit physically to the left of the
    real value. `ocr_data` is the dict from
    pytesseract.image_to_data(output_type=Output.DICT), which gives each
    word's line position and its `left` x-coordinate; we use that to find the
    nearest value-shaped word to the right of the label on the same line.
    """
    words = ocr_data.get("text", [])
    blocks = ocr_data.get("block_num", [])
    pars = ocr_data.get("par_num", [])
    lines = ocr_data.get("line_num", [])
    lefts = ocr_data.get("left", [])

    for i, word in enumerate(words):
        if not _PO_LABEL_RE.match(word.strip()):
            continue
        line_key = (blocks[i], pars[i], lines[i])

        no_label_index = None
        for j, candidate in enumerate(words):
            if j == i or (blocks[j], pars[j], lines[j]) != line_key or lefts[j] <= lefts[i]:
                continue
            if _NO_LABEL_RE.match(candidate.strip()) and (
                no_label_index is None or lefts[j] < lefts[no_label_index]
            ):
                no_label_index = j
        if no_label_index is None:
            continue

        value_index = None
        for j, candidate in enumerate(words):
            if (blocks[j], pars[j], lines[j]) != line_key or lefts[j] <= lefts[no_label_index]:
                continue
            if _PO_VALUE_RE.match(candidate.strip()) and (
                value_index is None or lefts[j] < lefts[value_index]
            ):
                value_index = j
        if value_index is not None:
            return words[value_index].strip().upper()
    return None
