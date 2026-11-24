// Mirrors Backend/app/schemas.py's pass-related models (VehicleEntryCreate/Out, PassDetailOut, …).

export type PassType = 'inward' | 'general';
export type PassState =
  | 'GATE_IN'
  | 'ON_SITE'
  | 'QUALITY_PENDING'
  | 'QUALITY_RESOLVED'
  | 'GRN_DRAFT'
  | 'GRN_APPROVED'
  | 'GATE_OUT'
  | 'CANCELLED';
export type WeightUnit = 'kg' | 'ton';
export type WeighmentKind = 'gross' | 'tare';
export type WeighmentSource = 'indicator' | 'manual';

export interface ChallanLineIn {
  material: string;
  quantity: number;
  uom: string;
}

export interface ChallanLineOut extends ChallanLineIn {
  id: number;
  line_no: number;
  ocr_confidence?: number | null;
}

export interface VehicleEntryCreate {
  vehicle_number: string;
  project_name?: string | null;
  subproject_name?: string | null;
  driver_name: string;
  driver_phone?: string | null;
  material_description?: string | null;
  material_quantity?: number | null;
  material_unit?: string | null;
  purpose?: string | null;
  reference_doc_number?: string | null;
  supplier_transporter_name?: string | null;
  pass_type: PassType;
  client_ref?: string | null;
  gate_in_method?: 'ocr' | 'qr' | 'manual';
  po_number?: string | null;
  challan_number?: string | null;
  challan_lines?: ChallanLineIn[];
}

export interface PhotoOut {
  id: number;
  file_path: string;
  uploaded_at: string;
  kind: string;
  weighment_id?: number | null;
}

export interface VehicleEntryOut {
  id: number;
  vehicle_number: string;
  project_name?: string | null;
  subproject_name?: string | null;
  driver_name: string;
  driver_phone?: string | null;
  material_description?: string | null;
  material_quantity?: number | null;
  material_unit?: string | null;
  purpose?: string | null;
  reference_doc_number?: string | null;
  supplier_transporter_name?: string | null;
  entry_time: string;
  exit_time?: string | null;
  gross_weight?: number | null;
  weight_unit?: string | null;
  photos: PhotoOut[];
  created_at: string;
  pass_type: PassType;
  pass_state: PassState;
  pass_state_changed_at?: string | null;
  gate_in_method?: string | null;
  po_number?: string | null;
  challan_number?: string | null;
  po_lookup_status?: string | null;
  manual_override: boolean;
  cancelled_reason?: string | null;
  display_state?: string | null;
  dwell_minutes?: number | null;
  erp_status?: string | null;
  current_gross_kg?: number | null;
  current_tare_kg?: number | null;
  net_kg?: number | null;
}

export interface WeighmentOut {
  id: number;
  kind: WeighmentKind;
  weight: number;
  unit: string;
  source: WeighmentSource;
  stable?: boolean | null;
  manual_reason?: string | null;
  captured_by_id?: number | null;
  captured_at: string;
  is_superseded: boolean;
}

export interface QualityLineSummary {
  challan_line_id: number;
  accepted_qty: number;
  rejected_qty: number;
  remarks?: string | null;
}

export interface QualitySummary {
  result: string;
  source: string;
  inspected_by_name?: string | null;
  inspected_at?: string | null;
  remarks?: string | null;
  lines: QualityLineSummary[];
}

export interface GrnSummary {
  status: string;
  erp_status?: string | null;
  erp_grn_number?: string | null;
  return_pass_number?: string | null;
  total_rejected_qty: number;
  approved_at?: string | null;
}

export interface PassDetailOut extends VehicleEntryOut {
  challan_lines: ChallanLineOut[];
  weighments: WeighmentOut[];
  quality?: QualitySummary | null;
  grn?: GrnSummary | null;
}

export interface WeighmentCreate {
  kind: WeighmentKind;
  source: WeighmentSource;
  weight?: number | null;
  unit?: WeightUnit | null;
  manual_reason?: string | null;
  supersede_reason?: string | null;
}

export interface ExitRequest {
  rejected_material_on_vehicle?: boolean;
}

export interface CancelRequest {
  reason: string;
}

export interface EntryListFilters {
  vehicle_number?: string;
  pass_type?: PassType;
  state?: PassState[];
}
