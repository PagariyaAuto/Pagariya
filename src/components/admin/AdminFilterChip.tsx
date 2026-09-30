import {
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

type AdminFilterChipProps = {
  label: string;
  selected?: boolean;
  count?: number;
  onPress: () => void;
  containerStyle?: ViewStyle;
  disabled?: boolean;
};

export default function AdminFilterChip({
  label,
  selected = false,
  count,
  onPress,
  containerStyle,
  disabled = false,
}: AdminFilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        selected && styles.selectedContainer,
        disabled && styles.disabledContainer,
        pressed && !disabled && styles.pressed,
        containerStyle,
      ]}
      accessibilityRole="button"
      accessibilityState={{
        selected,
        disabled,
      }}
      accessibilityLabel={
        count !== undefined ? `${label}, ${count}` : label
      }
    >
      <Text
        style={[
          styles.label,
          selected && styles.selectedLabel,
          disabled && styles.disabledLabel,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {count !== undefined ? (
        <View
          style={[
            styles.countContainer,
            selected && styles.selectedCountContainer,
          ]}
        >
          <Text
            style={[
              styles.count,
              selected && styles.selectedCount,
            ]}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  selectedContainer: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  disabledContainer: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },

  label: {
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: "500",
  },

  selectedLabel: {
    color: colors.white,
    fontWeight: "600",
  },

  disabledLabel: {
    color: colors.textLight,
  },

  countContainer: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    marginLeft: spacing.xs,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.divider,
  },

  selectedCountContainer: {
    backgroundColor: "rgba(255,255,255,0.20)",
  },

  count: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },

  selectedCount: {
    color: colors.white,
  },
});
