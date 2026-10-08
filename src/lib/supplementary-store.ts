import { supabase } from "../../lib/supabase";

type Requirement = { requisition_id: string; work_path: string; cycle_no: number };
export async function supplementaryRequirements(ids: string[]) {
  if (!ids.length) return new Map<string, Requirement>();
  const { data, error } = await supabase.rpc("new_workflow_supplementary_requisition_context", { p_requisition_ids: ids });
  if (error) throw error;
  return new Map((data as Requirement[]).map(row => [row.requisition_id, row]));
}

// Display the current requisition's scope while leaving the original saved Advisor Work intact.
export function requirementView<T extends { work_path: string; parts_required: boolean; denting_required: boolean; painting_required: boolean; advisor_requisition_no: string | null; requisition_at: string | null; remarks: string | null }>(work: T | null, requirement: Requirement | undefined, requisition: { requisition_no: string; requisition_at: string; remarks: string | null } | null): T | null {
  if (!work || !requirement || !requisition) return work;
  const repair = requirement.work_path === "DENTING_PAINTING_PARTS";
  return { ...work, work_path: requirement.work_path, parts_required: true, denting_required: repair, painting_required: repair, advisor_requisition_no: requisition.requisition_no, requisition_at: requisition.requisition_at, remarks: requisition.remarks };
}
