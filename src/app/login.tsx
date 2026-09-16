import { Link, router } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

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

    // Email validation
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

    // Password validation
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

    // Start loading
    setLoading(true);

    // Login with Supabase
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
    <View style={styles.container}>

      {/* LOGO */}
      <Text style={styles.logo}>Pagariya</Text>

      {/* TITLE */}
      <Text style={styles.title}>Login</Text>

      <Text style={styles.subtitle}>
        Login to your Pagariya account
      </Text>

      {/* EMAIL */}
      <TextInput
        style={[
          styles.input,
          email.length > 0 &&
            !isEmailValid &&
            styles.inputError,
        ]}
        placeholder="Email"
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

      {/* EMAIL WARNING */}
      {email.length > 0 && !isEmailValid && (
        <Text style={styles.fieldWarning}>
          ⚠ Please enter a valid email address.
        </Text>
      )}

      {/* EMAIL SUCCESS */}
      {email.length > 0 && isEmailValid && (
        <Text style={styles.fieldSuccess}>
          ✓ Email looks valid.
        </Text>
      )}

      {/* PASSWORD */}
      <TextInput
        style={[
          styles.input,
          password.length > 0 &&
            !isPasswordValid &&
            styles.inputError,
        ]}
        placeholder="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setErrorMessage("");
          setSuccessMessage("");
          setShowResend(false);
        }}
        secureTextEntry
      />

      {/* PASSWORD WARNING */}
      {password.length > 0 && !isPasswordValid && (
        <Text style={styles.fieldWarning}>
          ⚠ Password must contain at least 6 characters.
        </Text>
      )}

      {/* PASSWORD SUCCESS */}
      {password.length >= 6 && (
        <Text style={styles.fieldSuccess}>
          ✓ Password length is valid.
        </Text>
      )}

      {/* GENERAL ERROR */}
      {errorMessage !== "" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>
            ❌ Login Failed
          </Text>

          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        </View>
      )}

      {/* EMAIL VERIFICATION */}
      {showResend && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>
            Email verification required
          </Text>

          <Text style={styles.warningText}>
            Please verify your email address before
            logging in.
          </Text>

          <Pressable
            style={styles.resendButton}
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
      )}

      {/* SUCCESS */}
      {successMessage !== "" && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>
            ✓ {successMessage}
          </Text>
        </View>
      )}

      {/* LOGIN BUTTON */}
      <Pressable
        style={[
          styles.button,
          (!canLogin || loading) &&
            styles.buttonDisabled,
        ]}
        onPress={handleLogin}
        disabled={!canLogin || loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Login"}
        </Text>
      </Pressable>

      {/* FORGOT PASSWORD */}
      <Pressable
          style={styles.forgotButton}
          onPress={() => router.push("/forgot-password")}
        >
          <Text style={styles.forgotText}>
            Forgot Password?
          </Text>
      </Pressable>

      {/* REGISTER */}
      <View style={styles.registerRow}>
        <Text>Don't have an account? </Text>

        <Link
          href="/register"
          style={styles.link}
        >
          Create Account
        </Link>
      </View>

      {/* =========================
          CUSTOM POPUP
          ========================= */}

      <Modal
        visible={popupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPopupVisible(false)}
      >
        <View style={styles.popupOverlay}>

          <View style={styles.popupContainer}>

            {/* POPUP TITLE */}
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

            {/* POPUP MESSAGE */}
            <Text style={styles.popupMessage}>
              {popupMessage}
            </Text>

            {/* POPUP BUTTON */}
            <Pressable
              style={styles.popupButton}
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

    </View>
  );
}

// =========================
// STYLES
// =========================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#fff",
  },

  logo: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 25,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 8,
    fontSize: 16,
  },

  inputError: {
    borderColor: "#ff6b6b",
  },

  fieldWarning: {
    fontSize: 13,
    color: "#d97706",
    marginBottom: 10,
    marginLeft: 3,
  },

  fieldSuccess: {
    fontSize: 13,
    color: "#16803c",
    marginBottom: 10,
    marginLeft: 3,
  },

  button: {
    height: 52,
    backgroundColor: "#111",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
  },

  buttonDisabled: {
    opacity: 0.4,
  },

  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },

  errorBox: {
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ffb3b3",
    borderRadius: 10,
    backgroundColor: "#fff0f0",
  },

  errorTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
  },

  errorText: {
    fontSize: 14,
    color: "#555",
  },

  warningBox: {
    marginBottom: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#f0c36d",
    borderRadius: 10,
    backgroundColor: "#fff8e7",
  },

  warningTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },

  warningText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 12,
  },

  resendButton: {
    height: 45,
    backgroundColor: "#111",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  resendText: {
    color: "#fff",
    fontWeight: "bold",
  },

  successBox: {
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#a8d5ba",
    borderRadius: 10,
    backgroundColor: "#eefaf2",
  },

  successText: {
    fontSize: 14,
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 15,
  },

  forgotText: {
    fontWeight: "bold",
  },

  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 30,
  },

  link: {
    fontWeight: "bold",
  },

  // =========================
  // CUSTOM POPUP
  // =========================

  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  popupContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 25,
    elevation: 10,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },

  popupTitle: {
    fontSize: 21,
    fontWeight: "bold",
    marginBottom: 12,
  },

  popupSuccessTitle: {
    color: "#2e7d32",
  },

  popupErrorTitle: {
    color: "#d32f2f",
  },

  popupMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: "#444",
    marginBottom: 22,
  },

  popupButton: {
    height: 48,
    backgroundColor: "#111",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  popupButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});