import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { colors } from "../../theme";

type Props = Omit<PressableProps, "children" | "style"> & { busy?: boolean };

export default function BackButton({
  onPress,
  disabled = false,
  busy = false,
  accessibilityLabel = "Back",
  accessibilityState,
  ...props
}: Props) {
  const inactive = disabled || busy;
  return (
    <Pressable
      {...props}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled: inactive, busy }}
      style={styles.touchTarget}
    >
      {({ pressed, hovered }) => (
        <View
          style={[
            styles.pill,
            hovered && !inactive && styles.hovered,
            pressed && !inactive && styles.pressed,
            inactive && styles.disabled,
          ]}
        >
          <View style={styles.icon}>
            {busy ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.spinner}
              />
            ) : (
              <Ionicons name="chevron-back" size={12} color={colors.primary} />
            )}
          </View>
          <Text style={styles.text}>BACK</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Keep the visual pill compact while retaining a comfortable touch area.
  touchTarget: {
    minHeight: 44,
    minWidth: 70,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  icon: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: { transform: [{ scale: 0.6 }] },
  text: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  hovered: { backgroundColor: colors.primaryLight },
  pressed: { backgroundColor: colors.primaryLight, opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
