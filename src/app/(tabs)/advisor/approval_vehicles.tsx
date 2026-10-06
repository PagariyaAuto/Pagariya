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
import { getCurrentWorkflowRoute } from "../../../lib/workflow-route";
import { colors, spacing, typography } from "../../../theme";

type Visit = {
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
  vehicle_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  model: string | null;
  arena_nexa: string | null;
  vehicle_type: string | null;
};

type Intake = {
  customer_name: string | null;
  customer_mobile: string | null;
  visit_id: string;
  vehicle_id: string;
  insurance_type: string | null;
  mi_type_id: string | null;
  insurance_company_id: string | null;
  job_card_no: string | null;
};

type Survey = {
  visit_id: string;
  survey_no: number;
  survey_type: string;
  completed_at: string | null;
};

type InsuranceCompany = {
  id: string;
  name: string | null;
};

type MIType = {
  id: string;
  name: string | null;
};

type Advisor = {
  id: string;
  name: string | null;
};

type Item = {
  visit: Visit;
  vehicle: Vehicle;
  intake: Intake | null;
  survey: Survey | null;
  insuranceCompany: InsuranceCompany | null;
  miType: MIType | null;
};

type Priority = "Urgent" | "High" | "Medium" | "Low";
type PriorityFilter = "All" | Priority;

function contactValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return !text || ["—", "-", "null", "undefined"].includes(text.toLowerCase())
    ? null
    : text;
}

function resolveCustomerContact(vehicle: Vehicle, intake: Intake | null) {
  // Intake belongs to a specific visit; never use a mismatched vehicle's contact.
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

const PAGE_SIZE = 25;
const DAY = 86400000;

const PRIORITY_ORDER: Record<Priority, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const daysPending = (item: Item) => {
  const startedAt = item.visit.stage_started_at || item.visit.created_at;

  const startedTime = new Date(startedAt).getTime();

  if (!Number.isFinite(startedTime)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - startedTime) / DAY));
};

const getPriority = (days: number): Priority => {
  if (days >= 7) return "Urgent";
  if (days >= 4) return "High";
  if (days >= 2) return "Medium";
  return "Low";
};

const formatJobType = (value: string | null | undefined) => {
  const normalized = (value || "").trim().toUpperCase();

  if (normalized === "PAID") {
    return "PAID";
  }

  if (normalized === "INSURANCE") {
    return "INSURANCE";
  }

  return value?.trim() || "Unknown";
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function ApprovalVehiclesScreen() {
  const [items, setItems] = useState<Item[]>([]);

  const [advisorNames, setAdvisorNames] = useState<Record<string, string>>({});

  const [role, setRole] = useState("");

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");

  const [page, setPage] = useState(1);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, is_active")
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
          "Only an active Advisor or CEO Admin can view the approval queue.",
        );
      }

      setRole(profile.role);

      let visitQuery = supabase
        .from("workshop_visits")
        .select(
          `
              id,
              vehicle_id,
              current_stage,
              current_status,
              current_assigned_to,
              stage_started_at,
              created_at
            `,
        )
        .eq("current_stage", "PENDING_APPROVAL")
        .in("current_status", ["PENDING", "IN_PROGRESS"])
        .not("current_assigned_to", "is", null)
        .order("stage_started_at", {
          ascending: true,
          nullsFirst: false,
        });

      if (profile.role === "advisor") {
        visitQuery = visitQuery.eq("current_assigned_to", user.id);
      }

      const { data: visitData, error: visitError } = await visitQuery;

      if (visitError) {
        throw visitError;
      }

      const visits = (visitData || []) as Visit[];

      if (!visits.length) {
        setItems([]);
        setAdvisorNames({});
        setPage(1);
        setLastUpdated(new Date());
        return;
      }

      const vehicleIds = [...new Set(visits.map((visit) => visit.vehicle_id))];

      const visitIds = [...new Set(visits.map((visit) => visit.id))];

      const [vehiclesResult, intakeResult, surveysResult] = await Promise.all([
        supabase
          .from("vehicles")
          .select(
            `
                id,
                vehicle_no,
                customer_name,
                customer_mobile,
                model,
                arena_nexa,
                vehicle_type
              `,
          )
          .in("id", vehicleIds),

        supabase
          .from("vehicle_intake")
          .select(
            `
                visit_id,
                vehicle_id,
                customer_name,
                customer_mobile,
                insurance_type,
                mi_type_id,
                insurance_company_id,
                job_card_no
              `,
          )
          .in("visit_id", visitIds),

        supabase
          .from("surveys")
          .select(
            `
                visit_id,
                survey_no,
                survey_type,
                completed_at
              `,
          )
          .in("visit_id", visitIds)
          .order("survey_no", {
            ascending: false,
          }),
      ]);

      if (vehiclesResult.error) {
        throw vehiclesResult.error;
      }

      if (intakeResult.error) {
        throw intakeResult.error;
      }

      if (surveysResult.error) {
        throw surveysResult.error;
      }

      const vehicles = (vehiclesResult.data || []) as Vehicle[];

      const intakes = (intakeResult.data || []) as Intake[];

      const surveys = (surveysResult.data || []) as Survey[];

      const surveyMap = new Map<string, Survey>();

      surveys.forEach((survey) => {
        if (!surveyMap.has(survey.visit_id)) {
          surveyMap.set(survey.visit_id, survey);
        }
      });

      const insuranceCompanyIds = [
        ...new Set(
          intakes
            .map((item) => item.insurance_company_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const miTypeIds = [
        ...new Set(
          intakes
            .map((item) => item.mi_type_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      let insuranceCompanies: InsuranceCompany[] = [];

      let miTypes: MIType[] = [];

      if (insuranceCompanyIds.length) {
        const { data, error } = await supabase
          .from("insurance_companies")
          .select("id, name")
          .in("id", insuranceCompanyIds);

        if (error) {
          throw error;
        }

        insuranceCompanies = (data || []) as InsuranceCompany[];
      }

      if (miTypeIds.length) {
        const { data, error } = await supabase
          .from("mi_types")
          .select("id, name")
          .in("id", miTypeIds);

        if (error) {
          throw error;
        }

        miTypes = (data || []) as MIType[];
      }

      const vehicleMap = new Map<string, Vehicle>();

      vehicles.forEach((vehicle) => {
        vehicleMap.set(vehicle.id, vehicle);
      });

      const intakeMap = new Map<string, Intake>();

      intakes.forEach((intake) => {
        intakeMap.set(intake.visit_id, intake);
      });

      const insuranceMap = new Map<string, InsuranceCompany>();

      insuranceCompanies.forEach((company) => {
        insuranceMap.set(company.id, company);
      });

      const miMap = new Map<string, MIType>();

      miTypes.forEach((miType) => {
        miMap.set(miType.id, miType);
      });

      const combined: Item[] = [];

      visits.forEach((visit) => {
        const vehicle = vehicleMap.get(visit.vehicle_id);

        if (!vehicle) {
          return;
        }

        const intake = intakeMap.get(visit.id) || null;

        const survey = surveyMap.get(visit.id) || null;

        const insuranceCompany = intake?.insurance_company_id
          ? insuranceMap.get(intake.insurance_company_id) || null
          : null;

        const miType = intake?.mi_type_id
          ? miMap.get(intake.mi_type_id) || null
          : null;

        combined.push({
          visit,
          vehicle: { ...vehicle, ...resolveCustomerContact(vehicle, intake) },
          intake,
          survey,
          insuranceCompany,
          miType,
        });
      });

      setItems(combined);
      setPage(1);

      if (profile.role === "ceo_admin") {
        const advisorIds = [
          ...new Set(
            visits
              .map((visit) => visit.current_assigned_to)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        if (advisorIds.length) {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", advisorIds);

          if (error) {
            throw error;
          }

          const names: Record<string, string> = {};

          ((data || []) as Advisor[]).forEach((advisor) => {
            names[advisor.id] =
              advisor.name?.trim() || "Advisor name unavailable";
          });

          setAdvisorNames(names);
        } else {
          setAdvisorNames({});
        }
      } else {
        setAdvisorNames({});
      }

      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /*
   * Reset pagination when search
   * or priority changes.
   */
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handlePriority = (value: PriorityFilter) => {
    setPriorityFilter(value);
    setPage(1);
  };

  const counts = useMemo(() => {
    const result: Record<Priority, number> = {
      Urgent: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };

    items.forEach((item) => {
      result[getPriority(daysPending(item))]++;
    });

    return result;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const vehicle = item.vehicle;

        const intake = item.intake;

        const insurance = item.insuranceCompany;

        const miType = item.miType;

        const matchesSearch =
          !query ||
          (vehicle.vehicle_no || "").toLowerCase().includes(query) ||
          (vehicle.customer_name || "").toLowerCase().includes(query) ||
          (vehicle.customer_mobile || "").toLowerCase().includes(query) ||
          (intake?.job_card_no || "").toLowerCase().includes(query) ||
          (insurance?.name || "").toLowerCase().includes(query) ||
          (miType?.name || "").toLowerCase().includes(query);

        const matchesPriority =
          priorityFilter === "All" ||
          getPriority(daysPending(item)) === priorityFilter;

        return matchesSearch && matchesPriority;
      })
      .sort((a, b) => {
        const priorityA = getPriority(daysPending(a));

        const priorityB = getPriority(daysPending(b));

        return (
          PRIORITY_ORDER[priorityA] - PRIORITY_ORDER[priorityB] ||
          daysPending(b) - daysPending(a) ||
          (a.vehicle.vehicle_no || "").localeCompare(b.vehicle.vehicle_no || "")
        );
      });
  }, [items, search, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  /*
   * Keep page valid if filtering
   * reduces the total page count.
   */
  const safePage = Math.min(page, totalPages);

  const startIndex = (safePage - 1) * PAGE_SIZE;

  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredItems.length);

  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const openApproval = async (item: Item) => {
    try {
      router.push(await getCurrentWorkflowRoute(item.vehicle.id));
    } catch (e: any) {
      setError(e.message || "Unable to open approval. Refresh the queue.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.loadingText}>Loading approval queue…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* TOP BAR */}

        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace("/(tabs)/advisor")}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backArrow}>‹</Text>

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.brand}>PAGARIYA</Text>
        </View>

        {/* HERO */}

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>ADVISOR WORKSPACE</Text>

          <Text style={styles.heroTitle}>Pending Approval</Text>

          <Text style={styles.heroSubtitle}>
            Vehicles that have completed survey and are waiting for an approval
            decision.
          </Text>

          <View style={styles.heroBottom}>
            <View style={styles.heroCount}>
              <Text style={styles.heroCountText}>
                {filteredItems.length}{" "}
                {filteredItems.length === 1 ? "vehicle" : "vehicles"} shown
              </Text>
            </View>

            {lastUpdated && (
              <Text style={styles.updated}>
                Updated{" "}
                {lastUpdated.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </Text>
            )}
          </View>
        </View>

        {/* ERROR */}

        {error !== "" && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Couldn't load the queue</Text>

            <Text style={styles.errorMessage}>{error}</Text>

            <Pressable onPress={() => load(true)} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* PRIORITY OVERVIEW */}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.sectionTitle}>Priority Overview</Text>

              <Text style={styles.sectionSubtitle}>
                Older approvals appear first.
              </Text>
            </View>

            <Text style={styles.totalText}>{items.length} total</Text>
          </View>

          <View style={styles.priorityGrid}>
            <PriorityTile
              label="All"
              count={items.length}
              selected={priorityFilter === "All"}
              onPress={() => handlePriority("All")}
              type="All"
            />

            <PriorityTile
              label="Urgent"
              count={counts.Urgent}
              selected={priorityFilter === "Urgent"}
              onPress={() => handlePriority("Urgent")}
              type="Urgent"
            />

            <PriorityTile
              label="High"
              count={counts.High}
              selected={priorityFilter === "High"}
              onPress={() => handlePriority("High")}
              type="High"
            />

            <PriorityTile
              label="Medium"
              count={counts.Medium}
              selected={priorityFilter === "Medium"}
              onPress={() => handlePriority("Medium")}
              type="Medium"
            />

            <PriorityTile
              label="Low"
              count={counts.Low}
              selected={priorityFilter === "Low"}
              onPress={() => handlePriority("Low")}
              type="Low"
            />
          </View>
        </View>

        {/* SEARCH */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Find a Vehicle</Text>

          <Text style={styles.sectionSubtitle}>
            Search registration, customer, mobile, job card, insurance or MI
            type.
          </Text>

          <TextInput
            value={search}
            onChangeText={handleSearch}
            placeholder="Search vehicles..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>

        {/* RESULT SUMMARY */}

        {filteredItems.length > 0 && (
          <View style={styles.resultBar}>
            <Text style={styles.resultText}>
              Showing {startIndex + 1}–{endIndex} of {filteredItems.length}{" "}
              vehicles
            </Text>

            {priorityFilter !== "All" && (
              <Text style={styles.filterText}>{priorityFilter}</Text>
            )}
          </View>
        )}

        {/* VEHICLES */}

        {items.length === 0 && !error ? (
          <EmptyState
            title="No pending approvals"
            message={
              role === "ceo_admin"
                ? "There are currently no vehicles waiting for approval."
                : "You currently have no vehicles waiting for approval."
            }
            button="Refresh Queue"
            onPress={() => load(true)}
          />
        ) : items.length > 0 && !filteredItems.length ? (
          <EmptyState
            title="No matching vehicles"
            message="No vehicles match your search or selected priority."
            button="Clear Search & Filter"
            onPress={() => {
              setSearch("");
              setPriorityFilter("All");
              setPage(1);
            }}
          />
        ) : (
          paginatedItems.map((item) => {
            const pendingDays = daysPending(item);

            const itemPriority = getPriority(pendingDays);

            const type = formatJobType(item.intake?.insurance_type);

            return (
              <View key={item.visit.id} style={styles.vehicleCard}>
                {/* VEHICLE HEADER */}

                <View style={styles.vehicleHeader}>
                  <View style={styles.vehicleHeaderLeft}>
                    <Text style={styles.vehicleLabel}>
                      VEHICLE REGISTRATION
                    </Text>

                    <Text style={styles.registration}>
                      {item.vehicle.vehicle_no || "Registration unavailable"}
                    </Text>
                  </View>

                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>
                      PENDING APPROVAL
                    </Text>
                  </View>
                </View>

                {/* WORKFLOW */}

                <View style={styles.workflowRow}>
                  <View style={styles.workflowDone}>
                    <Text style={styles.workflowDoneText}>
                      ✓ Survey Completed
                    </Text>
                  </View>

                  <Text style={styles.workflowArrow}>→</Text>

                  <View style={styles.workflowCurrent}>
                    <Text style={styles.workflowCurrentText}>
                      Pending Approval
                    </Text>
                  </View>
                </View>

                {/* PRIORITY */}

                <View style={styles.priorityRow}>
                  <PriorityBadge priority={itemPriority} />

                  <Text style={styles.pendingText}>
                    {pendingDays} {pendingDays === 1 ? "day" : "days"} pending
                  </Text>

                  <View
                    style={[
                      styles.jobBadge,
                      type === "PAID"
                        ? styles.paidBadge
                        : type === "INSURANCE"
                          ? styles.insuranceBadge
                          : styles.unknownBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.jobBadgeText,
                        type === "PAID"
                          ? styles.paidText
                          : type === "INSURANCE"
                            ? styles.insuranceText
                            : styles.unknownText,
                      ]}
                    >
                      {type}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* DETAILS */}

                <InfoRow label="Customer" value={item.vehicle.customer_name} />

                <InfoRow label="Mobile" value={item.vehicle.customer_mobile} />

                <InfoRow
                  label="Vehicle"
                  value={
                    [item.vehicle.arena_nexa, item.vehicle.model]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />

                <InfoRow
                  label="Vehicle Type"
                  value={
                    item.vehicle.vehicle_type === "PRIVATE"
                      ? "Private"
                      : item.vehicle.vehicle_type === "COMMERCIAL"
                        ? "Commercial"
                        : item.vehicle.vehicle_type
                  }
                />

                <InfoRow label="Job Type" value={type} />

                {type === "INSURANCE" && (
                  <>
                    <InfoRow label="MI / Non-MI" value={item.miType?.name} />

                    <InfoRow
                      label="Insurance Company"
                      value={item.insuranceCompany?.name}
                    />
                  </>
                )}

                <InfoRow
                  label="Job Card No."
                  value={item.intake?.job_card_no}
                />

                <InfoRow
                  label="Survey Completed"
                  value={
                    item.survey?.completed_at
                      ? formatDateTime(item.survey.completed_at)
                      : null
                  }
                />

                {role === "ceo_admin" && (
                  <InfoRow
                    label="Assigned Advisor"
                    value={
                      item.visit.current_assigned_to
                        ? advisorNames[item.visit.current_assigned_to] ||
                          "Advisor name unavailable"
                        : "Not assigned"
                    }
                  />
                )}

                <InfoRow
                  label="Approval Pending Since"
                  value={formatDateTime(item.visit.stage_started_at)}
                />

                {/* OPEN APPROVAL */}

                <Pressable
                  onPress={() => openApproval(item)}
                  style={({ pressed }) => [
                    styles.openButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.openButtonText}>
                    Open Approval Form →
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}

        {/* PAGINATION */}

        {filteredItems.length > PAGE_SIZE && (
          <View style={styles.pagination}>
            <Pressable
              disabled={safePage <= 1}
              onPress={() => setPage((current) => Math.max(1, current - 1))}
              style={[
                styles.pageButton,
                safePage <= 1 && styles.pageButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.pageButtonText,
                  safePage <= 1 && styles.pageButtonTextDisabled,
                ]}
              >
                ‹ Previous
              </Text>
            </Pressable>

            <View style={styles.pageIndicator}>
              <Text style={styles.pageNumber}>
                Page {safePage} of {totalPages}
              </Text>

              <Text style={styles.pageRange}>
                {startIndex + 1}–{endIndex} of {filteredItems.length}
              </Text>
            </View>

            <Pressable
              disabled={safePage >= totalPages}
              onPress={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              style={[
                styles.pageButton,
                safePage >= totalPages && styles.pageButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.pageButtonText,
                  safePage >= totalPages && styles.pageButtonTextDisabled,
                ]}
              >
                Next ›
              </Text>
            </Pressable>
          </View>
        )}

        {/* PRIORITY GUIDE */}

        <View style={[styles.card, styles.guideCard]}>
          <Text style={styles.sectionTitle}>Automatic Priority Rules</Text>

          <Text style={styles.sectionSubtitle}>
            Priority is automatically calculated from the time the vehicle
            entered Pending Approval.
          </Text>

          <GuideRow priority="Urgent" description="7 or more days" />

          <GuideRow priority="High" description="4–6 days" />

          <GuideRow priority="Medium" description="2–3 days" />

          <GuideRow priority="Low" description="0–1 day" />
        </View>

        <Text style={styles.footer}>PAGARIYA AUTO • APPROVAL QUEUE</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PriorityTile({
  label,
  count,
  selected,
  onPress,
  type,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
  type: "All" | Priority;
}) {
  const background =
    type === "Urgent"
      ? styles.urgentBackground
      : type === "High"
        ? styles.highBackground
        : type === "Medium"
          ? styles.mediumBackground
          : type === "Low"
            ? styles.lowBackground
            : styles.allBackground;

  const countColor =
    type === "Urgent"
      ? styles.urgentColor
      : type === "High"
        ? styles.highColor
        : type === "Medium"
          ? styles.mediumColor
          : type === "Low"
            ? styles.lowColor
            : styles.allColor;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.priorityTile,
        background,
        selected && styles.priorityTileSelected,
      ]}
    >
      <Text style={styles.priorityTileLabel}>{label}</Text>

      <Text style={[styles.priorityTileCount, countColor]}>{count}</Text>

      {selected && <Text style={styles.selectedText}>Selected</Text>}
    </Pressable>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const background =
    priority === "Urgent"
      ? styles.urgentBackground
      : priority === "High"
        ? styles.highBackground
        : priority === "Medium"
          ? styles.mediumBackground
          : styles.lowBackground;

  const text =
    priority === "Urgent"
      ? styles.urgentColor
      : priority === "High"
        ? styles.highColor
        : priority === "Medium"
          ? styles.mediumColor
          : styles.lowColor;

  return (
    <View style={[styles.priorityBadge, background]}>
      <Text style={[styles.priorityBadgeText, text]}>{priority}</Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value?.trim() || "—"}</Text>
    </View>
  );
}

function GuideRow({
  priority,
  description,
}: {
  priority: Priority;
  description: string;
}) {
  return (
    <View style={styles.guideRow}>
      <PriorityBadge priority={priority} />

      <Text style={styles.guideDescription}>{description}</Text>
    </View>
  );
}

function EmptyState({
  title,
  message,
  button,
  onPress,
}: {
  title: string;
  message: string;
  button: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>✓</Text>
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>

      <Text style={styles.emptyMessage}>{message}</Text>

      <Pressable onPress={onPress} style={styles.retryButton}>
        <Text style={styles.retryText}>{button}</Text>
      </Pressable>
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
    paddingBottom: spacing.xxl + 100,
  },

  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },

  backArrow: {
    fontSize: 30,
    lineHeight: 30,
    color: colors.primary,
    marginRight: 4,
  },

  backText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  brand: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.6,
  },

  hero: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: spacing.md,
  },

  heroEyebrow: {
    color: "#FFE5E7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 7,
  },

  heroSubtitle: {
    color: "#FFF0F0",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },

  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },

  heroCount: {
    backgroundColor: "rgba(255,255,255,0.17)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  heroCountText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  updated: {
    color: "#FFE5E7",
    fontSize: 11,
    fontWeight: "600",
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
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
    lineHeight: 16,
    marginTop: 3,
  },

  totalText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },

  priorityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  priorityTile: {
    flexGrow: 1,
    flexBasis: "29%",
    minWidth: 88,
    borderRadius: 13,
    padding: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },

  priorityTileSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },

  priorityTileLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },

  priorityTileCount: {
    fontSize: 23,
    fontWeight: "900",
    marginTop: 2,
  },

  selectedText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
    marginTop: 3,
  },

  allBackground: {
    backgroundColor: "#F2F4F7",
  },

  allColor: {
    color: colors.text,
  },

  urgentBackground: {
    backgroundColor: "#FCE4E4",
  },

  urgentColor: {
    color: "#B42318",
  },

  highBackground: {
    backgroundColor: "#FFF0DB",
  },

  highColor: {
    color: "#B54708",
  },

  mediumBackground: {
    backgroundColor: "#E8F1FF",
  },

  mediumColor: {
    color: "#175CD3",
  },

  lowBackground: {
    backgroundColor: "#E7F6EC",
  },

  lowColor: {
    color: "#18794E",
  },

  searchInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 14,
    marginTop: 12,
  },

  resultBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 3,
  },

  resultText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  filterText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },

  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },

  vehicleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  vehicleHeaderLeft: {
    flex: 1,
  },

  vehicleLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  registration: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 4,
  },

  pendingBadge: {
    backgroundColor: "#FFF3D6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  pendingBadgeText: {
    color: "#8A5A00",
    fontSize: 9,
    fontWeight: "900",
  },

  workflowRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 13,
  },

  workflowDone: {
    backgroundColor: "#E7F6EC",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  workflowDoneText: {
    color: "#18794E",
    fontSize: 10,
    fontWeight: "800",
  },

  workflowArrow: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: "800",
  },

  workflowCurrent: {
    backgroundColor: "#F2F4F7",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  workflowCurrentText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },

  priorityRow: {
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
  },

  pendingText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  jobBadge: {
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

  unknownBadge: {
    backgroundColor: "#F2F4F7",
  },

  jobBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },

  paidText: {
    color: "#18794E",
  },

  insuranceText: {
    color: "#175CD3",
  },

  unknownText: {
    color: colors.textSecondary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 13,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },

  infoLabel: {
    flex: 0.85,
    color: colors.textSecondary,
    fontSize: 12,
  },

  infoValue: {
    flex: 1.4,
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },

  openButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingHorizontal: 14,
  },

  openButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: spacing.md,
  },

  pageButton: {
    minHeight: 42,
    minWidth: 92,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  pageButtonDisabled: {
    backgroundColor: "#E9EAEC",
  },

  pageButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  pageButtonTextDisabled: {
    color: colors.textLight,
  },

  pageIndicator: {
    alignItems: "center",
    flex: 1,
  },

  pageNumber: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },

  pageRange: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E7F6EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyIconText: {
    color: "#18794E",
    fontSize: 23,
    fontWeight: "900",
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
    fontWeight: "900",
  },

  errorMessage: {
    color: "#912018",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  retryButton: {
    alignSelf: "center",
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 11,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },

  retryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  guideCard: {
    gap: 2,
  },

  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
  },

  guideDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },

  footer: {
    textAlign: "center",
    color: colors.textLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 20,
  },

  pressed: {
    opacity: 0.78,
  },
});
