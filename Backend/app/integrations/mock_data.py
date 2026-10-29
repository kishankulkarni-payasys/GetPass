"""Fixture data for the mock adapters, so the full flow can be walked through without real systems."""

MOCK_PLATE = "MH14GK8820"
MOCK_PLATE_CONFIDENCE = 99.0

MOCK_PO_OCR = {
    "po_number": "VJ-PO-2026-04417",
    "supplier_name": "UltraTech Cement Ltd",
    "confidence": 97.0,
    "field_confidence": {"po_number": 97.0, "supplier_name": 95.0},
}

# Challan number confidence is deliberately below the default threshold so the
# low-confidence highlight on the review screen can be tested.
MOCK_CHALLAN_OCR = {
    "challan_number": "DC-88213",
    "confidence": 62.0,
    "lines": [
        {"material": "OPC 53-Grade Cement", "quantity": 320.0, "uom": "bags", "confidence": 93.0},
        {"material": "PPC Cement", "quantity": 80.0, "uom": "bags", "confidence": 91.0},
    ],
}

MOCK_PURCHASE_ORDERS = [
    {
        "po_number": "VJ-PO-2026-04417",
        "supplier_name": "UltraTech Cement Ltd",
        "lines": [
            {"material": "OPC 53-Grade Cement", "uom": "bags", "open_qty": 320.0},
            {"material": "PPC Cement", "uom": "bags", "open_qty": 80.0},
        ],
    },
    {
        "po_number": "VJ-PO-2026-04502",
        "supplier_name": "JSW Steel Ltd",
        "lines": [{"material": "TMT Bar Fe500D 12mm", "uom": "MT", "open_qty": 18.5}],
    },
    {
        "po_number": "VJ-PO-2026-04588",
        "supplier_name": "Ambuja Cements Ltd",
        "lines": [{"material": "OPC 53-Grade Cement", "uom": "bags", "open_qty": 500.0}],
    },
]

MOCK_MIN_WEIGHT_KG = 8_000
MOCK_MAX_WEIGHT_KG = 45_000
# One reading in four is unstable so the "not stable" path can be tested.
MOCK_UNSTABLE_ONE_IN = 4
