import os
import unittest
from unittest.mock import patch

from app.integrations import AdapterError
from app.integrations import ocr_local
from app.integrations.ocr import DOC_TYPE_CHALLAN, DOC_TYPE_PLATE, DOC_TYPE_PO, LocalOcr, get_ocr_adapter


def _gemini_result(all_fields, line_items=None, confidence=95.0):
    return {
        "raw_text": "",
        "extracted_data": {"all_fields": all_fields, "line_items": line_items or []},
        "confidence_score": confidence,
        "engine_used": "gemini",
    }


class LocalOcrPlateTests(unittest.TestCase):
    def test_plate_requests_are_rejected(self):
        with self.assertRaises(AdapterError):
            LocalOcr().read(b"image-bytes", "image/jpeg", DOC_TYPE_PLATE)


class LocalOcrPoMappingTests(unittest.TestCase):
    def test_maps_gemini_fields_to_po_contract(self):
        result = _gemini_result({"po_number": "VJ-PO-2026-04417", "vendor_name": "UltraTech Cement Ltd"})
        with patch.object(ocr_local, "scan_image", return_value=result):
            data = LocalOcr().read(b"image-bytes", "image/jpeg", DOC_TYPE_PO)

        self.assertEqual(data["po_number"], "VJ-PO-2026-04417")
        self.assertEqual(data["supplier_name"], "UltraTech Cement Ltd")
        self.assertEqual(data["confidence"], 95.0)
        self.assertEqual(data["field_confidence"], {"po_number": 95.0, "supplier_name": 95.0})

    def test_falls_back_to_tesseract_regex_field_names(self):
        result = {
            "raw_text": "",
            "extracted_data": {
                "all_fields": {"invoice_number": "INV-9", "probable_vendor_name": "ACME TRADERS"},
                "line_items": [],
            },
            "confidence_score": 62.0,
            "engine_used": "tesseract_regex",
        }
        with patch.object(ocr_local, "scan_image", return_value=result):
            data = LocalOcr().read(b"image-bytes", "image/jpeg", DOC_TYPE_PO)

        self.assertEqual(data["po_number"], "INV-9")
        self.assertEqual(data["supplier_name"], "ACME TRADERS")

    def test_missing_fields_are_none_with_no_field_confidence(self):
        result = _gemini_result({})
        with patch.object(ocr_local, "scan_image", return_value=result):
            data = LocalOcr().read(b"image-bytes", "image/jpeg", DOC_TYPE_PO)

        self.assertIsNone(data["po_number"])
        self.assertIsNone(data["supplier_name"])
        self.assertEqual(data["field_confidence"], {})


class LocalOcrChallanMappingTests(unittest.TestCase):
    def test_maps_line_items_to_challan_lines(self):
        result = _gemini_result(
            {"dispatch_doc_number": "DC-88213"},
            line_items=[
                {"description": "OPC 53-Grade Cement", "qty": "320", "unit": "bags"},
                {"description": "PPC Cement", "qty": "80.5", "unit": "bags"},
                {"description": "", "qty": "5", "unit": "bags"},  # no description/hsn -> dropped
            ],
        )
        with patch.object(ocr_local, "scan_image", return_value=result):
            data = LocalOcr().read(b"image-bytes", "image/jpeg", DOC_TYPE_CHALLAN)

        self.assertEqual(data["challan_number"], "DC-88213")
        self.assertEqual(len(data["lines"]), 2)
        self.assertEqual(data["lines"][0], {"material": "OPC 53-Grade Cement", "quantity": 320.0, "uom": "bags", "confidence": 95.0})
        self.assertEqual(data["lines"][1]["quantity"], 80.5)

    def test_caps_lines_at_max_challan_lines(self):
        from app.schemas import MAX_CHALLAN_LINES

        line_items = [{"description": f"Item {i}", "qty": "1", "unit": "pcs"} for i in range(MAX_CHALLAN_LINES + 5)]
        result = _gemini_result({}, line_items=line_items)
        with patch.object(ocr_local, "scan_image", return_value=result):
            data = LocalOcr().read(b"image-bytes", "image/jpeg", DOC_TYPE_CHALLAN)

        self.assertEqual(len(data["lines"]), MAX_CHALLAN_LINES)

    def test_falls_back_to_delivery_note_when_no_dispatch_doc_number(self):
        result = _gemini_result({"delivery_note": "DN-1"})
        with patch.object(ocr_local, "scan_image", return_value=result):
            data = LocalOcr().read(b"image-bytes", "image/jpeg", DOC_TYPE_CHALLAN)

        self.assertEqual(data["challan_number"], "DN-1")


class LocalOcrErrorHandlingTests(unittest.TestCase):
    def test_engine_exception_is_wrapped_in_adapter_error(self):
        with patch.object(ocr_local, "scan_image", side_effect=RuntimeError("tesseract not found")):
            with self.assertRaises(AdapterError):
                LocalOcr().read(b"image-bytes", "image/jpeg", DOC_TYPE_PO)


class GetOcrAdapterTests(unittest.TestCase):
    def test_local_provider_selects_local_ocr(self):
        get_ocr_adapter.cache_clear()
        with patch.dict(os.environ, {"OCR_PROVIDER": "local"}, clear=False):
            adapter = get_ocr_adapter()
        get_ocr_adapter.cache_clear()
        self.assertIsInstance(adapter, LocalOcr)


class ScanImageDispatchTests(unittest.TestCase):
    def test_uses_gemini_when_available(self):
        with patch.object(ocr_local, "is_gemini_available", return_value=True), \
             patch.object(ocr_local, "_scan_with_gemini", return_value={"engine_used": "gemini"}) as gemini_call, \
             patch.object(ocr_local, "_scan_with_tesseract") as tesseract_call:
            result = ocr_local.scan_image(b"image-bytes")

        gemini_call.assert_called_once()
        tesseract_call.assert_not_called()
        self.assertEqual(result["engine_used"], "gemini")

    def test_falls_back_to_tesseract_when_gemini_unavailable(self):
        with patch.object(ocr_local, "is_gemini_available", return_value=False), \
             patch.object(ocr_local, "_scan_with_tesseract", return_value={"engine_used": "tesseract_regex"}) as tesseract_call:
            result = ocr_local.scan_image(b"image-bytes")

        tesseract_call.assert_called_once()
        self.assertEqual(result["engine_used"], "tesseract_regex")


class ExtractInvoiceFieldsTests(unittest.TestCase):
    def test_extracts_known_patterns(self):
        text = "Invoice No: INV-2026-001\nGSTIN: 27ABCDE1234F1Z5\nTotal: Rs. 12,500.50"
        fields = ocr_local.extract_invoice_fields(text)

        self.assertEqual(fields["invoice_number"], "INV-2026-001")
        self.assertIn("27ABCDE1234F1Z5", fields["gstin"])
        self.assertIn("12,500.50", fields["amounts"])

    def test_empty_text_returns_no_fields(self):
        self.assertEqual(ocr_local.extract_invoice_fields(""), {})


if __name__ == "__main__":
    unittest.main()
