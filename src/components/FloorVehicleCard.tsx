import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../theme";

type Work = { work_name: string; status: string };
type Vehicle = {
  floor_entered_at?: string | null;
  vehicle_no: string;
  model: string | null;
  job_id: string | null;
  job_type: string | null;
  current_status: string;
  current_stage?: string;
  floor_cycle: { cycle_no: number; vehicle_in_at?: string | null } | null;
  floor_items: Work[] | null;
  supplementary: { cycle_no: number; status: string } | null;
};

function elapsed(value?: string | null) {
  if (!value) return "Entry time unavailable";
  const start = new Date(value).getTime();
  if (!Number.isFinite(start) || start > Date.now())
    return "Entry time unavailable";
  const minutes = Math.floor((Date.now() - start) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours} hr ${minutes % 60} min`
    : `${Math.floor(hours / 24)} day${hours >= 48 ? "s" : ""} ${hours % 24} hr`;
}

export default function FloorVehicleCard({
  vehicle,
  onPress,
}: {
  vehicle: Vehicle;
  onPress: () => void;
}) {
  const work = vehicle.floor_items ?? [];
  const done = work.filter((item) => item.status === "COMPLETED").length;
  const active = work.filter((item) => item.status === "IN_PROGRESS");
  const supplementaryActive =
    !!vehicle.supplementary &&
    !["RETURNED_TO_FLOOR", "CONTINUED_WITHOUT_SUPPLEMENTARY"].includes(
      vehicle.supplementary.status,
    );
  const readyForInspection =
    work.length > 0 &&
    done === work.length &&
    !supplementaryActive &&
    (!vehicle.current_stage || vehicle.current_stage === "FLOOR");
  const status = readyForInspection
    ? "Ready for inspection"
    : vehicle.current_status === "IN_PROGRESS"
      ? "In progress"
      : vehicle.current_status === "PENDING"
        ? "Pending"
        : vehicle.current_status.replaceAll("_", " ");
  const progressing = vehicle.current_status === "IN_PROGRESS";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.vehicle_no}, ${status}. View Floor details`}
      style={styles.card}
    >
      <View style={styles.heading}>
        <View style={styles.icon}>
          <Ionicons name="car-sport-outline" size={25} color={colors.primary} />
        </View>
        <View style={styles.vehicle}>
          <Text style={styles.registration}>{vehicle.vehicle_no}</Text>
          <Text style={styles.model}>
            {vehicle.model || "Model not recorded"}
          </Text>
        </View>
        <View style={[styles.badge, progressing && styles.activeBadge]}>
          <View style={[styles.dot, progressing && styles.activeDot]} />
          <Text style={[styles.badgeText, progressing && styles.activeText]}>
            {status}
          </Text>
        </View>
      </View>
      <View style={styles.tags}>
        {vehicle.job_type && (
          <Text style={styles.tag}>
            {vehicle.job_type === "PAID"
              ? "Paid job"
              : vehicle.job_type === "INSURANCE"
                ? "Insurance job"
                : vehicle.job_type.replaceAll("_", " ")}
          </Text>
        )}
        {vehicle.floor_cycle && (
          <Text style={styles.tag}>
            Floor cycle {vehicle.floor_cycle.cycle_no}
          </Text>
        )}
        {vehicle.supplementary && (
          <Text style={styles.tag}>
            Supplementary {vehicle.supplementary.cycle_no}
          </Text>
        )}
      </View>
      <View style={styles.progressHeading}>
        <Text style={styles.sectionLabel}>WORK PROGRESS</Text>
        <Text style={styles.progressCount}>
          {work.length ? `${done} of ${work.length} completed` : "Pending"}
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: work.length || 1, now: done }}
      >
        <View
          style={[
            styles.fill,
            { width: `${work.length ? (done / work.length) * 100 : 0}%` },
          ]}
        />
      </View>
      <Text style={styles.work}>
        {supplementaryActive
          ? "Supplementary workflow active"
          : active.length
            ? active.map((item) => item.work_name).join(", ") + " in progress"
            : readyForInspection
              ? "Approved Floor work complete · Final Inspection required"
              : work.length
                ? "Approved work awaiting the next action"
                : "Approved checklist awaiting Floor preparation"}
      </Text>
      {!vehicle.job_id && (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={17} color={colors.error} />
          <Text style={styles.warningText}>
            Vehicle record correction pending
          </Text>
        </View>
      )}
      <View style={styles.footer}>
        <View style={styles.elapsed}>
          <Ionicons
            name="time-outline"
            size={17}
            color={colors.textSecondary}
          />
          <Text style={styles.elapsedText}>
            Time on Floor: {elapsed(vehicle.floor_entered_at)}
          </Text>
        </View>
        <View style={styles.link}>
          <Text style={styles.linkText}>View Floor details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E8E9EC",
    gap: 13,
    shadowColor: "#171717",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    flexWrap: "wrap",
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicle: { flex: 1, minWidth: 145, gap: 4 },
  registration: { fontSize: 20, fontWeight: "800", color: "#30343B" },
  model: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FFF6DD",
  },
  activeBadge: { backgroundColor: "#E8F5EE" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#946200" },
  activeText: { color: "#217A50" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#B77C00" },
  activeDot: { backgroundColor: "#217A50" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: {
    fontSize: 11,
    color: "#616874",
    backgroundColor: "#F5F6F7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  progressHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#7A808A",
  },
  progressCount: { fontSize: 12, fontWeight: "600", color: "#616874" },
  track: {
    height: 6,
    backgroundColor: "#F0F1F3",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  work: { fontSize: 13, lineHeight: 20, color: "#616874" },
  warning: {
    flexDirection: "row",
    gap: 7,
    padding: 10,
    backgroundColor: "#FFF1F2",
    borderRadius: 10,
  },
  warningText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.error },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#F0F1F3",
    paddingTop: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  elapsed: { flexDirection: "row", alignItems: "center", gap: 6 },
  elapsedText: { fontSize: 12, color: colors.textSecondary },
  link: { flexDirection: "row", alignItems: "center", gap: 3 },
  linkText: { fontSize: 12, fontWeight: "700", color: colors.primary },
});
