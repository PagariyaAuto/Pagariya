import { ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import BrandPill from "../../../components/navigation/BrandPill";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import FloorVehicleCard from "../../../components/FloorVehicleCard";
import { colors } from "../../../theme";

type FloorWorkItem = {
  id?: string;
  work_code?: string;
  work_name: string;
  status: string;
  started_by?: string | null;
  completed_by?: string | null;
};

type SupplementaryCycle = {
  id?: string;
  cycle_no: number;
  status: string;
  reason?: string | null;
};

type FloorCycle = {
  id: string;
  cycle_no: number;
  vehicle_in_at?: string | null;
};

type FloorVehicle = {
  visit_id: string;
  vehicle_id: string;

  vehicle_no: string;
  model: string | null;

  current_stage: string;
  current_status: string;

  job_id: string | null;
  job_type: string | null;

  stage_started_at?: string | null;
  floor_entered_at?: string | null;

  floor_cycle: FloorCycle | null;
  floor_items: FloorWorkItem[] | null;

  supplementary: SupplementaryCycle | null;
};

type FloorQueue = {
  role: string;
  items: FloorVehicle[];
};

type Filter = "ALL" | "PENDING" | "IN_PROGRESS" | "SUPPLEMENTARY" | "READY";

const filters: {
  value: Filter;
  title: string;
}[] = [
  {
    value: "ALL",
    title: "All",
  },
  {
    value: "PENDING",
    title: "Pending",
  },
  {
    value: "IN_PROGRESS",
    title: "In Progress",
  },
  {
    value: "READY",
    title: "Ready",
  },
  {
    value: "SUPPLEMENTARY",
    title: "Supplementary",
  },
];

function normalise(value?: string | null) {
  if (!value) return "";

  return value.replaceAll("_", " ");
}

function isSupplementaryActive(vehicle: FloorVehicle) {
  if (!vehicle.supplementary) {
    return false;
  }

  return !["RETURNED_TO_FLOOR", "CONTINUED_WITHOUT_SUPPLEMENTARY"].includes(
    vehicle.supplementary.status,
  );
}

function isReady(vehicle: FloorVehicle) {
  const items = vehicle.floor_items ?? [];

  if (
    vehicle.current_stage !== "FLOOR" ||
    isSupplementaryActive(vehicle) ||
    !items.length
  ) {
    return false;
  }

  return items.every((item) => item.status === "COMPLETED");
}

function workInProgress(vehicle: FloorVehicle) {
  return (
    vehicle.current_stage === "FLOOR" &&
    (vehicle.floor_items ?? []).some((item) => item.status === "IN_PROGRESS")
  );
}

export default function FloorInchargeDashboard() {
  const [queue, setQueue] = useState<FloorQueue>({
    role: "",
    items: [],
  });

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [filter, setFilter] = useState<Filter>("ALL");

  const [search, setSearch] = useState("");

  const fetchFloorQueue = useCallback(async (): Promise<FloorQueue> => {
    /*
     * This modern RPC already applies backend
     * assignment security.
     *
     * A floor_incharge can read only visits with an
     * active FLOOR_INCHARGE vehicle_assignment
     * assigned to auth.uid().
     *
     * Do not add a second frontend-only assignment
     * filter here.
     */
    const { data, error: queueError } = await supabase.rpc(
      "new_workflow_supplementary_queue",
      {
        p_floor: true,
      },
    );

    if (queueError) {
      throw queueError;
    }

    const result = data as FloorQueue;

    if (!result || !Array.isArray(result.items)) {
      throw new Error("Floor queue returned an invalid response.");
    }

    /*
     * Floor timing comes from the visit's current
     * stage entry time.
     */
    if (result.items.length) {
      const { data: visits, error: visitsError } = await supabase
        .from("workshop_visits")
        .select("id,stage_started_at,current_stage,current_status,closed_at")
        .in(
          "id",
          result.items.map((item) => item.visit_id),
        );

      if (visitsError) {
        throw visitsError;
      }

      const visitById = new Map(
        (visits ?? []).map((visit) => [visit.id, visit]),
      );

      result.items = result.items.map((item) => {
        const visit = visitById.get(item.visit_id);

        const stageStartedAt =
          visit?.stage_started_at ?? item.floor_cycle?.vehicle_in_at ?? null;

        return {
          ...item,

          current_stage: visit?.current_stage ?? item.current_stage,

          current_status: visit?.current_status ?? item.current_status,

          stage_started_at: stageStartedAt,

          floor_entered_at: stageStartedAt,
        };
      });
    }

    return result;
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result = await fetchFloorQueue();

        setQueue(result);
      } catch (e: any) {
        console.error("Failed to load Floor Incharge dashboard:", e);

        setError(
          e?.message ||
            "Unable to load your assigned Floor vehicles. Refresh and try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchFloorQueue],
  );

  useFocusEffect(
    useCallback(() => {
      void load();

      return undefined;
    }, [load]),
  );

  const counts = useMemo(() => {
    const all = queue.items;

    return {
      all: all.length,

      pending: all.filter((vehicle) => vehicle.current_status === "PENDING")
        .length,

      inProgress: all.filter(
        (vehicle) => vehicle.current_status === "IN_PROGRESS",
      ).length,

      activeWork: all.filter(workInProgress).length,

      supplementary: all.filter(isSupplementaryActive).length,

      ready: all.filter(isReady).length,
    };
  }, [queue.items]);

  const visibleVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return queue.items.filter((vehicle) => {
      const matchesSearch =
        !query ||
        [
          vehicle.vehicle_no,
          vehicle.model,
          vehicle.job_type,
          vehicle.supplementary?.reason,
        ].some((value) => value?.toLowerCase().includes(query));

      if (!matchesSearch) {
        return false;
      }

      if (filter === "PENDING") {
        return vehicle.current_status === "PENDING";
      }

      if (filter === "IN_PROGRESS") {
        return vehicle.current_status === "IN_PROGRESS";
      }

      if (filter === "SUPPLEMENTARY") {
        return isSupplementaryActive(vehicle);
      }

      if (filter === "READY") {
        return isReady(vehicle);
      }

      return true;
    });
  }, [filter, queue.items, search]);

  const filterCount = useCallback(
    (value: Filter) => {
      switch (value) {
        case "PENDING":
          return counts.pending;

        case "IN_PROGRESS":
          return counts.inProgress;

        case "SUPPLEMENTARY":
          return counts.supplementary;

        case "READY":
          return counts.ready;

        default:
          return counts.all;
      }
    },
    [counts],
  );

  const openVehicle = useCallback((vehicle: FloorVehicle) => {
    if (typeof vehicle.visit_id !== "string" || !vehicle.visit_id.trim()) {
      setError(
        "This vehicle is missing its workshop visit. Refresh the list or contact CEO Admin.",
      );
      return;
    }
    /*
     * visitId is the authoritative workflow
     * identifier for the modern Floor RPCs.
     */
    router.push({
      pathname: "/(tabs)/floor-incharge/vehicles" as any,

      params: {
        visitId: vehicle.visit_id.trim(),
      },
    });
  }, []);

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "right", "bottom", "left"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* TOP BAR */}

        <View style={styles.topBar}>
          <BrandPill />

          <TouchableOpacity
            onPress={() => void load(true)}
            disabled={refreshing}
            style={styles.refreshButton}
            accessibilityRole="button"
            accessibilityLabel="Refresh my assigned Floor vehicles"
          >
            <Ionicons name="refresh-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* HERO */}

        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroCircle} />

          <Text style={styles.workspacePill}>FLOOR INCHARGE WORKSPACE</Text>

          <Text style={styles.heroTitle}>My Assigned Vehicles</Text>

          <Text style={styles.heroDescription}>
            Manage only the vehicles currently assigned to you. Each vehicle
            shows only its approved Floor work for the active repair job.
          </Text>

          <View style={styles.heroStats}>
            <HeroStat value={counts.all} label="Assigned" />

            <View style={styles.heroDivider} />

            <HeroStat value={counts.inProgress} label="In progress" />

            <View style={styles.heroDivider} />

            <HeroStat value={counts.pending} label="Pending" />
          </View>
        </View>

        {/* OPERATIONAL SNAPSHOT */}

        <View style={styles.snapshotCard}>
          <Text style={styles.eyebrow}>MY FLOOR STATUS</Text>

          <Text style={styles.sectionTitle}>Work snapshot</Text>

          <Text style={styles.sectionHint}>
            These counts include only vehicles actively assigned to your Floor
            account.
          </Text>

          <View style={styles.snapshotGrid}>
            <Snapshot
              icon="construct-outline"
              value={counts.activeWork}
              label="Active repair work"
              description="Vehicles with work in progress"
              tone="blue"
            />

            <Snapshot
              icon="checkmark-circle-outline"
              value={counts.ready}
              label="Ready"
              description="Ready for mandatory Final Inspection"
              tone="green"
            />

            <Snapshot
              icon="repeat-outline"
              value={counts.supplementary}
              label="Supplementary"
              description="Temporarily outside Floor workflow"
              tone="orange"
            />
          </View>
        </View>

        {/* SUPPLEMENTARY NOTICE */}

        {!!counts.supplementary && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setFilter("SUPPLEMENTARY")}
            style={styles.supplementaryNotice}
          >
            <View style={styles.noticeIcon}>
              <Ionicons
                name="repeat-outline"
                size={20}
                color={colors.primary}
              />
            </View>

            <View style={styles.flex}>
              <Text style={styles.noticeTitle}>Supplementary activity</Text>

              <Text style={styles.noticeText}>
                {counts.supplementary}{" "}
                {counts.supplementary === 1
                  ? "assigned vehicle currently has"
                  : "assigned vehicles currently have"}{" "}
                an active Supplementary cycle.
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* ERROR */}

        {!!error && (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={colors.error}
              />
            </View>

            <View style={styles.flex}>
              <Text style={styles.errorTitle}>Unable to refresh Floor</Text>

              <Text style={styles.errorText}>{error}</Text>
            </View>

            <TouchableOpacity
              onPress={() => void load()}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FILTERS */}

        <View style={styles.filterSection}>
          <View>
            <Text style={styles.eyebrow}>MY WORK QUEUE</Text>

            <Text style={styles.sectionTitle}>Assigned Floor Vehicles</Text>

            <Text style={styles.sectionHint}>
              Filter your assigned vehicles by their current action state.
            </Text>
          </View>

          <View style={styles.filters}>
            {filters.map((item) => {
              const selected = filter === item.value;

              const count = filterCount(item.value);

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setFilter(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected,
                  }}
                  style={[styles.filter, selected && styles.filterSelected]}
                >
                  <Text
                    style={[
                      styles.filterText,

                      selected && styles.filterTextSelected,
                    ]}
                  >
                    {item.title}
                  </Text>

                  <View
                    style={[
                      styles.filterCount,

                      selected && styles.filterCountSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterCountText,

                        selected && styles.filterCountTextSelected,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SEARCH */}

        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>FIND AN ASSIGNED VEHICLE</Text>

          <Text style={styles.searchHint}>
            Search registration, model, job type or Supplementary reason.
          </Text>

          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textSecondary}
            />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search my Floor vehicles..."
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
            />

            {!!search && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* LIST HEADER */}

        <View style={styles.listHeader}>
          <View style={styles.flex}>
            <Text style={styles.listTitle}>
              Vehicles requiring my attention
            </Text>

            <Text style={styles.listSubtitle}>
              {visibleVehicles.length} matching{" "}
              {visibleVehicles.length === 1 ? "vehicle" : "vehicles"}
              {search.trim() ? " · Search applied" : ""}
            </Text>
          </View>

          <View style={styles.currentFilter}>
            <Text style={styles.currentFilterText}>
              {filters.find((item) => item.value === filter)?.title}
            </Text>
          </View>
        </View>

        {/* VEHICLES */}

        {loading && !queue.items.length ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />

            <Text style={styles.loadingText}>
              Loading my assigned Floor vehicles…
            </Text>
          </View>
        ) : !visibleVehicles.length ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="car-sport-outline"
                size={30}
                color={colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              {queue.items.length
                ? "No matching assigned vehicles"
                : "No Floor vehicles assigned to you"}
            </Text>

            <Text style={styles.emptyText}>
              {queue.items.length
                ? "No assigned vehicles currently match this filter or search."
                : "Vehicles will appear here after they are assigned to you for Floor work."}
            </Text>

            {(filter !== "ALL" || search.trim()) && (
              <TouchableOpacity
                onPress={() => {
                  setFilter("ALL");
                  setSearch("");
                }}
                style={styles.showAllButton}
              >
                <Text style={styles.showAllText}>Show all my vehicles</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.vehicleList}>
            {visibleVehicles.map((vehicle) => (
              <View key={vehicle.visit_id} style={styles.vehicleWrap}>
                {vehicle.supplementary &&
                  vehicle.current_stage === "FLOOR" &&
                  [
                    "RETURNED_TO_FLOOR",
                    "APPROVED",
                    "CONTINUED_WITHOUT_SUPPLEMENTARY",
                  ].includes(vehicle.supplementary.status) && (
                    <View style={styles.returnedBanner}>
                      <View style={styles.returnedIcon}>
                        <Ionicons
                          name="return-down-back-outline"
                          size={17}
                          color="#217A50"
                        />
                      </View>

                      <View style={styles.flex}>
                        <Text style={styles.returnedTitle}>
                          RETURNED FROM SUPPLEMENTARY
                        </Text>

                        <Text style={styles.returnedText}>
                          Supplementary cycle {vehicle.supplementary.cycle_no} ·{" "}
                          {normalise(vehicle.supplementary.status)}
                        </Text>
                      </View>
                    </View>
                  )}

                <FloorVehicleCard
                  vehicle={vehicle}
                  onPress={() => openVehicle(vehicle)}
                />
              </View>
            ))}
          </View>
        )}

        {/* INFO */}

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.textSecondary}
          />

          <Text style={styles.infoText}>
            You can open only vehicles assigned to your Floor account. Each
            vehicle uses its approved repair scope. Paid jobs may proceed
            without Stripping. When Stripping is included, complete it before
            other repair work. Raise Supplementary during any approved work in
            progress when additional repairs are discovered. Complete all
            approved work, then send every vehicle to mandatory Final
            Inspection.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>

      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function Snapshot({
  icon,
  value,
  label,
  description,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  description: string;
  tone: "blue" | "green" | "orange";
}) {
  const palette =
    tone === "green"
      ? {
          color: "#217A50",
          background: "#E8F5EE",
        }
      : tone === "orange"
        ? {
            color: "#B45309",
            background: "#FFF7ED",
          }
        : {
            color: "#2563EB",
            background: "#EFF6FF",
          };

  return (
    <View style={styles.snapshot}>
      <View
        style={[
          styles.snapshotIcon,
          {
            backgroundColor: palette.background,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={palette.color} />
      </View>

      <Text style={styles.snapshotValue}>{value}</Text>

      <Text style={styles.snapshotLabel}>{label}</Text>

      <Text style={styles.snapshotDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: colors.background,
  },

  content: {
    width: "100%",

    maxWidth: 860,

    alignSelf: "center",

    paddingHorizontal: 16,

    paddingTop: 4,

    paddingBottom: 34,

    gap: 16,
  },

  flex: {
    flex: 1,

    minWidth: 0,
  },

  topBar: {
    minHeight: 48,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  brand: {
    minHeight: 31,

    paddingHorizontal: 11,

    borderRadius: 999,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: "#E8E9EC",

    flexDirection: "row",

    alignItems: "center",

    gap: 6,
  },

  brandDot: {
    width: 6,

    height: 6,

    borderRadius: 3,

    backgroundColor: "#F20D1D",
  },

  brandText: {
    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 1.2,

    color: "#30343B",
  },

  refreshButton: {
    width: 42,

    height: 42,

    borderRadius: 13,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: "center",

    justifyContent: "center",
  },

  hero: {
    padding: 20,

    borderRadius: 18,

    backgroundColor: "#F20D1D",

    overflow: "hidden",

    gap: 11,

    shadowColor: "#F20D1D",

    shadowOpacity: 0.16,

    shadowRadius: 12,

    shadowOffset: {
      width: 0,

      height: 6,
    },

    elevation: 3,
  },

  heroCircle: {
    position: "absolute",

    width: 190,

    height: 190,

    borderRadius: 95,

    right: -60,

    top: -70,

    backgroundColor: "rgba(255,255,255,0.08)",
  },

  workspacePill: {
    alignSelf: "flex-start",

    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 999,

    backgroundColor: "rgba(255,255,255,0.16)",

    color: colors.white,

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 1,
  },

  heroTitle: {
    color: colors.white,

    fontSize: 29,

    fontWeight: "900",
  },

  heroDescription: {
    maxWidth: 580,

    color: "rgba(255,255,255,0.9)",

    fontSize: 14,

    lineHeight: 21,
  },

  heroStats: {
    paddingTop: 14,

    marginTop: 3,

    borderTopWidth: 1,

    borderTopColor: "rgba(255,255,255,0.2)",

    flexDirection: "row",

    alignItems: "center",

    flexWrap: "wrap",

    gap: 18,
  },

  heroStat: {
    minWidth: 76,
  },

  heroStatValue: {
    color: colors.white,

    fontSize: 22,

    fontWeight: "900",
  },

  heroStatLabel: {
    marginTop: 3,

    color: "rgba(255,255,255,0.84)",

    fontSize: 10,
  },

  heroDivider: {
    width: 1,

    height: 36,

    backgroundColor: "rgba(255,255,255,0.24)",
  },

  snapshotCard: {
    padding: 18,

    borderRadius: 18,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    gap: 7,
  },

  eyebrow: {
    color: colors.primary,

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 0.9,
  },

  sectionTitle: {
    color: colors.text,

    fontSize: 19,

    fontWeight: "800",
  },

  sectionHint: {
    color: colors.textSecondary,

    fontSize: 12,

    lineHeight: 19,
  },

  snapshotGrid: {
    marginTop: 9,

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 9,
  },

  snapshot: {
    minWidth: 130,

    flex: 1,

    padding: 13,

    borderRadius: 14,

    backgroundColor: colors.background,

    borderWidth: 1,

    borderColor: "#ECEDEF",
  },

  snapshotIcon: {
    width: 38,

    height: 38,

    borderRadius: 11,

    alignItems: "center",

    justifyContent: "center",
  },

  snapshotValue: {
    marginTop: 10,

    color: colors.text,

    fontSize: 22,

    fontWeight: "900",
  },

  snapshotLabel: {
    marginTop: 3,

    color: colors.text,

    fontSize: 12,

    fontWeight: "800",
  },

  snapshotDescription: {
    marginTop: 2,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 15,
  },

  supplementaryNotice: {
    padding: 14,

    borderRadius: 15,

    backgroundColor: "#FFF8F8",

    borderWidth: 1,

    borderColor: "#FDE5E7",

    flexDirection: "row",

    alignItems: "center",

    gap: 11,
  },

  noticeIcon: {
    width: 40,

    height: 40,

    borderRadius: 12,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  noticeTitle: {
    color: colors.text,

    fontSize: 13,

    fontWeight: "800",
  },

  noticeText: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  errorCard: {
    padding: 14,

    borderRadius: 15,

    backgroundColor: colors.dangerLight,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 10,
  },

  errorIcon: {
    paddingTop: 1,
  },

  errorTitle: {
    color: colors.error,

    fontSize: 13,

    fontWeight: "800",
  },

  errorText: {
    marginTop: 3,

    color: colors.error,

    fontSize: 11,

    lineHeight: 17,
  },

  retryText: {
    color: colors.primary,

    fontSize: 12,

    fontWeight: "900",
  },

  filterSection: {
    gap: 12,
  },

  filters: {
    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,
  },

  filter: {
    minHeight: 43,

    paddingHorizontal: 12,

    borderRadius: 12,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "center",

    gap: 7,
  },

  filterSelected: {
    backgroundColor: colors.primary,

    borderColor: colors.primary,
  },

  filterText: {
    color: colors.textSecondary,

    fontSize: 12,

    fontWeight: "700",
  },

  filterTextSelected: {
    color: colors.white,
  },

  filterCount: {
    minWidth: 22,

    paddingHorizontal: 6,

    paddingVertical: 2,

    borderRadius: 8,

    backgroundColor: colors.background,

    alignItems: "center",
  },

  filterCountSelected: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  filterCountText: {
    color: colors.textSecondary,

    fontSize: 10,

    fontWeight: "900",
  },

  filterCountTextSelected: {
    color: colors.white,
  },

  searchCard: {
    padding: 16,

    borderRadius: 18,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    gap: 5,
  },

  searchLabel: {
    color: colors.text,

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 0.9,
  },

  searchHint: {
    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  searchBox: {
    marginTop: 6,

    minHeight: 49,

    paddingHorizontal: 13,

    borderRadius: 14,

    backgroundColor: colors.background,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  searchInput: {
    flex: 1,

    minWidth: 0,

    minHeight: 47,

    color: colors.text,

    fontSize: 14,

    fontWeight: "600",
  },

  listHeader: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    flexWrap: "wrap",

    gap: 10,
  },

  listTitle: {
    color: colors.text,

    fontSize: 20,

    fontWeight: "800",
  },

  listSubtitle: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 11,
  },

  currentFilter: {
    paddingHorizontal: 10,

    paddingVertical: 7,

    borderRadius: 10,

    backgroundColor: colors.primaryLight,
  },

  currentFilterText: {
    color: colors.primaryDark,

    fontSize: 11,

    fontWeight: "800",
  },

  loadingCard: {
    minHeight: 190,

    alignItems: "center",

    justifyContent: "center",

    gap: 11,
  },

  loadingText: {
    color: colors.textSecondary,

    fontSize: 13,
  },

  emptyCard: {
    paddingHorizontal: 24,

    paddingVertical: 34,

    borderRadius: 18,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: "center",
  },

  emptyIcon: {
    width: 64,

    height: 64,

    borderRadius: 20,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",

    marginBottom: 14,
  },

  emptyTitle: {
    color: colors.text,

    fontSize: 18,

    fontWeight: "800",

    textAlign: "center",
  },

  emptyText: {
    marginTop: 7,

    maxWidth: 430,

    color: colors.textSecondary,

    fontSize: 13,

    lineHeight: 20,

    textAlign: "center",
  },

  showAllButton: {
    marginTop: 16,

    minHeight: 43,

    paddingHorizontal: 15,

    borderRadius: 11,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  showAllText: {
    color: colors.primaryDark,

    fontSize: 12,

    fontWeight: "800",
  },

  vehicleList: {
    gap: 13,
  },

  vehicleWrap: {
    gap: 7,
  },

  returnedBanner: {
    marginHorizontal: 5,

    marginBottom: -13,

    paddingHorizontal: 12,

    paddingTop: 10,

    paddingBottom: 20,

    borderTopLeftRadius: 13,

    borderTopRightRadius: 13,

    backgroundColor: "#E8F5EE",

    flexDirection: "row",

    alignItems: "center",

    gap: 9,
  },

  returnedIcon: {
    width: 31,

    height: 31,

    borderRadius: 10,

    backgroundColor: "#FFFFFF",

    alignItems: "center",

    justifyContent: "center",
  },

  returnedTitle: {
    color: "#217A50",

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.8,
  },

  returnedText: {
    marginTop: 2,

    color: "#39725A",

    fontSize: 10,

    lineHeight: 15,
  },

  infoCard: {
    padding: 14,

    borderRadius: 14,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 9,
  },

  infoText: {
    flex: 1,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 18,
  },
});
