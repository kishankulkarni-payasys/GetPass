# Reconstructed from compiled bytecode (.pyc) — verify before relying on exact behavior.
"""
Tesseract OCR Engine - 100% free, runs offline.
"""
import os
import re
import tempfile
import logging
import pytesseract
from PIL import Image
from pdf2image import convert_from_path
from django.conf import settings

from .preprocessor import preprocess_image, enhance_for_ocr

logger = logging.getLogger(__name__)

if settings.TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD


def extract_text_from_image(image_path, preprocess=True):
    """
    Extract text from a single image using spatial layout reconstruction.
    Handles horizontal, vertical, and mixed layouts by grouping words
    via bounding-box coordinates rather than reading linearly.

    Returns dict with 'text', 'confidence', and 'key_values' keys.
    """
    try:
        if preprocess:
            img_to_use = preprocess_image(image_path)
        else:
            img_to_use = Image.open(image_path)

        config = '--oem 3 --psm 3'

        data = pytesseract.image_to_data(
            img_to_use,
            config=config,
            output_type=pytesseract.Output.DICT,
            lang='eng',
        )

        words = []
        for i in range(len(data['text'])):
            conf = int(data['conf'][i])
            text = str(data['text'][i]).strip()
            if conf < 20 or not text:
                continue

            h = data['height'][i]
            words.append({
                'text': text,
                'left': data['left'][i],
                'top': data['top'][i],
                'right': data['left'][i] + data['width'][i],
                'bottom': data['top'][i] + h,
                'mid_y': data['top'][i] + h // 2,
                'conf': conf,
            })

        if not words:
            return {'text': '', 'confidence': 0, 'key_values': {}}

        avg_h = sum(w['bottom'] - w['top'] for w in words) / len(words)
        line_gap = max(4, avg_h * 0.55)

        words.sort(key=lambda w: (w['mid_y'], w['left']))

        rows = _group_into_rows(words, line_gap)

        img_right = max(w['right'] for w in words)
        col_gap_threshold = img_right * 0.12

        reconstructed_lines = []
        for row in rows:
            groups = _split_into_columns(row, col_gap_threshold)
            group_texts = [' '.join(w['text'] for w in g) for g in groups]

            if len(group_texts) == 2:
                reconstructed_lines.append(f"{group_texts[0]}: {group_texts[1]}")
            elif len(group_texts) > 2:
                reconstructed_lines.append(' | '.join(group_texts))
            else:
                reconstructed_lines.append(group_texts[0] if group_texts else '')

        reconstructed_text = '\n'.join(l for l in reconstructed_lines if l)

        key_values = _parse_key_values(reconstructed_lines)

        avg_conf = sum(w['conf'] for w in words) / len(words)

        return {
            'text': reconstructed_text,
            'confidence': round(avg_conf, 2),
            'key_values': key_values,
        }
    except Exception as e:
        logger.error(f"Tesseract OCR failed for {image_path}: {e}")
        raise


def _group_into_rows(words, line_gap):
    """Group words into horizontal rows based on vertical proximity."""
    rows = []
    current_row = [words[0]]
    ref_y = words[0]['mid_y']

    for word in words[1:]:
        if abs(word['mid_y'] - ref_y) <= line_gap:
            current_row.append(word)
            ref_y = sum(w['mid_y'] for w in current_row) / len(current_row)
        else:
            rows.append(sorted(current_row, key=lambda w: w['left']))
            current_row = [word]
            ref_y = word['mid_y']

    rows.append(sorted(current_row, key=lambda w: w['left']))
    return rows


def _split_into_columns(row, gap_threshold):
    """Split a row of words into column groups based on horizontal gaps."""
    if not row:
        return []

    groups = []
    current = [row[0]]

    for word in row[1:]:
        if word['left'] - current[-1]['right'] > gap_threshold:
            groups.append(current)
            current = [word]
        else:
            current.append(word)

    groups.append(current)
    return groups


def _parse_key_values(lines):
    """
    Parse key-value pairs from reconstructed lines.
    Handles:
      - "Key: Value"  (horizontal, already encoded by column detection)
      - "Key - Value" / "Key No. Value" patterns
      - Vertical: label line followed by value line
    """
    kv = {}
    i = 0
    while i < len(lines):
        line = lines[i]

        if ': ' in line:
            parts = line.split(': ', 1)
            key, value = parts[0].strip(), parts[1].strip()
            if key and value and len(key) <= 60 and not key.startswith('|'):
                kv[key] = value
            i += 1
            continue

        stripped = line.strip().rstrip(':')

        is_label = bool(re.match('^[A-Z][A-Z0-9 /\\-\\.]{2,50}$', stripped)) and len(stripped.split()) <= 7

        if is_label and i + 1 < len(lines):
            next_line = lines[i + 1].strip()

            if next_line and not re.match('^[A-Z][A-Z0-9 /\\-\\.]{2,50}$', next_line.rstrip(':')):
                kv[stripped] = next_line
                i += 2
                continue

        i += 1

    return kv


def extract_text_from_pdf(pdf_path):
    """Extract text from all pages of a PDF, preserving layout KV pairs per page."""
    try:
        images = convert_from_path(pdf_path, dpi=300)

        all_text = []
        merged_kv = {}
        total_confidence = 0
        page_count = 0

        with tempfile.TemporaryDirectory() as temp_dir:
            for i, img in enumerate(images):
                temp_path = os.path.join(temp_dir, f"page_{i}.png")
                img.save(temp_path)

                result = extract_text_from_image(temp_path)

                all_text.append(f"--- Page {i + 1} ---\n{result['text']}")
                merged_kv.update(result.get('key_values', {}))
                total_confidence += result['confidence']
                page_count += 1

        avg_confidence = total_confidence / page_count if page_count > 0 else 0

        return {
            'text': '\n\n'.join(all_text),
            'confidence': round(avg_confidence, 2),
            'key_values': merged_kv,
            'page_count': page_count,
        }
    except Exception as e:
        logger.error(f"PDF extraction failed for {pdf_path}: {e}")
        raise


def extract_with_tesseract(file_path):
    """
    Main entry point for Tesseract OCR.
    Auto-detects file type and routes appropriately.
    """
    file_path = str(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    logger.info(f"Starting Tesseract OCR on {file_path}")

    if ext == '.pdf':
        result = extract_text_from_pdf(file_path)
    elif ext in ('.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'):
        result = extract_text_from_image(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    logger.info(f"Tesseract OCR complete. Confidence: {result['confidence']}%")
    return result
