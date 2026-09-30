import Ionicons from "@expo/vector-icons/Ionicons";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal, Platform, Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { supabase } from "../../../../lib/supabase";
import { colors, radius, spacing, typography } from "../../../theme";

const NativeDateTimePicker =
  Platform.OS === "web"
    ? null
    : require("@react-native-community/datetimepicker").default;

type VisitRow = {
  id: string;
  vehicle_id: string;
  visit_no: string | null;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  stage_started_at: string | null;
};

type VehicleRow = {
  id: string;
  vehicle_no: string;
};

type IntakeRow = {
  visit_id: string;
  vehicle_id: string;
  customer_name: string;
  customer_mobile: string;
  vehicle_type: string;
  vehicle_model_id: string;
  arena_nexa: string;
  insurance_type: string;
  mi_type_id: string | null;
  insurance_company_id: string | null;
  worker_group: string;
  job_card_no: string;
  advisor_remarks: string | null;
  completed_at: string;
};

type InsuranceCompanyRow = {
  id: string;
  name: string;
};

type MiTypeRow = {
  id: string;
  name: string;
};

type Profile = {
  id: string;
  name: string | null;
  role: string;
};

type PopupType = "error" | "success" | "info";

type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
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

function formatClaimDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${day}/${month}/${year} ${String(hour).padStart(2, "0")}:${minute} ${meridiem}`;
}

function getCurrentClaimDateTime(): Date {
  return new Date();
}

function parseClaimDateTime(value: string): string | null {
  const clean = value.trim().replace(/\s+/g, " ");

  const match = clean.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const meridiem = match[6]?.toUpperCase() || null;

  if (month < 1 || month > 12 || day < 1 || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }

    if (meridiem === "AM" && hour === 12) {
      hour = 0;
    } else if (meridiem === "PM" && hour !== 12) {
      hour += 12;
    }
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  // Claim Date & Time is entered in India Standard Time (IST, UTC+05:30).
  const utcMillis = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute
  ) - 330 * 60 * 1000;

  const date = new Date(utcMillis);

  const calendarCheck = new Date(year, month - 1, day, hour, minute);

  if (
    calendarCheck.getFullYear() !== year ||
    calendarCheck.getMonth() !== month - 1 ||
    calendarCheck.getDate() !== day ||
    calendarCheck.getHours() !== hour ||
    calendarCheck.getMinutes() !== minute
  ) {
    return null;
  }

  return date.toISOString();
}

function getWaitingTime(value: string | null) {
  if (!value) return "—";

  const start = new Date(value).getTime();

  if (Number.isNaN(start)) {
    return "—";
  }

  const diff = Math.max(0, Date.now() - start);
  const totalMinutes = Math.floor(
    diff / (1000 * 60)
  );

  if (totalMinutes < 1) {
    return "Just now";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours < 24) {
    return minutes > 0
      ? `${hours}h ${minutes}m`
      : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours > 0
    ? `${days}d ${remainingHours}h`
    : `${days}d`;
}

export default function ClaimIntimationFormScreen() {
  const router = useRouter();

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

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [visit, setVisit] =
    useState<VisitRow | null>(null);

  const [vehicle, setVehicle] =
    useState<VehicleRow | null>(null);

  const [intake, setIntake] =
    useState<IntakeRow | null>(null);

  const [insuranceCompany, setInsuranceCompany] =
    useState<InsuranceCompanyRow | null>(null);

  const [miType, setMiType] =
    useState<MiTypeRow | null>(null);

  const [estimateId, setEstimateId] =
    useState("");

  const [claimNo, setClaimNo] =
    useState("");

  const [claimIntimatedAt, setClaimIntimatedAt] =
    useState("");

  const [claimDateValue, setClaimDateValue] =
    useState<Date>(() => getCurrentClaimDateTime());

  const [showClaimDatePicker, setShowClaimDatePicker] =
    useState(false);

  const [showClaimTimePicker, setShowClaimTimePicker] =
    useState(false);

  const [remarks, setRemarks] =
    useState("");

  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const showPopup = (
    type: PopupType,
    title: string,
    message: string
  ) => {
    setPopup({
      visible: true,
      type,
      title,
      message,
    });
  };

  const closePopup = () => {
    setPopup((current) => ({
      ...current,
      visible: false,
    }));
  };

  useEffect(() => {
    const now = getCurrentClaimDateTime();
    setClaimDateValue(now);
    setClaimIntimatedAt(formatClaimDateTime(now));
  }, []);

  const openClaimDatePicker = () => {
    if (saving || Platform.OS === "web") return;
    setShowClaimDatePicker(true);
  };

  const handleClaimDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowClaimDatePicker(false);

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setClaimDateValue(selectedDate);
    setClaimIntimatedAt(formatClaimDateTime(selectedDate));

    if (Platform.OS === "android") {
      setTimeout(() => setShowClaimTimePicker(true), 150);
    }
  };

  const handleClaimTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date
  ) => {
    setShowClaimTimePicker(false);

    if (event.type === "dismissed" || !selectedTime) {
      return;
    }

    const combined = new Date(claimDateValue);
    combined.setHours(
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
      0
    );

    setClaimDateValue(combined);
    setClaimIntimatedAt(formatClaimDateTime(combined));
  };

  const loadData = useCallback(async () => {
    if (!visitId || !vehicleId) {
      throw new Error(
        "Claim Intimation vehicle information is missing."
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error("You are not logged in.");
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .eq("is_active", true)
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profileData) {
      throw new Error(
        "Active user profile not found."
      );
    }

    const currentProfile =
      profileData as Profile;

    if (
      currentProfile.role !== "advisor" &&
      currentProfile.role !== "ceo_admin"
    ) {
      throw new Error(
        "Only Advisor or CEO Admin can perform Claim Intimation."
      );
    }

    setProfile(currentProfile);

    const [
      visitResult,
      vehicleResult,
      intakeResult,
    ] = await Promise.all([
      supabase
        .from("workshop_visits")
        .select(
          `
            id,
            vehicle_id,
            visit_no,
            current_stage,
            current_status,
            current_assigned_to,
            stage_started_at
          `
        )
        .eq("id", visitId)
        .maybeSingle(),

      supabase
        .from("vehicles")
        .select("id, vehicle_no")
        .eq("id", vehicleId)
        .maybeSingle(),

      supabase
        .from("vehicle_intake")
        .select(
          `
            visit_id,
            vehicle_id,
            customer_name,
            customer_mobile,
            vehicle_type,
            vehicle_model_id,
            arena_nexa,
            insurance_type,
            mi_type_id,
            insurance_company_id,
            worker_group,
            job_card_no,
            advisor_remarks,
            completed_at
          `
        )
        .eq("visit_id", visitId)
        .maybeSingle(),
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

    if (!visitResult.data) {
      throw new Error(
        "Workshop visit not found."
      );
    }

    if (!vehicleResult.data) {
      throw new Error("Vehicle not found.");
    }

    if (!intakeResult.data) {
      throw new Error(
        "Vehicle Intake information not found."
      );
    }

    const visitData =
      visitResult.data as VisitRow;

    const vehicleData =
      vehicleResult.data as VehicleRow;

    const intakeData =
      intakeResult.data as IntakeRow;

    if (
      visitData.current_stage !==
      "CLAIM_INTIMATION"
    ) {
      throw new Error(
        `This vehicle is no longer pending Claim Intimation. Current stage: ${visitData.current_stage}.`
      );
    }

    if (
      visitData.current_status !== "PENDING" &&
      visitData.current_status !== "IN_PROGRESS"
    ) {
      throw new Error(
        `Vehicle cannot be processed in its current status: ${visitData.current_status}.`
      );
    }

    if (
      currentProfile.role === "advisor" &&
      visitData.current_assigned_to !==
        currentProfile.id
    ) {
      throw new Error(
        "This vehicle is assigned to another Advisor."
      );
    }

    setVisit(visitData);
    setVehicle(vehicleData);
    setIntake(intakeData);

    if (intakeData.insurance_company_id) {
      const {
        data: insuranceData,
        error: insuranceError,
      } = await supabase
        .from("insurance_companies")
        .select("id, name")
        .eq(
          "id",
          intakeData.insurance_company_id
        )
        .maybeSingle();

      if (insuranceError) {
        throw insuranceError;
      }

      setInsuranceCompany(
        insuranceData
          ? (insuranceData as InsuranceCompanyRow)
          : null
      );
    } else {
      setInsuranceCompany(null);
    }

    if (intakeData.mi_type_id) {
      const {
        data: miData,
        error: miError,
      } = await supabase
        .from("mi_types")
        .select("id, name")
        .eq("id", intakeData.mi_type_id)
        .maybeSingle();

      if (miError) {
        throw miError;
      }

      setMiType(
        miData
          ? (miData as MiTypeRow)
          : null
      );
    } else {
      setMiType(null);
    }
  }, [vehicleId, visitId]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (error: any) {
        console.error(
          "Claim Intimation form load error:",
          error
        );

        if (active) {
          showPopup(
            "error",
            "Unable to Load",
            error?.message ||
              "Something went wrong while loading Claim Intimation."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [loadData]);

  const handleSave = async () => {
    const cleanEstimateId =
      estimateId.trim();

    const cleanClaimNo =
      claimNo.trim();

    const cleanClaimIntimatedAt =
      claimIntimatedAt.trim();

    const cleanRemarks =
      remarks.trim();

    if (!cleanEstimateId) {
      showPopup(
        "error",
        "Estimate ID Required",
        "Please enter the Estimate ID before completing Claim Intimation."
      );
      return;
    }

    if (!cleanClaimNo) {
      showPopup(
        "error",
        "Claim Number Required",
        "Please enter the Claim Number before completing Claim Intimation."
      );
      return;
    }

    if (!cleanClaimIntimatedAt) {
      showPopup(
        "error",
        "Claim Date & Time Required",
        "Please enter the date and time when the claim number was generated/intimated."
      );
      return;
    }

    const parsedClaimIntimatedAt =
      parseClaimDateTime(cleanClaimIntimatedAt);

    if (!parsedClaimIntimatedAt) {
      showPopup(
        "error",
        "Invalid Claim Date & Time",
        "Please enter the Claim Date & Time in DD/MM/YYYY HH:MM AM/PM format. Example: 30/09/2026 10:35 AM"
      );
      return;
    }

    if (!visit) {
      showPopup(
        "error",
        "Vehicle Not Loaded",
        "The workshop visit information is not available."
      );
      return;
    }

    try {
      setSaving(true);

      const { data, error } =
        await supabase.rpc(
          "new_workflow_claim_intimation",
          {
            p_visit_id: visit.id,
            p_estimate_id: cleanEstimateId,
            p_claim_no: cleanClaimNo,
            p_claim_intimated_at: parsedClaimIntimatedAt,
            p_remarks:
              cleanRemarks || null,
          }
        );

      if (error) {
        throw error;
      }

      console.log(
        "Claim Intimation saved:",
        data
      );

      showPopup(
        "success",
        "Claim Intimation Completed",
        `Claim Intimation has been completed for ${vehicle?.vehicle_no || "this vehicle"}.\n\nThe vehicle has moved to Pending Survey.`
      );
    } catch (error: any) {
      console.error(
        "Claim Intimation save error:",
        error
      );

      let message =
        error?.message ||
        "Unable to complete Claim Intimation.";

      if (
        message.includes(
          "already been recorded"
        )
      ) {
        message =
          "Claim Intimation has already been recorded for this vehicle.";
      }

      showPopup(
        "error",
        "Unable to Save",
        message
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePopupClose = () => {
    const shouldGoBack =
      popup.type === "success";

    closePopup();

    if (shouldGoBack) {
      router.replace(
        "/(tabs)/advisor/claim-intimation"
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading vehicle details...
          </Text>
        </View>

        <PopupModal
          popup={popup}
          onClose={handlePopupClose}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons
                name="arrow-back"
                size={23}
                color={colors.text}
              />
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>
                Claim Intimation
              </Text>

              <Text style={styles.headerSubtitle}>
                Enter claim details
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={
              styles.scrollContent
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleTopRow}>
                <View style={styles.vehicleIcon}>
                  <Ionicons
                    name="car-sport-outline"
                    size={25}
                    color={colors.primary}
                  />
                </View>

                <View
                  style={styles.vehicleMain}
                >
                  <Text
                    style={styles.vehicleNumber}
                  >
                    {vehicle?.vehicle_no ||
                      "—"}
                  </Text>

                  <Text
                    style={styles.customerName}
                    numberOfLines={1}
                  >
                    {intake?.customer_name ||
                      "—"}
                  </Text>
                </View>

                <View
                  style={styles.pendingBadge}
                >
                  <View
                    style={styles.pendingDot}
                  />

                  <Text
                    style={styles.pendingText}
                  >
                    Pending
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailGrid}>
                <DetailItem
                  label="Customer Mobile"
                  value={
                    intake?.customer_mobile ||
                    "—"
                  }
                />

                <DetailItem
                  label="Vehicle Type"
                  value={
                    intake?.vehicle_type ||
                    "—"
                  }
                />

                <DetailItem
                  label="Arena / Nexa"
                  value={
                    intake?.arena_nexa ||
                    "—"
                  }
                />

                <DetailItem
                  label="Job Card"
                  value={
                    intake?.job_card_no ||
                    "—"
                  }
                />

                <DetailItem
                  label="Insurance"
                  value={
                    insuranceCompany?.name ||
                    "—"
                  }
                />

                <DetailItem
                  label="MI / NON-MI"
                  value={
                    miType?.name ||
                    "—"
                  }
                />
              </View>
            </View>

            <View style={styles.stageCard}>
              <View style={styles.stageIcon}>
                <Ionicons
                  name="time-outline"
                  size={21}
                  color={colors.warning}
                />
              </View>

              <View
                style={styles.stageContent}
              >
                <Text
                  style={styles.stageTitle}
                >
                  Claim Intimation Pending
                </Text>

                <Text
                  style={styles.stageSubtitle}
                >
                  Waiting{" "}
                  {getWaitingTime(
                    visit?.stage_started_at ||
                      null
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Claim Details
              </Text>

              <Text style={styles.sectionSubtitle}>
                Enter the insurance claim information to move this vehicle to Pending Survey.
              </Text>

              <FormField
                label="Estimate ID"
                required
                value={estimateId}
                onChangeText={setEstimateId}
                placeholder="Enter Estimate ID"
                icon="document-text-outline"
                editable={!saving}
              />

              <FormField
                label="Claim Number"
                required
                value={claimNo}
                onChangeText={setClaimNo}
                placeholder="Enter Claim Number"
                icon="shield-checkmark-outline"
                editable={!saving}
                autoCapitalize="characters"
              />

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  Claim Date & Time
                  <Text style={styles.required}> *</Text>
                </Text>

                <Pressable
                  style={[
                    styles.inputContainer,
                    saving && styles.inputContainerDisabled,
                  ]}
                  onPress={openClaimDatePicker}
                  disabled={saving || Platform.OS === "web"}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={
                      saving || Platform.OS === "web"
                        ? colors.textLight
                        : colors.textSecondary
                    }
                  />

                  <Text
                    style={[
                      styles.input,
                      styles.dateTimeValue,
                    ]}
                  >
                    {claimIntimatedAt || "Loading current date & time..."}
                  </Text>

                  {Platform.OS !== "web" && (
                    <Ionicons
                      name="chevron-down-outline"
                      size={18}
                      color={colors.textSecondary}
                    />
                  )}
                </Pressable>

                <Text style={styles.dateTimeHint}>
                  {Platform.OS === "web"
                    ? "Current date & time is added automatically on web."
                    : "Tap to select the actual date and time when the claim number was generated/intimated."}
                </Text>
              </View>

              {showClaimDatePicker && Platform.OS !== "web" && (
                <NativeDateTimePicker
                  value={claimDateValue}
                  mode={Platform.OS === "ios" ? "datetime" : "date"}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleClaimDateChange}
                />
              )}

              {showClaimTimePicker && Platform.OS === "android" && (
                <NativeDateTimePicker
                  value={claimDateValue}
                  mode="time"
                  display="default"
                  onChange={handleClaimTimeChange}
                />
              )}

              <FormField
                label="Remarks"
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Enter remarks if required"
                icon="chatbox-ellipses-outline"
                editable={!saving}
                multiline
              />
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={21}
                  color={colors.info}
                />
              </View>

              <View
                style={styles.infoContent}
              >
                <Text style={styles.infoTitle}>
                  After completion
                </Text>

                <Text
                  style={styles.infoText}
                >
                  The Claim Intimation stage will be completed and the vehicle will automatically move to Pending Survey.
                </Text>
              </View>
            </View>

            <View style={styles.actionArea}>
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  saving &&
                    styles.saveButtonDisabled,
                  pressed &&
                    !saving &&
                    styles.saveButtonPressed,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={colors.white}
                    />

                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      Saving...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={21}
                      color={colors.white}
                    />

                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      Complete Claim Intimation
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelButton}
                onPress={() => router.back()}
                disabled={saving}
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <PopupModal
        popup={popup}
        onClose={handlePopupClose}
      />
    </SafeAreaView>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <Text
        style={styles.detailValue}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function FormField({
  label,
  required,
  value,
  onChangeText,
  placeholder,
  icon,
  editable = true,
  multiline = false,
  autoCapitalize = "sentences",
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  editable?: boolean;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && (
          <Text style={styles.required}>
            {" "}
            *
          </Text>
        )}
      </Text>

      <View
        style={[
          styles.inputContainer,
          multiline &&
            styles.multilineInputContainer,
          !editable &&
            styles.inputContainerDisabled,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={
            editable
              ? colors.textSecondary
              : colors.textLight
          }
          style={
            multiline
              ? styles.multilineIcon
              : undefined
          }
        />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={
            colors.textLight
          }
          editable={editable}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={[
            styles.input,
            multiline && styles.multilineInput,
          ]}
        />
      </View>
    </View>
  );
}

function PopupModal({
  popup,
  onClose,
}: {
  popup: PopupState;
  onClose: () => void;
}) {
  const isSuccess =
    popup.type === "success";

  const isError =
    popup.type === "error";

  return (
    <Modal
      transparent
      visible={popup.visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.popupCard}>
          <View
            style={[
              styles.popupIcon,
              isSuccess &&
                styles.popupIconSuccess,
              isError &&
                styles.popupIconError,
              !isSuccess &&
                !isError &&
                styles.popupIconInfo,
            ]}
          >
            <Ionicons
              name={
                isSuccess
                  ? "checkmark-circle"
                  : isError
                    ? "alert-circle"
                    : "information-circle"
              }
              size={30}
              color={
                isSuccess
                  ? colors.success
                  : isError
                    ? colors.danger
                    : colors.info
              }
            />
          </View>

          <Text style={styles.popupTitle}>
            {popup.title}
          </Text>

          <Text style={styles.popupMessage}>
            {popup.message}
          </Text>

          <Pressable
            style={[
              styles.popupButton,
              isSuccess &&
                styles.popupButtonSuccess,
            ]}
            onPress={onClose}
          >
            <Text
              style={styles.popupButtonText}
            >
              {isSuccess ? "Continue" : "OK"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  flex: {
    flex: 1,
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
    color: colors.textSecondary,
    fontSize: typography.body.fontSize,
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.round,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },

  headerTitle: {
    ...typography.heading,
    color: colors.text,
  },

  headerSubtitle: {
    marginTop: 2,
    ...typography.caption,
    color: colors.textSecondary,
  },

  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },

  vehicleCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  vehicleTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  vehicleMain: {
    flex: 1,
    marginLeft: spacing.md,
  },

  vehicleNumber: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },

  customerName: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 14,
  },

  pendingBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.round,
    backgroundColor: colors.warningLight,
    flexDirection: "row",
    alignItems: "center",
  },

  pendingDot: {
    width: 7,
    height: 7,
    borderRadius: radius.round,
    backgroundColor: colors.warning,
  },

  pendingText: {
    marginLeft: 5,
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },

  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },

  detailItem: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: spacing.md,
  },

  detailLabel: {
    color: colors.textLight,
    fontSize: 12,
    marginBottom: 4,
  },

  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  stageCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.warningLight,
    flexDirection: "row",
    alignItems: "center",
  },

  stageIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  stageContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  stageTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  stageSubtitle: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
  },

  section: {
    marginTop: spacing.xl,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },

  sectionSubtitle: {
    marginTop: 5,
    marginBottom: spacing.lg,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },

  fieldContainer: {
    marginBottom: spacing.lg,
  },

  fieldLabel: {
    marginBottom: spacing.sm,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  required: {
    color: colors.primary,
  },

  inputContainer: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },

  inputContainerDisabled: {
    backgroundColor: colors.background,
  },

  input: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 15,
  },

  multilineInputContainer: {
    minHeight: 120,
    alignItems: "flex-start",
    paddingTop: spacing.md,
  },

  multilineIcon: {
    marginTop: 2,
  },

  multilineInput: {
    minHeight: 95,
    paddingTop: 0,
    textAlignVertical: "top",
  },

  dateTimeValue: {
    justifyContent: "center",
    paddingVertical: 0,
  },

  dateTimeHint: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  infoCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.infoLight,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  infoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },

  infoText: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },

  actionArea: {
    marginTop: spacing.xl,
  },

  saveButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },

  saveButtonPressed: {
    backgroundColor: colors.primaryDark,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    marginLeft: spacing.sm,
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },

  cancelButton: {
    minHeight: 48,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },

  popupCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: "center",
  },

  popupIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },

  popupIconSuccess: {
    backgroundColor: colors.successLight,
  },

  popupIconError: {
    backgroundColor: colors.dangerLight,
  },

  popupIconInfo: {
    backgroundColor: colors.infoLight,
  },

  popupTitle: {
    marginTop: spacing.md,
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },

  popupMessage: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  popupButton: {
    width: "100%",
    marginTop: spacing.xl,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  popupButtonSuccess: {
    backgroundColor: colors.success,
  },

  popupButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
});