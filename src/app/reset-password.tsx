import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";

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

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] =
    useState(false);

  const [popupVisible, setPopupVisible] =
    useState(false);

  const [popupTitle, setPopupTitle] =
    useState("");

  const [popupMessage, setPopupMessage] =
    useState("");

  const [popupType, setPopupType] = useState<
    "success" | "error"
  >("error");

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
  // HANDLE RESET LINK
  // =========================

  useEffect(() => {
    const handleResetLink = async (url: string) => {
      try {
        const hash = url.split("#")[1];

        if (!hash) {
          showPopup(
            "Invalid Reset Link",
            "The password reset link is invalid or has expired.",
            "error"
          );
          return;
        }

        const params = new URLSearchParams(hash);

        const accessToken =
          params.get("access_token");

        const refreshToken =
          params.get("refresh_token");

        if (!accessToken || !refreshToken) {
          showPopup(
            "Invalid Reset Link",
            "The password reset link is invalid or has expired.",
            "error"
          );
          return;
        }

        const { error } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (error) {
          showPopup(
            "Reset Link Error",
            error.message,
            "error"
          );
          return;
        }

        setSessionReady(true);
      } catch (error) {
        showPopup(
          "Reset Link Error",
          "Unable to process the password reset link.",
          "error"
        );
      }
    };

    const checkInitialUrl = async () => {
      const url =
        await Linking.getInitialURL();

      if (url) {
        await handleResetLink(url);
      }
    };

    checkInitialUrl();

    const subscription =
      Linking.addEventListener(
        "url",
        ({ url }) => {
          handleResetLink(url);
        }
      );

    return () => {
      subscription.remove();
    };
  }, []);

  // =========================
  // UPDATE PASSWORD
  // =========================

  const handleUpdatePassword = async () => {
    if (!password) {
      showPopup(
        "Password Required",
        "Please enter a new password.",
        "error"
      );
      return;
    }

    if (password.length < 6) {
      showPopup(
        "Invalid Password",
        "Password must contain at least 6 characters.",
        "error"
      );
      return;
    }

    if (password !== confirmPassword) {
      showPopup(
        "Passwords Do Not Match",
        "Please make sure both passwords are the same.",
        "error"
      );
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.updateUser({
        password,
      });

    setLoading(false);

    if (error) {
      showPopup(
        "Unable to Update Password",
        error.message,
        "error"
      );
      return;
    }

    showPopup(
      "Password Updated",
      "Your password has been changed successfully. You can now login with your new password.",
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
          {/* BRAND */}

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

          {/* MAIN CARD */}

          <View style={styles.card}>
            <View style={styles.titleIcon}>
              <Ionicons
                name="lock-closed-outline"
                size={26}
                color={colors.primary}
              />
            </View>

            <Text style={styles.title}>
              Create New Password
            </Text>

            <Text style={styles.subtitle}>
              Enter a new password for your Pagariya
              account.
            </Text>

            {/* SESSION VERIFICATION */}

            {!sessionReady && (
              <View style={styles.verifyingBox}>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />

                <Text style={styles.loadingText}>
                  Verifying password reset link...
                </Text>
              </View>
            )}

            {sessionReady && (
              <>
                {/* NEW PASSWORD */}

                <Text style={styles.fieldLabel}>
                  New Password *
                </Text>

                <View
                  style={[
                    styles.inputContainer,
                    password.length > 0 &&
                      password.length < 6 &&
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
                    placeholder="Enter your new password"
                    placeholderTextColor={
                      colors.textLight
                    }
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
                    <Text style={styles.fieldWarning}>
                      Password must contain at least 6
                      characters.
                    </Text>
                  )}

                {password.length >= 6 && (
                  <Text style={styles.fieldSuccess}>
                    Password length is valid.
                  </Text>
                )}

                {/* CONFIRM PASSWORD */}

                <Text style={styles.fieldLabel}>
                  Confirm New Password *
                </Text>

                <View
                  style={[
                    styles.inputContainer,
                    confirmPassword.length > 0 &&
                      password !==
                        confirmPassword &&
                      styles.inputError,
                    confirmPassword.length > 0 &&
                      password ===
                        confirmPassword &&
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
                    placeholder="Re-enter your new password"
                    placeholderTextColor={
                      colors.textLight
                    }
                    value={confirmPassword}
                    onChangeText={
                      setConfirmPassword
                    }
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  {confirmPassword.length > 0 &&
                    password ===
                      confirmPassword && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.success}
                      />
                    )}
                </View>

                {confirmPassword.length > 0 &&
                  password ===
                    confirmPassword && (
                    <Text style={styles.fieldSuccess}>
                      Passwords match.
                    </Text>
                  )}

                {confirmPassword.length > 0 &&
                  password !==
                    confirmPassword && (
                    <Text style={styles.fieldWarning}>
                      Passwords do not match.
                    </Text>
                  )}

                {/* UPDATE BUTTON */}

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    loading &&
                      styles.buttonDisabled,
                    pressed &&
                      !loading &&
                      styles.buttonPressed,
                  ]}
                  onPress={handleUpdatePassword}
                  disabled={loading}
                >
                  {loading ? (
                    <View
                      style={styles.buttonLoading}
                    >
                      <ActivityIndicator
                        size="small"
                        color={colors.white}
                      />

                      <Text
                        style={styles.buttonText}
                      >
                        Updating...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.buttonText}>
                        Update Password
                      </Text>

                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={colors.white}
                      />
                    </>
                  )}
                </Pressable>
              </>
            )}
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
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={async () => {
                  setPopupVisible(false);

                  if (
                    popupType === "success"
                  ) {
                    await supabase.auth.signOut();
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
    marginBottom: spacing.xl,
  },

  // =========================
  // VERIFYING
  // =========================

  verifyingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: "center",
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