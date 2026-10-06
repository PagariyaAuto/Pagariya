import { router } from "expo-router";
import { useState } from "react";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../theme";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<
    "success" | "error"
  >("error");

  const isEmailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email.trim()
    );

  const showPopup = (
    title: string,
    message: string,
    type: "success" | "error" = "error"
  ) => {
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupType(type);
    setPopupVisible(true);
  };

  const handleSendReset = async () => {
    if (!email.trim()) {
      showPopup(
        "Email Required",
        "Please enter your email address.",
        "error"
      );
      return;
    }

    if (!isEmailValid) {
      showPopup(
        "Invalid Email",
        "Please enter a valid email address.",
        "error"
      );
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: "pagariya://reset-password",
        }
      );

    setLoading(false);

    if (error) {
      showPopup(
        "Unable to Send Reset Link",
        error.message,
        "error"
      );
      return;
    }

    showPopup(
      "Reset Link Sent",
      `A password reset link has been sent to ${email.trim()}.

Please check your email and open the link to create a new password.`,
      "success"
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* BRAND HEADER */}

          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>
                P
              </Text>
            </View>

            <Text style={styles.logo}>
              Pagariya
            </Text>

            <Text style={styles.brandSubtitle}>
              Workshop Management
            </Text>
          </View>

          {/* MAIN CARD */}

          <View style={styles.card}>
            <View style={styles.titleIcon}>
              <Ionicons
                name="lock-open-outline"
                size={26}
                color={colors.primary}
              />
            </View>

            <Text style={styles.title}>
              Forgot Password?
            </Text>

            <Text style={styles.subtitle}>
              Enter your registered email address and
              we'll send you a password reset link.
            </Text>

            {/* EMAIL */}

            <Text style={styles.fieldLabel}>
              Email Address *
            </Text>

            <View
              style={[
                styles.inputContainer,
                email.length > 0 &&
                  !isEmailValid &&
                  styles.inputError,
                email.length > 0 &&
                  isEmailValid &&
                  styles.inputValid,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={
                  email.length > 0 &&
                  !isEmailValid
                    ? colors.danger
                    : colors.textLight
                }
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="Enter your registered email"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {email.length > 0 &&
                isEmailValid && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                )}
            </View>

            {/* EMAIL WARNING */}

            {email.length > 0 &&
              !isEmailValid && (
                <Text style={styles.fieldWarning}>
                  Please enter a valid email address.
                </Text>
              )}

            {/* EMAIL SUCCESS */}

            {email.length > 0 &&
              isEmailValid && (
                <Text style={styles.fieldSuccess}>
                  Email looks valid.
                </Text>
              )}

            {/* SEND BUTTON */}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!isEmailValid || loading) &&
                  styles.buttonDisabled,
                pressed &&
                  isEmailValid &&
                  !loading &&
                  styles.buttonPressed,
              ]}
              onPress={handleSendReset}
              disabled={!isEmailValid || loading}
            >
              {loading ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />

                  <Text style={styles.buttonText}>
                    Sending...
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    Send Reset Link
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color={colors.white}
                  />
                </>
              )}
            </Pressable>

            {/* BACK TO LOGIN */}

            <Pressable
              style={styles.backButton}
              onPress={() =>
                router.replace("/login")
              }
            >
              <Ionicons
                name="arrow-back"
                size={18}
                color={colors.primary}
              />

              <Text style={styles.backText}>
                Back to Login
              </Text>
            </Pressable>
          </View>

          {/* FOOTER */}

          <Text style={styles.footer}>
            Pagariya Auto
          </Text>
        </ScrollView>

        {/* =========================
            CUSTOM POPUP
            ========================= */}

        <Modal
          visible={popupVisible}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setPopupVisible(false)
          }
        >
          <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
          <View style={styles.popupOverlay}>
            <View style={styles.popupContainer}>
              <View
                style={[
                  styles.popupIcon,
                  popupType === "error"
                    ? styles.popupErrorIcon
                    : styles.popupSuccessIcon,
                ]}
              >
                <Ionicons
                  name={
                    popupType === "error"
                      ? "alert-circle-outline"
                      : "checkmark-circle-outline"
                  }
                  size={28}
                  color={
                    popupType === "error"
                      ? colors.danger
                      : colors.success
                  }
                />
              </View>

              <Text
                style={[
                  styles.popupTitle,
                  popupType === "error"
                    ? styles.popupErrorTitle
                    : styles.popupSuccessTitle,
                ]}
              >
                {popupTitle}
              </Text>

              <Text style={styles.popupMessage}>
                {popupMessage}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.popupButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={() => {
                  setPopupVisible(false);

                  if (
                    popupType === "success"
                  ) {
                    router.replace("/login");
                  }
                }}
              >
                <Text style={styles.popupButtonText}>
                  OK
                </Text>
              </Pressable>
            </View>
          </View>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  // =========================
  // BRAND
  // =========================

  brandSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },

  logoContainer: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",

    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },

  logoText: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.white,
  },

  logo: {
    fontSize: 27,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },

  brandSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // =========================
  // CARD
  // =========================

  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,

    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  titleIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  title: {
    ...typography.heading,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  // =========================
  // INPUT
  // =========================

  fieldLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  inputContainer: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },

  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },

  inputValid: {
    borderColor: colors.success,
  },

  inputIcon: {
    marginRight: spacing.sm,
  },

  input: {
    flex: 1,
    minHeight: 50,
    fontSize: 15,
    color: colors.text,
  },

  fieldWarning: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },

  fieldSuccess: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },

  // =========================
  // BUTTON
  // =========================

  button: {
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonText: {
    ...typography.button,
    color: colors.white,
    marginRight: spacing.sm,
  },

  buttonLoading: {
    flexDirection: "row",
    alignItems: "center",
  },

  // =========================
  // BACK
  // =========================

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },

  backText: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginLeft: spacing.xs,
  },

  // =========================
  // FOOTER
  // =========================

  footer: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: "center",
    marginTop: spacing.xl,
  },

  // =========================
  // POPUP
  // =========================

  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },

  popupContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",

    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  popupErrorIcon: {
    backgroundColor: colors.dangerLight,
  },

  popupSuccessIcon: {
    backgroundColor: colors.successLight,
  },

  popupTitle: {
    ...typography.heading,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  popupErrorTitle: {
    color: colors.danger,
  },

  popupSuccessTitle: {
    color: colors.success,
  },

  popupMessage: {
    ...typography.body,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },

  popupButton: {
    width: "100%",
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },

  popupButtonText: {
    ...typography.button,
    color: colors.white,
  },
});