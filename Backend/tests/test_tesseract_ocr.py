import os
import unittest
from unittest.mock import patch

from app.integrations import AdapterConfigError
from app.integrations.ocr import DOC_TYPE_PO, DOC_TYPE_SCAN, TesseractOcr


class TesseractOcrTests(unittest.TestCase):
    def test_requires_an_installed_engine(self):
        with patch.dict(os.environ, {"TESSERACT_CMD": ""}), patch("app.integrations.ocr.shutil.which", return_value=None):
            with self.assertRaisesRegex(AdapterConfigError, "Tesseract is not installed"):
                TesseractOcr()

    def test_extracts_po_number_from_local_ocr_text(self):
        with (
            patch.dict(os.environ, {"TESSERACT_CMD": ""}),
            patch("app.integrations.ocr.shutil.which", return_value="tesseract.exe"),
            patch("PIL.Image.open", return_value=object()),
            patch("pytesseract.image_to_string", return_value="PO NO: 4600012345"),
        ):
            result = TesseractOcr().read(b"image", "image/png", DOC_TYPE_PO)

        self.assertEqual(result["po_number"], "4600012345")

    def test_returns_ocr_text_for_document_scan(self):
        with (
            patch.dict(os.environ, {"TESSERACT_CMD": ""}),
            patch("app.integrations.ocr.shutil.which", return_value="tesseract.exe"),
            patch("PIL.Image.open", return_value=object()),
            patch("pytesseract.image_to_string", return_value="PO NO: 4600012345"),
        ):
            result = TesseractOcr().read(b"image", "image/png", DOC_TYPE_SCAN)

        self.assertEqual(result["text"], "PO NO: 4600012345")

    def test_falls_back_to_word_position_for_multi_column_invoices(self):
        # Mirrors a real tax invoice: "PO NO" sits in a left column, but at the
        # same row height, Tesseract's reading order inserts a token from an
        # unrelated right column ("Invoice Date/Time 19.09.2026") right after
        # the label, before the actual value. The plain-text regex in
        # parse_fields can't skip over that and fails, so the fallback must
        # use word x-position (`left`) to find the nearest value-shaped word
        # to the right of "PO NO", ignoring array order entirely.
        flattened_text = (
            "Buyers Code MH24N02242 CIN NO L26957MH2006PLC160839\n"
            "PO DATE 05.05.2026 PAN NO. AABCJ6731B\n"
            "PO NO 19.09.2026 WAWP/00502/26-27\n"
        )
        image_to_data = {
            # Deliberately out of left-to-right order, as Tesseract can emit
            # when it misjudges column boundaries.
            "text": ["19.09.2026", "PO", "NO", "WAWP/00502/26-27"],
            "left": [400, 50, 90, 150],
            "block_num": [1, 1, 1, 1],
            "par_num": [1, 1, 1, 1],
            "line_num": [3, 3, 3, 3],
        }
        with (
            patch.dict(os.environ, {"TESSERACT_CMD": ""}),
            patch("app.integrations.ocr.shutil.which", return_value="tesseract.exe"),
            patch("PIL.Image.open", return_value=object()),
            patch("pytesseract.image_to_string", return_value=flattened_text),
            patch("pytesseract.image_to_data", return_value=image_to_data),
        ):
            result = TesseractOcr().read(b"image", "image/png", DOC_TYPE_PO)

        self.assertEqual(result["po_number"], "WAWP/00502/26-27")

    def test_returns_none_when_po_number_cannot_be_found_at_all(self):
        with (
            patch.dict(os.environ, {"TESSERACT_CMD": ""}),
            patch("app.integrations.ocr.shutil.which", return_value="tesseract.exe"),
            patch("PIL.Image.open", return_value=object()),
            patch("pytesseract.image_to_string", return_value="no recognizable fields here"),
            patch("pytesseract.image_to_data", return_value={"text": [], "block_num": [], "par_num": [], "line_num": []}),
        ):
            result = TesseractOcr().read(b"image", "image/png", DOC_TYPE_PO)

        self.assertIsNone(result["po_number"])


if __name__ == "__main__":
    unittest.main()
