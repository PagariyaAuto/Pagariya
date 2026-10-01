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

const DAY = 86400000;

const ORDER: Record<Priority, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const days = (x: Item) =>
  Math.max(
    0,
    Math.floor(
      (Date.now() -
        new Date(
          x.visit.stage_started_at || x.visit.created_at
        ).getTime()) /
        DAY
    )
  );

const priority = (d: number): Priority => {
  if (d >= 7) return "Urgent";
  if (d >= 4) return "High";
  if (d >= 2) return "Medium";
  return "Low";
};

const jobType = (value: string | null | undefined) => {
  const x = (value || "").trim().toUpperCase();

  if (x === "PAID") return "PAID";
  if (x === "INSURANCE") return "INSURANCE";

  return value?.trim() || "Unknown";
};

const dateText = (value: string | null) => {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Date unavailable";
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
  const [advisorNames, setAdvisorNames] = useState<
    Record<string, string>
  >({});
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<PriorityFilter>("All");
  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  useFocusEffect(
    useCallback(() => {
      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          () => {
            router.replace("/(tabs)/advisor");
            return true;
          }
        );

      return () => subscription.remove();
    }, [])
  );

  const load = useCallback(
    async (refresh = false) => {
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

        const {
          data: profile,
          error: profileError,
        } = await supabase
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
            "Only an active Advisor or CEO Admin can view the approval queue."
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
            `
          )
          .eq("current_stage", "PENDING_APPROVAL")
          .in("current_status", [
            "PENDING",
            "IN_PROGRESS",
          ])
          .not("current_assigned_to", "is", null)
          .order("stage_started_at", {
            ascending: true,
            nullsFirst: false,
          });

        /*
         * Advisor:
         * only see their own assigned vehicles.
         *
         * CEO Admin:
         * can see all assigned approval vehicles.
         */
        if (profile.role === "advisor") {
          visitQuery = visitQuery.eq(
            "current_assigned_to",
            user.id
          );
        }

        const {
          data: visitData,
          error: visitError,
        } = await visitQuery;

        if (visitError) {
          throw visitError;
        }

        const visits = (visitData || []) as Visit[];

        if (!visits.length) {
          setItems([]);
          setAdvisorNames({});
          setLastUpdated(new Date());
          return;
        }

        const vehicleIds = [
          ...new Set(
            visits.map((visit) => visit.vehicle_id)
          ),
        ];

        const visitIds = [
          ...new Set(
            visits.map((visit) => visit.id)
          ),
        ];

        const [
          vehiclesResult,
          intakeResult,
          surveysResult,
        ] = await Promise.all([
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
              `
            )
            .in("id", vehicleIds),

          supabase
            .from("vehicle_intake")
            .select(
              `
                visit_id,
                vehicle_id,
                insurance_type,
                mi_type_id,
                insurance_company_id,
                job_card_no
              `
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
              `
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

        const vehicles =
          (vehiclesResult.data || []) as Vehicle[];

        const intakes =
          (intakeResult.data || []) as Intake[];

        const surveys =
          (surveysResult.data || []) as Survey[];

        /*
         * Only the latest survey for each visit is needed.
         */
        const surveyMap = new Map<
          string,
          Survey
        >();

        surveys.forEach((survey) => {
          if (!surveyMap.has(survey.visit_id)) {
            surveyMap.set(
              survey.visit_id,
              survey
            );
          }
        });

        /*
         * Load only insurance companies actually used
         * by the vehicles in this queue.
         */
        const insuranceCompanyIds = [
          ...new Set(
            intakes
              .map(
                (item) =>
                  item.insurance_company_id
              )
              .filter(
                (id): id is string =>
                  Boolean(id)
              )
          ),
        ];

        /*
         * Load only MI types actually used
         * by the vehicles in this queue.
         */
        const miTypeIds = [
          ...new Set(
            intakes
              .map((item) => item.mi_type_id)
              .filter(
                (id): id is string =>
                  Boolean(id)
              )
          ),
        ];

        let insuranceCompanies: InsuranceCompany[] =
          [];

        let miTypes: MIType[] = [];

        if (insuranceCompanyIds.length > 0) {
          const {
            data,
            error,
          } = await supabase
            .from("insurance_companies")
            .select("id, name")
            .in(
              "id",
              insuranceCompanyIds
            );

          if (error) {
            throw error;
          }

          insuranceCompanies =
            (data || []) as InsuranceCompany[];
        }

        if (miTypeIds.length > 0) {
          const {
            data,
            error,
          } = await supabase
            .from("mi_types")
            .select("id, name")
            .in("id", miTypeIds);

          if (error) {
            throw error;
          }

          miTypes =
            (data || []) as MIType[];
        }

        const vehicleMap = new Map<
          string,
          Vehicle
        >();

        vehicles.forEach((vehicle) => {
          vehicleMap.set(
            vehicle.id,
            vehicle
          );
        });

        const intakeMap = new Map<
          string,
          Intake
        >();

        intakes.forEach((intake) => {
          intakeMap.set(
            intake.visit_id,
            intake
          );
        });

        const insuranceMap = new Map<
          string,
          InsuranceCompany
        >();

        insuranceCompanies.forEach(
          (company) => {
            insuranceMap.set(
              company.id,
              company
            );
          }
        );

        const miMap = new Map<
          string,
          MIType
        >();

        miTypes.forEach((miType) => {
          miMap.set(
            miType.id,
            miType
          );
        });

        const combined: Item[] = [];

        visits.forEach((visit) => {
          const vehicle =
            vehicleMap.get(
              visit.vehicle_id
            );

          if (!vehicle) {
            return;
          }

          const intake =
            intakeMap.get(visit.id) ||
            null;

          const survey =
            surveyMap.get(visit.id) ||
            null;

          const insuranceCompany =
            intake?.insurance_company_id
              ? insuranceMap.get(
                  intake.insurance_company_id
                ) || null
              : null;

          const miType =
            intake?.mi_type_id
              ? miMap.get(
                  intake.mi_type_id
                ) || null
              : null;

          combined.push({
            visit,
            vehicle,
            intake,
            survey,
            insuranceCompany,
            miType,
          });
        });

        setItems(combined);

        /*
         * CEO Admin sees advisor names.
         */
        if (profile.role === "ceo_admin") {
          const advisorIds = [
            ...new Set(
              visits
                .map(
                  (visit) =>
                    visit.current_assigned_to
                )
                .filter(
                  (
                    id
                  ): id is string =>
                    Boolean(id)
                )
            ),
          ];

          if (advisorIds.length > 0) {
            const {
              data,
              error,
            } = await supabase
              .from("profiles")
              .select("id, name")
              .in(
                "id",
                advisorIds
              );

            if (error) {
              throw error;
            }

            const names: Record<
              string,
              string
            > = {};

            (data || []).forEach(
              (advisor: Advisor) => {
                names[advisor.id] =
                  advisor.name?.trim() ||
                  "Advisor name unavailable";
              }
            );

            setAdvisorNames(names);
          } else {
            setAdvisorNames({});
          }
        } else {
          setAdvisorNames({});
        }

        setLastUpdated(new Date());
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const counts = useMemo(() => {
    const result: Record<
      Priority,
      number
    > = {
      Urgent: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };

    items.forEach((item) => {
      result[priority(days(item))]++;
    });

    return result;
  }, [items]);

  const filtered = useMemo(() => {
    const searchText =
      search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const vehicle =
          item.vehicle;

        const intake =
          item.intake;

        const insuranceCompany =
          item.insuranceCompany;

        const miType =
          item.miType;

        const matchesSearch =
          !searchText ||
          (
            vehicle.vehicle_no ||
            ""
          )
            .toLowerCase()
            .includes(searchText) ||
          (
            vehicle.customer_name ||
            ""
          )
            .toLowerCase()
            .includes(searchText) ||
          (
            vehicle.customer_mobile ||
            ""
          )
            .toLowerCase()
            .includes(searchText) ||
          (
            intake?.job_card_no ||
            ""
          )
            .toLowerCase()
            .includes(searchText) ||
          (
            insuranceCompany?.name ||
            ""
          )
            .toLowerCase()
            .includes(searchText) ||
          (
            miType?.name ||
            ""
          )
            .toLowerCase()
            .includes(searchText);

        const matchesPriority =
          filter === "All" ||
          priority(days(item)) ===
            filter;

        return (
          matchesSearch &&
          matchesPriority
        );
      })
      .sort((a, b) => {
        const priorityA =
          priority(days(a));

        const priorityB =
          priority(days(b));

        return (
          ORDER[priorityA] -
            ORDER[priorityB] ||
          days(b) - days(a) ||
          (
            a.vehicle.vehicle_no ||
            ""
          ).localeCompare(
            b.vehicle.vehicle_no ||
              ""
          )
        );
      });
  }, [items, search, filter]);

  const openApproval = (
    item: Item
  ) => {
    /*
     * The Approval Form will be created
     * in the next step.
     */
    router.push({
      pathname:
        "/(tabs)/advisor/approval_form",
      params: {
        visitId: item.visit.id,
        vehicleId:
          item.vehicle.id,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={s.container}
        edges={["top", "bottom"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={
            colors.background
          }
        />

        <View style={s.center}>
          <ActivityIndicator
            color={colors.primary}
            size="large"
          />

          <Text style={s.state}>
            Loading approval queue…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={s.container}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={
          colors.background
        }
      />

      <ScrollView
        contentContainerStyle={
          s.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              load(true)
            }
            tintColor={
              colors.primary
            }
          />
        }
      >
        {/* HEADER */}

        <View style={s.top}>
          <Pressable
            onPress={() =>
              router.replace(
                "/(tabs)/advisor"
              )
            }
            hitSlop={10}
          >
            <Text style={s.back}>
              ‹ Back
            </Text>
          </Pressable>

          <Text style={s.brand}>
            PAGARIYA
          </Text>
        </View>

        {/* HERO */}

        <View style={s.hero}>
          <Text style={s.eyebrow}>
            ADVISOR WORKSPACE
          </Text>

          <Text style={s.heading}>
            Pending Approval
          </Text>

          <Text style={s.sub}>
            {role === "ceo_admin"
              ? "Vehicles assigned to advisors and waiting for approval."
              : "Vehicles assigned to you and waiting for approval."}
          </Text>

          <View style={s.count}>
            <Text
              style={s.countText}
            >
              {items.length}{" "}
              {items.length === 1
                ? "vehicle"
                : "vehicles"}{" "}
              pending
            </Text>
          </View>

          {lastUpdated && (
            <Text style={s.updated}>
              Last updated:{" "}
              {lastUpdated.toLocaleTimeString(
                "en-IN",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                }
              )}
            </Text>
          )}
        </View>

        {/* ERROR */}

        {error !== "" && (
          <View style={s.error}>
            <Text
              style={s.errorTitle}
            >
              Couldn't load the queue
            </Text>

            <Text
              style={s.errorMsg}
            >
              {error}
            </Text>

            <Pressable
              onPress={() =>
                load(true)
              }
              style={s.smallButton}
            >
              <Text
                style={s.buttonText}
              >
                Try Again
              </Text>
            </Pressable>
          </View>
        )}

        {/* PRIORITY */}

        <View style={s.card}>
          <Text style={s.section}>
            Priority Overview
          </Text>

          <View style={s.grid}>
            <Tile
              p="All"
              n={items.length}
              selected={
                filter === "All"
              }
              onPress={() =>
                setFilter("All")
              }
            />

            <Tile
              p="Urgent"
              n={counts.Urgent}
              selected={
                filter === "Urgent"
              }
              onPress={() =>
                setFilter("Urgent")
              }
            />

            <Tile
              p="High"
              n={counts.High}
              selected={
                filter === "High"
              }
              onPress={() =>
                setFilter("High")
              }
            />

            <Tile
              p="Medium"
              n={counts.Medium}
              selected={
                filter === "Medium"
              }
              onPress={() =>
                setFilter("Medium")
              }
            />

            <Tile
              p="Low"
              n={counts.Low}
              selected={
                filter === "Low"
              }
              onPress={() =>
                setFilter("Low")
              }
            />
          </View>

          <Text style={s.note}>
            Priority is based on how long
            approval has been pending.
            Older approvals appear first
            within each priority level.
          </Text>
        </View>

        {/* SEARCH */}

        <View style={s.card}>
          <Text style={s.section}>
            Find a Vehicle
          </Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search registration, customer, mobile, JC no., insurance or MI type"
            placeholderTextColor={
              colors.textSecondary
            }
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            style={s.input}
          />
        </View>

        {/* EMPTY / VEHICLES */}

        {items.length === 0 &&
        !error ? (
          <Empty
            text={
              role === "ceo_admin"
                ? "There are currently no vehicles pending for approval."
                : "You currently have no vehicles pending for approval."
            }
            action="Refresh Queue"
            onPress={() =>
              load(true)
            }
          />
        ) : items.length > 0 &&
          !filtered.length ? (
          <Empty
            text="No vehicles match your search or selected priority. Try changing the filter or search term."
            action="Clear Search & Filter"
            onPress={() => {
              setSearch("");
              setFilter("All");
            }}
          />
        ) : (
          filtered.map((item) => {
            const pendingDays =
              days(item);

            const itemPriority =
              priority(
                pendingDays
              );

            const type =
              jobType(
                item.intake
                  ?.insurance_type
              );

            return (
              <View
                key={
                  item.visit.id
                }
                style={s.vehicle}
              >
                {/* VEHICLE HEADER */}

                <View
                  style={s.header}
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={s.small}
                    >
                      VEHICLE REGISTRATION
                    </Text>

                    <Text
                      style={s.reg}
                    >
                      {item.vehicle
                        .vehicle_no ||
                        "Registration unavailable"}
                    </Text>
                  </View>

                  <View
                    style={
                      s.pending
                    }
                  >
                    <Text
                      style={
                        s.pendingText
                      }
                    >
                      Pending Approval
                    </Text>
                  </View>
                </View>

                {/* PRIORITY / JOB TYPE */}

                <View
                  style={
                    s.priorityLine
                  }
                >
                  <Badge
                    p={
                      itemPriority
                    }
                  />

                  <Text
                    style={
                      s.pendingAge
                    }
                  >
                    {pendingDays}{" "}
                    {pendingDays ===
                    1
                      ? "day"
                      : "days"}{" "}
                    pending
                  </Text>

                  <View
                    style={[
                      s.jobBadge,
                      type ===
                      "PAID"
                        ? s.paid
                        : type ===
                          "INSURANCE"
                        ? s.insurance
                        : s.unknown,
                    ]}
                  >
                    <Text
                      style={[
                        s.jobText,
                        type ===
                        "PAID"
                          ? s.paidText
                          : type ===
                            "INSURANCE"
                          ? s.insuranceText
                          : s.unknownText,
                      ]}
                    >
                      {type}
                    </Text>
                  </View>
                </View>

                <View
                  style={s.sep}
                />

                {/* DETAILS */}

                <Info
                  label="Customer"
                  value={
                    item.vehicle
                      .customer_name
                  }
                />

                <Info
                  label="Mobile"
                  value={
                    item.vehicle
                      .customer_mobile
                  }
                />

                <Info
                  label="Vehicle"
                  value={[
                    item.vehicle
                      .arena_nexa,
                    item.vehicle
                      .model,
                  ]
                    .filter(Boolean)
                    .join(" · ") ||
                    null
                  }
                />

                <Info
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

                <Info
                  label="Job type"
                  value={type}
                />

                {type ===
                  "INSURANCE" && (
                  <>
                    <Info
                      label="MI / Non-MI"
                      value={
                        item.miType
                          ?.name ||
                        null
                      }
                    />

                    <Info
                      label="Insurance company"
                      value={
                        item
                          .insuranceCompany
                          ?.name ||
                        null
                      }
                    />
                  </>
                )}

                <Info
                  label="Job Card No."
                  value={
                    item.intake
                      ?.job_card_no ||
                    null
                  }
                />

                <Info
                  label="Survey completed"
                  value={
                    item.survey
                      ?.completed_at
                      ? dateText(
                          item
                            .survey
                            .completed_at
                        )
                      : null
                  }
                />

                {role ===
                  "ceo_admin" && (
                  <Info
                    label="Assigned advisor"
                    value={
                      item.visit
                        .current_assigned_to
                        ? advisorNames[
                            item.visit
                              .current_assigned_to
                          ] ||
                          "Advisor name unavailable"
                        : "Not assigned"
                    }
                  />
                )}

                <Info
                  label="Approval pending since"
                  value={dateText(
                    item.visit
                      .stage_started_at
                  )}
                />

                {/* OPEN */}

                <Pressable
                  onPress={() =>
                    openApproval(
                      item
                    )
                  }
                  style={s.open}
                >
                  <Text
                    style={
                      s.openText
                    }
                  >
                    Open Approval Form →
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}

        {/* PRIORITY GUIDE */}

        <View
          style={[
            s.card,
            s.guide,
          ]}
        >
          <Text
            style={s.section}
          >
            Automatic Priority Rules
          </Text>

          <Guide
            p="Urgent"
            t="7 or more days"
          />

          <Guide
            p="High"
            t="4–6 days"
          />

          <Guide
            p="Medium"
            t="2–3 days"
          />

          <Guide
            p="Low"
            t="0–1 day"
          />
        </View>

        <Text style={s.footer}>
          PAGARIYA AUTO • APPROVAL QUEUE
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({
  p,
  n,
  selected,
  onPress,
}: {
  p: Priority | "All";
  n: number;
  selected: boolean;
  onPress: () => void;
}) {
  const tone =
    p === "Urgent"
      ? s.urgent
      : p === "High"
      ? s.high
      : p === "Medium"
      ? s.medium
      : p === "Low"
      ? s.low
      : s.all;

  const toneText =
    p === "Urgent"
      ? s.urgentText
      : p === "High"
      ? s.highText
      : p === "Medium"
      ? s.mediumText
      : p === "Low"
      ? s.lowText
      : s.allText;

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.tile,
        tone,
        selected &&
          s.tileSelected,
      ]}
    >
      <Text
        style={s.tileLabel}
      >
        {p}
      </Text>

      <Text
        style={[
          s.tileCount,
          toneText,
        ]}
      >
        {n}
      </Text>

      {selected && (
        <Text
          style={
            s.selectedLabel
          }
        >
          Selected
        </Text>
      )}
    </Pressable>
  );
}

function Badge({
  p,
}: {
  p: Priority;
}) {
  const background =
    p === "Urgent"
      ? s.urgent
      : p === "High"
      ? s.high
      : p === "Medium"
      ? s.medium
      : s.low;

  const text =
    p === "Urgent"
      ? s.urgentText
      : p === "High"
      ? s.highText
      : p === "Medium"
      ? s.mediumText
      : s.lowText;

  return (
    <View
      style={[
        s.badge,
        background,
      ]}
    >
      <Text
        style={[
          s.badgeText,
          text,
        ]}
      >
        {p}
      </Text>
    </View>
  );
}

function Guide({
  p,
  t,
}: {
  p: Priority;
  t: string;
}) {
  return (
    <View style={s.guideRow}>
      <Badge p={p} />

      <Text
        style={s.guideText}
      >
        {t}
      </Text>
    </View>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <View style={s.info}>
      <Text style={s.label}>
        {label}
      </Text>

      <Text style={s.value}>
        {value?.trim() || "—"}
      </Text>
    </View>
  );
}

function Empty({
  text,
  action,
  onPress,
}: {
  text: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={s.empty}>
      <Text
        style={s.emptyTitle}
      >
        No pending approvals
      </Text>

      <Text
        style={s.emptyMsg}
      >
        {text}
      </Text>

      <Pressable
        onPress={onPress}
        style={s.smallButton}
      >
        <Text
          style={s.buttonText}
        >
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
    paddingBottom:
      spacing.xxl + 96,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  state: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  top: {
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
    color: "#FFF",
    marginTop: 8,
  },

  sub: {
    color: "#FFF0F0",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  count: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor:
      "rgba(255,255,255,0.17)",
  },

  countText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },

  updated: {
    color: "#FFF0F0",
    fontSize: 11,
    marginTop: 9,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  section: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  tile: {
    width: "30%",
    minWidth: "30%",
    flexGrow: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },

  tileSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },

  selectedLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 5,
  },

  all: {
    backgroundColor: "#F2F4F7",
  },

  allText: {
    color: colors.text,
  },

  urgent: {
    backgroundColor: "#FCE4E4",
  },

  high: {
    backgroundColor: "#FFF0DB",
  },

  medium: {
    backgroundColor: "#E8F1FF",
  },

  low: {
    backgroundColor: "#E7F6EC",
  },

  tileLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },

  tileCount: {
    fontSize: 23,
    fontWeight: "900",
    marginTop: 3,
  },

  urgentText: {
    color: "#B42318",
  },

  highText: {
    color: "#B54708",
  },

  mediumText: {
    color: "#175CD3",
  },

  lowText: {
    color: "#18794E",
  },

  note: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 11,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 13,
    fontSize: 14,
  },

  vehicle: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  small: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  reg: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 5,
  },

  pending: {
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

  badge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  pendingAge: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  jobBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  paid: {
    backgroundColor: "#E7F6EC",
  },

  insurance: {
    backgroundColor: "#E8F1FF",
  },

  unknown: {
    backgroundColor: "#F2F4F7",
  },

  jobText: {
    fontSize: 11,
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

  sep: {
    height: 1,
    backgroundColor:
      colors.divider,
    marginVertical: 14,
  },

  info: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 7,
    gap: 12,
  },

  label: {
    flex: 0.85,
    fontSize: 13,
    color: colors.textSecondary,
  },

  value: {
    flex: 1.4,
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
    textAlign: "right",
  },

  open: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  openText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },

  empty: {
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

  emptyMsg: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },

  smallButton: {
    marginTop: 18,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: colors.primary,
  },

  buttonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
  },

  error: {
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

  errorMsg: {
    color: "#912018",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  guide: {
    gap: 9,
  },

  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  guideText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
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