import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { colors, spacing, typography } from "../../../theme";

/* ============================================================
   TYPES
============================================================ */

type Profile = {
  id: string;
  name: string | null;
  role: string;
  is_active: boolean;
};

type WorkshopVisit = {
  id: string;
  vehicle_id: string;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  stage_started_at: string | null;
  created_at: string;
};

type Vehicle = {
  id: string;
  vehicle_no: string;
  jc_no: string | null;
  model: string | null;
  arena_nexa: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_type: string | null;
  current_stage: string | null;
  current_status: string | null;
  current_assigned_to: string | null;
  stage_started_at: string | null;
};

type ApprovalCycle = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  cycle_no: number;
  cycle_type: string | null;
  decision: string;
  approval_received_at: string | null;
  approval_hold_at: string | null;
  approval_hold_remark: string | null;
  decided_by: string | null;
  remarks: string | null;
  created_at: string | null;
};

type IntakeContact = {
  visit_id: string;
  vehicle_id: string;
  customer_name: string | null;
  customer_mobile: string | null;
};

type HoldItem = {
  visit: WorkshopVisit;
  vehicle: Vehicle;
  hold: ApprovalCycle;
  heldByName: string | null;
};

type HoldAge = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
type AgeFilter = "ALL" | HoldAge;

/* ============================================================
   CONSTANTS
============================================================ */

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const AGE_FILTERS: {
  key: AgeFilter;
  label: string;
}[] = [
  { key: "ALL", label: "All" },
  { key: "URGENT", label: "7+ Days" },
  { key: "HIGH", label: "4–6 Days" },
  { key: "MEDIUM", label: "2–3 Days" },
  { key: "LOW", label: "0–1 Day" },
];

const AGE_ORDER: Record<HoldAge, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/* ============================================================
   HELPERS
============================================================ */

function contactValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return !text || ["—", "-", "null", "undefined"].includes(text.toLowerCase())
    ? null
    : text;
}

function resolveCustomerContact(
  vehicle: Vehicle,
  intake: IntakeContact | null,
) {
  const matchingIntake = intake?.vehicle_id === vehicle.id ? intake : null;
  return {
    customer_name:
      contactValue(matchingIntake?.customer_name) ||
      contactValue(vehicle.customer_name),
    customer_mobile:
      contactValue(matchingIntake?.customer_mobile) ||
      contactValue(vehicle.customer_mobile),
  };
}

function formatIndiaDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function getHoldDays(item: HoldItem): number {
  const startValue =
    item.hold.approval_hold_at ||
    item.visit.stage_started_at ||
    item.hold.created_at ||
    item.vehicle.stage_started_at;

  if (!startValue) {
    return 0;
  }

  const startTime = new Date(startValue).getTime();

  if (!Number.isFinite(startTime)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - startTime) / DAY_IN_MS));
}

function getHoldAge(days: number): HoldAge {
  if (days >= 7) {
    return "URGENT";
  }

  if (days >= 4) {
    return "HIGH";
  }

  if (days >= 2) {
    return "MEDIUM";
  }

  return "LOW";
}

function getHoldAgeLabel(age: HoldAge): string {
  switch (age) {
    case "URGENT":
      return "7+ Days";
    case "HIGH":
      return "4–6 Days";
    case "MEDIUM":
      return "2–3 Days";
    case "LOW":
      return "0–1 Day";
    default:
      return "Pending";
  }
}

function getVehicleTitle(vehicle: Vehicle): string {
  return (
    [vehicle.arena_nexa, vehicle.model].filter(Boolean).join(" · ") ||
    "Vehicle details unavailable"
  );
}

function normalizeVehicleType(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  if (value === "PRIVATE") {
    return "Private";
  }

  if (value === "COMMERCIAL") {
    return "Commercial";
  }

  return value.replaceAll("_", " ");
}

function getHoldRemark(item: HoldItem): string {
  return (
    item.hold.approval_hold_remark?.trim() ||
    item.hold.remarks?.trim() ||
    "No hold remark recorded"
  );
}

/* ============================================================
   SCREEN
============================================================ */

export default function ApprovalHoldScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [holds, setHolds] = useState<HoldItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("ALL");

  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* ==========================================================
     LOAD QUEUE
  ========================================================== */

  const loadQueue = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      /* ------------------------------------------------------
         CURRENT PROFILE
      ------------------------------------------------------ */

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,name,role,is_active")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const currentProfile = profileData as Profile;

      if (!currentProfile.is_active) {
        throw new Error(
          "Your user account is inactive. Please contact an administrator.",
        );
      }

      if (!["advisor", "ceo_admin"].includes(currentProfile.role)) {
        throw new Error("Only an Advisor or CEO Admin can view Approval Hold.");
      }

      setProfile(currentProfile);

      /* ------------------------------------------------------
         WORKSHOP VISITS CURRENTLY ON HOLD
      ------------------------------------------------------ */

      let visitQuery = supabase
        .from("workshop_visits")
        .select(
          "id,vehicle_id,current_stage,current_status,current_assigned_to,stage_started_at,created_at",
        )
        .eq("current_stage", "APPROVAL_HOLD")
        .eq("current_status", "ON_HOLD")
        .order("stage_started_at", {
          ascending: true,
          nullsFirst: false,
        });

      if (currentProfile.role === "advisor") {
        visitQuery = visitQuery.eq("current_assigned_to", user.id);
      }

      const { data: visitData, error: visitError } = await visitQuery;

      if (visitError) {
        throw visitError;
      }

      const visits = (visitData ?? []) as WorkshopVisit[];

      if (visits.length === 0) {
        setHolds([]);
        setLastUpdated(new Date());
        return;
      }

      const visitIds = [...new Set(visits.map((item) => item.id))];

      const vehicleIds = [...new Set(visits.map((item) => item.vehicle_id))];

      /* ------------------------------------------------------
         LOAD VEHICLES + HOLD CYCLES
      ------------------------------------------------------ */

      const [vehiclesResult, cyclesResult, intakeResult] = await Promise.all([
        supabase
          .from("vehicles")
          .select(
            `
              id,
              vehicle_no,
              jc_no,
              model,
              arena_nexa,
              customer_name,
              customer_mobile,
              vehicle_type,
              current_stage,
              current_status,
              current_assigned_to,
              stage_started_at
            `,
          )
          .in("id", vehicleIds),

        supabase
          .from("approval_cycles")
          .select(
            `
              id,
              visit_id,
              vehicle_id,
              cycle_no,
              cycle_type,
              decision,
              approval_received_at,
              approval_hold_at,
              approval_hold_remark,
              decided_by,
              remarks,
              created_at
            `,
          )
          .in("visit_id", visitIds)
          .eq("decision", "APPROVAL_HOLD")
          .not("approval_hold_at", "is", null)
          .order("cycle_no", {
            ascending: false,
          }),
        supabase
          .from("vehicle_intake")
          .select("visit_id, vehicle_id, customer_name, customer_mobile")
          .in("visit_id", visitIds),
      ]);

      if (intakeResult.error) {
        throw intakeResult.error;
      }

      if (vehiclesResult.error) {
        throw vehiclesResult.error;
      }

      if (cyclesResult.error) {
        throw cyclesResult.error;
      }

      const vehicles = (vehiclesResult.data ?? []) as Vehicle[];

      const cycles = (cyclesResult.data ?? []) as ApprovalCycle[];

      /* ------------------------------------------------------
         CREATE LOOKUPS
      ------------------------------------------------------ */

      const vehicleMap = new Map<string, Vehicle>();

      vehicles.forEach((vehicle) => {
        vehicleMap.set(vehicle.id, vehicle);
      });

      const intakeMap = new Map<string, IntakeContact>();
      for (const intake of (intakeResult.data ?? []) as IntakeContact[]) {
        intakeMap.set(intake.visit_id, intake);
      }

      const latestHoldByVisit = new Map<string, ApprovalCycle>();

      cycles.forEach((cycle) => {
        if (!latestHoldByVisit.has(cycle.visit_id)) {
          latestHoldByVisit.set(cycle.visit_id, cycle);
        }
      });

      const decidedByIds = [
        ...new Set(
          cycles
            .map((cycle) => cycle.decided_by)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      let profileMap = new Map<string, string>();

      if (decidedByIds.length > 0) {
        const { data: decidedByProfiles, error: decidedByError } =
          await supabase
            .from("profiles")
            .select("id,name")
            .in("id", decidedByIds);

        if (decidedByError) {
          throw decidedByError;
        }

        (decidedByProfiles ?? []).forEach(
          (person: { id: string; name: string | null }) => {
            profileMap.set(
              person.id,
              person.name?.trim() || "User name unavailable",
            );
          },
        );
      }

      /* ------------------------------------------------------
         COMBINE ACTIVE HOLDS
      ------------------------------------------------------ */

      const combined: HoldItem[] = [];

      visits.forEach((visit) => {
        const vehicle = vehicleMap.get(visit.vehicle_id);

        const hold = latestHoldByVisit.get(visit.id);

        if (!vehicle || !hold) {
          return;
        }

        combined.push({
          visit,
          vehicle: {
            ...vehicle,
            ...resolveCustomerContact(vehicle, intakeMap.get(visit.id) || null),
          },
          hold,
          heldByName: hold.decided_by
            ? profileMap.get(hold.decided_by) || "User name unavailable"
            : null,
        });
      });

      setHolds(combined);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error("Approval Hold queue load error:", error);

      setErrorMessage(
        error?.message || "Unable to load Approval Hold vehicles.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* ==========================================================
     REFRESH WHEN SCREEN GETS FOCUS
  ========================================================== */

  useFocusEffect(
    useCallback(() => {
      loadQueue();
    }, [loadQueue]),
  );

  /* ==========================================================
     COUNTS
  ========================================================== */

  const ageCounts = useMemo(() => {
    const counts: Record<HoldAge, number> = {
      URGENT: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    holds.forEach((item) => {
      const age = getHoldAge(getHoldDays(item));
      counts[age] += 1;
    });

    return counts;
  }, [holds]);

  /* ==========================================================
     FILTER + SORT
  ========================================================== */

  const filteredHolds = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return [...holds]
      .filter((item) => {
        const vehicle = item.vehicle;

        const searchTarget = [
          vehicle.vehicle_no,
          vehicle.customer_name,
          vehicle.customer_mobile,
          vehicle.model,
          vehicle.arena_nexa,
          getHoldRemark(item),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !normalizedSearch || searchTarget.includes(normalizedSearch);

        const age = getHoldAge(getHoldDays(item));

        const matchesAge = ageFilter === "ALL" || age === ageFilter;

        return matchesSearch && matchesAge;
      })
      .sort((a, b) => {
        const daysA = getHoldDays(a);
        const daysB = getHoldDays(b);

        const ageA = getHoldAge(daysA);
        const ageB = getHoldAge(daysB);

        const priorityDifference = AGE_ORDER[ageA] - AGE_ORDER[ageB];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        if (daysA !== daysB) {
          return daysB - daysA;
        }

        return (a.vehicle.vehicle_no || "").localeCompare(
          b.vehicle.vehicle_no || "",
        );
      });
  }, [holds, searchText, ageFilter]);

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom", "left", "right"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
          translucent={false}
        />

        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.stateMessage}>Loading Approval Hold…</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ==========================================================
     MAIN UI
  ========================================================== */

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
        translucent={false}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadQueue(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* ----------------------------------------------------
            TOP BAR
        ---------------------------------------------------- */}

        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace("/(tabs)/advisor")}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.primary} />

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.brand}>PAGARIYA</Text>
        </View>

        {/* ----------------------------------------------------
            HERO
        ---------------------------------------------------- */}

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="pause-circle-outline" size={28} color="#FFFFFF" />
          </View>

          <Text style={styles.eyebrow}>ADVISOR WORKSPACE</Text>

          <Text style={styles.heading}>Approval Hold</Text>

          <Text style={styles.subtitle}>
            Vehicles currently waiting because approval is on hold.
          </Text>

          <View style={styles.heroBottom}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {holds.length} {holds.length === 1 ? "vehicle" : "vehicles"} on
                hold
              </Text>
            </View>

            {profile?.role === "ceo_admin" && (
              <View style={styles.adminBadge}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color="#FFFFFF"
                />

                <Text style={styles.adminBadgeText}>CEO Admin</Text>
              </View>
            )}
          </View>

          {lastUpdated && (
            <Text style={styles.updatedText}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* ----------------------------------------------------
            ERROR
        ---------------------------------------------------- */}

        {errorMessage !== "" && (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={22} color="#B42318" />
            </View>

            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>Couldn't load Approval Hold</Text>

              <Text style={styles.errorMessage}>{errorMessage}</Text>

              <Pressable
                onPress={() => loadQueue(true)}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ----------------------------------------------------
            SUMMARY
        ---------------------------------------------------- */}

        <View style={styles.summaryCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Hold Overview</Text>

              <Text style={styles.sectionSubtitle}>
                How long active holds have been waiting
              </Text>
            </View>

            <View style={styles.totalCircle}>
              <Text style={styles.totalCircleText}>{holds.length}</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryTile
              label="Urgent"
              count={ageCounts.URGENT}
              tone="urgent"
            />

            <SummaryTile label="High" count={ageCounts.HIGH} tone="high" />

            <SummaryTile
              label="Medium"
              count={ageCounts.MEDIUM}
              tone="medium"
            />

            <SummaryTile label="Low" count={ageCounts.LOW} tone="low" />
          </View>
        </View>

        {/* ----------------------------------------------------
            SEARCH + FILTER
        ---------------------------------------------------- */}

        <View style={styles.searchCard}>
          <Text style={styles.sectionTitle}>Find a Vehicle</Text>

          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={19}
              color={colors.textSecondary}
            />

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Registration, customer, mobile..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />

            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={colors.textSecondary}
                />
              </Pressable>
            )}
          </View>

          <Text style={styles.filterLabel}>Filter by hold age</Text>

          <View style={styles.filterRow}>
            {AGE_FILTERS.map((filter) => {
              const selected = ageFilter === filter.key;

              return (
                <Pressable
                  key={filter.key}
                  onPress={() => setAgeFilter(filter.key)}
                  style={({ pressed }) => [
                    styles.filterButton,
                    selected && styles.filterButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selected && styles.filterButtonTextSelected,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ----------------------------------------------------
            HOLD RULES
        ---------------------------------------------------- */}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color={colors.primary}
            />
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Approval Hold</Text>

            <Text style={styles.infoText}>
              A vehicle on hold remains outside Advisor Work until the hold is
              resolved. Resolving the hold returns the vehicle to Pending
              Approval.
            </Text>
          </View>
        </View>

        {/* ----------------------------------------------------
            EMPTY STATES
        ---------------------------------------------------- */}

        {holds.length === 0 && errorMessage === "" && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="checkmark-circle-outline"
                size={42}
                color={colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>No vehicles on Approval Hold</Text>

            <Text style={styles.emptyMessage}>
              There are currently no vehicles in APPROVAL_HOLD / ON_HOLD.
            </Text>

            <Pressable
              onPress={() => loadQueue(true)}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />

              <Text style={styles.refreshButtonText}>Refresh Queue</Text>
            </Pressable>
          </View>
        )}

        {holds.length > 0 && filteredHolds.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="search-outline"
                size={38}
                color={colors.textSecondary}
              />
            </View>

            <Text style={styles.emptyTitle}>No matching vehicles</Text>

            <Text style={styles.emptyMessage}>
              No active Approval Hold vehicles match your current search or
              filter.
            </Text>

            <Pressable
              onPress={() => {
                setSearchText("");
                setAgeFilter("ALL");
              }}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.refreshButtonText}>
                Clear Search & Filter
              </Text>
            </Pressable>
          </View>
        )}

        {/* ----------------------------------------------------
            HOLD CARDS
        ---------------------------------------------------- */}

        {filteredHolds.map((item) => {
          const holdDays = getHoldDays(item);
          const age = getHoldAge(holdDays);
          const remark = getHoldRemark(item);

          return (
            <View key={item.visit.id} style={styles.holdCard}>
              {/* Card Header */}

              <View style={styles.cardHeader}>
                <View style={styles.registrationBlock}>
                  <Text style={styles.smallLabel}>VEHICLE REGISTRATION</Text>

                  <Text style={styles.registration}>
                    {item.vehicle.vehicle_no || "Registration unavailable"}
                  </Text>
                </View>

                <View style={styles.onHoldBadge}>
                  <Ionicons
                    name="pause-circle-outline"
                    size={14}
                    color="#8A5A00"
                  />

                  <Text style={styles.onHoldText}>ON HOLD</Text>
                </View>
              </View>

              {/* Age */}

              <View style={styles.ageRow}>
                <HoldAgeBadge age={age} />

                <Text style={styles.waitingText}>
                  {holdDays} {holdDays === 1 ? "day" : "days"} on hold
                </Text>
              </View>

              <View style={styles.separator} />

              {/* Vehicle Details */}

              <InfoRow
                icon="person-outline"
                label="Customer"
                value={item.vehicle.customer_name}
              />

              <InfoRow
                icon="call-outline"
                label="Mobile"
                value={item.vehicle.customer_mobile}
              />

              <InfoRow
                icon="car-outline"
                label="Vehicle"
                value={getVehicleTitle(item.vehicle)}
              />

              <InfoRow
                icon="briefcase-outline"
                label="Vehicle type"
                value={normalizeVehicleType(item.vehicle.vehicle_type)}
              />

              <InfoRow
                icon="document-text-outline"
                label="Job Card"
                value={item.vehicle.jc_no}
              />

              <InfoRow
                icon="person-circle-outline"
                label="Held by"
                value={item.heldByName}
              />

              <InfoRow
                icon="time-outline"
                label="Held at"
                value={formatIndiaDateTime(item.hold.approval_hold_at)}
              />

              <InfoRow
                icon="repeat-outline"
                label="Approval cycle"
                value={
                  item.hold.cycle_no ? `Cycle ${item.hold.cycle_no}` : null
                }
              />

              {/* Hold Remark */}

              <View style={styles.remarkBox}>
                <View style={styles.remarkHeader}>
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={17}
                    color={colors.primary}
                  />

                  <Text style={styles.remarkLabel}>Hold Remark</Text>
                </View>

                <Text style={styles.remarkText}>{remark}</Text>
              </View>

              {/* Status */}

              <View style={styles.stageBox}>
                <View style={styles.stageItem}>
                  <Text style={styles.stageLabel}>Current Stage</Text>

                  <Text style={styles.stageValue}>APPROVAL HOLD</Text>
                </View>

                <View style={styles.stageDivider} />

                <View style={styles.stageItem}>
                  <Text style={styles.stageLabel}>Current Status</Text>

                  <Text style={styles.stageValue}>ON HOLD</Text>
                </View>
              </View>

              {/* ------------------------------------------------
                  VIEW DETAILS
              ------------------------------------------------ */}

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/advisor/approval_hold_details",
                    params: {
                      visitId: item.visit.id,
                      vehicleId: item.vehicle.id,
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.detailsButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#FFFFFF"
                />

                <Text style={styles.detailsButtonText}>View Hold Details</Text>

                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          );
        })}

        {/* ----------------------------------------------------
            FOOTER
        ---------------------------------------------------- */}

        <Text style={styles.footer}>PAGARIYA AUTO • APPROVAL HOLD</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ============================================================
   SUMMARY TILE
============================================================ */

function SummaryTile({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "urgent" | "high" | "medium" | "low";
}) {
  const tileStyle =
    tone === "urgent"
      ? styles.summaryUrgent
      : tone === "high"
        ? styles.summaryHigh
        : tone === "medium"
          ? styles.summaryMedium
          : styles.summaryLow;

  const countStyle =
    tone === "urgent"
      ? styles.summaryUrgentCount
      : tone === "high"
        ? styles.summaryHighCount
        : tone === "medium"
          ? styles.summaryMediumCount
          : styles.summaryLowCount;

  return (
    <View style={[styles.summaryTile, tileStyle]}>
      <Text style={styles.summaryTileLabel}>{label}</Text>

      <Text style={[styles.summaryTileCount, countStyle]}>{count}</Text>
    </View>
  );
}

/* ============================================================
   HOLD AGE BADGE
============================================================ */

function HoldAgeBadge({ age }: { age: HoldAge }) {
  const badgeStyle =
    age === "URGENT"
      ? styles.ageUrgent
      : age === "HIGH"
        ? styles.ageHigh
        : age === "MEDIUM"
          ? styles.ageMedium
          : styles.ageLow;

  const textStyle =
    age === "URGENT"
      ? styles.ageUrgentText
      : age === "HIGH"
        ? styles.ageHighText
        : age === "MEDIUM"
          ? styles.ageMediumText
          : styles.ageLowText;

  return (
    <View style={[styles.ageBadge, badgeStyle]}>
      <Text style={[styles.ageBadgeText, textStyle]}>
        {getHoldAgeLabel(age)}
      </Text>
    </View>
  );
}

/* ============================================================
   INFO ROW
============================================================ */

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelContainer}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />

        <Text style={styles.infoLabel}>{label}</Text>
      </View>

      <Text style={styles.infoValue}>{value?.trim() || "—"}</Text>
    </View>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 110,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: spacing.lg,
  },

  stateMessage: {
    ...typography.body,
    color: colors.textSecondary,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    minHeight: 38,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 2,
  },

  backText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  brand: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: colors.text,
  },

  hero: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: spacing.md,
  },

  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    marginBottom: 14,
  },

  eyebrow: {
    color: "#FFE5E7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  heading: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 6,
  },

  subtitle: {
    color: "#FFF0F0",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },

  countBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.17)",
  },

  countText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.17)",
  },

  adminBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  updatedText: {
    color: "#FFF0F0",
    fontSize: 11,
    marginTop: 10,
  },

  errorCard: {
    flexDirection: "row",
    backgroundColor: "#FEF3F2",
    borderWidth: 1,
    borderColor: "#FDA29B",
    borderRadius: 16,
    padding: 15,
    marginBottom: spacing.md,
    gap: 11,
  },

  errorIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#FEE4E2",
    alignItems: "center",
    justifyContent: "center",
  },

  errorContent: {
    flex: 1,
  },

  errorTitle: {
    color: "#B42318",
    fontSize: 15,
    fontWeight: "900",
  },

  errorMessage: {
    color: "#912018",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  retryButton: {
    alignSelf: "flex-start",
    marginTop: 11,
    backgroundColor: "#B42318",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },

  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },

  totalCircle: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  totalCircleText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "900",
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  summaryTile: {
    flexGrow: 1,
    width: "48%",
    borderRadius: 13,
    padding: 12,
  },

  summaryUrgent: {
    backgroundColor: "#FCE4E4",
  },

  summaryHigh: {
    backgroundColor: "#FFF0DB",
  },

  summaryMedium: {
    backgroundColor: "#E8F1FF",
  },

  summaryLow: {
    backgroundColor: "#E7F6EC",
  },

  summaryTileLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },

  summaryTileCount: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 3,
  },

  summaryUrgentCount: {
    color: "#B42318",
  },

  summaryHighCount: {
    color: "#B54708",
  },

  summaryMediumCount: {
    color: "#175CD3",
  },

  summaryLowCount: {
    color: "#18794E",
  },

  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  searchBox: {
    minHeight: 47,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },

  filterLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 8,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  filterButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },

  filterButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },

  filterButtonTextSelected: {
    color: "#FFFFFF",
  },

  infoCard: {
    flexDirection: "row",
    backgroundColor: "#EEF5FF",
    borderWidth: 1,
    borderColor: "#C9DDFF",
    borderRadius: 16,
    padding: 15,
    marginBottom: spacing.lg,
    gap: 10,
  },

  infoIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: "#DCEAFF",
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },

  infoText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  holdCard: {
    backgroundColor: colors.surface,
    borderRadius: 19,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  registrationBlock: {
    flex: 1,
  },

  smallLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },

  registration: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 5,
  },

  onHoldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF3D6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  onHoldText: {
    color: "#8A5A00",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  ageRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 12,
  },

  ageBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  ageBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  ageUrgent: {
    backgroundColor: "#FCE4E4",
  },

  ageUrgentText: {
    color: "#B42318",
  },

  ageHigh: {
    backgroundColor: "#FFF0DB",
  },

  ageHighText: {
    color: "#B54708",
  },

  ageMedium: {
    backgroundColor: "#E8F1FF",
  },

  ageMediumText: {
    color: "#175CD3",
  },

  ageLow: {
    backgroundColor: "#E7F6EC",
  },

  ageLowText: {
    color: "#18794E",
  },

  waitingText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 14,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 7,
  },

  infoLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 0.9,
  },

  infoLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  infoValue: {
    flex: 1.35,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },

  remarkBox: {
    backgroundColor: colors.background,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 11,
  },

  remarkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  remarkLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },

  remarkText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },

  stageBox: {
    flexDirection: "row",
    marginTop: 12,
    backgroundColor: "#F7F7F8",
    borderRadius: 13,
    padding: 11,
  },

  stageItem: {
    flex: 1,
  },

  stageDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },

  stageLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  stageValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 4,
  },

  detailsButton: {
    marginTop: 12,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },

  detailsButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 19,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
    maxWidth: 320,
  },

  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginTop: 15,
  },

  refreshButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.78,
  },

  footer: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 8,
  },
});
