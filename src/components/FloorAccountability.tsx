import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export type FloorWorkRecord = {
  id: string; work_name: string; status: string;
  started_at?: string | null; started_by?: string | null;
  completed_at?: string | null; completed_by?: string | null;
};
export type FloorAccountabilityData = { advisor: string; actorNames: Record<string, string> };

function timestamp(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Entry time unavailable";
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) + " IST";
}
function duration(start: string | null | undefined, end: number) {
  const entered = start ? Date.parse(start) : NaN;
  if (!Number.isFinite(entered) || entered > end) return "Time update pending";
  const minutes = Math.floor((end - entered) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ${minutes % 60} min` : `${Math.floor(hours / 24)} day${hours >= 48 ? "s" : ""} ${hours % 24} hr`;
}

export default function FloorAccountability({ enteredAt, data, items }: {
  enteredAt?: string | null; data?: FloorAccountabilityData; items: FloorWorkRecord[] | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const work = items ?? [];
  const pending = work.filter(item => item.status === "PENDING");
  const updates = work.flatMap(item => [
    ...(item.started_at ? [{ at: item.started_at, actor: item.started_by, description: `${item.work_name} started` }] : []),
    ...(item.completed_at ? [{ at: item.completed_at, actor: item.completed_by, description: `${item.work_name} completed` }] : []),
  ]).filter(update => Number.isFinite(Date.parse(update.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const latest = updates[0];
  const recordedWork = work.filter(item => item.started_at);
  const actor = (id?: string | null) => id ? data?.actorNames[id] || "Name unavailable" : "Recorder unavailable";
  return <View style={styles.card}>
    <View style={styles.heading}><View style={styles.icon}><Ionicons name="time-outline" size={23} color={colors.primary} /></View><View style={styles.grow}><Text style={styles.title}>Time & accountability</Text><Text style={styles.hint}>This Floor entry and its recorded work updates</Text></View></View>
    <View style={styles.timePanel}><Text style={styles.eyebrow}>TIME ON FLOOR</Text><Text style={styles.elapsed}>{duration(enteredAt, now)}</Text><Text style={styles.hint}>Entered: {timestamp(enteredAt)}</Text></View>
    <View style={styles.row}><Ionicons name="person-outline" size={19} color={colors.textSecondary} /><View style={styles.grow}><Text style={styles.label}>Assigned Advisor</Text><Text style={styles.value}>{data?.advisor || "Assignment verification pending"}</Text></View></View>
    <View style={styles.section}><Text style={styles.label}>Pending work</Text><Text style={styles.value}>{!work.length ? "Work update pending" : pending.length ? pending.map(item => item.work_name).join(" · ") : "No pending items in this checklist"}</Text></View>
    <View style={styles.section}><Text style={styles.label}>Latest recorded work update</Text>{latest ? <><Text style={styles.value}>{latest.description}</Text><Text style={styles.hint}>{timestamp(latest.at)}</Text><Text style={styles.hint}>Recorded by {actor(latest.actor)}</Text></> : <Text style={styles.value}>Pending — no work start or completion recorded</Text>}</View>
    <View style={styles.section}><Text style={styles.label}>Recorded work duration</Text>{!recordedWork.length ? <Text style={styles.value}>Pending — work has not been recorded as started</Text> : recordedWork.map(item => <View key={item.id} style={styles.work}>
      <Text style={styles.value}>{item.work_name}</Text>
      <Text style={styles.hint}>Started: {timestamp(item.started_at)} · {actor(item.started_by)}</Text>
      {item.completed_at ? <><Text style={styles.hint}>Completed: {timestamp(item.completed_at)} · {actor(item.completed_by)}</Text><Text style={styles.duration}>{duration(item.started_at, Date.parse(item.completed_at))}</Text></> : <Text style={styles.hint}>{item.status === "IN_PROGRESS" ? `${duration(item.started_at, now)} since work started · completion pending` : "End-time update pending"}</Text>}
    </View>)}</View>
    <View style={styles.note}><Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} /><Text style={styles.noteText}>Time on Floor includes pending time. Work duration uses recorded start and end times; it is not technician labor hours.</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 16 }, heading: { flexDirection: "row", alignItems: "center", gap: 11 }, icon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }, grow: { flex: 1 }, title: { fontSize: 19, fontWeight: "800", color: "#30343B" }, hint: { fontSize: 12, lineHeight: 20, color: colors.textSecondary },
  timePanel: { padding: 15, borderRadius: 13, backgroundColor: colors.background, gap: 6 }, eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: colors.textSecondary }, elapsed: { fontSize: 26, fontWeight: "800", color: colors.text }, row: { flexDirection: "row", gap: 10, alignItems: "center" }, label: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 5 }, value: { fontSize: 14, fontWeight: "600", lineHeight: 22, color: "#30343B" }, section: { borderTopWidth: 1, borderTopColor: "#F0F1F3", paddingTop: 13, gap: 3 }, work: { paddingTop: 8, gap: 3 }, duration: { fontSize: 14, fontWeight: "700", color: colors.primaryDark }, note: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, backgroundColor: colors.background }, noteText: { flex: 1, fontSize: 11, lineHeight: 18, color: colors.textSecondary },
});
