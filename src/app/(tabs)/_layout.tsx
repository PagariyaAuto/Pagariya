import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ColorValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../lib/supabase";
import { colors } from "../../theme";

type UserRole =
  | "watchman"
  | "ceo_admin"
  | "advisor"
  | "store_team"
  | "floor_incharge"
  | "final_inspector"
  | "supervisor"
  | "worker_group"
  | "billing_department"
  | "billing_executive"
  | null;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState<UserRole>(null);

  const [loadingRole, setLoadingRole] = useState(true);

  const bottomInset = Math.max(insets.bottom, 0);

  useEffect(() => {
    let mounted = true;
    let request = 0;
    let scheduledReload: ReturnType<typeof setTimeout> | undefined;

    const loadRole = async () => {
      const currentRequest = ++request;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted && currentRequest === request) {
            setRole(null);

            setLoadingRole(false);
          }

          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role,is_active")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Failed to load user role:", error);

          if (mounted && currentRequest === request) {
            setRole(null);

            setLoadingRole(false);
          }

          return;
        }

        if (!mounted || currentRequest !== request) {
          return;
        }

        if (!data?.is_active) {
          setRole(null);
        } else {
          setRole((data.role as UserRole) ?? null);
        }

        setLoadingRole(false);
      } catch (error) {
        console.error("Failed to load user role:", error);

        if (mounted && currentRequest === request) {
          setRole(null);

          setLoadingRole(false);
        }
      }
    };

    void loadRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (scheduledReload) clearTimeout(scheduledReload);
      if (event === "SIGNED_OUT") {
        request += 1;
        setRole(null);
        setLoadingRole(false);
        return;
      }
      // Defer Auth calls until the current auth event has finished.
      scheduledReload = setTimeout(() => {
        if (mounted) void loadRole();
      }, 0);
    });

    return () => {
      mounted = false;
      request += 1;
      if (scheduledReload) clearTimeout(scheduledReload);

      subscription.unsubscribe();
    };
  }, []);

  const isWatchman = role === "watchman";

  const isStoreTeam = role === "store_team";

  const isFloorIncharge = role === "floor_incharge";

  const isFinalInspector = role === "final_inspector";

  const isBillingExecutive = role === "billing_executive";

  /*
   * Advisor and CEO Admin retain
   * their normal workspace tabs:
   *
   * HOME
   * VEHICLES
   * WORK
   * PROFILE
   */
  const isNormalWorkspace = role === "advisor" || role === "ceo_admin";

  const hasOperationalWorkspace =
    isWatchman ||
    isStoreTeam ||
    isFloorIncharge ||
    isFinalInspector ||
    isBillingExecutive ||
    isNormalWorkspace;

  /*
   * Hide the tab bar while role
   * information is loading.
   */
  if (loadingRole) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!role) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: colors.primary,

        tabBarInactiveTintColor: colors.textLight,

        tabBarStyle: {
          height: 68 + bottomInset,

          paddingBottom: 8 + bottomInset,

          paddingTop: 7,

          backgroundColor: colors.surface,

          borderTopWidth: 1,

          borderTopColor: colors.border,
        },

        tabBarLabelStyle: {
          fontSize: 12,

          fontWeight: "600",
        },
      }}
    >
      {/* =====================================================
          HOME / ROLE WORKSPACE

          FLOOR INCHARGE
          Home -> Floor dashboard

          FINAL INSPECTOR
          Home -> Final Inspector dashboard

          STORE TEAM
          Home -> Store dashboard

          WATCHMAN
          Home -> Watchman dashboard

          ADVISOR / CEO ADMIN
          Home -> Advisor workspace
      ====================================================== */}

      <Tabs.Screen
        name="index"
        options={{
          title: isStoreTeam ? "Store" : isWatchman ? "Gate" : "Home",

          href: isStoreTeam
            ? "/(tabs)/store"
            : isWatchman
              ? "/(tabs)/watchman"
              : isFloorIncharge
                ? ("/(tabs)/floor-incharge" as any)
                : isNormalWorkspace
                  ? "/(tabs)"
                  : null,

          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              activeIcon="home"
              inactiveIcon="home-outline"
              color={color}
            />
          ),
        }}
      />

      {/* =====================================================
          VEHICLES

          ADVISOR + CEO ADMIN ONLY
      ====================================================== */}

      <Tabs.Screen
        name="vehicle-management/index"
        options={{
          href: isNormalWorkspace ? undefined : null,

          title: "Vehicles",

          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              activeIcon="car"
              inactiveIcon="car-outline"
              color={color}
            />
          ),
        }}
      />

      {/* =====================================================
          WORK

          ADVISOR + CEO ADMIN ONLY
      ====================================================== */}

      <Tabs.Screen
        name="work"
        options={{
          title: "Work",

          href: isNormalWorkspace ? undefined : null,

          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              activeIcon="construct"
              inactiveIcon="construct-outline"
              color={color}
            />
          ),
        }}
      />

      {/* =====================================================
          FLOOR INCHARGE

          Visible tabs:
          HOME | PROFILE

          Vehicle detail remains hidden.
      ====================================================== */}

      <Tabs.Screen
        name="floor-incharge/index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="floor-incharge/vehicles"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          FINAL INSPECTOR

          Visible tabs:
          HOME | PROFILE

          Vehicle inspection screen is
          internal only.
      ====================================================== */}

      <Tabs.Screen
        name="billing"
        options={{
          title: "Home",
          href: isBillingExecutive ? ("/(tabs)/billing" as any) : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              activeIcon="home"
              inactiveIcon="home-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="final-inspector"
        options={{
          title: "Home",
          href: isFinalInspector ? ("/(tabs)/final-inspector" as any) : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              activeIcon="home"
              inactiveIcon="home-outline"
              color={color}
            />
          ),
        }}
      />

      {/* =====================================================
          STORE

          Store dashboard is entered
          through Home / Store.

          Vehicle action is internal.
      ====================================================== */}

      <Tabs.Screen
        name="store/index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="store/vehicle-action"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          WATCHMAN
      ====================================================== */}

      <Tabs.Screen
        name="watchman/index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="watchman/vehicles"
        options={{
          title: "Pending Advisor",

          href: isWatchman ? undefined : null,

          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              activeIcon="people"
              inactiveIcon="people-outline"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="watchman/gate-out"
        options={{
          title: "Gate Out",

          href: isWatchman ? undefined : null,

          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              activeIcon="log-out"
              inactiveIcon="log-out-outline"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="watchman/gate-in"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="watchman/assignment-history"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          PROFILE

          Visible for all current
          operational workspaces.
      ====================================================== */}

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",

          href: hasOperationalWorkspace ? undefined : null,

          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              activeIcon="person"
              inactiveIcon="person-outline"
              color={color}
            />
          ),
        }}
      />

      {/* =====================================================
          OLD / INTERNAL TOP-LEVEL ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="vehicles"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="gate-in"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="gate-out"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="returned"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="vehicle-detail"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="master-data"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          ADVISOR DASHBOARD / CORE ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="advisor/index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/intake"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/intake-form"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/survey"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/survey_form"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/claim-intimation"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/claim-intimation-form"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          APPROVAL
      ====================================================== */}

      <Tabs.Screen
        name="advisor/approval_vehicles"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/approval_form"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          APPROVAL HOLD

          Always hidden.
      ====================================================== */}

      <Tabs.Screen
        name="advisor/approval_hold"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/approval_hold_details"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          ADVISOR WORK
      ====================================================== */}

      <Tabs.Screen
        name="advisor/work"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/advisor_work_form"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/floor"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          ADVISOR / CEO ADMIN
          FINAL INSPECTION MANAGEMENT

          These files will be created
          separately from the execution
          workspace.

          Keep them hidden from tabs.
      ====================================================== */}

      <Tabs.Screen name="advisor/ready-for-delivery" options={{ href: null }} />
      <Tabs.Screen name="advisor/billing" options={{ href: null }} />

      <Tabs.Screen
        name="advisor/final_inspection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/final_inspection_details"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          SUPPLEMENTARY
      ====================================================== */}

      <Tabs.Screen
        name="advisor/supplementary"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/supplementary-detail"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          STORE MONITORING
      ====================================================== */}

      <Tabs.Screen
        name="advisor/store-monitor/index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/store-monitor/vehicle-details"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          OTHER ADVISOR INTERNAL ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="advisor/app"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          ADVISOR COMPONENT ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="advisor/components/CustomerDetailsCard"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/FullScreenPhotoViewer"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/SurveyPhotoGallery"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/VehicleDetailsCard"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/survey_form.styles"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          INTAKE COMPONENT ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="advisor/components/intake/IntakeCustomerSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeDocumentSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeJobDetailsSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeJobTypeSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakePhotoSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeSaveSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeUI"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeVehicleModelSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeVehicleSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeVehicleTypeSection"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/IntakeWorkerGroupSection"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          INTAKE HELPERS
      ====================================================== */}

      <Tabs.Screen
        name="advisor/components/intake/intake.data"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/intake.photos"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/intake.types"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="advisor/components/intake/intake.validation"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          VEHICLE MANAGEMENT INTERNAL ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="vehicle-management/[vehicleId]"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="vehicle-management/components/VehicleHeader"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="vehicle-management/components/VehicleSummary"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="vehicle-management/components/StageProgress"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="vehicle-management/components/WorkCategoryStatus"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="vehicle-management/components/VehiclePhotos"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="vehicle-management/components/VehicleEvents"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  focused,

  activeIcon,

  inactiveIcon,

  color,
}: {
  focused: boolean;

  activeIcon: keyof typeof Ionicons.glyphMap;

  inactiveIcon: keyof typeof Ionicons.glyphMap;

  color: ColorValue;
}) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={21}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  tabIcon: {
    width: 38,

    height: 32,

    borderRadius: 10,

    alignItems: "center",

    justifyContent: "center",
  },

  tabIconActive: {
    backgroundColor: colors.primary + "18",
  },
});
