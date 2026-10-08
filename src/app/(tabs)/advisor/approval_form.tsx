import { KeyboardAvoidingView, Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import useDateTimeValidation from "../../../components/inputs/useDateTimeValidation";
import BackButton from "../../../components/navigation/BackButton";
import { returnToRoute, useHardwareBack, singleParam } from "../../../lib/back-navigation";
import DateValueField from "../../../components/inputs/DateValueField";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { checkWorkflowReadiness } from "../../../lib/workflow-readiness";
import { colors } from "../../../theme/colors";

const PHOTO_BUCKET = "vehicle-photos";

type Decision = "APPROVED" | "APPROVAL_HOLD" | "CLAIM_REJECTED" | "TOTAL_LOSS";

type PopupType = "success" | "error" | "warning" | "info";

type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
};

type Vehicle = {
  id: string;
  vehicle_no: string | null;
  customer_name: string | null;
  model: string | null;
  arena_nexa: string | null;
  vehicle_type: string | null;
  jc_no: string | null;
};

type VehicleIntake = {
  insurance_type: string | null;
  mi_type_id: string | null;
  insurance_company_id: string | null;
  job_card_no: string | null;
};

type InsuranceCompany = {
  id: string;
  name: string;
};

type Survey = {
  id: string;
  survey_no: number;
  survey_type: string | null;
  completed_at: string | null;
  paid_amount: number | null;
  receipt_reference_no: string | null;
  remarks: string | null;
};

type WorkType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

type Visit = {
  id: string;
  vehicle_id: string;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  stage_started_at: string | null;
};

type PhotoKind = "APPROVAL_ASSESSMENT" | "APPROVAL_ASSIGNMENT";

function formatDateTime(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();

  const minutes = String(date.getMinutes()).padStart(2, "0");

  const amPm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;

  if (hours === 0) {
    hours = 12;
  }

  return `${day}/${month}/${year} ${String(hours).padStart(
    2,
    "0",
  )}:${minutes} ${amPm}`;
}

function formatDateTimeForApi(date: Date) {
  return date.toISOString();
}

function getDecisionLabel(decision: Decision) {
  switch (decision) {
    case "APPROVED":
      return "Approved";

    case "APPROVAL_HOLD":
      return "Approval Hold";

    case "CLAIM_REJECTED":
      return "Claim Rejected";

    case "TOTAL_LOSS":
      return "Total Loss";

    default:
      return decision;
  }
}

function getDecisionDescription(decision: Decision) {
  switch (decision) {
    case "APPROVED":
      return "Approval has been received for the vehicle.";

    case "APPROVAL_HOLD":
      return "Approval is temporarily on hold and requires follow-up.";

    case "CLAIM_REJECTED":
      return "The insurance claim has been rejected.";

    case "TOTAL_LOSS":
      return "The vehicle has been declared a total loss.";

    default:
      return "";
  }
}

export default function ApprovalFormScreen() {
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
      returnToRoute("/(tabs)/advisor/approval_vehicles");
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

  const submittingRef = useRef(false);

  const [readinessError, setReadinessError] = useState("");

  const [visit, setVisit] = useState<Visit | null>(null);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  const [intake, setIntake] = useState<VehicleIntake | null>(null);

  const [insuranceCompany, setInsuranceCompany] =
    useState<InsuranceCompany | null>(null);

  const [survey, setSurvey] = useState<Survey | null>(null);

  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);

  const [selectedWorkTypeIds, setSelectedWorkTypeIds] = useState<string[]>([]);

  const [decision, setDecision] = useState<Decision>("APPROVED");

  const [decisionAt, setDecisionAt] = useState<Date>(() => new Date());



  const [remarks, setRemarks] = useState("");

  const [holdRemark, setHoldRemark] = useState("");

  const [remarksFocused, setRemarksFocused] = useState(false);

  const [holdRemarkFocused, setHoldRemarkFocused] = useState(false);

  const [selectedPhoto, setSelectedPhoto] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [selectedPhotoKind, setSelectedPhotoKind] = useState<PhotoKind>(
    "APPROVAL_ASSESSMENT",
  );

  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  const [showConfirmation, setShowConfirmation] = useState(false);

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

  const loadData = useCallback(async () => {
    if (!visitId || !vehicleId) {
      setLoading(false);

      showPopup(
        "error",
        "Missing Information",
        "Vehicle or visit information is missing.",
      );

      return;
    }

    try {
      setLoading(true);
      setReadinessError("");

      await checkWorkflowReadiness(visitId, vehicleId, "PENDING_APPROVAL");

      const [
        visitResult,
        vehicleResult,
        intakeResult,
        surveyResult,
        workTypesResult,
      ] = await Promise.all([
        supabase
          .from("workshop_visits")
          .select(
            "id,vehicle_id,current_stage,current_status,current_assigned_to,stage_started_at",
          )
          .eq("id", visitId)
          .single(),

        supabase
          .from("vehicles")
          .select(
            "id,vehicle_no,customer_name,model,arena_nexa,vehicle_type,jc_no",
          )
          .eq("id", vehicleId)
          .single(),

        supabase
          .from("vehicle_intake")
          .select("insurance_type,mi_type_id,insurance_company_id,job_card_no")
          .eq("visit_id", visitId)
          .maybeSingle(),

        supabase
          .from("surveys")
          .select(
            "id,survey_no,survey_type,completed_at,paid_amount,receipt_reference_no,remarks",
          )
          .eq("visit_id", visitId)
          .order("survey_no", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("work_type_master")
          .select("id,code,name,description")
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (visitResult.error) {
        throw visitResult.error;
      }

      if (vehicleResult.error) {
        throw vehicleResult.error;
      }

      if (intakeResult.error) {
        throw intakeResult.error;
      }

      if (surveyResult.error) {
        throw surveyResult.error;
      }

      if (workTypesResult.error) {
        throw workTypesResult.error;
      }

      const loadedIntake = intakeResult.data as VehicleIntake | null;

      let loadedInsuranceCompany: InsuranceCompany | null = null;

      if (
        loadedIntake?.insurance_type?.toUpperCase() === "INSURANCE" &&
        loadedIntake.insurance_company_id
      ) {
        const { data: companyData, error: companyError } = await supabase
          .from("insurance_companies")
          .select("id,name")
          .eq("id", loadedIntake.insurance_company_id)
          .maybeSingle();

        if (companyError) {
          throw companyError;
        }

        if (companyData) {
          loadedInsuranceCompany = companyData as InsuranceCompany;
        }
      }

      setVisit(visitResult.data as Visit);

      setVehicle(vehicleResult.data as Vehicle);

      setIntake(loadedIntake);

      setInsuranceCompany(loadedInsuranceCompany);

      setSurvey(surveyResult.data as Survey | null);

      const availableWorkTypes = (
        (workTypesResult.data || []) as WorkType[]
      ).filter(
        (item) =>
          !["FINAL_INSPECTION", "FINAL_INSPECTION_REWORK"].includes(item.code),
      );

      setWorkTypes(availableWorkTypes);

      const stripping = availableWorkTypes.find(
        (item) => item.code === "STRIPPING",
      );

      setSelectedWorkTypeIds((current) => {
        const validCurrent = current.filter((id) =>
          availableWorkTypes.some((item) => item.id === id),
        );

        if (
          loadedIntake?.insurance_type?.trim().toUpperCase() !== "INSURANCE" ||
          !stripping
        ) {
          return validCurrent;
        }

        return validCurrent.includes(stripping.id)
          ? validCurrent
          : [stripping.id, ...validCurrent];
      });
    } catch (error: any) {
      console.error("Approval form load error:", error);

      setReadinessError(
        error?.message || "Unable to verify this vehicle. Please refresh.",
      );

      showPopup(
        "error",
        "Unable to Load",
        error?.message || "Unable to load approval information.",
      );
    } finally {
      setLoading(false);
    }
  }, [visitId, vehicleId, showPopup]);

  useEffect(() => {
    loadData();
  }, [loadData]);





  /*
   * CAMERA
   */

  const requestCameraPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        showPopup(
          "warning",
          "Camera Permission Required",
          "Please allow camera access in your device settings to take a photo.",
        );

        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const photo = result.assets[0];

      setSelectedPhoto(photo);
      setPhotoUri(photo.uri);
      setShowPhotoOptions(false);
    } catch (error: any) {
      console.error("Camera photo error:", error);

      showPopup(
        "error",
        "Camera Error",
        error?.message || "Unable to open the camera.",
      );
    }
  };

  /*
   * GALLERY
   */

  const requestGalleryPhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showPopup(
          "warning",
          "Gallery Permission Required",
          "Please allow photo library access in your device settings to choose a photo.",
        );

        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const photo = result.assets[0];

      setSelectedPhoto(photo);
      setPhotoUri(photo.uri);
      setShowPhotoOptions(false);
    } catch (error: any) {
      console.error("Gallery photo error:", error);

      showPopup(
        "error",
        "Gallery Error",
        error?.message || "Unable to open the photo gallery.",
      );
    }
  };

  const removeSelectedPhoto = () => {
    setSelectedPhoto(null);
    setPhotoUri(null);
  };

  /*
   * UPLOAD APPROVAL PHOTO
   */

  const uploadApprovalPhoto = async (
    photo: ImagePicker.ImagePickerAsset,
    kind: PhotoKind,
  ) => {
    if (!vehicleId) {
      throw new Error("Vehicle ID is missing.");
    }

    const extension = photo.fileName?.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `approval_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`;

    const storagePath =
      `vehicles/${vehicleId}/APPROVAL/` + `${kind}/${fileName}`;

    const response = await fetch(photo.uri);

    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, blob, {
        contentType: photo.mimeType || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: authData } = await supabase.auth.getUser();

    const { data: photoRow, error: photoInsertError } = await supabase
      .from("vehicle_photos")
      .insert({
        vehicle_id: vehicleId,
        photo_type: kind,
        storage_path: storagePath,
        uploaded_by: authData.user?.id,
      })
      .select("id,storage_path,photo_type")
      .single();

    if (photoInsertError) {
      await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);

      throw photoInsertError;
    }

    return {
      id: photoRow.id,
      storagePath,
    };
  };

  const cleanupUploadedPhoto = async (
    photoId: string | null,
    storagePath: string | null,
  ) => {
    try {
      if (photoId) {
        await supabase.from("vehicle_photos").delete().eq("id", photoId);
      }

      if (storagePath) {
        await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
      }
    } catch (error) {
      console.warn("Approval photo cleanup error:", error);
    }
  };

  /*
   * VALIDATION
   */

  const validateBeforeSubmit = () => {
    const dateError = dateValidation.getError();
    if (dateError) { showPopup("warning", "Check date & time", dateError); return false; }
    if (!visitId) {
      showPopup("error", "Missing Visit", "Visit information is missing.");

      return false;
    }

    if (!decisionAt) {
      showPopup(
        "warning",
        "Date & Time Required",
        "Please select the approval decision date and time.",
      );

      return false;
    }

    if (decisionAt.getTime() > Date.now()) {
      showPopup(
        "warning",
        "Invalid Decision Time",
        "Approval decision date and time cannot be in the future.",
      );

      return false;
    }

    if (decision === "APPROVED") {
      if (
        !selectedWorkTypeIds.length ||
        selectedWorkTypeIds.some(
          (id) => !workTypes.some((work) => work.id === id),
        )
      ) {
        showPopup(
          "warning",
          "Floor Work Scope Required",
          "Select at least one available approved repair work type.",
        );
        return false;
      }
      const stripping = workTypes.find((item) => item.code === "STRIPPING");

      if (isInsuranceJob && !stripping) {
        showPopup(
          "error",
          "Stripping Work Type Missing",
          "Active Stripping work type is required before an approval can be completed.",
        );

        return false;
      }

      if (
        isInsuranceJob &&
        stripping &&
        !selectedWorkTypeIds.includes(stripping.id)
      ) {
        showPopup(
          "warning",
          "Floor Work Scope Required",
          "Stripping must be included in the approved Floor work scope.",
        );

        return false;
      }
    }

    if (decision === "APPROVED" || decision === "APPROVAL_HOLD") {
      if (!selectedPhoto) {
        showPopup(
          "warning",
          "Photo Required",
          decision === "APPROVED"
            ? "Please add the approval assessment photo using the camera or gallery."
            : "Please add the approval assignment sheet photo using the camera or gallery.",
        );

        return false;
      }
    }

    if (decision === "APPROVAL_HOLD" && !holdRemark.trim()) {
      showPopup(
        "warning",
        "Hold Remark Required",
        "Please enter the reason for putting this vehicle on approval hold.",
      );

      return false;
    }

    return true;
  };

  const openConfirmation = () => {
    if (loading || saving || readinessError || submittingRef.current) {
      return;
    }

    if (!validateBeforeSubmit()) {
      return;
    }

    setShowConfirmation(true);
  };

  /*
   * SUBMIT
   */

  const submitApproval = async () => {
    if (submittingRef.current || loading || readinessError) {
      return;
    }

    setShowConfirmation(false);

    if (!visitId || !vehicleId || !validateBeforeSubmit()) {
      return;
    }

    let uploadedPhotoId: string | null = null;

    let uploadedStoragePath: string | null = null;

    try {
      setSaving(true);
      submittingRef.current = true;

      try {
        await checkWorkflowReadiness(visitId, vehicleId, "PENDING_APPROVAL");
      } catch (error: any) {
        setReadinessError(
          error?.message || "Unable to verify this vehicle. Please refresh.",
        );

        throw error;
      }

      let photoReference: string | null = null;

      if (
        selectedPhoto &&
        (decision === "APPROVED" || decision === "APPROVAL_HOLD")
      ) {
        const uploaded = await uploadApprovalPhoto(
          selectedPhoto,
          selectedPhotoKind,
        );

        uploadedPhotoId = uploaded.id;

        uploadedStoragePath = uploaded.storagePath;

        photoReference = uploaded.storagePath;
      }

      const cleanRemarks = remarks.trim() || null;

      const cleanHoldRemark = holdRemark.trim() || null;

      const { data, error } = await supabase.rpc(
        "new_workflow_process_approval",
        {
          p_visit_id: visitId,
          p_decision: decision,
          p_decision_at: formatDateTimeForApi(decisionAt),
          p_remarks: cleanRemarks,
          p_hold_remark: cleanHoldRemark,
          p_photo_reference: photoReference,
          p_work_type_ids: decision === "APPROVED" ? selectedWorkTypeIds : [],
        },
      );

      if (error) {
        throw error;
      }

      console.log("Approval process result:", data);

      setSaving(false);

      showPopup(
        "success",
        "Approval Updated",
        `Vehicle ${
          vehicle?.vehicle_no || ""
        } has been marked as ${getDecisionLabel(decision)}.`,
      );
    } catch (error: any) {
      console.error("Approval submit error:", error);

      await cleanupUploadedPhoto(uploadedPhotoId, uploadedStoragePath);

      setSaving(false);

      showPopup(
        "error",
        "Unable to Save",
        error?.message || "Unable to process the approval.",
      );
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const handleSuccessPopupClose = () => {
    const wasSuccess = popup.type === "success";

    closePopup();

    if (wasSuccess) {
      router.replace("/(tabs)/advisor/approval_vehicles");
    }
  };

  const toggleWorkType = (workType: WorkType) => {
    if (saving || (isInsuranceJob && workType.code === "STRIPPING")) {
      return;
    }

    setSelectedWorkTypeIds((current) =>
      current.includes(workType.id)
        ? current.filter((id) => id !== workType.id)
        : [...current, workType.id],
    );
  };

  const handleDecisionChange = (item: Decision) => {
    setDecision(item);

    if (item === "APPROVED") {
      setSelectedPhotoKind("APPROVAL_ASSESSMENT");
    }

    if (item === "APPROVAL_HOLD") {
      setSelectedPhotoKind("APPROVAL_ASSIGNMENT");
    }

    setSelectedPhoto(null);
    setPhotoUri(null);

    if (item !== "APPROVAL_HOLD") {
      setHoldRemark("");
      setHoldRemarkFocused(false);
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

          <Text style={styles.loadingText}>Loading approval details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle || !visit || readinessError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loadingContainer}>
          <Text style={styles.errorTitle}>Approval details unavailable</Text>

          <Text style={styles.errorMessage}>
            {readinessError || "The vehicle or visit could not be loaded."}
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              closePopup();
              void loadData();
            }}
          >
            <Text style={styles.primaryButtonText}>Refresh</Text>
          </Pressable>

          <BackButton onPress={() => router.replace("/(tabs)/advisor/approval_vehicles")} />
        </View>
      </SafeAreaView>
    );
  }

  const requiresPhoto = decision === "APPROVED" || decision === "APPROVAL_HOLD";

  const photoTitle =
    decision === "APPROVAL_HOLD"
      ? "Approval Assignment Sheet"
      : "Approval Assessment Photo";

  const photoDescription =
    decision === "APPROVAL_HOLD"
      ? "Upload the assignment sheet received for this approval hold."
      : "Upload the approval assessment or approval document.";

  const insuranceType = intake?.insurance_type?.trim().toUpperCase() || "";

  const isInsuranceJob = insuranceType === "INSURANCE";

  const isPaidJob = insuranceType === "PAID";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}

          <View style={styles.header}>
            <BackButton onPress={handleNavigationBack} />

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Approval</Text>

              <Text style={styles.headerSubtitle}>Process survey approval</Text>
            </View>
          </View>

          {/* VEHICLE CARD */}

          <View style={styles.vehicleCard}>
            <View style={styles.vehicleCardTop}>
              <View style={styles.vehicleIdentity}>
                <Text style={styles.vehicleNumber}>
                  {vehicle.vehicle_no || "Vehicle"}
                </Text>

                <Text style={styles.vehicleModel}>
                  {vehicle.model || "Model not available"}
                </Text>
              </View>

              <View style={styles.stageBadge}>
                <Text style={styles.stageBadgeText}>PENDING APPROVAL</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Customer</Text>

                <Text style={styles.infoValue}>
                  {vehicle.customer_name || "—"}
                </Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Vehicle Type</Text>

                <Text style={styles.infoValue}>
                  {vehicle.vehicle_type || "—"}
                </Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Arena / Nexa</Text>

                <Text style={styles.infoValue}>
                  {vehicle.arena_nexa || "—"}
                </Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Job Card</Text>

                <Text style={styles.infoValue}>
                  {vehicle.jc_no || intake?.job_card_no || "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* SURVEY CARD */}

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTextContainer}>
                <Text style={styles.sectionTitle}>Survey Information</Text>

                <Text style={styles.sectionDescription}>
                  Details recorded during the completed survey.
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Survey No.</Text>

              <Text style={styles.detailValue}>{survey?.survey_no ?? "—"}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {isInsuranceJob ? "Insurance Company" : "Job Type"}
              </Text>

              <Text style={styles.detailValue}>
                {isInsuranceJob
                  ? insuranceCompany?.name || "Insurance company not recorded"
                  : isPaidJob
                    ? "Paid Job"
                    : intake?.insurance_type || "—"}
              </Text>
            </View>

            {isPaidJob && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Paid Amount</Text>

                  <Text style={styles.detailValue}>
                    {survey?.paid_amount != null
                      ? `₹${Number(survey.paid_amount).toLocaleString("en-IN")}`
                      : "—"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Receipt / Reference</Text>

                  <Text style={styles.detailValue}>
                    {survey?.receipt_reference_no || "—"}
                  </Text>
                </View>
              </>
            )}

            {survey?.remarks ? (
              <View style={styles.remarksBox}>
                <Text style={styles.infoLabel}>Survey Remarks</Text>

                <Text style={styles.remarksText}>{survey.remarks}</Text>
              </View>
            ) : null}
          </View>

          {/* DECISION */}

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTextContainer}>
                <Text style={styles.sectionTitle}>Approval Decision</Text>

                <Text style={styles.sectionDescription}>
                  Select the result received from the insurance approval
                  process.
                </Text>
              </View>

              <View style={styles.requiredBadge}>
                <Text style={styles.requiredBadgeText}>Required</Text>
              </View>
            </View>

            <View style={styles.decisionGrid}>
              {(
                [
                  "APPROVED",
                  "APPROVAL_HOLD",
                  "CLAIM_REJECTED",
                  "TOTAL_LOSS",
                ] as Decision[]
              ).map((item) => {
                const active = decision === item;

                return (
                  <Pressable
                    key={item}
                    onPress={() => handleDecisionChange(item)}
                    style={[
                      styles.decisionOption,
                      active && styles.decisionOptionActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        active && styles.radioOuterActive,
                      ]}
                    >
                      {active ? <View style={styles.radioInner} /> : null}
                    </View>

                    <View style={styles.decisionTextContainer}>
                      <View style={styles.decisionTitleRow}>
                        <Text
                          style={[
                            styles.decisionTitle,
                            active && styles.decisionTitleActive,
                          ]}
                        >
                          {getDecisionLabel(item)}
                        </Text>

                        {active ? (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>
                              Selected
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.decisionDescription}>
                        {getDecisionDescription(item)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {decision === "APPROVED" && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderTextContainer}>
                  <Text style={styles.sectionTitle}>Approved Floor Work</Text>

                  <Text style={styles.sectionDescription}>
                    Select at least one repair work type approved for this
                    vehicle.{" "}
                    {isPaidJob
                      ? "Stripping is optional for Paid jobs."
                      : "Stripping is required for Insurance jobs."}{" "}
                    Final Inspection is mandatory after Floor work and is
                    included in the workflow automatically.
                  </Text>
                </View>

                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredBadgeText}>Required</Text>
                </View>
              </View>

              <View style={styles.workScopeGrid}>
                {workTypes.map((workType) => {
                  const selected = selectedWorkTypeIds.includes(workType.id);

                  const mandatory =
                    isInsuranceJob && workType.code === "STRIPPING";

                  return (
                    <Pressable
                      key={workType.id}
                      onPress={() => toggleWorkType(workType)}
                      disabled={saving || mandatory}
                      accessibilityRole="checkbox"
                      accessibilityLabel={workType.name}
                      accessibilityState={{
                        checked: selected,
                        disabled: saving || mandatory,
                      }}
                      style={[
                        styles.workScopeOption,
                        selected && styles.workScopeOptionSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.workScopeCheck,
                          selected && styles.workScopeCheckSelected,
                        ]}
                      >
                        {selected ? (
                          <Text style={styles.workScopeCheckText}>✓</Text>
                        ) : null}
                      </View>

                      <View style={styles.workScopeText}>
                        <View style={styles.workScopeTitleRow}>
                          <Text
                            style={[
                              styles.workScopeTitle,
                              selected && styles.workScopeTitleSelected,
                            ]}
                          >
                            {workType.name}
                          </Text>

                          {mandatory ? (
                            <View style={styles.mandatoryWorkBadge}>
                              <Text style={styles.mandatoryWorkBadgeText}>
                                Always required
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.workScopeDescription}>
                          {workType.description ||
                            (mandatory
                              ? "Initial stripping and supplementary discovery."
                              : "Include only when this repair work is approved for the vehicle.")}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.scopeSummary}>
                <Text style={styles.scopeSummaryLabel}>Floor checklist</Text>

                <Text style={styles.scopeSummaryValue}>
                  {selectedWorkTypeIds.length} work{" "}
                  {selectedWorkTypeIds.length === 1 ? "item" : "items"} selected
                </Text>
              </View>
            </View>
          )}

          {/* DATE / TIME */}

          <DateValueField onValidationError={dateValidation.field("Approval Date & Time")} title="Decision Date & Time" label="Approval Date & Time"
 description="Enter the actual date and time when the approval decision was received."
 value={decisionAt} onChange={setDecisionAt} maximumDate="now"
 disabled={saving} active={!popup.visible && !showConfirmation} />

          {/* PHOTO */}

          {requiresPhoto && (
            <View style={styles.sectionCard}>
              <View style={styles.photoTitleRow}>
                <View style={styles.photoTitleContainer}>
                  <Text style={styles.sectionTitle}>{photoTitle}</Text>

                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>Required</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionDescription}>{photoDescription}</Text>

              {photoUri ? (
                <View style={styles.photoPreviewContainer}>
                  <Image
                    source={{
                      uri: photoUri,
                    }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />

                  <View style={styles.photoPreviewActions}>
                    <Pressable
                      style={styles.secondaryPhotoButton}
                      onPress={() => setShowPhotoOptions(true)}
                    >
                      <Text style={styles.secondaryPhotoButtonText}>
                        Retake / Change
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.removePhotoButton}
                      onPress={removeSelectedPhoto}
                    >
                      <Text style={styles.removePhotoButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={styles.addPhotoButton}
                  onPress={() => setShowPhotoOptions(true)}
                >
                  <View style={styles.addPhotoIconCircle}>
                    <Text style={styles.addPhotoIcon}>+</Text>
                  </View>

                  <View style={styles.addPhotoTextContainer}>
                    <Text style={styles.addPhotoTitle}>Add Photo</Text>

                    <Text style={styles.addPhotoSubtitle}>
                      Camera or Gallery
                    </Text>
                  </View>

                  <Text style={styles.addPhotoArrow}>›</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* HOLD REMARK */}

          {decision === "APPROVAL_HOLD" && (
            <View style={styles.sectionCard}>
              <View style={styles.inputHeaderRow}>
                <View style={styles.inputHeaderTextContainer}>
                  <Text style={styles.sectionTitle}>Hold Remark</Text>

                  <Text style={styles.sectionDescription}>
                    Explain why the approval is being kept on hold.
                  </Text>
                </View>

                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredBadgeText}>Required</Text>
                </View>
              </View>

              <TextInput
                value={holdRemark}
                onChangeText={setHoldRemark}
                placeholder="Enter hold reason..."
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
                maxLength={500}
                onFocus={() => setHoldRemarkFocused(true)}
                onBlur={() => setHoldRemarkFocused(false)}
                style={[
                  styles.textInput,
                  holdRemarkFocused && styles.textInputFocused,
                ]}
              />

              <View style={styles.inputFooter}>
                <Text style={styles.inputHint}>
                  Please provide a clear reason for the hold.
                </Text>

                <Text style={styles.characterCount}>
                  {holdRemark.length}
                  /500
                </Text>
              </View>
            </View>
          )}

          {/* REMARKS */}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Remarks</Text>

            <Text style={styles.sectionDescription}>
              Optional remarks related to this approval decision.
            </Text>

            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter remarks..."
              placeholderTextColor={colors.textLight}
              multiline
              textAlignVertical="top"
              maxLength={500}
              onFocus={() => setRemarksFocused(true)}
              onBlur={() => setRemarksFocused(false)}
              style={[
                styles.textInput,
                remarksFocused && styles.textInputFocused,
              ]}
            />

            <View style={styles.inputFooter}>
              <Text style={styles.inputHint}>
                You can add any additional approval-related information.
              </Text>

              <Text style={styles.characterCount}>{remarks.length}/500</Text>
            </View>
          </View>

          {/* SUBMIT */}

          <Pressable
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={openConfirmation}
            disabled={saving || loading || !!readinessError}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />

                <Text style={styles.submitButtonText}>Processing...</Text>
              </>
            ) : (
              <>
                <Text style={styles.submitButtonText}>Process Approval</Text>

                <Text style={styles.submitButtonArrow}>→</Text>
              </>
            )}
          </Pressable>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CAMERA / GALLERY */}

      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowPhotoOptions(false)}
        >
          <Pressable
            style={styles.photoOptionsModal}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Add Photo</Text>

            <Text style={styles.modalMessage}>
              Choose how you want to add the required document photo.
            </Text>

            <Pressable
              style={styles.photoOptionButton}
              onPress={requestCameraPhoto}
            >
              <View style={styles.photoOptionIcon}>
                <Text style={styles.photoOptionEmoji}>📷</Text>
              </View>

              <View style={styles.photoOptionTextContainer}>
                <Text style={styles.photoOptionTitle}>Take Photo</Text>

                <Text style={styles.photoOptionSubtitle}>
                  Use your device camera
                </Text>
              </View>

              <Text style={styles.optionArrow}>›</Text>
            </Pressable>

            <Pressable
              style={styles.photoOptionButton}
              onPress={requestGalleryPhoto}
            >
              <View style={styles.photoOptionIcon}>
                <Text style={styles.photoOptionEmoji}>🖼️</Text>
              </View>

              <View style={styles.photoOptionTextContainer}>
                <Text style={styles.photoOptionTitle}>Choose from Gallery</Text>

                <Text style={styles.photoOptionSubtitle}>
                  Select an existing photo
                </Text>
              </View>

              <Text style={styles.optionArrow}>›</Text>
            </Pressable>

            <Pressable
              style={styles.cancelModalButton}
              onPress={() => setShowPhotoOptions(false)}
            >
              <Text style={styles.cancelModalButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </SafeAreaView>
      </Modal>

      {/* CONFIRMATION */}

      <Modal
        visible={showConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmation(false)}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIcon}>
              <Text style={styles.confirmationIconText}>?</Text>
            </View>

            <Text style={styles.modalTitle}>Confirm Approval</Text>

            <Text style={styles.modalMessage}>
              Are you sure you want to mark this vehicle as{" "}
              <Text style={styles.modalStrongText}>
                {getDecisionLabel(decision)}
              </Text>
              ?
            </Text>

            <View style={styles.confirmationSummary}>
              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Vehicle</Text>

                <Text style={styles.confirmationValue}>
                  {vehicle.vehicle_no || "—"}
                </Text>
              </View>

              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Decision</Text>

                <Text style={styles.confirmationValue}>
                  {getDecisionLabel(decision)}
                </Text>
              </View>

              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Decision Time</Text>

                <Text style={styles.confirmationValue}>
                  {formatDateTime(decisionAt)}
                </Text>
              </View>

              {isInsuranceJob && (
                <View style={styles.confirmationRow}>
                  <Text style={styles.confirmationLabel}>Insurance</Text>

                  <Text style={styles.confirmationValue}>
                    {insuranceCompany?.name || "Not recorded"}
                  </Text>
                </View>
              )}

              {decision === "APPROVED" ? (
                <View style={styles.confirmationRow}>
                  <Text style={styles.confirmationLabel}>Floor Work</Text>

                  <Text style={styles.confirmationValue}>
                    {workTypes
                      .filter((workType) =>
                        selectedWorkTypeIds.includes(workType.id),
                      )
                      .map((workType) => workType.name)
                      .join(", ")}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modalButtonRow}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setShowConfirmation(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.confirmButton} onPress={submitApproval}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </SafeAreaView>
      </Modal>

      {/* POPUP */}

      <Modal
        visible={popup.visible}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessPopupClose}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalBackdrop}>
          <View style={styles.popupModal}>
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
                {popup.type === "success"
                  ? "✓"
                  : popup.type === "error"
                    ? "!"
                    : popup.type === "warning"
                      ? "!"
                      : "i"}
              </Text>
            </View>

            <Text style={styles.popupTitle}>{popup.title}</Text>

            <Text style={styles.popupMessage}>{popup.message}</Text>

            <Pressable
              style={styles.popupButton}
              onPress={handleSuccessPopupClose}
            >
              <Text style={styles.popupButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardContainer: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },

  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  backButtonText: {
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
    marginTop: -3,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: colors.textSecondary,
  },

  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  vehicleCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  vehicleIdentity: {
    flex: 1,
    paddingRight: 10,
  },

  vehicleNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },

  vehicleModel: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },

  stageBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  stageBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 14,
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  infoItem: {
    width: "50%",
    paddingVertical: 6,
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textLight,
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  sectionHeaderTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },

  sectionDescription: {
    marginTop: 5,
    marginBottom: 14,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  detailValue: {
    maxWidth: "55%",
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },

  remarksBox: {
    marginTop: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },

  remarksText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },

  requiredBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  requiredBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },

  decisionGrid: {
    gap: 10,
  },

  decisionOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 13,
    backgroundColor: colors.background,
  },

  decisionOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    marginTop: 1,
  },

  radioOuterActive: {
    borderColor: colors.primary,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  decisionTextContainer: {
    flex: 1,
  },

  decisionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  decisionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  decisionTitleActive: {
    color: colors.primary,
  },

  selectedBadge: {
    backgroundColor: colors.primary,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  selectedBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  decisionDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  workScopeGrid: {
    gap: 10,
  },

  workScopeOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 13,
    backgroundColor: colors.background,
  },

  workScopeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  workScopeCheck: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    marginTop: 1,
  },

  workScopeCheckSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  workScopeCheckText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  workScopeText: {
    flex: 1,
  },

  workScopeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },

  workScopeTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  workScopeTitleSelected: {
    color: colors.primary,
  },

  workScopeDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  mandatoryWorkBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },

  mandatoryWorkBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },

  scopeSummary: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  scopeSummaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  scopeSummaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },

  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 13,
    backgroundColor: colors.background,
  },

  dateTimeContent: {
    flex: 1,
  },

  dateTimeLabel: {
    fontSize: 11,
    color: colors.textLight,
    marginBottom: 3,
  },

  dateTimeValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  calendarIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  calendarIcon: {
    fontSize: 19,
  },

  photoTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  photoTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },

  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: 15,
    padding: 15,
    backgroundColor: colors.primaryLight,
  },

  addPhotoIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  addPhotoIcon: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "400",
  },

  addPhotoTextContainer: {
    flex: 1,
  },

  addPhotoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  addPhotoSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },

  addPhotoArrow: {
    fontSize: 25,
    color: colors.primary,
    marginLeft: 8,
  },

  photoPreviewContainer: {
    overflow: "hidden",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },

  photoPreview: {
    width: "100%",
    height: 230,
    backgroundColor: colors.background,
  },

  photoPreviewActions: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    backgroundColor: colors.surface,
  },

  secondaryPhotoButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    alignItems: "center",
  },

  secondaryPhotoButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },

  removePhotoButton: {
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  removePhotoButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },

  inputHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  inputHeaderTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  textInput: {
    minHeight: 105,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },

  textInputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },

  inputFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 7,
    gap: 10,
  },

  inputHint: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textLight,
  },

  characterCount: {
    fontSize: 10,
    color: colors.textLight,
  },

  submitButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 18,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  submitButtonArrow: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

  primaryButton: {
    minWidth: 150,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  bottomSpace: {
    height: 30,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  photoOptionsModal: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
  },

  confirmationModal: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
  },

  popupModal: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
  },

  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 15,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 7,
  },

  modalMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },

  modalStrongText: {
    fontWeight: "800",
    color: colors.text,
  },

  photoOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginTop: 9,
    backgroundColor: colors.background,
  },

  photoOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  photoOptionEmoji: {
    fontSize: 22,
  },

  photoOptionTextContainer: {
    flex: 1,
  },

  photoOptionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  photoOptionSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },

  optionArrow: {
    fontSize: 25,
    color: colors.textLight,
    marginLeft: 8,
  },

  cancelModalButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  cancelModalButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  confirmationIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },

  confirmationIconText: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },

  confirmationSummary: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: colors.background,
    padding: 13,
    marginBottom: 17,
  },

  confirmationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },

  confirmationLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  confirmationValue: {
    maxWidth: "58%",
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },

  modalButtonRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },

  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  confirmButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  popupIconSuccess: {
    backgroundColor: "rgba(34,197,94,0.14)",
  },

  popupIconError: {
    backgroundColor: "rgba(239,68,68,0.14)",
  },

  popupIconWarning: {
    backgroundColor: "rgba(245,158,11,0.16)",
  },

  popupIconInfo: {
    backgroundColor: "rgba(59,130,246,0.14)",
  },

  popupIconText: {
    fontSize: 25,
    fontWeight: "900",
    color: colors.text,
  },

  popupTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 7,
  },

  popupMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 18,
  },

  popupButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  popupButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
