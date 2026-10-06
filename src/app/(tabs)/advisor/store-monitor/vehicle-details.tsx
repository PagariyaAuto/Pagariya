import { supplementaryRequirements, requirementView } from "../../../../lib/supplementary-store";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
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

import { supabase } from "../../../../../lib/supabase";
import { colors } from "../../../../theme";

/* ============================================================
   TYPES
============================================================ */

type UserRole = "advisor" | "ceo_admin";

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

type StoreDetails = {
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

function normalizeStatus(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  switch (value) {
    case "PENDING":
      return "Pending";

    case "ORDERED":
      return "Ordered";

    case "PARTIALLY_RECEIVED":
      return "Partially Received";

    case "RECEIVED":
      return "Received";

    case "HANDED_TO_FLOOR":
      return "Handed to Floor";

    default:
      return value.replaceAll("_", " ");
  }
}

function getStatus(item: StoreDetails) {
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
    return normalizeStatus(item.requisition.status);
  }

  return "Store";
}

function getStatusDescription(item: StoreDetails) {
  if (item.order?.status === "HANDED_TO_FLOOR") {
    return "Parts have been handed over to Floor.";
  }

  if (item.order?.status === "RECEIVED") {
    return "Parts have been received and are ready for Floor handover.";
  }

  if (item.order?.status === "PARTIALLY_RECEIVED") {
    return "Some parts have been received. Store processing is still in progress.";
  }

  if (item.order?.status === "ORDERED") {
    return "Part order has been created and is awaiting parts receipt.";
  }

  if (item.requisition?.status === "PENDING") {
    return "Advisor has requested parts. Store order creation is pending.";
  }

  return "Store activity is currently being monitored.";
}

function getStatusTone(status: string) {
  switch (status) {
    case "Handed to Floor":
      return "handed";

    case "Parts Received":
      return "received";

    case "Partially Received":
      return "received";

    case "Order Created":
      return "ordered";

    case "Parts Requested":
      return "requested";

    default:
      return "default";
  }
}

function popupIcon(type: PopupType) {
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
            <Text style={styles.popupIconText}>{popupIcon(popup.type)}</Text>
          </View>

          <Text style={styles.popupTitle}>{popup.title}</Text>

          <Text style={styles.popupMessage}>{popup.message}</Text>

          <View style={styles.popupActions}>
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
   INFO ROW
============================================================ */

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string | null | undefined;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue} numberOfLines={4}>
        {value || "—"}
      </Text>
    </View>
  );
}

/* ============================================================
   STATUS PILL
============================================================ */

function StatusPill({ status }: { status: string }) {
  const tone = getStatusTone(status);

  return (
    <View
      style={[
        styles.statusPill,
        tone === "requested" && styles.statusPillRequested,
        tone === "ordered" && styles.statusPillOrdered,
        tone === "received" && styles.statusPillReceived,
        tone === "handed" && styles.statusPillHanded,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          tone === "requested" && styles.statusDotRequested,
          tone === "ordered" && styles.statusDotOrdered,
          tone === "received" && styles.statusDotReceived,
          tone === "handed" && styles.statusDotHanded,
        ]}
      />

      <Text
        style={[
          styles.statusText,
          tone === "requested" && styles.statusTextRequested,
          tone === "ordered" && styles.statusTextOrdered,
          tone === "received" && styles.statusTextReceived,
          tone === "handed" && styles.statusTextHanded,
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

/* ============================================================
   COLLAPSIBLE SECTION
============================================================ */

function CollapsibleSection({
  title,
  subtitle,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.sectionHeaderButton,
          pressed && styles.sectionHeaderPressed,
        ]}
      >
        <View style={styles.sectionIcon}>
          <Text style={styles.sectionIconText}>{icon}</Text>
        </View>

        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>

          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>

        <View
          style={[styles.expandButton, expanded && styles.expandButtonExpanded]}
        >
          <Text
            style={[styles.expandIcon, expanded && styles.expandIconExpanded]}
          >
            {expanded ? "−" : "+"}
          </Text>
        </View>
      </Pressable>

      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

/* ============================================================
   TIMELINE STEP
============================================================ */

function TimelineStep({
  number,
  title,
  description,
  done,
  active,
}: {
  number: string;
  title: string;
  description: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <View style={styles.timelineItem}>
      <View
        style={[
          styles.timelineCircle,
          done && styles.timelineCircleDone,
          active && styles.timelineCircleActive,
        ]}
      >
        <Text
          style={[
            styles.timelineCircleText,
            !done && !active && styles.timelineCircleTextPending,
          ]}
        >
          {done ? "✓" : number}
        </Text>
      </View>

      <View style={styles.timelineCopy}>
        <View style={styles.timelineTitleRow}>
          <Text style={styles.timelineTitle}>{title}</Text>

          {done ? (
            <View style={styles.timelineCompletedBadge}>
              <Text style={styles.timelineCompletedBadgeText}>DONE</Text>
            </View>
          ) : active ? (
            <View style={styles.timelineCurrentBadge}>
              <Text style={styles.timelineCurrentBadgeText}>CURRENT</Text>
            </View>
          ) : null}
        </View>

        <Text
          style={[
            styles.timelineDescription,
            active && styles.timelineDescriptionActive,
          ]}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

/* ============================================================
   MAIN SCREEN
============================================================ */

export default function StoreMonitorVehicleDetailsScreen() {
  const params = useLocalSearchParams<{
    vehicleId?: string;
    visitId?: string;
  }>();

  const vehicleId = Array.isArray(params.vehicleId)
    ? params.vehicleId[0]
    : params.vehicleId;

  const visitId = Array.isArray(params.visitId)
    ? params.visitId[0]
    : params.visitId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [details, setDetails] = useState<StoreDetails | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [popup, setPopup] = useState<PopupConfig>(EMPTY_POPUP);

  /* ==========================================================
     COLLAPSIBLE SECTIONS
  ========================================================== */

  const [vehicleExpanded, setVehicleExpanded] = useState(false);
  const [advisorWorkExpanded, setAdvisorWorkExpanded] = useState(false);

  // Store Workflow intentionally starts OPEN.
  const [workflowExpanded, setWorkflowExpanded] = useState(true);

  const [requisitionExpanded, setRequisitionExpanded] = useState(false);
  const [orderExpanded, setOrderExpanded] = useState(false);

  /* ==========================================================
     POPUP
  ========================================================== */

  const closePopup = useCallback(() => {
    setPopup(EMPTY_POPUP);
  }, []);

  const showError = useCallback((title: string, message: string) => {
    setPopup({
      visible: true,
      type: "error",
      title,
      message,
      primaryText: "OK",
    });
  }, []);

  /* ==========================================================
     EXPLICIT BACK TO STORE MONITORING
  ========================================================== */

  const goBackToStoreMonitoring = useCallback(() => {
    router.replace("/(tabs)/advisor/store-monitor" as never);
  }, []);

  /* ==========================================================
     ANDROID BACK
  ========================================================== */

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        goBackToStoreMonitoring();
        return true;
      },
    );

    return () => subscription.remove();
  }, [goBackToStoreMonitoring]);

  /* ==========================================================
     LOAD DATA
  ========================================================== */

  const loadData = useCallback(
    async (showRefreshing = false) => {
      try {
        if (!vehicleId) {
          throw new Error("Vehicle information is missing.");
        }

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

        const profileResult = await supabase
          .from("profiles")
          .select("id,name,role,is_active")
          .eq("id", user.id)
          .single();

        if (profileResult.error) {
          throw profileResult.error;
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
          profileData.role !== "advisor" &&
          profileData.role !== "ceo_admin"
        ) {
          throw new Error(
            "This monitoring workspace is available only to Advisor and CEO Admin users.",
          );
        }

        /* ======================================================
           VEHICLE
        ====================================================== */

        const vehicleResult = await supabase
          .from("vehicles")
          .select(
            "id,vehicle_no,customer_name,customer_mobile,model,arena_nexa,vehicle_type,jc_no,current_stage,current_status,current_assigned_to,stage_started_at",
          )
          .eq("id", vehicleId)
          .single();

        if (vehicleResult.error) {
          throw vehicleResult.error;
        }

        const vehicle = vehicleResult.data as Vehicle;

        /* ======================================================
           ADVISOR SCOPE
        ====================================================== */

        if (profileData.role === "advisor") {
          const { data: assignments, error: assignmentError } = await supabase.from("vehicle_assignments").select("id").eq("vehicle_id", vehicleId).eq("assigned_to", user.id).eq("assignment_role", "ADVISOR").is("unassigned_at", null).limit(1);
          if (assignmentError) throw assignmentError;
          if (!assignments?.length) throw new Error("You can only monitor Store activity for vehicles assigned to you.");
        }

        /* ======================================================
           PART REQUISITIONS
        ====================================================== */

        let requisitionQuery = supabase
          .from("part_requisitions")
          .select(
            "id,visit_id,vehicle_id,advisor_work_id,supplementary_cycle_id,requisition_no,requisition_at,requested_by,status,remarks,created_at",
          )
          .eq("vehicle_id", vehicleId)
          .order("created_at", {
            ascending: false,
          })
          .limit(1);

        if (visitId) {
          requisitionQuery = requisitionQuery.eq("visit_id", visitId);
        }

        const requisitionResult = await requisitionQuery;

        if (requisitionResult.error) {
          throw requisitionResult.error;
        }

        const requisition =
          ((requisitionResult.data || [])[0] as PartRequisition | undefined) ||
          null;

        /* ======================================================
           PART ORDERS
        ====================================================== */

        let orderQuery = supabase
          .from("part_orders")
          .select(
            "id,visit_id,vehicle_id,part_requisition_id,part_order_no,order_type,ordered_at,ordered_by,parts_received_at,parts_received_by,status,remarks,created_at",
          )
          .eq("vehicle_id", vehicleId)
          .order("created_at", {
            ascending: false,
          })
          .limit(1);

        if (visitId) {
          orderQuery = orderQuery.eq("visit_id", visitId);
        }

        if (requisition) orderQuery = orderQuery.eq("part_requisition_id", requisition.id);
        const orderResult = await orderQuery;

        if (orderResult.error) {
          throw orderResult.error;
        }

        const order =
          ((orderResult.data || [])[0] as PartOrder | undefined) || null;

        /* ======================================================
           ADVISOR WORK
        ====================================================== */

        let advisorWorkQuery = supabase
          .from("advisor_work")
          .select(
            "id,visit_id,vehicle_id,work_path,parts_required,denting_required,painting_required,advisor_requisition_no,requisition_at,assigned_by,remarks",
          )
          .eq("vehicle_id", vehicleId)
          .order("requisition_at", {
            ascending: false,
          })
          .limit(1);

        if (visitId) {
          advisorWorkQuery = advisorWorkQuery.eq("visit_id", visitId);
        }

        const advisorWorkResult = await advisorWorkQuery;

        if (advisorWorkResult.error) {
          throw advisorWorkResult.error;
        }

        let advisorWork =
          ((advisorWorkResult.data || [])[0] as AdvisorWork | undefined) ||
          null;

        const requirements = await supplementaryRequirements(requisition?.supplementary_cycle_id ? [requisition.id] : []);
        advisorWork = requirementView(advisorWork, requisition ? requirements.get(requisition.id) : undefined, requisition);

        setProfile(profileData);

        setDetails({
          vehicle,
          requisition,
          order,
          advisorWork,
        });

        setLastUpdated(new Date().toISOString());
      } catch (error: any) {
        console.error("Store monitor vehicle details error:", error);

        setDetails(null);

        showError(
          "Unable to Load Vehicle",
          error?.message ||
            "The Store monitoring details could not be loaded. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showError, vehicleId, visitId],
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  /* ==========================================================
     DERIVED STATUS
  ========================================================== */

  const currentStatus = useMemo(() => {
    if (!details) {
      return "Store";
    }

    return getStatus(details);
  }, [details]);

  const currentStatusDescription = useMemo(() => {
    if (!details) {
      return "Store activity is currently being monitored.";
    }

    return getStatusDescription(details);
  }, [details]);

  const hasRequisition = !!details?.requisition;
  const hasOrder = !!details?.order;
  const hasReceived = !!details?.order?.parts_received_at;
  const handedToFloor = details?.order?.status === "HANDED_TO_FLOOR";

  /* ==========================================================
     LOADING
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

          <Text style={styles.loadingTitle}>Loading Store Monitoring</Text>

          <Text style={styles.loadingSubtitle}>
            Fetching vehicle and parts activity…
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
            onPress={goBackToStoreMonitoring}
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
                    ? "CEO ADMIN MONITORING"
                    : "ADVISOR MONITORING"}
                </Text>
              </View>

              <View style={styles.readOnlyPill}>
                <Text style={styles.readOnlyText}>READ ONLY</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>
              {details?.vehicle.vehicle_no || "Vehicle Details"}
            </Text>

            <Text style={styles.heroCustomer}>
              {details?.vehicle.customer_name || "Customer unavailable"}
            </Text>

            <Text style={styles.heroVehicle}>
              {[
                details?.vehicle.arena_nexa,
                details?.vehicle.model,
                details?.vehicle.vehicle_type,
              ]
                .filter(Boolean)
                .join(" · ") || "Vehicle information unavailable"}
            </Text>

            <Text style={styles.heroDescription}>
              Monitor the complete Store parts workflow for this vehicle.
            </Text>

            <View style={styles.heroStatusRow}>
              <StatusPill status={currentStatus} />
            </View>

            <View style={styles.heroCurrentStatus}>
              <Text style={styles.heroCurrentStatusLabel}>CURRENT STATUS</Text>

              <Text style={styles.heroCurrentStatusText}>
                {currentStatusDescription}
              </Text>
            </View>

            {lastUpdated ? (
              <Text style={styles.lastUpdated}>
                Last updated {formatIndiaDateTime(lastUpdated)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ==================================================
            VEHICLE INFORMATION
        ================================================== */}

        <CollapsibleSection
          title="Vehicle Information"
          subtitle="Current vehicle and job card details"
          icon="▰"
          expanded={vehicleExpanded}
          onToggle={() => setVehicleExpanded((value) => !value)}
        >
          <View style={styles.card}>
            <InfoRow label="Registration" value={details?.vehicle.vehicle_no} />

            <InfoRow label="Customer" value={details?.vehicle.customer_name} />

            <InfoRow label="Mobile" value={details?.vehicle.customer_mobile} />

            <InfoRow
              label="Vehicle"
              value={[details?.vehicle.arena_nexa, details?.vehicle.model]
                .filter(Boolean)
                .join(" · ")}
            />

            <InfoRow
              label="Vehicle Type"
              value={details?.vehicle.vehicle_type}
            />

            <InfoRow label="JC No." value={details?.vehicle.jc_no} />

            <InfoRow
              label="Current Stage"
              value={details?.vehicle.current_stage}
            />

            <InfoRow
              label="Current Status"
              value={details?.vehicle.current_status}
              last
            />
          </View>
        </CollapsibleSection>

        {/* ==================================================
            ADVISOR WORK
        ================================================== */}

        {details?.advisorWork ? (
          <CollapsibleSection
            title="Advisor Work"
            subtitle="Work requirement associated with this vehicle"
            icon="W"
            expanded={advisorWorkExpanded}
            onToggle={() => setAdvisorWorkExpanded((value) => !value)}
          >
            <View style={styles.card}>
              <InfoRow
                label="Work Path"
                value={normalizeWorkPath(details.advisorWork.work_path)}
              />

              <InfoRow
                label="Parts Required"
                value={details.advisorWork.parts_required ? "Yes" : "No"}
              />

              <InfoRow
                label="Denting Required"
                value={details.advisorWork.denting_required ? "Yes" : "No"}
              />

              <InfoRow
                label="Painting Required"
                value={details.advisorWork.painting_required ? "Yes" : "No"}
              />

              <InfoRow
                label="Advisor Requisition"
                value={details.advisorWork.advisor_requisition_no}
              />

              {details.advisorWork.remarks ? (
                <InfoRow
                  label="Remarks"
                  value={details.advisorWork.remarks}
                  last
                />
              ) : null}
            </View>
          </CollapsibleSection>
        ) : null}

        {/* ==================================================
            STORE WORKFLOW
        ================================================== */}

        <CollapsibleSection
          title="Store Workflow"
          subtitle="Parts request through Floor handover"
          icon="#"
          expanded={workflowExpanded}
          onToggle={() => setWorkflowExpanded((value) => !value)}
        >
          <View style={styles.workflowCard}>
            <TimelineStep
              number="1"
              title="Parts Requested"
              description={
                hasRequisition
                  ? `${
                      details?.requisition?.requisition_no || "Request"
                    } · ${formatIndiaDateTime(
                      details?.requisition?.requisition_at,
                    )}`
                  : "No parts requisition recorded"
              }
              done={hasRequisition}
              active={!hasRequisition && !!details?.advisorWork?.parts_required}
            />

            <View
              style={[
                styles.timelineConnector,
                hasOrder && styles.timelineConnectorDone,
              ]}
            />

            <TimelineStep
              number="2"
              title="Part Order"
              description={
                hasOrder
                  ? `${
                      details?.order?.part_order_no || "Order"
                    } · ${normalizeOrderType(details?.order?.order_type)}`
                  : "Part order not created"
              }
              done={hasOrder}
              active={hasRequisition && !hasOrder}
            />

            <View
              style={[
                styles.timelineConnector,
                hasReceived && styles.timelineConnectorDone,
              ]}
            />

            <TimelineStep
              number="3"
              title="Parts Received"
              description={
                hasReceived
                  ? formatIndiaDateTime(details?.order?.parts_received_at)
                  : "Parts not received"
              }
              done={hasReceived}
              active={hasOrder && !hasReceived}
            />

            <View
              style={[
                styles.timelineConnector,
                handedToFloor && styles.timelineConnectorDone,
              ]}
            />

            <TimelineStep
              number="4"
              title="Handed to Floor"
              description={
                handedToFloor
                  ? "Parts have been handed over to Floor."
                  : "Awaiting Store handover to Floor"
              }
              done={handedToFloor}
              active={hasReceived && !handedToFloor}
            />
          </View>
        </CollapsibleSection>

        {/* ==================================================
            PARTS REQUEST
        ================================================== */}

        {hasRequisition ? (
          <CollapsibleSection
            title="Part Requisition"
            subtitle="Request created by the Advisor workflow"
            icon="R"
            expanded={requisitionExpanded}
            onToggle={() => setRequisitionExpanded((value) => !value)}
          >
            <View style={styles.card}>
              <View style={styles.detailHighlight}>
                <View style={styles.detailHighlightCopy}>
                  <Text style={styles.detailHighlightLabel}>
                    REQUISITION NUMBER
                  </Text>

                  <Text style={styles.detailHighlightValue}>
                    {details?.requisition?.requisition_no || "—"}
                  </Text>
                </View>

                <StatusPill
                  status={normalizeStatus(details?.requisition?.status)}
                />
              </View>

              <InfoRow
                label="Requested At"
                value={
                  details?.requisition
                    ? formatIndiaDateTime(details.requisition.requisition_at)
                    : null
                }
              />

              <InfoRow
                label="Status"
                value={normalizeStatus(details?.requisition?.status)}
              />

              <InfoRow
                label="Remarks"
                value={details?.requisition?.remarks}
                last
              />
            </View>
          </CollapsibleSection>
        ) : null}

        {/* ==================================================
            PART ORDER
        ================================================== */}

        {hasOrder ? (
          <CollapsibleSection
            title="Part Order"
            subtitle="Current Store order information"
            icon="O"
            expanded={orderExpanded}
            onToggle={() => setOrderExpanded((value) => !value)}
          >
            <View style={styles.card}>
              <View style={styles.detailHighlight}>
                <View style={styles.detailHighlightCopy}>
                  <Text style={styles.detailHighlightLabel}>
                    PART ORDER NUMBER
                  </Text>

                  <Text style={styles.detailHighlightValue}>
                    {details?.order?.part_order_no || "—"}
                  </Text>
                </View>

                <StatusPill status={normalizeStatus(details?.order?.status)} />
              </View>

              <InfoRow
                label="Order Type"
                value={
                  details?.order
                    ? normalizeOrderType(details.order.order_type)
                    : null
                }
              />

              <InfoRow
                label="Ordered At"
                value={
                  details?.order
                    ? formatIndiaDateTime(details.order.ordered_at)
                    : null
                }
              />

              <InfoRow
                label="Order Status"
                value={normalizeStatus(details?.order?.status)}
              />

              <InfoRow
                label="Parts Received"
                value={
                  details?.order?.parts_received_at
                    ? formatIndiaDateTime(details.order.parts_received_at)
                    : "Not received"
                }
              />

              <InfoRow
                label="Order Remarks"
                value={details?.order?.remarks}
                last
              />
            </View>
          </CollapsibleSection>
        ) : null}

        {/* ==================================================
            MONITORING NOTICE
        ================================================== */}

        <View style={styles.noticeCard}>
          <View style={styles.noticeIcon}>
            <Text style={styles.noticeIconText}>i</Text>
          </View>

          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Monitoring Only</Text>

            <Text style={styles.noticeText}>
              This screen is intentionally read-only. Advisor and CEO Admin can
              monitor Store progress here, but cannot create orders, receive
              parts, hand over parts, or modify Store records.
            </Text>
          </View>
        </View>

        {/* ==================================================
            REFRESH
        ================================================== */}

        <Pressable
          onPress={() => loadData(true)}
          disabled={refreshing}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
          ]}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.refreshIcon}>↻</Text>

              <Text style={styles.refreshButtonText}>Refresh Store Status</Text>
            </>
          )}
        </Pressable>

        {/* ==================================================
            BACK
        ================================================== */}

        <Pressable
          onPress={goBackToStoreMonitoring}
          style={({ pressed }) => [
            styles.backBottomButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backBottomButtonText}>
            Back to Store Monitoring
          </Text>
        </Pressable>

        <Text style={styles.footer}>PAGARIYA AUTO • STORE MONITORING</Text>
      </ScrollView>

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
    paddingBottom: 34,
  },

  pressed: {
    opacity: 0.84,
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
  },

  backText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
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
    minHeight: 310,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.primary,
    marginBottom: 22,
    position: "relative",
  },

  heroCircleOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -75,
    top: -80,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroCircleTwo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    right: 35,
    bottom: -80,
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
    fontSize: 9,
    letterSpacing: 0.7,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  readOnlyPill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  readOnlyText: {
    fontSize: 8,
    letterSpacing: 0.6,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  heroTitle: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  heroCustomer: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: "rgba(255,255,255,0.88)",
    marginTop: 3,
  },

  heroVehicle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,0.76)",
    marginTop: 3,
  },

  heroDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.74)",
    marginTop: 9,
  },

  heroStatusRow: {
    flexDirection: "row",
    marginTop: 15,
  },

  heroCurrentStatus: {
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
  },

  heroCurrentStatusLabel: {
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: "900",
    color: "rgba(255,255,255,0.58)",
  },

  heroCurrentStatusText: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,0.88)",
    marginTop: 3,
  },

  lastUpdated: {
    fontSize: 9,
    lineHeight: 14,
    color: "rgba(255,255,255,0.54)",
    marginTop: 9,
  },

  /* ==========================================================
     SECTIONS
  ========================================================== */

  section: {
    marginBottom: 13,
  },

  sectionHeaderButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 14,
  },

  sectionHeaderPressed: {
    backgroundColor: "rgba(0,0,0,0.025)",
  },

  sectionIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
    marginRight: 10,
  },

  sectionIconText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.primary,
  },

  sectionHeaderCopy: {
    flex: 1,
    paddingRight: 8,
  },

  sectionTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.text,
  },

  sectionSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSecondary,
    marginTop: 1,
  },

  expandButton: {
    width: 31,
    height: 31,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  expandButtonExpanded: {
    backgroundColor: "#FFF1F1",
    borderColor: "#F2D5D5",
  },

  expandIcon: {
    fontSize: 19,
    lineHeight: 21,
    fontWeight: "500",
    color: colors.textSecondary,
  },

  expandIconExpanded: {
    color: colors.primary,
  },

  sectionBody: {
    marginTop: 2,
  },

  card: {
    padding: 14,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  /* ==========================================================
     INFO
  ========================================================== */

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  infoRowLast: {
    borderBottomWidth: 0,
  },

  infoLabel: {
    width: "37%",
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  infoValue: {
    width: "60%",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },

  /* ==========================================================
     DETAIL HIGHLIGHT
  ========================================================== */

  detailHighlight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  detailHighlightCopy: {
    flex: 1,
    paddingRight: 10,
  },

  detailHighlightLabel: {
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    fontWeight: "900",
    color: colors.textSecondary,
  },

  detailHighlightValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },

  /* ==========================================================
     STATUS
  ========================================================== */

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F3F3F3",
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

  statusText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#666666",
  },

  statusTextRequested: {
    color: "#9A6900",
  },

  statusTextOrdered: {
    color: "#245AA6",
  },

  statusTextReceived: {
    color: "#19733D",
  },

  statusTextHanded: {
    color: "#6146A4",
  },

  /* ==========================================================
     WORKFLOW
  ========================================================== */

  workflowCard: {
    padding: 16,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  timelineCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F2",
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 11,
  },

  timelineCircleDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  timelineCircleActive: {
    backgroundColor: "#FFF1F1",
    borderColor: colors.primary,
    borderWidth: 2,
  },

  timelineCircleText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  timelineCircleTextPending: {
    color: colors.textSecondary,
  },

  timelineCopy: {
    flex: 1,
    minHeight: 42,
    paddingTop: 1,
  },

  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  timelineTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.text,
  },

  timelineCompletedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#ECF9F1",
    marginLeft: 7,
  },

  timelineCompletedBadgeText: {
    fontSize: 7,
    letterSpacing: 0.5,
    fontWeight: "900",
    color: "#19733D",
  },

  timelineCurrentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FFF1F1",
    marginLeft: 7,
  },

  timelineCurrentBadgeText: {
    fontSize: 7,
    letterSpacing: 0.5,
    fontWeight: "900",
    color: colors.primary,
  },

  timelineDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 2,
  },

  timelineDescriptionActive: {
    color: colors.primary,
    fontWeight: "700",
  },

  timelineConnector: {
    width: 1,
    height: 21,
    backgroundColor: colors.border,
    marginLeft: 14,
  },

  timelineConnectorDone: {
    backgroundColor: colors.primary,
  },

  /* ==========================================================
     NOTICE
  ========================================================== */

  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 17,
    backgroundColor: "#FFF8E8",
    borderWidth: 1,
    borderColor: "#F1D99C",
    marginTop: 2,
    marginBottom: 15,
  },

  noticeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7AA2D",
    marginRight: 10,
  },

  noticeIconText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  noticeCopy: {
    flex: 1,
  },

  noticeTitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: "#745B20",
  },

  noticeText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#745B20",
    marginTop: 2,
  },

  /* ==========================================================
     BUTTONS
  ========================================================== */

  refreshButton: {
    minHeight: 46,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginBottom: 10,
  },

  refreshIcon: {
    fontSize: 17,
    lineHeight: 19,
    fontWeight: "900",
    color: "#FFFFFF",
    marginRight: 6,
  },

  refreshButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  backBottomButton: {
    minHeight: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  backBottomButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
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
    width: 64,
    height: 64,
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
     FOOTER
  ========================================================== */

  footer: {
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: "700",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 22,
    marginBottom: 7,
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

  popupPrimaryButton: {
    minHeight: 42,
    paddingHorizontal: 17,
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
});
