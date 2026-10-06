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
import {
  requirementView,
  supplementaryRequirements,
} from "../../../lib/supplementary-store";

import { supabase } from "../../../../lib/supabase";
import { colors } from "../../../theme";

/* ============================================================
   TYPES
============================================================ */

type UserRole =
  | "user"
  | "ceo_admin"
  | "advisor"
  | "floor_incharge"
  | "supervisor"
  | "worker_group"
  | "billing_department"
  | "watchman"
  | "store_team"
  | "final_inspector";

type QueueFilter = "ALL" | "REQUESTS" | "ORDERED" | "RECEIVED";

type PopupType = "success" | "error" | "warning" | "info";

type PopupConfig = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
  primaryText?: string;
  secondaryText?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
};

type Profile = {
  id: string;
  name: string | null;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
};

type Vehicle = {
  id: string;
  vehicle_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  model: string | null;
  arena_nexa: string | null;
  vehicle_type: string | null;
  jc_no: string | null;
  current_stage: string | null;
  current_status: string | null;
  current_assigned_to: string | null;
  stage_started_at: string | null;
};

type PartRequisition = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  advisor_work_id: string | null;
  supplementary_cycle_id: string | null;
  requisition_no: string;
  requisition_at: string;
  requested_by: string;
  status: string;
  remarks: string | null;
  created_at: string;
};

type PartOrder = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  part_requisition_id: string;
  part_order_no: string;
  order_type: string;
  ordered_at: string;
  ordered_by: string;
  parts_received_at: string | null;
  parts_received_by: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
};

type AdvisorWork = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  work_path: string;
  parts_required: boolean;
  denting_required: boolean;
  painting_required: boolean;
  advisor_requisition_no: string | null;
  requisition_at: string | null;
  assigned_by: string;
  remarks: string | null;
};

type StoreQueueItem = {
  vehicle: Vehicle;
  requisition: PartRequisition | null;
  order: PartOrder | null;
  advisorWork: AdvisorWork | null;
};

/* ============================================================
   HELPERS
============================================================ */

const EMPTY_POPUP: PopupConfig = {
  visible: false,
  type: "info",
  title: "",
  message: "",
};

function formatIndiaDateTime(value: string | null | undefined) {
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

function normalizeWorkPath(value: string | null | undefined) {
  if (!value) {
    return "Parts Work";
  }

  switch (value) {
    case "ONLY_PARTS":
      return "Only Parts";

    case "DENTING_PAINTING_PARTS":
      return "Denting + Painting + Parts";

    case "ONLY_DENTING_PAINTING":
      return "Denting + Painting";

    default:
      return value.replaceAll("_", " ");
  }
}

function normalizeOrderType(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  switch (value) {
    case "REGULAR":
      return "Regular";

    case "EXPRESS":
      return "Express";

    case "PVIP":
      return "PVIP";

    case "VOR":
      return "VOR";

    default:
      return value;
  }
}

function statusLabel(item: StoreQueueItem) {
  if (item.order?.status === "HANDED_TO_FLOOR") {
    return "Handed to Floor";
  }

  if (item.order?.status === "RECEIVED") {
    return "Parts Received";
  }

  if (item.order?.status === "PARTIALLY_RECEIVED") {
    return "Partially Received";
  }

  if (item.order?.status === "ORDERED") {
    return "Order Created";
  }

  if (item.requisition?.status === "PENDING") {
    return "Parts Requested";
  }

  if (item.requisition) {
    return item.requisition.status;
  }

  return "Store";
}

function statusDescription(item: StoreQueueItem) {
  if (item.order?.status === "HANDED_TO_FLOOR") {
    return "Parts have been handed over to Floor.";
  }

  if (item.order?.status === "RECEIVED") {
    return "Parts are received and waiting for Floor handover.";
  }

  if (item.order?.status === "PARTIALLY_RECEIVED") {
    return "Some parts have been received. Store processing continues.";
  }

  if (item.order?.status === "ORDERED") {
    return "Part order has been created and is awaiting receipt.";
  }

  if (item.requisition?.status === "PENDING") {
    return "Advisor has requested parts. Part order is pending.";
  }

  return "Store action is pending.";
}

function isRequestItem(item: StoreQueueItem) {
  return item.requisition?.status === "PENDING" && !item.order;
}

function isOrderedItem(item: StoreQueueItem) {
  return (
    item.order?.status === "ORDERED" ||
    item.order?.status === "PARTIALLY_RECEIVED"
  );
}

function isReceivedItem(item: StoreQueueItem) {
  return item.order?.status === "RECEIVED";
}

function popupTitleForType(type: PopupType) {
  switch (type) {
    case "success":
      return "✓";

    case "error":
      return "×";

    case "warning":
      return "!";

    default:
      return "i";
  }
}

/* ============================================================
   CUSTOM POPUP
============================================================ */

function CustomPopup({
  popup,
  onClose,
}: {
  popup: PopupConfig;
  onClose: () => void;
}) {
  if (!popup.visible) {
    return null;
  }

  return (
    <Modal
      visible={popup.visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
      <View style={styles.popupOverlay}>
        <View style={styles.popupCard}>
          <View
            style={[
              styles.popupIcon,
              popup.type === "success" && styles.popupIconSuccess,
              popup.type === "error" && styles.popupIconError,
              popup.type === "warning" && styles.popupIconWarning,
              popup.type === "info" && styles.popupIconInfo,
            ]}
          >
            <Text style={styles.popupIconText}>
              {popupTitleForType(popup.type)}
            </Text>
          </View>

          <Text style={styles.popupTitle}>{popup.title}</Text>

          <Text style={styles.popupMessage}>{popup.message}</Text>

          <View style={styles.popupActions}>
            {popup.secondaryText ? (
              <Pressable
                onPress={popup.onSecondary || onClose}
                style={({ pressed }) => [
                  styles.popupSecondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.popupSecondaryText}>
                  {popup.secondaryText}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={popup.onPrimary || onClose}
              style={({ pressed }) => [
                styles.popupPrimaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.popupPrimaryText}>
                {popup.primaryText || "OK"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      </SafeAreaView>
    </Modal>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  label,
  value,
  icon,
  selected,
  onPress,
}: {
  label: string;
  value: number;
  icon: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.statCard,
        selected && styles.statCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.statCardTop}>
        <View style={[styles.statIcon, selected && styles.statIconSelected]}>
          <Text
            style={[
              styles.statIconText,
              selected && styles.statIconTextSelected,
            ]}
          >
            {icon}
          </Text>
        </View>

        {selected ? (
          <View style={styles.statActiveMark}>
            <Text style={styles.statActiveMarkText}>VIEWING</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.statNumber, selected && styles.statNumberSelected]}>
        {value}
      </Text>

      <Text style={[styles.statLabel, selected && styles.statLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ============================================================
   STATUS PILL
============================================================ */

function StatusPill({ item }: { item: StoreQueueItem }) {
  const status = statusLabel(item);

  const received =
    status === "Parts Received" || status === "Partially Received";

  const ordered = status === "Order Created";

  const requested = status === "Parts Requested";

  const handed = status === "Handed to Floor";

  return (
    <View
      style={[
        styles.statusPill,
        received && styles.statusPillReceived,
        ordered && styles.statusPillOrdered,
        requested && styles.statusPillRequested,
        handed && styles.statusPillHanded,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          received && styles.statusDotReceived,
          ordered && styles.statusDotOrdered,
          requested && styles.statusDotRequested,
          handed && styles.statusDotHanded,
        ]}
      />

      <Text
        style={[
          styles.statusPillText,
          received && styles.statusPillTextReceived,
          ordered && styles.statusPillTextOrdered,
          requested && styles.statusPillTextRequested,
          handed && styles.statusPillTextHanded,
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

/* ============================================================
   INFO ROW
============================================================ */

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

      <Text style={styles.infoValue} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  );
}

/* ============================================================
   TIMELINE STEP
============================================================ */

function TimelineStep({
  number,
  title,
  value,
  done,
  active,
}: {
  number: string;
  title: string;
  value: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <View style={styles.timelineItem}>
      <View
        style={[
          styles.timelineDot,
          done && styles.timelineDotDone,
          active && styles.timelineDotActive,
        ]}
      >
        <Text
          style={[
            styles.timelineDotText,
            !done && !active && styles.timelineDotTextPending,
          ]}
        >
          {done ? "✓" : number}
        </Text>
      </View>

      <View style={styles.timelineContent}>
        <Text style={styles.timelineTitle}>{title}</Text>

        <Text
          style={[styles.timelineValue, active && styles.timelineValueActive]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/* ============================================================
   MAIN SCREEN
============================================================ */

export default function StoreDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [items, setItems] = useState<StoreQueueItem[]>([]);

  const [filter, setFilter] = useState<QueueFilter>("ALL");
  const [search, setSearch] = useState("");

  const [selectedItem, setSelectedItem] = useState<StoreQueueItem | null>(null);

  const [popup, setPopup] = useState<PopupConfig>(EMPTY_POPUP);

  /* ==========================================================
     POPUP HELPERS
  ========================================================== */

  const closePopup = useCallback(() => {
    setPopup(EMPTY_POPUP);
  }, []);

  const showPopup = useCallback(
    (
      type: PopupType,
      title: string,
      message: string,
      options?: Partial<PopupConfig>,
    ) => {
      setPopup({
        visible: true,
        type,
        title,
        message,
        primaryText: options?.primaryText || "OK",
        secondaryText: options?.secondaryText,
        onPrimary: options?.onPrimary,
        onSecondary: options?.onSecondary,
      });
    },
    [],
  );

  /* ==========================================================
     LOAD DATA
  ========================================================== */

  const loadData = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("Your session has expired. Please log in again.");
        }

        const [
          profileResult,
          requisitionsResult,
          ordersResult,
          advisorWorkResult,
          vehiclesResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id,name,phone,role,is_active")
            .eq("id", user.id)
            .single(),

          supabase
            .from("part_requisitions")
            .select(
              "id,visit_id,vehicle_id,advisor_work_id,supplementary_cycle_id,requisition_no,requisition_at,requested_by,status,remarks,created_at",
            )
            .in("status", ["PENDING", "ORDERED"])
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("part_orders")
            .select(
              "id,visit_id,vehicle_id,part_requisition_id,part_order_no,order_type,ordered_at,ordered_by,parts_received_at,parts_received_by,status,remarks,created_at",
            )
            .in("status", ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"])
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("advisor_work")
            .select(
              "id,visit_id,vehicle_id,work_path,parts_required,denting_required,painting_required,advisor_requisition_no,requisition_at,assigned_by,remarks",
            )
            .eq("parts_required", true),

          supabase
            .from("vehicles")
            .select(
              "id,vehicle_no,customer_name,customer_mobile,model,arena_nexa,vehicle_type,jc_no,current_stage,current_status,current_assigned_to,stage_started_at",
            )
            .eq("current_stage", "STORE")
            .order("stage_started_at", {
              ascending: true,
            }),
        ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (requisitionsResult.error) {
          throw requisitionsResult.error;
        }

        if (ordersResult.error) {
          throw ordersResult.error;
        }

        if (advisorWorkResult.error) {
          throw advisorWorkResult.error;
        }

        if (vehiclesResult.error) {
          throw vehiclesResult.error;
        }

        const profileData = profileResult.data as Profile | null;

        if (!profileData) {
          throw new Error("Your user profile could not be loaded.");
        }

        if (!profileData.is_active) {
          throw new Error(
            "Your account is inactive. Please contact the CEO Admin.",
          );
        }

        if (
          profileData.role !== "store_team" &&
          profileData.role !== "ceo_admin"
        ) {
          throw new Error(
            "This workspace is available only to Store Team and CEO Admin users.",
          );
        }

        const requisitions = (requisitionsResult.data ||
          []) as PartRequisition[];

        const orders = (ordersResult.data || []) as PartOrder[];

        const advisorWorks = (advisorWorkResult.data || []) as AdvisorWork[];

        const vehicles = (vehiclesResult.data || []) as Vehicle[];

        const requisitionByVehicle = new Map<string, PartRequisition>();

        for (const requisition of requisitions) {
          if (!requisitionByVehicle.has(requisition.vehicle_id)) {
            requisitionByVehicle.set(requisition.vehicle_id, requisition);
          }
        }

        const orderByVehicle = new Map<string, PartOrder>();

        for (const order of orders) {
          if (!orderByVehicle.has(order.vehicle_id)) {
            orderByVehicle.set(order.vehicle_id, order);
          }
        }

        const cycleRequirements = await supplementaryRequirements(
          requisitions
            .filter((row) => row.supplementary_cycle_id)
            .map((row) => row.id),
        );
        const advisorWorkByVehicle = new Map<string, AdvisorWork>();

        for (const work of advisorWorks) {
          if (!advisorWorkByVehicle.has(work.vehicle_id)) {
            advisorWorkByVehicle.set(work.vehicle_id, work);
          }
        }

        /*
         * Active Store queue is authoritative from the current vehicle stage.
         * Historical requisitions/orders must never re-add a vehicle that has
         * already moved to Floor or another workflow stage.
         */
        const vehicleMap = new Map<string, Vehicle>();

        for (const vehicle of vehicles) {
          if (
            vehicle.current_stage === "STORE" &&
            ["PENDING", "IN_PROGRESS"].includes(
              String(vehicle.current_status || ""),
            )
          ) {
            vehicleMap.set(vehicle.id, vehicle);
          }
        }

        const queueMap = new Map<string, StoreQueueItem>();

        for (const vehicle of vehicleMap.values()) {
          const requisition = requisitionByVehicle.get(vehicle.id) || null;

          const latestOrder = orderByVehicle.get(vehicle.id) || null;
          const order =
            !requisition || latestOrder?.part_requisition_id === requisition.id
              ? latestOrder
              : null;

          const advisorWork = requirementView(
            advisorWorkByVehicle.get(vehicle.id) || null,
            requisition ? cycleRequirements.get(requisition.id) : undefined,
            requisition,
          );

          queueMap.set(vehicle.id, {
            vehicle,
            requisition,
            order,
            advisorWork,
          });
        }

        setProfile(profileData);
        setItems(Array.from(queueMap.values()));
      } catch (error: any) {
        console.error("Store dashboard load error:", error);

        showPopup(
          "error",
          "Unable to load Store Workspace",
          error?.message ||
            "The Store workspace could not be loaded. Please try again.",
          {
            primaryText: "Try Again",
            onPrimary: () => {
              closePopup();
              loadData(true);
            },
          },
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [closePopup, showPopup],
  );

  /* ==========================================================
     LOAD WHEN SCREEN FOCUSES
  ========================================================== */

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        if (mounted) {
          await loadData(false);
        }
      };

      run();

      return () => {
        mounted = false;
      };
    }, [loadData]),
  );

  /* ==========================================================
     STATISTICS
  ========================================================== */

  const stats = useMemo(() => {
    const pendingRequests = items.filter(isRequestItem).length;

    const ordersPending = items.filter(isOrderedItem).length;

    const partsReceived = items.filter(isReceivedItem).length;

    const readyForFloor = items.filter(isReceivedItem).length;

    return {
      pendingRequests,
      ordersPending,
      partsReceived,
      readyForFloor,
    };
  }, [items]);

  /* ==========================================================
     FILTERED QUEUE
  ========================================================== */

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      let matchesFilter = true;

      if (filter === "REQUESTS") {
        matchesFilter = isRequestItem(item);
      }

      if (filter === "ORDERED") {
        matchesFilter = isOrderedItem(item);
      }

      if (filter === "RECEIVED") {
        matchesFilter = isReceivedItem(item);
      }

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        item.vehicle.vehicle_no,
        item.vehicle.customer_name,
        item.vehicle.customer_mobile,
        item.vehicle.jc_no,
        item.requisition?.requisition_no,
        item.order?.part_order_no,
        item.order?.order_type,
        item.advisorWork?.work_path,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [filter, items, search]);

  /* ==========================================================
     OPEN VEHICLE DETAILS
  ========================================================== */

  const openVehicleDetails = (item: StoreQueueItem) => {
    const visitId = item.order?.visit_id ?? item.requisition?.visit_id ?? "";

    router.push({
      pathname: "/(tabs)/store/vehicle-action",
      params: {
        vehicleId: item.vehicle.id,
        visitId,
      },
    });
  };

  const closeVehicleDetails = () => {
    setSelectedItem(null);
  };

  /* ==========================================================
     LOADING SCREEN
  ========================================================== */

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>

          <Text style={styles.loadingTitle}>Loading Store Workspace</Text>

          <Text style={styles.loadingSubtitle}>
            Fetching parts requests, orders and Store activity…
          </Text>
        </View>

        <CustomPopup popup={popup} onClose={closePopup} />
      </SafeAreaView>
    );
  }

  /* ==========================================================
     MAIN UI
  ========================================================== */

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* ==================================================
            TOP BAR
        ================================================== */}

        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backArrow}>‹</Text>

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.brandBadge}>
            <View style={styles.brandDot} />

            <Text style={styles.brandText}>PAGARIYA</Text>
          </View>
        </View>

        {/* ==================================================
            HERO
        ================================================== */}

        <View style={styles.heroCard}>
          <View style={styles.heroCircleOne} />
          <View style={styles.heroCircleTwo} />

          <View style={styles.heroContent}>
            <View style={styles.heroTopRow}>
              <View style={styles.workspacePill}>
                <View style={styles.workspaceDot} />

                <Text style={styles.workspacePillText}>
                  {profile?.role === "ceo_admin"
                    ? "CEO ADMIN WORKSPACE"
                    : "STORE WORKSPACE"}
                </Text>
              </View>

              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Store Operations</Text>

            <Text style={styles.heroDescription}>
              Manage parts requests, create part orders, receive parts, and
              prepare vehicles for Floor handover.
            </Text>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{items.length}</Text>

                <Text style={styles.heroStatLabel}>Active Items</Text>
              </View>

              <View style={styles.heroStatDivider} />

              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{stats.readyForFloor}</Text>

                <Text style={styles.heroStatLabel}>Ready for Floor</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ==================================================
            PARTS OVERVIEW
        ================================================== */}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeadingGroup}>
            <Text style={styles.sectionTitle}>Parts Overview</Text>

            <Text style={styles.sectionSubtitle}>Current Store workload</Text>
          </View>

          <Pressable
            onPress={() => loadData(true)}
            disabled={refreshing}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={styles.refreshIcon}>↻</Text>
                <Text style={styles.refreshText}>Refresh</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statGridItem}>
            <StatCard
              label="Pending Requests"
              value={stats.pendingRequests}
              icon="!"
              selected={filter === "REQUESTS"}
              onPress={() => {
                setFilter("REQUESTS");
                setSelectedItem(null);
              }}
            />
          </View>

          <View style={styles.statGridItem}>
            <StatCard
              label="Orders Pending"
              value={stats.ordersPending}
              icon="◷"
              selected={filter === "ORDERED"}
              onPress={() => {
                setFilter("ORDERED");
                setSelectedItem(null);
              }}
            />
          </View>

          <View style={styles.statGridItem}>
            <StatCard
              label="Parts Received"
              value={stats.partsReceived}
              icon="✓"
              selected={filter === "RECEIVED"}
              onPress={() => {
                setFilter("RECEIVED");
                setSelectedItem(null);
              }}
            />
          </View>

          <View style={styles.statGridItem}>
            <StatCard
              label="Ready for Floor"
              value={stats.readyForFloor}
              icon="→"
              selected={filter === "RECEIVED"}
              onPress={() => {
                setFilter("RECEIVED");
                setSelectedItem(null);
              }}
            />
          </View>
        </View>

        {/* ==================================================
            QUEUE HEADER
        ================================================== */}

        <View style={styles.queueHeader}>
          <View style={styles.queueHeadingGroup}>
            <View style={styles.queueTitleRow}>
              <Text style={styles.queueTitle}>Store Queue</Text>

              <View style={styles.queueCountBadge}>
                <Text style={styles.queueCountText}>
                  {filteredItems.length}
                </Text>
              </View>
            </View>

            <Text style={styles.queueSubtitle}>
              Track every parts request through Store
            </Text>
          </View>

          {profile?.role === "ceo_admin" ? (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>CEO ADMIN</Text>
            </View>
          ) : null}
        </View>

        {/* ==================================================
            FILTERS
        ================================================== */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {(
            [
              ["ALL", `All (${items.length})`],
              ["REQUESTS", `Requests (${stats.pendingRequests})`],
              ["ORDERED", `Ordered (${stats.ordersPending})`],
              ["RECEIVED", `Received (${stats.partsReceived})`],
            ] as [QueueFilter, string][]
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => {
                setFilter(value);
              }}
              style={({ pressed }) => [
                styles.filterChip,
                filter === value && styles.filterChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === value && styles.filterChipTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ==================================================
            SEARCH
        ================================================== */}

        <View style={styles.searchCard}>
          <View style={styles.searchHeader}>
            <View>
              <Text style={styles.searchLabel}>
                FIND A VEHICLE OR PART ORDER
              </Text>

              <Text style={styles.searchHint}>
                Search by registration, customer, requisition or order
              </Text>
            </View>
          </View>

          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Registration, customer, requisition..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.searchInput}
              returnKeyType="search"
            />

            {search.length > 0 ? (
              <Pressable
                onPress={() => setSearch("")}
                style={({ pressed }) => [
                  styles.searchClearButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.searchClearText}>×</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ==================================================
            QUEUE
        ================================================== */}

        {filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>✓</Text>
            </View>

            <Text style={styles.emptyEyebrow}>STORE QUEUE</Text>

            <Text style={styles.emptyTitle}>
              {items.length === 0
                ? "Store queue is clear"
                : "No matching Store items"}
            </Text>

            <Text style={styles.emptyDescription}>
              {items.length === 0
                ? "There are currently no active parts requests or Store orders."
                : "Try another filter or change your search term to find the vehicle."}
            </Text>

            {items.length > 0 ? (
              <Pressable
                onPress={() => {
                  setFilter("ALL");
                  setSearch("");
                }}
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emptyButtonText}>
                  Clear Search & Filter
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => loadData(true)}
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emptyButtonText}>Refresh Queue</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.queueList}>
            {filteredItems.map((item) => {
              const vehicle = item.vehicle;
              const order = item.order;
              const requisition = item.requisition;
              const advisorWork = item.advisorWork;

              const hasOrder = !!order;
              const hasReceived = !!order?.parts_received_at;

              return (
                <Pressable
                  key={vehicle.id}
                  onPress={() => openVehicleDetails(item)}
                  style={({ pressed }) => [
                    styles.vehicleCard,
                    pressed && styles.vehicleCardPressed,
                  ]}
                >
                  {/* VEHICLE HEADER */}

                  <View style={styles.vehicleCardTop}>
                    <View style={styles.vehicleIconBox}>
                      <Text style={styles.vehicleIcon}>▰</Text>
                    </View>

                    <View style={styles.vehicleMainInfo}>
                      <Text style={styles.vehicleNumber}>
                        {vehicle.vehicle_no || "Registration unavailable"}
                      </Text>

                      <Text style={styles.vehicleCaption} numberOfLines={1}>
                        {vehicle.customer_name || "Customer name unavailable"}
                      </Text>
                    </View>

                    <StatusPill item={item} />
                  </View>

                  {/* WORK PATH */}

                  <View style={styles.workPathPanel}>
                    <View style={styles.workPathHeaderRow}>
                      <Text style={styles.workPathLabel}>
                        ADVISOR WORK REQUIREMENT
                      </Text>

                      {advisorWork?.parts_required ? (
                        <View style={styles.partsRequiredBadge}>
                          <View style={styles.partsRequiredDot} />
                          <Text style={styles.partsRequiredText}>
                            PARTS REQUIRED
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.workPathValue}>
                      {normalizeWorkPath(advisorWork?.work_path)}
                    </Text>

                    <View style={styles.workTags}>
                      {advisorWork?.parts_required ? (
                        <View style={styles.workTag}>
                          <Text style={styles.workTagText}>Parts</Text>
                        </View>
                      ) : null}

                      {advisorWork?.denting_required ? (
                        <View style={styles.workTag}>
                          <Text style={styles.workTagText}>Denting</Text>
                        </View>
                      ) : null}

                      {advisorWork?.painting_required ? (
                        <View style={styles.workTag}>
                          <Text style={styles.workTagText}>Painting</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* INFORMATION */}

                  <View style={styles.vehicleDetails}>
                    <InfoRow
                      label="Vehicle"
                      value={[vehicle.arena_nexa, vehicle.model]
                        .filter(Boolean)
                        .join(" · ")}
                    />

                    <InfoRow label="JC No." value={vehicle.jc_no} />

                    <InfoRow
                      label="Requisition"
                      value={requisition?.requisition_no}
                    />

                    <InfoRow label="Order No." value={order?.part_order_no} />

                    <InfoRow
                      label="Order Type"
                      value={
                        order ? normalizeOrderType(order.order_type) : null
                      }
                    />
                  </View>

                  {/* TIMELINE */}

                  <View style={styles.timeline}>
                    <TimelineStep
                      number="1"
                      title="Parts Requested"
                      value={
                        requisition
                          ? formatIndiaDateTime(requisition.requisition_at)
                          : "Not recorded"
                      }
                      done={!!requisition}
                    />

                    <View
                      style={[
                        styles.timelineLine,
                        hasOrder && styles.timelineLineDone,
                      ]}
                    />

                    <TimelineStep
                      number="2"
                      title="Part Order"
                      value={
                        order
                          ? `${order.part_order_no} · ${normalizeOrderType(
                              order.order_type,
                            )}`
                          : "Order not created"
                      }
                      done={hasOrder}
                      active={!hasOrder && !!requisition}
                    />

                    <View
                      style={[
                        styles.timelineLine,
                        hasReceived && styles.timelineLineDone,
                      ]}
                    />

                    <TimelineStep
                      number="3"
                      title="Parts Received"
                      value={
                        order?.parts_received_at
                          ? formatIndiaDateTime(order.parts_received_at)
                          : "Awaiting receipt"
                      }
                      done={hasReceived}
                      active={hasOrder && !hasReceived}
                    />
                  </View>

                  {/* CURRENT ACTION */}

                  <View style={styles.cardFooter}>
                    <View style={styles.footerStatusIcon}>
                      {statusLabel(item) === "Parts Received" ? (
                        <Text style={styles.footerStatusIconText}>✓</Text>
                      ) : statusLabel(item) === "Handed to Floor" ? (
                        <Text style={styles.footerStatusIconText}>→</Text>
                      ) : (
                        <Text style={styles.footerStatusIconText}>!</Text>
                      )}
                    </View>

                    <View style={styles.footerCopy}>
                      <Text style={styles.footerTitle}>
                        {statusLabel(item)}
                      </Text>

                      <Text style={styles.footerDescription}>
                        {statusDescription(item)}
                      </Text>
                    </View>

                    <View style={styles.viewButton}>
                      <Text style={styles.viewButtonText}>View</Text>

                      <Text style={styles.viewButtonArrow}>→</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ==================================================
            FOOTER
        ================================================== */}

        <Text style={styles.footer}>PAGARIYA AUTO • STORE WORKSPACE</Text>
      </ScrollView>

      {/* ======================================================
          VEHICLE DETAIL MODAL
      ====================================================== */}

      <Modal
        visible={!!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={closeVehicleDetails}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailModal}>
            <View style={styles.detailHandle} />

            <View style={styles.detailHeader}>
              <View style={styles.detailHeaderInfo}>
                <Text style={styles.detailEyebrow}>STORE VEHICLE</Text>

                <Text style={styles.detailTitle}>
                  {selectedItem?.vehicle.vehicle_no || "Vehicle"}
                </Text>

                <Text style={styles.detailCustomerName}>
                  {selectedItem?.vehicle.customer_name ||
                    "Customer unavailable"}
                </Text>
              </View>

              <Pressable
                onPress={closeVehicleDetails}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            {selectedItem ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailScroll}
              >
                {/* STATUS */}

                <View style={styles.detailStatusCard}>
                  <View style={styles.detailStatusTop}>
                    <Text style={styles.detailStatusLabel}>
                      CURRENT STORE STATUS
                    </Text>

                    <StatusPill item={selectedItem} />
                  </View>

                  <Text style={styles.detailStatusDescription}>
                    {statusDescription(selectedItem)}
                  </Text>
                </View>

                {/* VEHICLE */}

                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={styles.detailSectionIcon}>
                      <Text style={styles.detailSectionIconText}>▰</Text>
                    </View>

                    <Text style={styles.detailSectionTitle}>
                      Vehicle Information
                    </Text>
                  </View>

                  <InfoRow
                    label="Registration"
                    value={selectedItem.vehicle.vehicle_no}
                  />

                  <InfoRow
                    label="Customer"
                    value={selectedItem.vehicle.customer_name}
                  />

                  <InfoRow
                    label="Mobile"
                    value={selectedItem.vehicle.customer_mobile}
                  />

                  <InfoRow
                    label="Vehicle"
                    value={[
                      selectedItem.vehicle.arena_nexa,
                      selectedItem.vehicle.model,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />

                  <InfoRow
                    label="Vehicle Type"
                    value={selectedItem.vehicle.vehicle_type}
                  />

                  <InfoRow label="JC No." value={selectedItem.vehicle.jc_no} />

                  <InfoRow
                    label="Current Stage"
                    value={selectedItem.vehicle.current_stage}
                  />
                </View>

                {/* ADVISOR WORK */}

                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={styles.detailSectionIcon}>
                      <Text style={styles.detailSectionIconText}>W</Text>
                    </View>

                    <Text style={styles.detailSectionTitle}>Advisor Work</Text>
                  </View>

                  <InfoRow
                    label="Work Path"
                    value={normalizeWorkPath(
                      selectedItem.advisorWork?.work_path,
                    )}
                  />

                  <InfoRow
                    label="Parts Required"
                    value={
                      selectedItem.advisorWork?.parts_required ? "Yes" : "No"
                    }
                  />

                  <InfoRow
                    label="Denting Required"
                    value={
                      selectedItem.advisorWork?.denting_required ? "Yes" : "No"
                    }
                  />

                  <InfoRow
                    label="Painting Required"
                    value={
                      selectedItem.advisorWork?.painting_required ? "Yes" : "No"
                    }
                  />

                  {selectedItem.advisorWork?.remarks ? (
                    <InfoRow
                      label="Remarks"
                      value={selectedItem.advisorWork.remarks}
                    />
                  ) : null}
                </View>

                {/* PARTS REQUEST */}

                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={styles.detailSectionIcon}>
                      <Text style={styles.detailSectionIconText}>#</Text>
                    </View>

                    <Text style={styles.detailSectionTitle}>Parts Request</Text>
                  </View>

                  <InfoRow
                    label="Requisition No."
                    value={selectedItem.requisition?.requisition_no}
                  />

                  <InfoRow
                    label="Requested At"
                    value={
                      selectedItem.requisition
                        ? formatIndiaDateTime(
                            selectedItem.requisition.requisition_at,
                          )
                        : null
                    }
                  />

                  <InfoRow
                    label="Status"
                    value={selectedItem.requisition?.status}
                  />

                  <InfoRow
                    label="Remarks"
                    value={selectedItem.requisition?.remarks}
                  />
                </View>

                {/* PART ORDER */}

                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={styles.detailSectionIcon}>
                      <Text style={styles.detailSectionIconText}>O</Text>
                    </View>

                    <Text style={styles.detailSectionTitle}>Part Order</Text>
                  </View>

                  <InfoRow
                    label="Order No."
                    value={selectedItem.order?.part_order_no}
                  />

                  <InfoRow
                    label="Order Type"
                    value={
                      selectedItem.order
                        ? normalizeOrderType(selectedItem.order.order_type)
                        : null
                    }
                  />

                  <InfoRow
                    label="Ordered At"
                    value={
                      selectedItem.order
                        ? formatIndiaDateTime(selectedItem.order.ordered_at)
                        : null
                    }
                  />

                  <InfoRow
                    label="Order Status"
                    value={selectedItem.order?.status}
                  />

                  <InfoRow
                    label="Parts Received"
                    value={
                      selectedItem.order?.parts_received_at
                        ? formatIndiaDateTime(
                            selectedItem.order.parts_received_at,
                          )
                        : "Not received"
                    }
                  />

                  <InfoRow
                    label="Order Remarks"
                    value={selectedItem.order?.remarks}
                  />
                </View>

                {/* WORKFLOW NOTICE */}

                <View style={styles.detailNotice}>
                  <View style={styles.detailNoticeIcon}>
                    <Text style={styles.detailNoticeIconText}>i</Text>
                  </View>

                  <View style={styles.detailNoticeCopy}>
                    <Text style={styles.detailNoticeTitle}>Store workflow</Text>

                    <Text style={styles.detailNoticeText}>
                      Part Order, Receive Parts and Hand to Floor actions will
                      be connected to their dedicated Store workflow screens.
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={closeVehicleDetails}
                  style={({ pressed }) => [
                    styles.detailDoneButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.detailDoneButtonText}>Close</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
        </SafeAreaView>
      </Modal>

      <CustomPopup popup={popup} onClose={closePopup} />
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },

  pressed: {
    opacity: 0.86,
  },

  /* ==========================================================
     TOP BAR
  ========================================================== */

  topBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingRight: 12,
  },

  backArrow: {
    fontSize: 28,
    lineHeight: 28,
    color: colors.text,
    marginRight: 5,
    fontWeight: "400",
  },

  backText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "600",
  },

  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 6,
  },

  brandText: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "800",
    color: colors.text,
  },

  /* ==========================================================
     HERO
  ========================================================== */

  heroCard: {
    minHeight: 245,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.primary,
    marginBottom: 22,
    position: "relative",
  },

  heroCircleOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -65,
    top: -70,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroCircleTwo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    right: 30,
    bottom: -75,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  heroContent: {
    padding: 20,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  workspacePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  workspaceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    marginRight: 6,
  },

  workspacePillText: {
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.14)",
  },

  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: 5,
  },

  livePillText: {
    fontSize: 9,
    letterSpacing: 0.6,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  heroTitle: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },

  heroDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.84)",
    maxWidth: 500,
  },

  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
  },

  heroStat: {
    minWidth: 110,
  },

  heroStatNumber: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  heroStatLabel: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },

  heroStatDivider: {
    width: 1,
    height: 38,
    backgroundColor: "rgba(255,255,255,0.24)",
    marginHorizontal: 18,
  },

  /* ==========================================================
     SECTION HEADER
  ========================================================== */

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sectionHeadingGroup: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    color: colors.text,
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 2,
  },

  refreshButton: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  refreshIcon: {
    fontSize: 16,
    lineHeight: 18,
    color: colors.primary,
    fontWeight: "800",
    marginRight: 5,
  },

  refreshText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },

  /* ==========================================================
     STATS
  ========================================================== */

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
    marginBottom: 25,
  },

  statGridItem: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 10,
  },

  statCard: {
    minHeight: 124,
    padding: 14,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between",
  },

  statCardSelected: {
    backgroundColor: "#FFF5F5",
    borderColor: colors.primary,
  },

  statCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#F3D4D4",
  },

  statIconSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  statIconText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },

  statIconTextSelected: {
    color: "#FFFFFF",
  },

  statActiveMark: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#FDEAEA",
  },

  statActiveMarkText: {
    fontSize: 7,
    letterSpacing: 0.5,
    fontWeight: "800",
    color: colors.primary,
  },

  statNumber: {
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.text,
    marginTop: 10,
  },

  statNumberSelected: {
    color: colors.primary,
  },

  statLabel: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: 1,
  },

  statLabelSelected: {
    color: colors.text,
  },

  /* ==========================================================
     QUEUE
  ========================================================== */

  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  queueHeadingGroup: {
    flex: 1,
  },

  queueTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  queueTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    color: colors.text,
  },

  queueCountBadge: {
    minWidth: 24,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
    marginLeft: 8,
  },

  queueCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },

  queueSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 2,
  },

  adminBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#F3C9C9",
    marginLeft: 8,
  },

  adminBadgeText: {
    fontSize: 9,
    letterSpacing: 0.5,
    fontWeight: "800",
    color: colors.primary,
  },

  filterScroll: {
    paddingBottom: 12,
    paddingRight: 8,
  },

  filterChip: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 12,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },

  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  filterChipTextSelected: {
    color: "#FFFFFF",
  },

  /* ==========================================================
     SEARCH
  ========================================================== */

  searchCard: {
    padding: 14,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },

  searchHeader: {
    marginBottom: 8,
  },

  searchLabel: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  searchHint: {
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },

  searchInputWrapper: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 11,
    paddingRight: 5,
  },

  searchIcon: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.textSecondary,
    marginRight: 5,
  },

  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 5,
    paddingVertical: 0,
    fontSize: 13,
    color: colors.text,
  },

  searchClearButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  searchClearText: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  /* ==========================================================
     VEHICLE CARD
  ========================================================== */

  queueList: {
    gap: 12,
  },

  vehicleCard: {
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
  },

  vehicleCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },

  vehicleCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  vehicleIconBox: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
    marginRight: 11,
  },

  vehicleIcon: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },

  vehicleMainInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },

  vehicleNumber: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: colors.text,
  },

  vehicleCaption: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 2,
  },

  /* ==========================================================
     STATUS PILL
  ========================================================== */

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F5F5F5",
  },

  statusPillRequested: {
    backgroundColor: "#FFF7E5",
  },

  statusPillOrdered: {
    backgroundColor: "#EEF4FF",
  },

  statusPillReceived: {
    backgroundColor: "#ECF9F1",
  },

  statusPillHanded: {
    backgroundColor: "#F1ECFF",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#777777",
    marginRight: 5,
  },

  statusDotRequested: {
    backgroundColor: "#D99800",
  },

  statusDotOrdered: {
    backgroundColor: "#3577D4",
  },

  statusDotReceived: {
    backgroundColor: "#219653",
  },

  statusDotHanded: {
    backgroundColor: "#7856C9",
  },

  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#666666",
  },

  statusPillTextRequested: {
    color: "#9A6900",
  },

  statusPillTextOrdered: {
    color: "#245AA6",
  },

  statusPillTextReceived: {
    color: "#19733D",
  },

  statusPillTextHanded: {
    color: "#6146A4",
  },

  /* ==========================================================
     WORK PATH
  ========================================================== */

  workPathPanel: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: colors.border,
  },

  workPathHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  workPathLabel: {
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.7,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  partsRequiredBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#FFF1F1",
  },

  partsRequiredDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 4,
  },

  partsRequiredText: {
    fontSize: 7,
    letterSpacing: 0.4,
    fontWeight: "800",
    color: colors.primary,
  },

  workPathValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.text,
  },

  workTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 7,
  },

  workTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 5,
    marginBottom: 4,
  },

  workTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  /* ==========================================================
     INFO
  ========================================================== */

  vehicleDetails: {
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 5,
  },

  infoLabel: {
    width: "37%",
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSecondary,
  },

  infoValue: {
    width: "60%",
    fontSize: 11,
    lineHeight: 16,
    color: colors.text,
    fontWeight: "600",
    textAlign: "right",
  },

  /* ==========================================================
     TIMELINE
  ========================================================== */

  timeline: {
    marginTop: 12,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#F2F2F2",
    borderWidth: 1,
    borderColor: colors.border,
  },

  timelineDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  timelineDotActive: {
    backgroundColor: "#FFF1F1",
    borderColor: colors.primary,
  },

  timelineDotText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  timelineDotTextPending: {
    color: colors.textSecondary,
  },

  timelineContent: {
    flex: 1,
    minHeight: 35,
  },

  timelineTitle: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: colors.text,
  },

  timelineValue: {
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSecondary,
    marginTop: 1,
  },

  timelineValueActive: {
    color: colors.primary,
    fontWeight: "700",
  },

  timelineLine: {
    width: 1,
    height: 16,
    marginLeft: 12,
    backgroundColor: colors.border,
  },

  timelineLineDone: {
    backgroundColor: colors.primary,
  },

  /* ==========================================================
     FOOTER / ACTION
  ========================================================== */

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  footerStatusIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
    marginRight: 9,
  },

  footerStatusIconText: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.primary,
  },

  footerCopy: {
    flex: 1,
    paddingRight: 10,
  },

  footerTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: colors.text,
  },

  footerDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },

  viewButton: {
    minHeight: 35,
    paddingHorizontal: 11,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  viewButtonText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  viewButtonArrow: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    marginLeft: 5,
  },

  /* ==========================================================
     EMPTY
  ========================================================== */

  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 34,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECF9F1",
    marginBottom: 12,
  },

  emptyIcon: {
    fontSize: 23,
    fontWeight: "800",
    color: "#219653",
  },

  emptyEyebrow: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1,
    fontWeight: "800",
    color: colors.textSecondary,
    marginBottom: 4,
  },

  emptyTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },

  emptyDescription: {
    maxWidth: 360,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 5,
  },

  emptyButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginTop: 16,
  },

  emptyButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* ==========================================================
     LOADING
  ========================================================== */

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
    marginBottom: 16,
  },

  loadingTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.text,
  },

  loadingSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 5,
  },

  /* ==========================================================
     DETAIL MODAL
  ========================================================== */

  detailOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.42)",
  },

  detailModal: {
    maxHeight: "92%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.background,
    paddingTop: 9,
  },

  detailHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D2D2D2",
    alignSelf: "center",
    marginBottom: 13,
  },

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  detailHeaderInfo: {
    flex: 1,
    paddingRight: 12,
  },

  detailEyebrow: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  detailTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },

  detailCustomerName: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 2,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  closeButtonText: {
    fontSize: 25,
    lineHeight: 27,
    color: colors.textSecondary,
  },

  detailScroll: {
    padding: 18,
    paddingBottom: 35,
  },

  detailStatusCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },

  detailStatusTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailStatusLabel: {
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  detailStatusDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 9,
  },

  detailSection: {
    padding: 14,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },

  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },

  detailSectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
    marginRight: 9,
  },

  detailSectionIconText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primary,
  },

  detailSectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: colors.text,
  },

  detailNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 13,
    borderRadius: 15,
    backgroundColor: "#FFF8E8",
    borderWidth: 1,
    borderColor: "#F1D99C",
    marginBottom: 14,
  },

  detailNoticeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7AA2D",
    marginRight: 9,
  },

  detailNoticeIconText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  detailNoticeCopy: {
    flex: 1,
  },

  detailNoticeTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#745B20",
    marginBottom: 2,
  },

  detailNoticeText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#745B20",
  },

  detailDoneButton: {
    minHeight: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  detailDoneButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* ==========================================================
     POPUP
  ========================================================== */

  popupOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  popupCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 22,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  popupIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
    backgroundColor: "#F0F0F0",
  },

  popupIconSuccess: {
    backgroundColor: "#EAF8EF",
  },

  popupIconError: {
    backgroundColor: "#FDECEC",
  },

  popupIconWarning: {
    backgroundColor: "#FFF5DD",
  },

  popupIconInfo: {
    backgroundColor: "#EDF4FF",
  },

  popupIconText: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "800",
    color: colors.text,
  },

  popupTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.text,
  },

  popupMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 7,
  },

  popupActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 19,
  },

  popupSecondaryButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },

  popupSecondaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  popupPrimaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  popupPrimaryText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* ==========================================================
     FOOTER
  ========================================================== */

  footer: {
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: "700",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 8,
  },
});
