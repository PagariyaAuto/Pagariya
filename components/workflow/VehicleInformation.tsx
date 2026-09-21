
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../src/theme";

type Vehicle = {
  vehicle_no: string;
  model: string | null;
  vehicle_type: string | null;
  arena_nexa: string | null;
  jc_no: string | null;
  current_stage: string;
};

type Props = {
  vehicle: Vehicle;
};

export default function VehicleInformation({ vehicle }: Props) {
  const isPendingAdvisor = vehicle.current_stage === "PENDING_ADVISOR";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons
            name="car-outline"
            size={22}
            color={colors.primary}
          />
        </View>

        <Text style={styles.cardTitle}>Vehicle Information</Text>
      </View>

      <View style={styles.vehicleNumberBox}>
        <Text style={styles.vehicleNumber}>{vehicle.vehicle_no}</Text>

        <View
          style={[
            styles.statusBadge,
            isPendingAdvisor ? styles.pendingStatus : styles.assignedStatus,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isPendingAdvisor
                ? styles.pendingStatusText
                : styles.assignedStatusText,
            ]}
          >
            {isPendingAdvisor ? "Pending Advisor" : "Assigned"}
          </Text>
        </View>
      </View>

      <InfoRow label="Model" value={vehicle.model || "Not available"} />
      <InfoRow
        label="Vehicle Type"
        value={vehicle.vehicle_type || "Not available"}
      />
      <InfoRow label="Brand" value={vehicle.arena_nexa || "Not available"} />
      <InfoRow label="Job Card No." value={vehicle.jc_no || "Not assigned"} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  vehicleNumberBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  vehicleNumber: {
    ...typography.heading,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.round,
  },
  pendingStatus: {
    backgroundColor: colors.warningLight,
  },
  assignedStatus: {
    backgroundColor: colors.successLight,
  },
  statusText: {
    ...typography.caption,
    fontWeight: "600",
  },
  pendingStatusText: {
    color: colors.warning,
  },
  assignedStatusText: {
    color: colors.success,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.md,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
    textAlign: "right",
  },
});