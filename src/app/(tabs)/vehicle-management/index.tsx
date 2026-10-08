import { Modal, TextInput } from "../../../components/inputs/KeyboardAware";
import BackButton from "../../../components/navigation/BackButton";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";

type Vehicle = {
  id: string;
  vehicle_no: string;
  jc_no: string | null;
  model: string | null;
  arena_nexa: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_type: string | null;
  current_status: string;
  current_stage: string;
  current_assigned_to: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  stage_started_at: string;
};

type FilterType = "ALL" | "ACTIVE" | "COMPLETED";
type PriorityType = "ALL" | "URGENT" | "HIGH" | "MEDIUM" | "LOW";

const VEHICLES_PER_PAGE = 25;

const COLORS = {
  red: "#C62828",
  redDark: "#9E1F1F",
  redSoft: "#FDECEC",

  charcoal: "#171717",
  charcoalSoft: "#292929",

  background: "#F5F5F3",
  white: "#FFFFFF",

  text: "#171717",
  textSecondary: "#6B6B6B",
  textMuted: "#999999",

  border: "#E7E5E2",

  green: "#16845B",
  greenSoft: "#EAF7F1",

  orange: "#D97706",
  orangeSoft: "#FFF4E5",

  yellow: "#A16207",
  yellowSoft: "#FFF9E5",

  graySoft: "#F0F0EE",
};

const STAGES = [
  "PENDING_ADVISOR",
  "ADVISOR_ASSIGNED",
  "SURVEY",
  "APPROVAL",
  "FLOOR",
  "WORKSHOP",
  "READY",
  "BILLING",
  "READY_FOR_DELIVERY",
];

const STAGE_LABELS: Record<string, string> = {
  PENDING_ADVISOR: "Pending Advisor",
  ADVISOR_ASSIGNED: "Advisor Assigned",
  SURVEY: "Survey",
  APPROVAL: "Approval",
  FLOOR: "Floor",
  WORKSHOP: "Workshop",
  READY: "Ready",
  BILLING: "Billing",
  READY_FOR_DELIVERY: "Ready for Delivery",
};

const COMPLETED_STATUSES = [
  "completed",
  "complete",
  "delivered",
  "delivery_completed",
  "closed",
  "closed_job",
];

function isCompleted(vehicle: Vehicle) {
  return COMPLETED_STATUSES.includes(
    (vehicle.current_status || "").toLowerCase()
  );
}

/**
 * Priority is calculated from the exact stage_started_at timestamp.
 *
 * 7+ days  = URGENT
 * 4-6 days = HIGH
 * 2-3 days = MEDIUM
 * <2 days  = LOW
 */
function getPriority(vehicle: Vehicle): PriorityType {
  const timestamp = vehicle.stage_started_at || vehicle.created_at;

  const startDate = new Date(timestamp).getTime();

  if (Number.isNaN(startDate)) {
    return "LOW";
  }

  const diff = Math.max(0, Date.now() - startDate);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days >= 7) return "URGENT";
  if (days >= 4) return "HIGH";
  if (days >= 2) return "MEDIUM";

  return "LOW";
}

function getPriorityRank(priority: PriorityType) {
  switch (priority) {
    case "URGENT":
      return 1;
    case "HIGH":
      return 2;
    case "MEDIUM":
      return 3;
    case "LOW":
      return 4;
    default:
      return 99;
  }
}

function getPriorityColors(priority: PriorityType) {
  switch (priority) {
    case "URGENT":
      return {
        dot: COLORS.red,
        text: COLORS.red,
        background: COLORS.redSoft,
      };

    case "HIGH":
      return {
        dot: COLORS.orange,
        text: COLORS.orange,
        background: COLORS.orangeSoft,
      };

    case "MEDIUM":
      return {
        dot: COLORS.yellow,
        text: COLORS.yellow,
        background: COLORS.yellowSoft,
      };

    default:
      return {
        dot: COLORS.textMuted,
        text: COLORS.textSecondary,
        background: COLORS.graySoft,
      };
  }
}

function getStageProgress(stage: string, completed: boolean) {
  if (completed) return 100;

  const index = STAGES.indexOf(stage);

  if (index === -1) return 10;

  return Math.round(((index + 1) / STAGES.length) * 100);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatUpdated(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function VehicleManagementScreen() {
  const insets = useSafeAreaInsets();

  const topInset = Math.max(insets.top, 0);
  const bottomInset = Math.max(insets.bottom, 0);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityType>("ALL");

  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const loadVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase
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
          current_status,
          current_stage,
          current_assigned_to,
          remarks,
          created_at,
          updated_at,
          stage_started_at
        `
        )
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Vehicle load error:", error);
        return;
      }

      setVehicles((data || []) as Vehicle[]);
      setCurrentPage(1);
    } catch (error) {
      console.error("Unexpected vehicle load error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadVehicles();
  }, [loadVehicles]);

  const goHome = useCallback(() => {
    router.replace("/(tabs)");
  }, []);

  const openVehicleDetails = useCallback((vehicleId: string) => {
    router.push({
      pathname: "/(tabs)/vehicle-management/[vehicleId]",
      params: {
        vehicleId,
        returnTo: "vehicle-management",
      },
    });
  }, []);

  const counts = useMemo(() => {
    const completed = vehicles.filter(isCompleted).length;
    const active = vehicles.length - completed;

    const urgent = vehicles.filter(
      (vehicle) => getPriority(vehicle) === "URGENT"
    ).length;

    return {
      total: vehicles.length,
      active,
      completed,
      urgent,
    };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = vehicles.filter((vehicle) => {
      const completed = isCompleted(vehicle);

      if (filter === "ACTIVE" && completed) return false;

      if (filter === "COMPLETED" && !completed) return false;

      if (
        priorityFilter !== "ALL" &&
        getPriority(vehicle) !== priorityFilter
      ) {
        return false;
      }

      if (!query) return true;

      const searchableText = [
        vehicle.vehicle_no,
        vehicle.jc_no,
        vehicle.customer_name,
        vehicle.customer_mobile,
        vehicle.model,
        vehicle.arena_nexa,
        vehicle.vehicle_type,
        STAGE_LABELS[vehicle.current_stage],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });

    result.sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      const priorityDifference =
        getPriorityRank(priorityA) -
        getPriorityRank(priorityB);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const dateA = new Date(
        a.stage_started_at || a.created_at
      ).getTime();

      const dateB = new Date(
        b.stage_started_at || b.created_at
      ).getTime();

      const safeDateA = Number.isNaN(dateA)
        ? Infinity
        : dateA;

      const safeDateB = Number.isNaN(dateB)
        ? Infinity
        : dateB;

      return safeDateA - safeDateB;
    });

    return result;
  }, [vehicles, search, filter, priorityFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredVehicles.length / VEHICLES_PER_PAGE
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedVehicles = useMemo(() => {
    const startIndex =
      (safeCurrentPage - 1) *
      VEHICLES_PER_PAGE;

    const endIndex =
      startIndex + VEHICLES_PER_PAGE;

    return filteredVehicles.slice(
      startIndex,
      endIndex
    );
  }, [filteredVehicles, safeCurrentPage]);

  const showingStart =
    filteredVehicles.length === 0
      ? 0
      : (safeCurrentPage - 1) *
          VEHICLES_PER_PAGE +
        1;

  const showingEnd =
    filteredVehicles.length === 0
      ? 0
      : Math.min(
          safeCurrentPage * VEHICLES_PER_PAGE,
          filteredVehicles.length
        );

  const changeSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const changeFilter = (value: FilterType) => {
    setFilter(value);
    setCurrentPage(1);
  };

  const changePriorityFilter = (
    value: PriorityType
  ) => {
    setPriorityFilter(value);
    setCurrentPage(1);
    setFilterModalVisible(false);
  };

  const goToPreviousPage = () => {
    if (safeCurrentPage > 1) {
      setCurrentPage((page) => page - 1);
    }
  };

  const goToNextPage = () => {
    if (safeCurrentPage < totalPages) {
      setCurrentPage((page) => page + 1);
    }
  };

  const renderVehicle = ({
    item,
  }: {
    item: Vehicle;
  }) => {
    const completed = isCompleted(item);

    const priority = getPriority(item);

    const priorityColors =
      getPriorityColors(priority);

    const progress = getStageProgress(
      item.current_stage,
      completed
    );

    return (
      <Pressable
        style={({ pressed }) => [
          styles.vehicleCard,
          pressed && styles.vehicleCardPressed,
        ]}
        onPress={() =>
          openVehicleDetails(item.id)
        }
      >
        <View style={styles.vehicleTopRow}>
          <View style={styles.vehicleTitleArea}>
            <View style={styles.registrationRow}>
              <Text style={styles.registration}>
                {item.vehicle_no}
              </Text>

              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor:
                      priorityColors.background,
                  },
                ]}
              >
                <View
                  style={[
                    styles.priorityDot,
                    {
                      backgroundColor:
                        priorityColors.dot,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.priorityText,
                    {
                      color:
                        priorityColors.text,
                    },
                  ]}
                >
                  {priority}
                </Text>
              </View>
            </View>

            <Text
              style={styles.vehicleModel}
              numberOfLines={1}
            >
              {item.model ||
                "Vehicle model not available"}
            </Text>
          </View>

          <View
            style={[
              styles.statusIcon,
              completed
                ? styles.statusIconCompleted
                : styles.statusIconActive,
            ]}
          >
            <Ionicons
              name={
                completed
                  ? "checkmark"
                  : "car-outline"
              }
              size={17}
              color={
                completed
                  ? COLORS.green
                  : COLORS.red
              }
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              CUSTOMER
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={1}
            >
              {item.customer_name || "—"}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              JC NO.
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={1}
            >
              {item.jc_no || "—"}
            </Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              TYPE
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={1}
            >
              {item.arena_nexa ||
                item.vehicle_type ||
                "—"}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              UPDATED
            </Text>

            <Text style={styles.infoValue}>
              {formatUpdated(item.updated_at)}
            </Text>
          </View>
        </View>

        <View style={styles.stageSection}>
          <View style={styles.stageHeader}>
            <View style={styles.stageTitleRow}>
              <View
                style={[
                  styles.stageDot,
                  {
                    backgroundColor: completed
                      ? COLORS.green
                      : COLORS.red,
                  },
                ]}
              />

              <Text style={styles.stageLabel}>
                {completed
                  ? "Completed"
                  : STAGE_LABELS[
                      item.current_stage
                    ] ||
                    item.current_stage ||
                    "Unknown Stage"}
              </Text>
            </View>

            <Text style={styles.progressText}>
              {progress}%
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: completed
                    ? COLORS.green
                    : COLORS.red,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.stageStartedContainer}>
            <Text style={styles.stageStartedLabel}>
              STAGE STARTED
            </Text>

            <Text style={styles.stageStarted}>
              {formatDateTime(
                item.stage_started_at ||
                  item.created_at
              )}
            </Text>
          </View>

          <View style={styles.openDetails}>
            <Text style={styles.openDetailsText}>
              View details
            </Text>

            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.textSecondary}
            />
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom", "left", "right"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={COLORS.red}
          />

          <Text style={styles.loadingText}>
            Loading vehicles...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.container}>
        <FlatList
          data={paginatedVehicles}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicle}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: 14,
              paddingBottom:
                40 + bottomInset,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.red}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <BackButton onPress={goHome} hitSlop={10} />

                  <Text style={styles.eyebrow}>
                    PAGARIYA AUTO
                  </Text>

                  <Text style={styles.title}>
                    Vehicles
                  </Text>

                  <Text style={styles.subtitle}>
                    Track vehicles across the
                    complete workflow.
                  </Text>
                </View>

                <Pressable
                  style={styles.refreshButton}
                  onPress={onRefresh}
                  hitSlop={8}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={21}
                    color={COLORS.charcoal}
                  />
                </Pressable>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text
                    style={styles.summaryNumber}
                  >
                    {counts.total}
                  </Text>

                  <Text
                    style={styles.summaryLabel}
                  >
                    TOTAL
                  </Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text
                    style={[
                      styles.summaryNumber,
                      {
                        color: COLORS.red,
                      },
                    ]}
                  >
                    {counts.active}
                  </Text>

                  <Text
                    style={styles.summaryLabel}
                  >
                    ACTIVE
                  </Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text
                    style={[
                      styles.summaryNumber,
                      {
                        color: COLORS.green,
                      },
                    ]}
                  >
                    {counts.completed}
                  </Text>

                  <Text
                    style={styles.summaryLabel}
                  >
                    COMPLETED
                  </Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text
                    style={[
                      styles.summaryNumber,
                      {
                        color: COLORS.orange,
                      },
                    ]}
                  >
                    {counts.urgent}
                  </Text>

                  <Text
                    style={styles.summaryLabel}
                  >
                    URGENT
                  </Text>
                </View>
              </View>

              <View style={styles.searchContainer}>
                <Ionicons
                  name="search-outline"
                  size={21}
                  color={COLORS.textMuted}
                />

                <TextInput
                  value={search}
                  onChangeText={changeSearch}
                  placeholder="Search registration, JC, customer..."
                  placeholderTextColor={
                    COLORS.textMuted
                  }
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {search.length > 0 && (
                  <Pressable
                    onPress={() =>
                      changeSearch("")
                    }
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </Pressable>
                )}
              </View>

              <View style={styles.controlsRow}>
                <View
                  style={styles.segmentedControl}
                >
                  {(
                    [
                      "ALL",
                      "ACTIVE",
                      "COMPLETED",
                    ] as FilterType[]
                  ).map((item) => {
                    const selected =
                      filter === item;

                    return (
                      <Pressable
                        key={item}
                        onPress={() =>
                          changeFilter(item)
                        }
                        style={[
                          styles.segment,
                          selected &&
                            styles.segmentSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            selected &&
                              styles.segmentTextSelected,
                          ]}
                        >
                          {item === "ALL"
                            ? "All"
                            : item === "ACTIVE"
                            ? "Active"
                            : "Completed"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={[
                    styles.filterButton,
                    priorityFilter !== "ALL" &&
                      styles.filterButtonActive,
                  ]}
                  onPress={() =>
                    setFilterModalVisible(true)
                  }
                >
                  <Ionicons
                    name="options-outline"
                    size={19}
                    color={
                      priorityFilter !== "ALL"
                        ? COLORS.red
                        : COLORS.charcoal
                    }
                  />

                  <Text
                    style={[
                      styles.filterButtonText,
                      priorityFilter !==
                        "ALL" &&
                        styles.filterButtonTextActive,
                    ]}
                  >
                    Filter
                  </Text>

                  {priorityFilter !==
                    "ALL" && (
                    <View
                      style={styles.filterCount}
                    >
                      <Text
                        style={
                          styles.filterCountText
                        }
                      >
                        1
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>

              <View style={styles.resultRow}>
                <Text style={styles.resultText}>
                  {filteredVehicles.length} vehicle
                  {filteredVehicles.length ===
                  1
                    ? ""
                    : "s"}
                </Text>

                {(search ||
                  priorityFilter !==
                    "ALL") && (
                  <Pressable
                    onPress={() => {
                      changeSearch("");
                      changePriorityFilter(
                        "ALL"
                      );
                    }}
                  >
                    <Text
                      style={styles.clearText}
                    >
                      Clear filters
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          }
          ListFooterComponent={
            filteredVehicles.length > 0 ? (
              <View
                style={[
                  styles.paginationContainer,
                  {
                    paddingBottom:
                      Math.max(bottomInset, 8),
                  },
                ]}
              >
                <View style={styles.paginationInfo}>
                  <Text
                    style={
                      styles.paginationShowing
                    }
                  >
                    Showing{" "}
                    <Text
                      style={
                        styles.paginationStrong
                      }
                    >
                      {showingStart}–{showingEnd}
                    </Text>{" "}
                    of{" "}
                    <Text
                      style={
                        styles.paginationStrong
                      }
                    >
                      {filteredVehicles.length}
                    </Text>
                  </Text>

                  <Text
                    style={styles.pageNumber}
                  >
                    Page{" "}
                    <Text
                      style={
                        styles.paginationStrong
                      }
                    >
                      {safeCurrentPage}
                    </Text>{" "}
                    of{" "}
                    <Text
                      style={
                        styles.paginationStrong
                      }
                    >
                      {totalPages}
                    </Text>
                  </Text>
                </View>

                <View
                  style={styles.paginationButtons}
                >
                  <Pressable
                    onPress={
                      goToPreviousPage
                    }
                    disabled={
                      safeCurrentPage === 1
                    }
                    style={[
                      styles.paginationButton,
                      safeCurrentPage ===
                        1 &&
                        styles.paginationButtonDisabled,
                    ]}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={
                        safeCurrentPage === 1
                          ? COLORS.textMuted
                          : COLORS.charcoal
                      }
                    />

                    <Text
                      style={[
                        styles.paginationButtonText,
                        safeCurrentPage ===
                          1 &&
                          styles.paginationButtonTextDisabled,
                      ]}
                    >
                      Previous
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={goToNextPage}
                    disabled={
                      safeCurrentPage ===
                      totalPages
                    }
                    style={[
                      styles.paginationButton,
                      styles.paginationButtonNext,
                      safeCurrentPage ===
                        totalPages &&
                        styles.paginationButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.paginationButtonText,
                        styles.paginationButtonNextText,
                        safeCurrentPage ===
                          totalPages &&
                          styles.paginationButtonTextDisabled,
                      ]}
                    >
                      Next
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={
                        safeCurrentPage ===
                        totalPages
                          ? COLORS.textMuted
                          : COLORS.white
                      }
                    />
                  </Pressable>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="car-outline"
                  size={32}
                  color={COLORS.textMuted}
                />
              </View>

              <Text style={styles.emptyTitle}>
                No vehicles found
              </Text>

              <Text style={styles.emptyText}>
                Try changing your search or
                filters.
              </Text>
            </View>
          }
        />

        <Modal
          visible={filterModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setFilterModalVisible(false)
          }
        >
          <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() =>
              setFilterModalVisible(false)
            }
          >
            <Pressable
              style={[
                styles.filterSheet,
                {
                  paddingBottom:
                    30 + bottomInset,
                },
              ]}
              onPress={(event) =>
                event.stopPropagation()
              }
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View>
                  <Text
                    style={styles.sheetTitle}
                  >
                    Filter vehicles
                  </Text>

                  <Text
                    style={styles.sheetSubtitle}
                  >
                    Filter by workflow priority
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setFilterModalVisible(
                      false
                    )
                  }
                  style={styles.sheetClose}
                  hitSlop={8}
                >
                  <Ionicons
                    name="close"
                    size={21}
                    color={COLORS.charcoal}
                  />
                </Pressable>
              </View>

              {(
                [
                  "ALL",
                  "URGENT",
                  "HIGH",
                  "MEDIUM",
                  "LOW",
                ] as PriorityType[]
              ).map((priority) => {
                const selected =
                  priorityFilter ===
                  priority;

                return (
                  <Pressable
                    key={priority}
                    style={[
                      styles.filterOption,
                      selected &&
                        styles.filterOptionSelected,
                    ]}
                    onPress={() =>
                      changePriorityFilter(
                        priority
                      )
                    }
                  >
                    <View
                      style={
                        styles.filterOptionLeft
                      }
                    >
                      {priority === "ALL" ? (
                        <View
                          style={
                            styles.allPriorityIcon
                          }
                        >
                          <Ionicons
                            name="layers-outline"
                            size={18}
                            color={
                              COLORS.charcoal
                            }
                          />
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.priorityLargeDot,
                            {
                              backgroundColor:
                                getPriorityColors(
                                  priority
                                ).dot,
                            },
                          ]}
                        />
                      )}

                      <Text
                        style={[
                          styles.filterOptionText,
                          selected &&
                            styles.filterOptionTextSelected,
                        ]}
                      >
                        {priority === "ALL"
                          ? "All priorities"
                          : priority}
                      </Text>
                    </View>

                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={21}
                        color={COLORS.red}
                      />
                    )}
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },

  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 32,
    marginBottom: 7,
    paddingRight: 8,
  },

  backButtonText: {
    marginLeft: 2,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: COLORS.red,
    marginBottom: 4,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.charcoal,
    letterSpacing: -0.7,
  },

  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },

  summaryNumber: {
    fontSize: 21,
    fontWeight: "800",
    color: COLORS.charcoal,
  },

  summaryLabel: {
    marginTop: 3,
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: COLORS.textMuted,
  },

  searchContainer: {
    height: 52,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 12,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: COLORS.text,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  segmentedControl: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.graySoft,
    borderRadius: 12,
    padding: 3,
  },

  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 9,
  },

  segmentSelected: {
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },

  segmentText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },

  segmentTextSelected: {
    color: COLORS.charcoal,
  },

  filterButton: {
    height: 43,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  filterButtonActive: {
    borderColor: COLORS.red,
    backgroundColor: COLORS.redSoft,
  },

  filterButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.charcoal,
  },

  filterButtonTextActive: {
    color: COLORS.red,
  },

  filterCount: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },

  filterCountText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "800",
  },

  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },

  resultText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  clearText: {
    fontSize: 12,
    color: COLORS.red,
    fontWeight: "700",
  },

  vehicleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 10,
  },

  vehicleCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },

  vehicleTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  vehicleTitleArea: {
    flex: 1,
    paddingRight: 10,
  },

  registrationRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  registration: {
    fontSize: 19,
    fontWeight: "900",
    color: COLORS.charcoal,
    letterSpacing: 0.2,
  },

  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    gap: 4,
  },

  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  priorityText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  vehicleModel: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },

  statusIconActive: {
    backgroundColor: COLORS.redSoft,
  },

  statusIconCompleted: {
    backgroundColor: COLORS.greenSoft,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 13,
  },

  infoGrid: {
    flexDirection: "row",
    marginBottom: 10,
  },

  infoItem: {
    flex: 1,
    paddingRight: 8,
  },

  infoLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: COLORS.textMuted,
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
  },

  stageSection: {
    marginTop: 3,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  stageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },

  stageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  stageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },

  stageLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.charcoal,
  },

  progressText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textSecondary,
  },

  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.graySoft,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 12,
  },

  stageStartedContainer: {
    flex: 1,
    paddingRight: 10,
  },

  stageStartedLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: COLORS.textMuted,
    marginBottom: 3,
  },

  stageStarted: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  openDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  openDetailsText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },

  paginationContainer: {
    marginTop: 8,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  paginationInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  paginationShowing: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  paginationStrong: {
    fontWeight: "800",
    color: COLORS.charcoal,
  },

  pageNumber: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  paginationButtons: {
    flexDirection: "row",
    gap: 8,
  },

  paginationButton: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  paginationButtonNext: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },

  paginationButtonDisabled: {
    backgroundColor: COLORS.graySoft,
    borderColor: COLORS.border,
  },

  paginationButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.charcoal,
  },

  paginationButtonNextText: {
    color: COLORS.white,
  },

  paginationButtonTextDisabled: {
    color: COLORS.textMuted,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 70,
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: COLORS.graySoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.charcoal,
  },

  emptyText: {
    marginTop: 5,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  filterSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 30,
  },

  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D5D5D5",
    marginBottom: 18,
  },

  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.charcoal,
  },

  sheetSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.graySoft,
    justifyContent: "center",
    alignItems: "center",
  },

  filterOption: {
    minHeight: 52,
    borderRadius: 13,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },

  filterOptionSelected: {
    backgroundColor: COLORS.redSoft,
  },

  filterOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  filterOptionText: {
    marginLeft: 11,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.charcoal,
  },

  filterOptionTextSelected: {
    color: COLORS.red,
  },

  priorityLargeDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },

  allPriorityIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: COLORS.graySoft,
    justifyContent: "center",
    alignItems: "center",
  },
});