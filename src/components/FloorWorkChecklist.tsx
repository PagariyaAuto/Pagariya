import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type Work = { id: string; work_name: string; status: string };
const states: Record<
  string,
  { label: string; color: string; background: string }
> = {
  PENDING: { label: "Pending", color: "#946200", background: "#FFF6DD" },
  IN_PROGRESS: {
    label: "In progress",
    color: "#2563EB",
    background: "#EFF6FF",
  },
  COMPLETED: { label: "Completed", color: "#217A50", background: "#E8F5EE" },
  STOPPED_FOR_SUPPLEMENTARY: {
    label: "Stopped for supplementary",
    color: colors.primaryDark,
    background: colors.primaryLight,
  },
};

export default function FloorWorkChecklist({
  cycle,
  items,
}: {
  cycle: number | null;
  items: Work[] | null;
}) {
  const work = items ?? [];
  const completed = work.filter((item) => item.status === "COMPLETED").length;
  const allComplete = work.length > 0 && completed === work.length;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>Floor work checklist</Text>
          <Text style={styles.hint}>
            {cycle ? `Floor cycle ${cycle}` : "Current Floor progress"}
          </Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {completed} / {work.length}
          </Text>
        </View>
      </View>
      {!!work.length && (
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Floor work completed"
          accessibilityValue={{ min: 0, max: work.length, now: completed }}
        >
          <View
            style={[
              styles.fill,
              { width: `${(completed / work.length) * 100}%` },
            ]}
          />
        </View>
      )}
      {!work.length && (
        <Text style={styles.hint}>
          {cycle
            ? "No work items are available for this cycle. Refresh or contact CEO Admin to check the approved scope."
            : "The approved checklist will appear when the Floor work cycle is prepared."}
        </Text>
      )}
      {work.map((item, index) => {
        const state = states[item.status] ?? {
          label: item.status.replaceAll("_", " "),
          color: colors.textSecondary,
          background: colors.background,
        };
        return (
          <View key={item.id} style={styles.work}>
            <View
              style={[
                styles.marker,
                item.status === "COMPLETED" && styles.completed,
              ]}
            >
              {item.status === "COMPLETED" ? (
                <Ionicons name="checkmark" size={18} color="#217A50" />
              ) : (
                <Text style={styles.number}>{index + 1}</Text>
              )}
            </View>
            <View style={styles.heading}>
              <Text style={styles.name}>{item.work_name}</Text>
              <View
                style={[styles.badge, { backgroundColor: state.background }]}
              >
                <Text style={[styles.status, { color: state.color }]}>
                  {state.label}
                </Text>
              </View>
            </View>
            {item.status === "IN_PROGRESS" && (
              <Ionicons name="time-outline" size={21} color={state.color} />
            )}
          </View>
        );
      })}
      {!!work.length && (
        <Text style={styles.hint}>
          Only the work recorded for this Floor cycle is shown. Progress follows
          saved work updates.
        </Text>
      )}
      <View style={styles.inspectionNotice}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#217A50" />
        <View style={styles.heading}>
          <Text style={styles.inspectionTitle}>
            Final Inspection · Mandatory
          </Text>
          <Text style={styles.hint}>
            {allComplete
              ? "All checklist items are complete. Final Inspection is still required before the vehicle proceeds."
              : "Every vehicle must go to Final Inspection after Floor work, including after inspection rework."}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontSize: 19, fontWeight: "800", color: "#30343B" },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 19 },
  counter: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
  },
  counterText: { fontSize: 12, fontWeight: "800", color: colors.primaryDark },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F0F1F3",
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  work: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#F0F1F3",
  },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  completed: { backgroundColor: "#E8F5EE" },
  number: { fontSize: 13, fontWeight: "800", color: colors.textSecondary },
  name: { fontSize: 15, fontWeight: "700", color: "#30343B" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  status: { fontSize: 11, fontWeight: "700" },
  inspectionNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#E8F5EE",
  },
  inspectionTitle: { fontSize: 13, fontWeight: "800", color: "#217A50" },
});
