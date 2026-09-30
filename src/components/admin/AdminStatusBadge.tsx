
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

type AdminStatus =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "completed"
  | "warning"
  | "error"
  | "info";

type AdminStatusBadgeProps = {
  status: AdminStatus;
  label?: string;
  containerStyle?: ViewStyle;
};

const STATUS_CONFIG: Record<
  AdminStatus,
  {
    backgroundColor: string;
    textColor: string;
    dotColor: string;
    defaultLabel: string;
  }
> = {
  active: {
    backgroundColor: colors.successLight,
    textColor: colors.success,
    dotColor: colors.success,
    defaultLabel: "Active",
  },

  inactive: {
    backgroundColor: colors.divider,
    textColor: colors.textSecondary,
    dotColor: colors.textSecondary,
    defaultLabel: "Inactive",
  },

  pending: {
    backgroundColor: colors.warningLight,
    textColor: "#B45309",
    dotColor: colors.warning,
    defaultLabel: "Pending",
  },

  approved: {
    backgroundColor: colors.infoLight,
    textColor: colors.info,
    dotColor: colors.info,
    defaultLabel: "Approved",
  },

  completed: {
    backgroundColor: colors.successLight,
    textColor: colors.success,
    dotColor: colors.success,
    defaultLabel: "Completed",
  },

  warning: {
    backgroundColor: colors.warningLight,
    textColor: "#B45309",
    dotColor: colors.warning,
    defaultLabel: "Warning",
  },

  error: {
    backgroundColor: colors.dangerLight,
    textColor: colors.danger,
    dotColor: colors.danger,
    defaultLabel: "Error",
  },

  info: {
    backgroundColor: colors.infoLight,
    textColor: colors.info,
    dotColor: colors.info,
    defaultLabel: "Info",
  },
};

export default function AdminStatusBadge({
  status,
  label,
  containerStyle,
}: AdminStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
        },
        containerStyle,
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: config.dotColor,
          },
        ]}
      />

      <Text
        style={[
          styles.label,
          {
            color: config.textColor,
          },
        ]}
        numberOfLines={1}
      >
        {label ?? config.defaultLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.round,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.round,
    marginRight: spacing.xs,
  },

  label: {
    fontSize: typography.caption.fontSize,
    fontWeight: "600",
    lineHeight: 17,
  },
});
