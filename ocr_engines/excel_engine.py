# Reconstructed from compiled bytecode (.pyc) — verify before relying on exact behavior.
"""
Excel OCR Engine — reads .xlsx / .xls cell data directly (no image conversion needed).
"""
import os
import logging

logger = logging.getLogger(__name__)


def extract_from_excel(file_path):
    """
    Read every cell from every sheet and return:
      - raw_text   : pipe-separated table text (one row per line)
      - key_values : rows with exactly 2 non-empty cells treated as key→value pairs
      - confidence : 100.0 (structured data, no OCR uncertainty)
    """
    file_path = str(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    if ext in ('.xlsx', '.xlsm'):
        return _read_xlsx(file_path)
    elif ext == '.xls':
        return _read_xls(file_path)
    else:
        raise ValueError(f"Unsupported Excel format: {ext}")


def _read_xlsx(file_path):
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("openpyxl is required for .xlsx files. Run: pip install openpyxl")

    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheets = {}
    for name in wb.sheetnames:
        ws = wb[name]
        sheets[name] = [[cell.value for cell in row] for row in ws.iter_rows()]

    return _build_result(sheets)


def _read_xls(file_path):
    try:
        import xlrd
    except ImportError:
        raise RuntimeError("xlrd is required for .xls files. Run: pip install xlrd")

    wb = xlrd.open_workbook(file_path)
    sheets = {}
    for name in wb.sheet_names():
        ws = wb.sheet_by_name(name)
        sheets[name] = [ws.row_values(r) for r in range(ws.nrows)]

    return _build_result(sheets)


def _build_result(sheets):
    """Convert sheet data → raw_text + key_values dict."""
    text_parts = []
    key_values = {}

    for sheet_name, rows in sheets.items():
        sheet_lines = []
        for row in rows:
            cells = [str(v).strip() for v in row if v is not None and str(v).strip()]
            if not cells:
                continue

            sheet_lines.append(" | ".join(cells))

            if len(cells) == 2 and len(cells[0]) <= 60:
                key_values[cells[0]] = cells[1]

        if sheet_lines:
            text_parts.append(f"=== Sheet: {sheet_name} ===\n" + "\n".join(sheet_lines))

    raw_text = "\n\n".join(text_parts)
    logger.info(f"Excel extracted {len(key_values)} KV pairs from {len(sheets)} sheet(s).")

    return {
        'text': raw_text,
        'key_values': key_values,
        'confidence': 100.0,
    }
