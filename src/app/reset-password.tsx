import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("error");

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

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken || !refreshToken) {
          showPopup(
            "Invalid Reset Link",
            "The password reset link is invalid or has expired.",
            "error"
          );
          return;
        }

        const { error } = await supabase.auth.setSession({
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
      const url = await Linking.getInitialURL();

      if (url) {
        await handleResetLink(url);
      }
    };

    checkInitialUrl();

    const subscription = Linking.addEventListener(
      "url",
      ({ url }) => {
        handleResetLink(url);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

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

    const { error } = await supabase.auth.updateUser({
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

  return (
    <View style={styles.container}>

      <Text style={styles.logo}>Pagariya</Text>

      <Text style={styles.title}>
        Create New Password
      </Text>

      <Text style={styles.subtitle}>
        Enter a new password for your Pagariya account.
      </Text>

      {!sessionReady && (
        <Text style={styles.loadingText}>
          Verifying password reset link...
        </Text>
      )}

      {sessionReady && (
        <>
          <TextInput
            style={styles.input}
            placeholder="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {password.length > 0 && password.length < 6 && (
            <Text style={styles.fieldWarning}>
              ⚠ Password must contain at least 6 characters.
            </Text>
          )}

          {password.length >= 6 && (
            <Text style={styles.fieldSuccess}>
              ✓ Password length is valid.
            </Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {confirmPassword.length > 0 &&
            password === confirmPassword && (
              <Text style={styles.fieldSuccess}>
                ✓ Passwords match.
              </Text>
            )}

          {confirmPassword.length > 0 &&
            password !== confirmPassword && (
              <Text style={styles.fieldWarning}>
                ⚠ Passwords do not match.
              </Text>
            )}

          <Pressable
            style={[
              styles.button,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleUpdatePassword}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Updating..." : "Update Password"}
            </Text>
          </Pressable>
        </>
      )}

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
              onPress={async () => {
                setPopupVisible(false);

                if (popupType === "success") {
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

  loadingText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
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