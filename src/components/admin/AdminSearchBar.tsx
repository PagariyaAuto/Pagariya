import { TextInput } from "../inputs/KeyboardAware";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

type AdminSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  containerStyle?: ViewStyle;
  autoFocus?: boolean;
  editable?: boolean;
};

export default function AdminSearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  containerStyle,
  autoFocus = false,
  editable = true,
}: AdminSearchBarProps) {
  const handleClear = () => {
    onChangeText("");
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.searchIconContainer}>
        <Text style={styles.searchIcon}>⌕</Text>
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        autoFocus={autoFocus}
        editable={editable}
        returnKeyType="search"
        style={styles.input}
        selectionColor={colors.primary}
        accessibilityLabel={placeholder}
      />

      {value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          style={({ pressed }) => [
            styles.clearButton,
            pressed && styles.clearButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Text style={styles.clearIcon}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  searchIconContainer: {
    width: 32,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  searchIcon: {
    color: colors.textSecondary,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "400",
    transform: [{ rotate: "-15deg" }],
  },

  input: {
    flex: 1,
    minWidth: 0,
    height: 46,
    paddingHorizontal: spacing.xs,
    paddingVertical: 0,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: "400",
  },

  clearButton: {
    width: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
  },

  clearButtonPressed: {
    backgroundColor: colors.divider,
  },

  clearIcon: {
    color: colors.textSecondary,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "400",
  },
});