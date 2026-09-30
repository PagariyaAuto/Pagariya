export type PopupType =
  | "success"
  | "error"
  | "warning"
  | "info";

export type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
  actionLabel?: string;
};

export type DropdownType =
  | "model"
  | "insurance"
  | null;

export type VehicleType =
  | "PRIVATE"
  | "COMMERCIAL";

export type JobType =
  | "PAID"
  | "INSURANCE";

export type MiType =
  | "MI"
  | "NON-MI";

export type WorkerGroup =
  | "CNT"
  | "PNPL";

export type VehicleModel = {
  id: string;
  name: string;
  arena_nexa: string | null;
  is_active?: boolean | null;
};

export type InsuranceCompany = {
  id: string;
  name: string;
  is_active?: boolean | null;
};

export type MiMaster = {
  id: string;
  name: string;
  code: string | null;
  is_active?: boolean | null;
};

export type DocumentMaster = {
  id: string;
  name: string;
  vehicle_type: string;
  workflow_stage: string;
  requirement_type: string | null;
  is_active: boolean;
};

export type ChecklistState = Record<string, boolean>;

export type PhotoItem = {
  id: string;
  uri: string;
  storagePath: string | null;
  photoType: string;
};

export type VehicleRecord = {
  id: string;
  vehicle_no: string;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_type: string | null;
  model: string | null;
  arena_nexa: string | null;
  jc_no: string | null;
};

export type VisitRecord = {
  id: string;
  vehicle_id: string;
  current_stage: string;
  current_status: string | null;
  current_assigned_to: string | null;
};

export type GateEntry = {
  gate_in_at: string | null;
};

