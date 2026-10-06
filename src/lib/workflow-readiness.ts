import { supabase } from "../../lib/supabase";

type SupportedStage = "PENDING_SURVEY" | "PENDING_APPROVAL";

type ActiveJob = {
  id: string;
  vehicle_id: string;
  advisor_id: string | null;
  current_job_stage: string;
  approval_status?: string | null;
};

type ReadinessJobResponse = {
  count: number;
  job: ActiveJob | null;
};

export async function checkWorkflowReadiness(
  visitId: string,
  vehicleId: string,
  expectedStage: SupportedStage,
): Promise<ActiveJob> {
  /*
   * 1. VALIDATE INPUT
   */

  if (!visitId) {
    throw new Error("Workshop visit information is missing.");
  }

  if (!vehicleId) {
    throw new Error("Vehicle information is missing.");
  }

  /*
   * 2. AUTH SESSION
   */

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  /*
   * 3. ACTIVE PROFILE
   */

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,is_active")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  if (!profile || !profile.is_active) {
    throw new Error("Your account is not authorized for this workflow.");
  }

  const role = String(profile.role || "").toLowerCase();

  if (!["advisor", "ceo_admin"].includes(role)) {
    throw new Error("Your account is not authorized for this workflow.");
  }

  /*
   * Survey is Advisor-only.
   *
   * CEO Admin may process Approval, but should not
   * perform the Advisor's Survey action.
   */

  if (expectedStage === "PENDING_SURVEY" && role !== "advisor") {
    throw new Error("Only the assigned Advisor can process this Survey.");
  }

  /*
   * 4. VERIFY ACTIVE VISIT
   *
   * The workshop visit remains authoritative for:
   *
   * - vehicle identity
   * - workflow stage
   * - workflow status
   * - current assignment
   */

  const { data: visit, error: visitError } = await supabase
    .from("workshop_visits")
    .select(
      "id,vehicle_id,current_stage,current_status,current_assigned_to,closed_at",
    )
    .eq("id", visitId)
    .single();

  if (visitError) {
    throw visitError;
  }

  if (!visit) {
    throw new Error("Workshop visit could not be found.");
  }

  if (visit.closed_at) {
    throw new Error("This workshop visit is no longer active.");
  }

  /*
   * Prevent stale/wrong routes from opening one
   * workshop visit using another vehicle ID.
   */

  if (visit.vehicle_id !== vehicleId) {
    throw new Error(
      "Vehicle and workshop visit do not match. Refresh the queue and try again.",
    );
  }

  /*
   * 5. VERIFY EXPECTED WORKFLOW STAGE
   */

  if (visit.current_stage !== expectedStage) {
    throw new Error(
      `This vehicle has moved to ${String(
        visit.current_stage || "another stage",
      ).replaceAll("_", " ")}. Refresh before continuing.`,
    );
  }

  if (!["PENDING", "IN_PROGRESS"].includes(visit.current_status)) {
    throw new Error(
      `This vehicle can no longer be processed because its status is ${String(
        visit.current_status || "unknown",
      ).replaceAll("_", " ")}.`,
    );
  }

  /*
   * 6. VERIFY CURRENT ADVISOR OWNERSHIP
   *
   * Advisors may process only vehicles actively
   * assigned to them.
   *
   * CEO Admin may process Approval without taking
   * over the vehicle assignment.
   */

  if (role === "advisor") {
    if (!visit.current_assigned_to) {
      throw new Error("This vehicle is not assigned to an Advisor.");
    }

    if (visit.current_assigned_to !== user.id) {
      throw new Error("This vehicle is not assigned to you.");
    }
  }

  /*
   * 7. FIND ACTIVE VEHICLE JOB
   *
   * IMPORTANT:
   *
   * Do NOT query public.vehicle_jobs directly here.
   *
   * vehicle_jobs is protected by RLS, so a valid job
   * may appear as zero rows to the frontend.
   *
   * The readiness RPC performs the narrow authorized
   * lookup and returns:
   *
   * count = 0 -> missing active job
   * count = 1 -> valid active job
   * count > 1 -> conflicting active jobs
   */

  const { data: jobResponse, error: jobError } = await supabase.rpc(
    "new_workflow_get_active_job_for_readiness",
    {
      p_visit_id: visitId,
      p_vehicle_id: visit.vehicle_id,
    },
  );

  if (jobError) {
    throw jobError;
  }

  const readiness = jobResponse as ReadinessJobResponse | null;

  if (!readiness) {
    throw new Error(
      "Unable to verify the active vehicle job. Please refresh and try again.",
    );
  }

  if (readiness.count === 0 || !readiness.job) {
    throw new Error(
      "Vehicle job record missing. Contact CEO Admin before continuing.",
    );
  }

  if (readiness.count > 1) {
    throw new Error(
      "Multiple active vehicle jobs were found. Contact CEO Admin before continuing.",
    );
  }

  const job = readiness.job;

  /*
   * 8. JOB / VISIT CONSISTENCY
   */

  if (job.vehicle_id !== visit.vehicle_id) {
    throw new Error(
      "Vehicle job and workshop visit do not match. Contact CEO Admin before continuing.",
    );
  }

  /*
   * The active job should belong to the same Advisor
   * as the visit assignment whenever an Advisor is
   * performing the action.
   */

  if (role === "advisor") {
    if (!job.advisor_id) {
      throw new Error(
        "The active vehicle job does not have an assigned Advisor. Contact CEO Admin before continuing.",
      );
    }

    if (job.advisor_id !== user.id) {
      throw new Error(
        "The active vehicle job is assigned to a different Advisor. Contact CEO Admin before continuing.",
      );
    }
  }

  /*
   * 9. STAGE-SPECIFIC JOB CHECKS
   *
   * Before Survey, the job must still be within the
   * Advisor-side workflow.
   *
   * Before Approval, the job must not already be
   * approved. This protects against reopening an
   * already-processed Approval form from stale UI.
   */

  if (
    expectedStage === "PENDING_SURVEY" &&
    !["ADVISOR", "PENDING_SURVEY", "SURVEY"].includes(job.current_job_stage)
  ) {
    throw new Error(
      `The active vehicle job is currently at ${String(
        job.current_job_stage || "another stage",
      ).replaceAll("_", " ")}. Refresh before continuing.`,
    );
  }

  if (
    expectedStage === "PENDING_APPROVAL" &&
    job.approval_status === "APPROVED"
  ) {
    throw new Error(
      "This vehicle has already been approved. Refresh the Approval queue.",
    );
  }

  return job;
}
