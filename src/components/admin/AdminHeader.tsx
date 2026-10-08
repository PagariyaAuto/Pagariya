import BackButton from "../navigation/BackButton";

import { router } from "expo-router";
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

type AdminHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  containerStyle?: ViewStyle;
};

export default function AdminHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  containerStyle,
}: AdminHeaderProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    router.replace("/(tabs)/master-data");
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.leftSection}>
        <BackButton onPress={handleBack} hitSlop={8} accessibilityLabel="Go back" />

        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightAction ? (
        <View style={styles.rightSection}>{rightAction}</View>
      ) : (
        <View style={styles.rightSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },

  leftSection: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
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
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
    }),
  },

  backButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.97 }],
  },

  backIcon: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "300",
    marginTop: -2,
  },

  titleContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },

  title: {
    color: colors.text,
    fontSize: typography.heading.fontSize,
    fontWeight: "700",
    lineHeight: 24,
  },

  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: "400",
    lineHeight: 18,
  },

  rightSection: {
    marginLeft: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  rightSpacer: {
    width: spacing.md,
  },
});
