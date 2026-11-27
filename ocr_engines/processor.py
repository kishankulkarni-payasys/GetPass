# Reconstructed from compiled bytecode (.pyc) — verify before relying on exact behavior.
"""
Unified OCR processor - orchestrates Gemini OCR engine.
"""
import os
import logging

from django.conf import settings

from .field_extractor import extract_invoice_fields, structure_extracted_data
from .gemini_engine import extract_with_gemini, extract_with_gemini_text, is_gemini_available
from .excel_engine import extract_from_excel
from .universal_engine import extract_from_document, SUPPORTED_EXTS as _DOC_EXTS

logger = logging.getLogger(__name__)

_EXCEL_EXTS = {'.xlsx', '.xlsm', '.xls'}


def process_document(file_path, engine='gemini'):
    """
    Main OCR processing function. Routes by file type first, then processes with Gemini.

    Args:
        file_path: Path to the document file
        engine: 'gemini' (only supported engine)

    Returns:
        dict with raw_text, extracted_data, confidence_score
    """
    logger.info(f"Processing document with engine: {engine}")

    ext = os.path.splitext(str(file_path))[1].lower()

    if ext in _EXCEL_EXTS:
        return _process_excel(file_path)

    if ext in _DOC_EXTS:
        return _process_document(file_path)

    return _process_with_gemini(file_path)


def _process_excel(file_path):
    """Excel files: read cells directly, then run Gemini over the text dump."""
    try:
        excel_result = extract_from_excel(file_path)
        raw_text = excel_result["text"]
        layout_kv = excel_result.get("key_values", {})

        if is_gemini_available():
            try:
                structured_data = extract_with_gemini_text(raw_text)
                structured_data.setdefault("all_fields", {}).update(
                    {k: v for k, v in layout_kv.items() if k not in structured_data["all_fields"]}
                )
                return {
                    "raw_text": raw_text,
                    "extracted_data": structured_data,
                    "confidence_score": 98.0,
                    "engine_used": "gemini_text",
                }
            except Exception as e:
                logger.warning(f"Gemini text extraction failed for Excel: {e}, using cell KV only")

        fields = extract_invoice_fields(raw_text)
        structured_data = structure_extracted_data(raw_text, fields, layout_kv=layout_kv)

        return {
            "raw_text": raw_text,
            "extracted_data": structured_data,
            "confidence_score": excel_result["confidence"],
            "engine_used": "excel_direct",
        }
    except Exception as e:
        logger.error(f"Excel processing failed: {e}")
        raise


def _process_document(file_path):
    """Word, TXT, CSV, HTML, RTF, PPT, XML, JSON — extract text then run Gemini."""
    try:
        result = extract_from_document(file_path)
        raw_text = result["text"]
        layout_kv = result.get("key_values", {})

        if is_gemini_available():
            try:
                structured_data = extract_with_gemini_text(raw_text)
                structured_data.setdefault("all_fields", {}).update(
                    {k: v for k, v in layout_kv.items() if k not in structured_data["all_fields"]}
                )
                return {
                    "raw_text": raw_text,
                    "extracted_data": structured_data,
                    "confidence_score": 97.0,
                    "engine_used": "gemini_text",
                }
            except Exception as e:
                logger.warning(f"Gemini text extraction failed: {e}")

        fields = extract_invoice_fields(raw_text)
        structured_data = structure_extracted_data(raw_text, fields, layout_kv=layout_kv)

        return {
            "raw_text": raw_text,
            "extracted_data": structured_data,
            "confidence_score": result["confidence"],
            "engine_used": "universal_text",
        }
    except Exception as e:
        logger.error(f"Document processing failed: {e}")
        raise


def _process_with_gemini(file_path):
    """Process using Google Gemini Vision."""
    if not is_gemini_available():
        raise RuntimeError("Gemini API is not available. Set GEMINI_API_KEY in .env.")

    try:
        structured_data = extract_with_gemini(file_path)
        raw_text = structured_data.get("raw_text", "")

        return {
            "raw_text": raw_text,
            "extracted_data": structured_data,
            "confidence_score": 95.0,
            "engine_used": "gemini",
        }
    except Exception as e:
        logger.error(f"Gemini processing failed: {e}")
        raise
