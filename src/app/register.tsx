import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        emailRedirectTo: "pagaria://auth/callback",
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert("Registration Failed", error.message);
      return;
    }

    Alert.alert(
      "Check Your Email",
      "We have sent a confirmation link to your email. Please confirm your email and then log in.",
      [
        {
          text: "Go to Login",
          onPress: () => router.replace("/login"),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Pagaria</Text>

      <Text style={styles.title}>Create Account</Text>

      <Text style={styles.subtitle}>
        Create your account to get started
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <Pressable
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating Account..." : "Create Account"}
        </Text>
      </Pressable>

      <View style={styles.loginRow}>
        <Text>Already have an account? </Text>

        <Link href="/login" style={styles.link}>
          Login
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
    marginTop: 5,
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
});