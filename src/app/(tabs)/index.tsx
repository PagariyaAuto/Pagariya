import { ScrollView } from "../../components/inputs/KeyboardAware";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { colors, radius, spacing, typography } from "../../theme";

type Profile = { name: string | null; role: string; is_active: boolean };
const roleRoutes: Record<string, string> = {
  advisor: "/(tabs)/advisor",
  ceo_admin: "/(tabs)/advisor",
  store_team: "/(tabs)/store",
  watchman: "/(tabs)/watchman",
  floor_incharge: "/(tabs)/floor-incharge",
  final_inspector: "/(tabs)/final-inspector",
  billing_executive: "/(tabs)/billing",
};
function formatRole(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loggedOut, setLoggedOut] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProfile(null);
    setLoadError("");
    setLoggedOut(false);

    const loadProfile = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        if (!session?.user) {
          setLoggedOut(true);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("name,role,is_active")
          .eq("id", session.user.id)
          .single();
        if (error) throw error;
        if (!active) return;
        if (!data) throw new Error("Your account profile could not be found.");
        if (!data.is_active) {
          await supabase.auth.signOut();
          if (active) setLoggedOut(true);
          return;
        }
        setProfile(data as Profile);
      } catch (e: any) {
        if (active)
          setLoadError(e?.message || "Unable to load your account profile.");
      } finally {
        if (active) setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "SIGNED_OUT") {
        active = false;
        setLoggedOut(true);
        setProfile(null);
        setLoading(false);
      }
    });
    void loadProfile();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [retry]);

  if (loggedOut) return <Redirect href="/login" />;
  if (loading)
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading workspace…</Text>
        </View>
      </SafeAreaView>
    );

  if (loadError || !profile)
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="alert-circle-outline"
              size={30}
              color={colors.error}
            />
          </View>
          <Text style={styles.title}>Workspace unavailable</Text>
          <Text style={styles.errorText}>
            {loadError || "Unable to load your account profile."}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => setRetry((value) => value + 1)}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );

  const role = profile.role.trim().toLowerCase();
  const destination = roleRoutes[role];
  if (destination) return <Redirect href={destination as any} />;

  // Billing stays on a valid landing screen until its department workspace is built.
  const isBilling =
    role === "billing_executive" || role === "billing_department";
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.grow}>
            <Text style={styles.eyebrow}>PAGARIYA BODYSHOP</Text>
            <Text style={styles.name}>{profile.name?.trim() || "User"}</Text>
            <Text style={styles.role}>{formatRole(role)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            style={styles.profileButton}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Ionicons name="person-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.workspaceCard}>
          <View style={styles.workspaceIcon}>
            <Ionicons
              name={isBilling ? "receipt-outline" : "grid-outline"}
              size={25}
              color={colors.primary}
            />
          </View>
          <Text style={styles.title}>
            {isBilling ? "Billing Department" : "Workspace"}
          </Text>
          <Text style={styles.body}>
            {isBilling
              ? "Your Billing account is active. The Billing Executive screens are being prepared."
              : "Your account is active. A dedicated workspace for your role is being prepared."}
          </Text>
          <Text style={styles.hint}>
            {isBilling
              ? "This workspace will handle tax invoices, amounts and payment details after the Advisor transfers the vehicle."
              : "You can view your account information from My Profile."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.actionCard,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="person-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.actionTitle}>My Profile</Text>
            <Text style={styles.actionSubtitle}>
              View your account and role information
            </Text>
          </View>
          <Ionicons
            name="chevron-forward-outline"
            size={20}
            color={colors.textLight}
          />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
  },
  center: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  errorIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    marginTop: spacing.sm,
    maxWidth: 420,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  button: {
    marginTop: spacing.lg,
    minWidth: 150,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  grow: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.primary,
  },
  name: { ...typography.title, color: colors.text, marginTop: spacing.xs },
  role: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontWeight: "700",
  },
  profileButton: {
    width: 46,
    height: 46,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  workspaceIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: 20, fontWeight: "900", color: colors.text },
  body: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  hint: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  actionCard: {
    minHeight: 76,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.75 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  actionTitle: { ...typography.bodyMedium, color: colors.text },
  actionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
});
