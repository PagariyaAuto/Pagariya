
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../../../theme";

export type CustomerDetails = {
  customer_name?: string | null;
  customer_mobile?: string | null;
};

type CustomerDetailsCardProps = {
  customer?: CustomerDetails | null;
};

function displayValue(value?: string | null) {
  return value?.trim() || "—";
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function CustomerDetailsCard({
  customer,
}: CustomerDetailsCardProps) {
  const name = displayValue(customer?.customer_name);
  const mobile = displayValue(customer?.customer_mobile);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👤</Text>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>Customer Details</Text>
          <Text style={styles.subtitle}>
            Contact information for this vehicle
          </Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <DetailItem label="Customer name" value={name} />
        <View style={styles.separator} />
        <DetailItem label="Mobile number" value={mobile} />
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
    fontSize: 22,
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

  detailsContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
  },

  detailItem: {
    paddingVertical: spacing.md,
  },

  detailLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: 5,
  },

  detailValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },

  separator: {
    height: 1,
    backgroundColor: colors.divider,
  },
});