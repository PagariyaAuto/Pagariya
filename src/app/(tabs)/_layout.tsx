import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../lib/supabase";
import { colors } from "../../theme";

type UserRole =
  | "watchman"
  | "ceo_admin"
  | "advisor"
  | "store_team"
  | "floor_incharge"
  | "supervisor"
  | "worker_group"
  | "billing_department"
  | null;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState<UserRole>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const bottomInset = Math.max(insets.bottom, 0);

  useEffect(() => {
    let mounted = true;

    const loadRole = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) {
            setRole(null);
            setLoadingRole(false);
          }

          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Failed to load user role:", error);

          if (mounted) {
            setRole(null);
            setLoadingRole(false);
          }

          return;
        }

        if (mounted) {
          if (!data?.is_active) {
            setRole(null);
          } else {
            setRole((data.role as UserRole) ?? null);
          }

          setLoadingRole(false);
        }
      } catch (error) {
        console.error("Failed to load user role:", error);

        if (mounted) {
          setRole(null);
          setLoadingRole(false);
        }
      }
    };

    loadRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isWatchman = role === "watchman";
  const isStoreTeam = role === "store_team";

  /*
   * Normal workspace roles:
   *
   * HOME → VEHICLES → WORK → PROFILE
   */
  const isNormalWorkspace =
    role === "advisor" ||
    role === "floor_incharge" ||
    role === "supervisor" ||
    role === "worker_group" ||
    role === "billing_department" ||
    role === "ceo_admin";

  if (loadingRole) {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: "none",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
      </Tabs>
    );
  }

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
          HOME

          STORE TEAM:
          HOME → STORE DASHBOARD → PROFILE

          WATCHMAN:
          HOME → PENDING ADVISOR → GATE OUT → PROFILE

          NORMAL USERS:
          HOME → VEHICLES → WORK → PROFILE
      ====================================================== */}

      <Tabs.Screen
        name="index"
        options={{
          title: "Home",

          /*
           * IMPORTANT:
           *
           * Store Team must NOT go to the old /(tabs)/index.tsx
           * dashboard when Home is pressed.
           *
           * Their Home tab now points directly to:
           *
           * /(tabs)/store
           *
           * Other roles keep their existing Home destinations.
           */
          href: isStoreTeam
            ? "/(tabs)/store"
            : isWatchman
              ? "/(tabs)/watchman"
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
          NORMAL WORKSPACE USERS ONLY
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
          NORMAL WORKSPACE USERS ONLY
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
          STORE

          NOT A VISIBLE TAB.

          Store Team uses:
          HOME → STORE DASHBOARD → PROFILE

          The Store screen remains available internally at:
          /(tabs)/store
      ====================================================== */}

      <Tabs.Screen
        name="store/index"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          WATCHMAN
          PENDING ADVISOR
          WATCHMAN ONLY
      ====================================================== */}

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

      {/* =====================================================
          WATCHMAN
          GATE OUT
      ====================================================== */}

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

      {/* =====================================================
          PROFILE

          STORE TEAM:
          HOME → STORE DASHBOARD → PROFILE

          WATCHMAN:
          HOME → PENDING ADVISOR → GATE OUT → PROFILE

          NORMAL USERS:
          HOME → VEHICLES → WORK → PROFILE
      ====================================================== */}

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",

          href:
            isStoreTeam || isWatchman || isNormalWorkspace ? undefined : null,

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
          HIDDEN OLD / INTERNAL ROUTES
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
          WORK INTERNAL ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="work/floor-incharge"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          ADVISOR ROUTES
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
          INTAKE HELPER FILES
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

      <Tabs.Screen
        name="vehicle-management/components/PreviousJobCards"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          WATCHMAN INTERNAL ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="watchman/index"
        options={{
          href: null,
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
          ADVISOR WORKFLOW INTERNAL ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="advisor/approval_vehicles"
        options={{
          href: null,
        }}
      />

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
        name="advisor/approval_form"
        options={{
          href: null,
        }}
      />

      {/* =====================================================
          STORE INTERNAL ROUTES
      ====================================================== */}

      <Tabs.Screen
        name="store/vehicle-action"
        options={{
          href: null,
        }}
      />

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
