import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import {
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
          console.error(
            "Failed to load user role:",
            error
          );

          if (mounted) {
            setRole(null);
            setLoadingRole(false);
          }

          return;
        }

        if (mounted) {
          setRole(
            (data?.role as UserRole) ?? null
          );

          setLoadingRole(false);
        }
      } catch (error) {
        console.error(
          "Failed to load user role:",
          error
        );

        if (mounted) {
          setRole(null);
          setLoadingRole(false);
        }
      }
    };

    loadRole();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const isWatchman = role === "watchman";

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

        tabBarActiveTintColor:
          colors.primary,

        tabBarInactiveTintColor:
          colors.textLight,

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
          VISIBLE TABS

          NORMAL USERS:
          HOME → VEHICLES → WORK → PROFILE

          WATCHMAN:
          HOME → PENDING ADVISOR → GATE OUT → PROFILE
      ====================================================== */}

      {/* =====================================================
          HOME
          VISIBLE FOR EVERYONE
      ====================================================== */}

      <Tabs.Screen
        name="index"
        options={{
          title: "Home",

          tabBarIcon: ({
            focused,
            color,
          }) => (
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
          NORMAL USERS ONLY
      ====================================================== */}

      <Tabs.Screen
        name="vehicle-management/index"
        options={{
          href: isWatchman
            ? null
            : undefined,

          title: "Vehicles",

          tabBarIcon: ({
            focused,
            color,
          }) => (
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
          NORMAL USERS ONLY
      ====================================================== */}

      <Tabs.Screen
        name="work"
        options={{
          title: "Work",

          href: isWatchman
            ? null
            : undefined,

          tabBarIcon: ({
            focused,
            color,
          }) => (
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
          WATCHMAN
          PENDING ADVISOR
          WATCHMAN ONLY

          Because this screen is declared BEFORE Gate Out
          and Profile, Watchman order becomes:

          HOME → PENDING ADVISOR → GATE OUT → PROFILE
      ====================================================== */}

      <Tabs.Screen
        name="watchman/vehicles"
        options={{
          title: "Pending Advisor",

          href: isWatchman
            ? undefined
            : null,

          tabBarIcon: ({
            focused,
            color,
          }) => (
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
          WATCHMAN ONLY
      ====================================================== */}

      <Tabs.Screen
        name="watchman/gate-out"
        options={{
          title: "Gate Out",

          href: isWatchman
            ? undefined
            : null,

          tabBarIcon: ({
            focused,
            color,
          }) => (
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

          Declared AFTER Watchman tabs so Watchman gets:

          HOME → PENDING ADVISOR → GATE OUT → PROFILE

          Normal users get:

          HOME → VEHICLES → WORK → PROFILE
      ====================================================== */}

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",

          tabBarIcon: ({
            focused,
            color,
          }) => (
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
          ALL HIDDEN
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
          ALL HIDDEN
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
      <Tabs.Screen
        name="advisor/approval_vehicles"
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
    <View
      style={[
        styles.tabIcon,
        focused &&
          styles.tabIconActive,
      ]}
    >
      <Ionicons
        name={
          focused
            ? activeIcon
            : inactiveIcon
        }
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
    backgroundColor:
      colors.primary + "18",
  },
});