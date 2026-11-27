// Mirrors Backend/app/schemas.py's DocScanOut / DocScanSaveIn / DocScanSavedOut
// (Doc Scan: OCR + regex field extraction for ID-style paperwork).

export interface DocScanFields {
  po_number: string | null;
  name: string | null;
  aadhaar: string | null;
  mobile: string | null;
  date: string | null;
  amount: string | null;
  email: string | null;
}

export type DocScanMethod = 'text' | 'ocr' | 'photo';

export interface DocScanOut {
  file_name: string;
  method: DocScanMethod;
  page_count: number;
  fields: DocScanFields;
  raw_text?: string | null;
}

export interface DocScanSaveIn {
  file_name: string;
  method: DocScanMethod;
  page_count: number;
  fields: DocScanFields;
  raw_text?: string | null;
}

export interface DocScanSavedOut {
  id: number;
}
