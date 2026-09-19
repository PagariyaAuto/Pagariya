import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";


import { router } from "expo-router";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../theme";

import { supabase } from "../../lib/supabase";

export default function Index() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session?.user) {
          router.replace("/login");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.log("Profile error:", error.message);
        router.replace("/(tabs)");
        return;
      }

      if (!data.is_active) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      router.replace("/(tabs)");
    } catch (error) {
      console.log("Check user error:", error);
      router.replace("/login");
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={styles.container}  edges={["top", "bottom"]}>
        <View style={styles.content}>
          {/* APP ICON */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>P</Text>
          </View>

          {/* APP NAME */}
          <Text style={styles.appName}>
            Pagariya
          </Text>

          <Text style={styles.tagline}>
            Workshop Management
          </Text>

          {/* LOADING */}
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />

            <Text style={styles.loadingText}>
              Loading...
            </Text>
          </View>
        </View>

        {/* FOOTER */}
        <Text style={styles.footerText}>
          Pagariya Auto
        </Text>
      </SafeAreaView>
    );
  }

  return null;
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
    paddingHorizontal: spacing.xl,
  },

  logoContainer: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",

    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  logoText: {
    fontSize: 38,
    fontWeight: "800",
    color: colors.white,
  },

  appName: {
    ...typography.title,
    fontSize: 28,
    color: colors.text,
    marginTop: spacing.lg,
  },

  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xxl,
  },

  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },

  footerText: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: "center",
    paddingBottom: spacing.lg,
  },
});