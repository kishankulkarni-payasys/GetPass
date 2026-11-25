// Mirrors Backend/app/schemas.py's GateInConfigOut / OcrResultOut (gate-in OCR, spec 8.1).

export interface GateInConfigOut {
  ocr_enabled: boolean;
  po_lookup_enabled: boolean;
  ocr_confidence_threshold: number;
  max_challan_lines: number;
}

export interface OcrLineOut {
  material: string;
  quantity?: number | null;
  uom?: string | null;
  confidence?: number | null;
}

export interface OcrResultOut {
  doc_type: string;
  confidence?: number | null;
  plate?: string | null;
  po_number?: string | null;
  supplier_name?: string | null;
  challan_number?: string | null;
  lines: OcrLineOut[];
  field_confidence: Record<string, number>;
}
