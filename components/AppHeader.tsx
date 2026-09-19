import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../src/theme";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
};

export default function AppHeader({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
}: AppHeaderProps) {
  return (
    <View style={styles.container}>

      <View style={styles.leftSection}>

        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-back-outline"
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
        )}

        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            {title}
          </Text>

          {subtitle && (
            <Text style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>

      </View>

      {rightIcon && (
        <TouchableOpacity
          onPress={onRightPress}
          style={styles.rightButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={rightIcon}
            size={22}
            color={colors.text}
          />
        </TouchableOpacity>
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

    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,

    backgroundColor: colors.surface,
  },

  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  backButton: {
    width: 40,
    height: 40,

    borderRadius: radius.round,

    alignItems: "center",
    justifyContent: "center",

    marginRight: spacing.sm,
  },

  titleContainer: {
    flex: 1,
  },

  title: {
    ...typography.heading,
    color: colors.text,
  },

  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  rightButton: {
    width: 40,
    height: 40,

    borderRadius: radius.round,

    alignItems: "center",
    justifyContent: "center",
  },
});