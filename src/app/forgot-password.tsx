import { router } from "expo-router";
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

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("error");

  const isEmailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
    <View style={styles.container}>

      <Text style={styles.logo}>Pagariya</Text>

      <Text style={styles.title}>
        Forgot Password
      </Text>

      <Text style={styles.subtitle}>
        Enter your registered email address and we will
        send you a password reset link.
      </Text>

      <TextInput
        style={[
          styles.input,
          email.length > 0 && !isEmailValid && styles.inputError,
        ]}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {email.length > 0 && !isEmailValid && (
        <Text style={styles.fieldWarning}>
          ⚠ Please enter a valid email address.
        </Text>
      )}

      {email.length > 0 && isEmailValid && (
        <Text style={styles.fieldSuccess}>
          ✓ Email looks valid.
        </Text>
      )}

      <Pressable
        style={[
          styles.button,
          (!isEmailValid || loading) && styles.buttonDisabled,
        ]}
        onPress={handleSendReset}
        disabled={!isEmailValid || loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Sending..." : "Send Reset Link"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.backButton}
        onPress={() => router.replace("/login")}
      >
        <Text style={styles.backText}>
          ← Back to Login
        </Text>
      </Pressable>

      {/* CUSTOM POPUP */}

      <Modal
        visible={popupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPopupVisible(false)}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>

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
              style={styles.popupButton}
              onPress={() => {
                setPopupVisible(false);

                if (popupType === "success") {
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
    lineHeight: 22,
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

  backButton: {
    alignSelf: "center",
    marginTop: 25,
  },

  backText: {
    fontWeight: "bold",
    fontSize: 15,
  },

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