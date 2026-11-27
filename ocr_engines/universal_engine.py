# Reconstructed from compiled bytecode (.pyc) — verify before relying on exact behavior.
"""
Universal document text extractor.
Handles Word, TXT, CSV, HTML, RTF, PowerPoint and any plain-text file.
Returns the same shape as other engines: {text, key_values, confidence}
"""
import os
import logging

logger = logging.getLogger(__name__)

SUPPORTED_EXTS = {'.tsv', '.txt', '.ods', '.odp', '.odt', '.json', '.ppt', '.csv', '.doc', '.xml', '.htm', '.html', '.pptx', '.docx', '.rtf'}


def extract_from_document(file_path):
    """
    Extract text from any supported document format.
    Returns {'text', 'key_values', 'confidence'}.
    """
    file_path = str(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    extractors = {
        '.docx': _from_docx,
        '.doc': _from_doc,
        '.pptx': _from_pptx,
        '.ppt': _from_ppt,
        '.csv': _from_csv,
        '.tsv': _from_csv,
        '.html': _from_html,
        '.htm': _from_html,
        '.rtf': _from_rtf,
        '.xml': _from_xml,
        '.json': _from_json,
        '.odt': _from_odt,
        '.ods': _from_ods,
        '.odp': _from_odp,
        '.txt': _from_text,
    }

    fn = extractors.get(ext, _from_text)
    try:
        raw_text = fn(file_path)
    except Exception as e:
        logger.warning(f"Primary extractor failed for {ext}: {e}. Trying plain-text fallback.")
        raw_text = _from_text(file_path)

    key_values = _extract_kv(raw_text)
    logger.info(f"Universal engine extracted {len(raw_text)} chars, {len(key_values)} KV pairs.")

    return {'text': raw_text, 'key_values': key_values, 'confidence': 95.0}


def _from_docx(path):
    import docx

    doc = docx.Document(path)
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if cells:
                parts.append(" | ".join(cells))
    return "\n".join(parts)


def _from_doc(path):
    try:
        import subprocess

        result = subprocess.run(["antiword", path], capture_output=True, text=True, timeout=15)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout
        return _from_text(path)
    except Exception:
        return _from_text(path)


def _from_pptx(path):
    from pptx import Presentation

    prs = Presentation(path)
    parts = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            for para in shape.text_frame.paragraphs:
                text = para.text.strip()
                if text:
                    parts.append(text)
    return "\n".join(parts)


def _from_ppt(path):
    return _from_text(path)


def _from_csv(path):
    import csv
    import chardet

    raw = open(path, "rb").read()
    enc = chardet.detect(raw).get("encoding", "utf-8") or "utf-8"
    lines = []
    with open(path, encoding=enc, errors="replace") as f:
        reader = csv.reader(f)
        for row in reader:
            cells = [c.strip() for c in row]
            if cells:
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def _from_html(path):
    from html.parser import HTMLParser

    class _Strip(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts = []

        def handle_data(self, data):
            t = data.strip()
            if t:
                self.parts.append(t)

    raw = _read_bytes(path)
    p = _Strip()
    p.feed(raw)
    return "\n".join(p.parts)


def _from_rtf(path):
    try:
        from striprtf.striprtf import rtf_to_text

        raw = _read_bytes(path)
        return rtf_to_text(raw)
    except ImportError:
        import re

        raw = _read_bytes(path)
        text = re.sub(r"\\[a-z]+\d* ?", " ", raw)
        text = re.sub(r"[{}\\]", "", text)
        return " ".join(text.split())


def _from_xml(path):
    from xml.etree import ElementTree as ET

    tree = ET.parse(path)
    texts = [el.text.strip() for el in tree.iter() if el.text and el.text.strip()]
    return "\n".join(texts)


def _from_json(path):
    import json

    with open(path, encoding="utf-8", errors="replace") as f:
        data = json.load(f)
    return json.dumps(data, indent=2)


def _from_odt(path):
    try:
        from odf.opendocument import load
        from odf.text import P

        doc = load(path)
        parts = [str(p) for p in doc.getElementsByType(P) if str(p).strip()]
        return "\n".join(parts)
    except ImportError:
        return _from_text(path)


def _from_ods(path):
    try:
        from odf.opendocument import load
        from odf.table import Table, TableRow, TableCell

        doc = load(path)
        lines = []
        for table in doc.getElementsByType(Table):
            for row in table.getElementsByType(TableRow):
                cells = [str(c).strip() for c in row.getElementsByType(TableCell) if str(c).strip()]
                if cells:
                    lines.append(" | ".join(cells))
        return "\n".join(lines)
    except ImportError:
        return _from_text(path)


def _from_odp(path):
    return _from_odt(path)


def _from_text(path):
    try:
        import chardet

        raw = open(path, "rb").read()
        enc = chardet.detect(raw).get("encoding", "utf-8") or "utf-8"
        return raw.decode(enc, errors="replace")
    except Exception:
        return open(path, errors="replace").read()


def _read_bytes(path):
    try:
        import chardet

        raw = open(path, "rb").read()
        enc = chardet.detect(raw).get("encoding", "utf-8") or "utf-8"
        return raw.decode(enc, errors="replace")
    except Exception:
        return open(path, errors="replace").read()


def _extract_kv(text):
    """Extract key: value pairs from plain text."""
    import re

    kv = {}
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r"^([A-Za-z][A-Za-z0-9 /\-\.]{1,50}?)\s*[:\-]\s*(.+)$", line)
        if m:
            key, val = m.group(1).strip(), m.group(2).strip()
            if val and len(key) <= 60:
                kv[key] = val
    return kv
