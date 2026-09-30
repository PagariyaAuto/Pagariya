
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

type AdminEmptyStateProps = {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  containerStyle?: ViewStyle;
};

export default function AdminEmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  containerStyle,
}: AdminEmptyStateProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.iconContainer}>
        {icon ?? <Text style={styles.defaultIcon}>⌕</Text>}
      </View>

      <Text style={styles.title}>{title}</Text>

      {message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.divider,
  },

  defaultIcon: {
    color: colors.textLight,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "400",
    transform: [{ rotate: "-15deg" }],
  },

  title: {
    color: colors.text,
    fontSize: typography.subheading.fontSize,
    fontWeight: "600",
    textAlign: "center",
  },

  message: {
    maxWidth: 320,
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: typography.body.fontSize,
    lineHeight: 21,
    textAlign: "center",
  },

  actionButton: {
    minHeight: 42,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  actionButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  actionText: {
    color: colors.white,
    fontSize: typography.button.fontSize,
    fontWeight: "600",
  },
});
