import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";

export type InspectionVehicle = {
  visit_id: string; vehicle_id: string; vehicle_no: string; model: string | null;
  current_stage: string; current_status: string; stage_started_at: string | null;
  assigned_to: string | null; job_type: string | null; inspection_attempts: number;
  last_inspection_result: string | null; last_inspection_at: string | null;
};
export type InspectionFilter = "ALL" | "PENDING" | "IN_PROGRESS" | "REINSPECTION";
export function formatInspectionTime(value: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "Time unavailable";
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) + " IST";
}
export function useFinalInspectorQueue() {
  const [items, setItems] = useState<InspectionVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requests = useRef(0);
  const load = useCallback(async (refresh = false) => {
    const request = ++requests.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const { data, error: queueError } = await supabase.rpc("new_workflow_final_inspection_queue");
      if (queueError) throw queueError;
      if (!data || data.role !== "final_inspector" || !Array.isArray(data.items)) throw new Error("This workspace is available only to assigned Final Inspectors.");
      if (data.items.some((item: InspectionVehicle) => !item.visit_id || item.current_stage !== "FINAL_INSPECTION")) throw new Error("The inspection queue could not be verified. Refresh and try again.");
      if (request === requests.current) setItems(data.items);
    } catch (e: any) {
      if (request === requests.current) {
        setItems([]);
        setError(e?.message || "Unable to load your inspections.");
      }
    } finally {
      if (request === requests.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { requests.current += 1; };
  }, [load]));
  return { items, loading, refreshing, error, refresh: () => void load(true) };
}
