import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../../lib/supabase";
import { colors } from "../../theme";

type Person = { id: string; name: string | null };
export default function StoreInchargePicker({ value, onChange, disabled = false }: {
  value: string | null; onChange: (id: string) => void; disabled?: boolean;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void (async () => {
      try {
        const { data, error: failure } = await supabase.rpc("new_workflow_active_store_incharges");
        if (failure) throw failure;
        if (!Array.isArray(data?.items)) throw new Error("Store Incharges could not be loaded.");
        if (active) setPeople(data.items);
      } catch (e: any) {
        if (active) { setPeople([]); setError(e?.message || "Unable to load Store Incharges."); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [attempt]);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return <View style={styles.group}>
    <Text style={styles.title}>Store Incharge *</Text>
    <Text style={styles.hint}>Choose who will handle the parts for this vehicle.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <>
      <Text style={styles.hint}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={retry} disabled={disabled}><Text style={styles.action}>Try again</Text></Pressable>
    </> : !people.length ? <Text style={styles.hint}>No active Store Incharge is available. Ask CEO Admin to add or activate one.</Text> : people.map(person => <Pressable
      key={person.id} accessibilityRole="radio" accessibilityState={{ checked: value === person.id, disabled }}
      disabled={disabled} onPress={() => onChange(person.id)}
      style={[styles.person, value === person.id && styles.selected, disabled && styles.disabled]}>
      <Ionicons name={value === person.id ? "radio-button-on" : "radio-button-off"} size={22} color={colors.primary} />
      <Text style={styles.name}>{person.name || "Store Incharge"}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 10, marginVertical: 12 }, title: { color: colors.text, fontSize: 15, fontWeight: "800" },
  hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }, action: { color: colors.primary, fontWeight: "700", paddingVertical: 10 },
  person: { padding: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, name: { color: colors.text, fontSize: 14, flex: 1, fontWeight: "600" }, disabled: { opacity: 0.5 },
});
