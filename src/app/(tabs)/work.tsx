
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../lib/supabase";
import { colors, spacing, typography } from "../../theme";

export default function WorkScreen() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading your work...");

  useEffect(() => {
    routeToRoleWork();
  }, []);

  const routeToRoleWork = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

      if (error || !profile) {
        setMessage("Could not load your profile. Please try again.");
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      switch (profile.role) {
        case "floor_incharge":
          router.replace("/(tabs)/work/floor-incharge");
          return;

        case "advisor":
          setMessage("Your Advisor work screen will be added separately.");
          return;

        case "supervisor":
          setMessage("Your Supervisor work screen will be added separately.");
          return;

        case "worker_group":
          setMessage("Your Worker Group work screen will be added separately.");
          return;

        case "billing_department":
          setMessage("Your Billing work screen will be added separately.");
          return;

        case "watchman":
          setMessage("Your Watchman work screen will be added separately.");
          return;

        case "ceo_admin":
          setMessage("Your CEO Admin work screen will be added separately.");
          return;

        default:
          setMessage("No work screen is available for your role yet.");
      }
    } catch (error) {
      console.log("Work role routing error:", error);
      setMessage("Something went wrong while loading your work.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <Text style={styles.message}>{message}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
});