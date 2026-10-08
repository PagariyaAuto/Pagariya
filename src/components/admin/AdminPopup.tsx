import { Modal } from "../inputs/KeyboardAware";

import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, typography } from "../../theme";

export type AdminPopupType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "confirm";

type AdminPopupProps = {
  visible: boolean;
  type?: AdminPopupType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  closeOnBackdropPress?: boolean;
  containerStyle?: ViewStyle;
};

const POPUP_CONFIG: Record<
  AdminPopupType,
  {
    icon: string;
    iconBackground: string;
    iconColor: string;
    defaultConfirm: string;
  }
> = {
  success: {
    icon: "✓",
    iconBackground: colors.successLight,
    iconColor: colors.success,
    defaultConfirm: "OK",
  },

  error: {
    icon: "!",
    iconBackground: colors.dangerLight,
    iconColor: colors.danger,
    defaultConfirm: "OK",
  },

  warning: {
    icon: "!",
    iconBackground: colors.warningLight,
    iconColor: "#B45309",
    defaultConfirm: "OK",
  },

  info: {
    icon: "i",
    iconBackground: colors.infoLight,
    iconColor: colors.info,
    defaultConfirm: "OK",
  },

  confirm: {
    icon: "?",
    iconBackground: colors.warningLight,
    iconColor: "#B45309",
    defaultConfirm: "Confirm",
  },
};

export default function AdminPopup({
  visible,
  type = "info",
  title,
  message,
  confirmText,
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  onClose,
  closeOnBackdropPress = false,
  containerStyle,
}: AdminPopupProps) {
  const config = POPUP_CONFIG[type];

  const isConfirmation = type === "confirm" || !!onCancel;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }

    if (onClose) {
      onClose();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (onCancel) {
          onCancel();
        } else if (onClose) {
          onClose();
        }

        return true;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [visible, onCancel, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={false}
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (closeOnBackdropPress) {
                handleCancel();
              }
            }}
          />

          <View style={[styles.card, containerStyle]}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: config.iconBackground,
                },
              ]}
            >
              <Text
                style={[
                  styles.icon,
                  {
                    color: config.iconColor,
                  },
                ]}
              >
                {config.icon}
              </Text>
            </View>

            <Text style={styles.title}>{title}</Text>

            <Text style={styles.message}>{message}</Text>

            <View
              style={[
                styles.buttonRow,
                !isConfirmation && styles.singleButtonRow,
              ]}
            >
              {isConfirmation ? (
                <Pressable
                  onPress={handleCancel}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={cancelText}
                >
                  <Text style={styles.cancelButtonText}>
                    {cancelText}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.confirmButton,
                  {
                    backgroundColor:
                      type === "error"
                        ? colors.danger
                        : type === "warning" || type === "confirm"
                        ? colors.warning
                        : type === "success"
                        ? colors.success
                        : colors.primary,
                  },
                  pressed && styles.buttonPressed,
                  !isConfirmation && styles.singleConfirmButton,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  confirmText ?? config.defaultConfirm
                }
              >
                <Text style={styles.confirmButtonText}>
                  {confirmText ?? config.defaultConfirm}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },

  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  card: {
    width: "100%",
    maxWidth: 420,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },

  iconContainer: {
    width: 58,
    height: 58,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
    marginBottom: spacing.md,
  },

  icon: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "700",
  },

  title: {
    color: colors.text,
    fontSize: typography.heading.fontSize,
    fontWeight: "700",
    lineHeight: 25,
    textAlign: "center",
  },

  message: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.body.fontSize,
    lineHeight: 22,
    textAlign: "center",
  },

  buttonRow: {
    flexDirection: "row",
    marginTop: spacing.xl,
    gap: spacing.sm,
  },

  singleButtonRow: {
    justifyContent: "center",
  },

  cancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.divider,
  },

  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: typography.button.fontSize,
    fontWeight: "600",
  },

  confirmButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },

  singleConfirmButton: {
    flex: 0,
    minWidth: 120,
  },

  confirmButtonText: {
    color: colors.white,
    fontSize: typography.button.fontSize,
    fontWeight: "600",
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
