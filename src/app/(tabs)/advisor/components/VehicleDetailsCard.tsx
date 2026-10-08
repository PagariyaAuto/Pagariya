
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { colors, spacing, typography } from "../../../../theme";

export type VehicleDetails = {
  id?: string;
  vehicle_no?: string | null;
  current_stage?: string | null;
  current_assigned_to?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  model?: string | null;
  arena_nexa?: string | null;
  vehicle_type?: string | null;
};

type VehicleDetailsCardProps = {
  vehicle: VehicleDetails | null;
};

function displayValue(value?: string | null) {
  return value?.trim() || "—";
}

function DetailItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide: boolean;
}) {
  return (
    <View style={[styles.detailItem, wide && styles.detailItemWide]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function VehicleDetailsCard({
  vehicle,
}: VehicleDetailsCardProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 600;
  const stage = vehicle?.current_stage?.trim().toLowerCase().replace(/_/g, " ").replace(/\b[a-z]/g, letter => letter.toUpperCase()) || "—";
  const vehicleNumber = displayValue(vehicle?.vehicle_no);
  const vehicleMake = displayValue(vehicle?.arena_nexa);
  const vehicleModel = displayValue(vehicle?.model);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🚘</Text>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>Vehicle Details</Text>
          <Text style={styles.subtitle}>
            Vehicle information for this survey
          </Text>
        </View>
      </View>

      <View style={styles.registrationBox}>
        <Text style={styles.registrationLabel}>VEHICLE REGISTRATION</Text>
        <Text style={styles.registrationNumber}>{vehicleNumber}</Text>
        <Text style={styles.registrationHint}>
          {vehicleMake !== "—" && vehicleModel !== "—"
            ? `${vehicleMake} · ${vehicleModel}`
            : vehicleMake !== "—"
              ? vehicleMake
              : vehicleModel !== "—"
                ? vehicleModel
                : "Make and model not available"}
        </Text>
      </View>

      <View style={styles.detailsGrid}>
        <DetailItem wide={wide} label="Vehicle type" value={displayValue(vehicle?.vehicle_type)} />
        <DetailItem wide={wide} label="Make / brand" value={vehicleMake} />
        <DetailItem wide={wide} label="Model" value={vehicleModel} />
        <DetailItem wide={wide}
          label="Current stage"
          value={stage}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: "#172033",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    marginRight: spacing.md,
  },

  iconText: {
    fontSize: 23,
  },

  headerText: {
    flex: 1,
  },

  title: {
    ...typography.heading,
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },

  subtitle: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 3,
  },

  registrationBox: {
    backgroundColor: colors.background,
    borderRadius: 18,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  registrationLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 7,
  },

  registrationNumber: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  registrationHint: {
    color: colors.text,
    opacity: 0.88,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 5,
  },

  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },

  detailItem: {
    width: "100%",
    paddingHorizontal: 6,
    paddingVertical: spacing.sm,
  },

  detailItemWide: { width: "50%" },

  detailLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: 5,
  },

  detailValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: "700",
  },
});