
import React, { useEffect } from "react";
import {
    BackHandler,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, typography } from "../../theme";

type AdminModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;

  onClose: () => void;

  onSave?: () => void;
  saveText?: string;
  cancelText?: string;

  saving?: boolean;
  saveDisabled?: boolean;

  scrollable?: boolean;
  closeOnBackdropPress?: boolean;

  containerStyle?: ViewStyle;
};

export default function AdminModal({
  visible,
  title,
  subtitle,
  children,
  onClose,
  onSave,
  saveText = "Save",
  cancelText = "Cancel",
  saving = false,
  saveDisabled = false,
  scrollable = true,
  closeOnBackdropPress = false,
  containerStyle,
}: AdminModalProps) {
  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!saving) {
          onClose();
        }

        return true;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [visible, saving, onClose]);

  const content = scrollable ? (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.nonScrollContent}>{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={false}
      onRequestClose={() => {
        if (!saving) {
          onClose();
        }
      }}
    >
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom", "left", "right"]}
      >
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (closeOnBackdropPress && !saving) {
                  onClose();
                }
              }}
            />

            <View style={[styles.modalCard, containerStyle]}>
              <View style={styles.header}>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>

                  {subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  onPress={onClose}
                  disabled={saving}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && !saving && styles.closeButtonPressed,
                    saving && styles.closeButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Text style={styles.closeIcon}>×</Text>
                </Pressable>
              </View>

              {content}

              {onSave ? (
                <View style={styles.footer}>
                  <Pressable
                    onPress={onClose}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed &&
                        !saving &&
                        styles.buttonPressed,
                      saving && styles.disabledButton,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={cancelText}
                  >
                    <Text style={styles.cancelText}>
                      {cancelText}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={onSave}
                    disabled={saving || saveDisabled}
                    style={({ pressed }) => [
                      styles.saveButton,
                      pressed &&
                        !saving &&
                        !saveDisabled &&
                        styles.buttonPressed,
                      (saving || saveDisabled) &&
                        styles.disabledSaveButton,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={saveText}
                  >
                    {saving ? (
                      <Text style={styles.saveText}>
                        Saving...
                      </Text>
                    ) : (
                      <Text style={styles.saveText}>
                        {saveText}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },

  keyboardContainer: {
    flex: 1,
  },

  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  modalCard: {
    width: "100%",
    maxHeight: "92%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },

  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  headerTextContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.md,
  },

  title: {
    color: colors.text,
    fontSize: typography.heading.fontSize,
    fontWeight: "700",
    lineHeight: 25,
  },

  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    lineHeight: 18,
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.divider,
  },

  closeButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },

  closeButtonDisabled: {
    opacity: 0.4,
  },

  closeIcon: {
    color: colors.textSecondary,
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 30,
  },

  scrollView: {
    flexGrow: 0,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
  },

  nonScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },

  cancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.divider,
  },

  saveButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },

  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.button.fontSize,
    fontWeight: "600",
  },

  saveText: {
    color: colors.white,
    fontSize: typography.button.fontSize,
    fontWeight: "600",
  },

  disabledButton: {
    opacity: 0.5,
  },

  disabledSaveButton: {
    opacity: 0.5,
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
