import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../../lib/supabase";
import { colors } from "../../theme";
import { Modal, ScrollView } from "../inputs/KeyboardAware";
import StoreInchargePicker from "./StoreInchargePicker";

export default function StoreAssignmentControl({ vehicleId, vehicleNo, onAssigned }: {
  vehicleId: string; vehicleNo: string; onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visit, setVisit] = useState<{ id: string; current_assigned_to: string | null } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const busy = useRef(false);
  const load = async () => {
    if (busy.current) return;
    busy.current = true; setOpen(true); setLoading(true); setError(""); setVisit(null); setSelected(null);
    try {
      const { data, error: failure } = await supabase.from("workshop_visits")
        .select("id,current_assigned_to").eq("vehicle_id", vehicleId).eq("current_stage", "STORE")
        .in("current_status", ["PENDING", "IN_PROGRESS"]).is("closed_at", null).single();
      if (failure) throw failure;
      if (!data) throw new Error("This vehicle is no longer available in Store.");
      setVisit(data);
    } catch (e: any) { setError(e?.message || "Unable to load this assignment."); }
    finally { setLoading(false); busy.current = false; }
  };
  const save = async () => {
    if (!visit || !selected || busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const { data, error: failure } = await supabase.rpc("new_workflow_assign_store", {
        p_visit_id: visit.id, p_store_incharge_id: selected, p_expected_assigned_to: visit.current_assigned_to,
      });
      if (failure) throw failure;
      if (data?.success !== true) throw new Error("The assignment could not be confirmed. Refresh before trying again.");
      setOpen(false); onAssigned();
    } catch (e: any) { setError(e?.message || "Unable to save the assignment."); }
    finally { setSaving(false); busy.current = false; }
  };
  return <>
    <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.trigger}>
      <Text style={styles.triggerText}>Assign / Change Store Incharge</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!loading && !saving) setOpen(false); }}>
      <View style={styles.overlay}><View style={styles.dialog}><ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Assign Store Incharge</Text>
        <Text style={styles.vehicle}>{vehicleNo}</Text>
        <Text style={styles.hint}>The selected Incharge will see this vehicle in their Store queue. The Advisor stays responsible for the job.</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : visit && <StoreInchargePicker value={selected} onChange={setSelected} disabled={saving} />}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!loading && <Pressable accessibilityRole="button" disabled={saving} onPress={() => void load()}><Text style={styles.triggerText}>Refresh assignment</Text></Pressable>}
        <View style={styles.row}>
          <Pressable accessibilityRole="button" disabled={loading || saving} onPress={() => setOpen(false)} style={styles.cancel}><Text style={styles.triggerText}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={loading || saving || !visit || !selected} onPress={() => void save()} style={[styles.save, (loading || saving || !visit || !selected) && { opacity: 0.5 }]}>
            <Text style={styles.saveText}>{saving ? "Saving…" : "Save assignment"}</Text>
          </Pressable>
        </View>
      </ScrollView></View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 10 },
  triggerText: { color: colors.primary, fontWeight: "700", fontSize: 13 }, overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  dialog: { backgroundColor: colors.surface, borderRadius: 18, width: "100%", maxWidth: 480, maxHeight: "85%" }, content: { padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" }, vehicle: { color: colors.primary, fontWeight: "800", fontSize: 16 }, hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  error: { color: colors.primaryDark, fontSize: 13, lineHeight: 20 }, row: { flexDirection: "row", gap: 10, flexWrap: "wrap" }, cancel: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  save: { flexGrow: 1, padding: 14, backgroundColor: colors.primary, borderRadius: 12, alignItems: "center" }, saveText: { color: "white", fontWeight: "800", fontSize: 13 },
});
