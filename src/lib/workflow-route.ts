import { supabase } from "../../lib/supabase";

const routes = {
  PENDING_ADVISOR: "/(tabs)/advisor/intake-form",
  ADVISOR_ASSIGNED: "/(tabs)/advisor/intake-form",
  PENDING_SURVEY: "/(tabs)/advisor/survey_form",
  PENDING_APPROVAL: "/(tabs)/advisor/approval_form",
  APPROVAL_HOLD: "/(tabs)/advisor/approval_hold_details",
  ADVISOR_WORK: "/(tabs)/advisor/advisor_work_form",
} as const;

export async function getCurrentWorkflowRoute(vehicleId: string, intakeOnly = false) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Your session has expired. Please log in again.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role,is_active").eq("id", user.id).single();
  if (profileError) throw profileError;
  if (!profile?.is_active || !["advisor", "ceo_admin"].includes(profile.role)) {
    throw new Error("Your account is not authorized to open this workflow action.");
  }

  const { data: visits, error: visitError } = await supabase
    .from("workshop_visits")
    .select("id,vehicle_id,current_stage,current_status,current_assigned_to")
    .eq("vehicle_id", vehicleId).is("closed_at", null).limit(2);
  if (visitError) throw visitError;
  if (!visits?.length) {
    throw new Error("No active workshop visit was found. Vehicle details remain available. Contact CEO Admin before continuing.");
  }
  if (visits.length !== 1) {
    throw new Error("Multiple active workshop visits were found. Contact CEO Admin before continuing.");
  }
  const visit = visits[0];
  const intake = ["PENDING_ADVISOR", "ADVISOR_ASSIGNED"].includes(visit.current_stage);
  const unassignedIntake = visit.current_stage === "PENDING_ADVISOR" && !visit.current_assigned_to;
  if (profile.role === "advisor" && visit.current_assigned_to !== user.id && !unassignedIntake) {
    throw new Error("This vehicle is not assigned to you.");
  }
  if (intakeOnly && !intake) {
    throw new Error("This vehicle has moved beyond Intake. Refresh the vehicle list.");
  }
  if (visit.current_stage === "PENDING_SURVEY" && profile.role !== "advisor") {
    throw new Error("Survey must be completed by the assigned Advisor from the Survey queue.");
  }
  const validStatus = visit.current_stage === "APPROVAL_HOLD"
    ? visit.current_status === "ON_HOLD"
    : (intake ? ["PENDING", "IN_PROGRESS", "ON_HOLD"] : ["PENDING", "IN_PROGRESS"])
      .includes(visit.current_status);
  if (!intake) {
    const { data: supplementary, error: supplementaryError } = await supabase
      .from("supplementary_cycles").select("id,status")
      .eq("visit_id", visit.id)
      .in("status", ["SURVEY", "APPROVAL", "APPROVAL_HOLD", "APPROVED", "CLAIM_REJECTED"])
      .maybeSingle();
    if (supplementaryError) throw supplementaryError;
    if (supplementary) {
      return { pathname: "/(tabs)/advisor/supplementary-detail" as const, params: { vehicleId, visitId: visit.id } };
    }
  }
  const pathname = routes[visit.current_stage as keyof typeof routes];
  if (!pathname || !validStatus) {
    throw new Error("No Intake, Survey or Approval action is available at this stage. Continue from the appropriate workflow queue; vehicle details remain available here.");
  }
  return { pathname, params: { vehicleId, visitId: visit.id } };
}
