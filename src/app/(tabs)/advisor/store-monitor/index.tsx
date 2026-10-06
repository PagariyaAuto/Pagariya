import { supplementaryRequirements, requirementView } from "../../../../lib/supplementary-store";
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

import { supabase } from "../../../../../lib/supabase";
import { colors } from "../../../../theme";

type UserRole = "advisor" | "ceo_admin";

type StoreFilter =
  | "ALL"
  | "REQUESTED"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "HANDED_TO_FLOOR";

type PopupType = "success" | "error" | "warning" | "info";

type PopupConfig = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
  primaryText?: string;
  onPrimary?: () => void;
};

type Profile = {
  id: string;
  name: string | null;
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

type StoreMonitoringItem = {
  vehicle: Vehicle;
  requisition: PartRequisition | null;
  order: PartOrder | null;
  advisorWork: AdvisorWork | null;
};

const PAGE_SIZE = 25;

const EMPTY_POPUP: PopupConfig = {
  visible: false,
  type: "info",
  title: "",
  message: "",
};

function getStatus(item: StoreMonitoringItem): StoreFilter {
  if (item.order?.status === "HANDED_TO_FLOOR") {
    return "HANDED_TO_FLOOR";
  }

  if (item.order?.status === "RECEIVED") {
    return "RECEIVED";
  }

  if (item.order?.status === "PARTIALLY_RECEIVED") {
    return "PARTIALLY_RECEIVED";
  }

  if (item.order?.status === "ORDERED") {
    return "ORDERED";
  }

  if (item.requisition) {
    return "REQUESTED";
  }

  return "ALL";
}

function getStatusLabel(item: StoreMonitoringItem) {
  switch (getStatus(item)) {
    case "REQUESTED":
      return "Parts Requested";

    case "ORDERED":
      return "Order Created";

    case "PARTIALLY_RECEIVED":
      return "Partially Received";

    case "RECEIVED":
      return "Parts Received";

    case "HANDED_TO_FLOOR":
      return "Handed to Floor";

    default:
      return "Store";
  }
}

function getStatusDescription(item: StoreMonitoringItem) {
  switch (getStatus(item)) {
    case "REQUESTED":
      return "Parts have been requested. Store order is pending.";

    case "ORDERED":
      return "Part order has been created and is awaiting receipt.";

    case "PARTIALLY_RECEIVED":
      return "Some parts have been received. Store processing continues.";

    case "RECEIVED":
      return "Parts are received and waiting for Floor handover.";

    case "HANDED_TO_FLOOR":
      return "Parts have been handed over to Floor.";

    default:
      return "Vehicle is currently associated with Store activity.";
  }
}

function formatDate(value: string | null | undefined) {
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

function showStatusDot(item: StoreMonitoringItem) {
  const status = getStatus(item);

  if (status === "REQUESTED") {
    return styles.dotRequested;
  }

  if (status === "ORDERED") {
    return styles.dotOrdered;
  }

  if (status === "PARTIALLY_RECEIVED") {
    return styles.dotPartial;
  }

  if (status === "RECEIVED") {
    return styles.dotReceived;
  }

  if (status === "HANDED_TO_FLOOR") {
    return styles.dotHanded;
  }

  return styles.dotDefault;
}

function showStatusPill(item: StoreMonitoringItem) {
  const status = getStatus(item);

  if (status === "REQUESTED") {
    return styles.statusRequested;
  }

  if (status === "ORDERED") {
    return styles.statusOrdered;
  }

  if (status === "PARTIALLY_RECEIVED") {
    return styles.statusPartial;
  }

  if (status === "RECEIVED") {
    return styles.statusReceived;
  }

  if (status === "HANDED_TO_FLOOR") {
    return styles.statusHanded;
  }

  return styles.statusDefault;
}

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

  const icon =
    popup.type === "success"
      ? "✓"
      : popup.type === "error"
        ? "×"
        : popup.type === "warning"
          ? "!"
          : "i";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
      <View style={styles.popupOverlay}>
        <View style={styles.popupCard}>
          <View
            style={[
              styles.popupIcon,
              popup.type === "success" && styles.popupIconSuccess,
              popup.type === "error" && styles.popupIconError,
              popup.type === "warning" && styles.popupIconWarning,
            ]}
          >
            <Text style={styles.popupIconText}>{icon}</Text>
          </View>

          <Text style={styles.popupTitle}>{popup.title}</Text>

          <Text style={styles.popupMessage}>{popup.message}</Text>

          <Pressable
            onPress={popup.onPrimary || onClose}
            style={({ pressed }) => [
              styles.popupButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.popupButtonText}>
              {popup.primaryText || "OK"}
            </Text>
          </Pressable>
        </View>
      </View>
      </SafeAreaView>
    </Modal>
  );
}

function StatusPill({ item }: { item: StoreMonitoringItem }) {
  return (
    <View style={[styles.statusPill, showStatusPill(item)]}>
      <View style={[styles.statusDot, showStatusDot(item)]} />

      <Text style={styles.statusText}>{getStatusLabel(item)}</Text>
    </View>
  );
}

export default function StoreMonitorScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [items, setItems] = useState<StoreMonitoringItem[]>([]);

  const [filter, setFilter] = useState<StoreFilter>("ALL");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [popup, setPopup] = useState<PopupConfig>(EMPTY_POPUP);

  const closePopup = useCallback(() => {
    setPopup(EMPTY_POPUP);
  }, []);

  const showPopup = useCallback(
    (
      type: PopupType,
      title: string,
      message: string,
      primaryText = "OK",
      onPrimary?: () => void,
    ) => {
      setPopup({
        visible: true,
        type,
        title,
        message,
        primaryText,
        onPrimary,
      });
    },
    [],
  );

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
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

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id,name,role,is_active")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        const currentProfile = profileData as Profile | null;

        if (!currentProfile) {
          throw new Error("Your user profile could not be loaded.");
        }

        if (!currentProfile.is_active) {
          throw new Error(
            "Your account is inactive. Please contact the CEO Admin.",
          );
        }

        if (
          currentProfile.role !== "advisor" &&
          currentProfile.role !== "ceo_admin"
        ) {
          throw new Error(
            "This section is available only to Advisor and CEO Admin users.",
          );
        }

        const assignedVehicleIds = new Set<string>();
        if (currentProfile.role === "advisor") {
          const { data: assignments, error: assignmentError } = await supabase.from("vehicle_assignments").select("vehicle_id").eq("assigned_to", user.id).eq("assignment_role", "ADVISOR").is("unassigned_at", null);
          if (assignmentError) throw assignmentError;
          assignments?.forEach(assignment => assignedVehicleIds.add(assignment.vehicle_id));
        }

        const [requisitionsResult, ordersResult, advisorWorkResult] =
          await Promise.all([
            supabase
              .from("part_requisitions")
              .select(
                "id,visit_id,vehicle_id,advisor_work_id,supplementary_cycle_id,requisition_no,requisition_at,requested_by,status,remarks,created_at",
              )
              .order("created_at", {
                ascending: false,
              }),

            supabase
              .from("part_orders")
              .select(
                "id,visit_id,vehicle_id,part_requisition_id,part_order_no,order_type,ordered_at,ordered_by,parts_received_at,parts_received_by,status,remarks,created_at",
              )
              .order("created_at", {
                ascending: false,
              }),

            supabase
              .from("advisor_work")
              .select(
                "id,visit_id,vehicle_id,work_path,parts_required,denting_required,painting_required,advisor_requisition_no,requisition_at,assigned_by,remarks",
              )
              ,
          ]);

        if (requisitionsResult.error) {
          throw requisitionsResult.error;
        }

        if (ordersResult.error) {
          throw ordersResult.error;
        }

        if (advisorWorkResult.error) {
          throw advisorWorkResult.error;
        }

        const requisitions = (requisitionsResult.data ||
          []) as PartRequisition[];

        const orders = (ordersResult.data || []) as PartOrder[];

        const advisorWorks = (advisorWorkResult.data || []) as AdvisorWork[];

        const vehicleIds = new Set<string>();

        requisitions.forEach((row) => vehicleIds.add(row.vehicle_id));

        orders.forEach((row) => vehicleIds.add(row.vehicle_id));

        advisorWorks.forEach((row) => vehicleIds.add(row.vehicle_id));

        if (vehicleIds.size === 0) {
          setProfile(currentProfile);
          setItems([]);
          setPage(1);
          return;
        }

        const requisitionByVehicle = new Map<string, PartRequisition>();

        for (const row of requisitions) {
          if (!requisitionByVehicle.has(row.vehicle_id)) {
            requisitionByVehicle.set(row.vehicle_id, row);
          }
        }

        const orderByVehicle = new Map<string, PartOrder>();

        for (const row of orders) {
          if (!orderByVehicle.has(row.vehicle_id)) {
            orderByVehicle.set(row.vehicle_id, row);
          }
        }

        const cycleRequirements = await supplementaryRequirements(requisitions.filter(row => row.supplementary_cycle_id).map(row => row.id));
        const advisorWorkByVehicle = new Map<string, AdvisorWork>();

        for (const row of advisorWorks) {
          if (!advisorWorkByVehicle.has(row.vehicle_id)) {
            advisorWorkByVehicle.set(row.vehicle_id, row);
          }
        }

        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from("vehicles")
          .select(
            "id,vehicle_no,customer_name,customer_mobile,model,arena_nexa,vehicle_type,jc_no,current_stage,current_status,current_assigned_to,stage_started_at",
          )
          .in("id", Array.from(vehicleIds));

        if (vehiclesError) {
          throw vehiclesError;
        }

        const vehicles = (vehiclesData || []) as Vehicle[];

        const result: StoreMonitoringItem[] = [];

        for (const vehicle of vehicles) {
          const requisition = requisitionByVehicle.get(vehicle.id) || null;

          const latestOrder = orderByVehicle.get(vehicle.id) || null;
          const order = !requisition || latestOrder?.part_requisition_id === requisition.id ? latestOrder : null;

          const advisorWork = requirementView(advisorWorkByVehicle.get(vehicle.id) || null, requisition ? cycleRequirements.get(requisition.id) : undefined, requisition);

          if (!requisition && !order) {
            continue;
          }

          if (
            currentProfile.role === "advisor" &&
            !assignedVehicleIds.has(vehicle.id)
          ) {
            continue;
          }

          result.push({
            vehicle,
            requisition,
            order,
            advisorWork,
          });
        }

        result.sort((a, b) => {
          const aDate =
            a.order?.created_at ||
            a.requisition?.created_at ||
            a.vehicle.stage_started_at ||
            "";

          const bDate =
            b.order?.created_at ||
            b.requisition?.created_at ||
            b.vehicle.stage_started_at ||
            "";

          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });

        setProfile(currentProfile);
        setItems(result);
        setPage(1);
      } catch (error: any) {
        console.error("Store monitoring load error:", error);

        showPopup(
          "error",
          "Unable to Load Store Monitoring",
          error?.message ||
            "Something went wrong while loading Store monitoring.",
          "Try Again",
          () => {
            closePopup();
            loadData(true);
          },
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [closePopup, showPopup],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData]),
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (filter !== "ALL" && getStatus(item) !== filter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        item.vehicle.vehicle_no,
        item.vehicle.customer_name,
        item.vehicle.customer_mobile,
        item.vehicle.model,
        item.vehicle.arena_nexa,
        item.vehicle.jc_no,
        item.requisition?.requisition_no,
        item.order?.part_order_no,
        item.order?.order_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [filter, items, search]);

  const counts = useMemo(
    () => ({
      all: items.length,

      requested: items.filter((item) => getStatus(item) === "REQUESTED").length,

      ordered: items.filter((item) => getStatus(item) === "ORDERED").length,

      partial: items.filter((item) => getStatus(item) === "PARTIALLY_RECEIVED")
        .length,

      received: items.filter((item) => getStatus(item) === "RECEIVED").length,

      handed: items.filter((item) => getStatus(item) === "HANDED_TO_FLOOR")
        .length,
    }),
    [items],
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;

    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, safePage]);

  const changeFilter = (nextFilter: StoreFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  /**
   * Store Monitoring is opened from:
   *
   * Advisor Dashboard
   *      ↓
   * Store Monitoring
   *
   * CEO Admin Dashboard
   *      ↓
   * Store Monitoring
   *
   * Therefore Back must explicitly return to the correct dashboard
   * instead of relying on router.back().
   */
  const goBackToDashboard = useCallback(() => {
    if (profile?.role === "advisor") {
      router.replace("/(tabs)/advisor" as never);
      return;
    }

    if (profile?.role === "ceo_admin") {
      router.replace("/(tabs)" as never);
      return;
    }

    router.replace("/(tabs)" as never);
  }, [profile?.role]);

  /**
   * Vehicle card → Store Monitoring Vehicle Details
   */
  const openVehicle = (item: StoreMonitoringItem) => {
    router.push({
      pathname: "/(tabs)/advisor/store-monitor/vehicle-details" as never,
      params: {
        vehicleId: item.vehicle.id,
        visitId:
          item.order?.visit_id ||
          item.requisition?.visit_id ||
          item.advisorWork?.visit_id ||
          "",
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom", "left", "right"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>

          <Text style={styles.loadingTitle}>Loading Store Monitoring</Text>

          <Text style={styles.loadingSubtitle}>
            Checking parts requests, orders and handovers…
          </Text>
        </View>

        <CustomPopup popup={popup} onClose={closePopup} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
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
        <View style={styles.topBar}>
          <Pressable
            onPress={goBackToDashboard}
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

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroEyebrowWrap}>
              <Text style={styles.heroEyebrow}>STORE MONITORING</Text>

              <View style={styles.readOnlyBadge}>
                <Text style={styles.readOnlyText}>READ ONLY</Text>
              </View>
            </View>

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {profile?.role === "ceo_admin" ? "CEO ADMIN" : "ADVISOR"}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Parts & Store Status</Text>

          <Text style={styles.heroDescription}>
            Track Store parts from requisition through order, receipt and Floor
            handover.
          </Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>{counts.all}</Text>

              <Text style={styles.heroStatLabel}>Vehicles</Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>{counts.received}</Text>

              <Text style={styles.heroStatLabel}>Received</Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>{counts.handed}</Text>

              <Text style={styles.heroStatLabel}>Handed Over</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Store Overview</Text>

            <Text style={styles.sectionSubtitle}>Current Store status</Text>
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
              <Text style={styles.refreshText}>↻ Refresh</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryScroll}
        >
          <Pressable
            onPress={() => changeFilter("ALL")}
            style={({ pressed }) => [
              styles.summaryCard,
              filter === "ALL" && styles.summaryCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.summaryNumber}>{counts.all}</Text>

            <Text style={styles.summaryLabel}>All</Text>
          </Pressable>

          <Pressable
            onPress={() => changeFilter("REQUESTED")}
            style={({ pressed }) => [
              styles.summaryCard,
              filter === "REQUESTED" && styles.summaryCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.summaryNumber}>{counts.requested}</Text>

            <Text style={styles.summaryLabel}>Requested</Text>
          </Pressable>

          <Pressable
            onPress={() => changeFilter("ORDERED")}
            style={({ pressed }) => [
              styles.summaryCard,
              filter === "ORDERED" && styles.summaryCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.summaryNumber}>{counts.ordered}</Text>

            <Text style={styles.summaryLabel}>Ordered</Text>
          </Pressable>

          <Pressable
            onPress={() => changeFilter("PARTIALLY_RECEIVED")}
            style={({ pressed }) => [
              styles.summaryCard,
              filter === "PARTIALLY_RECEIVED" && styles.summaryCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.summaryNumber}>{counts.partial}</Text>

            <Text style={styles.summaryLabel}>Partial</Text>
          </Pressable>

          <Pressable
            onPress={() => changeFilter("RECEIVED")}
            style={({ pressed }) => [
              styles.summaryCard,
              filter === "RECEIVED" && styles.summaryCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.summaryNumber}>{counts.received}</Text>

            <Text style={styles.summaryLabel}>Received</Text>
          </Pressable>

          <Pressable
            onPress={() => changeFilter("HANDED_TO_FLOOR")}
            style={({ pressed }) => [
              styles.summaryCard,
              filter === "HANDED_TO_FLOOR" && styles.summaryCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.summaryNumber}>{counts.handed}</Text>

            <Text style={styles.summaryLabel}>Handed Over</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>FIND A VEHICLE</Text>

          <Text style={styles.searchHint}>
            Registration, customer, JC, requisition or part order
          </Text>

          <View style={styles.searchInputWrap}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
              value={search}
              onChangeText={changeSearch}
              placeholder="Search Store activity..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.searchInput}
              returnKeyType="search"
            />

            {search.length > 0 && (
              <Pressable
                onPress={() => changeSearch("")}
                style={({ pressed }) => [
                  styles.clearSearchButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.clearSearchText}>×</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.listHeader}>
          <View style={styles.listHeaderText}>
            <Text style={styles.listTitle}>Store Vehicles</Text>

            <Text style={styles.listSubtitle}>
              {filteredItems.length} matching vehicle
              {filteredItems.length === 1 ? "" : "s"}
            </Text>
          </View>

          <View style={styles.pageInfoBadge}>
            <Text style={styles.pageInfoText}>
              Page {safePage} / {totalPages}
            </Text>
          </View>
        </View>

        {paginatedItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>✓</Text>
            </View>

            <Text style={styles.emptyEyebrow}>STORE MONITORING</Text>

            <Text style={styles.emptyTitle}>
              {items.length === 0
                ? "No Store activity"
                : "No matching vehicles"}
            </Text>

            <Text style={styles.emptyDescription}>
              {items.length === 0
                ? "There are currently no Store part requests or orders available for monitoring."
                : "Try another status filter or change your search term."}
            </Text>

            {items.length > 0 && (
              <Pressable
                onPress={() => {
                  setFilter("ALL");
                  setSearch("");
                  setPage(1);
                }}
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emptyButtonText}>
                  Clear Filter & Search
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.vehicleList}>
            {paginatedItems.map((item) => {
              const vehicle = item.vehicle;

              const received = !!item.order?.parts_received_at;

              const ordered = !!item.order;

              const requested = !!item.requisition;

              return (
                <Pressable
                  key={vehicle.id}
                  onPress={() => openVehicle(item)}
                  style={({ pressed }) => [
                    styles.vehicleCard,
                    pressed && styles.vehicleCardPressed,
                  ]}
                >
                  <View style={styles.vehicleTop}>
                    <View style={styles.vehicleIdentity}>
                      <View style={styles.vehicleIcon}>
                        <Text style={styles.vehicleIconText}>🚘</Text>
                      </View>

                      <View style={styles.vehicleTitleGroup}>
                        <Text style={styles.vehicleNumber} numberOfLines={1}>
                          {vehicle.vehicle_no || "Vehicle"}
                        </Text>

                        <Text style={styles.customerName} numberOfLines={1}>
                          {vehicle.customer_name || "Customer not available"}
                        </Text>
                      </View>
                    </View>

                    <StatusPill item={item} />
                  </View>

                  <View style={styles.vehicleMeta}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Vehicle</Text>

                      <Text style={styles.metaValue} numberOfLines={1}>
                        {[vehicle.arena_nexa, vehicle.model]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Text>
                    </View>

                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>JC No.</Text>

                      <Text style={styles.metaValue} numberOfLines={1}>
                        {vehicle.jc_no || "—"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressRow}>
                    <View style={styles.progressStep}>
                      <View
                        style={[
                          styles.progressDot,
                          requested && styles.progressDotDone,
                        ]}
                      >
                        <Text
                          style={[
                            styles.progressDotText,
                            requested && styles.progressDotTextDone,
                          ]}
                        >
                          {requested ? "✓" : "1"}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.progressText,
                          requested && styles.progressTextDone,
                        ]}
                      >
                        Requested
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.progressLine,
                        ordered && styles.progressLineDone,
                      ]}
                    />

                    <View style={styles.progressStep}>
                      <View
                        style={[
                          styles.progressDot,
                          ordered && styles.progressDotDone,
                        ]}
                      >
                        <Text
                          style={[
                            styles.progressDotText,
                            ordered && styles.progressDotTextDone,
                          ]}
                        >
                          {ordered ? "✓" : "2"}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.progressText,
                          ordered && styles.progressTextDone,
                        ]}
                      >
                        Ordered
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.progressLine,
                        received && styles.progressLineDone,
                      ]}
                    />

                    <View style={styles.progressStep}>
                      <View
                        style={[
                          styles.progressDot,
                          received && styles.progressDotDone,
                        ]}
                      >
                        <Text
                          style={[
                            styles.progressDotText,
                            received && styles.progressDotTextDone,
                          ]}
                        >
                          {received ? "✓" : "3"}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.progressText,
                          received && styles.progressTextDone,
                        ]}
                      >
                        Received
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.footerCopy}>
                      <Text style={styles.footerTitle}>
                        {getStatusLabel(item)}
                      </Text>

                      <Text style={styles.footerDescription} numberOfLines={2}>
                        {getStatusDescription(item)}
                      </Text>
                    </View>

                    <View style={styles.viewButton}>
                      <Text style={styles.viewButtonText}>View</Text>

                      <Text style={styles.viewButtonArrow}>→</Text>
                    </View>
                  </View>

                  {item.order && (
                    <View style={styles.orderSummary}>
                      <View style={styles.orderSummaryItem}>
                        <Text style={styles.orderSummaryLabel}>PART ORDER</Text>

                        <Text
                          style={styles.orderSummaryValue}
                          numberOfLines={1}
                        >
                          {item.order.part_order_no || "—"}
                        </Text>
                      </View>

                      <View style={styles.orderSummaryItem}>
                        <Text style={styles.orderSummaryLabel}>TYPE</Text>

                        <Text style={styles.orderSummaryValue}>
                          {item.order.order_type || "—"}
                        </Text>
                      </View>

                      <View style={styles.orderSummaryItem}>
                        <Text style={styles.orderSummaryLabel}>ORDERED</Text>

                        <Text
                          style={styles.orderSummaryValue}
                          numberOfLines={1}
                        >
                          {formatDate(item.order.ordered_at)}
                        </Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {filteredItems.length > PAGE_SIZE && (
          <View style={styles.pagination}>
            <Pressable
              disabled={safePage <= 1}
              onPress={() => setPage((current) => Math.max(1, current - 1))}
              style={({ pressed }) => [
                styles.paginationButton,
                safePage <= 1 && styles.paginationButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.paginationButtonText,
                  safePage <= 1 && styles.paginationButtonTextDisabled,
                ]}
              >
                ← Previous
              </Text>
            </Pressable>

            <View style={styles.paginationCenter}>
              <Text style={styles.paginationCurrent}>{safePage}</Text>

              <Text style={styles.paginationOf}>of {totalPages}</Text>
            </View>

            <Pressable
              disabled={safePage >= totalPages}
              onPress={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              style={({ pressed }) => [
                styles.paginationButton,
                safePage >= totalPages && styles.paginationButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.paginationButtonText,
                  safePage >= totalPages && styles.paginationButtonTextDisabled,
                ]}
              >
                Next →
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.footer}>PAGARIYA AUTO • STORE MONITORING</Text>
      </ScrollView>

      <CustomPopup popup={popup} onClose={closePopup} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 36,
  },

  pressed: {
    opacity: 0.72,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },

  loadingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },

  loadingSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
  },

  topBar: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  backButton: {
    minHeight: 42,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  backArrow: {
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
    marginRight: 4,
    fontWeight: "300",
  },

  backText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },

  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },

  brandText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: colors.text,
  },

  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    padding: 22,
    marginBottom: 24,
    overflow: "hidden",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroEyebrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },

  heroEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: colors.primaryLight,
  },

  readOnlyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  readOnlyText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#FFFFFF",
  },

  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  roleBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#FFFFFF",
  },

  heroTitle: {
    marginTop: 18,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroDescription: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.82)",
  },

  heroStats: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  heroStat: {
    flex: 1,
  },

  heroStatNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroStatLabel: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.72)",
  },

  heroDivider: {
    width: 1,
    height: 38,
    marginHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },

  refreshButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  refreshText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },

  summaryScroll: {
    paddingBottom: 4,
    paddingRight: 10,
    gap: 10,
  },

  summaryCard: {
    width: 104,
    minHeight: 92,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },

  summaryCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  summaryNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
  },

  summaryLabel: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  searchCard: {
    marginTop: 22,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  searchLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },

  searchHint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },

  searchInputWrap: {
    marginTop: 13,
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  searchIcon: {
    fontSize: 25,
    color: colors.textSecondary,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },

  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  clearSearchText: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.textSecondary,
  },

  listHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  listHeaderText: {
    flex: 1,
  },

  listTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },

  listSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },

  pageInfoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  pageInfoText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  vehicleList: {
    gap: 12,
  },

  vehicleCard: {
    borderRadius: 22,
    padding: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  vehicleCardPressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.86,
  },

  vehicleTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  vehicleIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  vehicleIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    marginRight: 11,
  },

  vehicleIconText: {
    fontSize: 21,
  },

  vehicleTitleGroup: {
    flex: 1,
  },

  vehicleNumber: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
  },

  customerName: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  statusPill: {
    maxWidth: 145,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },

  statusDefault: {
    backgroundColor: colors.background,
  },

  statusRequested: {
    backgroundColor: "#FFF7E8",
    borderColor: "#F3D59A",
  },

  statusOrdered: {
    backgroundColor: "#EEF4FF",
    borderColor: "#C9D9F8",
  },

  statusPartial: {
    backgroundColor: "#FFF4E9",
    borderColor: "#F0C99D",
  },

  statusReceived: {
    backgroundColor: "#ECF8F0",
    borderColor: "#BDE4C9",
  },

  statusHanded: {
    backgroundColor: "#EEF8F7",
    borderColor: "#B9DFDA",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.textSecondary,
    marginRight: 6,
  },

  dotDefault: {
    backgroundColor: colors.textSecondary,
  },

  dotRequested: {
    backgroundColor: "#D28A00",
  },

  dotOrdered: {
    backgroundColor: "#3867C8",
  },

  dotPartial: {
    backgroundColor: "#C46D18",
  },

  dotReceived: {
    backgroundColor: colors.success,
  },

  dotHanded: {
    backgroundColor: "#20877B",
  },

  statusText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.textSecondary,
  },

  vehicleMeta: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    gap: 18,
  },

  metaItem: {
    flex: 1,
  },

  metaLabel: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: colors.textSecondary,
  },

  metaValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },

  progressRow: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
  },

  progressStep: {
    alignItems: "center",
    minWidth: 58,
  },

  progressDot: {
    width: 27,
    height: 27,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },

  progressDotDone: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },

  progressDotText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.textSecondary,
  },

  progressDotTextDone: {
    color: colors.primary,
  },

  progressText: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: "700",
    color: colors.textSecondary,
    textAlign: "center",
  },

  progressTextDone: {
    color: colors.text,
  },

  progressLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    marginBottom: 17,
  },

  progressLineDone: {
    backgroundColor: colors.primary,
  },

  cardFooter: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },

  footerCopy: {
    flex: 1,
    paddingRight: 12,
  },

  footerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  footerDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  viewButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
  },

  viewButtonText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primary,
  },

  viewButtonArrow: {
    marginLeft: 5,
    fontSize: 15,
    fontWeight: "900",
    color: colors.primary,
  },

  orderSummary: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    gap: 10,
  },

  orderSummaryItem: {
    flex: 1,
  },

  orderSummaryLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },

  orderSummaryValue: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "800",
    color: colors.text,
  },

  emptyCard: {
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 34,
    borderRadius: 22,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    marginBottom: 15,
  },

  emptyIcon: {
    fontSize: 25,
    fontWeight: "900",
    color: colors.primary,
  },

  emptyEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },

  emptyTitle: {
    marginTop: 6,
    fontSize: 19,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },

  emptyDescription: {
    marginTop: 7,
    maxWidth: 320,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 18,
    minHeight: 44,
    paddingHorizontal: 17,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  emptyButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  pagination: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  paginationButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  paginationButtonDisabled: {
    opacity: 0.45,
  },

  paginationButtonText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primary,
  },

  paginationButtonTextDisabled: {
    color: colors.textSecondary,
  },

  paginationCenter: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },

  paginationCurrent: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
  },

  paginationOf: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  footer: {
    marginTop: 28,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
    color: colors.textSecondary,
  },

  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  popupCard: {
    width: "100%",
    maxWidth: 390,
    padding: 24,
    borderRadius: 25,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  popupIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    marginBottom: 17,
  },

  popupIconSuccess: {
    backgroundColor: "#EAF7EE",
  },

  popupIconError: {
    backgroundColor: "#FDECEC",
  },

  popupIconWarning: {
    backgroundColor: "#FFF5E5",
  },

  popupIconText: {
    fontSize: 25,
    fontWeight: "900",
    color: colors.primary,
  },

  popupTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },

  popupMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  popupButton: {
    marginTop: 22,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  popupButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
