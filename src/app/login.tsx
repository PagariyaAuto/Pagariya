import { Link, router } from "expo-router";
import { useState } from "react";
import {
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

  const handleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setShowResend(false);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      const message = error.message.toLowerCase();

      // Unverified email
      if (
        message.includes("email not confirmed") ||
        message.includes("email_not_confirmed")
      ) {
        setErrorMessage(
          "Your email address has not been verified yet."
        );
        setShowResend(true);
        return;
      }

      // Wrong email/password
      if (
        message.includes("invalid login credentials") ||
        message.includes("invalid credentials")
      ) {
        setErrorMessage("Incorrect email or password.");
        return;
      }

      // Any other Supabase error
      setErrorMessage(error.message);
      return;
    }

    // Login successful
    if (data.session) {
      router.replace("/");
    }
  };

  const handleResendConfirmation = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim()) {
      setErrorMessage("Please enter your email address first.");
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
      return;
    }

    setShowResend(false);

    setSuccessMessage(
      "A new confirmation email has been sent. Please check your inbox."
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Pagaria</Text>

      <Text style={styles.title}>Login</Text>

      <Text style={styles.subtitle}>
        Login to your Pagaria account
      </Text>

      {/* EMAIL */}
      <TextInput
        style={styles.input}
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

      {/* PASSWORD */}
      <TextInput
        style={styles.input}
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

      {/* ERROR MESSAGE */}
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

      {/* RESEND CONFIRMATION */}
      {showResend && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>
            Email verification required
          </Text>

          <Text style={styles.warningText}>
            Please verify your email address before logging in.
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

      {/* SUCCESS MESSAGE */}
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
          loading && styles.buttonDisabled,
        ]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Login"}
        </Text>
      </Pressable>

      {/* FORGOT PASSWORD */}
      <Pressable
        style={styles.forgotButton}
        onPress={() => {
          setErrorMessage(
            "Password reset will be added next."
          );
        }}
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
    </View>
  );
}

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
    marginBottom: 15,
    fontSize: 16,
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
    opacity: 0.6,
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
});