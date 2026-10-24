export type Scope = "own" | "common" | "from_above";
export type Route = "diy" | "specialist" | "manager" | "neighbor";
export type Severity = "low" | "medium" | "high" | "emergency";

export type Material = { name: string; spec: string; measure_first: boolean };

// Shape returned by POST /api/reports (see server/triage.js)
export type TriageResult = {
  diagnosis: string;
  category: string;
  severity: Severity;
  safety_flag: boolean;
  active_leak: boolean;
  urgent: boolean;
  immediate_action: string;
  route: Route;
  route_reason: string;
  steps: string[];
  materials: Material[];
  specialist_trade: string;
  confidence: number;
  question_if_unsure?: string | null;
  neighbor_message?: string;
  safety_notes: string[];
  responsibility_note: string;
};

export type ReportStatus = "new" | "sent" | "in_progress" | "fixed";

export type ReportResponse = { id: string | null; scope: Scope; status?: ReportStatus; ai_result: TriageResult };

// Домоуправител output from POST /api/manager/plan/:id (see server/manager.js)
export type ManagerPlan = {
  diagnosis: string;
  severity: Severity;
  immediate_action: string;
  plan_steps: string[];
  suggested_contractor: { name: string; phone: string; why: string } | null;
  budget_note: string;
  uses_context: string[];
  resident_notice: string;
  valve_location_text: string | null;
  valve_photo_url: string | null;
};

export type Report = {
  id: string;
  reporter_id: string | null;
  building_id: string;
  photo_url: string | null;
  scope: Scope;
  note: string | null;
  route: Route;
  status: ReportStatus;
  ai_result: Partial<TriageResult> & { diagnosis: string; severity: Severity };
  manager_plan: ManagerPlan | null;
  created_at: string;
};

export type Contractor = { name: string; trade: string; phone: string };
export type PastRepair = { year: number | string; what: string; contractor: string };

export type BuildingContext = {
  building_id: string;
  name: string | null;
  address: string | null;
  year: number | null;
  type: string | null;
  pipe_material: string | null;
  valve_location_text: string | null;
  valve_photo_url: string | null;
  panel_location_text: string | null;
  contractors: Contractor[];
  past_repairs: PastRepair[];
};

export type Specialist = { id: string; trade: string; name: string; phone: string; area: string };
export type Store = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  product_search_url: string;
  distance_km: number | null;
};
