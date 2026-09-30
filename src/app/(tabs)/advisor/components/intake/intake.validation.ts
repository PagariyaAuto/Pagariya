import type {
  ChecklistState,
  DocumentMaster,
  JobType,
  VehicleRecord,
  VehicleType,
  VisitRecord,
  WorkerGroup,
} from "./intake.types";

export const MAX_MOBILE_LENGTH = 10;

export function normalizeVehicleNumber(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function normalizeMobile(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, MAX_MOBILE_LENGTH);
}

export function formatDateTime(
  value: string | null
): string {
  if (!value) {
    return "Time unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isRequiredDocument(
  document: DocumentMaster
): boolean {
  return (
    document.requirement_type
      ?.trim()
      .toUpperCase() !== "OPTIONAL"
  );
}

export function getDocumentRequirementLabel(
  document: DocumentMaster
): string {
  return isRequiredDocument(document)
    ? "Required"
    : "Optional";
}

type ValidateVehicleIntakeParams = {
  vehicle: VehicleRecord | null;
  visit: VisitRecord | null;

  customerName: string;
  customerMobile: string;

  vehicleType: VehicleType;
  selectedModelId: string;
  arenaNexa: string;

  jobType: JobType;
  selectedMiTypeId: string;
  selectedInsuranceId: string;

  workerGroup: WorkerGroup;

  requiredDocuments: DocumentMaster[];
  documentChecklist: ChecklistState;

  jobCardNo: string;
};

export function validateVehicleIntake({
  vehicle,
  visit,
  customerName,
  customerMobile,
  vehicleType,
  selectedModelId,
  arenaNexa,
  jobType,
  selectedMiTypeId,
  selectedInsuranceId,
  workerGroup,
  requiredDocuments,
  documentChecklist,
  jobCardNo,
}: ValidateVehicleIntakeParams): string | null {
  /*
   * ------------------------------------------------------------
   * BASIC VEHICLE / VISIT VALIDATION
   * ------------------------------------------------------------
   */

  if (!vehicle) {
    return "Vehicle details are unavailable.";
  }

  if (!visit) {
    return "Workshop visit details are unavailable.";
  }

  /*
   * ------------------------------------------------------------
   * CUSTOMER DETAILS
   * ------------------------------------------------------------
   */

  if (!customerName.trim()) {
    return "Please enter the customer name.";
  }

  if (
    customerMobile.length !==
    MAX_MOBILE_LENGTH
  ) {
    return "Please enter a valid 10-digit customer mobile number.";
  }

  /*
   * ------------------------------------------------------------
   * VEHICLE TYPE
   * ------------------------------------------------------------
   */

  if (!vehicleType) {
    return "Please select the vehicle type.";
  }

  /*
   * ------------------------------------------------------------
   * VEHICLE MODEL
   * ------------------------------------------------------------
   */

  if (!selectedModelId) {
    return "Please select the vehicle model.";
  }

  if (!arenaNexa) {
    return "Arena/Nexa could not be determined from the selected vehicle model.";
  }

  const normalizedArenaNexa =
    arenaNexa.trim().toUpperCase();

  if (
    normalizedArenaNexa !== "ARENA" &&
    normalizedArenaNexa !== "NEXA"
  ) {
    return "The selected vehicle model has an invalid Arena/Nexa value.";
  }

  /*
   * ------------------------------------------------------------
   * INSURANCE / MI
   * ------------------------------------------------------------
   *
   * PAID:
   *   - No MI selection required
   *   - No insurance company required
   *
   * INSURANCE:
   *   - MI / NON-MI is mandatory
   *   - Insurance company is mandatory for BOTH MI and NON-MI
   *
   * This matches the deployed
   * new_workflow_save_vehicle_intake RPC.
   */

  if (
    jobType === "INSURANCE" &&
    !selectedMiTypeId
  ) {
    return "Please select MI or NON-MI.";
  }

  if (
    jobType === "INSURANCE" &&
    !selectedInsuranceId
  ) {
    return "Please select the insurance company.";
  }

  /*
   * ------------------------------------------------------------
   * WORKER GROUP
   * ------------------------------------------------------------
   */

  if (!workerGroup) {
    return "Please select the worker group.";
  }

  /*
   * ------------------------------------------------------------
   * DOCUMENT CHECKLIST
   * ------------------------------------------------------------
   */

  const missingRequiredDocuments =
    requiredDocuments.filter(
      (document) =>
        documentChecklist[document.id] !== true
    );

  if (
    missingRequiredDocuments.length > 0
  ) {
    return `Please complete all required documents. ${missingRequiredDocuments.length} required document(s) are still pending.`;
  }

  /*
   * ------------------------------------------------------------
   * JOB CARD
   * ------------------------------------------------------------
   */

  if (!jobCardNo.trim()) {
    return "Please enter the Job Card No.";
  }

  /*
   * ------------------------------------------------------------
   * WORKFLOW STAGE
   * ------------------------------------------------------------
   *
   * IMPORTANT:
   *
   * Vehicle Intake can now be completed from BOTH:
   *
   *   PENDING_ADVISOR
   *        ↓
   *   Advisor starts intake
   *        ↓
   *   Save Vehicle Intake
   *        ↓
   *   Backend atomically assigns vehicle to Advisor
   *
   * OR:
   *
   *   ADVISOR_ASSIGNED
   *        ↓
   *   Continue Intake
   *        ↓
   *   Save Vehicle Intake
   *
   * The backend RPC
   * new_workflow_save_vehicle_intake
   * is responsible for the atomic assignment when the
   * current stage is PENDING_ADVISOR.
   */

  if (
    visit.current_stage !==
      "PENDING_ADVISOR" &&
    visit.current_stage !==
      "ADVISOR_ASSIGNED"
  ) {
    return `Vehicle Intake cannot be completed from the current stage: ${visit.current_stage.replace(
      /_/g,
      " "
    )}.`;
  }

  /*
   * ------------------------------------------------------------
   * ALL VALIDATION PASSED
   * ------------------------------------------------------------
   */

  return null;
}