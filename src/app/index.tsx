import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type Profile = {
  name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
};

type ModuleCardProps = {
  title: string;
  subtitle: string;
  icon: string;
  onPress?: () => void;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        setProfile(null);
        router.replace("/login");
      }
    });

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

      // Get user's profile
      const { data, error } = await supabase
        .from("profiles")
        .select("name, phone, role, is_active")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.log("Profile error:", error.message);

        // User has a session but profile was not found
        setProfile({
          name: null,
          phone: null,
          role: "user",
          is_active: true,
        });

        setLoading(false);
        return;
      }

      // Check whether account is active
      if (!data.is_active) {
        await supabase.auth.signOut();

        router.replace("/login");
        return;
      }

      setProfile(data);
      setLoading(false);
    } catch (error) {
      console.log("Check user error:", error);
      router.replace("/login");
    }
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
          Loading Pagariya...
        </Text>
      </View>
    );
  }

  const displayName = profile?.name?.trim() || "User";

  const displayRole = profile?.role
    ? profile.role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "User";

  const isAdmin = profile?.role === "ceo_admin";

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>Pagariya</Text>

            <Text style={styles.welcome}>
              Welcome back, {displayName}
            </Text>
          </View>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{displayRole}</Text>
          </View>
        </View>

        {/* DASHBOARD TITLE */}

        <View style={styles.titleSection}>
          <Text style={styles.dashboardTitle}>
            Dashboard
          </Text>

          <Text style={styles.dashboardSubtitle}>
            Manage your Pagariya operations from one place.
          </Text>
        </View>

        {/* ACCOUNT CARD */}

        <View style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <Text style={styles.sectionTitle}>
              Account
            </Text>

            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />

              <Text style={styles.statusText}>
                Active
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Name</Text>

            <Text style={styles.value}>
              {displayName}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Role</Text>

            <Text style={styles.value}>
              {displayRole}
            </Text>
          </View>

          {profile?.phone ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Phone</Text>

              <Text style={styles.value}>
                {profile.phone}
              </Text>
            </View>
          ) : null}
        </View>

        {/* MODULE SECTION */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Modules
          </Text>

          <Text style={styles.sectionSubtitle}>
            Access your operational tools
          </Text>
        </View>

        <View style={styles.modulesGrid}>
          {/* WAREHOUSE */}

          <ModuleCard
            icon="W"
            title="Warehouse"
            subtitle="Manage warehouse operations"
          />

          {/* VEHICLES */}

          <ModuleCard
            icon="V"
            title="Vehicles"
            subtitle="Track vehicles and movements"
          />

          {/* INVENTORY */}

          <ModuleCard
            icon="I"
            title="Inventory"
            subtitle="Manage stock and items"
          />

          {/* REPORTS */}

          <ModuleCard
            icon="R"
            title="Reports"
            subtitle="View operational reports"
          />

          {/* USERS - ADMIN ONLY */}

          {isAdmin && (
            <ModuleCard
              icon="U"
              title="Users"
              subtitle="Manage users and roles"
            />
          )}
        </View>

        {/* COMING SOON */}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Pagariya Operations
          </Text>

          <Text style={styles.infoText}>
            Warehouse, vehicle tracking, inventory,
            user management and reporting modules
            will be available here.
          </Text>
        </View>

        {/* LOGOUT */}

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>
            Logout
          </Text>
        </Pressable>

        <Text style={styles.versionText}>
          Pagariya
        </Text>
      </ScrollView>
    </View>
  );
}

/* --------------------------------------------------
   MODULE CARD
-------------------------------------------------- */

function ModuleCard({
  title,
  subtitle,
  icon,
  onPress,
}: ModuleCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.moduleCard,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.moduleIcon}>
        <Text style={styles.moduleIconText}>
          {icon}
        </Text>
      </View>

      <Text style={styles.moduleTitle}>
        {title}
      </Text>

      <Text style={styles.moduleSubtitle}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

/* --------------------------------------------------
   STYLES
-------------------------------------------------- */

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
  },

  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 35,
  },

  /* HEADER */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
  },

  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },

  logo: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111",
  },

  welcome: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },

  roleBadge: {
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 150,
  },

  roleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },

  /* TITLE */

  titleSection: {
    marginBottom: 20,
  },

  dashboardTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111",
  },

  dashboardSubtitle: {
    fontSize: 14,
    color: "#777",
    marginTop: 5,
    lineHeight: 20,
  },

  /* ACCOUNT */

  accountCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
  },

  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f1f1",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#222",
    marginRight: 6,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },

  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 15,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },

  label: {
    fontSize: 14,
    color: "#888",
  },

  value: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
    maxWidth: "60%",
    textAlign: "right",
  },

  /* MODULE HEADER */

  sectionHeader: {
    marginBottom: 14,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 3,
  },

  /* MODULE GRID */

  modulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  moduleCard: {
    width: "48%",
    minHeight: 150,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  moduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f1f1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  moduleIconText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#222",
  },

  moduleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  moduleSubtitle: {
    fontSize: 12,
    color: "#888",
    lineHeight: 17,
    marginTop: 5,
  },

  /* INFO */

  infoCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
  },

  infoText: {
    fontSize: 13,
    color: "#777",
    lineHeight: 19,
  },

  /* LOGOUT */

  logoutButton: {
    height: 50,
    backgroundColor: "#111",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  buttonPressed: {
    opacity: 0.75,
  },

  logoutText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#aaa",
    marginTop: 16,
  },
});