import useVisitDateTimeBounds from "../../../components/inputs/useVisitDateTimeBounds";
import StoreInchargePicker from "../../../components/store/StoreInchargePicker";
import { KeyboardAvoidingView, Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import useDateTimeValidation from "../../../components/inputs/useDateTimeValidation";
import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import { returnToRoute, useHardwareBack, singleParam } from "../../../lib/back-navigation";
import DateValueField from "../../../components/inputs/DateValueField";

import { router, useLocalSearchParams } from "expo-router";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ActivityIndicator, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";

import { colors, radius, spacing } from "../../../theme";

type PartsChoice = "PARTS_REQUIRED" | "NO_PARTS_REQUIRED";

type PopupType = "success" | "error" | "warning" | "info";

type VehicleData = {
  id: string;

  vehicle_no: string | null;

  customer_name: string | null;

  customer_mobile: string | null;

  model: string | null;

  arena_nexa: string | null;

  vehicle_type: string | null;

  current_stage: string | null;

  current_status: string | null;

  job_card_no: string | null;
};

type ApprovedWork = {
  id: string;

  code: string;

  name: string;

  description: string | null;
  is_active: boolean;
};

type ApprovalCycle = {
  id: string;

  cycle_no: number;
};

type FloorIncharge = {
  id: string;
  name: string | null;
};

export default function AdvisorWorkFormScreen() {
  const dateValidation = useDateTimeValidation();
  const navigationParams = useLocalSearchParams<{ returnTo?: string | string[]; returnVisitId?: string | string[]; floor?: string | string[]; filter?: string | string[] }>();
  const handleNavigationBack = () => {
    if (saving) return;
    const origin = singleParam(navigationParams.returnTo);
    if (origin === "vehicle-detail" && vehicleId && singleParam(params.vehicleId)) {
      returnToRoute({ pathname: "/(tabs)/vehicle-detail", params: { vehicleId } });
    } else if (origin === "vehicles") {
      returnToRoute("/(tabs)/vehicles");
    } else {
      returnToRoute("/(tabs)/advisor/work");
    }
  };
  useHardwareBack(handleNavigationBack);

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

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [vehicle, setVehicle] = useState<VehicleData | null>(null);

  const [approvalCycle, setApprovalCycle] = useState<ApprovalCycle | null>(
    null,
  );

  const [approvedWork, setApprovedWork] = useState<ApprovedWork[]>([]);

  const [selectedStoreInchargeId, setSelectedStoreInchargeId] = useState<string | null>(null);

  const [partsChoice, setPartsChoice] = useState<PartsChoice | null>(null);

  const [floorIncharges, setFloorIncharges] = useState<FloorIncharge[]>([]);

  const [selectedFloorInchargeId, setSelectedFloorInchargeId] = useState<
    string | null
  >(null);

  const [requisitionNo, setRequisitionNo] = useState("");

  const [requisitionAt, setRequisitionAt] = useState(new Date());

  const [remarks, setRemarks] = useState("");





  const [confirmationVisible, setConfirmationVisible] = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);

  const [popupType, setPopupType] = useState<PopupType>("info");

  const [popupTitle, setPopupTitle] = useState("");

  const [popupMessage, setPopupMessage] = useState("");

  const needsParts = partsChoice === "PARTS_REQUIRED";
  const visitDates = useVisitDateTimeBounds(visitId);

  const nextStage =
    partsChoice === "PARTS_REQUIRED"
      ? "STORE"
      : partsChoice === "NO_PARTS_REQUIRED"
        ? "FLOOR"
        : "—";

  const approvedNames = useMemo(
    () => approvedWork.map((item) => item.name),

    [approvedWork],
  );

  const selectedFloorIncharge = useMemo(
    () =>
      floorIncharges.find((item) => item.id === selectedFloorInchargeId) ??
      null,
    [floorIncharges, selectedFloorInchargeId],
  );

  const showPopup = useCallback(
    (type: PopupType, title: string, message: string) => {
      setPopupType(type);

      setPopupTitle(title);

      setPopupMessage(message);

      setPopupVisible(true);
    },

    [],
  );

  const loadVehicle = useCallback(async () => {
    visitDates.reload();
    if (!visitId || !vehicleId) {
      setLoadError(
        "Vehicle or visit information is missing. Return to Advisor Work and open the vehicle again.",
      );
      setLoading(false);

      showPopup(
        "error",

        "Missing Information",

        "Vehicle or visit information is missing. Please return to Advisor Work and try again.",
      );

      return;
    }

    try {
      setLoading(true);
      setLoadError("");
      setVehicle(null);
      setApprovalCycle(null);
      setApprovedWork([]);

      /*

       * AUTH + PROFILE

       */

      const {
        data: { user },

        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data: profile, error: profileError } = await supabase

        .from("profiles")

        .select("id,role,is_active")

        .eq("id", user.id)

        .single();

      if (profileError) {
        throw profileError;
      }

      if (!profile || !profile.is_active) {
        throw new Error("Your account is not authorized for Advisor Work.");
      }

      const role = String(profile.role || "").toLowerCase();

      if (role !== "advisor" && role !== "ceo_admin") {
        throw new Error(
          "Only an Advisor or CEO Admin can process Advisor Work.",
        );
      }

      const { data: floorInchargeData, error: floorInchargeError } =
        await supabase.rpc("new_workflow_active_floor_incharges");

      if (floorInchargeError) {
        throw floorInchargeError;
      }

      const availableFloorIncharges = (floorInchargeData?.items ??
        []) as FloorIncharge[];

      setFloorIncharges(availableFloorIncharges);

      setSelectedFloorInchargeId((current) =>
        availableFloorIncharges.some((item) => item.id === current)
          ? current
          : null,
      );

      /*

       * VISIT FIRST

       *

       * The active workshop visit is the authoritative

       * source for vehicle identity and assignment.

       */

      const { data: visitData, error: visitError } = await supabase

        .from("workshop_visits")

        .select(
          "id,vehicle_id,current_stage,current_status,current_assigned_to,closed_at",
        )

        .eq("id", visitId)

        .single();

      if (visitError) {
        throw visitError;
      }

      if (!visitData || visitData.closed_at) {
        throw new Error("This workshop visit is no longer active.");
      }

      if (visitData.vehicle_id !== vehicleId) {
        throw new Error(
          "Vehicle and workshop visit do not match. Refresh the Advisor Work list and try again.",
        );
      }

      if (visitData.current_stage !== "ADVISOR_WORK") {
        throw new Error(
          `Vehicle is currently at ${String(
            visitData.current_stage || "another stage",
          ).replaceAll("_", " ")}. Refresh the Advisor Work list.`,
        );
      }

      if (!["PENDING", "IN_PROGRESS"].includes(visitData.current_status)) {
        throw new Error(
          `This vehicle cannot be processed because its status is ${String(
            visitData.current_status || "unknown",
          ).replaceAll("_", " ")}.`,
        );
      }

      /*

       * ADVISOR OWNERSHIP

       */

      if (role === "advisor") {
        if (!visitData.current_assigned_to) {
          throw new Error("This vehicle is not assigned to an Advisor.");
        }

        if (visitData.current_assigned_to !== user.id) {
          throw new Error("This vehicle is not assigned to you.");
        }
      }

      const authoritativeVehicleId = visitData.vehicle_id;

      /*

       * LOAD VEHICLE + ACTIVE JOB

       */

      const [vehicleResult, jobsResult, intakeResult] = await Promise.all([
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

            vehicle_type,

            current_stage,

            current_status,

            jc_no

          `,
          )

          .eq("id", authoritativeVehicleId)

          .single(),

        supabase

          .from("vehicle_jobs")

          .select(
            "id,vehicle_id,job_type,approval_status,current_job_stage,advisor_id,created_at,customer_name_snapshot,customer_mobile_snapshot",
          )

          .eq("vehicle_id", authoritativeVehicleId)

          .neq("current_job_stage", "CLOSED")

          .order("created_at", {
            ascending: false,
          })

          .limit(2),
        supabase
          .from("vehicle_intake")
          .select("customer_name,customer_mobile")
          .eq("visit_id", visitId)
          .eq("vehicle_id", authoritativeVehicleId)
          .maybeSingle(),
      ]);

      if (vehicleResult.error) {
        throw vehicleResult.error;
      }

      if (jobsResult.error) {
        throw jobsResult.error;
      }
      if (intakeResult.error) throw intakeResult.error;

      const activeJobs = jobsResult.data ?? [];

      if (activeJobs.length === 0) {
        throw new Error(
          "Active vehicle job not found. Contact CEO Admin before continuing.",
        );
      }

      if (activeJobs.length > 1) {
        throw new Error(
          "Multiple active vehicle jobs were found. Contact CEO Admin before continuing.",
        );
      }

      const activeJob = activeJobs[0];

      if (activeJob.approval_status !== "APPROVED") {
        throw new Error(
          "Initial approval must be completed before Advisor Work.",
        );
      }

      /*

       * Job assignment should agree with the visit.

       */

      if (
        role === "advisor" &&
        activeJob.advisor_id &&
        activeJob.advisor_id !== user.id
      ) {
        throw new Error(
          "The active vehicle job is assigned to a different Advisor. Contact CEO Admin before continuing.",
        );
      }

      setVehicle({
        id: vehicleResult.data.id,

        vehicle_no: vehicleResult.data.vehicle_no ?? null,

        customer_name:
          intakeResult.data?.customer_name?.trim() ||
          activeJob.customer_name_snapshot?.trim() ||
          vehicleResult.data.customer_name ||
          null,

        customer_mobile:
          intakeResult.data?.customer_mobile?.trim() ||
          activeJob.customer_mobile_snapshot?.trim() ||
          vehicleResult.data.customer_mobile ||
          null,

        model: vehicleResult.data.model ?? null,

        arena_nexa: vehicleResult.data.arena_nexa ?? null,

        vehicle_type: vehicleResult.data.vehicle_type ?? null,

        current_stage: visitData.current_stage,

        current_status: visitData.current_status,

        job_card_no: vehicleResult.data.jc_no ?? null,
      });

      /*

       * APPROVAL IS THE AUTHORITATIVE

       * SOURCE OF FLOOR WORK.

       */

      const { data: cycleData, error: cycleError } = await supabase

        .from("approval_cycles")

        .select("id,cycle_no")

        .eq("visit_id", visitId)

        .eq("vehicle_id", authoritativeVehicleId)

        .eq("cycle_type", "INITIAL")

        .eq("decision", "APPROVED")

        .order("cycle_no", {
          ascending: false,
        })

        .limit(1)

        .maybeSingle();

      if (cycleError) {
        throw cycleError;
      }

      if (!cycleData) {
        throw new Error(
          "Approved Initial Approval cycle not found. Contact CEO Admin before continuing.",
        );
      }

      setApprovalCycle(cycleData);

      /*

       * LOAD APPROVED FLOOR SCOPE

       */

      const { data: scopeRows, error: scopeError } = await supabase

        .from("approval_work_scope")

        .select("work_type_id")

        .eq("approval_cycle_id", cycleData.id);

      if (scopeError) {
        throw scopeError;
      }

      const workTypeIds = (scopeRows ?? [])

        .map((row) => row.work_type_id)

        .filter((id): id is string => typeof id === "string" && !!id);

      if (!workTypeIds.length) {
        throw new Error(
          "Approved Floor work scope is missing. Reprocess Approval or contact CEO Admin.",
        );
      }

      const { data: workRows, error: workError } = await supabase

        .from("work_type_master")

        .select("id,code,name,description,is_active")

        .in("id", workTypeIds);

      if (workError) {
        throw workError;
      }

      const loadedWork = (workRows ?? []) as ApprovedWork[];
      if (
        !loadedWork.length ||
        loadedWork.length !== new Set(workTypeIds).size ||
        loadedWork.some(
          (work) =>
            !work.is_active ||
            ["FINAL_INSPECTION", "FINAL_INSPECTION_REWORK"].includes(work.code),
        )
      ) {
        throw new Error(
          "Approved Floor scope contains unavailable or invalid repair work. Reprocess Approval or contact CEO Admin.",
        );
      }

      /*

       * When selected, Stripping comes before other approved work.

       *

       * Other items remain alphabetical.

       */

      loadedWork.sort((a, b) => {
        if (a.code === "STRIPPING") {
          return -1;
        }

        if (b.code === "STRIPPING") {
          return 1;
        }

        return a.name.localeCompare(b.name);
      });

      if (
        String(activeJob.job_type).trim().toUpperCase() !== "PAID" &&
        !loadedWork.some((work) => work.code === "STRIPPING")
      ) {
        throw new Error(
          "Approved Floor scope does not contain Stripping. Contact CEO Admin before continuing.",
        );
      }

      setApprovedWork(loadedWork);
    } catch (error: any) {
      setLoadError(
        error?.message || "The vehicle details could not be loaded.",
      );
      setVehicle(null);
      setApprovalCycle(null);
      setApprovedWork([]);
      console.error("Advisor Work vehicle load error:", error);

      showPopup(
        "error",

        "Unable to Load Vehicle",

        error?.message || "The vehicle details could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [showPopup, vehicleId, visitId, visitDates.reload]);

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",

      month: "short",

      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",

      minute: "2-digit",
    });
  };

  const isFutureDateTime = (date: Date) => {
    return date.getTime() > Date.now();
  };

  const validateForm = () => {
    const dateError = dateValidation.getError();
    if (dateError) { showPopup("warning", "Check date & time", dateError); return false; }
    if (loading || saving || loadError || !vehicle) return false;
    if (needsParts) {
      const rangeError = visitDates.validate(requisitionAt);
      if (rangeError) { showPopup("warning", "Check date & time", rangeError); return false; }
    }
    if (!partsChoice) {
      showPopup(
        "warning",

        "Select Parts Requirement",

        "Please confirm whether this approved repair requires parts.",
      );

      return false;
    }

    if (!approvalCycle || !approvedWork.length) {
      showPopup(
        "error",

        "Approval Scope Missing",

        "The approved Floor work scope is unavailable.",
      );

      return false;
    }

    if (!needsParts && !floorIncharges.length) {
      showPopup(
        "error",
        "No Floor Incharge Available",
        "No active Floor Incharge is available. Ask CEO Admin to activate or create a Floor Incharge before sending this vehicle to Floor.",
      );

      return false;
    }

    if (!needsParts && !selectedFloorInchargeId) {
      showPopup(
        "warning",
        "Floor Incharge Required",
        "Select the Floor Incharge who will receive and execute this vehicle on Floor.",
      );

      return false;
    }

    if (needsParts && !selectedStoreInchargeId) {
      showPopup("warning", "Store Incharge Required", "Select the Store Incharge who will handle the parts for this vehicle.");
      return false;
    }

    if (needsParts && !requisitionNo.trim()) {
      showPopup(
        "warning",

        "Requisition Number Required",

        "Please enter the Advisor requisition number.",
      );

      return false;
    }

    if (needsParts && isFutureDateTime(requisitionAt)) {
      showPopup(
        "warning",

        "Invalid Requisition Date / Time",

        "Requisition date and time cannot be in the future.",
      );

      return false;
    }

    return true;
  };

  const handleContinue = () => {
    if (!validateForm()) {
      return;
    }

    setConfirmationVisible(true);
  };

  const handleSave = async () => {
    if (!visitId || !partsChoice) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const cleanRequisitionNo = requisitionNo.trim();

      const cleanRemarks = remarks.trim();

      const { data, error } = await supabase.rpc(
        "new_workflow_process_advisor_work_v3",

        {
          p_visit_id: visitId,

          /*

           * Advisor Work no longer defines Denting/Painting.

           * Approval owns Floor scope.

           */

          p_work_path: partsChoice,

          p_requisition_no: needsParts ? cleanRequisitionNo : null,

          p_requisition_at: needsParts ? requisitionAt.toISOString() : null,

          p_remarks: cleanRemarks || null,

          p_floor_incharge_id: needsParts ? null : selectedFloorInchargeId,
          p_store_incharge_id: needsParts ? selectedStoreInchargeId : null,
        },
      );

      if (error) {
        throw error;
      }

      if (data?.success !== true) throw new Error("The handover could not be confirmed. Refresh before trying again.");

      setConfirmationVisible(false);

      showPopup(
        "success",

        "Work Requirement Saved",

        needsParts
          ? "Parts requirement saved successfully. The vehicle has moved to Store. After the parts workflow is completed, it will continue to Floor with the approved Floor checklist."
          : `No parts are required. The vehicle has moved directly to Floor and has been assigned to ${
              selectedFloorIncharge?.name || "the selected Floor Incharge"
            } with the approved Floor checklist.`,
      );
    } catch (error: any) {
      console.error("Advisor Work save error:", error);

      setConfirmationVisible(false);

      showPopup(
        "error",

        "Unable to Save",

        error?.message || "The work requirement could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePopupClose = () => {
    setPopupVisible(false);

    if (popupType === "success") {
      router.replace("/(tabs)/advisor/work");
    }
  };





  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.loadingText}>Loading vehicle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* TOP BAR */}

        <View style={styles.topBar}>
          <BackButton onPress={handleNavigationBack} hitSlop={8} />

          <BrandPill />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* HERO */}

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>ADVISOR WORKSPACE</Text>

            <Text style={styles.heroTitle}>Parts Requirement</Text>

            <Text style={styles.heroDescription}>
              Review the approved Floor work and confirm whether parts are
              required before the vehicle continues.
            </Text>

            <View style={styles.heroBottomRow}>
              <View style={styles.vehicleHeroPill}>
                <Text style={styles.vehicleHeroText}>
                  {vehicle?.vehicle_no || "Vehicle"}
                </Text>
              </View>
            </View>
          </View>

          {/* VEHICLE OVERVIEW */}

          {!!loadError && (
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Vehicle unavailable</Text>
              <Text style={styles.workOptionDescription}>{loadError}</Text>
              <Pressable
                onPress={() => void loadVehicle()}
                style={styles.popupButton}
              >
                <Text style={styles.popupButtonText}>Refresh vehicle</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <Text style={styles.cardTitle}>Vehicle Overview</Text>

              <Text style={styles.cardSubtitle}>Vehicle details</Text>
            </View>

            <View style={styles.infoGrid}>
              <InfoBox label="Customer" value={vehicle?.customer_name} />

              <InfoBox label="Mobile" value={vehicle?.customer_mobile} />

              <InfoBox label="Model" value={vehicle?.model} />

              <InfoBox label="Arena / Nexa" value={vehicle?.arena_nexa} />

              <View style={styles.infoBoxFull}>
                <Text style={styles.infoLabel}>Job Card</Text>

                <Text style={styles.infoValue}>
                  {vehicle?.job_card_no || "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* APPROVED FLOOR WORK */}

          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderWithStep}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>1</Text>
              </View>

              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Approved Floor Work</Text>

                <Text style={styles.cardSubtitle}>
                  Read-only · Approved during Survey or Approval
                </Text>
              </View>
            </View>

            <View style={styles.scopeList}>
              {approvedWork.map((work) => (
                <View key={work.id} style={styles.scopeItem}>
                  <View style={styles.scopeCheck}>
                    <Text style={styles.scopeCheckText}>✓</Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text style={styles.scopeName}>{work.name}</Text>

                    {!!work.description && (
                      <Text style={styles.scopeDescription}>
                        {work.description}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.scopeNotice}>
              <Text style={styles.scopeNoticeText}>
                These work items cannot be changed here. Floor will use this
                approved checklist.
                {"\n"}For Paid jobs, Stripping is required only when included in
                this checklist.
                {"\n"}Final Inspection is mandatory for every vehicle after
                Floor work.
              </Text>
            </View>
          </View>

          {/* PARTS REQUIREMENT */}

          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderWithStep}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>2</Text>
              </View>

              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Parts Requirement</Text>

                <Text style={styles.cardSubtitle}>
                  Does this approved repair require parts?
                </Text>
              </View>
            </View>

            <PartsOption
              title="Parts Required"
              description="Create a parts requisition. Vehicle moves to Store first, then continues to Floor."
              selected={partsChoice === "PARTS_REQUIRED"}
              disabled={saving}
              onPress={() => {
                setPartsChoice("PARTS_REQUIRED");
                setSelectedFloorInchargeId(null);
              }}
            />

            <PartsOption
              title="No Parts Required"
              description="No Store requisition is needed. Select a Floor Incharge and send the vehicle directly to Floor."
              selected={partsChoice === "NO_PARTS_REQUIRED"}
              disabled={saving}
              onPress={() => setPartsChoice("NO_PARTS_REQUIRED")}
            />
          </View>

          {/* FLOOR INCHARGE — DIRECT TO FLOOR */}

          {partsChoice === "NO_PARTS_REQUIRED" && (
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderWithStep}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>

                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Assign Floor Incharge</Text>

                  <Text style={styles.cardSubtitle}>
                    Required · This vehicle is moving directly to Floor
                  </Text>
                </View>
              </View>

              {!floorIncharges.length ? (
                <View style={styles.floorInchargeEmpty}>
                  <Text style={styles.floorInchargeEmptyTitle}>
                    No active Floor Incharge available
                  </Text>

                  <Text style={styles.floorInchargeEmptyText}>
                    Ask CEO Admin to activate or create a Floor Incharge before
                    continuing.
                  </Text>
                </View>
              ) : (
                <View style={styles.floorInchargeList}>
                  {floorIncharges.map((floorIncharge) => (
                    <FloorInchargeOption
                      key={floorIncharge.id}
                      name={floorIncharge.name || "Unnamed Floor Incharge"}
                      selected={selectedFloorInchargeId === floorIncharge.id}
                      disabled={saving}
                      onPress={() =>
                        setSelectedFloorInchargeId(floorIncharge.id)
                      }
                    />
                  ))}
                </View>
              )}

              <View style={styles.scopeNotice}>
                <Text style={styles.scopeNoticeText}>
                  The selected Floor Incharge will receive this vehicle
                  immediately with the approved Floor checklist.
                </Text>
              </View>
            </View>
          )}

          {/* PARTS REQUISITION */}

          {needsParts && (
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderWithStep}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>

                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Parts Requisition</Text>

                  <Text style={styles.cardSubtitle}>
                    Enter the requisition details
                  </Text>
                </View>
              </View>

              <StoreInchargePicker value={selectedStoreInchargeId} onChange={setSelectedStoreInchargeId} disabled={saving} />

              <Text style={styles.fieldLabel}>
                Requisition Number
                <Text style={styles.required}> *</Text>
              </Text>

              <TextInput
                value={requisitionNo}
                onChangeText={setRequisitionNo}
                placeholder="Enter requisition number"
                placeholderTextColor={colors.textLight}
                style={styles.input}
                editable={!saving}
                autoCapitalize="characters"
              />

              <DateValueField {...visitDates.bounds()} error={visitDates.error} onValidationError={dateValidation.field("Requisition Date & Time")} label="Requisition Date & Time" value={requisitionAt} onChange={setRequisitionAt}
 maximumDate="now" disabled={saving} active={!popupVisible && !confirmationVisible} />
            </View>
          )}

          {/* REMARKS */}

          {partsChoice && (
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Remarks</Text>

              <Text style={styles.cardSubtitle}>Optional information</Text>

              <TextInput
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Optional remarks"
                placeholderTextColor={colors.textLight}
                style={[styles.input, styles.textArea]}
                editable={!saving}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {/* SUMMARY */}

          {partsChoice && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Advisor Work Summary</Text>

                <View style={styles.summaryStatus}>
                  <Text style={styles.summaryStatusText}>READY</Text>
                </View>
              </View>

              <Text style={styles.summaryWork}>
                {needsParts ? "Parts Required" : "No Parts Required"}
              </Text>

              <Text style={styles.summaryDetails}>
                Approved Floor work: {approvedNames.join(", ")}
              </Text>

              {needsParts && (
                <Text style={styles.summaryDetails}>
                  Parts requisition: {requisitionNo.trim() || "Not entered"}
                </Text>
              )}

              {!needsParts && (
                <Text style={styles.summaryDetails}>
                  Floor Incharge:{" "}
                  {selectedFloorIncharge?.name || "Not selected"}
                </Text>
              )}

              <View style={styles.summaryWorkflowRow}>
                <View style={styles.summaryWorkflowItem}>
                  <Text style={styles.summaryWorkflowLabel}>PARTS</Text>

                  <Text style={styles.summaryWorkflowValue}>
                    {needsParts ? "Required" : "Not required"}
                  </Text>
                </View>

                <View style={styles.summaryWorkflowItem}>
                  <Text style={styles.summaryWorkflowLabel}>NEXT STAGE</Text>

                  <Text
                    style={[
                      styles.summaryWorkflowValue,

                      styles.summaryNextStage,
                    ]}
                  >
                    {nextStage}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>

        {/* STICKY ACTION */}

        <View style={styles.bottomAction}>
          <Pressable
            onPress={handleContinue}
            disabled={
              loading ||
              saving ||
              !!loadError ||
              !vehicle ||
              !approvalCycle ||
              !approvedWork.length ||
              !partsChoice
            }
            style={[
              styles.saveButton,

              (!partsChoice || saving) && styles.saveButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>Save Work Requirement</Text>

                <Text style={styles.saveButtonArrow}>→</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>





      {/* CONFIRMATION */}

      <Modal
        visible={confirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !saving && setConfirmationVisible(false)}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Text style={styles.confirmIconText}>✓</Text>
            </View>

            <Text style={styles.confirmTitle}>Confirm Advisor Work</Text>

            <Text style={styles.confirmSubtitle}>
              Review the routing before saving.
            </Text>

            <View style={styles.confirmDetails}>
              <ConfirmRow label="Vehicle" value={vehicle?.vehicle_no || "—"} />

              <ConfirmRow
                label="Approved Floor Work"
                value={approvedNames.join(", ") || "—"}
              />

              <ConfirmRow
                label="Parts"
                value={needsParts ? "Required" : "Not required"}
              />

              {needsParts && (
                <ConfirmRow
                  label="Requisition"
                  value={requisitionNo.trim() || "—"}
                />
              )}

              {!needsParts && (
                <ConfirmRow
                  label="Floor Incharge"
                  value={selectedFloorIncharge?.name || "—"}
                />
              )}

              <ConfirmRow label="Next Stage" value={nextStage} highlight />
            </View>

            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => !saving && setConfirmationVisible(false)}
                disabled={saving}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={styles.confirmButton}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm & Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
        </SafeAreaView>
      </Modal>

      {/* GENERAL POPUP */}

      <Modal
        visible={popupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPopupVisible(false)}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View
              style={[
                styles.popupIcon,

                popupType === "success" && styles.popupIconSuccess,

                popupType === "error" && styles.popupIconError,

                popupType === "warning" && styles.popupIconWarning,

                popupType === "info" && styles.popupIconInfo,
              ]}
            >
              <Text style={styles.popupIconText}>
                {popupType === "success"
                  ? "✓"
                  : popupType === "info"
                    ? "i"
                    : "!"}
              </Text>
            </View>

            <Text style={styles.popupTitle}>{popupTitle}</Text>

            <Text style={styles.popupMessage}>{popupMessage}</Text>

            <Pressable onPress={handlePopupClose} style={styles.popupButton}>
              <Text style={styles.popupButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function InfoBox({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  );
}

function PartsOption({
  title,

  description,

  selected,

  disabled,

  onPress,
}: {
  title: string;

  description: string;

  selected: boolean;

  disabled: boolean;

  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.workOption, selected && styles.workOptionSelected]}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>

      <View style={styles.workOptionContent}>
        <Text
          style={[
            styles.workOptionTitle,

            selected && styles.workOptionTitleSelected,
          ]}
        >
          {title}
        </Text>

        <Text style={styles.workOptionDescription}>{description}</Text>
      </View>

      {selected && (
        <View style={styles.selectedCheck}>
          <Text style={styles.selectedCheckText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

function FloorInchargeOption({
  name,
  selected,
  disabled,
  onPress,
}: {
  name: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.floorInchargeOption,
        selected && styles.floorInchargeOptionSelected,
      ]}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>

      <View style={styles.workOptionContent}>
        <Text
          style={[
            styles.workOptionTitle,
            selected && styles.workOptionTitleSelected,
          ]}
        >
          {name}
        </Text>

        <Text style={styles.workOptionDescription}>Floor Incharge</Text>
      </View>

      {selected && (
        <View style={styles.selectedCheck}>
          <Text style={styles.selectedCheckText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

function ConfirmRow({
  label,

  value,

  highlight = false,
}: {
  label: string;

  value: string;

  highlight?: boolean;
}) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>{label}</Text>

      <Text style={[styles.confirmValue, highlight && styles.confirmNextStage]}>
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

  container: {
    flex: 1,

    backgroundColor: colors.background,
  },

  loadingContainer: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.background,
  },

  loadingText: {
    marginTop: spacing.md,

    fontSize: 14,

    color: colors.textSecondary,
  },

  topBar: {
    height: 42,

    paddingHorizontal: spacing.md,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  backButton: {
    flexDirection: "row",

    alignItems: "center",
  },

  backArrow: {
    fontSize: 26,

    lineHeight: 28,

    color: colors.primary,

    marginRight: 2,
  },

  backText: {
    fontSize: 15,

    fontWeight: "700",

    color: colors.primary,
  },

  brandText: {
    fontSize: 11,

    fontWeight: "900",

    letterSpacing: 1.4,

    color: colors.text,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.md,

    paddingTop: spacing.sm,

    paddingBottom: spacing.lg,
  },

  heroCard: {
    backgroundColor: "#F20D1D",

    borderRadius: 20,

    paddingHorizontal: spacing.md,

    paddingTop: spacing.md,

    paddingBottom: spacing.md,

    marginBottom: spacing.md,

    minHeight: 166,
  },

  heroEyebrow: {
    color: "#FFFFFF",

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 1.2,

    marginBottom: 6,
  },

  heroTitle: {
    color: "#FFFFFF",

    fontSize: 24,

    fontWeight: "900",

    lineHeight: 29,
  },

  heroDescription: {
    color: "rgba(255,255,255,0.92)",

    fontSize: 13,

    lineHeight: 18,

    marginTop: 5,

    maxWidth: 650,
  },

  heroBottomRow: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 23,
  },

  vehicleHeroPill: {
    backgroundColor: "rgba(255,255,255,0.18)",

    borderRadius: 999,

    paddingHorizontal: 13,

    paddingVertical: 7,
  },

  vehicleHeroText: {
    color: "#FFFFFF",

    fontSize: 13,

    fontWeight: "900",

    letterSpacing: 0.5,
  },

  sectionCard: {
    backgroundColor: colors.surface,

    borderRadius: radius.lg,

    borderWidth: 1,

    borderColor: colors.border,

    padding: spacing.md,

    marginBottom: spacing.md,
  },

  sectionCardHeader: {
    marginBottom: spacing.md,
  },

  cardHeaderWithStep: {
    flexDirection: "row",

    alignItems: "center",

    marginBottom: spacing.md,
  },

  stepCircle: {
    width: 32,

    height: 32,

    borderRadius: 16,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",

    marginRight: spacing.sm,
  },

  stepNumber: {
    color: "#FFFFFF",

    fontSize: 14,

    fontWeight: "900",
  },

  cardHeaderText: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 17,

    fontWeight: "900",

    color: colors.text,
  },

  cardSubtitle: {
    marginTop: 3,

    fontSize: 12,

    color: colors.textSecondary,
  },

  infoGrid: {
    flexDirection: "row",

    flexWrap: "wrap",

    marginHorizontal: -5,
  },

  infoBox: {
    width: "50%",

    paddingHorizontal: 5,

    marginBottom: spacing.md,
  },

  infoBoxFull: {
    width: "100%",

    paddingHorizontal: 5,
  },

  infoLabel: {
    fontSize: 10,

    fontWeight: "700",

    color: colors.textSecondary,

    marginBottom: 4,
  },

  infoValue: {
    fontSize: 14,

    fontWeight: "700",

    color: colors.text,
  },

  scopeList: {
    gap: 9,
  },

  scopeItem: {
    flexDirection: "row",

    alignItems: "center",

    borderRadius: radius.md,

    backgroundColor: colors.background,

    borderWidth: 1,

    borderColor: colors.border,

    padding: 12,
  },

  scopeCheck: {
    width: 28,

    height: 28,

    borderRadius: 9,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",

    marginRight: 10,
  },

  scopeCheckText: {
    color: colors.primary,

    fontWeight: "900",
  },

  scopeName: {
    color: colors.text,

    fontSize: 14,

    fontWeight: "800",
  },

  scopeDescription: {
    marginTop: 2,

    color: colors.textSecondary,

    fontSize: 11,
  },

  scopeNotice: {
    marginTop: 12,

    borderRadius: radius.md,

    padding: 11,

    backgroundColor: colors.primaryLight,
  },

  scopeNoticeText: {
    color: colors.primaryDark,

    fontSize: 11,

    lineHeight: 17,

    fontWeight: "700",
  },

  workOption: {
    minHeight: 90,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: radius.lg,

    backgroundColor: colors.background,

    padding: spacing.md,

    flexDirection: "row",

    alignItems: "center",

    marginBottom: spacing.sm,
  },

  workOptionSelected: {
    borderColor: colors.primary,

    backgroundColor: colors.primaryLight,
  },

  radioOuter: {
    width: 24,

    height: 24,

    borderRadius: 12,

    borderWidth: 2,

    borderColor: colors.border,

    alignItems: "center",

    justifyContent: "center",

    marginRight: spacing.md,
  },

  radioOuterSelected: {
    borderColor: colors.primary,
  },

  radioInner: {
    width: 12,

    height: 12,

    borderRadius: 6,

    backgroundColor: colors.primary,
  },

  workOptionContent: {
    flex: 1,
  },

  workOptionTitle: {
    fontSize: 14,

    fontWeight: "900",

    color: colors.text,
  },

  workOptionTitleSelected: {
    color: colors.primary,
  },

  workOptionDescription: {
    marginTop: 4,

    fontSize: 11,

    lineHeight: 17,

    color: colors.textSecondary,
  },

  selectedCheck: {
    width: 25,

    height: 25,

    borderRadius: 13,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",

    marginLeft: spacing.sm,
  },

  selectedCheckText: {
    color: "#FFFFFF",

    fontSize: 15,

    fontWeight: "900",
  },

  floorInchargeList: {
    gap: spacing.sm,
  },

  floorInchargeOption: {
    minHeight: 74,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },

  floorInchargeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  floorInchargeEmpty: {
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "#FFF4D8",
    borderWidth: 1,
    borderColor: "#F1D88B",
  },

  floorInchargeEmptyTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#946200",
  },

  floorInchargeEmptyText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
    color: "#946200",
  },

  fieldLabel: {
    fontSize: 12,

    fontWeight: "800",

    color: colors.text,

    marginBottom: 7,

    marginTop: 4,
  },

  required: {
    color: "#D71920",
  },

  input: {
    minHeight: 48,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: radius.md,

    backgroundColor: colors.background,

    paddingHorizontal: 13,

    color: colors.text,

    fontSize: 14,
  },

  textArea: {
    minHeight: 95,

    paddingTop: 12,

    marginTop: 12,
  },

  dateTimeRow: {
    flexDirection: "row",

    gap: spacing.sm,

    marginTop: 10,
  },

  dateTimeColumn: {
    flex: 1,
  },

  dateTimeButton: {
    minHeight: 48,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: radius.md,

    backgroundColor: colors.background,

    paddingHorizontal: 12,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  dateTimeValue: {
    fontSize: 13,

    fontWeight: "700",

    color: colors.text,
  },

  dateTimeIcon: {
    fontSize: 17,

    color: colors.primary,
  },

  summaryCard: {
    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: radius.lg,

    padding: spacing.md,

    marginBottom: spacing.md,
  },

  summaryHeader: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  summaryTitle: {
    fontSize: 13,

    fontWeight: "800",

    color: colors.textSecondary,
  },

  summaryStatus: {
    backgroundColor: colors.primaryLight,

    borderRadius: 999,

    paddingHorizontal: 9,

    paddingVertical: 5,
  },

  summaryStatusText: {
    fontSize: 9,

    fontWeight: "900",

    color: colors.primary,
  },

  summaryWork: {
    marginTop: 8,

    fontSize: 15,

    fontWeight: "900",

    color: colors.text,
  },

  summaryDetails: {
    marginTop: 8,

    fontSize: 12,

    color: colors.textSecondary,
  },

  summaryWorkflowRow: {
    flexDirection: "row",

    marginTop: 12,

    paddingTop: 11,

    borderTopWidth: 1,

    borderTopColor: colors.border,
  },

  summaryWorkflowItem: {
    flex: 1,
  },

  summaryWorkflowLabel: {
    fontSize: 9,

    fontWeight: "800",

    color: colors.textSecondary,

    marginBottom: 3,
  },

  summaryWorkflowValue: {
    fontSize: 12,

    fontWeight: "800",

    color: colors.text,
  },

  summaryNextStage: {
    color: colors.primary,
  },

  bottomSpace: {
    height: 90,
  },

  bottomAction: {
    paddingHorizontal: spacing.md,

    paddingTop: spacing.sm,

    paddingBottom: spacing.sm,

    backgroundColor: colors.background,

    borderTopWidth: 1,

    borderTopColor: colors.divider,
  },

  saveButton: {
    minHeight: 54,

    borderRadius: radius.lg,

    backgroundColor: colors.primary,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: spacing.md,
  },

  saveButtonDisabled: {
    opacity: 0.45,
  },

  saveButtonText: {
    color: "#FFFFFF",

    fontSize: 15,

    fontWeight: "900",
  },

  saveButtonArrow: {
    color: "#FFFFFF",

    fontSize: 21,

    fontWeight: "900",

    marginLeft: 10,
  },

  modalOverlay: {
    flex: 1,

    backgroundColor: "rgba(0,0,0,0.48)",

    alignItems: "center",

    justifyContent: "center",

    padding: spacing.lg,
  },

  confirmCard: {
    width: "100%",

    maxWidth: 440,

    backgroundColor: colors.surface,

    borderRadius: radius.lg,

    padding: spacing.lg,
  },

  confirmIcon: {
    width: 50,

    height: 50,

    borderRadius: 25,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",

    alignSelf: "center",

    marginBottom: spacing.sm,
  },

  confirmIconText: {
    color: colors.primary,

    fontSize: 25,

    fontWeight: "900",
  },

  confirmTitle: {
    fontSize: 19,

    fontWeight: "900",

    color: colors.text,

    textAlign: "center",
  },

  confirmSubtitle: {
    fontSize: 13,

    lineHeight: 19,

    color: colors.textSecondary,

    textAlign: "center",

    marginTop: 5,

    marginBottom: spacing.md,
  },

  confirmDetails: {
    backgroundColor: colors.background,

    borderRadius: radius.md,

    padding: spacing.md,

    marginBottom: spacing.md,
  },

  confirmRow: {
    flexDirection: "row",

    alignItems: "flex-start",

    justifyContent: "space-between",

    paddingVertical: 6,
  },

  confirmLabel: {
    flex: 0.9,

    fontSize: 12,

    color: colors.textSecondary,
  },

  confirmValue: {
    flex: 1.4,

    fontSize: 13,

    fontWeight: "800",

    color: colors.text,

    textAlign: "right",
  },

  confirmNextStage: {
    color: colors.primary,
  },

  confirmActions: {
    flexDirection: "row",

    gap: spacing.sm,
  },

  cancelButton: {
    flex: 1,

    minHeight: 48,

    borderRadius: radius.md,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: "center",

    justifyContent: "center",
  },

  cancelButtonText: {
    color: colors.text,

    fontSize: 14,

    fontWeight: "800",
  },

  confirmButton: {
    flex: 1.25,

    minHeight: 48,

    borderRadius: radius.md,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",
  },

  confirmButtonText: {
    color: "#FFFFFF",

    fontSize: 14,

    fontWeight: "900",
  },

  popupCard: {
    width: "100%",

    maxWidth: 400,

    backgroundColor: colors.surface,

    borderRadius: radius.lg,

    padding: spacing.lg,

    alignItems: "center",
  },

  popupIcon: {
    width: 52,

    height: 52,

    borderRadius: 26,

    alignItems: "center",

    justifyContent: "center",

    marginBottom: spacing.sm,
  },

  popupIconSuccess: {
    backgroundColor: colors.primaryLight,
  },

  popupIconError: {
    backgroundColor: "#FDECEC",
  },

  popupIconWarning: {
    backgroundColor: "#FFF4D8",
  },

  popupIconInfo: {
    backgroundColor: "#EAF2FF",
  },

  popupIconText: {
    fontSize: 25,

    fontWeight: "900",

    color: colors.primary,
  },

  popupTitle: {
    fontSize: 19,

    fontWeight: "900",

    color: colors.text,

    textAlign: "center",
  },

  popupMessage: {
    marginTop: 7,

    fontSize: 13,

    lineHeight: 20,

    color: colors.textSecondary,

    textAlign: "center",
  },

  popupButton: {
    width: "100%",

    minHeight: 48,

    borderRadius: radius.md,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",

    marginTop: spacing.md,
  },

  popupButtonText: {
    color: "#FFFFFF",

    fontSize: 14,

    fontWeight: "900",
  },
});
