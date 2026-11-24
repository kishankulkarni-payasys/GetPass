// Mirrors Backend/app/inward_schemas.py's dashboard models.

export type Tone = 'good' | 'warn' | 'crit' | 'info' | 'neutral';

export interface DashboardKpis {
  on_site_now: number;
  awaiting_quality: number;
  quality_over_sla: number;
  grn_pending_post: number;
  avg_dwell_minutes?: number | null;
  vehicles_today: number;
}

export interface DashboardRow {
  id: number;
  vehicle_number: string;
  supplier?: string | null;
  pass_type: string;
  pass_state: string;
  display_state: string;
  tone: Tone;
  erp_status?: string | null;
  dwell_minutes: number;
  minutes_in_state?: number | null;
  over_sla: boolean;
  qty_source?: string | null;
}

export interface DashboardSummary {
  day: string;
  generated_at: string;
  dwell_sla_minutes: number;
  quality_sla_minutes: number;
  kpis: DashboardKpis;
  board: DashboardRow[];
}
