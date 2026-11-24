// Mirrors Backend/app/inward_schemas.py's quality models.
import { ChallanLineOut } from './entries';

export type QualityResultValue = 'approved' | 'rejected' | 'partial';

export interface QualityLineIn {
  challan_line_id: number;
  accepted_qty: number;
  rejected_qty: number;
  remarks?: string | null;
}

export interface QualityResultIn {
  lines: QualityLineIn[];
  remarks?: string | null;
}

export interface QualityResultLineOut {
  challan_line_id: number;
  accepted_qty: number;
  rejected_qty: number;
  remarks?: string | null;
}

export interface QualityResultOut {
  id: number;
  entry_id: number;
  result: QualityResultValue;
  source: string;
  inspected_by_name?: string | null;
  inspected_at?: string | null;
  recorded_at: string;
  remarks?: string | null;
  lines: QualityResultLineOut[];
}

export interface QualityResultSaved {
  pass_state: string;
  quality_result: QualityResultOut;
}

export interface QualityQueueItem {
  id: number;
  vehicle_number: string;
  supplier?: string | null;
  po_number?: string | null;
  challan_number?: string | null;
  pass_state: string;
  pass_state_changed_at?: string | null;
  minutes_in_state?: number | null;
  over_sla: boolean;
  challan_lines: ChallanLineOut[];
  current_result?: QualityResultOut | null;
}
