import BackButton from "../../../../components/navigation/BackButton";
import BrandPill from "../../../../components/navigation/BrandPill";
import { returnToRoute, useHardwareBack, singleParam } from "../../../../lib/back-navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../../lib/supabase";
import { colors } from "../../../../theme";

type InspectionResult = "PASSED" | "FAILED";

type FinalInspectionVehicle = {
  visit_id: string;

  vehicle_id: string;

  vehicle_no: string;

  model: string | null;

  current_stage: string;

  current_status: string;

  stage_started_at: string | null;

  assigned_to: string | null;

  job_id: string | null;

  job_type: string | null;

  advisor_id: string | null;

  inspection_attempts: number;

  last_inspection_result: string | null;

  last_inspection_at: string | null;
};

type FinalInspectionQueue = {
  role: string;

  items: FinalInspectionVehicle[];
};

type Message = {
  title: string;

  body: string;

  type?: "success" | "error" | "info";

  confirm?: () => void;

  confirmLabel?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  return (
    new Date(value).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",

      day: "2-digit",

      month: "short",

      year: "numeric",

      hour: "2-digit",

      minute: "2-digit",

      hour12: true,
    }) + " IST"
  );
}

function elapsed(value?: string | null) {
  if (!value) {
    return "Time unavailable";
  }

  const start = new Date(value).getTime();

  if (!Number.isFinite(start) || start > Date.now()) {
    return "Time unavailable";
  }

  const minutes = Math.floor((Date.now() - start) / 60000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d${hours % 24 ? ` ${hours % 24}h` : ""}`;
}

function formatJobType(value?: string | null) {
  if (!value) {
    return "Job type unavailable";
  }

  if (value === "PAID") {
    return "Paid Job";
  }

  if (value === "INSURANCE") {
    return "Insurance Job";
  }

  return value.replaceAll("_", " ");
}

export default function FinalInspectionVehicleScreen() {
  const navigationParams = useLocalSearchParams<{ returnTo?: string | string[]; returnVisitId?: string | string[]; floor?: string | string[]; filter?: string | string[] }>();
  const handleNavigationBack = () => {
    if (saving) return;
    const candidate = singleParam(navigationParams.filter);
    const filter = ["ALL", "PENDING", "IN_PROGRESS", "REINSPECTION"].includes(candidate || "") ? candidate! : "ALL";
    returnToRoute({ pathname: "/(tabs)/final-inspector/inspections", params: { filter } });
  };
  useHardwareBack(handleNavigationBack);

  const params = useLocalSearchParams<{
    visitId?: string | string[];
  }>();

  const visitId = (Array.isArray(params.visitId) ? params.visitId[0] : params.visitId)?.trim() || "";

  const [vehicle, setVehicle] = useState<FinalInspectionVehicle | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [remarks, setRemarks] = useState("");

  const [failureReason, setFailureReason] = useState("");

  const [selectedResult, setSelectedResult] = useState<InspectionResult | null>(
    null,
  );

  const [message, setMessage] = useState<Message | null>(null);

  const submitting = useRef(false);

  const loadRequest = useRef(0);
  const completed = useRef(false);

  useEffect(() => {
    completed.current = false;
    setVehicle(null);
    setRemarks("");
    setFailureReason("");
    setSelectedResult(null);
    setMessage(null);
  }, [visitId]);

  const fetchVehicle =
    useCallback(async (): Promise<FinalInspectionVehicle> => {
      if (!visitId) {
        throw new Error("Final Inspection visit was not provided.");
      }

      /*
       * Dedicated Final Inspector queue.
       *
       * This backend RPC already enforces:
       * - active final_inspector role
       * - active FINAL_INSPECTOR assignment
       * - only the logged-in inspector's vehicles
       */
      const { data, error: queueError } = await supabase.rpc(
        "new_workflow_final_inspection_queue",
      );

      if (queueError) {
        throw queueError;
      }

      const queue = data as FinalInspectionQueue;

      if (!queue || !Array.isArray(queue.items)) {
        throw new Error("The inspection list could not be loaded. Refresh and try again.");
      }

      if (queue.role !== "final_inspector") {
        throw new Error(
          "This workspace is available only to Final Inspectors.",
        );
      }

      const selected = queue.items?.find((item) => item.visit_id === visitId);

      if (!selected) {
        throw new Error(
          "This vehicle is no longer assigned to you or is no longer waiting for Final Inspection.",
        );
      }

      if (selected.current_stage !== "FINAL_INSPECTION") {
        throw new Error(
          "This vehicle has already moved out of Final Inspection.",
        );
      }

      if (!selected.assigned_to || !["PENDING", "IN_PROGRESS"].includes(selected.current_status)) {
        throw new Error("This inspection is no longer available. Return to My Inspections and refresh.");
      }

      return selected;
    }, [visitId]);

  const load = useCallback(
    async (refresh = false) => {
      if (submitting.current || completed.current) return;
      const request = ++loadRequest.current;
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const selected = await fetchVehicle();

        if (request !== loadRequest.current) return;

        setVehicle(selected);
      } catch (e: any) {
        if (request !== loadRequest.current) return;
        console.error("Failed to load Final Inspection vehicle:", e);

        const body =
          e?.message || "Unable to load this Final Inspection vehicle.";

        setError(body);
        setVehicle(null);
      } finally {
        if (request === loadRequest.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchVehicle],
  );

  useFocusEffect(
    useCallback(() => {
      void load();

      return () => { loadRequest.current += 1; };
    }, [load]),
  );

  const validate = useCallback(
    (result: InspectionResult) => {
      if (!vehicle) {
        return false;
      }

      if (result === "FAILED" && !failureReason.trim()) {
        setMessage({
          title: "Failure Reason Required",

          body: "Describe the issue found during Final Inspection before sending the vehicle back to Floor.",

          type: "error",
        });

        return false;
      }

      return true;
    },
    [vehicle, failureReason],
  );

  const performResult = async (result: InspectionResult) => {
    if (!vehicle || saving || refreshing || loading || completed.current || submitting.current) {
      return;
    }

    if (!validate(result)) {
      return;
    }

    submitting.current = true;

    setSaving(true);

    try {
      /*
       * Re-read immediately before mutation.
       *
       * This prevents stale-screen submission
       * after reassignment or stage movement.
       */
      const current = await fetchVehicle();

      if (
        current.visit_id !== vehicle.visit_id ||
        current.current_stage !== vehicle.current_stage ||
        current.current_status !== vehicle.current_status ||
        current.assigned_to !== vehicle.assigned_to
      ) {
        throw new Error(
          "This inspection has changed. Refresh before continuing.",
        );
      }

      const { data, error: saveError } = await supabase.rpc(
        "new_workflow_complete_final_inspection",
        {
          p_visit_id: vehicle.visit_id,

          p_result: result,

          p_failure_reason: result === "FAILED" ? failureReason.trim() : null,

          p_remarks: remarks.trim() || null,
        },
      );

      if (saveError) {
        throw saveError;
      }

      if (!data || data.success !== true) {
        throw new Error("The inspection result could not be confirmed. Refresh before trying again.");
      }

      completed.current = true;

      /*
       * Vehicle leaves the inspector queue
       * immediately after either PASS or FAIL.
       *
       * PASS -> ADVISOR BILLING PREPARATION
       * FAIL -> FLOOR REWORK
       */
      setMessage({
        title: result === "PASSED" ? "Final Inspection passed" : "Returned for Floor rework",
        body: result === "PASSED"
          ? "The inspection has been recorded. The vehicle has returned to its Advisor for Billing preparation and executive assignment."
          : "The failure reason has been recorded and the vehicle has returned to Floor for rework. Final Inspection is required again after rework.",
        type: "success",
        confirmLabel: "Back to My Inspections",
        confirm: () => router.replace("/(tabs)/final-inspector/inspections" as any),
      });
    } catch (e: any) {
      console.error("Final Inspection save error:", e);

      setMessage({
        title: "Unable to Save Inspection",

        body: e?.message || "Refresh and try again.",

        type: "error",
      });
    } finally {
      submitting.current = false;

      setSaving(false);
    }
  };

  const confirmResult = (result: InspectionResult) => {
    if (saving || loading || refreshing || completed.current) return;
    if (!validate(result)) {
      return;
    }

    setSelectedResult(result);

    if (result === "PASSED") {
      setMessage({
        title: "Pass Final Inspection?",

        body: "This will record the inspection as Passed, close your Final Inspector assignment and return the vehicle to its Advisor for Billing preparation.",

        confirm: () => {
          setMessage(null);

          void performResult("PASSED");
        },
      });

      return;
    }

    setMessage({
      title: "Fail Final Inspection?",

      body: "This will record the inspection as Failed and return the vehicle to Floor for a new rework cycle assigned to the previous Floor Incharge.",

      confirm: () => {
        setMessage(null);

        void performResult("FAILED");
      },
    });
  };

  if (loading && !vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.muted}>Loading Final Inspection…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.content}>
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={25}
              color={colors.error}
            />

            <Text style={styles.errorTitle}>Inspection unavailable</Text>

            <Text style={styles.errorText}>
              {error || "This Final Inspection could not be loaded."}
            </Text>

            <ActionButton
              title="Refresh Inspection"
              disabled={loading || refreshing || !visitId}
              onPress={() => void load(true)}
            />

            <BackButton onPress={handleNavigationBack} accessibilityLabel="Back to My Inspections" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const reinspection = vehicle.inspection_attempts > 0;

  const nextAttempt = vehicle.inspection_attempts + 1;

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "right", "bottom", "left"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* TOP BAR */}

      <View style={styles.topBar}>
        <BackButton onPress={() => router.replace("/(tabs)/final-inspector/inspections" as any)} disabled={saving} />

        <BrandPill />
      </View>

      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color={colors.primary} />

          <Text style={styles.savingText}>Saving inspection result…</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { if (!saving) void load(true); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* HERO */}

        <View style={styles.hero}>
          <Text style={styles.heroPill}>FINAL INSPECTION</Text>

          <Text style={styles.vehicleNo}>{vehicle.vehicle_no}</Text>

          <Text style={styles.vehicleModel}>
            {vehicle.model || "Model not recorded"}

            {vehicle.job_type ? ` · ${formatJobType(vehicle.job_type)}` : ""}
          </Text>

          <View style={styles.heroStats}>
            <HeroStat label="Attempt" value={`#${nextAttempt}`} />

            <View style={styles.heroDivider} />

            <HeroStat
              label="Waiting"
              value={elapsed(vehicle.stage_started_at)}
            />

            <View style={styles.heroDivider} />

            <HeroStat
              label="Status"
              value={
                vehicle.current_status === "IN_PROGRESS"
                  ? "In progress"
                  : "Pending"
              }
            />
          </View>
        </View>

        {/* INSPECTION CONTEXT */}

        <View style={styles.card}>
          <Text style={styles.eyebrow}>INSPECTION CONTEXT</Text>

          <Text style={styles.title}>Final quality check</Text>

          <Text style={styles.body}>
            Final Inspection is mandatory for every vehicle, including Paid
            and Insurance jobs. Verify the completed repairs before Billing.
          </Text>

          <View style={styles.detailGrid}>
            <Detail label="Vehicle" value={vehicle.vehicle_no} />

            <Detail label="Job Type" value={formatJobType(vehicle.job_type)} />

            <Detail
              label="Previous Attempts"
              value={String(vehicle.inspection_attempts)}
            />

            <Detail
              label="Entered Final Inspection"
              value={formatDateTime(vehicle.stage_started_at)}
            />
          </View>
        </View>

        {/* PREVIOUS INSPECTION */}

        {reinspection && (
          <View style={styles.previousCard}>
            <View style={styles.previousIcon}>
              <Ionicons
                name="repeat-outline"
                size={23}
                color={colors.primary}
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.eyebrow}>REINSPECTION</Text>

              <Text style={styles.title}>Previous inspection recorded</Text>

              <Text style={styles.body}>
                Last result:{" "}
                {vehicle.last_inspection_result?.replaceAll("_", " ") ||
                  "Recorded"}
              </Text>

              <Text style={styles.previousTime}>
                {formatDateTime(vehicle.last_inspection_at)}
              </Text>
            </View>
          </View>
        )}

        {/* RESULT */}

        <View style={styles.card}>
          <Text style={styles.eyebrow}>INSPECTION RESULT</Text>

          <Text style={styles.title}>Select result</Text>

          <Text style={styles.body}>
            Pass the vehicle only when the completed repair meets Final
            Inspection standards.
          </Text>

          <View style={styles.resultGrid}>
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedResult === "PASSED", disabled: saving || loading || refreshing || completed.current }}
              disabled={saving || loading || refreshing || completed.current}
              onPress={() => setSelectedResult("PASSED")}
              activeOpacity={0.85}
              style={[
                styles.resultOption,

                selectedResult === "PASSED" && styles.passSelected,
              ]}
            >
              <View style={styles.passIcon}>
                <Ionicons name="checkmark" size={24} color="#217A50" />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.resultTitle}>Passed</Text>

                <Text style={styles.resultDescription}>
                  Repair quality is acceptable. Vehicle returns to the Advisor for Billing preparation.
                </Text>
              </View>

              <Ionicons
                name={
                  selectedResult === "PASSED"
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={21}
                color={
                  selectedResult === "PASSED" ? "#217A50" : colors.textSecondary
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedResult === "FAILED", disabled: saving || loading || refreshing || completed.current }}
              disabled={saving || loading || refreshing || completed.current}
              onPress={() => setSelectedResult("FAILED")}
              activeOpacity={0.85}
              style={[
                styles.resultOption,

                selectedResult === "FAILED" && styles.failSelected,
              ]}
            >
              <View style={styles.failIcon}>
                <Ionicons name="close" size={24} color={colors.error} />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.resultTitle}>Failed</Text>

                <Text style={styles.resultDescription}>
                  Rectification is required. Vehicle will return to Floor for
                  rework.
                </Text>
              </View>

              <Ionicons
                name={
                  selectedResult === "FAILED"
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={21}
                color={
                  selectedResult === "FAILED"
                    ? colors.error
                    : colors.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* FAILURE REASON */}

        {selectedResult === "FAILED" && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>REWORK REQUIRED</Text>

            <Text style={styles.title}>Failure reason</Text>

            <Text style={styles.body}>
              Describe exactly what must be corrected on Floor. This reason will
              be attached directly to the new Final Inspection Rework item.
            </Text>

            <TextInput
              value={failureReason}
              onChangeText={setFailureReason}
              editable={!saving}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              placeholder="Describe the defect, incomplete work, finish issue, fitting issue or other rectification required..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.multiline]}
            />

            <Text style={styles.characterCount}>
              {failureReason.length}
              /1000
            </Text>

            <View style={styles.reworkNotice}>
              <Ionicons
                name="construct-outline"
                size={19}
                color={colors.primary}
              />

              <Text style={styles.reworkNoticeText}>
                On failure, a fresh Floor cycle is created with a dedicated
                Final Inspection Rework item and assigned back to the previous
                active Floor Incharge.
              </Text>
            </View>
          </View>
        )}

        {/* REMARKS */}

        <View style={styles.card}>
          <Text style={styles.eyebrow}>OPTIONAL</Text>

          <Text style={styles.title}>Inspection remarks</Text>

          <Text style={styles.body}>
            Add any additional information related to this Final Inspection.
          </Text>

          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            editable={!saving}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            placeholder="Enter inspection remarks..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.multiline]}
          />

          <Text style={styles.characterCount}>{remarks.length}/1000</Text>
        </View>

        {/* NEXT STAGE */}

        {selectedResult && (
          <View
            style={[
              styles.nextCard,

              selectedResult === "PASSED" ? styles.nextPass : styles.nextFail,
            ]}
          >
            <View
              style={
                selectedResult === "PASSED"
                  ? styles.nextPassIcon
                  : styles.nextFailIcon
              }
            >
              <Ionicons
                name={
                  selectedResult === "PASSED"
                    ? "receipt-outline"
                    : "construct-outline"
                }
                size={22}
                color={selectedResult === "PASSED" ? "#217A50" : colors.error}
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.nextLabel}>NEXT WORKFLOW STAGE</Text>

              <Text style={styles.nextTitle}>
                {selectedResult === "PASSED" ? "Advisor Billing preparation" : "Floor Rework"}
              </Text>

              <Text style={styles.nextText}>
                {selectedResult === "PASSED"
                  ? "The Advisor will complete verification or Insurance steps, then assign a Billing Executive."
                  : "The Final Inspector assignment will close and the vehicle will return to Floor in a new rework cycle."}
              </Text>
            </View>
          </View>
        )}

        {/* SUBMIT */}

        {selectedResult === "PASSED" && (
          <ActionButton
            title="Pass Inspection & Return to Advisor"
            disabled={saving || loading || refreshing || completed.current}
            onPress={() => confirmResult("PASSED")}
          />
        )}

        {selectedResult === "FAILED" && (
          <ActionButton
            title="Fail Inspection & Return to Floor"
            disabled={saving || loading || refreshing || completed.current || !failureReason.trim()}
            danger
            onPress={() => confirmResult("FAILED")}
          />
        )}

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.textSecondary}
          />

          <Text style={styles.infoText}>
            Each submission creates a permanent Final Inspection attempt with
            the inspector, result and timestamp. Failed inspections remain in
            history even after the vehicle returns for reinspection.
          </Text>
        </View>
      </ScrollView>

      {/* CONFIRMATION / ERROR */}

      <Modal
        visible={!!message}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (saving) return;
          if (completed.current) router.replace("/(tabs)/final-inspector/inspections" as any);
          else setMessage(null);
        }}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.dialog}>
            <View
              style={[
                styles.dialogIcon,

                {
                  backgroundColor:
                    message?.type === "error"
                      ? colors.dangerLight
                      : message?.type === "success"
                        ? "#E8F5EE"
                      : message?.confirm
                        ? "#FFF6DD"
                        : colors.primaryLight,
                },
              ]}
            >
              <Ionicons
                name={
                  message?.type === "error"
                    ? "alert-circle-outline"
                    : message?.type === "success"
                      ? "checkmark-circle-outline"
                    : message?.confirm
                      ? "help-circle-outline"
                      : "information-circle-outline"
                }
                size={28}
                color={
                  message?.type === "error" ? colors.error : message?.type === "success" ? "#217A50" : colors.primary
                }
              />
            </View>

            <Text style={styles.dialogTitle}>{message?.title}</Text>

            <Text style={styles.dialogBody}>{message?.body}</Text>

            {message?.confirm ? (
              <>
                <ActionButton
                  title={message.confirmLabel || "Confirm"}
                  disabled={saving}
                  danger={message.type !== "success" && selectedResult === "FAILED"}
                  onPress={message.confirm}
                />

                {message.type !== "success" && <ActionButton
                  title="Cancel"
                  secondary
                  disabled={saving}
                  onPress={() => setMessage(null)}
                />}
              </>
            ) : (
              <ActionButton title="OK" onPress={() => setMessage(null)} />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ActionButton({
  title,

  onPress,

  disabled = false,

  secondary = false,

  danger = false,
}: {
  title: string;

  onPress: () => void;

  disabled?: boolean;

  secondary?: boolean;

  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.84}
      style={[
        styles.button,

        secondary && styles.buttonSecondary,

        danger && styles.buttonDanger,

        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.buttonText, secondary && styles.buttonSecondaryText]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function Detail({
  label,

  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>

      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function HeroStat({
  label,

  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
      }}
    >
      <Text style={styles.heroStatValue} numberOfLines={1}>
        {value}
      </Text>

      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: colors.background,
  },

  content: {
    width: "100%",

    maxWidth: 860,

    alignSelf: "center",

    paddingHorizontal: 16,

    paddingBottom: 36,

    gap: 16,
  },

  loading: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    gap: 12,
  },

  muted: {
    color: colors.textSecondary,

    fontSize: 12,
  },

  topBar: {
    height: 52,

    paddingHorizontal: 16,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  back: {
    minHeight: 44,

    flexDirection: "row",

    alignItems: "center",
  },

  backText: {
    color: colors.textSecondary,

    fontSize: 14,

    fontWeight: "700",
  },

  brand: {
    paddingHorizontal: 11,

    paddingVertical: 8,

    borderRadius: 999,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

    flexDirection: "row",

    alignItems: "center",

    gap: 6,
  },

  brandDot: {
    width: 6,

    height: 6,

    borderRadius: 3,

    backgroundColor: "#F20D1D",
  },

  brandText: {
    color: colors.text,

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 1.2,
  },

  savingBar: {
    paddingVertical: 11,

    paddingHorizontal: 16,

    backgroundColor: "#FFF1F2",

    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    gap: 8,
  },

  savingText: {
    color: colors.textSecondary,

    fontSize: 12,
  },

  hero: {
    padding: 20,

    borderRadius: 18,

    backgroundColor: "#F20D1D",

    gap: 9,
  },

  heroPill: {
    alignSelf: "flex-start",

    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 999,

    backgroundColor: "rgba(255,255,255,.16)",

    color: "#FFFFFF",

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 1,
  },

  vehicleNo: {
    color: "#FFFFFF",

    fontSize: 28,

    fontWeight: "900",
  },

  vehicleModel: {
    color: "rgba(255,255,255,.88)",

    fontSize: 13,
  },

  heroStats: {
    marginTop: 7,

    paddingTop: 14,

    borderTopWidth: 1,

    borderTopColor: "rgba(255,255,255,.22)",

    flexDirection: "row",

    gap: 14,
  },

  heroDivider: {
    width: 1,

    backgroundColor: "rgba(255,255,255,.24)",
  },

  heroStatValue: {
    color: "#FFFFFF",

    fontSize: 16,

    fontWeight: "900",
  },

  heroStatLabel: {
    marginTop: 3,

    color: "rgba(255,255,255,.82)",

    fontSize: 10,
  },

  card: {
    padding: 18,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    gap: 12,
  },

  eyebrow: {
    color: colors.primary,

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 0.9,
  },

  title: {
    color: colors.text,

    fontSize: 18,

    fontWeight: "800",
  },

  body: {
    color: colors.textSecondary,

    fontSize: 12,

    lineHeight: 19,
  },

  detailGrid: {
    marginTop: 4,

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,
  },

  detail: {
    flexGrow: 1,

    width: "47%",

    minWidth: 135,

    padding: 11,

    borderRadius: 11,

    backgroundColor: colors.background,
  },

  detailLabel: {
    color: colors.textSecondary,

    fontSize: 9,

    fontWeight: "700",
  },

  detailValue: {
    marginTop: 4,

    color: colors.text,

    fontSize: 12,

    fontWeight: "900",
  },

  previousCard: {
    padding: 17,

    borderRadius: 17,

    backgroundColor: "#FFF9F9",

    borderWidth: 1,

    borderColor: "#FDE5E7",

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 11,
  },

  previousIcon: {
    width: 44,

    height: 44,

    borderRadius: 13,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  previousTime: {
    marginTop: 5,

    color: colors.textSecondary,

    fontSize: 10,
  },

  resultGrid: {
    gap: 10,
  },

  resultOption: {
    padding: 14,

    borderRadius: 14,

    backgroundColor: colors.background,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "center",

    gap: 11,
  },

  passSelected: {
    backgroundColor: "#F4FBF7",

    borderColor: "#8ACBAA",
  },

  failSelected: {
    backgroundColor: "#FFF5F5",

    borderColor: "#F3B4B8",
  },

  passIcon: {
    width: 42,

    height: 42,

    borderRadius: 13,

    backgroundColor: "#E8F5EE",

    alignItems: "center",

    justifyContent: "center",
  },

  failIcon: {
    width: 42,

    height: 42,

    borderRadius: 13,

    backgroundColor: colors.dangerLight,

    alignItems: "center",

    justifyContent: "center",
  },

  resultTitle: {
    color: colors.text,

    fontSize: 14,

    fontWeight: "900",
  },

  resultDescription: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  input: {
    padding: 14,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: colors.border,

    color: colors.text,

    backgroundColor: colors.background,

    fontSize: 14,
  },

  multiline: {
    minHeight: 110,

    textAlignVertical: "top",
  },

  characterCount: {
    textAlign: "right",

    color: colors.textSecondary,

    fontSize: 10,
  },

  reworkNotice: {
    padding: 12,

    borderRadius: 12,

    backgroundColor: colors.primaryLight,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 8,
  },

  reworkNoticeText: {
    flex: 1,

    color: colors.primaryDark,

    fontSize: 11,

    lineHeight: 17,
  },

  nextCard: {
    padding: 17,

    borderRadius: 17,

    borderWidth: 1,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 11,
  },

  nextPass: {
    backgroundColor: "#F4FBF7",

    borderColor: "#CDE9DA",
  },

  nextFail: {
    backgroundColor: "#FFF5F5",

    borderColor: "#F3C8CB",
  },

  nextPassIcon: {
    width: 44,

    height: 44,

    borderRadius: 13,

    backgroundColor: "#E8F5EE",

    alignItems: "center",

    justifyContent: "center",
  },

  nextFailIcon: {
    width: 44,

    height: 44,

    borderRadius: 13,

    backgroundColor: colors.dangerLight,

    alignItems: "center",

    justifyContent: "center",
  },

  nextLabel: {
    color: colors.primary,

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.8,
  },

  nextTitle: {
    marginTop: 3,

    color: colors.text,

    fontSize: 15,

    fontWeight: "900",
  },

  nextText: {
    marginTop: 4,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  button: {
    minHeight: 50,

    paddingHorizontal: 15,

    borderRadius: 13,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",
  },

  buttonDanger: {
    backgroundColor: colors.error,
  },

  buttonSecondary: {
    backgroundColor: colors.primaryLight,

    borderWidth: 1,

    borderColor: "#FDE5E7",
  },

  buttonText: {
    color: "#FFFFFF",

    fontSize: 13,

    fontWeight: "900",

    textAlign: "center",
  },

  buttonSecondaryText: {
    color: colors.primaryDark,
  },

  disabled: {
    opacity: 0.45,
  },

  infoCard: {
    padding: 14,

    borderRadius: 14,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 9,
  },

  infoText: {
    flex: 1,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 18,
  },

  errorCard: {
    padding: 20,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    gap: 12,

    alignItems: "center",
  },

  errorTitle: {
    color: colors.text,

    fontSize: 18,

    fontWeight: "900",

    textAlign: "center",
  },

  errorText: {
    color: colors.textSecondary,

    fontSize: 12,

    lineHeight: 19,

    textAlign: "center",
  },

  overlay: {
    flex: 1,

    padding: 24,

    backgroundColor: "rgba(15,23,42,.6)",

    justifyContent: "center",

    alignItems: "center",
  },

  dialog: {
    width: "100%",

    maxWidth: 430,

    padding: 24,

    borderRadius: 18,

    backgroundColor: colors.surface,

    gap: 14,
  },

  dialogIcon: {
    width: 56,

    height: 56,

    borderRadius: 28,

    alignItems: "center",

    justifyContent: "center",
  },

  dialogTitle: {
    color: colors.text,

    fontSize: 20,

    fontWeight: "900",
  },

  dialogBody: {
    color: colors.textSecondary,

    fontSize: 13,

    lineHeight: 20,
  },
});
