import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
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

type VisitRow = {
  id: string;
  vehicle_id: string;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  stage_started_at: string | null;
  created_at: string;
};

type VehicleRow = {
  id: string;
  vehicle_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  model: string | null;
  arena_nexa: string | null;
  vehicle_type: string | null;
};

type IntakeRow = {
  visit_id: string;
  vehicle_id: string;
  insurance_type: string | null;
  job_card_no: string | null;
};

type SurveyVehicle = {
  visit: VisitRow;
  vehicle: VehicleRow;
  intake: IntakeRow | null;
};

type Advisor = {
  id: string;
  name: string | null;
};

type Priority = "Urgent" | "High" | "Medium" | "Low";
type PriorityFilter = "All" | Priority;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const PRIORITY_ORDER: Record<Priority, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

function getPendingDays(item: SurveyVehicle): number {
  const startDate =
    item.visit.stage_started_at || item.visit.created_at;

  const startTime = new Date(startDate).getTime();

  if (!Number.isFinite(startTime)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - startTime) / DAY_IN_MS),
  );
}

function getPriority(days: number): Priority {
  if (days >= 7) return "Urgent";
  if (days >= 4) return "High";
  if (days >= 2) return "Medium";
  return "Low";
}

function formatDate(date: string | null): string {
  if (!date) return "Date unavailable";

  const parsed = new Date(date);

  if (!Number.isFinite(parsed.getTime())) {
    return "Date unavailable";
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function normalizeInsuranceType(
  value: string | null | undefined,
): string {
  return (value ?? "").trim().toUpperCase();
}

function getJobTypeLabel(
  value: string | null | undefined,
): string {
  const normalized = normalizeInsuranceType(value);

  if (normalized === "PAID") return "PAID";
  if (normalized === "INSURANCE") return "INSURANCE";

  return value?.trim() || "Unknown";
}

export default function AdvisorSurveyQueueScreen() {
  const [vehicles, setVehicles] = useState<SurveyVehicle[]>([]);
  const [advisorNames, setAdvisorNames] = useState<
    Record<string, string>
  >({});
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>("All");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          router.replace("/(tabs)/advisor");
          return true;
        },
      );

      return () => subscription.remove();
    }, []),
  );

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

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role,is_active")
          .eq("id", user.id)
          .single();

      if (profileError) {
        throw profileError;
      }

      if (
        !profile?.is_active ||
        !["advisor", "ceo_admin"].includes(profile.role)
      ) {
        throw new Error(
          "Only an active Advisor or CEO Admin can view this queue.",
        );
      }

      setRole(profile.role);

      let visitsQuery = supabase
        .from("workshop_visits")
        .select(
          "id,vehicle_id,current_stage,current_status,current_assigned_to,stage_started_at,created_at",
        )
        .eq("current_stage", "PENDING_SURVEY")
        .in("current_status", ["PENDING", "IN_PROGRESS"])
        .not("current_assigned_to", "is", null)
        .order("stage_started_at", { ascending: true });

      if (profile.role === "advisor") {
        visitsQuery = visitsQuery.eq(
          "current_assigned_to",
          user.id,
        );
      }

      const { data: visitData, error: visitError } =
        await visitsQuery;

      if (visitError) {
        throw visitError;
      }

      const visits = (visitData ?? []) as VisitRow[];

      if (visits.length === 0) {
        setVehicles([]);
        setAdvisorNames({});
        setLastUpdated(new Date());
        return;
      }

      const vehicleIds = [
        ...new Set(
          visits
            .map((visit) => visit.vehicle_id)
            .filter(
              (id): id is string => Boolean(id),
            ),
        ),
      ];

      const visitIds = [
        ...new Set(
          visits
            .map((visit) => visit.id)
            .filter(
              (id): id is string => Boolean(id),
            ),
        ),
      ];

      const [
        { data: vehicleData, error: vehicleError },
        { data: intakeData, error: intakeError },
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select(
            "id,vehicle_no,customer_name,customer_mobile,model,arena_nexa,vehicle_type",
          )
          .in("id", vehicleIds),

        supabase
          .from("vehicle_intake")
          .select(
            "visit_id,vehicle_id,insurance_type,job_card_no",
          )
          .in("visit_id", visitIds),
      ]);

      if (vehicleError) {
        throw vehicleError;
      }

      if (intakeError) {
        throw intakeError;
      }

      const vehicleMap = new Map<string, VehicleRow>();

      ((vehicleData ?? []) as VehicleRow[]).forEach(
        (vehicle) => {
          vehicleMap.set(vehicle.id, vehicle);
        },
      );

      const intakeMap = new Map<string, IntakeRow>();

      ((intakeData ?? []) as IntakeRow[]).forEach(
        (intake) => {
          intakeMap.set(intake.visit_id, intake);
        },
      );

      const combined: SurveyVehicle[] = [];

      for (const visit of visits) {
        const vehicle = vehicleMap.get(visit.vehicle_id);

        if (!vehicle) {
          continue;
        }

        combined.push({
          visit,
          vehicle,
          intake: intakeMap.get(visit.id) ?? null,
        });
      }

      setVehicles(combined);

      if (profile.role === "ceo_admin") {
        const advisorIds = [
          ...new Set(
            visits
              .map(
                (visit) =>
                  visit.current_assigned_to,
              )
              .filter(
                (id): id is string => Boolean(id),
              ),
          ),
        ];

        if (advisorIds.length > 0) {
          const {
            data: advisors,
            error: advisorError,
          } = await supabase
            .from("profiles")
            .select("id,name")
            .in("id", advisorIds);

          if (advisorError) {
            throw advisorError;
          }

          const names: Record<string, string> = {};

          ((advisors ?? []) as Advisor[]).forEach(
            (advisor) => {
              names[advisor.id] =
                advisor.name?.trim() ||
                "Advisor name unavailable";
            },
          );

          setAdvisorNames(names);
        } else {
          setAdvisorNames({});
        }
      } else {
        setAdvisorNames({});
      }

      setLastUpdated(new Date());
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Please try again.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadQueue();
    }, [loadQueue]),
  );

  const priorityCounts = useMemo(() => {
    const counts: Record<Priority, number> = {
      Urgent: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };

    vehicles.forEach((item) => {
      counts[getPriority(getPendingDays(item))] += 1;
    });

    return counts;
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = searchText
      .trim()
      .toLowerCase();

    return [...vehicles]
      .filter((item) => {
        const vehicle = item.vehicle;
        const intake = item.intake;

        const matchesSearch =
          !normalizedSearch ||
          (vehicle.vehicle_no ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (vehicle.customer_name ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (vehicle.customer_mobile ?? "")
            .toLowerCase()
            .includes(normalizedSearch) ||
          (intake?.job_card_no ?? "")
            .toLowerCase()
            .includes(normalizedSearch);

        const matchesPriority =
          priorityFilter === "All" ||
          getPriority(getPendingDays(item)) ===
            priorityFilter;

        return matchesSearch && matchesPriority;
      })
      .sort((a, b) => {
        const daysA = getPendingDays(a);
        const daysB = getPendingDays(b);

        const priorityDifference =
          PRIORITY_ORDER[getPriority(daysA)] -
          PRIORITY_ORDER[getPriority(daysB)];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        if (daysA !== daysB) {
          return daysB - daysA;
        }

        return (
          a.vehicle.vehicle_no ?? ""
        ).localeCompare(
          b.vehicle.vehicle_no ?? "",
        );
      });
  }, [
    vehicles,
    searchText,
    priorityFilter,
  ]);

  const openSurveyForm = (
    item: SurveyVehicle,
  ) => {
    router.push({
      pathname:
        "/(tabs)/advisor/survey_form",
      params: {
        visitId: item.visit.id,
        vehicleId: item.vehicle.id,
      },
    });
  };

  const selectPriority = (
    priority: PriorityFilter,
  ) => {
    setPriorityFilter((current) =>
      current === priority && priority !== "All"
        ? "All"
        : priority,
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.centerState}>
          <ActivityIndicator
            color={colors.primary}
            size="large"
          />

          <Text style={styles.stateMessage}>
            Loading survey queue…
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
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadQueue(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topBar}>
          <BackButton onPress={() =>
              router.replace("/(tabs)/advisor")
            } hitSlop={10} />

          <BrandPill />
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>
            ADVISOR WORKSPACE
          </Text>

          <Text style={styles.heading}>
            Pending Surveys
          </Text>

          <Text style={styles.subtitle}>
            {role === "ceo_admin"
              ? "Vehicles assigned to advisors and pending survey."
              : "Vehicles assigned to you and pending survey."}
          </Text>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {vehicles.length}{" "}
              {vehicles.length === 1
                ? "vehicle"
                : "vehicles"}{" "}
              pending
            </Text>
          </View>

          {lastUpdated && (
            <Text style={styles.updatedText}>
              Last updated:{" "}
              {lastUpdated.toLocaleTimeString(
                "en-IN",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                },
              )}
            </Text>
          )}
        </View>

        {errorMessage !== "" && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              Couldn&apos;t load the queue
            </Text>

            <Text style={styles.errorMessage}>
              {errorMessage}
            </Text>

            <Pressable
              onPress={() => loadQueue(true)}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.refreshButtonText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryTitleBlock}>
              <Text style={styles.sectionTitle}>
                Priority Overview
              </Text>

              <Text style={styles.summaryHint}>
                Tap a priority to filter the queue
              </Text>
            </View>

            <Pressable
              onPress={() =>
                selectPriority("All")
              }
              style={({ pressed }) => [
                styles.allButton,
                priorityFilter === "All" &&
                  styles.allButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.allButtonText,
                  priorityFilter === "All" &&
                    styles.allButtonTextSelected,
                ]}
              >
                All · {vehicles.length}
              </Text>
            </Pressable>
          </View>

          <View style={styles.summaryGrid}>
            <PrioritySummaryTile
              priority="Urgent"
              count={priorityCounts.Urgent}
              selected={
                priorityFilter === "Urgent"
              }
              onPress={() =>
                selectPriority("Urgent")
              }
            />

            <PrioritySummaryTile
              priority="High"
              count={priorityCounts.High}
              selected={
                priorityFilter === "High"
              }
              onPress={() =>
                selectPriority("High")
              }
            />

            <PrioritySummaryTile
              priority="Medium"
              count={priorityCounts.Medium}
              selected={
                priorityFilter === "Medium"
              }
              onPress={() =>
                selectPriority("Medium")
              }
            />

            <PrioritySummaryTile
              priority="Low"
              count={priorityCounts.Low}
              selected={
                priorityFilter === "Low"
              }
              onPress={() =>
                selectPriority("Low")
              }
            />
          </View>

          {priorityFilter !== "All" && (
            <View style={styles.activeFilterRow}>
              <Text style={styles.activeFilterText}>
                Showing {priorityFilter} priority
                vehicles
              </Text>

              <Pressable
                onPress={() =>
                  selectPriority("All")
                }
                hitSlop={8}
              >
                <Text
                  style={
                    styles.clearFilterText
                  }
                >
                  Clear
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.sectionTitle}>
            Find a Vehicle
          </Text>

          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search registration, customer, mobile or JC no."
            placeholderTextColor={
              colors.textSecondary
            }
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>

        {vehicles.length === 0 &&
        errorMessage === "" ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No pending surveys
            </Text>

            <Text style={styles.emptyMessage}>
              {role === "ceo_admin"
                ? "There are currently no advisor-assigned vehicles pending survey."
                : "You currently have no vehicles pending survey."}
            </Text>

            <Pressable
              onPress={() => loadQueue(true)}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.refreshButtonText}>
                Refresh Queue
              </Text>
            </Pressable>
          </View>
        ) : vehicles.length > 0 &&
          filteredVehicles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No matching vehicles
            </Text>

            <Text style={styles.emptyMessage}>
              No vehicles match your current
              search or priority filter.
            </Text>

            <Pressable
              onPress={() => {
                setSearchText("");
                setPriorityFilter("All");
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
        ) : (
          filteredVehicles.map((item) => {
            const pendingDays =
              getPendingDays(item);

            const priority =
              getPriority(pendingDays);

            const jobType =
              getJobTypeLabel(
                item.intake?.insurance_type,
              );

            const advisorId =
              item.visit.current_assigned_to;

            return (
              <View
                key={item.visit.id}
                style={styles.vehicleCard}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={
                      styles.registrationBlock
                    }
                  >
                    <Text
                      style={styles.smallLabel}
                    >
                      VEHICLE REGISTRATION
                    </Text>

                    <Text
                      style={
                        styles.registration
                      }
                    >
                      {item.vehicle
                        .vehicle_no ||
                        "Registration unavailable"}
                    </Text>
                  </View>

                  <View
                    style={styles.pendingBadge}
                  >
                    <Text
                      style={styles.pendingText}
                    >
                      Pending Survey
                    </Text>
                  </View>
                </View>

                <View style={styles.priorityLine}>
                  <PriorityBadge
                    priority={priority}
                  />

                  <Text
                    style={styles.pendingDays}
                  >
                    {pendingDays}{" "}
                    {pendingDays === 1
                      ? "day"
                      : "days"}{" "}
                    pending
                  </Text>

                  <View
                    style={[
                      styles.jobTypeBadge,
                      jobType ===
                        "INSURANCE"
                        ? styles.insuranceBadge
                        : jobType ===
                            "PAID"
                          ? styles.paidBadge
                          : styles.unknownJobBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.jobTypeText,
                        jobType ===
                          "INSURANCE"
                          ? styles.insuranceText
                          : jobType ===
                              "PAID"
                            ? styles.paidText
                            : styles.unknownJobText,
                      ]}
                    >
                      {jobType}
                    </Text>
                  </View>
                </View>

                <View
                  style={styles.separator}
                />

                <InfoRow
                  label="Customer"
                  value={
                    item.vehicle
                      .customer_name
                  }
                />

                <InfoRow
                  label="Mobile"
                  value={
                    item.vehicle
                      .customer_mobile
                  }
                />

                <InfoRow
                  label="Vehicle"
                  value={
                    [
                      item.vehicle
                        .arena_nexa,
                      item.vehicle.model,
                    ]
                      .filter(Boolean)
                      .join(" · ") ||
                    null
                  }
                />

                <InfoRow
                  label="Vehicle type"
                  value={
                    item.vehicle
                      .vehicle_type
                      ? item.vehicle
                          .vehicle_type ===
                        "PRIVATE"
                        ? "Private"
                        : item.vehicle
                              .vehicle_type ===
                            "COMMERCIAL"
                          ? "Commercial"
                          : item.vehicle
                              .vehicle_type
                      : null
                  }
                />

                <InfoRow
                  label="Job type"
                  value={jobType}
                />

                <InfoRow
                  label="Job Card No."
                  value={
                    item.intake
                      ?.job_card_no ??
                    null
                  }
                />

                {role ===
                  "ceo_admin" && (
                  <InfoRow
                    label="Assigned advisor"
                    value={
                      advisorId
                        ? advisorNames[
                            advisorId
                          ] ??
                          "Advisor name unavailable"
                        : "Not assigned"
                    }
                  />
                )}

                <InfoRow
                  label="Pending since"
                  value={formatDate(
                    item.visit
                      .stage_started_at,
                  )}
                />

                <Pressable
                  onPress={() =>
                    openSurveyForm(item)
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.openButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.openButtonText
                    }
                  >
                    Open Survey Form →
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}

        <View style={styles.rulesCard}>
          <Text style={styles.sectionTitle}>
            Automatic Priority Rules
          </Text>

          <View style={styles.ruleRow}>
            <PriorityBadge priority="Urgent" />

            <Text style={styles.ruleText}>
              7 or more days pending
            </Text>
          </View>

          <View style={styles.ruleRow}>
            <PriorityBadge priority="High" />

            <Text style={styles.ruleText}>
              4–6 days pending
            </Text>
          </View>

          <View style={styles.ruleRow}>
            <PriorityBadge priority="Medium" />

            <Text style={styles.ruleText}>
              2–3 days pending
            </Text>
          </View>

          <View style={styles.ruleRow}>
            <PriorityBadge priority="Low" />

            <Text style={styles.ruleText}>
              0–1 day pending
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          PAGARIYA AUTO • SURVEY QUEUE
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrioritySummaryTile({
  priority,
  count,
  selected,
  onPress,
}: {
  priority: Priority;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const tileStyle =
    priority === "Urgent"
      ? styles.tileUrgent
      : priority === "High"
        ? styles.tileHigh
        : priority === "Medium"
          ? styles.tileMedium
          : styles.tileLow;

  const selectedStyle =
    priority === "Urgent"
      ? styles.tileUrgentSelected
      : priority === "High"
        ? styles.tileHighSelected
        : priority === "Medium"
          ? styles.tileMediumSelected
          : styles.tileLowSelected;

  const countStyle =
    priority === "Urgent"
      ? styles.tileUrgentCount
      : priority === "High"
        ? styles.tileHighCount
        : priority === "Medium"
          ? styles.tileMediumCount
          : styles.tileLowCount;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.summaryTile,
        tileStyle,
        selected && selectedStyle,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.tileLabel}>
        {priority}
      </Text>

      <Text
        style={[
          styles.tileCount,
          countStyle,
        ]}
      >
        {count}
      </Text>

      <Text style={styles.tileTapHint}>
        {selected ? "Selected" : "Tap to filter"}
      </Text>
    </Pressable>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: Priority;
}) {
  const badgeStyle =
    priority === "Urgent"
      ? styles.priorityUrgent
      : priority === "High"
        ? styles.priorityHigh
        : priority === "Medium"
          ? styles.priorityMedium
          : styles.priorityLow;

  const textStyle =
    priority === "Urgent"
      ? styles.priorityUrgentText
      : priority === "High"
        ? styles.priorityHighText
        : priority === "Medium"
          ? styles.priorityMediumText
          : styles.priorityLowText;

  return (
    <View
      style={[
        styles.priorityBadge,
        badgeStyle,
      ]}
    >
      <Text
        style={[
          styles.priorityBadgeText,
          textStyle,
        ]}
      >
        {priority}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value?.trim() || "—"}
      </Text>
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
    paddingBottom: spacing.xxl + 96,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  stateMessage: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },

  back: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  brand: {
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.text,
  },

  hero: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: spacing.md,
  },

  eyebrow: {
    color: "#FFE5E7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 8,
  },

  subtitle: {
    color: "#FFF0F0",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  countBadge: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor:
      "rgba(255,255,255,0.17)",
  },

  countText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  updatedText: {
    color: "#FFF0F0",
    fontSize: 11,
    marginTop: 9,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3,
  },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },

  summaryTitleBlock: {
    flex: 1,
  },

  summaryHint: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },

  allButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  allButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  allButtonText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
  },

  allButtonTextSelected: {
    color: "#FFFFFF",
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  summaryTile: {
    width: "48%",
    flexGrow: 1,
    minHeight: 94,
    borderRadius: 12,
    padding: 12,
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: "transparent",
  },

  tileUrgent: {
    backgroundColor: "#FCE4E4",
  },

  tileHigh: {
    backgroundColor: "#FFF0DB",
  },

  tileMedium: {
    backgroundColor: "#E8F1FF",
  },

  tileLow: {
    backgroundColor: "#E7F6EC",
  },

  tileUrgentSelected: {
    borderColor: "#B42318",
  },

  tileHighSelected: {
    borderColor: "#B54708",
  },

  tileMediumSelected: {
    borderColor: "#175CD3",
  },

  tileLowSelected: {
    borderColor: "#18794E",
  },

  tileLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },

  tileCount: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },

  tileTapHint: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },

  tileUrgentCount: {
    color: "#B42318",
  },

  tileHighCount: {
    color: "#B54708",
  },

  tileMediumCount: {
    color: "#175CD3",
  },

  tileLowCount: {
    color: "#18794E",
  },

  activeFilterRow: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  activeFilterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  clearFilterText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },

  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 13,
    fontSize: 14,
    marginTop: 8,
  },

  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
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
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  registration: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 5,
  },

  pendingBadge: {
    backgroundColor: "#FFF3D6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  pendingText: {
    color: "#8A5A00",
    fontSize: 11,
    fontWeight: "800",
  },

  priorityLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 12,
  },

  priorityBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },

  priorityBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  priorityUrgent: {
    backgroundColor: "#FCE4E4",
  },

  priorityUrgentText: {
    color: "#B42318",
  },

  priorityHigh: {
    backgroundColor: "#FFF0DB",
  },

  priorityHighText: {
    color: "#B54708",
  },

  priorityMedium: {
    backgroundColor: "#E8F1FF",
  },

  priorityMediumText: {
    color: "#175CD3",
  },

  priorityLow: {
    backgroundColor: "#E7F6EC",
  },

  priorityLowText: {
    color: "#18794E",
  },

  pendingDays: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  jobTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  paidBadge: {
    backgroundColor: "#E7F6EC",
  },

  insuranceBadge: {
    backgroundColor: "#E8F1FF",
  },

  unknownJobBadge: {
    backgroundColor: "#F2F4F7",
  },

  jobTypeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  paidText: {
    color: "#18794E",
  },

  insuranceText: {
    color: "#175CD3",
  },

  unknownJobText: {
    color: colors.textSecondary,
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
    paddingVertical: 7,
    gap: 12,
  },

  infoLabel: {
    flex: 0.85,
    fontSize: 13,
    color: colors.textSecondary,
  },

  infoValue: {
    flex: 1.4,
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
    textAlign: "right",
  },

  openButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  openButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  rulesCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },

  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  ruleText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.8,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },

  emptyMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },

  errorCard: {
    backgroundColor: "#FEF3F2",
    borderRadius: 16,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#FDA29B",
  },

  errorTitle: {
    color: "#B42318",
    fontSize: 15,
    fontWeight: "800",
  },

  errorMessage: {
    color: "#912018",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  refreshButton: {
    marginTop: 18,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: colors.primary,
  },

  refreshButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  footer: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textLight,
    marginTop: 24,
  },
});