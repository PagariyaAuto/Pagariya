import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

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
  phone: string | null;
  role: string;
  is_active: boolean;
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

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

      setEmail(user.email || "");

      const { data, error } = await supabase
        .from("profiles")
        .select("name, phone, role, is_active")
        .eq("id", user.id)
        .single();

      if (error) {
        console.log("Profile error:", error.message);

        setProfile({
          name: user.user_metadata?.name || null,
          phone: user.user_metadata?.phone || null,
          role: "user",
          is_active: true,
        });

        return;
      }

      setProfile(data);
    } catch (error) {
      console.log("Load profile error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const displayName =
    profile?.name?.trim() || "User";

  const displayRole = profile?.role
    ? profile.role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "User";

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
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
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
        {/* PROFILE HEADER */}

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons
              name="person-outline"
              size={36}
              color={colors.primary}
            />
          </View>

          <Text style={styles.title}>
            {displayName}
          </Text>

          <Text style={styles.role}>
            {displayRole}
          </Text>
        </View>

        {/* ACCOUNT INFORMATION */}

        <Text style={styles.sectionTitle}>
          Account Information
        </Text>

        <AppCard style={styles.card}>
          <ProfileRow
            icon="person-outline"
            label="Name"
            value={displayName}
          />

          <ProfileRow
            icon="mail-outline"
            label="Email"
            value={email || "Not available"}
          />

          <ProfileRow
            icon="call-outline"
            label="Mobile"
            value={profile?.phone || "Not available"}
          />

          <ProfileRow
            icon="shield-checkmark-outline"
            label="Role"
            value={displayRole}
            last
          />
        </AppCard>

        {/* ACCOUNT STATUS */}

        <Text style={styles.sectionTitle}>
          Account Status
        </Text>

        <AppCard style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.statusIcon}>
              <Ionicons
                name="checkmark-circle-outline"
                size={22}
                color={colors.success}
              />
            </View>

            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>
                Active Account
              </Text>

              <Text style={styles.statusSubtitle}>
                Your Pagariya account is active.
              </Text>
            </View>
          </View>
        </AppCard>

        {/* LOGOUT */}

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutPressed,
          ]}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={colors.white}
          />

          <Text style={styles.logoutText}>
            Logout
          </Text>
        </Pressable>

        <Text style={styles.version}>
          Pagariya
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type ProfileRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
};

function ProfileRow({
  icon,
  label,
  value,
  last = false,
}: ProfileRowProps) {
  return (
    <View
      style={[
        styles.row,
        !last && styles.rowBorder,
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={colors.primary}
        />
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.label}>
          {label}
        </Text>

        <Text style={styles.value}>
          {value}
        </Text>
      </View>
    </View>
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

  profileHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  role: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginTop: spacing.xs,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  card: {
    marginBottom: spacing.xl,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },

  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  rowContent: {
    flex: 1,
  },

  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  value: {
    ...typography.bodyMedium,
    color: colors.text,
    marginTop: 2,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  statusSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  logoutButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  logoutPressed: {
    opacity: 0.75,
  },

  logoutText: {
    ...typography.button,
    color: colors.white,
  },

  version: {
    textAlign: "center",
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.lg,
  },
});