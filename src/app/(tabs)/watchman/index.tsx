import { ScrollView } from "../../../components/inputs/KeyboardAware";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../theme";

type Profile = {
  id: string;
  name: string | null;
  role: string | null;
};

export default function WatchmanDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);

  const [pendingAdvisor, setPendingAdvisor] = useState(0);
  const [pendingGateOut, setPendingGateOut] = useState(0);

  const [gateInsToday, setGateInsToday] = useState(0);
  const [assignmentsToday, setAssignmentsToday] = useState(0);
  const [gateOutsToday, setGateOutsToday] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = async (showLoader = false) => {
    try {
      if (showLoader) {
        setRefreshing(true);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, name, role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        console.error("Watchman profile error:", profileError);
        return;
      }

      if (!profileData) {
        return;
      }

      setProfile(profileData);

      const allowedRoles = ["watchman", "ceo_admin"];

      if (
        profileData.role &&
        !allowedRoles.includes(profileData.role.toLowerCase())
      ) {
        return;
      }

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      const todayStart = startOfToday.toISOString();
      const tomorrowStart = startOfTomorrow.toISOString();

      // ------------------------------------------------------------
      // Today's Gate In
      // ------------------------------------------------------------
      const { count: gateInCount, error: gateInError } = await supabase
        .from("gate_entries")
        .select("id", { count: "exact", head: true })
        .gte("gate_in_at", todayStart)
        .lt("gate_in_at", tomorrowStart);

      if (gateInError) {
        console.error("Gate in count error:", gateInError);
      }

      setGateInsToday(gateInCount ?? 0);

      // ------------------------------------------------------------
      // Today's Advisor Assignments
      // ------------------------------------------------------------
      const { count: assignmentCount, error: assignmentError } =
        await supabase
          .from("vehicle_assignments")
          .select("id", { count: "exact", head: true })
          .eq("assignment_role", "ADVISOR")
          .gte("assigned_at", todayStart)
          .lt("assigned_at", tomorrowStart);

      if (assignmentError) {
        console.error("Assignment count error:", assignmentError);
      }

      setAssignmentsToday(assignmentCount ?? 0);

      // ------------------------------------------------------------
      // Today's Gate Out
      // ------------------------------------------------------------
      const { count: gateOutCount, error: gateOutError } = await supabase
        .from("gate_exits")
        .select("id", { count: "exact", head: true })
        .gte("gate_out_at", todayStart)
        .lt("gate_out_at", tomorrowStart);

      if (gateOutError) {
        console.error("Gate out count error:", gateOutError);
      }

      setGateOutsToday(gateOutCount ?? 0);

      // ------------------------------------------------------------
      // Pending Advisor
      // View vehicles waiting for assignment
      // ------------------------------------------------------------
      const { count: pendingAdvisorCount, error: pendingAdvisorError } =
        await supabase
          .from("workshop_visits")
          .select("id", { count: "exact", head: true })
          .eq("current_stage", "PENDING_ADVISOR")
          .in("current_status", ["PENDING", "IN_PROGRESS"]);

      if (pendingAdvisorError) {
        console.error(
          "Pending advisor count error:",
          pendingAdvisorError
        );
      }

      setPendingAdvisor(pendingAdvisorCount ?? 0);

      // ------------------------------------------------------------
      // Pending Gate Out
      // ------------------------------------------------------------
      const { count: pendingGateOutCount, error: pendingGateOutError } =
        await supabase
          .from("workshop_visits")
          .select("id", { count: "exact", head: true })
          .eq("current_stage", "PENDING_GATE_OUT")
          .in("current_status", ["PENDING", "IN_PROGRESS"]);

      if (pendingGateOutError) {
        console.error(
          "Pending gate out count error:",
          pendingGateOutError
        );
      }

      setPendingGateOut(pendingGateOutCount ?? 0);

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Watchman dashboard error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ------------------------------------------------------------
  // Initial load
  // ------------------------------------------------------------
  useEffect(() => {
    loadDashboard();
  }, []);

  // ------------------------------------------------------------
  // Automatically refresh whenever dashboard becomes active
  // ------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      if (profile) {
        loadDashboard();
      }
    }, [profile?.id])
  );

  // ------------------------------------------------------------
  // Manual pull-to-refresh
  // ------------------------------------------------------------
  const handleRefresh = () => {
    loadDashboard(true);
  };

  // ------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------
  const openGateIn = () => {
    router.push("/(tabs)/watchman/gate-in");
  };

  const openVehicles = () => {
    router.push("/(tabs)/watchman/vehicles");
  };

  const openAssignmentHistory = () => {
    router.push(
      "/(tabs)/watchman/assignment-history"
    );
  };

  const openGateOut = () => {
    router.push("/(tabs)/watchman/gate-out");
  };

  // ------------------------------------------------------------
  // Role guard
  // ------------------------------------------------------------
  if (
    profile &&
    profile.role &&
    !["watchman", "ceo_admin"].includes(profile.role.toLowerCase())
  ) {
    return <Redirect href="/(tabs)" />;
  }

  // ------------------------------------------------------------
  // Display values
  // ------------------------------------------------------------
  const displayName = profile?.name?.trim() || "Watchman";

  const displayRole = profile?.role
    ? profile.role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter: string) => letter.toUpperCase())
    : "Watchman";

  const formattedLastUpdated = lastUpdated
    ? lastUpdated.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  // ------------------------------------------------------------
  // Loading screen
  // ------------------------------------------------------------
  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.loadingText}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------
  // Dashboard
  // ------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ========================================================
            HEADER
        ======================================================== */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Welcome back</Text>

            <Text style={styles.name}>{displayName}</Text>

            <Text style={styles.role}>{displayRole}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}
            onPress={handleRefresh}
          >
            {refreshing ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={25}
                color={colors.primary}
              />
            )}
          </Pressable>
        </View>

        {/* ========================================================
            ATTENTION REQUIRED
        ======================================================== */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Attention Required</Text>

            <Text style={styles.sectionSubtitle}>
              Vehicles waiting for action
            </Text>
          </View>
        </View>

        <View style={styles.pendingRow}>
          {/* Pending Advisor */}
          <Pressable
            style={({ pressed }) => [
              styles.pendingCard,
              pressed && styles.pressed,
            ]}
            onPress={openVehicles}
          >
            <View style={styles.pendingTopRow}>
              <View style={styles.pendingIcon}>
                <Ionicons
                  name="person-outline"
                  size={23}
                  color={colors.primary}
                />
              </View>

              {pendingAdvisor > 0 && (
                <View style={styles.attentionDot} />
              )}
            </View>

            <Text style={styles.pendingNumber}>
              {pendingAdvisor}
            </Text>

            <Text style={styles.pendingTitle}>
              Pending Advisor
            </Text>

            <View style={styles.pendingAction}>
              <Text style={styles.pendingActionText}>
                View vehicles
              </Text>

              <Ionicons
                name="chevron-forward"
                size={17}
                color={colors.primary}
              />
            </View>
          </Pressable>

          {/* Pending Gate Out */}
          <Pressable
            style={({ pressed }) => [
              styles.pendingCard,
              pressed && styles.pressed,
            ]}
            onPress={openGateOut}
          >
            <View style={styles.pendingTopRow}>
              <View style={styles.pendingIcon}>
                <Ionicons
                  name="log-out-outline"
                  size={23}
                  color={colors.primary}
                />
              </View>

              {pendingGateOut > 0 && (
                <View style={styles.attentionDot} />
              )}
            </View>

            <Text style={styles.pendingNumber}>
              {pendingGateOut}
            </Text>

            <Text style={styles.pendingTitle}>
              Pending Gate Out
            </Text>

            <View style={styles.pendingAction}>
              <Text style={styles.pendingActionText}>
                Release
              </Text>

              <Ionicons
                name="chevron-forward"
                size={17}
                color={colors.primary}
              />
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            GATE OPERATIONS
        ======================================================== */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Gate Operations</Text>

            <Text style={styles.sectionSubtitle}>
              Manage vehicle movement
            </Text>
          </View>
        </View>

        <View style={styles.operationsCard}>
          {/* Gate In */}
          <Pressable
            style={({ pressed }) => [
              styles.operationRow,
              pressed && styles.pressed,
            ]}
            onPress={openGateIn}
          >
            <View style={styles.operationIcon}>
              <Ionicons
                name="log-in-outline"
                size={24}
                color={colors.primary}
              />
            </View>

            <View style={styles.operationContent}>
              <Text style={styles.operationTitle}>Gate In</Text>

              <Text style={styles.operationSubtitle}>
                Register incoming vehicle
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.textSecondary}
            />
          </Pressable>

          <View style={styles.operationDivider} />

          {/* My Vehicles */}
          <Pressable
            style={({ pressed }) => [
              styles.operationRow,
              pressed && styles.pressed,
            ]}
            onPress={openVehicles}
          >
            <View style={styles.operationIcon}>
              <Ionicons
                name="car-outline"
                size={24}
                color={colors.primary}
              />
            </View>

            <View style={styles.operationContent}>
              <Text style={styles.operationTitle}>
                My Vehicles
              </Text>

              <Text style={styles.operationSubtitle}>
                View vehicles and assignments
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.textSecondary}
            />
          </Pressable>

          <View style={styles.operationDivider} />

          {/* Assignment History */}
          <Pressable
            style={({ pressed }) => [
              styles.operationRow,
              pressed && styles.pressed,
            ]}
            onPress={openAssignmentHistory}
          >
            <View style={styles.operationIcon}>
              <Ionicons
                name="time-outline"
                size={24}
                color={colors.primary}
              />
            </View>

            <View style={styles.operationContent}>
              <Text style={styles.operationTitle}>
                Assignment History
              </Text>

              <Text style={styles.operationSubtitle}>
                View your Advisor assignments
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.textSecondary}
            />
          </Pressable>

          <View style={styles.operationDivider} />

          {/* Gate Out */}
          <Pressable
            style={({ pressed }) => [
              styles.operationRow,
              pressed && styles.pressed,
            ]}
            onPress={openGateOut}
          >
            <View style={styles.operationIcon}>
              <Ionicons
                name="log-out-outline"
                size={24}
                color={colors.primary}
              />
            </View>

            <View style={styles.operationContent}>
              <Text style={styles.operationTitle}>Gate Out</Text>

              <Text style={styles.operationSubtitle}>
                Release completed vehicle
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* ========================================================
            TODAY
        ======================================================== */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Today</Text>

            <Text style={styles.sectionSubtitle}>
              Gate activity summary
            </Text>
          </View>
        </View>

        <View style={styles.todayCard}>
          {/* Gate In */}
          <View style={styles.todayRow}>
            <View style={styles.todayLeft}>
              <View style={styles.todayIcon}>
                <Ionicons
                  name="log-in-outline"
                  size={19}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.todayLabel}>Gate In</Text>
            </View>

            <Text style={styles.todayValue}>{gateInsToday}</Text>
          </View>

          <View style={styles.todayDivider} />

          {/* Advisor Assigned */}
          <View style={styles.todayRow}>
            <View style={styles.todayLeft}>
              <View style={styles.todayIcon}>
                <Ionicons
                  name="person-add-outline"
                  size={19}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.todayLabel}>
                Advisor Assigned
              </Text>
            </View>

            <Text style={styles.todayValue}>
              {assignmentsToday}
            </Text>
          </View>

          <View style={styles.todayDivider} />

          {/* Gate Out */}
          <View style={styles.todayRow}>
            <View style={styles.todayLeft}>
              <View style={styles.todayIcon}>
                <Ionicons
                  name="log-out-outline"
                  size={19}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.todayLabel}>Gate Out</Text>
            </View>

            <Text style={styles.todayValue}>{gateOutsToday}</Text>
          </View>
        </View>

        {/* ========================================================
            LAST UPDATED
        ======================================================== */}
        <View style={styles.updatedContainer}>
          <Ionicons
            name="time-outline"
            size={15}
            color={colors.textSecondary}
          />

          <Text style={styles.updatedText}>
            {formattedLastUpdated
              ? `Updated at ${formattedLastUpdated}`
              : "Updating..."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // ============================================================
  // HEADER
  // ============================================================

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },

  greeting: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 2,
  },

  name: {
    ...typography.subheading,
    color: colors.text,
  },

  role: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 3,
  },

  refreshButton: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // ============================================================
  // SECTION HEADERS
  // ============================================================

  sectionHeader: {
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ============================================================
  // ATTENTION CARDS
  // ============================================================

  pendingRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  pendingCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 178,
  },

  pendingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  pendingIcon: {
    width: 43,
    height: 43,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  attentionDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  pendingNumber: {
    ...typography.subheading,
    color: colors.text,
    fontSize: 28,
    marginTop: spacing.md,
  },

  pendingTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginTop: 1,
  },

  pendingAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: spacing.md,
  },

  pendingActionText: {
    ...typography.caption,
    color: colors.primary,
  },

  // ============================================================
  // GATE OPERATIONS
  // ============================================================

  operationsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },

  operationRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  operationIcon: {
    width: 43,
    height: 43,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  operationContent: {
    flex: 1,
    paddingRight: spacing.md,
  },

  operationTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  operationSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },

  operationDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing.lg + 43 + spacing.md,
  },

  // ============================================================
  // TODAY
  // ============================================================

  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  todayRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  todayLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  todayIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  todayLabel: {
    ...typography.body,
    color: colors.text,
  },

  todayValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontSize: 18,
  },

  todayDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },

  // ============================================================
  // UPDATED
  // ============================================================

  updatedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    paddingBottom: spacing.md,
  },

  updatedText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 5,
  },

  // ============================================================
  // PRESS
  // ============================================================

  pressed: {
    opacity: 0.72,
  },
});