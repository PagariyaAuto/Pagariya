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

  // Name validation
  const isNameValid = name.trim().length >= 2;

  // Phone validation
  const isPhoneValid = /^[6-9]\d{9}$/.test(phone.trim());

  // Email validation
  const isEmailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Password validation
  const isPasswordValid = password.length >= 6;

  // Confirm password validation
  const isConfirmPasswordValid =
    confirmPassword.length > 0 &&
    password === confirmPassword;

  // Complete form validation
  const isFormValid =
    isNameValid &&
    isPhoneValid &&
    isEmailValid &&
    isPasswordValid &&
    isConfirmPasswordValid;

  // Show custom popup
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

  // Register user
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

    // Create account
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,

      // Store profile information in Auth metadata.
      // Supabase trigger will copy this into profiles.
      options: {
        data: {
          name: name.trim(),
          phone: phone.trim(),
        },
      },
    });

    setLoading(false);

    // Supabase error
    if (error) {
      showPopup(
        "Registration Failed",
        error.message,
        "error"
      );
      return;
    }

    // Account created successfully
    showPopup(
      "Account Created Successfully",
      `Your Pagariya account has been created successfully.

A confirmation link has been sent to ${email.trim()}.

Please confirm your email before logging in.`,
      "success"
    );
  };

  return (
    <View style={styles.container}>

      {/* LOGO */}

      <Text style={styles.logo}>
        Pagariya
      </Text>

      {/* TITLE */}

      <Text style={styles.title}>
        Create Account
      </Text>

      <Text style={styles.subtitle}>
        Create your account to get started
      </Text>

      {/* NAME */}

      <TextInput
        style={[
          styles.input,
          name.length > 0 && !isNameValid
            ? styles.inputError
            : null,
        ]}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {name.length > 0 && !isNameValid && (
        <Text style={styles.warningText}>
          ⚠ Please enter your full name.
        </Text>
      )}

      {/* PHONE */}

      <TextInput
        style={[
          styles.input,
          phone.length > 0 && !isPhoneValid
            ? styles.inputError
            : null,
        ]}
        placeholder="Phone Number"
        value={phone}
        onChangeText={(text) => {
          const numbersOnly = text.replace(/\D/g, "");
          setPhone(numbersOnly.slice(0, 10));
        }}
        keyboardType="phone-pad"
        maxLength={10}
      />

      {phone.length > 0 && !isPhoneValid && (
        <Text style={styles.warningText}>
          ⚠ Enter a valid 10-digit mobile number.
        </Text>
      )}

      {phone.length === 10 && isPhoneValid && (
        <Text style={styles.successText}>
          ✓ Phone number is valid.
        </Text>
      )}

      {/* EMAIL */}

      <TextInput
        style={[
          styles.input,
          email.length > 0 && !isEmailValid
            ? styles.inputError
            : null,
        ]}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {email.length > 0 && !isEmailValid && (
        <Text style={styles.warningText}>
          ⚠ Please enter a valid email address.
        </Text>
      )}

      {/* PASSWORD */}

      <TextInput
        style={[
          styles.input,
          password.length > 0 && !isPasswordValid
            ? styles.inputError
            : null,
        ]}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {password.length > 0 && password.length < 6 && (
        <Text style={styles.warningText}>
          ⚠ Password must be at least 6 characters.
        </Text>
      )}

      {password.length === 0 && (
        <Text style={styles.helperText}>
          Password must contain at least 6 characters.
        </Text>
      )}

      {/* CONFIRM PASSWORD */}

      <TextInput
        style={[
          styles.input,
          confirmPassword.length > 0 &&
          !isConfirmPasswordValid
            ? styles.inputError
            : null,
        ]}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      {confirmPassword.length > 0 &&
        password !== confirmPassword && (
          <Text style={styles.warningText}>
            ⚠ Passwords do not match.
          </Text>
        )}

      {confirmPassword.length > 0 &&
        password === confirmPassword && (
          <Text style={styles.successText}>
            ✓ Passwords match.
          </Text>
        )}

      {/* CREATE ACCOUNT BUTTON */}

      <Pressable
        style={[
          styles.button,
          (!isFormValid || loading) &&
            styles.buttonDisabled,
        ]}
        onPress={handleRegister}
        disabled={!isFormValid || loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? "Creating Account..."
            : "Create Account"}
        </Text>
      </Pressable>

      {/* LOGIN */}

      <View style={styles.loginRow}>
        <Text>
          Already have an account?{" "}
        </Text>

        <Link
          href="/login"
          style={styles.link}
        >
          Login
        </Link>
      </View>

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
                {popupType === "success"
                  ? "Go to Login"
                  : "OK"}
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
    borderColor: "#d32f2f",
  },

  warningText: {
    color: "#d32f2f",
    fontSize: 13,
    marginBottom: 10,
  },

  helperText: {
    color: "#777",
    fontSize: 13,
    marginBottom: 10,
  },

  successText: {
    color: "#2e7d32",
    fontSize: 13,
    marginBottom: 10,
  },

  button: {
    height: 52,
    backgroundColor: "#111",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 30,
  },

  link: {
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