import { Link, router } from "expo-router";
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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // =========================
  // POPUP STATE
  // =========================

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("error");

  // =========================
  // VALIDATION
  // =========================

  const isEmailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const isPasswordValid = password.length >= 6;

  const canLogin =
    email.trim() !== "" &&
    isEmailValid &&
    password !== "" &&
    isPasswordValid;

  // =========================
  // SHOW POPUP
  // =========================

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

  // =========================
  // LOGIN
  // =========================

  const handleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setShowResend(false);

    if (!email.trim()) {
      showPopup(
        "Login Warning",
        "Please enter your email address.",
        "error"
      );
      return;
    }

    if (!isEmailValid) {
      showPopup(
        "Login Warning",
        "Please enter a valid email address.",
        "error"
      );
      return;
    }

    if (!password) {
      showPopup(
        "Login Warning",
        "Please enter your password.",
        "error"
      );
      return;
    }

    if (!isPasswordValid) {
      showPopup(
        "Login Warning",
        "Password must contain at least 6 characters.",
        "error"
      );
      return;
    }

    setLoading(true);

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    setLoading(false);

    // =========================
    // LOGIN ERROR
    // =========================

    if (error) {
      const message = error.message.toLowerCase();

      // Unverified email
      if (
        message.includes("email not confirmed") ||
        message.includes("email_not_confirmed")
      ) {
        const msg =
          "Your email address has not been verified yet.";

        setErrorMessage(msg);
        setShowResend(true);

        showPopup(
          "Email Verification Required",
          "Please verify your email address before logging in.",
          "error"
        );

        return;
      }

      // Wrong email/password
      if (
        message.includes("invalid login credentials") ||
        message.includes("invalid credentials")
      ) {
        const msg = "Incorrect email or password.";

        setErrorMessage(msg);

        showPopup(
          "Login Failed",
          "Incorrect email or password.",
          "error"
        );

        return;
      }

      // Other Supabase errors
      setErrorMessage(error.message);

      showPopup(
        "Login Failed",
        error.message,
        "error"
      );

      return;
    }

    // =========================
    // LOGIN SUCCESSFUL
    // =========================

    if (data.session) {
      router.replace("/");
    }
  };

  // =========================
  // RESEND CONFIRMATION EMAIL
  // =========================

  const handleResendConfirmation = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim()) {
      showPopup(
        "Email Required",
        "Please enter your email address first.",
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

    setResending(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });

    setResending(false);

    if (error) {
      setErrorMessage(error.message);

      showPopup(
        "Unable to Send Email",
        error.message,
        "error"
      );

      return;
    }

    setShowResend(false);

    setSuccessMessage(
      "A new confirmation email has been sent. Please check your inbox."
    );

    showPopup(
      "Confirmation Email Sent",
      "A new confirmation email has been sent. Please check your inbox and confirm your email address.",
      "success"
    );
  };

  // =========================
  // UI
  // =========================

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
              <Text style={styles.logoText}>P</Text>
            </View>

            <Text style={styles.logo}>
              Pagariya
            </Text>

            <Text style={styles.brandSubtitle}>
              Workshop Management
            </Text>
          </View>

          {/* LOGIN CARD */}

          <View style={styles.card}>
            <Text style={styles.title}>
              Welcome Back
            </Text>

            <Text style={styles.subtitle}>
              Login to your Pagariya account
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
                  email.length > 0 && !isEmailValid
                    ? colors.danger
                    : colors.textLight
                }
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage("");
                  setSuccessMessage("");
                  setShowResend(false);
                }}
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

            {/* PASSWORD */}

            <View style={styles.passwordLabelRow}>
              <Text style={styles.fieldLabel}>
                Password *
              </Text>
            </View>

            <View
              style={[
                styles.inputContainer,
                password.length > 0 &&
                  !isPasswordValid &&
                  styles.inputError,
                password.length >= 6 &&
                  styles.inputValid,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.textLight}
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.textLight}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage("");
                  setSuccessMessage("");
                  setShowResend(false);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              {password.length >= 6 && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.success}
                />
              )}
            </View>

            {/* PASSWORD WARNING */}

            {password.length > 0 &&
              !isPasswordValid && (
                <Text style={styles.fieldWarning}>
                  Password must contain at least 6 characters.
                </Text>
              )}

            {/* PASSWORD SUCCESS */}

            {password.length >= 6 && (
              <Text style={styles.fieldSuccess}>
                Password length is valid.
              </Text>
            )}

            {/* GENERAL ERROR */}

            {errorMessage !== "" && (
              <View style={styles.errorBox}>
                <View style={styles.messageIcon}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={20}
                    color={colors.danger}
                  />
                </View>

                <View style={styles.messageContent}>
                  <Text style={styles.errorTitle}>
                    Login Failed
                  </Text>

                  <Text style={styles.errorText}>
                    {errorMessage}
                  </Text>
                </View>
              </View>
            )}

            {/* EMAIL VERIFICATION */}

            {showResend && (
              <View style={styles.warningBox}>
                <View style={styles.messageIcon}>
                  <Ionicons
                    name="mail-unread-outline"
                    size={20}
                    color={colors.warning}
                  />
                </View>

                <View style={styles.messageContent}>
                  <Text style={styles.warningTitle}>
                    Email verification required
                  </Text>

                  <Text style={styles.warningText}>
                    Please verify your email address before logging in.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.resendButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleResendConfirmation}
                    disabled={resending}
                  >
                    <Text style={styles.resendText}>
                      {resending
                        ? "Sending..."
                        : "Resend Confirmation Email"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* SUCCESS */}

            {successMessage !== "" && (
              <View style={styles.successBox}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={colors.success}
                />

                <Text style={styles.successText}>
                  {successMessage}
                </Text>
              </View>
            )}

            {/* LOGIN BUTTON */}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!canLogin || loading) &&
                  styles.buttonDisabled,
                pressed &&
                  canLogin &&
                  !loading &&
                  styles.buttonPressed,
              ]}
              onPress={handleLogin}
              disabled={!canLogin || loading}
            >
              {loading ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />

                  <Text style={styles.buttonText}>
                    Logging in...
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    Login
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color={colors.white}
                  />
                </>
              )}
            </Pressable>

            {/* FORGOT PASSWORD */}

            <Pressable
              style={styles.forgotButton}
              onPress={() =>
                router.push("/forgot-password")
              }
            >
              <Text style={styles.forgotText}>
                Forgot Password?
              </Text>
            </Pressable>
          </View>

          {/* REGISTER */}

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>
              Don't have an account?
            </Text>

            <Link
              href="/register"
              style={styles.link}
            >
              Create Account
            </Link>
          </View>

          {/* FOOTER */}

          <Text style={styles.footer}>
            Pagariya Auto
          </Text>
        </ScrollView>

        {/* CUSTOM POPUP */}

        <Modal
          visible={popupVisible}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setPopupVisible(false)
          }
        >
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
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  setPopupVisible(false);
                }}
              >
                <Text style={styles.popupButtonText}>
                  OK
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =========================
// STYLES
// =========================

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

  title: {
    ...typography.heading,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },

  // =========================
  // INPUTS
  // =========================

  fieldLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  passwordLabelRow: {
    marginTop: spacing.sm,
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
  // ERROR
  // =========================

  errorBox: {
    flexDirection: "row",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
  },

  messageIcon: {
    marginRight: spacing.sm,
    paddingTop: 1,
  },

  messageContent: {
    flex: 1,
  },

  errorTitle: {
    ...typography.bodyMedium,
    color: colors.danger,
    marginBottom: 3,
  },

  errorText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },

  // =========================
  // WARNING
  // =========================

  warningBox: {
    flexDirection: "row",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    backgroundColor: colors.warningLight,
  },

  warningTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: 4,
  },

  warningText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.md,
  },

  resendButton: {
    minHeight: 44,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },

  resendText: {
    ...typography.button,
    color: colors.white,
  },

  // =========================
  // SUCCESS
  // =========================

  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    backgroundColor: colors.successLight,
  },

  successText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    lineHeight: 19,
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
    backgroundColor: colors.primary,
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
  // FORGOT PASSWORD
  // =========================

  forgotButton: {
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },

  forgotText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  // =========================
  // REGISTER
  // =========================

  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xl,
  },

  registerText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  link: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginLeft: spacing.xs,
  },

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