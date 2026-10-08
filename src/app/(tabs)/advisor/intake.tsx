import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import { router } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { colors, spacing, typography } from "../../../theme";

const LONG_WAIT_MINUTES = 30;
const PAGE_SIZE = 25;

type QueueFilter = "WAITING" | "ASSIGNED" | "ALL";

type Vehicle = {
  id: string;
  vehicle_no: string;
  current_stage: string;
  current_status: string | null;
  current_assigned_to: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_type: string | null;
  model: string | null;
  arena_nexa: string | null;
  gate_in_at: string | null;
  assigned_name: string | null;
  visit_id: string;
};

type Profile = {
  id: string;
  name: string | null;
};

type PopupType = "success" | "error" | "info" | "warning";

type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
};

const STAGE_LABELS: Record<string, string> = {
  PENDING_ADVISOR: "Waiting for advisor",
  ADVISOR_ASSIGNED: "Advisor assigned",
  VEHICLE_INTAKE: "Vehicle intake",
  CLAIM_INTIMATION: "Claim intimation",
  PENDING_SURVEY: "Pending survey",
  PENDING_APPROVAL: "Pending approval",
  APPROVAL_HOLD: "Approval hold",
  CLAIM_REJECTED: "Claim rejected",
  TOTAL_LOSS: "Total loss",
  ADVISOR_WORK: "Advisor work",
  STORE: "Store",
  FLOOR: "Floor",
  SUPPLEMENTARY_SURVEY: "Supplementary survey",
  SUPPLEMENTARY_APPROVAL: "Supplementary approval",
  FINAL_INSPECTION: "Final inspection",
  BILLING: "Billing",
  READY_FOR_DELIVERY: "Ready for delivery",
  PENDING_GATE_OUT: "Pending gate out",
  GATE_OUT: "Gate out",
};

function stageLabel(stage: string | null | undefined) {
  if (!stage) {
    return "Stage unavailable";
  }

  return (
    STAGE_LABELS[stage] ??
    stage
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

function formatGateIn(value: string | null) {
  if (!value) {
    return "Time unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getWaitMinutes(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const elapsed = Date.now() - timestamp;

  if (elapsed < 0) {
    return null;
  }

  return Math.floor(elapsed / 60000);
}

function formatWait(minutes: number | null) {
  if (minutes === null) {
    return "Waiting time unavailable";
  }

  if (minutes < 1) {
    return "Less than 1 min";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${minutes}m`;
}

function vehicleTypeLabel(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === "PRIVATE") {
    return "Private";
  }

  if (normalized === "COMMERCIAL") {
    return "Commercial";
  }

  return value;
}

function showPopup(
  type: PopupType,
  title: string,
  message: string
): PopupState {
  return {
    visible: true,
    type,
    title,
    message,
  };
}

export default function AdvisorIntakeScreen() {
  const handleNavigationBack = () => {
    returnToRoute("/(tabs)/advisor");
  };
  useHardwareBack(handleNavigationBack);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("WAITING");
  const [currentPage, setCurrentPage] = useState(1);

  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const loadInProgress = useRef(false);

  const closePopup = useCallback(() => {
    setPopup((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (loadInProgress.current) {
        return;
      }

      loadInProgress.current = true;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        setCurrentUserId(user.id);

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

        if (!profile || !profile.is_active) {
          setPopup(
            showPopup(
              "error",
              "Access error",
              "Your active profile could not be verified."
            )
          );
          return;
        }

        const admin = profile.role === "ceo_admin";

        if (!["advisor", "ceo_admin"].includes(profile.role)) {
          setPopup(
            showPopup(
              "error",
              "Access denied",
              "This screen is available only to Advisors and CEO Admin."
            )
          );

          setTimeout(() => {
            router.back();
          }, 250);

          return;
        }

        setIsAdmin(admin);

        /*
         * New workflow queue
         *
         * The authoritative workflow state comes from:
         *
         * workshop_visits
         *   ↓
         * current_stage
         * current_status
         * current_assigned_to
         *
         * We intentionally do not use:
         *
         * vehicles.current_stage
         * vehicle_events.GATE_IN
         *
         * for workflow decisions.
         */

        let visitQuery = supabase
          .from("workshop_visits")
          .select(
            "id, vehicle_id, current_stage, current_status, current_assigned_to"
          )
          .in("current_stage", [
            "PENDING_ADVISOR",
            "ADVISOR_ASSIGNED",
          ])
          .in("current_status", [
            "PENDING",
            "IN_PROGRESS",
            "ON_HOLD",
          ]);

        if (admin) {
          /*
           * CEO Admin can see:
           *
           * - all unassigned waiting vehicles
           * - all advisor-assigned intake vehicles
           */
          visitQuery = visitQuery.or(
            "and(current_stage.eq.PENDING_ADVISOR,current_assigned_to.is.null),current_stage.eq.ADVISOR_ASSIGNED"
          );
        } else {
          /*
           * Advisor can see:
           *
           * - all unassigned waiting vehicles
           * - only vehicles assigned to themselves
           */
          visitQuery = visitQuery.or(
            `and(current_stage.eq.PENDING_ADVISOR,current_assigned_to.is.null),and(current_stage.eq.ADVISOR_ASSIGNED,current_assigned_to.eq.${user.id})`
          );
        }

        const {
          data: visitData,
          error: visitError,
        } = await visitQuery;

        if (visitError) {
          throw visitError;
        }

        const visits = visitData ?? [];

        if (visits.length === 0) {
          setVehicles([]);
          return;
        }

        const vehicleIds = [
          ...new Set(
            visits
              .map((visit) => visit.vehicle_id)
              .filter(
                (id): id is string => Boolean(id)
              )
          ),
        ];

        const assignedIds = [
          ...new Set(
            visits
              .map(
                (visit) =>
                  visit.current_assigned_to
              )
              .filter(
                (id): id is string => Boolean(id)
              )
          ),
        ];

        /*
         * Load vehicle information separately.
         *
         * This avoids depending on an uncertain Supabase
         * foreign-key relationship between workshop_visits
         * and vehicles.
         */
        const {
          data: vehicleRows,
          error: vehicleError,
        } = await supabase
          .from("vehicles")
          .select(
            "id, vehicle_no, customer_name, customer_mobile, vehicle_type, model, arena_nexa"
          )
          .in("id", vehicleIds);

        if (vehicleError) {
          throw vehicleError;
        }

        const vehicleById: Record<
          string,
          any
        > = {};

        for (const vehicle of vehicleRows ?? []) {
          vehicleById[vehicle.id] = vehicle;
        }

        /*
         * Gate-In time comes from gate_entries.
         *
         * We load the latest Gate-In for each vehicle.
         */
        const latestGateInByVehicle: Record<
          string,
          string
        > = {};

        const {
          data: gateRows,
          error: gateError,
        } = await supabase
          .from("gate_entries")
          .select("vehicle_id, gate_in_at")
          .in("vehicle_id", vehicleIds)
          .order("gate_in_at", {
            ascending: false,
          });

        if (gateError) {
          throw gateError;
        }

        for (const gate of gateRows ?? []) {
          if (
            gate.vehicle_id &&
            gate.gate_in_at &&
            !latestGateInByVehicle[
              gate.vehicle_id
            ]
          ) {
            latestGateInByVehicle[
              gate.vehicle_id
            ] = gate.gate_in_at;
          }
        }

        /*
         * Advisor names are loaded separately so the queue
         * does not depend on a profile foreign-key join.
         */
        const profileNameById: Record<
          string,
          string
        > = {};

        if (assignedIds.length > 0) {
          const {
            data: assignedProfiles,
            error: assignedProfileError,
          } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", assignedIds);

          if (!assignedProfileError) {
            for (const assignedProfile of (assignedProfiles ??
              []) as Profile[]) {
              profileNameById[
                assignedProfile.id
              ] =
                assignedProfile.name?.trim() ||
                "Name unavailable";
            }
          }
        }

        const vehiclesWithDetails: Vehicle[] = [];

        for (const visit of visits) {
          const vehicle =
            vehicleById[visit.vehicle_id];

          if (!vehicle) {
            continue;
          }

          const assignedName =
            visit.current_assigned_to
              ? visit.current_assigned_to ===
                user.id
                ? "You"
                : profileNameById[
                    visit.current_assigned_to
                  ] ??
                  "Advisor name unavailable"
              : null;

          vehiclesWithDetails.push({
            id: vehicle.id,
            vehicle_no: vehicle.vehicle_no,
            current_stage:
              visit.current_stage,
            current_status:
              visit.current_status,
            current_assigned_to:
              visit.current_assigned_to,
            customer_name:
              vehicle.customer_name,
            customer_mobile:
              vehicle.customer_mobile,
            vehicle_type:
              vehicle.vehicle_type,
            model: vehicle.model,
            arena_nexa:
              vehicle.arena_nexa,
            gate_in_at:
              latestGateInByVehicle[
                visit.vehicle_id
              ] ?? null,
            assigned_name: assignedName,
            visit_id: visit.id,
          });
        }

        /*
         * Oldest Gate-In first.
         *
         * This makes vehicles waiting longest appear first.
         */
        vehiclesWithDetails.sort((a, b) => {
          if (
            !a.gate_in_at &&
            !b.gate_in_at
          ) {
            return 0;
          }

          if (!a.gate_in_at) {
            return 1;
          }

          if (!b.gate_in_at) {
            return -1;
          }

          return (
            new Date(
              a.gate_in_at
            ).getTime() -
            new Date(
              b.gate_in_at
            ).getTime()
          );
        });

        setVehicles(vehiclesWithDetails);
      } catch (error: any) {
        console.error(
          "Advisor intake load error:",
          error
        );

        setPopup(
          showPopup(
            "error",
            "Unable to load intake",
            error?.message ??
              "Could not load the latest vehicle intake queue."
          )
        );
      } finally {
        loadInProgress.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const waitingCount = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.current_stage ===
            "PENDING_ADVISOR" &&
          vehicle.current_assigned_to === null
      ).length,
    [vehicles]
  );

  const assignedCount = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.current_stage ===
            "ADVISOR_ASSIGNED" &&
          vehicle.current_assigned_to ===
            currentUserId
      ).length,
    [vehicles, currentUserId]
  );

  const filteredVehicles = useMemo(() => {
    if (filter === "WAITING") {
      return vehicles.filter(
        (vehicle) =>
          vehicle.current_stage ===
            "PENDING_ADVISOR" &&
          vehicle.current_assigned_to === null
      );
    }

    if (filter === "ASSIGNED") {
      return vehicles.filter(
        (vehicle) =>
          vehicle.current_stage ===
            "ADVISOR_ASSIGNED" &&
          vehicle.current_assigned_to ===
            currentUserId
      );
    }

    return vehicles;
  }, [
    vehicles,
    filter,
    currentUserId,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredVehicles.length /
        PAGE_SIZE
    )
  );

  const paginatedVehicles = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      PAGE_SIZE;

    return filteredVehicles.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [
    filteredVehicles,
    currentPage,
  ]);

  const pageStart =
    filteredVehicles.length === 0
      ? 0
      : (currentPage - 1) *
          PAGE_SIZE +
        1;

  const pageEnd = Math.min(
    currentPage * PAGE_SIZE,
    filteredVehicles.length
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, vehicles.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  const openVehicle = (
    vehicle: Vehicle
  ) => {
    /*
     * A normal advisor can open:
     *
     * PENDING_ADVISOR
     * or
     * ADVISOR_ASSIGNED to themselves.
     *
     * CEO Admin can review any advisor assignment.
     */
    if (
      vehicle.current_stage ===
        "ADVISOR_ASSIGNED" &&
      vehicle.current_assigned_to !==
        currentUserId &&
      !isAdmin
    ) {
      setPopup(
        showPopup(
          "warning",
          "Vehicle assigned to another advisor",
          `This vehicle is assigned to ${
            vehicle.assigned_name ??
            "another advisor"
          }.`
        )
      );
      return;
    }

    /*
     * The new intake form receives:
     *
     * vehicleId → vehicle record
     * visitId   → exact workshop visit/workflow instance
     *
     * No assignment is performed here.
     *
     * For a waiting vehicle, the intake form will perform
     * the Save & Accept operation through the backend RPC.
     */
    router.push({
      pathname:
        "/(tabs)/advisor/intake-form",
      params: {
        vehicleId: vehicle.id,
        visitId: vehicle.visit_id,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={
            colors.background
          }
        />

        <View
          style={styles.loadingContainer}
        >
          <View
            style={styles.loadingIcon}
          >
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
          </View>

          <Text
            style={styles.loadingTitle}
          >
            Loading vehicle intake
          </Text>

          <Text
            style={styles.loadingSubtitle}
          >
            Fetching the latest vehicle
            queue…
          </Text>
        </View>

        <PopupModal
          popup={popup}
          onClose={closePopup}
        />
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
        backgroundColor={
          colors.background
        }
      />

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadData(true)
            }
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.topBar}>
          <BackButton onPress={handleNavigationBack} />

          <BrandPill />
        </View>

        <View
          style={styles.heroCard}
        >
          <View
            style={styles.heroCircleOne}
          />

          <View
            style={styles.heroCircleTwo}
          />

          <View
            style={styles.heroContent}
          >
            <View
              style={styles.heroLabel}
            >
              <Text
                style={
                  styles.heroLabelText
                }
              >
                {isAdmin
                  ? "CEO ADMIN WORKSPACE"
                  : "ADVISOR WORKSPACE"}
              </Text>
            </View>

            <Text
              style={styles.heroTitle}
            >
              Vehicle Intake
            </Text>

            <Text
              style={
                styles.heroSubtitle
              }
            >
              Review incoming vehicles,
              see their assignment status,
              and open the intake form
              when you are ready to
              continue.
            </Text>

            <View
              style={styles.heroStats}
            >
              <View
                style={styles.heroStat}
              >
                <Text
                  style={
                    styles.heroStatNumber
                  }
                >
                  {waitingCount}
                </Text>

                <Text
                  style={
                    styles.heroStatLabel
                  }
                >
                  Waiting
                </Text>
              </View>

              <View
                style={
                  styles.heroStatDivider
                }
              />

              <View
                style={styles.heroStat}
              >
                <Text
                  style={
                    styles.heroStatNumber
                  }
                >
                  {assignedCount}
                </Text>

                <Text
                  style={
                    styles.heroStatLabel
                  }
                >
                  Assigned to you
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={styles.sectionHeader}
        >
          <View
            style={
              styles.sectionHeadingGroup
            }
          >
            <Text
              style={styles.sectionTitle}
            >
              Vehicles for intake
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              View the assigned advisor
              and the vehicle’s current
              workflow stage.
            </Text>
          </View>

          <Pressable
            onPress={() =>
              loadData(true)
            }
            disabled={refreshing}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed &&
                styles.pressed,
            ]}
          >
            {refreshing ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />
            ) : (
              <Text
                style={
                  styles.refreshText
                }
              >
                ↻ Refresh
              </Text>
            )}
          </Pressable>
        </View>

        <View
          style={styles.filterRow}
        >
          {(
            [
              [
                "WAITING",
                `Waiting (${waitingCount})`,
              ],
              [
                "ASSIGNED",
                `Assigned (${assignedCount})`,
              ],
              [
                "ALL",
                `All Intake Vehicles (${vehicles.length})`,
              ],
            ] as [
              QueueFilter,
              string
            ][]
          ).map(
            ([value, label]) => (
              <Pressable
                key={value}
                onPress={() => {
                  setFilter(value);
                  setCurrentPage(1);
                }}
                style={({
                  pressed,
                }) => [
                  styles.filterChip,
                  filter === value &&
                    styles.filterChipSelected,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter ===
                      value &&
                      styles.filterChipTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {filteredVehicles.length ===
        0 ? (
          <View
            style={styles.emptyCard}
          >
            <View
              style={
                styles.emptyIconCircle
              }
            >
              <Text
                style={styles.emptyIcon}
              >
                ✓
              </Text>
            </View>

            <Text
              style={styles.emptyTitle}
            >
              {filter === "WAITING"
                ? "No vehicles waiting"
                : filter === "ASSIGNED"
                  ? "No vehicles assigned to you"
                  : "No intake vehicles available"}
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              {filter === "WAITING"
                ? "There are no unassigned vehicles waiting for intake right now."
                : filter === "ASSIGNED"
                  ? "You don’t currently have any vehicles assigned to you in this intake queue."
                  : "There are no waiting or advisor-assigned vehicles available in this queue."}
            </Text>

            <Pressable
              onPress={() =>
                loadData(true)
              }
              disabled={refreshing}
              style={({ pressed }) => [
                styles.emptyRefreshButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              {refreshing ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              ) : (
                <Text
                  style={
                    styles.emptyRefreshText
                  }
                >
                  Refresh vehicles
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <>
            <View
              style={styles.vehicleList}
            >
              {paginatedVehicles.map(
                (vehicle) => {
                  const isWaiting =
                    vehicle.current_stage ===
                    "PENDING_ADVISOR";

                  const waitMinutes =
                    getWaitMinutes(
                      vehicle.gate_in_at
                    );

                  const isLongWait =
                    isWaiting &&
                    waitMinutes !== null &&
                    waitMinutes >=
                      LONG_WAIT_MINUTES;

                  const assignedToCurrentUser =
                    vehicle.current_assigned_to ===
                    currentUserId;

                  const assignmentText =
                    isWaiting
                      ? "Not assigned yet"
                      : vehicle.assigned_name ??
                        (assignedToCurrentUser
                          ? "You"
                          : "Advisor name unavailable");

                  const vehicleDescription =
                    [
                      vehicle.arena_nexa,
                      vehicle.model,
                      vehicleTypeLabel(
                        vehicle.vehicle_type
                      ),
                    ]
                      .filter(Boolean)
                      .join(" • ");

                  return (
                    <Pressable
                      key={
                        vehicle.visit_id
                      }
                      onPress={() =>
                        openVehicle(
                          vehicle
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.vehicleCard,
                        isLongWait &&
                          styles.vehicleCardLongWait,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <View
                        style={
                          styles.vehicleCardTop
                        }
                      >
                        <View
                          style={
                            styles.vehicleIconBox
                          }
                        >
                          <Text
                            style={
                              styles.vehicleIcon
                            }
                          >
                            ▰
                          </Text>
                        </View>

                        <View
                          style={
                            styles.vehicleMainInfo
                          }
                        >
                          <Text
                            style={
                              styles.vehicleNumber
                            }
                          >
                            {
                              vehicle.vehicle_no
                            }
                          </Text>

                          <Text
                            style={
                              styles.vehicleCaption
                            }
                          >
                            {isWaiting
                              ? "New arrival"
                              : "Intake assigned"}
                          </Text>
                        </View>

                        {isWaiting ? (
                          <View
                            style={[
                              styles.statusBadge,
                              styles.waitingBadge,
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                styles.waitingDot,
                              ]}
                            />

                            <Text
                              style={[
                                styles.statusText,
                                styles.waitingText,
                              ]}
                            >
                              Waiting
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={
                              styles.assignmentBadgeGroup
                            }
                          >
                            <View
                              style={[
                                styles.statusBadge,
                                styles.assignedBadge,
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusDot,
                                  styles.assignedDot,
                                ]}
                              />

                              <Text
                                style={[
                                  styles.statusText,
                                  styles.assignedText,
                                ]}
                              >
                                Assigned
                              </Text>
                            </View>

                            <Text
                              style={[
                                styles.assignedAdvisorName,
                                assignedToCurrentUser &&
                                  styles.currentAdvisorName,
                              ]}
                              numberOfLines={
                                1
                              }
                            >
                              {
                                assignmentText
                              }
                            </Text>
                          </View>
                        )}
                      </View>

                      <View
                        style={
                          styles.stagePanel
                        }
                      >
                        <Text
                          style={
                            styles.stageLabel
                          }
                        >
                          CURRENT WORKFLOW
                          STAGE
                        </Text>

                        <Text
                          style={
                            styles.stageValue
                          }
                        >
                          {stageLabel(
                            vehicle.current_stage
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.vehicleDetails
                        }
                      >
                        <View
                          style={
                            styles.detailLine
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Assigned to
                          </Text>

                          <Text
                            style={[
                              styles.detailValue,
                              isWaiting &&
                                styles.unassignedValue,
                            ]}
                          >
                            {
                              assignmentText
                            }
                          </Text>
                        </View>

                        <View
                          style={
                            styles.detailLine
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Gate In
                          </Text>

                          <Text
                            style={
                              styles.detailValue
                            }
                          >
                            {formatGateIn(
                              vehicle.gate_in_at
                            )}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.detailLine
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Waiting time
                          </Text>

                          <Text
                            style={[
                              styles.detailValue,
                              isLongWait &&
                                styles.longWaitText,
                            ]}
                          >
                            {formatWait(
                              waitMinutes
                            )}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.detailLine
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Customer
                          </Text>

                          <Text
                            style={
                              styles.detailValue
                            }
                          >
                            {vehicle.customer_name ||
                              "Not entered yet"}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.detailLine
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Vehicle
                          </Text>

                          <Text
                            style={
                              styles.detailValue
                            }
                          >
                            {vehicleDescription ||
                              "Vehicle details not entered yet"}
                          </Text>
                        </View>
                      </View>

                      {isLongWait && (
                        <View
                          style={
                            styles.longWaitBanner
                          }
                        >
                          <Text
                            style={
                              styles.longWaitBannerText
                            }
                          >
                            Long wait · Please
                            review this arrival
                          </Text>
                        </View>
                      )}

                      <View
                        style={
                          styles.vehicleCardBottom
                        }
                      >
                        <Text
                          style={
                            styles.vehicleHint
                          }
                        >
                          {isWaiting
                            ? "Open to enter details and accept this vehicle"
                            : isAdmin &&
                                !assignedToCurrentUser
                              ? `Assigned to ${assignmentText}`
                              : "Open to review details and continue"}
                        </Text>

                        <View
                          style={
                            styles.vehicleAction
                          }
                        >
                          <Text
                            style={
                              styles.vehicleActionText
                            }
                          >
                            Open →
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                }
              )}
            </View>

            {filteredVehicles.length >
              PAGE_SIZE && (
              <View
                style={
                  styles.paginationContainer
                }
              >
                <Text
                  style={
                    styles.paginationInfo
                  }
                >
                  Showing {pageStart}–
                  {pageEnd} of{" "}
                  {
                    filteredVehicles.length
                  }{" "}
                  vehicles
                </Text>

                <View
                  style={
                    styles.paginationButtons
                  }
                >
                  <Pressable
                    disabled={
                      currentPage <= 1
                    }
                    onPress={() =>
                      setCurrentPage(
                        (page) =>
                          Math.max(
                            1,
                            page - 1
                          )
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.paginationButton,
                      currentPage <=
                        1 &&
                        styles.paginationButtonDisabled,
                      pressed &&
                        currentPage >
                          1 &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.paginationButtonText,
                        currentPage <=
                          1 &&
                          styles.paginationButtonTextDisabled,
                      ]}
                    >
                      ‹ Previous
                    </Text>
                  </Pressable>

                  <Text
                    style={
                      styles.paginationPage
                    }
                  >
                    Page {currentPage} of{" "}
                    {totalPages}
                  </Text>

                  <Pressable
                    disabled={
                      currentPage >=
                      totalPages
                    }
                    onPress={() =>
                      setCurrentPage(
                        (page) =>
                          Math.min(
                            totalPages,
                            page + 1
                          )
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.paginationButton,
                      currentPage >=
                        totalPages &&
                        styles.paginationButtonDisabled,
                      pressed &&
                        currentPage <
                          totalPages &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.paginationButtonText,
                        currentPage >=
                          totalPages &&
                          styles.paginationButtonTextDisabled,
                      ]}
                    >
                      Next ›
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}

        <View
          style={styles.bottomNote}
        >
          <View
            style={
              styles.bottomNoteIcon
            }
          >
            <Text
              style={
                styles.bottomNoteIconText
              }
            >
              i
            </Text>
          </View>

          <Text
            style={styles.bottomNoteText}
          >
            Vehicles are ordered by
            their latest Gate In time.
            Arrivals waiting{" "}
            {`${LONG_WAIT_MINUTES} minutes or longer `}
            are highlighted. Advisors
            see unassigned waiting
            vehicles and their own
            assigned vehicles. CEO Admin
            can review advisor assignments
            across the intake queue.
          </Text>
        </View>

        <Text
          style={styles.footerText}
        >
          PAGARIYA AUTO • ADVISOR
          WORKSPACE
        </Text>
      </ScrollView>

      <PopupModal
        popup={popup}
        onClose={closePopup}
      />
    </SafeAreaView>
  );
}

function PopupModal({
  popup,
  onClose,
}: {
  popup: PopupState;
  onClose: () => void;
}) {
  if (!popup.visible) {
    return null;
  }

  const icon =
    popup.type === "success"
      ? "✓"
      : popup.type === "error"
        ? "!"
        : popup.type === "warning"
          ? "!"
          : "i";

  const iconBackground =
    popup.type === "success"
      ? colors.successLight
      : popup.type === "error"
        ? colors.dangerLight
        : popup.type === "warning"
          ? colors.warningLight
          : colors.infoLight;

  const iconColor =
    popup.type === "success"
      ? colors.success
      : popup.type === "error"
        ? colors.danger
        : popup.type === "warning"
          ? colors.warning
          : colors.info;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
      <View
        style={styles.modalOverlay}
      >
        <View
          style={styles.popupCard}
        >
          <View
            style={[
              styles.popupIcon,
              {
                backgroundColor:
                  iconBackground,
              },
            ]}
          >
            <Text
              style={[
                styles.popupIconText,
                {
                  color: iconColor,
                },
              ]}
            >
              {icon}
            </Text>
          </View>

          <Text
            style={styles.popupTitle}
          >
            {popup.title}
          </Text>

          <Text
            style={styles.popupMessage}
          >
            {popup.message}
          </Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.popupButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.popupButtonText
              }
            >
              OK
            </Text>
          </Pressable>
        </View>
      </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
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
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },

  backArrow: {
    fontSize: 30,
    lineHeight: 32,
    color: colors.primary,
    marginRight: spacing.xs,
  },

  backText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },

  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 7,
  },

  brandText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.text,
  },

  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    overflow: "hidden",
    position: "relative",
    shadowColor: colors.primaryDark,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },

  heroCircleOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor:
      "rgba(255,255,255,0.07)",
    top: -85,
    right: -55,
  },

  heroCircleTwo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor:
      "rgba(255,255,255,0.06)",
    bottom: -80,
    right: 45,
  },

  heroContent: {
    zIndex: 1,
  },

  heroLabel: {
    alignSelf: "flex-start",
    backgroundColor:
      "rgba(255,255,255,0.17)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: spacing.md,
  },

  heroLabelText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#FFFFFF",
  },

  heroTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: spacing.sm,
  },

  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.88)",
    maxWidth: 400,
  },

  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor:
      "rgba(255,255,255,0.22)",
  },

  heroStat: {
    paddingRight: spacing.lg,
  },

  heroStatNumber: {
    fontSize: 23,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },

  heroStatLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.82)",
  },

  heroStatDivider: {
    height: 34,
    width: 1,
    backgroundColor:
      "rgba(255,255,255,0.25)",
    marginRight: spacing.lg,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },

  sectionHeadingGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: 4,
  },

  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  refreshButton: {
    minHeight: 36,
    minWidth: 82,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },

  refreshText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },

  filterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  filterChipText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  filterChipTextSelected: {
    color: "#FFFFFF",
  },

  vehicleList: {
    gap: spacing.sm,
  },

  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.045,
    shadowRadius: 7,
    elevation: 2,
  },

  vehicleCardLongWait: {
    borderColor: "#F59E0B",
  },

  vehicleCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  vehicleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  vehicleIcon: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: "800",
  },

  vehicleMainInfo: {
    flex: 1,
    minWidth: 0,
  },

  vehicleNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
    letterSpacing: 0.3,
  },

  vehicleCaption: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  assignmentBadgeGroup: {
    alignItems: "flex-end",
    maxWidth: 145,
    marginLeft: spacing.xs,
  },

  assignedAdvisorName: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    marginTop: 5,
    maxWidth: 145,
    textAlign: "right",
  },

  currentAdvisorName: {
    color: colors.success,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },

  waitingBadge: {
    backgroundColor: colors.warningLight,
  },

  assignedBadge: {
    backgroundColor: colors.successLight,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  waitingDot: {
    backgroundColor: colors.warning,
  },

  assignedDot: {
    backgroundColor: colors.success,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  waitingText: {
    color: "#92400E",
  },

  assignedText: {
    color: "#166534",
  },

  stagePanel: {
    backgroundColor: colors.primaryLight,
    borderRadius: 11,
    padding: spacing.md,
    marginTop: spacing.md,
  },

  stageLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: colors.primaryDark,
    marginBottom: 5,
  },

  stageValue: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },

  vehicleDetails: {
    backgroundColor: colors.background,
    borderRadius: 11,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  detailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },

  detailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 0.8,
  },

  detailValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
    flex: 1.5,
    textAlign: "right",
  },

  unassignedValue: {
    color: "#B45309",
    fontWeight: "800",
  },

  longWaitText: {
    color: "#B45309",
    fontWeight: "800",
  },

  longWaitBanner: {
    backgroundColor: colors.warningLight,
    borderRadius: 9,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },

  longWaitBannerText: {
    ...typography.caption,
    color: "#92400E",
    fontWeight: "800",
  },

  vehicleCardBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },

  vehicleHint: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },

  vehicleAction: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 9,
  },

  vehicleActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },

  paginationContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.md,
  },

  paginationInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },

  paginationButtons: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },

  paginationButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  paginationButtonDisabled: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },

  paginationButtonText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },

  paginationButtonTextDisabled: {
    color: colors.textLight,
  },

  paginationPage: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.text,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
  },

  emptyIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  emptyIcon: {
    fontSize: 27,
    color: colors.success,
    fontWeight: "800",
  },

  emptyTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: "center",
  },

  emptyDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: spacing.lg,
  },

  emptyRefreshButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  emptyRefreshText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  bottomNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.infoLight,
    borderRadius: 13,
    padding: spacing.md,
    marginTop: spacing.xl,
  },

  bottomNoteIcon: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.info,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    marginTop: 1,
  },

  bottomNoteIconText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  bottomNoteText: {
    ...typography.caption,
    color: colors.info,
    lineHeight: 19,
    flex: 1,
  },

  footerText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textLight,
    textAlign: "center",
    marginTop: spacing.xl,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    elevation: 3,
  },

  loadingTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  loadingSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  popupCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  popupIconText: {
    fontSize: 28,
    fontWeight: "900",
  },

  popupTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  popupMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: spacing.lg,
  },

  popupButton: {
    width: "100%",
    minHeight: 46,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },

  popupButtonText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.82,
  },
});