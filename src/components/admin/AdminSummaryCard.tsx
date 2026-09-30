
import React from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

type AdminSummaryCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  onPress?: () => void;
  containerStyle?: ViewStyle;
};

export default function AdminSummaryCard({
  label,
  value,
  subtitle,
  icon,
  accentColor = colors.primary,
  onPress,
  containerStyle,
}: AdminSummaryCardProps) {
  const content = (
    <>
      <View style={styles.topRow}>
        <View style={styles.labelContainer}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>

        {icon ? (
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${accentColor}15`,
              },
            ]}
          >
            {icon}
          </View>
        ) : null}
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>

      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}

      <View
        style={[
          styles.accentLine,
          {
            backgroundColor: accentColor,
          },
        ]}
      />
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          containerStyle,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.container, containerStyle]}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 116,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,

    ...Platform.select({
      android: {
        elevation: 1,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
    }),
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },

  topRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  labelContainer: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },

  label: {
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: "500",
  },

  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  value: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
  },

  subtitle: {
    marginTop: 2,
    color: colors.textLight,
    fontSize: typography.caption.fontSize,
    lineHeight: 18,
  },

  accentLine: {
    width: 28,
    height: 3,
    borderRadius: radius.round,
    marginTop: spacing.sm,
  },
});
