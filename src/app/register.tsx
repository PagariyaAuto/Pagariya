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

export default function Register() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Popup state
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  // =========================
  // VALIDATION
  // =========================

  const isNameValid = name.trim().length >= 2;

  const isPhoneValid =
    /^[6-9]\d{9}$/.test(phone.trim());

  const isEmailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const isPasswordValid =
    password.length >= 6;

  const isConfirmPasswordValid =
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const isFormValid =
    isNameValid &&
    isPhoneValid &&
    isEmailValid &&
    isPasswordValid &&
    isConfirmPasswordValid;

  // =========================
  // SHOW CUSTOM POPUP
  // =========================

  const showPopup = (
    title: string,
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupType(type);
    setPopupVisible(true);
  };

  // =========================
  // REGISTER USER
  // =========================

  const handleRegister = async () => {
    // Name validation
    if (!name.trim()) {
      showPopup(
        "Registration Warning",
        "Please enter your full name.",
        "error"
      );
      return;
    }

    if (!isNameValid) {
      showPopup(
        "Registration Warning",
        "Please enter a valid name.",
        "error"
      );
      return;
    }

    // Phone validation
    if (!phone.trim()) {
      showPopup(
        "Registration Warning",
        "Please enter your phone number.",
        "error"
      );
      return;
    }

    if (!isPhoneValid) {
      showPopup(
        "Registration Warning",
        "Please enter a valid 10-digit Indian mobile number.",
        "error"
      );
      return;
    }

    // Email validation
    if (!email.trim()) {
      showPopup(
        "Registration Warning",
        "Please enter your email address.",
        "error"
      );
      return;
    }

    if (!isEmailValid) {
      showPopup(
        "Registration Warning",
        "Please enter a valid email address.",
        "error"
      );
      return;
    }

    // Password validation
    if (!password) {
      showPopup(
        "Registration Warning",
        "Please enter a password.",
        "error"
      );
      return;
    }

    if (password.length < 6) {
      showPopup(
        "Registration Warning",
        "Password must be at least 6 characters.",
        "error"
      );
      return;
    }

    // Confirm password validation
    if (!confirmPassword) {
      showPopup(
        "Registration Warning",
        "Please confirm your password.",
        "error"
      );
      return;
    }

    if (password !== confirmPassword) {
      showPopup(
        "Registration Warning",
        "Passwords do not match.",
        "error"
      );
      return;
    }

    setLoading(true);

    // =========================
    // CREATE ACCOUNT
    // =========================

    const { error } =
      await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim(),
            phone: phone.trim(),
          },
        },
      });

    setLoading(false);

    // =========================
    // SUPABASE ERROR
    // =========================

    if (error) {
      showPopup(
        "Registration Failed",
        error.message,
        "error"
      );
      return;
    }

    // =========================
    // ACCOUNT CREATED
    // =========================

    showPopup(
      "Account Created Successfully",
      `Your Pagariya account has been created successfully.

A confirmation link has been sent to ${email.trim()}.

Please confirm your email before logging in.`,
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
          {/* =========================
              BRAND
              ========================= */}

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

          {/* =========================
              MAIN CARD
              ========================= */}

          <View style={styles.card}>
            <View style={styles.titleIcon}>
              <Ionicons
                name="person-add-outline"
                size={26}
                color={colors.primary}
              />
            </View>

            <Text style={styles.title}>
              Create Account
            </Text>

            <Text style={styles.subtitle}>
              Create your account to get started
              with Pagariya.
            </Text>

            {/* =========================
                FULL NAME
                ========================= */}

            <Text style={styles.fieldLabel}>
              Full Name *
            </Text>

            <View
              style={[
                styles.inputContainer,
                name.length > 0 &&
                  !isNameValid &&
                  styles.inputError,
                name.length >= 2 &&
                  styles.inputValid,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.textLight}
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textLight}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
              />

              {name.length >= 2 && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.success}
                />
              )}
            </View>

            {name.length > 0 &&
              !isNameValid && (
                <Text style={styles.warningText}>
                  Please enter your full name.
                </Text>
              )}

            {/* =========================
                PHONE
                ========================= */}

            <Text style={styles.fieldLabel}>
              Mobile Number *
            </Text>

            <View
              style={[
                styles.inputContainer,
                phone.length > 0 &&
                  !isPhoneValid &&
                  styles.inputError,
                phone.length === 10 &&
                  isPhoneValid &&
                  styles.inputValid,
              ]}
            >
              <Ionicons
                name="call-outline"
                size={20}
                color={colors.textLight}
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="Enter your 10-digit mobile number"
                placeholderTextColor={colors.textLight}
                value={phone}
                onChangeText={(text) => {
                  const numbersOnly =
                    text.replace(/\D/g, "");

                  setPhone(
                    numbersOnly.slice(0, 10)
                  );
                }}
                keyboardType="phone-pad"
                maxLength={10}
              />

              {phone.length === 10 &&
                isPhoneValid && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                )}
            </View>

            {phone.length > 0 &&
              !isPhoneValid && (
                <Text style={styles.warningText}>
                  Enter a valid 10-digit mobile
                  number.
                </Text>
              )}

            {phone.length === 10 &&
              isPhoneValid && (
                <Text style={styles.successText}>
                  Phone number is valid.
                </Text>
              )}

            {/* =========================
                EMAIL
                ========================= */}

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
                color={colors.textLight}
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
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

            {email.length > 0 &&
              !isEmailValid && (
                <Text style={styles.warningText}>
                  Please enter a valid email address.
                </Text>
              )}

            {/* =========================
                PASSWORD
                ========================= */}

            <Text style={styles.fieldLabel}>
              Password *
            </Text>

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
                onChangeText={setPassword}
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

            {password.length > 0 &&
              password.length < 6 && (
                <Text style={styles.warningText}>
                  Password must be at least 6
                  characters.
                </Text>
              )}

            {password.length === 0 && (
              <Text style={styles.helperText}>
                Password must contain at least 6
                characters.
              </Text>
            )}

            {/* =========================
                CONFIRM PASSWORD
                ========================= */}

            <Text style={styles.fieldLabel}>
              Confirm Password *
            </Text>

            <View
              style={[
                styles.inputContainer,
                confirmPassword.length > 0 &&
                  !isConfirmPasswordValid &&
                  styles.inputError,
                confirmPassword.length > 0 &&
                  isConfirmPasswordValid &&
                  styles.inputValid,
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.textLight}
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.textLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              {confirmPassword.length > 0 &&
                isConfirmPasswordValid && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                )}
            </View>

            {confirmPassword.length > 0 &&
              password !== confirmPassword && (
                <Text style={styles.warningText}>
                  Passwords do not match.
                </Text>
              )}

            {confirmPassword.length > 0 &&
              password === confirmPassword && (
                <Text style={styles.successText}>
                  Passwords match.
                </Text>
              )}

            {/* =========================
                CREATE ACCOUNT
                ========================= */}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!isFormValid || loading) &&
                  styles.buttonDisabled,
                pressed &&
                  isFormValid &&
                  !loading &&
                  styles.buttonPressed,
              ]}
              onPress={handleRegister}
              disabled={!isFormValid || loading}
            >
              {loading ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />

                  <Text style={styles.buttonText}>
                    Creating Account...
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    Create Account
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={colors.white}
                  />
                </>
              )}
            </Pressable>

            {/* =========================
                LOGIN
                ========================= */}

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Already have an account?{" "}
              </Text>

              <Link
                href="/login"
                style={styles.link}
              >
                Login
              </Link>
            </View>
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

                  if (
                    popupType === "success"
                  ) {
                    router.replace("/login");
                  }
                }}
              >
                <Text style={styles.popupButtonText}>
                  {popupType === "success"
                    ? "Go to Login"
                    : "OK"}
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
    marginBottom: spacing.lg,
  },

  // =========================
  // INPUT
  // =========================

  fieldLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
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

  warningText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },

  helperText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },

  successText: {
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
    marginTop: spacing.lg,
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
  // LOGIN
  // =========================

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xl,
  },

  loginText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  link: {
    ...typography.bodyMedium,
    color: colors.primary,
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