# Reconstructed from compiled bytecode (.pyc) — verify before relying on exact behavior.
"""
Regex-based field extractor for common document fields.
Used as a fallback when VLM extraction is not available.
"""
import re
import logging

logger = logging.getLogger(__name__)


def extract_invoice_fields(raw_text):
    """
    Extract structured fields from OCR text using regex patterns.
    Optimized for Indian invoices but works for general documents.
    """
    fields = {}

    if not raw_text:
        return fields

    gstin_pattern = r'\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b'
    gstin_matches = re.findall(gstin_pattern, raw_text)
    if gstin_matches:
        fields['gstin'] = list(set(gstin_matches))

    pan_pattern = r'\b[A-Z]{5}\d{4}[A-Z]\b'
    pan_matches = re.findall(pan_pattern, raw_text)
    if pan_matches:
        fields['pan'] = list(set(pan_matches))

    invoice_patterns = [
        'INVOICE\\s*NO[.:\\-\\s]+([A-Z0-9/\\-]+)',
        'Invoice\\s*No[.:\\-\\s]+([A-Z0-9/\\-]+)',
        'Bill\\s*No[.:\\-\\s]+([A-Z0-9/\\-]+)',
        'Invoice\\s*Number[.:\\-\\s]+([A-Z0-9/\\-]+)',
    ]
    for pattern in invoice_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            fields['invoice_number'] = match.group(1).strip()
            break

    date_patterns = [
        r'\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b',
        r'\b(\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4})\b',
    ]
    dates_found = []
    for pattern in date_patterns:
        dates_found.extend(re.findall(pattern, raw_text))
    if dates_found:
        fields['dates_found'] = list(set(dates_found))

    phone_pattern = r'\b[6-9]\d{9}\b'
    phones = re.findall(phone_pattern, raw_text)
    if phones:
        fields['phone_numbers'] = list(set(phones))

    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
    emails = re.findall(email_pattern, raw_text)
    if emails:
        fields['emails'] = list(set(emails))

    amount_patterns = [
        '(?:₹|Rs\\.?|INR)\\s*([\\d,]+(?:\\.\\d+)?)',
        'Total[:\\s]+(?:₹|Rs\\.?)?\\s*([\\d,]+(?:\\.\\d+)?)',
        'Amount[:\\s]+(?:₹|Rs\\.?)?\\s*([\\d,]+(?:\\.\\d+)?)',
    ]
    all_amounts = []
    for pattern in amount_patterns:
        matches = re.findall(pattern, raw_text, re.IGNORECASE)
        all_amounts.extend(matches)
    if all_amounts:
        fields['amounts'] = list(set(all_amounts))

    pin_pattern = r'(?:PIN\s*Code[:\s]*)?(\b\d{6}\b)'
    pins = re.findall(pin_pattern, raw_text)
    if pins:
        fields['pin_codes'] = list(set(pins))

    ifsc_pattern = r'\b[A-Z]{4}0[A-Z0-9]{6}\b'
    ifscs = re.findall(ifsc_pattern, raw_text)
    if ifscs:
        fields['ifsc_codes'] = list(set(ifscs))

    ac_patterns = [
        'A/[Cc]\\s*No[.:\\s]+(\\d{9,18})',
        'Account\\s*No[.:\\s]+(\\d{9,18})',
    ]
    for pattern in ac_patterns:
        match = re.search(pattern, raw_text)
        if match:
            fields['account_number'] = match.group(1)
            break

    lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
    if lines:
        for line in lines[:5]:
            if line.isupper() and len(line) > 5 and len(line) < 60:
                fields['probable_vendor_name'] = line
                break

    tax_pattern = '(CGST|SGST|IGST|GST)\\s*@?\\s*(\\d+(?:\\.\\d+)?)\\s*%'
    tax_matches = re.findall(tax_pattern, raw_text, re.IGNORECASE)
    if tax_matches:
        fields['tax_rates'] = [{'type': t[0].upper(), 'rate': t[1]} for t in tax_matches]

    logger.info(f"Regex extraction found {len(fields)} field types")

    return fields


def structure_extracted_data(raw_text, fields, layout_kv=None):
    """Combine raw text, regex fields, and spatial key-value pairs into standard output."""
    all_fields = dict(layout_kv or {})
    all_fields.update({k: v for k, v in fields.items() if k not in all_fields})

    document_type = "invoice" if all_fields else "unknown"

    return {
        'document_type': document_type,
        'all_fields': all_fields,
        'detected_fields': fields,
        'tables': [],
        'raw_text': raw_text,
        'extraction_method': 'tesseract_spatial_regex',
    }
