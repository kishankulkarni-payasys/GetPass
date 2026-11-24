// Mirrors Backend/app/inward_schemas.py's GRN models.

export type GrnStatus = 'draft' | 'approved';
export type ErpStatus = 'not_required' | 'pending' | 'posted' | 'failed';

export interface GrnLineEdit {
  id: number;
  received_qty?: number | null;
  accepted_qty?: number | null;
  rejected_qty?: number | null;
  remarks?: string | null;
}

export interface GrnLinesEdit {
  lines: GrnLineEdit[];
}

export interface GrnLineOut {
  id: number;
  line_no: number;
  challan_line_id?: number | null;
  material: string;
  uom: string;
  po_qty?: number | null;
  challan_qty: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  quality_accepted_qty?: number | null;
  qty_edited: boolean;
  remarks?: string | null;
  flags: string[];
}

export interface PersonOut {
  id: number;
  full_name: string;
}

export interface GrnOut {
  id: number;
  entry_id: number;
  pass_state: string;
  status: GrnStatus;
  created_by_id: number;
  created_at: string;
  approved_by?: PersonOut | null;
  approved_at?: string | null;
  erp_status?: ErpStatus | null;
  erp_grn_number?: string | null;
  erp_attempts: number;
  erp_last_error?: string | null;
  erp_last_attempt_at?: string | null;
  return_pass_number?: string | null;
  total_received_qty: number;
  total_accepted_qty: number;
  total_rejected_qty: number;
  quality_result?: string | null;
  inspected_by_name?: string | null;
  weighed_by: PersonOut[];
  current_user_weighed: boolean;
  lines: GrnLineOut[];
}

export type GrnWorkGroup = 'send_for_inspection' | 'ready_for_grn' | 'draft' | 'pending_post' | 'approved';

export interface GrnWorkItem {
  entry_id: number;
  group: GrnWorkGroup;
  vehicle_number: string;
  supplier?: string | null;
  po_number?: string | null;
  challan_number?: string | null;
  pass_state: string;
  minutes_in_state?: number | null;
  grn_id?: number | null;
  grn_status?: GrnStatus | null;
  erp_status?: ErpStatus | null;
  erp_attempts?: number | null;
  erp_last_error?: string | null;
  return_pass_number?: string | null;
}
