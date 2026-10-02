import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { colors, radius, spacing } from "../../../theme";

type WorkPath =
  | "ONLY_PARTS"
  | "DENTING_PAINTING_PARTS"
  | "ONLY_DENTING_PAINTING";

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

type WorkOption = {
  value: WorkPath;
  title: string;
  description: string;
  tags: string[];
  requisitionRequired: boolean;
  nextStage: string;
};

const WORK_OPTIONS: WorkOption[] = [
  {
    value: "ONLY_PARTS",
    title: "ONLY PARTS",
    description: "Parts work only",
    tags: ["Parts"],
    requisitionRequired: true,
    nextStage: "STORE",
  },
  {
    value: "DENTING_PAINTING_PARTS",
    title: "DENTING + PAINTING + PARTS",
    description: "Body work with parts",
    tags: ["Denting", "Painting", "Parts"],
    requisitionRequired: true,
    nextStage: "STORE + FLOOR",
  },
  {
    value: "ONLY_DENTING_PAINTING",
    title: "ONLY DENTING + PAINTING",
    description: "Body work without parts",
    tags: ["Denting", "Painting"],
    requisitionRequired: false,
    nextStage: "FLOOR",
  },
];

export default function AdvisorWorkFormScreen() {
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

  const [vehicle, setVehicle] = useState<VehicleData | null>(null);

  const [selectedWork, setSelectedWork] = useState<WorkPath | null>(null);

  const [requisitionNo, setRequisitionNo] = useState("");
  const [requisitionAt, setRequisitionAt] = useState(new Date());
  const [remarks, setRemarks] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [confirmationVisible, setConfirmationVisible] = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupType, setPopupType] = useState<PopupType>("info");
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");

  const selectedWorkDetails = useMemo(() => {
    return WORK_OPTIONS.find((item) => item.value === selectedWork);
  }, [selectedWork]);

  const needsParts = selectedWorkDetails?.requisitionRequired ?? false;

  useEffect(() => {
    loadVehicle();
  }, [visitId, vehicleId]);

  const showPopup = (type: PopupType, title: string, message: string) => {
    setPopupType(type);
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupVisible(true);
  };

  const loadVehicle = async () => {
    if (!visitId || !vehicleId) {
      setLoading(false);

      showPopup(
        "error",
        "Missing Information",
        "Vehicle or visit information is missing. Please return to the Advisor Work list and try again.",
      );

      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
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
        .eq("id", vehicleId)
        .single();

      if (error) {
        throw error;
      }

      setVehicle({
        id: data.id,
        vehicle_no: data.vehicle_no ?? null,
        customer_name: data.customer_name ?? null,
        customer_mobile: data.customer_mobile ?? null,
        model: data.model ?? null,
        arena_nexa: data.arena_nexa ?? null,
        vehicle_type: data.vehicle_type ?? null,
        current_stage: data.current_stage ?? null,
        current_status: data.current_status ?? null,
        job_card_no: data.jc_no ?? null,
      });
    } catch (error: any) {
      console.error("Advisor Work vehicle load error:", error);

      showPopup(
        "error",
        "Unable to Load Vehicle",
        error?.message ||
          "The vehicle details could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

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
    if (!selectedWork) {
      showPopup(
        "warning",
        "Select Work",
        "Please select the required work before continuing.",
      );

      return false;
    }

    if (needsParts && !requisitionNo.trim()) {
      showPopup(
        "warning",
        "Requisition Number Required",
        "Please enter the advisor requisition number.",
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
    if (!visitId || !selectedWork) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const cleanRequisitionNo = requisitionNo.trim();
      const cleanRemarks = remarks.trim();

      const { error } = await supabase.rpc(
        "new_workflow_process_advisor_work",
        {
          p_visit_id: visitId,
          p_work_path: selectedWork,
          p_requisition_no: needsParts ? cleanRequisitionNo : null,
          p_requisition_at: needsParts ? requisitionAt.toISOString() : null,
          p_remarks: cleanRemarks || null,
        },
      );

      if (error) {
        throw error;
      }

      setConfirmationVisible(false);

      showPopup(
        "success",
        "Work Requirement Saved",
        `The work requirement has been saved successfully.\n\nNext Stage: ${selectedWorkDetails?.nextStage || "—"}`,
      );
    } catch (error: any) {
      console.error("Advisor Work save error:", error);

      setConfirmationVisible(false);

      showPopup(
        "error",
        "Unable to Save",
        error?.message ||
          "The work requirement could not be saved. Please try again.",
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

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (!selectedDate) {
      return;
    }

    const updated = new Date(requisitionAt);

    updated.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    );

    if (isFutureDateTime(updated)) {
      showPopup(
        "warning",
        "Future Date Not Allowed",
        "Requisition date and time cannot be in the future.",
      );

      return;
    }

    setRequisitionAt(updated);
  };

  const handleTimeChange = (_event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (!selectedTime) {
      return;
    }

    const updated = new Date(requisitionAt);

    updated.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

    if (isFutureDateTime(updated)) {
      showPopup(
        "warning",
        "Future Time Not Allowed",
        "Requisition date and time cannot be in the future.",
      );

      return;
    }

    setRequisitionAt(updated);
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
        {/* TOP BACK ROW */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Text style={styles.backArrow}>‹</Text>

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.brandText}>PAGARIYA</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* RED HERO CARD */}
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>ADVISOR WORKSPACE</Text>

            <Text style={styles.heroTitle}>Select Work Requirements</Text>

            <Text style={styles.heroDescription}>
              Select the work required for this vehicle.
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
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <View>
                <Text style={styles.cardTitle}>Vehicle Overview</Text>

                <Text style={styles.cardSubtitle}>Vehicle details</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Customer</Text>

                <Text style={styles.infoValue} numberOfLines={2}>
                  {vehicle?.customer_name || "—"}
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Mobile</Text>

                <Text style={styles.infoValue} numberOfLines={1}>
                  {vehicle?.customer_mobile || "—"}
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Model</Text>

                <Text style={styles.infoValue} numberOfLines={2}>
                  {vehicle?.model || "—"}
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Arena / Nexa</Text>

                <Text style={styles.infoValue} numberOfLines={1}>
                  {vehicle?.arena_nexa || "—"}
                </Text>
              </View>

              <View style={styles.infoBoxFull}>
                <Text style={styles.infoLabel}>Job Card</Text>

                <Text style={styles.infoValue} numberOfLines={1}>
                  {vehicle?.job_card_no || "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* WORK REQUIREMENTS */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderWithStep}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>1</Text>
              </View>

              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Work Requirements</Text>

                <Text style={styles.cardSubtitle}>Select one work path</Text>
              </View>
            </View>

            <View style={styles.workOptions}>
              {WORK_OPTIONS.map((option) => {
                const selected = selectedWork === option.value;

                return (
                  <Pressable
                    key={option.value}
                    disabled={saving}
                    onPress={() => setSelectedWork(option.value)}
                    style={[
                      styles.workOption,
                      selected && styles.workOptionSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        selected && styles.radioOuterSelected,
                      ]}
                    >
                      {selected && <View style={styles.radioInner} />}
                    </View>

                    <View style={styles.workOptionContent}>
                      <Text
                        style={[
                          styles.workOptionTitle,
                          selected && styles.workOptionTitleSelected,
                        ]}
                      >
                        {option.title}
                      </Text>

                      <Text style={styles.workOptionDescription}>
                        {option.description}
                      </Text>

                      <View style={styles.tagsRow}>
                        {option.tags.map((tag) => (
                          <View
                            key={tag}
                            style={[styles.tag, selected && styles.tagSelected]}
                          >
                            <Text
                              style={[
                                styles.tagText,
                                selected && styles.tagTextSelected,
                              ]}
                            >
                              {tag}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* WORKFLOW DETAILS */}
                      <View
                        style={[
                          styles.workflowDetails,
                          selected && styles.workflowDetailsSelected,
                        ]}
                      >
                        <View style={styles.workflowDetailItem}>
                          <Text style={styles.workflowDetailLabel}>
                            Requisition
                          </Text>

                          <Text
                            style={[
                              styles.workflowDetailValue,
                              option.requisitionRequired &&
                                styles.workflowDetailRequired,
                            ]}
                          >
                            {option.requisitionRequired
                              ? "Required"
                              : "Not required"}
                          </Text>
                        </View>

                        <View style={styles.workflowDetailDivider} />

                        <View style={styles.workflowDetailItem}>
                          <Text style={styles.workflowDetailLabel}>
                            Next Stage
                          </Text>

                          <Text
                            style={[
                              styles.workflowDetailValue,
                              styles.nextStageValue,
                            ]}
                          >
                            {option.nextStage}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {selected && (
                      <View style={styles.selectedCheck}>
                        <Text style={styles.selectedCheckText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* PARTS REQUISITION */}
          {needsParts && (
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderWithStep}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>

                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Parts Requisition</Text>

                  <Text style={styles.cardSubtitle}>
                    Enter the requisition details
                  </Text>
                </View>
              </View>

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

              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeColumn}>
                  <Text style={styles.fieldLabel}>Requisition Date</Text>

                  <Pressable
                    disabled={saving}
                    onPress={() => setShowDatePicker(true)}
                    style={styles.dateTimeButton}
                  >
                    <View>
                      <Text style={styles.dateTimeValue}>
                        {formatDate(requisitionAt)}
                      </Text>
                    </View>

                    <Text style={styles.dateTimeIcon}>▣</Text>
                  </Pressable>
                </View>

                <View style={styles.dateTimeColumn}>
                  <Text style={styles.fieldLabel}>Requisition Time</Text>

                  <Pressable
                    disabled={saving}
                    onPress={() => setShowTimePicker(true)}
                    style={styles.dateTimeButton}
                  >
                    <View>
                      <Text style={styles.dateTimeValue}>
                        {formatTime(requisitionAt)}
                      </Text>
                    </View>

                    <Text style={styles.dateTimeIcon}>◷</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Remarks</Text>

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

          {/* NO PARTS INFORMATION */}
          {!needsParts && selectedWork && (
            <View style={styles.infoNotice}>
              <View style={styles.infoNoticeIcon}>
                <Text style={styles.infoNoticeIconText}>✓</Text>
              </View>

              <View style={styles.infoNoticeContent}>
                <Text style={styles.infoNoticeTitle}>
                  No Parts Requisition Required
                </Text>

                <Text style={styles.infoNoticeText}>
                  This work path does not require a parts requisition number.
                  The vehicle will proceed to the FLOOR stage.
                </Text>
              </View>
            </View>
          )}

          {/* REMARKS FOR NON-PARTS */}
          {!needsParts && selectedWork && (
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderWithStep}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>

                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Additional Information</Text>

                  <Text style={styles.cardSubtitle}>Optional remarks</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Remarks</Text>

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

          {/* SELECTED SUMMARY */}
          {selectedWork && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Selected Work</Text>

                <View style={styles.summaryStatus}>
                  <Text style={styles.summaryStatusText}>READY</Text>
                </View>
              </View>

              <Text style={styles.summaryWork}>
                {selectedWorkDetails?.title}
              </Text>

              <View style={styles.summaryWorkflowRow}>
                <View style={styles.summaryWorkflowItem}>
                  <Text style={styles.summaryWorkflowLabel}>Requisition</Text>

                  <Text style={styles.summaryWorkflowValue}>
                    {selectedWorkDetails?.requisitionRequired
                      ? "Required"
                      : "Not required"}
                  </Text>
                </View>

                <View style={styles.summaryWorkflowItem}>
                  <Text style={styles.summaryWorkflowLabel}>Next Stage</Text>

                  <Text
                    style={[
                      styles.summaryWorkflowValue,
                      styles.summaryNextStage,
                    ]}
                  >
                    {selectedWorkDetails?.nextStage}
                  </Text>
                </View>
              </View>

              {needsParts && (
                <Text style={styles.summaryDetails}>
                  Parts requisition: {requisitionNo.trim() || "Not entered"}
                </Text>
              )}
            </View>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>

        {/* STICKY ACTION */}
        <View style={styles.bottomAction}>
          <Pressable
            onPress={handleContinue}
            disabled={saving}
            style={[
              styles.saveButton,
              (!selectedWork || saving) && styles.saveButtonDisabled,
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

      {/* DATE PICKER */}
      {showDatePicker && (
        <DateTimePicker
          value={requisitionAt}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      {/* TIME PICKER */}
      {showTimePicker && (
        <DateTimePicker
          value={requisitionAt}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}

      {/* CONFIRMATION MODAL */}
      <Modal
        visible={confirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !saving && setConfirmationVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Text style={styles.confirmIconText}>✓</Text>
            </View>

            <Text style={styles.confirmTitle}>Confirm Work Requirement</Text>

            <Text style={styles.confirmSubtitle}>
              Please review the selected work before saving.
            </Text>

            <View style={styles.confirmDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Vehicle</Text>

                <Text style={styles.confirmValue}>
                  {vehicle?.vehicle_no || "—"}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Customer</Text>

                <Text style={styles.confirmValue}>
                  {vehicle?.customer_name || "—"}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Work</Text>

                <Text style={styles.confirmValue}>
                  {selectedWorkDetails?.title || "—"}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Requisition</Text>

                <Text style={styles.confirmValue}>
                  {selectedWorkDetails?.requisitionRequired
                    ? requisitionNo.trim() || "—"
                    : "Not required"}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Next Stage</Text>

                <Text style={[styles.confirmValue, styles.confirmNextStage]}>
                  {selectedWorkDetails?.nextStage || "—"}
                </Text>
              </View>

              {needsParts && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Date / Time</Text>

                  <Text style={styles.confirmValue}>
                    {formatDate(requisitionAt)} {formatTime(requisitionAt)}
                  </Text>
                </View>
              )}
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
      </Modal>

      {/* GENERAL POPUP */}
      <Modal
        visible={popupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPopupVisible(false)}
      >
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
                  : popupType === "error"
                    ? "!"
                    : popupType === "warning"
                      ? "!"
                      : "i"}
              </Text>
            </View>

            <Text style={styles.popupTitle}>{popupTitle}</Text>

            <Text style={styles.popupMessage}>{popupMessage}</Text>

            <Pressable onPress={handlePopupClose} style={styles.popupButton}>
              <Text style={styles.popupButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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

  /* TOP BAR */

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

  /* RED HERO */

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
    justifyContent: "space-between",
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

  /* SECTION CARD */

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

  /* VEHICLE INFO */

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

  /* WORK OPTIONS */

  workOptions: {
    gap: spacing.sm,
  },

  workOption: {
    minHeight: 94,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
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
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },

  tag: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  tagSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },

  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  tagTextSelected: {
    color: colors.primary,
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

  /* WORKFLOW DETAILS */

  workflowDetails: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },

  workflowDetailsSelected: {
    borderTopColor: "rgba(215,25,32,0.18)",
  },

  workflowDetailItem: {
    flex: 1,
  },

  workflowDetailDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },

  workflowDetailLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },

  workflowDetailValue: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.text,
  },

  workflowDetailRequired: {
    color: colors.primary,
  },

  nextStageValue: {
    color: colors.primary,
  },

  /* FORM */

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
  },

  dateTimeRow: {
    flexDirection: "row",
    gap: spacing.sm,
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

  /* INFORMATION NOTICE */

  infoNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  infoNoticeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },

  infoNoticeIconText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "900",
  },

  infoNoticeContent: {
    flex: 1,
  },

  infoNoticeTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  infoNoticeText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  /* SUMMARY */

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
    letterSpacing: 0.5,
  },

  summaryWork: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "900",
    color: colors.text,
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
    textTransform: "uppercase",
    letterSpacing: 0.4,
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

  summaryDetails: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },

  bottomSpace: {
    height: 90,
  },

  /* BOTTOM ACTION */

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

  /* MODALS */

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

  /* GENERAL POPUP */

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
