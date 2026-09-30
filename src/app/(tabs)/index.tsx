import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../theme";

import AppCard from "../../../components/AppCard";
import { supabase } from "../../../lib/supabase";

type Profile = {
  name: string | null;
  role: string;
};

type DashboardSection = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("id", user.id)
        .single();

      if (error) {
        console.log("Home profile error:", error.message);

        setProfile({
          name: user.user_metadata?.name || null,
          role: "user",
        });

        return;
      }

      setProfile(data);
    } catch (error) {
      console.log("Load home profile error:", error);

      // Prevent the Home screen from remaining in a loading state
      // if the profile request unexpectedly fails.
      setProfile({
        name: null,
        role: "user",
      });
    } finally {
      setLoading(false);
    }
  };

  const displayName = profile?.name?.trim() || "User";

  const displayRole = profile?.role
    ? profile.role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "User";

  const role = profile?.role || "user";

  const getPendingSections = (): DashboardSection[] => {
    switch (role) {
      case "advisor":
        return [
          {
            icon: "clipboard-outline",
            title: "Pending Survey",
            subtitle: "Vehicles waiting for survey",
          },
        ];

      case "floor_incharge":
        return [
          {
            icon: "car-outline",
            title: "Ready for Floor",
            subtitle: "Vehicles ready to enter workshop",
          },
        ];

      case "supervisor":
        return [
          {
            icon: "construct-outline",
            title: "Workshop Work",
            subtitle: "Vehicles currently in workshop",
          },
        ];

      case "worker_group":
        return [
          {
            icon: "people-outline",
            title: "Assigned Work",
            subtitle: "Vehicles assigned to your group",
          },
        ];

      case "billing_department":
        return [
          {
            icon: "receipt-outline",
            title: "Billing Pending",
            subtitle: "Vehicles waiting for billing",
          },
        ];

      case "ceo_admin":
        return [
          {
            icon: "clipboard-outline",
            title: "Pending Survey",
            subtitle: "Vehicles waiting for survey",
          },
          {
            icon: "checkmark-circle-outline",
            title: "Pending Approval",
            subtitle: "Vehicles waiting for approval",
          },
          {
            icon: "car-outline",
            title: "Ready for Floor",
            subtitle: "Vehicles ready to enter workshop",
          },
        ];

      default:
        return [
          {
            icon: "car-outline",
            title: "Vehicle Operations",
            subtitle: "View current vehicle activity",
          },
        ];
    }
  };

  const pendingSections = getPendingSections();

  // Display a spinner only while the profile is being fetched.
  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ROLE-BASED DASHBOARD REDIRECTS
   *
   * Watchman has a completely separate dashboard.
   * The old Home dashboard should never render Watchman-specific
   * cards, buttons or navigation.
   */
  if (profile?.role === "watchman") {
    return <Redirect href="/(tabs)/watchman" />;
  }

  // Redirect Advisors and CEO Admins without rendering the old dashboard.
  if (
    profile?.role === "advisor" ||
    profile?.role === "ceo_admin"
  ) {
    return <Redirect href="/(tabs)/advisor" />;
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              Good Morning 👋
            </Text>

            <Text style={styles.name}>
              {displayName}
            </Text>

            <Text style={styles.role}>
              {displayRole}
            </Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Ionicons
              name="person-outline"
              size={22}
              color={colors.primary}
            />
          </Pressable>
        </View>

        {/* TODAY'S OVERVIEW */}
        <Text style={styles.sectionTitle}>
          Today's Overview
        </Text>

        <AppCard style={styles.overviewCard}>
          <OverviewItem
            icon="clipboard-outline"
            label="Pending Survey"
            enabled={true}
            onPress={() => router.push("/(tabs)/work")}
          />

          <View style={styles.overviewDivider} />

          <OverviewItem
            icon="checkmark-circle-outline"
            label="Pending Approval"
            enabled={true}
            onPress={() => router.push("/(tabs)/work")}
          />

          <View style={styles.overviewDivider} />

          <OverviewItem
            icon="car-outline"
            label="Work"
            enabled={true}
            onPress={() => router.push("/(tabs)/work")}
          />
        </AppCard>

        {/* PENDING WORK */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Pending Work
          </Text>

          <Text style={styles.sectionHint}>
            Based on your role
          </Text>
        </View>

        {pendingSections.map((section) => (
          <PendingCard
            key={section.title}
            icon={section.icon}
            title={section.title}
            subtitle={section.subtitle}
            onPress={() => router.push("/(tabs)/work")}
          />
        ))}

        {/* QUICK ACTIONS */}
        <Text style={styles.sectionTitle}>
          Quick Actions
        </Text>

        {/* NEW JOB CARD */}
        <Pressable
          style={({ pressed }) => [
            styles.actionCard,
            pressed && styles.actionPressed,
          ]}
          onPress={() => router.push("/(tabs)/vehicles")}
        >
          <View style={styles.actionIcon}>
            <Ionicons
              name="add-outline"
              size={26}
              color={colors.primary}
            />
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>
              New Job Card
            </Text>

            <Text style={styles.actionSubtitle}>
              Create a new vehicle job card
            </Text>
          </View>

          <Ionicons
            name="chevron-forward-outline"
            size={20}
            color={colors.textLight}
          />
        </Pressable>

        {/* MASTER DATA */}
        <Pressable
          style={({ pressed }) => [
            styles.actionCard,
            pressed && styles.actionPressed,
          ]}
          onPress={() => router.push("/(tabs)/master-data")}
        >
          <View style={styles.actionIcon}>
            <Ionicons
              name="settings-outline"
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>
              Master Data
            </Text>

            <Text style={styles.actionSubtitle}>
              Manage models, insurance, business and MI types
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

type OverviewItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  enabled: boolean;
  onPress: () => void;
};

function OverviewItem({
  icon,
  label,
  enabled,
  onPress,
}: OverviewItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.overviewItem,
        !enabled && styles.overviewItemDisabled,
        pressed && enabled && styles.overviewItemPressed,
      ]}
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      accessibilityState={{ disabled: !enabled }}
    >
      <View style={styles.overviewIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={colors.primary}
        />
      </View>

      <Text style={styles.overviewValue}>—</Text>

      <Text style={styles.overviewLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

type PendingCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function PendingCard({
  icon,
  title,
  subtitle,
  onPress,
}: PendingCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pendingCard,
        pressed && styles.pendingPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={styles.pendingIcon}>
        <Ionicons
          name={icon}
          size={24}
          color={colors.primary}
        />
      </View>

      <View style={styles.pendingContent}>
        <Text style={styles.pendingTitle}>
          {title}
        </Text>

        <Text style={styles.pendingSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward-outline"
        size={20}
        color={colors.textLight}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.textSecondary,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },

  headerText: {
    flex: 1,
  },

  greeting: {
    ...typography.body,
    color: colors.textSecondary,
  },

  name: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
  },

  role: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: "600",
  },

  profileButton: {
    width: 46,
    height: 46,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeader: {
    marginBottom: spacing.sm,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  overviewCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },

  overviewItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },

  overviewItemDisabled: {
    opacity: 0.55,
  },

  overviewItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },

  overviewIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },

  overviewValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },

  overviewLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },

  overviewDivider: {
    width: 1,
    height: 55,
    backgroundColor: colors.divider,
  },

  pendingCard: {
    minHeight: 76,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  pendingPressed: {
    opacity: 0.75,
  },

  pendingIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  pendingContent: {
    flex: 1,
  },

  pendingTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  pendingSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
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

  actionPressed: {
    opacity: 0.75,
  },

  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  actionContent: {
    flex: 1,
  },

  actionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  actionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
});