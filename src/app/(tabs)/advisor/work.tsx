import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { colors, spacing } from "../../../theme";

type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

type Vehicle = {
  id: string;
  vehicle_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  model: string | null;
  arena_nexa: string | null;
  vehicle_type: string | null;
  current_status: string | null;
  current_stage: string | null;
  current_assigned_to: string | null;
  stage_started_at: string | null;
};

type Visit = {
  id: string;
  vehicle_id: string;
  current_stage: string | null;
  current_status: string | null;
  current_assigned_to: string | null;
  stage_started_at: string | null;
  created_at: string | null;
  vehicle: Vehicle | null;
};

type WorkItem = {
  visit: Visit;
  vehicle: Vehicle;
  priority: Priority;
  waitingMinutes: number;
};

type PopupType = "success" | "error" | "info";

type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
};

type FilterType = "ALL" | Priority;

const PAGE_SIZE = 25;

const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function getWaitingMinutes(startedAt: string | null) {
  if (!startedAt) return 0;

  const started = new Date(startedAt).getTime();

  if (Number.isNaN(started)) return 0;

  return Math.max(0, Math.floor((Date.now() - started) / 60000));
}

function getPriority(waitingMinutes: number): Priority {
  const days = waitingMinutes / (60 * 24);

  if (days >= 7) return "URGENT";
  if (days >= 4) return "HIGH";
  if (days >= 2) return "MEDIUM";

  return "LOW";
}

function formatWaiting(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const days = Math.floor(minutes / (60 * 24));
  const hoursAfterDays = Math.floor((minutes % (60 * 24)) / 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (days > 0) {
    if (hoursAfterDays > 0) {
      return `${days}d ${hoursAfterDays}h`;
    }

    return `${days}d`;
  }

  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not entered yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not entered yet";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getPriorityStyle(priority: Priority) {
  switch (priority) {
    case "URGENT":
      return {
        backgroundColor: "#FDE2E2",
        textColor: "#C62828",
        borderColor: "#F3A3A3",
      };

    case "HIGH":
      return {
        backgroundColor: "#FFF0E0",
        textColor: "#D46B08",
        borderColor: "#F3C18D",
      };

    case "MEDIUM":
      return {
        backgroundColor: "#FFF8D9",
        textColor: "#9A7200",
        borderColor: "#EFD77C",
      };

    default:
      return {
        backgroundColor: "#EAF2FF",
        textColor: "#3169B8",
        borderColor: "#B7D0F5",
      };
  }
}

export default function AdvisorWorkScreen() {
  const handleNavigationBack = () => {
    returnToRoute("/(tabs)/advisor");
  };
  useHardwareBack(handleNavigationBack);

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [page, setPage] = useState(1);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);

  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const showPopup = useCallback(
    (type: PopupType, title: string, message: string) => {
      setPopup({
        visible: true,
        type,
        title,
        message,
      });
    },
    [],
  );

  const closePopup = useCallback(() => {
    setPopup((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  const loadWork = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          setProfileId(null);
          setProfileRole(null);
          setItems([]);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, role, is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profile || !profile.is_active) {
          setProfileId(null);
          setProfileRole(null);
          setItems([]);

          showPopup(
            "error",
            "Profile unavailable",
            "Your active workshop profile could not be found.",
          );

          return;
        }

        const role = String(profile.role || "").toLowerCase();

        if (role !== "advisor" && role !== "ceo_admin") {
          setProfileId(user.id);
          setProfileRole(role);
          setItems([]);
          return;
        }

        setProfileId(user.id);
        setProfileRole(role);

        const { data, error } = await supabase
          .from("workshop_visits")
          .select(
            `
              id,
              vehicle_id,
              current_stage,
              current_status,
              current_assigned_to,
              stage_started_at,
              created_at,
              vehicle:vehicles (
                id,
                vehicle_no,
                customer_name,
                customer_mobile,
                model,
                arena_nexa,
                vehicle_type,
                current_status,
                current_stage,
                current_assigned_to,
                stage_started_at
              )
            `,
          )
          .eq("current_stage", "ADVISOR_WORK")
          .in("current_status", ["PENDING", "IN_PROGRESS"])
          .order("stage_started_at", {
            ascending: true,
          });

        if (error) {
          throw error;
        }

        const rows = Array.isArray(data) ? data : [];

        const mapped: WorkItem[] = rows
          .map((row: any) => {
            const vehicle = Array.isArray(row.vehicle)
              ? row.vehicle[0] || null
              : row.vehicle || null;

            if (!vehicle) {
              return null;
            }

            if (
              role === "advisor" &&
              row.current_assigned_to &&
              row.current_assigned_to !== user.id
            ) {
              return null;
            }

            const startedAt =
              row.stage_started_at ||
              vehicle.stage_started_at ||
              row.created_at ||
              null;

            const waitingMinutes = getWaitingMinutes(startedAt);

            return {
              visit: {
                id: row.id,
                vehicle_id: row.vehicle_id,
                current_stage: row.current_stage,
                current_status: row.current_status,
                current_assigned_to: row.current_assigned_to,
                stage_started_at: row.stage_started_at,
                created_at: row.created_at,
                vehicle,
              },

              vehicle,

              priority: getPriority(waitingMinutes),

              waitingMinutes,
            };
          })
          .filter(Boolean) as WorkItem[];

        setItems(mapped);
      } catch (error: any) {
        console.error("Advisor Work load error:", error);

        setItems([]);

        showPopup(
          "error",
          "Unable to load work",
          error?.message ||
            "Something went wrong while loading the advisor work queue.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showPopup],
  );

  useFocusEffect(
    useCallback(() => {
      loadWork(true);
    }, [loadWork]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWork(false);
  }, [loadWork]);

  const counts = useMemo(() => {
    return {
      total: items.length,

      urgent: items.filter((item) => item.priority === "URGENT").length,

      high: items.filter((item) => item.priority === "HIGH").length,

      medium: items.filter((item) => item.priority === "MEDIUM").length,

      low: items.filter((item) => item.priority === "LOW").length,

      assigned: items.filter(
        (item) => !!profileId && item.visit.current_assigned_to === profileId,
      ).length,
    };
  }, [items, profileId]);

  const filteredItems = useMemo(() => {
    const query = normalize(search);

    return items
      .filter((item) => {
        if (filter !== "ALL" && item.priority !== filter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const vehicle = item.vehicle;

        const searchable = [
          vehicle.vehicle_no,
          vehicle.customer_name,
          vehicle.customer_mobile,
          vehicle.model,
          vehicle.arena_nexa,
          vehicle.vehicle_type,
          item.visit.current_stage,
        ]
          .map(normalize)
          .join(" ");

        return searchable.includes(query);
      })
      .sort((a, b) => {
        if (a.waitingMinutes !== b.waitingMinutes) {
          return b.waitingMinutes - a.waitingMinutes;
        }

        return normalize(a.vehicle.vehicle_no).localeCompare(
          normalize(b.vehicle.vehicle_no),
        );
      });
  }, [items, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  const currentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  const changeFilter = useCallback((nextFilter: FilterType) => {
    setFilter(nextFilter);
    setPage(1);
  }, []);

  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const openVehicle = useCallback(async (item: WorkItem) => {
    try { router.push(await getCurrentWorkflowRoute(item.vehicle.id)); }
    catch (e: any) { showPopup("error", "Unable to Open Work", e.message || "Refresh and try again."); }
  }, [showPopup]);

  const goBack = handleNavigationBack;

  if (
    !loading &&
    profileRole &&
    profileRole !== "advisor" &&
    profileRole !== "ceo_admin"
  ) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.topBar}>
          <BackButton onPress={goBack} hitSlop={8} />

          <BrandPill />
        </View>

        <View style={styles.unavailableContainer}>
          <View style={styles.unavailableIcon}>
            <Ionicons name="lock-closed-outline" size={28} color="#F20D1D" />
          </View>

          <Text style={styles.unavailableTitle}>Workspace Unavailable</Text>

          <Text style={styles.unavailableText}>
            This workspace is available only to Advisor and CEO Admin users.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* TOP NAVIGATION */}
      <View style={styles.topBar}>
        <BackButton onPress={goBack} hitSlop={8} />

        <BrandPill />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F20D1D"
          />
        }
      >
        {/* RED HERO */}
        <View style={styles.hero}>
          <View style={styles.heroCircleTop} />

          <View style={styles.heroCircleBottom} />

          <View style={styles.heroContent}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>ADVISOR WORKSPACE</Text>
            </View>

            <View style={styles.heroTitleRow}>
              <Text style={styles.heroTitle}>Advisor Work</Text>

              {profileRole === "ceo_admin" && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>CEO ADMIN</Text>
                </View>
              )}
            </View>

            <Text style={styles.heroDescription}>
              Select the work requirements for each vehicle and move the vehicle
              to the appropriate next stage.
            </Text>

            <View style={styles.heroDivider} />

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{counts.total}</Text>

                <Text style={styles.heroStatLabel}>Pending</Text>
              </View>

              <View style={styles.heroStatDivider} />

              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{counts.assigned}</Text>

                <Text style={styles.heroStatLabel}>Assigned to you</Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION HEADER */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleArea}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Work vehicles</Text>

              {profileRole === "ceo_admin" && (
                <View style={styles.smallAdminBadge}>
                  <Text style={styles.smallAdminBadgeText}>CEO ADMIN</Text>
                </View>
              )}
            </View>

            <Text style={styles.sectionSubtitle}>
              Review approved vehicles and select their required work.
            </Text>
          </View>

          <Pressable
            onPress={() => loadWork(false)}
            style={styles.refreshButton}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#F20D1D" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={17} color="#F20D1D" />

                <Text style={styles.refreshText}>Refresh</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* FILTERS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label={`All ${counts.total}`}
            active={filter === "ALL"}
            onPress={() => changeFilter("ALL")}
          />

          <FilterChip
            label={`Urgent ${counts.urgent}`}
            active={filter === "URGENT"}
            onPress={() => changeFilter("URGENT")}
          />

          <FilterChip
            label={`High ${counts.high}`}
            active={filter === "HIGH"}
            onPress={() => changeFilter("HIGH")}
          />

          <FilterChip
            label={`Medium ${counts.medium}`}
            active={filter === "MEDIUM"}
            onPress={() => changeFilter("MEDIUM")}
          />

          <FilterChip
            label={`Low ${counts.low}`}
            active={filter === "LOW"}
            onPress={() => changeFilter("LOW")}
          />
        </ScrollView>

        {/* SEARCH */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#8A919C" />

          <TextInput
            value={search}
            onChangeText={changeSearch}
            placeholder="Search registration, customer, mobile, model..."
            placeholderTextColor="#9AA1AB"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {!!search && (
            <Pressable onPress={() => changeSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#9AA1AB" />
            </Pressable>
          )}
        </View>

        {/* QUEUE HEADER */}
        <View style={styles.queueHeader}>
          <View>
            <Text style={styles.queueTitle}>Work queue</Text>

            <Text style={styles.queueSubtitle}>
              {filteredItems.length} vehicle
              {filteredItems.length === 1 ? "" : "s"} shown
            </Text>
          </View>

          {filteredItems.length > 0 && (
            <View style={styles.queueCountBadge}>
              <Text style={styles.queueCountText}>{filteredItems.length}</Text>
            </View>
          )}
        </View>

        {/* LOADING */}
        {loading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#F20D1D" />

            <Text style={styles.loadingTitle}>Loading work queue</Text>

            <Text style={styles.loadingText}>
              Please wait while we load your vehicles.
            </Text>
          </View>
        )}

        {/* EMPTY */}
        {!loading && paginatedItems.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={
                  search || filter !== "ALL"
                    ? "search-outline"
                    : "checkmark-done-outline"
                }
                size={31}
                color="#F20D1D"
              />
            </View>

            <Text style={styles.emptyTitle}>
              {search || filter !== "ALL"
                ? "No matching vehicles"
                : "No pending work"}
            </Text>

            <Text style={styles.emptyText}>
              {search || filter !== "ALL"
                ? "Try changing your search or priority filter."
                : "There are currently no approved vehicles waiting for work requirements."}
            </Text>

            {(search || filter !== "ALL") && (
              <Pressable
                onPress={() => {
                  changeSearch("");
                  changeFilter("ALL");
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* VEHICLE CARDS */}
        {!loading &&
          paginatedItems.map((item) => (
            <WorkVehicleCard
              key={item.visit.id}
              item={item}
              assignedToYou={
                !!profileId && item.visit.current_assigned_to === profileId
              }
              onOpen={() => openVehicle(item)}
            />
          ))}

        {/* PAGINATION */}
        {!loading && filteredItems.length > PAGE_SIZE && (
          <View style={styles.pagination}>
            <Pressable
              onPress={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              style={[
                styles.pageButton,
                currentPage <= 1 && styles.pageButtonDisabled,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={currentPage <= 1 ? "#B8BDC5" : "#F20D1D"}
              />

              <Text
                style={[
                  styles.pageButtonText,
                  currentPage <= 1 && styles.pageButtonTextDisabled,
                ]}
              >
                Previous
              </Text>
            </Pressable>

            <View style={styles.pageInfo}>
              <Text style={styles.pageInfoText}>
                Page {currentPage} of {totalPages}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={currentPage >= totalPages}
              style={[
                styles.pageButton,
                currentPage >= totalPages && styles.pageButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.pageButtonText,
                  currentPage >= totalPages && styles.pageButtonTextDisabled,
                ]}
              >
                Next
              </Text>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={currentPage >= totalPages ? "#B8BDC5" : "#F20D1D"}
              />
            </Pressable>
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* POPUP */}
      <Modal
        visible={popup.visible}
        transparent
        animationType="fade"
        onRequestClose={closePopup}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View
              style={[
                styles.popupIcon,
                popup.type === "success" && styles.popupIconSuccess,
                popup.type === "error" && styles.popupIconError,
                popup.type === "info" && styles.popupIconInfo,
              ]}
            >
              <Ionicons
                name={
                  popup.type === "success"
                    ? "checkmark"
                    : popup.type === "error"
                      ? "close"
                      : "information"
                }
                size={25}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.popupTitle}>{popup.title}</Text>

            <Text style={styles.popupMessage}>{popup.message}</Text>

            <Pressable onPress={closePopup} style={styles.popupButton}>
              <Text style={styles.popupButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function WorkVehicleCard({
  item,
  assignedToYou,
  onOpen,
}: {
  item: WorkItem;
  assignedToYou: boolean;
  onOpen: () => void;
}) {
  const vehicle = item.vehicle;

  const priorityStyle = getPriorityStyle(item.priority);

  return (
    <View style={styles.vehicleCard}>
      {/* CARD HEADER */}
      <View style={styles.vehicleCardHeader}>
        <View style={styles.vehicleIdentity}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="car-sport-outline" size={22} color="#F20D1D" />
          </View>

          <View style={styles.vehicleIdentityText}>
            <Text style={styles.vehicleNumber} numberOfLines={1}>
              {vehicle.vehicle_no || "Vehicle number not entered"}
            </Text>

            <Text style={styles.vehicleArrival}>Advisor Work</Text>
          </View>
        </View>

        <View
          style={[
            styles.priorityBadge,
            {
              backgroundColor: priorityStyle.backgroundColor,
              borderColor: priorityStyle.borderColor,
            },
          ]}
        >
          <View
            style={[
              styles.priorityDot,
              {
                backgroundColor: priorityStyle.textColor,
              },
            ]}
          />

          <Text
            style={[
              styles.priorityText,
              {
                color: priorityStyle.textColor,
              },
            ]}
          >
            {PRIORITY_LABELS[item.priority]}
          </Text>
        </View>
      </View>

      {/* CURRENT STAGE */}
      <View style={styles.stageBox}>
        <Text style={styles.stageLabel}>CURRENT WORKFLOW STAGE</Text>

        <Text style={styles.stageValue}>Advisor Work</Text>
      </View>

      {/* DETAILS */}
      <View style={styles.detailsBox}>
        <DetailRow
          label="Assigned to"
          value={
            assignedToYou
              ? "You"
              : item.visit.current_assigned_to
                ? "Assigned advisor"
                : "Not assigned yet"
          }
          highlight={assignedToYou}
        />

        <DetailRow
          label="Waiting"
          value={formatWaiting(item.waitingMinutes)}
          valueStyle={{
            color: priorityStyle.textColor,
            fontWeight: "900",
            fontSize: 12,
          }}
        />

        <DetailRow
          label="Customer"
          value={vehicle.customer_name || "Not entered yet"}
        />

        <DetailRow
          label="Vehicle"
          value={
            [vehicle.model, vehicle.arena_nexa, vehicle.vehicle_type]
              .filter(Boolean)
              .join(" • ") || "Vehicle details not entered yet"
          }
        />

        <DetailRow
          label="Pending since"
          value={formatDateTime(
            item.visit.stage_started_at || vehicle.stage_started_at,
          )}
        />
      </View>

      {/* ACTION */}
      <View style={styles.cardFooter}>
        <Text style={styles.footerHint}>
          Select the required work for this vehicle
        </Text>

        <Pressable onPress={onOpen} style={styles.openButton}>
          <Text style={styles.openButtonText}>Select Work Requirements</Text>

          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  valueStyle,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueStyle?: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>

      <Text
        style={[
          styles.detailValue,
          highlight && styles.detailValueHighlight,
          valueStyle,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },

  /* TOP NAVIGATION */

  topBar: {
    height: 52,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
  },

  backButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 2,
  },

  backText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#7A808A",
  },

  brandPill: {
    minHeight: 31,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E9EC",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    elevation: 1,
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

  /* HERO */

  hero: {
    minHeight: 215,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#F20D1D",
    marginBottom: 18,
    position: "relative",
    shadowColor: "#F20D1D",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 4,
  },

  heroContent: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 15,
    position: "relative",
    zIndex: 2,
  },

  heroCircleTop: {
    position: "absolute",
    width: 145,
    height: 145,
    borderRadius: 73,
    right: -42,
    top: -67,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  heroCircleBottom: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    right: 18,
    bottom: -57,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.17)",
    marginBottom: 9,
  },

  heroPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },

  adminBadge: {
    minHeight: 23,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    justifyContent: "center",
  },

  adminBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  heroDescription: {
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 540,
    marginTop: 4,
  },

  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginTop: 13,
    marginBottom: 11,
  },

  heroStats: {
    flexDirection: "row",
    alignItems: "center",
  },

  heroStat: {
    minWidth: 86,
    paddingRight: 12,
  },

  heroStatNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "900",
  },

  heroStatLabel: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  heroStatDivider: {
    width: 1,
    height: 31,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginRight: 13,
  },

  /* SECTION */

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },

  sectionTitleArea: {
    flex: 1,
    paddingRight: 8,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  sectionTitle: {
    color: "#343940",
    fontSize: 17,
    fontWeight: "800",
  },

  sectionSubtitle: {
    color: "#8A919B",
    fontSize: 12,
    marginTop: 2,
  },

  smallAdminBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FDE5E7",
  },

  smallAdminBadgeText: {
    color: "#D20D1B",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  refreshButton: {
    minHeight: 35,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E9E9EC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  refreshText: {
    color: "#F20D1D",
    fontSize: 12,
    fontWeight: "700",
  },

  /* FILTERS */

  filterRow: {
    paddingBottom: 9,
    gap: 7,
  },

  filterChip: {
    height: 33,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E8EB",
    justifyContent: "center",
  },

  filterChipActive: {
    backgroundColor: "#F20D1D",
    borderColor: "#F20D1D",
  },

  filterChipText: {
    color: "#69717C",
    fontSize: 12,
    fontWeight: "700",
  },

  filterChipTextActive: {
    color: "#FFFFFF",
  },

  /* SEARCH */

  searchContainer: {
    minHeight: 47,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EA",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 17,
  },

  searchInput: {
    flex: 1,
    color: "#30343B",
    fontSize: 13,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },

  /* QUEUE */

  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  queueTitle: {
    color: "#343940",
    fontSize: 17,
    fontWeight: "800",
  },

  queueSubtitle: {
    color: "#9298A1",
    fontSize: 12,
    marginTop: 2,
  },

  queueCountBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#FDE5E7",
    alignItems: "center",
    justifyContent: "center",
  },

  queueCountText: {
    color: "#F20D1D",
    fontSize: 13,
    fontWeight: "900",
  },

  /* VEHICLE CARD */

  vehicleCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E9EC",
    borderRadius: 13,
    padding: 10,
    marginBottom: 10,
    overflow: "hidden",
  },

  vehicleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 1,
    marginBottom: 8,
  },

  vehicleIdentity: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  vehicleIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#FFE6E8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  vehicleIdentityText: {
    flex: 1,
  },

  vehicleNumber: {
    color: "#30343B",
    fontSize: 16,
    fontWeight: "900",
  },

  vehicleArrival: {
    color: "#9A9FA7",
    fontSize: 11,
    marginTop: 1,
  },

  priorityBadge: {
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },

  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 5,
  },

  priorityText: {
    fontSize: 11,
    fontWeight: "800",
  },

  stageBox: {
    backgroundColor: "#FDE5E7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 7,
  },

  stageLabel: {
    color: "#F20D1D",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginBottom: 2,
  },

  stageValue: {
    color: "#252A30",
    fontSize: 13,
    fontWeight: "800",
  },

  detailsBox: {
    backgroundColor: "#F7F8F9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  detailRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  detailLabel: {
    width: 105,
    color: "#8D949E",
    fontSize: 11,
  },

  detailValue: {
    flex: 1,
    color: "#444A52",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },

  detailValueHighlight: {
    color: "#D65A00",
    fontWeight: "800",
  },

  cardFooter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 1,
    marginTop: 7,
  },

  footerHint: {
    flex: 1,
    color: "#8B919A",
    fontSize: 11,
    lineHeight: 15,
    paddingRight: 8,
  },

  openButton: {
    minHeight: 36,
    maxWidth: "62%",
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: "#F20D1D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  openButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  /* LOADING */

  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E9EC",
    paddingVertical: 27,
    alignItems: "center",
    marginBottom: 10,
  },

  loadingTitle: {
    color: "#3A4047",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 9,
  },

  loadingText: {
    color: "#9298A1",
    fontSize: 12,
    marginTop: 3,
  },

  /* EMPTY */

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E9EC",
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: "center",
    marginBottom: 10,
  },

  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFE6E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  emptyTitle: {
    color: "#363B42",
    fontSize: 17,
    fontWeight: "800",
  },

  emptyText: {
    color: "#8E959E",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 5,
    maxWidth: 390,
  },

  clearButton: {
    marginTop: 14,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#F20D1D",
    alignItems: "center",
    justifyContent: "center",
  },

  clearButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  /* PAGINATION */

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 10,
  },

  pageButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E6E9",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  pageButtonDisabled: {
    backgroundColor: "#F5F6F7",
    borderColor: "#ECEDEF",
  },

  pageButtonText: {
    color: "#F20D1D",
    fontSize: 12,
    fontWeight: "800",
  },

  pageButtonTextDisabled: {
    color: "#B8BDC5",
  },

  pageInfo: {
    paddingHorizontal: 10,
  },

  pageInfoText: {
    color: "#858C95",
    fontSize: 12,
    fontWeight: "700",
  },

  /* UNAVAILABLE */

  unavailableContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  unavailableIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFE6E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  unavailableTitle: {
    color: "#343940",
    fontSize: 20,
    fontWeight: "900",
  },

  unavailableText: {
    color: "#858C95",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 350,
  },

  /* POPUP */

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(20,24,30,0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  popupCard: {
    width: "100%",
    maxWidth: 410,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 18,
    alignItems: "center",
  },

  popupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 11,
  },

  popupIconSuccess: {
    backgroundColor: "#22A06B",
  },

  popupIconError: {
    backgroundColor: "#D92D20",
  },

  popupIconInfo: {
    backgroundColor: "#3478D8",
  },

  popupTitle: {
    color: "#30343B",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  popupMessage: {
    color: "#777E87",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },

  popupButton: {
    minWidth: 105,
    minHeight: 40,
    borderRadius: 9,
    backgroundColor: "#F20D1D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 17,
    paddingHorizontal: 18,
  },

  popupButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  bottomSpace: {
    height: 20,
  },
});
