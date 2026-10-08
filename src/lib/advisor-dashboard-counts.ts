export type CountKey =
  | "INTAKE" | "CLAIM_INTIMATION" | "SURVEY" | "APPROVAL"
  | "APPROVAL_HOLD" | "SUPPLEMENTARY" | "ADVISOR_WORK" | "STORE"
  | "FLOOR" | "FINAL_INSPECTION" | "BILLING" | "READY_FOR_DELIVERY";
export type DashboardCounts = Record<CountKey, number>;
export type DashboardVisit = {
  id: string;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  closed_at: string | null;
};

const stages: Record<string, CountKey> = {
  PENDING_ADVISOR: "INTAKE", ADVISOR_ASSIGNED: "INTAKE",
  CLAIM_INTIMATION: "CLAIM_INTIMATION", PENDING_SURVEY: "SURVEY",
  PENDING_APPROVAL: "APPROVAL", APPROVAL_HOLD: "APPROVAL_HOLD",
  ADVISOR_WORK: "ADVISOR_WORK", STORE: "STORE", FLOOR: "FLOOR",
};
const advisorStages = new Set([
  "PENDING_ADVISOR", "ADVISOR_ASSIGNED", "CLAIM_INTIMATION",
  "PENDING_SURVEY", "PENDING_APPROVAL", "APPROVAL_HOLD", "ADVISOR_WORK",
]);

export function countDashboardVisits(
  visits: DashboardVisit[], role: "advisor" | "ceo_admin", userId: string,
  assignedVisitIds: ReadonlySet<string>,
): DashboardCounts {
  const counts: DashboardCounts = {
    INTAKE: 0, CLAIM_INTIMATION: 0, SURVEY: 0, APPROVAL: 0,
    APPROVAL_HOLD: 0, SUPPLEMENTARY: 0, ADVISOR_WORK: 0, STORE: 0,
    FLOOR: 0, FINAL_INSPECTION: 0, BILLING: 0, READY_FOR_DELIVERY: 0,
  };
  const seen = new Set<string>();
  for (const visit of visits) {
    if (seen.has(visit.id) || visit.closed_at ||
      !["PENDING", "IN_PROGRESS", "ON_HOLD"].includes(visit.current_status)) continue;
    seen.add(visit.id);
    const stage = visit.current_stage;
    if (role === "advisor" && (advisorStages.has(stage)
      ? visit.current_assigned_to !== userId : !assignedVisitIds.has(visit.id))) continue;
    // Shared unassigned Intake remains discoverable in its queue, but it is
    // not an Advisor's assigned workload. Admin includes every pending intake.
    if (role === "ceo_admin" && stage === "PENDING_ADVISOR" && visit.current_assigned_to) continue;
    const key = stages[stage];
    if (key) counts[key]++;
  }
  return counts;
}

/** Avoid silently limiting Admin/Advisor totals to the first API page. */
export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await fetchPage(from, from + size - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

export function queueItems<T>(value: unknown, role: string): T[] {
  const queue = value as { role?: string; items?: T[] } | null;
  if (!queue || queue.role !== role || !Array.isArray(queue.items))
    throw new Error("Dashboard counts could not be loaded. Please refresh.");
  return queue.items;
}

export function uniqueVisitCount(items: { visit_id: string }[]) {
  if (items.some(item => typeof item.visit_id !== "string" || !item.visit_id))
    throw new Error("Dashboard counts could not be loaded. Please refresh.");
  return new Set(items.map(item => item.visit_id)).size;
}
