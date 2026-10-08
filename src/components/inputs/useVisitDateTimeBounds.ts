import { useCallback, useEffect, useState } from "react";
import { useIsFocused } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { parseDateTime } from "../../lib/date-time";
import { GATE_IN_UNAVAILABLE, validateVisitDateTime, visitDateTimeBounds } from "../../lib/visit-date-time";

/** Read-only, visit-specific lookup shared by editable workflow dates. */
export default function useVisitDateTimeBounds(visitId?: string | null, refreshKey?: number) {
  const focused = useIsFocused();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ visitId?: string | null; gateInAt: string | null; error: string | null }>({ gateInAt: null, error: null });
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let current = true;
    setState({ visitId, gateInAt: null, error: null });
    if (!visitId || !focused) return () => { current = false; };
    void (async () => {
      try {
        const { data, error } = await supabase.from("gate_entries").select("gate_in_at").eq("visit_id", visitId).maybeSingle();
        const gate = parseDateTime(data?.gate_in_at);
        if (error || !gate || gate.getTime() > Date.now()) throw new Error(GATE_IN_UNAVAILABLE);
        if (current) setState({ visitId, gateInAt: gate.toISOString(), error: null });
      } catch {
        if (current) setState({ visitId, gateInAt: null, error: GATE_IN_UNAVAILABLE });
      }
    })();
    return () => { current = false; };
  }, [visitId, focused, revision, refreshKey]);
  // A newly selected vehicle must never inherit the previous vehicle's bounds.
  const gateInAt = state.visitId === visitId ? state.gateInAt : null;
  return {
    reload,
    error: state.visitId === visitId ? state.error : null,
    bounds: () => visitDateTimeBounds(gateInAt),
    validate: (value: string | Date | null) => validateVisitDateTime(value instanceof Date ? (Number.isFinite(value.getTime()) ? value.toISOString() : "invalid") : value, gateInAt),
  };
}
