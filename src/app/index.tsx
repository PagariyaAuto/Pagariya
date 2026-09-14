import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setEmail(session.user.email || "");
      } else {
        setEmail("");
        router.replace("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    setEmail(session.user.email || "");
    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);

    await supabase.auth.signOut();

    router.replace("/login");
  };

  // Loading screen
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Pagaria</Text>

      <Text style={styles.title}>
        Welcome!
      </Text>

      <Text style={styles.subtitle}>
        You are successfully logged in.
      </Text>

      <View style={styles.userBox}>
        <Text style={styles.label}>
          Logged in as
        </Text>

        <Text style={styles.email}>
          {email}
        </Text>
      </View>

      <Pressable
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>
          Logout
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 15,
    color: "#666",
  },

  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#fff",
  },

  logo: {
    fontSize: 40,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 40,
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },

  userBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 18,
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    color: "#777",
    marginBottom: 5,
  },

  email: {
    fontSize: 16,
    fontWeight: "600",
  },

  logoutButton: {
    height: 52,
    backgroundColor: "#111",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  logoutText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },
});