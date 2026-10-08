import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing, typography } from "../theme";

const roleRoutes: Record<string, string> = {
  advisor: "/(tabs)/advisor",
  ceo_admin: "/(tabs)/advisor",
  store_team: "/(tabs)/store",
  watchman: "/(tabs)/watchman",
  floor_incharge: "/(tabs)/floor-incharge",
  final_inspector: "/(tabs)/final-inspector",
  billing_executive: "/(tabs)/billing",
  billing_department: "/(tabs)",
  supervisor: "/(tabs)",
  worker_group: "/(tabs)",
};

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [destination, setDestination] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setChecking(true);
    setDestination(null);
    setError("");

    const checkUser = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        if (!session?.user) {
          setDestination("/login");
          return;
        }
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("role,is_active")
          .eq("id", session.user.id)
          .single();
        if (profileError) throw profileError;
        if (!active) return;
        if (!data) throw new Error("Your account profile could not be found.");
        if (!data.is_active) {
          await supabase.auth.signOut();
          if (active) setDestination("/login");
          return;
        }
        const role = String(data.role || "")
          .trim()
          .toLowerCase();
        setDestination(roleRoutes[role] || "/(tabs)");
      } catch (e: any) {
        if (active)
          setError(e?.message || "Unable to load your account. Try again.");
      } finally {
        if (active) setChecking(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "SIGNED_OUT") {
        active = false;
        setDestination("/login");
        setChecking(false);
      }
    });
    void checkUser();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [retry]);

  if (destination) return <Redirect href={destination as any} />;

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.content}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>P</Text>
        </View>
        <Text style={styles.appName}>Pagariya</Text>
        <Text style={styles.tagline}>Workshop Management</Text>
        {checking ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your workspace…</Text>
          </View>
        ) : (
          <>
            <Text style={styles.error}>
              {error || "Your workspace could not be loaded."}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => setRetry((value) => value + 1)}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.loginButton}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.loginText}>Back to Login</Text>
            </Pressable>
          </>
        )}
      </View>
      <Text style={styles.footer}>Pagariya Auto</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: { fontSize: 38, fontWeight: "800", color: colors.white },
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
  loading: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xxl,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.lg,
    maxWidth: 420,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 48,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  loginButton: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  loginText: { color: colors.primary, fontWeight: "700" },
  footer: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: "center",
    paddingBottom: spacing.lg,
  },
});
