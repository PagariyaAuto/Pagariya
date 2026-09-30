
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../src/theme";

type VehicleJobSummaryProps = {
  vehicleNumber?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  vehicleModel?: string | null;
  vehicleType?: string | null;
  arenaNexa?: string | null;
  jobCardNumber?: string | null;
  jobType?: string | null;
  jobStage?: string | null;
  vehicleStage?: string | null;
  assignedAdvisor?: string | null;
  assignedFloorIncharge?: string | null;
  remarks?: string | null;
};

function displayValue(value?: string | null) {
  return value?.trim() || "Not available";
}

function formatStage(value?: string | null) {
  if (!value) return "Not available";

  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{displayValue(value)}</Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
}) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function StatusBox({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.statusBox}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{formatStage(value)}</Text>
    </View>
  );
}

export default function VehicleJobSummary({
  vehicleNumber,
  customerName,
  customerMobile,
  vehicleModel,
  vehicleType,
  arenaNexa,
  jobCardNumber,
  jobType,
  jobStage,
  vehicleStage,
  assignedAdvisor,
  assignedFloorIncharge,
  remarks,
}: VehicleJobSummaryProps) {
  return (
    <View style={styles.card}>
      <SectionHeader icon="car-outline" title="Vehicle Information" />

      <View style={styles.vehicleNumberBox}>
        <View style={styles.vehicleNumberContent}>
          <Text style={styles.vehicleNumberLabel}>Vehicle Number</Text>
          <Text style={styles.vehicleNumber}>
            {displayValue(vehicleNumber)}
          </Text>
        </View>
        <Ionicons
          name="car-sport-outline"
          size={29}
          color={colors.primary}
        />
      </View>

      <InfoRow label="Customer Name" value={customerName} />
      <InfoRow label="Mobile Number" value={customerMobile} />
      <InfoRow label="Vehicle Model" value={vehicleModel} />
      <InfoRow label="Vehicle Type" value={vehicleType} />
      <InfoRow label="Arena / Nexa" value={arenaNexa} />

      <View style={styles.sectionSpacing}>
        <SectionHeader icon="clipboard-outline" title="Current Job Card" />

        <InfoRow label="Job Card No." value={jobCardNumber} />
        <InfoRow label="Job Type" value={jobType} />
        <InfoRow label="Assigned Advisor" value={assignedAdvisor} />
        <InfoRow label="Floor Incharge" value={assignedFloorIncharge} />
      </View>

      <View style={styles.statusContainer}>
        <StatusBox label="Vehicle Stage" value={vehicleStage} />
        <StatusBox label="Job Stage" value={jobStage} />
      </View>

      {!!remarks?.trim() && (
        <View style={styles.remarksContainer}>
          <View style={styles.remarksHeader}>
            <Ionicons
              name="document-text-outline"
              size={19}
              color={colors.primary}
            />
            <Text style={styles.remarksTitle}>Remarks</Text>
          </View>
          <Text style={styles.remarksText}>{remarks.trim()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
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
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.text,
    marginLeft: spacing.md,
    flexShrink: 1,
  },
  vehicleNumberBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  vehicleNumberContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  vehicleNumberLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  vehicleNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  infoRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    width: 125,
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  sectionSpacing: {
    marginTop: spacing.xl,
  },
  statusContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statusBox: {
    flex: 1,
    backgroundColor: colors.infoLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  remarksContainer: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  remarksHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  remarksTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginLeft: spacing.sm,
  },
  remarksText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});