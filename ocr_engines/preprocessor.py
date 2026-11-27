# Reconstructed from compiled bytecode (.pyc) — verify before relying on exact behavior.
"""
Image preprocessing utilities to improve OCR accuracy.
"""
import cv2
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)

_MAX_OCR_DIM = 2000


def preprocess_image(image_path, save_processed=False):
    """
    Fast preprocessing pipeline for OCR:
    1. Resize if oversized  (>2000px longest side adds latency, not accuracy)
    2. Grayscale
    3. Gaussian blur  (replaces fastNlMeansDenoising which took 3-8 s per image)
    4. Adaptive threshold
    5. Deskew if tilted

    Returns preprocessed image as numpy array.
    """
    img = cv2.imread(str(image_path))

    if img is None:
        pil_img = Image.open(str(image_path))
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    h, w = img.shape[:2]

    longest = max(h, w)
    if longest > _MAX_OCR_DIM:
        scale = _MAX_OCR_DIM / longest
        img = cv2.resize(
            img,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_AREA,
        )

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    denoised = cv2.GaussianBlur(gray, (3, 3), 0)

    thresh = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11,
        2,
    )

    try:
        thresh = deskew_image(thresh)
    except Exception as e:
        logger.warning(f"Deskew failed: {e}")

    if save_processed:
        processed_path = str(image_path).replace(".", "_processed.")
        cv2.imwrite(processed_path, thresh)

    return thresh


def deskew_image(image):
    """Detect tilt and rotate image to be straight."""
    coords = np.column_stack(np.where(image > 0))

    if len(coords) < 100:
        return image

    angle = cv2.minAreaRect(coords)[-1]

    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.5:
        return image

    h, w = image.shape[:2]
    center = (w // 2, h // 2)

    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        image,
        M,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )

    logger.info(f"Deskewed image by {angle:.2f} degrees")

    return rotated


def enhance_for_ocr(image_path):
    """
    Lighter preprocessing - just upscale and sharpen.
    Use this for already-clean images where heavy preprocessing might hurt.
    """
    img = cv2.imread(str(image_path))

    if img is None:
        pil_img = Image.open(str(image_path))
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    h, w = img.shape[:2]

    if max(h, w) < 1500:
        scale = 2.0
        img = cv2.resize(
            img,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_CUBIC,
        )

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    kernel = np.array([
        [-1, -1, -1],
        [-1, 9, -1],
        [-1, -1, -1],
    ])
    sharpened = cv2.filter2D(gray, -1, kernel)

    return sharpened
