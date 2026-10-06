import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { styles } from "../../../../styles/survey_form.styles";
import { checkWorkflowReadiness } from "../../../lib/workflow-readiness";
import { colors } from "../../../theme";

import VehicleDetailsCard from "./components/VehicleDetailsCard";

type Vehicle = {
  id: string;
  vehicle_no: string;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  model: string | null;
  arena_nexa: string | null;
  vehicle_type: string | null;
  jc_no: string | null;
  stage_started_at: string | null;
};

type VehicleIntake = {
  insurance_type?: string | null;
  job_card_no?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  vehicle_type?: string | null;
  model?: string | null;
  arena_nexa?: string | null;
  [key: string]: unknown;
};

type Profile = {
  id: string;
  role: string;
  is_active: boolean;
  name?: string | null;
};

type WorkType = { id: string; code: string; name: string; is_active: boolean };

type PopupType = "success" | "error" | "warning" | "info";

type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
  primaryText?: string;
  secondaryText?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
};

const INITIAL_POPUP: PopupState = {
  visible: false,
  type: "info",
  title: "",
  message: "",
};

function formatIndiaDateTime(date: Date) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function contactValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return !text || ["—", "-", "null", "undefined"].includes(text.toLowerCase())
    ? null
    : text;
}

function normalizeInsuranceType(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionNumber}>
        <Text style={styles.sectionNumberText}>{number}</Text>
      </View>

      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.cardTitle}>{title}</Text>

        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function parseDateTime(value: string | null) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateTimeForApi(date: Date) {
  return date.toISOString();
}

function DateTimeField({
  label,
  value,
  onChange,
  helperText,
}: {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  helperText?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [draftDate, setDraftDate] = useState(value);

  useEffect(() => {
    setDraftDate(value);
  }, [value]);

  const openPicker = () => {
    setDraftDate(value);
    setPickerMode("date");
    setShowPicker(true);
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      if (event.type === "dismissed") {
        setShowPicker(false);
        return;
      }

      if (!selectedDate) return;

      if (pickerMode === "date") {
        const updated = new Date(draftDate);
        updated.setFullYear(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
        );
        setDraftDate(updated);
        setPickerMode("time");
        return;
      }

      const updated = new Date(draftDate);
      updated.setHours(
        selectedDate.getHours(),
        selectedDate.getMinutes(),
        0,
        0,
      );
      setDraftDate(updated);
      onChange(updated);
      setShowPicker(false);
      return;
    }

    if (selectedDate) {
      setDraftDate(selectedDate);
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={screenStyles.dateDisplay}>
        <Text style={screenStyles.dateDisplayIcon}>🕒</Text>
        <View style={screenStyles.dateDisplayCopy}>
          <Text style={screenStyles.dateDisplayLabel}>{label}</Text>
          <Text style={screenStyles.dateDisplayValue}>
            {formatIndiaDateTime(value)}
          </Text>
          <Text style={screenStyles.dateDisplayHelper}>
            Current date & time recorded automatically on Web · IST
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={screenStyles.dateFieldWrap}>
      <Text style={styles.label}>
        {label} <Text style={styles.required}>*</Text>
      </Text>

      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          screenStyles.dateButton,
          pressed && screenStyles.datePressed,
        ]}
      >
        <Text style={screenStyles.dateButtonIcon}>📅</Text>
        <View style={screenStyles.dateButtonCopy}>
          <Text style={screenStyles.dateButtonValue}>
            {formatIndiaDateTime(value)}
          </Text>
          <Text style={screenStyles.dateButtonHelper}>
            Tap to change date & time
          </Text>
        </View>
        <Text style={screenStyles.dateChevron}>›</Text>
      </Pressable>

      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={draftDate}
          mode={pickerMode}
          display="default"
          onChange={handleChange}
        />
      )}

      {Platform.OS === "ios" && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <SafeAreaView
            style={{ flex: 1 }}
            edges={["top", "right", "bottom", "left"]}
          >
            <View style={screenStyles.iosPickerOverlay}>
              <View style={screenStyles.iosPickerCard}>
                <View style={screenStyles.iosPickerHeader}>
                  <View>
                    <Text style={screenStyles.iosPickerTitle}>{label}</Text>
                    <Text style={screenStyles.iosPickerSubtitle}>
                      Select the actual date and time
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setShowPicker(false)}
                    style={screenStyles.iosCancelButton}
                  >
                    <Text style={screenStyles.iosCancelText}>Cancel</Text>
                  </Pressable>
                </View>

                <DateTimePicker
                  value={draftDate}
                  mode="datetime"
                  display="spinner"
                  onChange={handleChange}
                  style={screenStyles.iosPicker}
                />

                <Pressable
                  onPress={() => {
                    onChange(draftDate);
                    setShowPicker(false);
                  }}
                  style={screenStyles.iosConfirmButton}
                >
                  <Text style={screenStyles.iosConfirmText}>
                    Confirm Date & Time
                  </Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {!!helperText && (
        <Text style={screenStyles.dateHelper}>{helperText}</Text>
      )}
    </View>
  );
}

function CustomPopup({
  popup,
  onClose,
}: {
  popup: PopupState;
  onClose: () => void;
}) {
  if (!popup.visible) {
    return null;
  }

  const isSuccess = popup.type === "success";
  const isError = popup.type === "error";
  const isWarning = popup.type === "warning";

  const icon = isSuccess ? "✓" : isError ? "!" : isWarning ? "!" : "i";

  return (
    <Modal
      visible={popup.visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1 }}
        edges={["top", "right", "bottom", "left"]}
      >
        <View style={popupStyles.overlay}>
          <View style={popupStyles.card}>
            <View
              style={[
                popupStyles.iconCircle,
                isSuccess && popupStyles.successIcon,
                isError && popupStyles.errorIcon,
                isWarning && popupStyles.warningIcon,
                !isSuccess && !isError && !isWarning && popupStyles.infoIcon,
              ]}
            >
              <Text style={popupStyles.iconText}>{icon}</Text>
            </View>

            <Text style={popupStyles.title}>{popup.title}</Text>

            <Text style={popupStyles.message}>{popup.message}</Text>

            <View style={popupStyles.actions}>
              {!!popup.secondaryText && (
                <Pressable
                  onPress={() => {
                    if (popup.onSecondary) {
                      popup.onSecondary();
                    } else {
                      onClose();
                    }
                  }}
                  style={({ pressed }) => [
                    popupStyles.secondaryButton,
                    pressed && popupStyles.pressed,
                  ]}
                >
                  <Text style={popupStyles.secondaryButtonText}>
                    {popup.secondaryText}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  if (popup.onPrimary) {
                    popup.onPrimary();
                  } else {
                    onClose();
                  }
                }}
                style={({ pressed }) => [
                  popupStyles.primaryButton,
                  pressed && popupStyles.pressed,
                ]}
              >
                <Text style={popupStyles.primaryButtonText}>
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

export default function AdvisorSurveyFormScreen() {
  const params = useLocalSearchParams<{
    visitId?: string;
    vehicleId?: string;
  }>();

  const visitId =
    typeof params.visitId === "string" ? params.visitId : undefined;

  const vehicleId =
    typeof params.vehicleId === "string" ? params.vehicleId : undefined;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleIntake, setVehicleIntake] = useState<VehicleIntake | null>(
    null,
  );
  const [profile, setProfile] = useState<Profile | null>(null);

  const [paidAmount, setPaidAmount] = useState("");
  const [receiptReferenceNo, setReceiptReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const [readinessError, setReadinessError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [popup, setPopup] = useState<PopupState>(INITIAL_POPUP);

  const [surveyCompletedAt, setSurveyCompletedAt] = useState<Date>(
    () => new Date(),
  );
  const [approvalStatus, setApprovalStatus] = useState<"PENDING" | "RECEIVED">(
    "PENDING",
  );
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [selectedWorkTypeIds, setSelectedWorkTypeIds] = useState<string[]>([]);
  const [workTypesLoading, setWorkTypesLoading] = useState(true);
  const [workTypesError, setWorkTypesError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadWorkTypes() {
      setWorkTypesLoading(true);
      setWorkTypesError("");
      try {
        const { data, error } = await supabase
          .from("work_type_master")
          .select("id,code,name,is_active")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        const active = ((data || []) as WorkType[]).filter(
          (item) =>
            !["FINAL_INSPECTION", "FINAL_INSPECTION_REWORK"].includes(
              item.code,
            ),
        );
        if (!active.length)
          throw new Error(
            "No active Floor work types are available. Contact CEO Admin.",
          );
        if (!mounted) return;
        setWorkTypes(active);
        setSelectedWorkTypeIds((previous) =>
          Array.from(
            new Set([
              ...previous.filter((id) => active.some((item) => item.id === id)),
            ]),
          ),
        );
      } catch (error: any) {
        if (mounted)
          setWorkTypesError(
            error?.message || "Unable to load Approved Floor Work.",
          );
      } finally {
        if (mounted) setWorkTypesLoading(false);
      }
    }
    void loadWorkTypes();
    return () => {
      mounted = false;
    };
  }, [refreshVersion]);
  const [approvalReceivedAt, setApprovalReceivedAt] = useState<Date>(
    () => new Date(),
  );
  const [assessmentPhoto, setAssessmentPhoto] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const closePopup = () => {
    setPopup(INITIAL_POPUP);
  };

  const showPopup = (
    type: PopupType,
    title: string,
    message: string,
    options?: {
      primaryText?: string;
      secondaryText?: string;
      onPrimary?: () => void;
      onSecondary?: () => void;
    },
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
  };

  useEffect(() => {
    let mounted = true;

    async function loadScreen() {
      try {
        setLoading(true);
        setReadinessError("");

        if (!visitId || !vehicleId) {
          throw new Error(
            "Vehicle or visit information is missing. Please return to Pending Survey and open the vehicle again.",
          );
        }

        await checkWorkflowReadiness(visitId, vehicleId, "PENDING_SURVEY");

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

        const [
          { data: profileData, error: profileError },
          { data: vehicleData, error: vehicleError },
          { data: intakeData, error: intakeError },
          { data: visitData, error: visitError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id,role,is_active,name")
            .eq("id", user.id)
            .single(),

          supabase
            .from("vehicles")
            .select(
              "id,vehicle_no,current_stage,current_status,current_assigned_to,customer_name,customer_mobile,model,arena_nexa,vehicle_type,jc_no,stage_started_at",
            )
            .eq("id", vehicleId)
            .single(),

          supabase
            .from("vehicle_intake")
            .select("*")
            .eq("visit_id", visitId)
            .eq("vehicle_id", vehicleId)
            .maybeSingle(),

          supabase
            .from("workshop_visits")
            .select(
              "id,vehicle_id,current_stage,current_status,current_assigned_to,stage_started_at",
            )
            .eq("id", visitId)
            .eq("vehicle_id", vehicleId)
            .single(),
        ]);

        if (profileError) {
          throw profileError;
        }

        if (vehicleError) {
          throw vehicleError;
        }

        if (intakeError) {
          throw intakeError;
        }

        if (visitError) {
          throw visitError;
        }

        if (!profileData) {
          throw new Error("Your user profile could not be loaded.");
        }

        if (!profileData.is_active) {
          throw new Error(
            "Your account is inactive. Please contact the CEO Admin.",
          );
        }

        if (profileData.role !== "advisor") {
          throw new Error("Only the assigned Advisor can complete the survey.");
        }

        if (!vehicleData) {
          throw new Error("Vehicle not found.");
        }

        if (!visitData) {
          throw new Error("Workshop visit not found.");
        }

        if (vehicleData.current_assigned_to !== user.id) {
          throw new Error(
            "This vehicle is assigned to another Advisor. You cannot complete its survey.",
          );
        }

        if (visitData.current_assigned_to !== user.id) {
          throw new Error(
            "This survey is not assigned to your Advisor account.",
          );
        }

        if (visitData.current_stage !== "PENDING_SURVEY") {
          if (
            [
              "PENDING_APPROVAL",
              "APPROVAL_HOLD",
              "ADVISOR_WORK",
              "STORE",
              "FLOOR",
              "SUPPLEMENTARY_SURVEY",
              "SUPPLEMENTARY_APPROVAL",
              "FINAL_INSPECTION",
              "BILLING",
              "READY_FOR_DELIVERY",
              "PENDING_GATE_OUT",
              "GATE_OUT",
            ].includes(visitData.current_stage)
          ) {
            showPopup(
              "info",
              "Survey already completed",
              "This vehicle has already moved forward from Pending Survey. The survey cannot be submitted again.",
              {
                primaryText: "Back to Pending Survey",
                onPrimary: () => {
                  closePopup();
                  router.replace("/(tabs)/advisor/survey");
                },
              },
            );
          } else {
            throw new Error(
              `This vehicle is currently in ${visitData.current_stage}, not Pending Survey.`,
            );
          }

          return;
        }

        if (!["PENDING", "IN_PROGRESS"].includes(visitData.current_status)) {
          throw new Error(
            `This survey cannot be completed because the visit status is ${visitData.current_status}.`,
          );
        }

        if (!mounted) {
          return;
        }

        setProfile(profileData);
        // Intake stores contact details for this visit; the vehicle master may be empty or outdated.
        setVehicle({
          ...vehicleData,
          customer_name:
            contactValue(intakeData?.customer_name) ||
            contactValue(vehicleData.customer_name),
          customer_mobile:
            contactValue(intakeData?.customer_mobile) ||
            contactValue(vehicleData.customer_mobile),
        });
        setVehicleIntake(intakeData);
      } catch (error: any) {
        if (!mounted) {
          return;
        }
        setReadinessError(
          error?.message || "Unable to verify this vehicle. Please refresh.",
        );

        showPopup(
          "error",
          "Unable to open Survey",
          error?.message ||
            "The survey form could not be opened. Please try again.",
          {
            primaryText: "Back",
            onPrimary: () => {
              closePopup();
              router.replace("/(tabs)/advisor/survey");
            },
          },
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadScreen();

    return () => {
      mounted = false;
    };
  }, [visitId, vehicleId, refreshVersion]);

  const insuranceType = normalizeInsuranceType(vehicleIntake?.insurance_type);

  const isPaid = insuranceType === "PAID";
  const isInsurance = insuranceType === "INSURANCE";

  useEffect(() => {
    if (!isInsurance) return;
    const stripping = workTypes.find((item) => item.code === "STRIPPING");
    if (stripping)
      setSelectedWorkTypeIds((previous) =>
        previous.includes(stripping.id)
          ? previous
          : [...previous, stripping.id],
      );
  }, [isInsurance, workTypes]);

  const vehicleTitle = useMemo(
    () => [vehicle?.arena_nexa, vehicle?.model].filter(Boolean).join(" · "),
    [vehicle?.arena_nexa, vehicle?.model],
  );

  const pendingSince = useMemo(() => {
    if (!vehicle?.stage_started_at) {
      return "Pending time unavailable";
    }

    const started = new Date(vehicle.stage_started_at);

    if (Number.isNaN(started.getTime())) {
      return "Pending time unavailable";
    }

    return formatIndiaDateTime(started);
  }, [vehicle?.stage_started_at]);

  const validateForm = () => {
    if (approvalStatus === "RECEIVED") {
      if (workTypesLoading)
        return "Please wait for Approved Floor Work to load.";
      if (workTypesError) return workTypesError;
      const stripping = workTypes.find((item) => item.code === "STRIPPING");
      if (
        isInsurance &&
        (!stripping || !selectedWorkTypeIds.includes(stripping.id))
      ) {
        return "STRIPPING must be included in Approved Floor Work.";
      }
      if (!selectedWorkTypeIds.length)
        return "Select at least one approved Floor work type.";
      if (
        selectedWorkTypeIds.some(
          (id) => !workTypes.some((item) => item.id === id && item.is_active),
        )
      )
        return "Select valid active Approved Floor Work.";
    }
    if (!vehicle) {
      return "Vehicle information is not available.";
    }

    if (!visitId) {
      return "Workshop visit ID is missing.";
    }

    if (!vehicleId) {
      return "Vehicle ID is missing.";
    }

    if (!insuranceType) {
      return "The vehicle insurance type has not been configured in Vehicle Intake.";
    }

    if (!isPaid && !isInsurance) {
      return `Unsupported insurance type "${insuranceType}". Please check Vehicle Intake.`;
    }

    if (isPaid) {
      const cleanedAmount = paidAmount.trim();

      if (!cleanedAmount) {
        return "Enter the Paid Amount.";
      }

      const amount = Number(cleanedAmount);

      if (!Number.isFinite(amount)) {
        return "Paid Amount must be a valid number.";
      }

      if (amount < 0) {
        return "Paid Amount cannot be negative.";
      }

      if (!receiptReferenceNo.trim()) {
        return "Enter the Receipt / Reference No.";
      }
    }

    return null;
  };

  const pickAssessmentPhoto = async (source: "camera" | "gallery") => {
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showPopup(
            "warning",
            "Camera permission required",
            "Please allow camera access to capture the assessment sheet.",
          );
          return;
        }
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted && Platform.OS !== "web") {
          showPopup(
            "warning",
            "Photo permission required",
            "Please allow photo library access to select the assessment sheet.",
          );
          return;
        }
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.85,
              allowsEditing: false,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.85,
              allowsMultipleSelection: false,
              selectionLimit: 1,
            });

      if (result.canceled || result.assets.length === 0) return;

      setAssessmentPhoto(result.assets[0]);
    } catch (error: any) {
      showPopup(
        "error",
        "Photo selection failed",
        error?.message || "The assessment sheet photo could not be selected.",
      );
    }
  };

  const uploadAssessmentPhoto = async (
    photo: ImagePicker.ImagePickerAsset,
    currentVehicleId: string,
  ) => {
    const response = await fetch(photo.uri);

    if (!response.ok) {
      throw new Error("Could not read the selected assessment sheet photo.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const extensionFromName = photo.fileName?.split(".").pop();
    const extension =
      extensionFromName && /^[a-zA-Z0-9]+$/.test(extensionFromName)
        ? extensionFromName.toLowerCase()
        : "jpg";

    const fileName = `approval-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;

    const storagePath = `vehicles/${currentVehicleId}/APPROVAL_ASSESSMENT/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("vehicle-photos")
      .upload(storagePath, arrayBuffer, {
        contentType: photo.mimeType || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Assessment sheet upload failed: ${uploadError.message}`);
    }

    return storagePath;
  };

  const completeSurvey = async () => {
    if (submittingRef.current || loading || saving || readinessError) return;
    const validationError = validateForm();

    if (validationError) {
      showPopup("warning", "Required information", validationError);
      return;
    }

    if (!profile || profile.role !== "advisor") {
      showPopup(
        "error",
        "Permission denied",
        "Only the assigned active Advisor can complete this survey.",
      );
      return;
    }

    if (!visitId || !vehicle) {
      showPopup(
        "error",
        "Vehicle unavailable",
        "The workshop visit information is missing.",
      );
      return;
    }

    if (approvalStatus === "RECEIVED" && !assessmentPhoto) {
      showPopup(
        "warning",
        "Assessment Sheet Required",
        "Please upload the assessment sheet photo when Approval is marked as Received.",
      );
      return;
    }

    try {
      setSaving(true);
      submittingRef.current = true;
      try {
        await checkWorkflowReadiness(visitId, vehicle.id, "PENDING_SURVEY");
      } catch (error: any) {
        setReadinessError(
          error?.message || "Unable to verify this vehicle. Please refresh.",
        );
        throw error;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        throw new Error("Your session has expired. Please log in again.");
      }

      let assessmentSheetPath: string | null = null;

      if (approvalStatus === "RECEIVED" && assessmentPhoto) {
        assessmentSheetPath = await uploadAssessmentPhoto(
          assessmentPhoto,
          vehicle.id,
        );
      }

      const amount = isPaid ? Number(paidAmount.trim()) : null;

      const { data, error } = await supabase.rpc(
        "new_workflow_complete_survey",
        {
          p_visit_id: visitId,
          p_paid_amount: isPaid ? amount : null,
          p_receipt_reference_no: isPaid ? receiptReferenceNo.trim() : null,
          p_remarks: remarks.trim() || null,
          p_survey_completed_at: formatDateTimeForApi(surveyCompletedAt),
          p_approval_status: approvalStatus,
          p_approval_received_at:
            approvalStatus === "RECEIVED"
              ? formatDateTimeForApi(approvalReceivedAt)
              : null,
          p_assessment_sheet_photo_path: assessmentSheetPath,
          p_work_type_ids:
            approvalStatus === "RECEIVED" ? selectedWorkTypeIds : [],
        },
      );

      if (error) {
        if (assessmentSheetPath) {
          await supabase.storage
            .from("vehicle-photos")
            .remove([assessmentSheetPath]);
        }
        throw error;
      }

      const result = data as {
        survey_id?: string;
        survey_no?: number;
        stage?: string;
        status?: string;
      } | null;

      const surveyNumber = result?.survey_no
        ? `Survey #${result.survey_no}`
        : "Survey";

      if (approvalStatus === "RECEIVED") {
        showPopup(
          "success",
          "Survey & Approval completed",
          `${surveyNumber} has been completed. Approval, assessment sheet and Approved Floor Work scope were saved. The vehicle has moved to Advisor Work.`,
          {
            primaryText: "Go to Advisor Work",
            onPrimary: () => {
              closePopup();
              router.replace("/(tabs)/advisor" as any);
            },
          },
        );
      } else {
        showPopup(
          "success",
          "Survey completed",
          `${surveyNumber} has been completed successfully. The vehicle has been moved to Pending Approval.`,
          {
            primaryText: "Go to Approval",
            onPrimary: () => {
              closePopup();
              router.replace("/(tabs)/advisor" as any);
            },
          },
        );
      }
    } catch (error: any) {
      const message =
        error?.message ||
        error?.details ||
        error?.hint ||
        "The survey could not be completed. Please try again.";

      showPopup("error", "Survey could not be completed", message);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (saving) {
      return;
    }

    router.replace("/(tabs)/advisor/survey");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loadingContent}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>P</Text>
          </View>

          <ActivityIndicator color={colors.primary} size="large" />

          <Text style={styles.loadingTitle}>Preparing your survey</Text>

          <Text style={styles.loadingSubtitle}>
            Loading vehicle and survey details…
          </Text>
        </View>

        <CustomPopup popup={popup} onClose={closePopup} />
      </SafeAreaView>
    );
  }

  if (!vehicle || readinessError) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loadingContent}>
          <Text style={styles.heading}>Survey unavailable</Text>

          <Text style={styles.subheading}>
            {readinessError || "Vehicle information could not be loaded."}
          </Text>

          <Pressable
            onPress={() => {
              closePopup();
              setRefreshVersion((version) => version + 1);
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Refresh</Text>
          </Pressable>

          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Back to Pending Survey</Text>
          </Pressable>
        </View>

        <CustomPopup popup={popup} onClose={closePopup} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={screenStyles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* TOP BAR */}
          <View style={styles.topBar}>
            <Pressable
              onPress={handleBack}
              disabled={saving}
              style={({ pressed }) => [
                styles.backButton,
                saving && styles.disabled,
                pressed && !saving && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.backArrow}>‹</Text>
              <Text style={styles.back}>Back</Text>
            </Pressable>

            <Text style={styles.brandMark}>PAGARIYA</Text>
          </View>

          {/* HERO */}
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.workspacePill}>
                <View style={styles.onlineDot} />
                <Text style={styles.eyebrow}>ADVISOR WORKSPACE</Text>
              </View>

              <View style={styles.livePill}>
                <Text style={styles.livePillText}>● PENDING SURVEY</Text>
              </View>
            </View>

            <Text style={styles.heading}>Complete Vehicle Survey</Text>

            <Text style={styles.subheading}>
              Review the vehicle information, enter the survey result, and
              complete the survey for this visit.
            </Text>

            {/* VEHICLE HERO */}
            <View style={styles.vehicleHeroCard}>
              <View style={styles.vehicleIconBox}>
                <Text style={styles.vehicleIcon}>🚘</Text>
              </View>

              <View style={styles.vehicleHeroCopy}>
                <Text style={styles.regLabel}>VEHICLE REGISTRATION</Text>

                <Text style={styles.regNumber}>
                  {vehicle.vehicle_no || "—"}
                </Text>

                <Text style={styles.vehicleCustomer}>
                  {vehicle.customer_name || "Customer name not available"}
                </Text>

                {!!vehicleTitle && (
                  <Text style={styles.vehicleMeta}>{vehicleTitle}</Text>
                )}
              </View>

              <View style={styles.assignedBadge}>
                <Text style={styles.assignedBadgeText}>ASSIGNED</Text>
              </View>
            </View>
          </View>

          {/* CURRENT STATUS */}
          <View style={screenStyles.statusCard}>
            <View style={screenStyles.statusIcon}>
              <Text style={screenStyles.statusIconText}>!</Text>
            </View>

            <View style={screenStyles.statusCopy}>
              <Text style={screenStyles.statusTitle}>Pending Survey</Text>

              <Text style={screenStyles.statusText}>
                This vehicle is waiting for the assigned Advisor to complete the
                survey.
              </Text>

              <Text style={screenStyles.statusMeta}>
                Pending since: {pendingSince}
              </Text>
            </View>
          </View>

          {/* CUSTOMER DETAILS */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer Details</Text>
            <View style={screenStyles.infoGrid}>
              <View style={screenStyles.infoItem}>
                <Text style={screenStyles.infoLabel}>Customer name</Text>
                <Text selectable style={screenStyles.infoValue}>
                  {contactValue(vehicleIntake?.customer_name) ||
                    contactValue(vehicle?.customer_name) ||
                    "Not recorded"}
                </Text>
              </View>
              <View style={screenStyles.infoItem}>
                <Text style={screenStyles.infoLabel}>Mobile number</Text>
                <Text selectable style={screenStyles.infoValue}>
                  {contactValue(vehicleIntake?.customer_mobile) ||
                    contactValue(vehicle?.customer_mobile) ||
                    "Not recorded"}
                </Text>
              </View>
            </View>
          </View>

          {/* VEHICLE DETAILS */}
          <VehicleDetailsCard vehicle={vehicle} />

          {/* SURVEY SUMMARY */}
          <View style={styles.card}>
            <SectionHeading
              number="01"
              title="Survey Details"
              subtitle="Information already recorded during Vehicle Intake"
            />

            <View style={screenStyles.infoGrid}>
              <View style={screenStyles.infoItem}>
                <Text style={screenStyles.infoLabel}>Insurance / Job Type</Text>

                <View
                  style={[
                    screenStyles.typeBadge,
                    isPaid
                      ? screenStyles.paidBadge
                      : screenStyles.insuranceBadge,
                  ]}
                >
                  <Text
                    style={[
                      screenStyles.typeBadgeText,
                      isPaid
                        ? screenStyles.paidBadgeText
                        : screenStyles.insuranceBadgeText,
                    ]}
                  >
                    {isPaid ? "PAID" : "INSURANCE"}
                  </Text>
                </View>
              </View>

              <View style={screenStyles.infoItem}>
                <Text style={screenStyles.infoLabel}>Job Card No.</Text>

                <Text style={screenStyles.infoValue}>
                  {displayValue(vehicle.jc_no || vehicleIntake?.job_card_no)}
                </Text>
              </View>

              <View style={screenStyles.infoItem}>
                <Text style={screenStyles.infoLabel}>Vehicle Type</Text>

                <Text style={screenStyles.infoValue}>
                  {displayValue(
                    vehicle.vehicle_type || vehicleIntake?.vehicle_type,
                  )}
                </Text>
              </View>

              <View style={screenStyles.infoItem}>
                <Text style={screenStyles.infoLabel}>Arena / Nexa</Text>

                <Text style={screenStyles.infoValue}>
                  {displayValue(
                    vehicle.arena_nexa || vehicleIntake?.arena_nexa,
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* PAID DETAILS */}
          {isPaid && (
            <View style={styles.card}>
              <SectionHeading
                number="02"
                title="Paid Survey Details"
                subtitle="Record the payment collected for this vehicle"
              />

              <Text style={styles.label}>
                Paid Amount <Text style={styles.required}>*</Text>
              </Text>

              <View style={screenStyles.amountInputWrap}>
                <Text style={screenStyles.currencySymbol}>₹</Text>

                <TextInput
                  value={paidAmount}
                  onChangeText={(value) => {
                    const cleaned = value.replace(/[^0-9.]/g, "");

                    const parts = cleaned.split(".");

                    if (parts.length > 2) {
                      setPaidAmount(`${parts[0]}.${parts.slice(1).join("")}`);
                    } else {
                      setPaidAmount(cleaned);
                    }
                  }}
                  placeholder="Enter paid amount"
                  placeholderTextColor={colors.textLight}
                  style={[styles.input, screenStyles.amountInput]}
                  keyboardType={
                    Platform.OS === "ios" ? "decimal-pad" : "numeric"
                  }
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.label}>
                Receipt / Reference No. <Text style={styles.required}>*</Text>
              </Text>

              <TextInput
                value={receiptReferenceNo}
                onChangeText={setReceiptReferenceNo}
                placeholder="Enter receipt or reference number"
                placeholderTextColor={colors.textLight}
                style={styles.input}
                autoCapitalize="characters"
                returnKeyType="next"
              />

              <View style={screenStyles.requiredHint}>
                <Text style={screenStyles.requiredHintIcon}>i</Text>

                <Text style={screenStyles.requiredHintText}>
                  Both Paid Amount and Receipt / Reference No. are required for
                  a Paid vehicle.
                </Text>
              </View>
            </View>
          )}

          {/* INSURANCE DETAILS */}
          {isInsurance && (
            <View style={styles.card}>
              <SectionHeading
                number="02"
                title="Insurance Survey"
                subtitle="Complete the survey without recording payment"
              />

              <View style={screenStyles.insuranceInfoBox}>
                <View style={screenStyles.insuranceInfoIcon}>
                  <Text style={screenStyles.insuranceInfoIconText}>🛡</Text>
                </View>

                <View style={screenStyles.insuranceInfoCopy}>
                  <Text style={screenStyles.insuranceInfoTitle}>
                    Insurance vehicle
                  </Text>

                  <Text style={screenStyles.insuranceInfoText}>
                    Payment fields are not required at the Survey stage. Claim
                    and approval information will be handled through the
                    Insurance workflow.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* REMARKS */}
          <View style={styles.card}>
            <SectionHeading
              number="03"
              title="Advisor Remarks"
              subtitle="Add any relevant observations before completing the survey"
            />

            <Text style={styles.label}>
              Remarks <Text style={screenStyles.optionalText}>(optional)</Text>
            </Text>

            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter survey observations or advisor remarks"
              placeholderTextColor={colors.textLight}
              style={[styles.input, styles.multiline]}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
          </View>

          {/* SURVEY DATE & TIME */}
          <View style={styles.card}>
            <SectionHeading
              number="04"
              title="Survey Date & Time"
              subtitle="Enter the actual date and time when the survey was completed"
            />

            <DateTimeField
              label="Survey Completion Date & Time"
              value={surveyCompletedAt}
              onChange={setSurveyCompletedAt}
              helperText="This is the Advisor-entered action timestamp. The system also records the actual submission time automatically."
            />

            <View style={screenStyles.securityNote}>
              <Text style={screenStyles.securityNoteIcon}>🔒</Text>
              <Text style={screenStyles.securityNoteText}>
                The database verifies your active Advisor role, assignment and
                current Pending Survey stage before completing this action.
              </Text>
            </View>
          </View>

          {/* APPROVAL AT SURVEY */}
          <View style={styles.card}>
            <SectionHeading
              number="05"
              title="Approval"
              subtitle="Sometimes approval is received during the survey itself"
            />

            <Text style={styles.label}>
              Approval Status <Text style={styles.required}>*</Text>
            </Text>

            <View style={screenStyles.approvalOptions}>
              <Pressable
                onPress={() => setApprovalStatus("PENDING")}
                disabled={saving}
                style={[
                  screenStyles.approvalOption,
                  approvalStatus === "PENDING" &&
                    screenStyles.approvalOptionSelected,
                ]}
              >
                <View
                  style={[
                    screenStyles.radio,
                    approvalStatus === "PENDING" && screenStyles.radioSelected,
                  ]}
                >
                  {approvalStatus === "PENDING" && (
                    <View style={screenStyles.radioDot} />
                  )}
                </View>
                <View style={screenStyles.approvalOptionCopy}>
                  <Text style={screenStyles.approvalOptionTitle}>Pending</Text>
                  <Text style={screenStyles.approvalOptionText}>
                    Vehicle will move to Pending Approval after survey
                    completion.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setApprovalStatus("RECEIVED");
                  setApprovalReceivedAt(new Date());
                }}
                disabled={saving}
                style={[
                  screenStyles.approvalOption,
                  approvalStatus === "RECEIVED" &&
                    screenStyles.approvalOptionSelected,
                ]}
              >
                <View
                  style={[
                    screenStyles.radio,
                    approvalStatus === "RECEIVED" && screenStyles.radioSelected,
                  ]}
                >
                  {approvalStatus === "RECEIVED" && (
                    <View style={screenStyles.radioDot} />
                  )}
                </View>
                <View style={screenStyles.approvalOptionCopy}>
                  <Text style={screenStyles.approvalOptionTitle}>Received</Text>
                  <Text style={screenStyles.approvalOptionText}>
                    Vehicle will move to Advisor Work after the assessment sheet
                    and Approved Floor Work scope are saved.
                  </Text>
                </View>
              </Pressable>
            </View>

            {approvalStatus === "RECEIVED" && (
              <View style={screenStyles.receivedSection}>
                <Text style={styles.label}>
                  Approved Floor Work <Text style={styles.required}>*</Text>
                </Text>
                <Text style={screenStyles.approvalOptionText}>
                  {isPaid
                    ? "Select at least one approved work type for this Paid job. Select Stripping only when required."
                    : "Select the approved work for this vehicle. Stripping is required for Insurance jobs."}
                </Text>
                <View style={screenStyles.inspectionNotice}>
                  <Text style={screenStyles.approvalOptionTitle}>
                    Final Inspection · Mandatory
                  </Text>
                  <Text style={screenStyles.approvalOptionText}>
                    Every vehicle goes to Final Inspection after Floor work. It
                    is included automatically in the workflow.
                  </Text>
                </View>
                {!workTypesLoading && !workTypesError && (
                  <Text style={screenStyles.approvalOptionTitle}>
                    {selectedWorkTypeIds.length} work type
                    {selectedWorkTypeIds.length === 1 ? "" : "s"} selected
                  </Text>
                )}
                {workTypesLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : workTypesError ? (
                  <View>
                    <Text style={screenStyles.approvalOptionText}>
                      {workTypesError}
                    </Text>
                    <Pressable
                      disabled={saving}
                      onPress={() =>
                        setRefreshVersion((version) => version + 1)
                      }
                    >
                      <Text style={styles.label}>Retry loading work types</Text>
                    </Pressable>
                  </View>
                ) : (
                  workTypes.map((item) => {
                    const required = isInsurance && item.code === "STRIPPING";
                    const selected = selectedWorkTypeIds.includes(item.id);
                    return (
                      <Pressable
                        key={item.id}
                        disabled={saving || required}
                        accessibilityRole="checkbox"
                        accessibilityLabel={item.name}
                        accessibilityState={{
                          checked: selected,
                          disabled: saving || required,
                        }}
                        onPress={() =>
                          setSelectedWorkTypeIds((previous) =>
                            previous.includes(item.id)
                              ? previous.filter((id) => id !== item.id)
                              : [...previous, item.id],
                          )
                        }
                        style={[
                          screenStyles.approvalOption,
                          screenStyles.workTypeOption,
                          selected && screenStyles.approvalOptionSelected,
                        ]}
                      >
                        <View
                          style={[
                            screenStyles.workCheckbox,
                            selected && screenStyles.workCheckboxSelected,
                          ]}
                        >
                          <Text style={screenStyles.workCheckmark}>
                            {selected ? "✓" : ""}
                          </Text>
                        </View>
                        <View style={screenStyles.approvalOptionCopy}>
                          <Text style={screenStyles.approvalOptionTitle}>
                            {item.name}
                          </Text>
                          <Text style={screenStyles.approvalOptionText}>
                            {required
                              ? "Required for Insurance"
                              : selected
                                ? "Included in approved work"
                                : "Tap to include"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
                <DateTimeField
                  label="Approval Received Date & Time"
                  value={approvalReceivedAt}
                  onChange={setApprovalReceivedAt}
                  helperText="Enter the actual date and time when approval was received."
                />

                <Text style={styles.label}>
                  Assessment Sheet Photo <Text style={styles.required}>*</Text>
                </Text>

                {assessmentPhoto ? (
                  <View style={screenStyles.selectedPhotoBox}>
                    <View style={screenStyles.selectedPhotoIcon}>
                      <Text style={screenStyles.selectedPhotoIconText}>✓</Text>
                    </View>
                    <View style={screenStyles.selectedPhotoCopy}>
                      <Text style={screenStyles.selectedPhotoTitle}>
                        Assessment sheet selected
                      </Text>
                      <Text
                        style={screenStyles.selectedPhotoName}
                        numberOfLines={2}
                      >
                        {assessmentPhoto.fileName ||
                          "Selected assessment sheet"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setAssessmentPhoto(null)}
                      disabled={saving}
                      style={screenStyles.removePhotoButton}
                    >
                      <Text style={screenStyles.removePhotoText}>Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={screenStyles.photoRequiredBox}>
                    <Text style={screenStyles.photoRequiredIcon}>📄</Text>
                    <Text style={screenStyles.photoRequiredText}>
                      Assessment sheet photo is mandatory when approval is
                      received.
                    </Text>
                  </View>
                )}

                <View style={screenStyles.photoActions}>
                  <Pressable
                    onPress={() => pickAssessmentPhoto("camera")}
                    disabled={saving}
                    style={({ pressed }) => [
                      screenStyles.photoButton,
                      pressed && screenStyles.datePressed,
                    ]}
                  >
                    <Text style={screenStyles.photoButtonIcon}>📷</Text>
                    <Text style={screenStyles.photoButtonText}>Camera</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => pickAssessmentPhoto("gallery")}
                    disabled={saving}
                    style={({ pressed }) => [
                      screenStyles.photoButton,
                      pressed && screenStyles.datePressed,
                    ]}
                  >
                    <Text style={screenStyles.photoButtonIcon}>🖼</Text>
                    <Text style={screenStyles.photoButtonText}>Gallery</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* SUBMIT */}
          <View style={styles.submitCard}>
            <View style={styles.submitCardTop}>
              <View style={styles.submitIconWrap}>
                <Text style={styles.submitIcon}>✓</Text>
              </View>

              <View style={styles.submitCopy}>
                <Text style={styles.submitTitle}>Ready to complete?</Text>

                <Text style={styles.submitSubtitle}>
                  After completion, the vehicle will move to the next workflow
                  stage based on the Approval selection. This survey cannot be
                  submitted again.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={completeSurvey}
              disabled={saving}
              style={({ pressed }) => [
                styles.primaryButton,
                screenStyles.pagariyaPrimaryButton,
                saving && styles.disabled,
                pressed && !saving && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              {saving ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />

                  <Text style={styles.primaryButtonText}>Saving Survey…</Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Complete Survey</Text>

                  <Text style={styles.primaryButtonArrow}>→</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleBack}
              disabled={saving}
              style={({ pressed }) => [
                styles.secondaryButton,
                saving && styles.disabled,
                pressed && !saving && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Cancel & Go Back</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>PAGARIYA AUTO • ADVISOR WORKSPACE</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomPopup popup={popup} onClose={closePopup} />
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  pagariyaPrimaryButton: {
    backgroundColor: colors.primary,
  },

  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFF8E8",
    borderWidth: 1,
    borderColor: "#F3D79A",
  },

  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4B740",
    marginRight: 12,
  },

  statusIconText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },

  statusCopy: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7A5200",
    marginBottom: 4,
  },

  statusText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B5A35",
  },

  statusMeta: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: "700",
    color: "#8A691E",
  },

  infoGrid: {
    gap: 12,
  },

  infoItem: {
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8EDF3",
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A8492",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 5,
  },

  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C2430",
  },

  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
  },

  paidBadge: {
    backgroundColor: "#E9F8EF",
  },

  insuranceBadge: {
    backgroundColor: "#EEF4FF",
  },

  typeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  paidBadgeText: {
    color: "#18753D",
  },

  insuranceBadgeText: {
    color: "#2456A6",
  },

  workflowNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 15,
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#F2F7FF",
    borderWidth: 1,
    borderColor: "#D9E7FB",
  },

  workflowNoteIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2C6BED",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 13,
    fontWeight: "800",
    marginRight: 9,
  },

  workflowNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#526174",
  },

  amountInputWrap: {
    position: "relative",
    justifyContent: "center",
    marginBottom: 14,
  },

  currencySymbol: {
    position: "absolute",
    left: 15,
    zIndex: 2,
    fontSize: 17,
    fontWeight: "800",
    color: "#263242",
  },

  amountInput: {
    paddingLeft: 38,
    marginBottom: 0,
  },

  requiredHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
    padding: 11,
    borderRadius: 12,
    backgroundColor: "#F7F9FC",
  },

  requiredHintIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#64748B",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 20,
    fontSize: 12,
    fontWeight: "800",
    marginRight: 8,
  },

  requiredHintText: {
    flex: 1,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
  },

  insuranceInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#F2F7FF",
    borderWidth: 1,
    borderColor: "#D8E5FA",
  },

  insuranceInfoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2EDFF",
    marginRight: 12,
  },

  insuranceInfoIconText: {
    fontSize: 20,
  },

  insuranceInfoCopy: {
    flex: 1,
  },

  insuranceInfoTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#244E8F",
    marginBottom: 4,
  },

  insuranceInfoText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#526174",
  },

  optionalText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#8993A1",
  },

  systemTimeBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E4E9F0",
  },

  systemTimeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9EEF5",
    marginRight: 12,
  },

  systemTimeIconText: {
    fontSize: 20,
  },

  systemTimeCopy: {
    flex: 1,
  },

  systemTimeLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#788494",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  systemTimeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#202A36",
  },

  systemTimeHelper: {
    marginTop: 3,
    fontSize: 11,
    color: "#8A94A3",
  },

  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },

  securityNoteIcon: {
    fontSize: 15,
    marginRight: 8,
  },

  securityNoteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: "#667085",
  },

  dateFieldWrap: {
    marginBottom: 2,
  },

  dateButton: {
    minHeight: 66,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE4EC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  datePressed: {
    opacity: 0.78,
  },

  dateButtonIcon: {
    fontSize: 22,
    marginRight: 11,
  },

  dateButtonCopy: {
    flex: 1,
  },

  dateButtonValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#202A36",
  },

  dateButtonHelper: {
    marginTop: 3,
    fontSize: 11,
    color: "#8A94A3",
  },

  dateChevron: {
    fontSize: 28,
    color: "#7A8796",
    marginLeft: 8,
  },

  dateHelper: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: "#778393",
  },

  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E4E9F0",
  },

  dateDisplayIcon: {
    fontSize: 21,
    marginRight: 12,
  },

  dateDisplayCopy: {
    flex: 1,
  },

  dateDisplayLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#788494",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  dateDisplayValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#202A36",
  },

  dateDisplayHelper: {
    marginTop: 3,
    fontSize: 11,
    color: "#8A94A3",
  },

  iosPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "flex-end",
  },

  iosPickerCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
  },

  iosPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  iosPickerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#182230",
  },

  iosPickerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#7A8492",
  },

  iosCancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },

  iosCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },

  iosPicker: {
    alignSelf: "center",
  },

  iosConfirmButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#1F5EFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  iosConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  approvalOptions: {
    gap: 10,
  },

  inspectionNotice: {
    backgroundColor: "#EEF7F1",
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  workTypeOption: { alignItems: "center", minHeight: 64, marginBottom: 8 },
  workCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#A7B1BF",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  workCheckboxSelected: { backgroundColor: "#1F5EFF", borderColor: "#1F5EFF" },
  workCheckmark: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },

  approvalOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E1E7EF",
    backgroundColor: "#FFFFFF",
  },

  approvalOptionSelected: {
    borderColor: "#1F5EFF",
    backgroundColor: "#F3F7FF",
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#A7B1BF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    marginTop: 1,
  },

  radioSelected: {
    borderColor: "#1F5EFF",
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1F5EFF",
  },

  approvalOptionCopy: {
    flex: 1,
  },

  approvalOptionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#202A36",
    marginBottom: 4,
  },

  approvalOptionText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },

  receivedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E8EDF3",
  },

  photoRequiredBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#FFF8E8",
    borderWidth: 1,
    borderColor: "#F3D79A",
    marginBottom: 10,
  },

  photoRequiredIcon: {
    fontSize: 20,
    marginRight: 10,
  },

  photoRequiredText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#765C20",
  },

  selectedPhotoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#ECF9F1",
    borderWidth: 1,
    borderColor: "#C8E9D5",
    marginBottom: 10,
  },

  selectedPhotoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D8F2E2",
    marginRight: 10,
  },

  selectedPhotoIconText: {
    color: "#197044",
    fontWeight: "900",
  },

  selectedPhotoCopy: {
    flex: 1,
  },

  selectedPhotoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E6B40",
  },

  selectedPhotoName: {
    marginTop: 2,
    fontSize: 11,
    color: "#5C7667",
  },

  removePhotoButton: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },

  removePhotoText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#C24141",
  },

  photoActions: {
    flexDirection: "row",
    gap: 10,
  },

  photoButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#DDE4EC",
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  photoButtonIcon: {
    fontSize: 17,
    marginRight: 7,
  },

  photoButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#39475A",
  },
});

const popupStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  card: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.18,
    shadowRadius: 25,
    elevation: 12,
  },

  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: "#E9EEF5",
  },

  successIcon: {
    backgroundColor: "#DDF7E7",
  },

  errorIcon: {
    backgroundColor: "#FDE5E5",
  },

  warningIcon: {
    backgroundColor: "#FFF1D6",
  },

  infoIcon: {
    backgroundColor: "#E6F0FF",
  },

  iconText: {
    fontSize: 23,
    fontWeight: "900",
    color: "#334155",
  },

  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#182230",
    marginBottom: 8,
  },

  message: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5D6878",
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 22,
    gap: 10,
  },

  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: "#1F5EFF",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  secondaryButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: "#F1F4F8",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: "#465365",
    fontSize: 14,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.78,
  },
});
