
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../src/theme";

type Props = {
  advisorName: string | null;
  advisorRole: string | null;
};

export default function AssignedAdvisor({
  advisorName,
  advisorRole,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons
            name="person-circle-outline"
            size={22}
            color={colors.primary}
          />
        </View>

        <Text style={styles.cardTitle}>Assigned Advisor</Text>
      </View>

      <InfoRow
        label="Name"
        value={advisorName || "Not assigned"}
      />

      <InfoRow
        label="Role"
        value={advisorRole || "Not assigned"}
      />
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
});