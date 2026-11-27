import asyncio
import io
import struct
import unittest
from unittest.mock import Mock, patch

import pymupdf
from starlette.datastructures import Headers
from starlette.datastructures import UploadFile

from app.routers.gate_in import read_document
from app.doc_scan_extractor import parse_fields
from app.pdf_conversion import first_page_as_png
from app.photo_storage import InvalidPhotoError


class FirstPageAsPngTests(unittest.TestCase):
    def test_renders_only_the_first_page(self):
        document = pymupdf.open()
        document.new_page(width=300, height=600)
        document.new_page(width=600, height=300)
        contents = document.tobytes()
        document.close()

        png = first_page_as_png(contents)

        self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))
        width, height = struct.unpack(">II", png[16:24])
        self.assertGreater(height, width)

    def test_rejects_non_pdf_content(self):
        with self.assertRaisesRegex(InvalidPhotoError, "valid PDF"):
            first_page_as_png(b"not a PDF")

    def test_rejects_malformed_pdf(self):
        with self.assertRaisesRegex(InvalidPhotoError, "could not be read"):
            first_page_as_png(b"%PDF-1.7\nnot a valid PDF")


class GateInPdfOcrTests(unittest.TestCase):
    def test_pdf_upload_is_rendered_before_calling_ocr_adapter(self):
        document = pymupdf.open()
        document.new_page(width=300, height=600)
        pdf = document.tobytes()
        document.close()
        upload = UploadFile(
            filename="purchase-order.pdf",
            file=io.BytesIO(pdf),
            headers=Headers({"content-type": "application/pdf"}),
        )
        adapter = Mock(enabled=True)
        adapter.read.return_value = {"po_number": "PO-123"}

        with patch("app.routers.gate_in.get_ocr_adapter", return_value=adapter):
            result = asyncio.run(read_document(upload, "po"))

        image, content_type, doc_type = adapter.read.call_args.args
        self.assertTrue(image.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertEqual(content_type, "image/png")
        self.assertEqual(doc_type, "po")
        self.assertEqual(result.po_number, "PO-123")


class DocScanPoExtractionTests(unittest.TestCase):
    def test_extracts_po_number_without_confusing_challan_number(self):
        fields = parse_fields("PO DATE 05.05.2026\nPO NO: 4600012345\nCHALLAN NO: MH2603062254")

        self.assertEqual(fields["po_number"], "4600012345")

    def test_extracts_purchase_order_label(self):
        fields = parse_fields("Purchase Order Number: PO-2026/145")

        self.assertEqual(fields["po_number"], "PO-2026/145")


if __name__ == "__main__":
    unittest.main()
