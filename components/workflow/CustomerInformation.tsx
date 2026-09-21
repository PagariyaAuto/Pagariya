
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../src/theme";

type Customer = {
  customer_name: string | null;
  customer_mobile: string | null;
};

type Props = {
  vehicle: Customer;
};

export default function CustomerInformation({ vehicle }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons
            name="person-outline"
            size={22}
            color={colors.primary}
          />
        </View>

        <Text style={styles.cardTitle}>Customer Information</Text>
      </View>

      <InfoRow
        label="Customer Name"
        value={vehicle.customer_name || "Not available"}
      />

      <InfoRow
        label="Mobile"
        value={vehicle.customer_mobile || "Not available"}
      />
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