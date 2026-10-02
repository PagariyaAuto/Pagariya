import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { colors, spacing, typography } from "../../../theme";

/* ============================================================
   TYPES
============================================================ */

type Profile = {
  id: string;
  name: string | null;
  role: string;
  is_active: boolean;
};

type WorkshopVisit = {
  id: string;
  vehicle_id: string;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  stage_started_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type Vehicle = {
  id: string;
  vehicle_no: string;
  jc_no: string | null;
  model: string | null;
  arena_nexa: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_type: string | null;
  current_stage: string | null;
  current_status: string | null;
  current_assigned_to: string | null;
  stage_started_at: string | null;
};

type ApprovalCycle = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  cycle_no: number;
  cycle_type: string | null;
  decision: string;
  approval_received_at: string | null;
  approval_hold_at: string | null;
  approval_hold_remark: string | null;
  decided_by: string | null;
  remarks: string | null;
  created_at: string | null;
};

/*
 * IMPORTANT:
 * The surveys table does NOT contain approval_status,
 * approval_received_at, survey_completed_at, etc.
 *
 * Those workflow values are stored in vehicle_jobs.
 */
type Survey = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  survey_no: number;
  survey_type: string;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  paid_amount: number | null;
  receipt_reference_no: string | null;
  remarks: string | null;
  created_at: string;
};

/*
 * Current workflow claim / estimate / approval information
 * comes from vehicle_jobs.
 */
type VehicleJob = {
  id: string;
  vehicle_id: string;
  advisor_id: string | null;
  job_type: string;
  job_card_no: string | null;
  vehicle_type: string | null;
  arena_nexa: string | null;
  insurance_company_id: string | null;
  claim_intimation_at: string | null;
  estimate_id: string | null;
  claim_no: string | null;
  survey_at: string | null;
  approval_status: string | null;
  approval_by_type: string | null;
  approval_at: string | null;
  approval_remarks: string | null;
  partial_approval_choice: string | null;
  customer_approval_at: string | null;
  paid_job_remarks: string | null;
  advisor_remarks: string | null;
  current_job_stage: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Assignment = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  assignment_role: string | null;
  assigned_at: string | null;
  unassigned_at: string | null;
  remarks: string | null;
};

type WorkflowEvent = {
  id: string;
  event_type: string;
  stage_before: string | null;
  stage_after: string | null;
  status_before: string | null;
  status_after: string | null;
  performed_by: string | null;
  performed_at: string | null;
  remarks: string | null;
};

type EventPerson = {
  id: string;
  name: string | null;
};

type PopupType = "info" | "success" | "error" | "warning";

type PopupConfig = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
};

/* ============================================================
   HELPERS
============================================================ */

function formatIndiaDateTime(value: string | null | undefined): string {
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

function formatIndiaDate(value: string | null | undefined): string {
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
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function normalizeVehicleType(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  if (value === "PRIVATE") {
    return "Private";
  }

  if (value === "COMMERCIAL") {
    return "Commercial";
  }

  return value.replaceAll("_", " ");
}

function normalizeStage(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeStatus(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeJobType(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  if (value === "INSURANCE") {
    return "Insurance";
  }

  if (value === "PAID") {
    return "Paid";
  }

  return normalizeStage(value);
}

function normalizeApprovalStatus(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  if (value === "PENDING") {
    return "Pending";
  }

  if (value === "APPROVED") {
    return "Approved";
  }

  if (value === "REJECTED") {
    return "Rejected";
  }

  if (value === "PARTIAL") {
    return "Partial";
  }

  return normalizeStage(value);
}

function normalizeApprovalByType(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  if (value === "CUSTOMER") {
    return "Customer";
  }

  if (value === "INSURANCE") {
    return "Insurance";
  }

  return normalizeStage(value);
}

function normalizePartialChoice(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  if (value === "PAY_REMAINDER") {
    return "Customer Pays Remainder";
  }

  if (value === "REPAIR_APPROVED_SCOPE") {
    return "Repair Approved Scope";
  }

  return normalizeStage(value);
}

function getHoldDays(
  holdAt: string | null | undefined,
  stageStartedAt: string | null | undefined,
): number {
  const startValue = holdAt || stageStartedAt;

  if (!startValue) {
    return 0;
  }

  const startTime = new Date(startValue).getTime();

  if (!Number.isFinite(startTime)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - startTime) / (24 * 60 * 60 * 1000)),
  );
}

function cleanText(value: string): string | null {
  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

/* ============================================================
   POPUP ICON
============================================================ */

function getPopupIcon(type: PopupType) {
  switch (type) {
    case "success":
      return "checkmark-circle-outline";

    case "error":
      return "close-circle-outline";

    case "warning":
      return "warning-outline";

    default:
      return "information-circle-outline";
  }
}

function getPopupIconColor(type: PopupType) {
  switch (type) {
    case "success":
      return "#18794E";

    case "error":
      return "#B42318";

    case "warning":
      return "#8A5A00";

    default:
      return colors.primary;
  }
}

/* ============================================================
   SCREEN
============================================================ */

export default function ApprovalHoldDetailsScreen() {
  const params = useLocalSearchParams<{
    visitId?: string;
    vehicleId?: string;
  }>();

  const visitId = Array.isArray(params.visitId)
    ? params.visitId[0]
    : params.visitId;

  const vehicleId = Array.isArray(params.vehicleId)
    ? params.vehicleId[0]
    : params.vehicleId;

  const [profile, setProfile] = useState<Profile | null>(null);

  const [visit, setVisit] = useState<WorkshopVisit | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [hold, setHold] = useState<ApprovalCycle | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [vehicleJob, setVehicleJob] = useState<VehicleJob | null>(null);

  const [assignment, setAssignment] = useState<Assignment | null>(null);

  const [assignedAdvisorName, setAssignedAdvisorName] = useState<string | null>(
    null,
  );

  const [heldByName, setHeldByName] = useState<string | null>(null);

  const [events, setEvents] = useState<WorkflowEvent[]>([]);

  const [eventPeople, setEventPeople] = useState<Map<string, string>>(
    new Map(),
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [resolveRemarks, setResolveRemarks] = useState("");

  const [popup, setPopup] = useState<PopupConfig>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  /* ==========================================================
     POPUP HELPERS
  ========================================================== */

  const closePopup = useCallback(() => {
    setPopup((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  const showPopup = useCallback((config: Omit<PopupConfig, "visible">) => {
    setPopup({
      visible: true,
      ...config,
    });
  }, []);

  /* ==========================================================
     LOAD DETAILS
  ========================================================== */

  const loadDetails = useCallback(
    async (isRefresh = false) => {
      try {
        if (!visitId || !vehicleId) {
          throw new Error(
            "Approval Hold details could not be opened because visit or vehicle information is missing.",
          );
        }

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        /* ------------------------------------------------------
           AUTH
        ------------------------------------------------------ */

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

        /* ------------------------------------------------------
           PROFILE
        ------------------------------------------------------ */

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id,name,role,is_active")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        const currentProfile = profileData as Profile;

        if (!currentProfile.is_active) {
          throw new Error(
            "Your user account is inactive. Please contact an administrator.",
          );
        }

        if (!["advisor", "ceo_admin"].includes(currentProfile.role)) {
          throw new Error(
            "Only an Advisor or CEO Admin can view Approval Hold details.",
          );
        }

        setProfile(currentProfile);

        /* ------------------------------------------------------
           WORKSHOP VISIT
        ------------------------------------------------------ */

        const { data: visitData, error: visitError } = await supabase
          .from("workshop_visits")
          .select(
            "id,vehicle_id,current_stage,current_status,current_assigned_to,stage_started_at,created_at,updated_at",
          )
          .eq("id", visitId)
          .eq("vehicle_id", vehicleId)
          .single();

        if (visitError) {
          throw visitError;
        }

        const currentVisit = visitData as WorkshopVisit;

        if (
          currentVisit.current_stage !== "APPROVAL_HOLD" ||
          currentVisit.current_status !== "ON_HOLD"
        ) {
          throw new Error(
            "This vehicle is no longer on Approval Hold. Please refresh the Approval Hold queue.",
          );
        }

        /*
         * UI ownership check.
         *
         * The secure Resolve RPC performs its own
         * backend authorization check as well.
         */
        if (
          currentProfile.role === "advisor" &&
          currentVisit.current_assigned_to !== user.id
        ) {
          throw new Error("You are not the Advisor assigned to this vehicle.");
        }

        setVisit(currentVisit);

        /* ------------------------------------------------------
           VEHICLE
        ------------------------------------------------------ */

        const { data: vehicleData, error: vehicleError } = await supabase
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
              current_stage,
              current_status,
              current_assigned_to,
              stage_started_at
            `,
          )
          .eq("id", vehicleId)
          .single();

        if (vehicleError) {
          throw vehicleError;
        }

        setVehicle(vehicleData as Vehicle);

        /* ------------------------------------------------------
           PARALLEL RELATED DATA
        ------------------------------------------------------ */

        const [
          holdResult,
          surveyResult,
          vehicleJobResult,
          assignmentResult,
          eventsResult,
        ] = await Promise.all([
          /*
           * Latest Approval Hold cycle.
           */
          supabase
            .from("approval_cycles")
            .select(
              `
                id,
                visit_id,
                vehicle_id,
                cycle_no,
                cycle_type,
                decision,
                approval_received_at,
                approval_hold_at,
                approval_hold_remark,
                decided_by,
                remarks,
                created_at
              `,
            )
            .eq("visit_id", visitId)
            .eq("vehicle_id", vehicleId)
            .eq("decision", "APPROVAL_HOLD")
            .not("approval_hold_at", "is", null)
            .order("cycle_no", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),

          /*
           * Survey table:
           *
           * completed_at
           * paid_amount
           * receipt_reference_no
           * remarks
           */
          supabase
            .from("surveys")
            .select(
              `
                id,
                visit_id,
                vehicle_id,
                survey_no,
                survey_type,
                started_at,
                completed_at,
                completed_by,
                paid_amount,
                receipt_reference_no,
                remarks,
                created_at
              `,
            )
            .eq("visit_id", visitId)
            .eq("vehicle_id", vehicleId)
            .order("survey_no", {
              ascending: false,
            })
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),

          /*
           * IMPORTANT:
           *
           * Claim / estimate / approval information
           * belongs to vehicle_jobs.
           */
          supabase
            .from("vehicle_jobs")
            .select(
              `
                id,
                vehicle_id,
                advisor_id,
                job_type,
                job_card_no,
                vehicle_type,
                arena_nexa,
                insurance_company_id,
                claim_intimation_at,
                estimate_id,
                claim_no,
                survey_at,
                approval_status,
                approval_by_type,
                approval_at,
                approval_remarks,
                partial_approval_choice,
                customer_approval_at,
                paid_job_remarks,
                advisor_remarks,
                current_job_stage,
                created_at,
                updated_at
              `,
            )
            .eq("vehicle_id", vehicleId)
            .maybeSingle(),

          /*
           * Current active assignment.
           */
          supabase
            .from("vehicle_assignments")
            .select(
              "id,visit_id,vehicle_id,assigned_to,assigned_by,assignment_role,assigned_at,unassigned_at,remarks",
            )
            .eq("visit_id", visitId)
            .is("unassigned_at", null)
            .order("assigned_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),

          /*
           * Recent workflow events.
           */
          supabase
            .from("workflow_events")
            .select(
              "id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks",
            )
            .eq("visit_id", visitId)
            .order("performed_at", {
              ascending: false,
            })
            .limit(25),
        ]);

        /* ------------------------------------------------------
           RESULT ERRORS
        ------------------------------------------------------ */

        if (holdResult.error) {
          throw holdResult.error;
        }

        if (surveyResult.error) {
          throw surveyResult.error;
        }

        if (vehicleJobResult.error) {
          throw vehicleJobResult.error;
        }

        if (assignmentResult.error) {
          throw assignmentResult.error;
        }

        if (eventsResult.error) {
          throw eventsResult.error;
        }

        /* ------------------------------------------------------
           HOLD
        ------------------------------------------------------ */

        const currentHold = (holdResult.data as ApprovalCycle | null) ?? null;

        if (!currentHold) {
          throw new Error(
            "The Approval Hold record could not be found for this vehicle.",
          );
        }

        setHold(currentHold);

        /* ------------------------------------------------------
           SURVEY
        ------------------------------------------------------ */

        setSurvey((surveyResult.data as Survey | null) ?? null);

        /* ------------------------------------------------------
           VEHICLE JOB
        ------------------------------------------------------ */

        setVehicleJob((vehicleJobResult.data as VehicleJob | null) ?? null);

        /* ------------------------------------------------------
           ASSIGNMENT
        ------------------------------------------------------ */

        setAssignment((assignmentResult.data as Assignment | null) ?? null);

        /* ------------------------------------------------------
           EVENTS
        ------------------------------------------------------ */

        const currentEvents = (eventsResult.data ?? []) as WorkflowEvent[];

        setEvents(currentEvents);

        /* ------------------------------------------------------
           LOAD PEOPLE
        ------------------------------------------------------ */

        const peopleIds = [
          currentHold.decided_by,
          assignmentResult.data?.assigned_to,
          assignmentResult.data?.assigned_by,
          ...currentEvents.map((event) => event.performed_by),
        ].filter((id): id is string => Boolean(id));

        const uniquePeopleIds = [...new Set(peopleIds)];

        const peopleMap = new Map<string, string>();

        if (uniquePeopleIds.length > 0) {
          const { data: peopleData, error: peopleError } = await supabase
            .from("profiles")
            .select("id,name")
            .in("id", uniquePeopleIds);

          if (peopleError) {
            throw peopleError;
          }

          (peopleData ?? []).forEach((person: EventPerson) => {
            peopleMap.set(
              person.id,
              person.name?.trim() || "User name unavailable",
            );
          });
        }

        setEventPeople(peopleMap);

        setHeldByName(
          currentHold.decided_by
            ? peopleMap.get(currentHold.decided_by) || "User name unavailable"
            : null,
        );

        setAssignedAdvisorName(
          assignmentResult.data?.assigned_to
            ? peopleMap.get(assignmentResult.data.assigned_to) ||
                "User name unavailable"
            : currentVisit.current_assigned_to
              ? peopleMap.get(currentVisit.current_assigned_to) ||
                "User name unavailable"
              : null,
        );
      } catch (error: any) {
        console.error("Approval Hold details load error:", error);

        const message =
          error?.message || "Unable to load Approval Hold details.";

        setErrorMessage(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [vehicleId, visitId],
  );

  /* ==========================================================
     FOCUS REFRESH
  ========================================================== */

  useFocusEffect(
    useCallback(() => {
      loadDetails();
    }, [loadDetails]),
  );

  /* ==========================================================
     DERIVED DATA
  ========================================================== */

  const holdDays = useMemo(() => {
    return getHoldDays(hold?.approval_hold_at, visit?.stage_started_at);
  }, [hold?.approval_hold_at, visit?.stage_started_at]);

  const holdRemark = useMemo(() => {
    return (
      hold?.approval_hold_remark?.trim() ||
      hold?.remarks?.trim() ||
      "No hold remark recorded"
    );
  }, [hold]);

  const vehicleTitle = useMemo(() => {
    if (!vehicle) {
      return "Vehicle";
    }

    return (
      [vehicle.arena_nexa, vehicle.model].filter(Boolean).join(" · ") ||
      "Vehicle details unavailable"
    );
  }, [vehicle]);

  /* ==========================================================
     RESOLVE HOLD
  ========================================================== */

  const executeResolveHold = useCallback(async () => {
    if (!visitId) {
      return;
    }

    try {
      setResolving(true);
      setErrorMessage("");

      const remarks = cleanText(resolveRemarks);

      const { data, error } = await supabase.rpc(
        "new_workflow_resolve_approval_hold",
        {
          p_visit_id: visitId,
          p_remarks: remarks,
        },
      );

      if (error) {
        throw error;
      }

      console.log("Approval Hold resolved:", data);

      setResolving(false);

      showPopup({
        type: "success",
        title: "Hold Resolved",
        message:
          "The vehicle has been returned to Pending Approval. It has NOT been approved.",
        confirmText: "Back to Approval Hold",
        showCancel: false,
        onConfirm: () => {
          closePopup();
          router.replace("/(tabs)/advisor/approval_hold");
        },
      });
    } catch (error: any) {
      console.error("Resolve Approval Hold error:", error);

      const message =
        error?.message ||
        "Unable to resolve the Approval Hold. Please try again.";

      setErrorMessage(message);

      setResolving(false);

      showPopup({
        type: "error",
        title: "Unable to Resolve Hold",
        message,
        confirmText: "OK",
        showCancel: false,
      });
    }
  }, [closePopup, resolveRemarks, showPopup, visitId]);

  const resolveHold = useCallback(() => {
    if (!visitId || resolving) {
      return;
    }

    showPopup({
      type: "warning",
      title: "Resolve Approval Hold?",
      message:
        "This will move the vehicle from Approval Hold back to Pending Approval. It will NOT approve the vehicle.",
      confirmText: "Resolve Hold",
      cancelText: "Cancel",
      showCancel: true,
      onConfirm: () => {
        closePopup();
        executeResolveHold();
      },
    });
  }, [closePopup, executeResolveHold, resolving, showPopup, visitId]);

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

        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.stateMessage}>
            Loading Approval Hold details…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ==========================================================
     ERROR / MISSING DATA
  ========================================================== */

  if (!visit || !vehicle || !hold) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <ScrollView
          contentContainerStyle={styles.errorPage}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadDetails(true)}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.errorPageIcon}>
            <Ionicons name="alert-circle-outline" size={42} color="#B42318" />
          </View>

          <Text style={styles.errorPageTitle}>
            Approval Hold details unavailable
          </Text>

          <Text style={styles.errorPageMessage}>
            {errorMessage || "The requested Approval Hold could not be loaded."}
          </Text>

          <View style={styles.errorActions}>
            <Pressable
              onPress={() => loadDetails(true)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />

              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace("/(tabs)/advisor/approval_hold")}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Back to Approval Hold
              </Text>
            </Pressable>
          </View>
        </ScrollView>
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDetails(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* ----------------------------------------------------
            TOP BAR
        ---------------------------------------------------- */}

        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace("/(tabs)/advisor/approval_hold")}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.primary} />

            <Text style={styles.backText}>Approval Hold</Text>
          </Pressable>

          <Text style={styles.brand}>PAGARIYA</Text>
        </View>

        {/* ----------------------------------------------------
            HERO
        ---------------------------------------------------- */}

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="pause-circle-outline" size={30} color="#FFFFFF" />
          </View>

          <Text style={styles.eyebrow}>APPROVAL HOLD DETAILS</Text>

          <Text style={styles.heading}>{vehicle.vehicle_no || "Vehicle"}</Text>

          <Text style={styles.subtitle}>{vehicleTitle}</Text>

          <View style={styles.heroBottom}>
            <View style={styles.onHoldHeroBadge}>
              <Ionicons name="pause-circle-outline" size={15} color="#FFFFFF" />

              <Text style={styles.onHoldHeroText}>ON HOLD</Text>
            </View>

            <View style={styles.daysHeroBadge}>
              <Text style={styles.daysHeroText}>
                {holdDays} {holdDays === 1 ? "day" : "days"} waiting
              </Text>
            </View>

            {profile?.role === "ceo_admin" && (
              <View style={styles.adminBadge}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color="#FFFFFF"
                />

                <Text style={styles.adminBadgeText}>CEO Admin</Text>
              </View>
            )}
          </View>
        </View>

        {/* ----------------------------------------------------
            ERROR BANNER
        ---------------------------------------------------- */}

        {errorMessage !== "" && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color="#B42318" />

            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>Action / data error</Text>

              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          </View>
        )}

        {/* ----------------------------------------------------
            CURRENT STATUS
        ---------------------------------------------------- */}

        <View style={styles.statusCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Current Workflow</Text>

              <Text style={styles.sectionSubtitle}>
                Live status of this vehicle
              </Text>
            </View>

            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />

              <Text style={styles.liveBadgeText}>ACTIVE</Text>
            </View>
          </View>

          <View style={styles.statusGrid}>
            <StatusTile
              label="Stage"
              value={normalizeStage(visit.current_stage)}
              icon="git-branch-outline"
            />

            <StatusTile
              label="Status"
              value={normalizeStatus(visit.current_status)}
              icon="pause-circle-outline"
            />

            <StatusTile
              label="Hold Days"
              value={`${holdDays}`}
              icon="time-outline"
            />

            <StatusTile
              label="Approval Cycle"
              value={hold.cycle_no ? `Cycle ${hold.cycle_no}` : "—"}
              icon="repeat-outline"
            />
          </View>
        </View>

        {/* ----------------------------------------------------
            VEHICLE + CUSTOMER
        ---------------------------------------------------- */}

        <SectionCard
          icon="car-outline"
          title="Vehicle & Customer"
          subtitle="Basic vehicle and customer information"
        >
          <DetailRow
            icon="car-outline"
            label="Registration"
            value={vehicle.vehicle_no}
            emphasis
          />

          <DetailRow
            icon="person-outline"
            label="Customer"
            value={vehicle.customer_name}
          />

          <DetailRow
            icon="call-outline"
            label="Mobile"
            value={vehicle.customer_mobile}
          />

          <DetailRow
            icon="car-sport-outline"
            label="Vehicle"
            value={vehicleTitle}
          />

          <DetailRow
            icon="briefcase-outline"
            label="Vehicle Type"
            value={normalizeVehicleType(
              vehicle.vehicle_type || vehicleJob?.vehicle_type,
            )}
          />

          <DetailRow
            icon="document-text-outline"
            label="Job Card"
            value={vehicle.jc_no || vehicleJob?.job_card_no}
          />

          <DetailRow
            icon="construct-outline"
            label="Job Type"
            value={normalizeJobType(vehicleJob?.job_type)}
          />
        </SectionCard>

        {/* ----------------------------------------------------
            ASSIGNMENT
        ---------------------------------------------------- */}

        <SectionCard
          icon="person-circle-outline"
          title="Advisor Assignment"
          subtitle="Current responsibility for this vehicle"
        >
          <DetailRow
            icon="person-circle-outline"
            label="Assigned Advisor"
            value={assignedAdvisorName}
            emphasis
          />

          <DetailRow
            icon="calendar-outline"
            label="Assigned At"
            value={formatIndiaDateTime(assignment?.assigned_at)}
          />

          <DetailRow
            icon="shield-checkmark-outline"
            label="Assignment Role"
            value={assignment?.assignment_role}
          />

          <DetailRow
            icon="chatbox-outline"
            label="Assignment Remarks"
            value={assignment?.remarks}
          />
        </SectionCard>

        {/* ----------------------------------------------------
            SURVEY
        ---------------------------------------------------- */}

        <SectionCard
          icon="clipboard-outline"
          title="Survey Information"
          subtitle="Survey information connected to this approval cycle"
        >
          <DetailRow
            icon="document-outline"
            label="Survey No."
            value={survey?.survey_no ? `Survey ${survey.survey_no}` : null}
          />

          <DetailRow
            icon="layers-outline"
            label="Survey Type"
            value={
              survey?.survey_type ? normalizeStage(survey.survey_type) : null
            }
          />

          <DetailRow
            icon="calendar-outline"
            label="Survey Started"
            value={formatIndiaDateTime(survey?.started_at)}
          />

          <DetailRow
            icon="checkmark-circle-outline"
            label="Survey Completed"
            value={formatIndiaDateTime(survey?.completed_at)}
          />

          <DetailRow
            icon="cash-outline"
            label="Paid Amount"
            value={
              survey?.paid_amount !== null && survey?.paid_amount !== undefined
                ? `₹${Number(survey.paid_amount).toLocaleString("en-IN")}`
                : null
            }
          />

          <DetailRow
            icon="receipt-outline"
            label="Receipt / Reference"
            value={survey?.receipt_reference_no}
          />

          <DetailRow
            icon="chatbox-outline"
            label="Survey Remarks"
            value={survey?.remarks}
          />
        </SectionCard>

        {/* ----------------------------------------------------
            CLAIM / ESTIMATE
        ---------------------------------------------------- */}

        <SectionCard
          icon="document-attach-outline"
          title="Claim & Estimate"
          subtitle="Insurance, estimate and approval information"
        >
          <DetailRow
            icon="briefcase-outline"
            label="Job Type"
            value={normalizeJobType(vehicleJob?.job_type)}
            emphasis
          />

          <DetailRow
            icon="calculator-outline"
            label="Estimate ID"
            value={vehicleJob?.estimate_id}
            emphasis
          />

          <DetailRow
            icon="document-text-outline"
            label="Claim No."
            value={vehicleJob?.claim_no}
            emphasis
          />

          <DetailRow
            icon="time-outline"
            label="Claim Intimation"
            value={formatIndiaDateTime(vehicleJob?.claim_intimation_at)}
          />

          <DetailRow
            icon="clipboard-outline"
            label="Survey Date"
            value={formatIndiaDateTime(vehicleJob?.survey_at)}
          />

          <DetailRow
            icon="checkmark-circle-outline"
            label="Approval Status"
            value={normalizeApprovalStatus(vehicleJob?.approval_status)}
            emphasis
          />

          <DetailRow
            icon="person-outline"
            label="Approval By"
            value={normalizeApprovalByType(vehicleJob?.approval_by_type)}
          />

          <DetailRow
            icon="calendar-outline"
            label="Approval Received"
            value={formatIndiaDateTime(vehicleJob?.approval_at)}
          />

          <DetailRow
            icon="chatbox-ellipses-outline"
            label="Approval Remarks"
            value={vehicleJob?.approval_remarks}
          />

          <DetailRow
            icon="git-branch-outline"
            label="Partial Approval"
            value={normalizePartialChoice(vehicleJob?.partial_approval_choice)}
          />

          <DetailRow
            icon="person-circle-outline"
            label="Advisor Remarks"
            value={vehicleJob?.advisor_remarks}
          />

          <DetailRow
            icon="document-text-outline"
            label="Paid Job Remarks"
            value={vehicleJob?.paid_job_remarks}
          />

          <DetailRow
            icon="calendar-outline"
            label="Customer Approval"
            value={formatIndiaDateTime(vehicleJob?.customer_approval_at)}
          />
        </SectionCard>

        {/* ----------------------------------------------------
            HOLD INFORMATION
        ---------------------------------------------------- */}

        <View style={styles.holdSectionCard}>
          <View style={styles.holdSectionHeader}>
            <View style={styles.holdSectionIcon}>
              <Ionicons name="pause-circle-outline" size={23} color="#8A5A00" />
            </View>

            <View style={styles.holdSectionHeaderText}>
              <Text style={styles.holdSectionTitle}>
                Approval Hold Information
              </Text>

              <Text style={styles.holdSectionSubtitle}>
                Why this vehicle is currently waiting
              </Text>
            </View>
          </View>

          <View style={styles.holdInfoBox}>
            <DetailRow
              icon="repeat-outline"
              label="Approval Cycle"
              value={hold.cycle_no ? `Cycle ${hold.cycle_no}` : null}
              emphasis
            />

            <DetailRow
              icon="pause-circle-outline"
              label="Hold Started"
              value={formatIndiaDateTime(hold.approval_hold_at)}
            />

            <DetailRow
              icon="person-outline"
              label="Held By"
              value={heldByName}
              emphasis
            />

            <DetailRow
              icon="calendar-outline"
              label="Hold Date"
              value={formatIndiaDate(hold.approval_hold_at)}
            />

            <DetailRow
              icon="git-branch-outline"
              label="Hold Decision"
              value={normalizeStage(hold.decision)}
            />
          </View>

          <View style={styles.remarkBox}>
            <View style={styles.remarkHeader}>
              <Ionicons
                name="chatbox-ellipses-outline"
                size={18}
                color={colors.primary}
              />

              <Text style={styles.remarkLabel}>Hold Remark</Text>
            </View>

            <Text style={styles.remarkText}>{holdRemark}</Text>
          </View>

          {hold.remarks && hold.remarks.trim() !== holdRemark.trim() && (
            <View style={styles.additionalRemarkBox}>
              <Text style={styles.additionalRemarkLabel}>
                Additional Approval Remarks
              </Text>

              <Text style={styles.additionalRemarkText}>{hold.remarks}</Text>
            </View>
          )}
        </View>

        {/* ----------------------------------------------------
            RESOLVE REMARKS
        ---------------------------------------------------- */}

        <View style={styles.resolveCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Resolve Hold</Text>

              <Text style={styles.sectionSubtitle}>
                Optional note for the hold-resolution audit record
              </Text>
            </View>

            <View style={styles.resolveIcon}>
              <Ionicons
                name="return-up-forward-outline"
                size={21}
                color={colors.primary}
              />
            </View>
          </View>

          <TextInput
            value={resolveRemarks}
            onChangeText={setResolveRemarks}
            placeholder="Example: Customer approval received. Returning vehicle to Approval."
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            editable={!resolving}
            style={styles.resolveInput}
          />

          <View style={styles.resolveWarning}>
            <Ionicons
              name="information-circle-outline"
              size={19}
              color={colors.primary}
            />

            <Text style={styles.resolveWarningText}>
              Resolving the hold only returns the vehicle to{" "}
              <Text style={styles.resolveWarningStrong}>Pending Approval</Text>.
              It does not approve the vehicle.
            </Text>
          </View>

          <Pressable
            disabled={resolving}
            onPress={resolveHold}
            style={({ pressed }) => [
              styles.resolveButton,
              resolving && styles.resolveButtonDisabled,
              pressed && !resolving && styles.pressed,
            ]}
          >
            {resolving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name="checkmark-circle-outline"
                size={21}
                color="#FFFFFF"
              />
            )}

            <Text style={styles.resolveButtonText}>
              {resolving ? "Resolving Hold…" : "Resolve Hold"}
            </Text>
          </Pressable>
        </View>

        {/* ----------------------------------------------------
            WORKFLOW HISTORY
        ---------------------------------------------------- */}

        <View style={styles.historyCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Workflow History</Text>

              <Text style={styles.sectionSubtitle}>
                Recent recorded actions for this visit
              </Text>
            </View>

            <View style={styles.historyCount}>
              <Text style={styles.historyCountText}>{events.length}</Text>
            </View>
          </View>

          {events.length === 0 ? (
            <View style={styles.noHistory}>
              <Ionicons
                name="time-outline"
                size={25}
                color={colors.textSecondary}
              />

              <Text style={styles.noHistoryText}>
                No workflow events were found.
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {events.map((event, index) => {
                const personName = event.performed_by
                  ? eventPeople.get(event.performed_by) ||
                    "User name unavailable"
                  : "System";

                const isLast = index === events.length - 1;

                return (
                  <View key={event.id} style={styles.timelineItem}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot}>
                        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                      </View>

                      {!isLast && <View style={styles.timelineLine} />}
                    </View>

                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineEvent}>
                        {normalizeStage(event.event_type)}
                      </Text>

                      <Text style={styles.timelineDate}>
                        {formatIndiaDateTime(event.performed_at)}
                      </Text>

                      <Text style={styles.timelinePerson}>
                        By: {personName}
                      </Text>

                      {(event.stage_before || event.stage_after) && (
                        <View style={styles.timelineStageBox}>
                          <Text style={styles.timelineStageText}>
                            {normalizeStage(event.stage_before)} →{" "}
                            {normalizeStage(event.stage_after)}
                          </Text>
                        </View>
                      )}

                      {event.remarks && (
                        <Text style={styles.timelineRemark}>
                          {event.remarks}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ----------------------------------------------------
            FOOTER
        ---------------------------------------------------- */}

        <Text style={styles.footer}>PAGARIYA AUTO • APPROVAL HOLD DETAILS</Text>
      </ScrollView>

      {/* ======================================================
          CUSTOM POPUP
      ====================================================== */}

      <Modal
        visible={popup.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!popup.showCancel) {
            closePopup();
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View
              style={[
                styles.popupIcon,
                {
                  backgroundColor:
                    popup.type === "success"
                      ? "#E7F6EC"
                      : popup.type === "error"
                        ? "#FEE4E2"
                        : popup.type === "warning"
                          ? "#FFF0C9"
                          : "#EEF5FF",
                },
              ]}
            >
              <Ionicons
                name={getPopupIcon(popup.type)}
                size={30}
                color={getPopupIconColor(popup.type)}
              />
            </View>

            <Text style={styles.popupTitle}>{popup.title}</Text>

            <Text style={styles.popupMessage}>{popup.message}</Text>

            <View style={styles.popupActions}>
              {popup.showCancel && (
                <Pressable
                  onPress={closePopup}
                  style={({ pressed }) => [
                    styles.popupCancelButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.popupCancelText}>
                    {popup.cancelText || "Cancel"}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  if (popup.onConfirm) {
                    popup.onConfirm();
                  } else {
                    closePopup();
                  }
                }}
                style={({ pressed }) => [
                  styles.popupConfirmButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.popupConfirmText}>
                  {popup.confirmText || "OK"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ============================================================
   SECTION CARD
============================================================ */

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionIcon}>
            <Ionicons name={icon} size={19} color={colors.primary} />
          </View>

          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>{title}</Text>

            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/* ============================================================
   DETAIL ROW
============================================================ */

function DetailRow({
  icon,
  label,
  value,
  emphasis = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string | null | undefined;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabel}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />

        <Text style={styles.detailLabelText}>{label}</Text>
      </View>

      <Text
        style={[styles.detailValue, emphasis && styles.detailValueEmphasis]}
      >
        {value?.trim() || "—"}
      </Text>
    </View>
  );
}

/* ============================================================
   STATUS TILE
============================================================ */

function StatusTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.statusTile}>
      <Ionicons name={icon} size={18} color={colors.primary} />

      <Text style={styles.statusTileLabel}>{label}</Text>

      <Text style={styles.statusTileValue}>{value}</Text>
    </View>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 120,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  stateMessage: {
    ...typography.body,
    color: colors.textSecondary,
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
    gap: 6,
    paddingVertical: 6,
  },

  backText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  brand: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: colors.text,
  },

  hero: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: spacing.md,
  },

  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    marginBottom: 14,
  },

  eyebrow: {
    color: "#FFE5E7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  heading: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 6,
  },

  subtitle: {
    color: "#FFF0F0",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },

  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },

  onHoldHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.17)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  onHoldHeroText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  daysHeroBadge: {
    backgroundColor: "rgba(255,255,255,0.17)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  daysHeroText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.17)",
  },

  adminBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  errorCard: {
    flexDirection: "row",
    backgroundColor: "#FEF3F2",
    borderWidth: 1,
    borderColor: "#FDA29B",
    borderRadius: 15,
    padding: 14,
    marginBottom: spacing.md,
    gap: 10,
  },

  errorContent: {
    flex: 1,
  },

  errorTitle: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "900",
  },

  errorMessage: {
    color: "#912018",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },

  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E7F6EC",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#18794E",
  },

  liveBadgeText: {
    color: "#18794E",
    fontSize: 9,
    fontWeight: "900",
  },

  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 15,
  },

  statusTile: {
    width: "48%",
    flexGrow: 1,
    minHeight: 88,
    borderRadius: 13,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },

  statusTileLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 8,
  },

  statusTileValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionBody: {
    marginTop: 13,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  detailLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 0.9,
  },

  detailLabelText: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  detailValue: {
    flex: 1.35,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 18,
  },

  detailValueEmphasis: {
    color: colors.primary,
    fontWeight: "900",
  },

  holdSectionCard: {
    backgroundColor: "#FFF9ED",
    borderRadius: 18,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#F2D28A",
  },

  holdSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  holdSectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#FFF0C9",
    alignItems: "center",
    justifyContent: "center",
  },

  holdSectionHeaderText: {
    flex: 1,
  },

  holdSectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  holdSectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },

  holdInfoBox: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 13,
    paddingHorizontal: 11,
  },

  remarkBox: {
    backgroundColor: colors.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E7D6AA",
    padding: 13,
    marginTop: 12,
  },

  remarkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  remarkLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },

  remarkText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  additionalRemarkBox: {
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 12,
    padding: 12,
    marginTop: 9,
  },

  additionalRemarkLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  additionalRemarkText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  resolveCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  resolveIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  resolveInput: {
    minHeight: 105,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },

  resolveWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EEF5FF",
    borderWidth: 1,
    borderColor: "#C9DDFF",
    borderRadius: 12,
    padding: 11,
    marginTop: 11,
  },

  resolveWarningText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },

  resolveWarningStrong: {
    color: colors.primary,
    fontWeight: "900",
  },

  resolveButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 13,
    marginTop: 13,
  },

  resolveButtonDisabled: {
    opacity: 0.65,
  },

  resolveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  historyCount: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  historyCountText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },

  noHistory: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 25,
    gap: 8,
  },

  noHistoryText: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  timeline: {
    marginTop: 15,
  },

  timelineItem: {
    flexDirection: "row",
    minHeight: 92,
  },

  timelineRail: {
    width: 27,
    alignItems: "center",
  },

  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  timelineLine: {
    position: "absolute",
    top: 22,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
  },

  timelineContent: {
    flex: 1,
    paddingLeft: 9,
    paddingBottom: 18,
  },

  timelineEvent: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },

  timelineDate: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  timelinePerson: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  timelineStageBox: {
    alignSelf: "flex-start",
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 7,
  },

  timelineStageText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
  },

  timelineRemark: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },

  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },

  errorPage: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  errorPageIcon: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: "#FEE4E2",
    alignItems: "center",
    justifyContent: "center",
  },

  errorPageTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 15,
  },

  errorPageMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
    maxWidth: 340,
  },

  errorActions: {
    width: "100%",
    gap: 9,
    marginTop: 18,
  },

  pressed: {
    opacity: 0.78,
  },

  footer: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 8,
  },

  /* ==========================================================
     CUSTOM POPUP
  ========================================================== */

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  popupCard: {
    width: "100%",
    maxWidth: 410,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  popupTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 15,
  },

  popupMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },

  popupActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 20,
  },

  popupCancelButton: {
    flex: 1,
    minHeight: 47,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  popupCancelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },

  popupConfirmButton: {
    flex: 1,
    minHeight: 47,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  popupConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});
