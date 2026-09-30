
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppCard from "../../../../components/AppCard";
import { supabase } from "../../../../lib/supabase";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../theme";

type VehicleInfo = {
  id: string;
  vehicle_no: string | null;
  model: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  current_stage: string | null;
  current_status: string | null;
};

type Job = {
  id: string;
  vehicle_id: string;
  job_card_no: string | null;
  job_type: string | null;
  current_job_stage: string | null;
  floor_incharge_id: string | null;
  advisor_id: string | null;
  vehicles: VehicleInfo | VehicleInfo[] | null;
};

type Progress = {
  job_id: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
  started_at: string | null;
  completed_at: string | null;
};

type WorkItem = {
  job: Job;
  vehicle: VehicleInfo | null;
  progress: Progress | null;
};

type WorkAction = "start" | "complete" | "advance";

type PopupKind = "confirm" | "success" | "error";

type PopupState = {
  visible: boolean;
  title: string;
  message: string;
  kind: PopupKind;
};

function getVehicle(job: Job): VehicleInfo | null {
  if (Array.isArray(job.vehicles)) {
    return job.vehicles[0] ?? null;
  }

  return job.vehicles ?? null;
}

// Formats the Supabase timestamp in the device's local time zone.
function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FloorInchargeWorkScreen() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    title: "",
    message: "",
    kind: "confirm",
  });

  const [pendingAction, setPendingAction] = useState<{
    item: WorkItem;
    action: WorkAction;
  } | null>(null);

  const loadWork = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

      if (profileError || !profile || !profile.is_active) {
        router.replace("/login");
        return;
      }

      if (profile.role !== "floor_incharge") {
        router.replace("/(tabs)/work");
        return;
      }

      const { data: jobData, error: jobError } = await supabase
        .from("vehicle_jobs")
        .select(`
          id,
          vehicle_id,
          job_card_no,
          job_type,
          current_job_stage,
          floor_incharge_id,
          advisor_id,
          vehicles (
            id,
            vehicle_no,
            model,
            customer_name,
            customer_mobile,
            current_stage,
            current_status
          )
        `)
        .eq("floor_incharge_id", user.id)
        .eq("current_job_stage", "FLOOR")
        .order("created_at", { ascending: false });

      if (jobError) throw jobError;

      const jobs = (jobData ?? []) as unknown as Job[];
      const jobIds = jobs.map((job) => job.id);

      let progressByJob = new Map<string, Progress>();

      if (jobIds.length > 0) {
        const { data: progressData, error: progressError } = await supabase
          .from("floor_work_progress")
          .select("job_id, status, started_at, completed_at")
          .in("job_id", jobIds);

        if (progressError) throw progressError;

        progressByJob = new Map(
          ((progressData ?? []) as Progress[]).map((progress) => [
            progress.job_id,
            progress,
          ])
        );
      }

      setItems(
        jobs
          .filter((job) => getVehicle(job)?.current_stage === "FLOOR")
          .map((job) => ({
            job,
            vehicle: getVehicle(job),
            progress: progressByJob.get(job.id) ?? null,
          }))
      );
    } catch (error) {
      console.log("Load Floor Incharge work error:", error);

      const message =
        error instanceof Error ? error.message : "Please try again.";

      setPopup({
        visible: true,
        title: "Could Not Load Work",
        message,
        kind: "error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWork();
  }, [loadWork]);

  const refresh = () => {
    setRefreshing(true);
    void loadWork();
  };

  const getProgressStatus = (item: WorkItem) =>
    item.progress?.status ?? "NOT_STARTED";

  const runWorkAction = (item: WorkItem, action: WorkAction) => {
    const actionLabel =
      action === "start"
        ? "start work on this vehicle"
        : action === "complete"
          ? "mark this work as done"
          : "move this vehicle to Workshop";

    console.log("Floor action button pressed:", {
      action,
      jobId: item.job.id,
      vehicleId: item.job.vehicle_id,
    });

    setPendingAction({ item, action });
    setPopup({
      visible: true,
      title: "Confirm Action",
      message: `Are you sure you want to ${actionLabel}?`,
      kind: "confirm",
    });
  };

  const confirmWorkAction = async () => {
    if (!pendingAction) return;

    const { item, action } = pendingAction;
    const vehicleId = item.job.vehicle_id;

    const rpcName =
      action === "start"
        ? "start_floor_work"
        : action === "complete"
          ? "complete_floor_work"
          : "advance_vehicle_after_floor";

    setPopup((current) => ({ ...current, visible: false }));
    setBusyJobId(item.job.id);

    try {
      console.log("Calling RPC:", rpcName, {
        vehicleId,
        jobId: item.job.id,
      });

      const { data, error } = await supabase.rpc(rpcName, {
        p_vehicle_id: vehicleId,
      });

      console.log("RPC response:", { data, error });

      if (error) {
        throw new Error(error.message);
      }

      const successMessage =
        action === "start"
          ? "Work has been marked as started."
          : action === "complete"
            ? "Work has been marked as done."
            : "Vehicle has moved to Workshop.";

      setPendingAction(null);
      setPopup({
        visible: true,
        title: "Success",
        message: successMessage,
        kind: "success",
      });

      await loadWork();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Please try again.";

      console.log("Floor work action failed:", message);

      setPendingAction(null);
      setPopup({
        visible: true,
        title: "Action Failed",
        message,
        kind: "error",
      });
    } finally {
      setBusyJobId(null);
    }
  };

  const closePopup = () => {
    setPopup((current) => ({ ...current, visible: false }));
    setPendingAction(null);
  };

  const renderAction = (item: WorkItem) => {
    const status = getProgressStatus(item);
    const isBusy = busyJobId === item.job.id;

    if (status === "NOT_STARTED") {
      return (
        <ActionButton
          title="Work Started"
          icon="play-circle-outline"
          loading={isBusy}
          onPress={() => runWorkAction(item, "start")}
        />
      );
    }

    if (status === "IN_PROGRESS") {
      return (
        <ActionButton
          title="Work Done"
          icon="checkmark-circle-outline"
          loading={isBusy}
          onPress={() => runWorkAction(item, "complete")}
        />
      );
    }

    return (
      <ActionButton
        title="Move to Workshop"
        icon="arrow-forward-circle-outline"
        loading={isBusy}
        onPress={() => runWorkAction(item, "advance")}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            Loading assigned vehicles...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons
              name="construct-outline"
              size={26}
              color={colors.primary}
            />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>My Floor Work</Text>
            <Text style={styles.subtitle}>
              Vehicles assigned to you and currently at the Floor stage.
            </Text>
          </View>
        </View>

        <View style={styles.countRow}>
          <Text style={styles.sectionTitle}>Assigned Vehicles</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        </View>

        {items.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <Ionicons
              name="car-outline"
              size={34}
              color={colors.textLight}
            />
            <Text style={styles.emptyTitle}>No assigned vehicles</Text>
            <Text style={styles.emptyText}>
              Vehicles assigned to you for floor work will appear here.
            </Text>
          </AppCard>
        ) : (
          items.map((item) => {
            const vehicle = item.vehicle;
            const status = getProgressStatus(item);

            return (
              <AppCard key={item.job.id} style={styles.vehicleCard}>
                <View style={styles.vehicleHeader}>
                  <View style={styles.carIcon}>
                    <Ionicons
                      name="car-sport-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.vehicleHeading}>
                    <Text style={styles.vehicleNumber}>
                      {vehicle?.vehicle_no || "Vehicle number unavailable"}
                    </Text>
                    <Text style={styles.vehicleModel}>
                      {vehicle?.model || "Model not available"}
                    </Text>
                  </View>
                </View>

                <View style={styles.details}>
                  <DetailRow
                    label="Customer"
                    value={vehicle?.customer_name || "Not available"}
                  />
                  <DetailRow
                    label="Job Card"
                    value={item.job.job_card_no || "Not available"}
                  />
                  <DetailRow
                    label="Job Type"
                    value={item.job.job_type || "Not available"}
                  />
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Work status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      status === "IN_PROGRESS" && styles.inProgressBadge,
                      status === "DONE" && styles.doneBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {status === "NOT_STARTED"
                        ? "Not Started"
                        : status === "IN_PROGRESS"
                          ? "In Progress"
                          : "Work Done"}
                    </Text>
                  </View>
                </View>

                {/* Show the recorded start date/time after work has started. */}
                {item.progress?.started_at && (
                  <View style={styles.startedTimeRow}>
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.startedTimeText}>
                      Started at: {formatDateTime(item.progress.started_at)}
                    </Text>
                  </View>
                )}

                {renderAction(item)}
              </AppCard>
            );
          })
        )}
      </ScrollView>

      {/* Custom confirmation, success and error popup */}
      <Modal
        visible={popup.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePopup}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View
              style={[
                styles.popupIcon,
                popup.kind === "success" && styles.popupSuccessIcon,
                popup.kind === "error" && styles.popupErrorIcon,
              ]}
            >
              <Ionicons
                name={
                  popup.kind === "confirm"
                    ? "help-circle-outline"
                    : popup.kind === "success"
                      ? "checkmark-circle-outline"
                      : "alert-circle-outline"
                }
                size={34}
                color={
                  popup.kind === "success"
                    ? "#15803D"
                    : popup.kind === "error"
                      ? "#DC2626"
                      : colors.primary
                }
              />
            </View>

            <Text style={styles.popupTitle}>{popup.title}</Text>
            <Text style={styles.popupMessage}>{popup.message}</Text>

            <View style={styles.popupButtons}>
              {popup.kind === "confirm" ? (
                <>
                  <Pressable
                    style={[styles.popupButton, styles.popupCancelButton]}
                    onPress={closePopup}
                  >
                    <Text style={styles.popupCancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.popupButton, styles.popupConfirmButton]}
                    disabled={busyJobId !== null}
                    onPress={() => void confirmWorkAction()}
                  >
                    {busyJobId !== null ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.popupConfirmText}>Confirm</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={[styles.popupButton, styles.popupConfirmButton]}
                  onPress={closePopup}
                >
                  <Text style={styles.popupConfirmText}>OK</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  title,
  icon,
  loading,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.actionPressed,
        loading && styles.actionDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          <Ionicons name={icon} size={21} color={colors.white} />
          <Text style={styles.actionText}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  countText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  emptyCard: {
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  vehicleCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  vehicleHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  carIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  vehicleHeading: {
    flex: 1,
  },
  vehicleNumber: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  vehicleModel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  details: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginRight: spacing.md,
  },
  detailValue: {
    ...typography.caption,
    color: colors.text,
    flexShrink: 1,
    textAlign: "right",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.round,
  },
  inProgressBadge: {
    backgroundColor: "#FFF1D6",
  },
  doneBadge: {
    backgroundColor: "#DDF5E5",
  },
  statusText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  actionButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  actionPressed: {
    opacity: 0.8,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    ...typography.bodyMedium,
    color: colors.white,
  },

  // Start time display
  startedTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  startedTimeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Modal popup styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  popupCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  popupIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  popupSuccessIcon: {
    backgroundColor: "#DCFCE7",
  },
  popupErrorIcon: {
    backgroundColor: "#FEE2E2",
  },
  popupTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  popupMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  popupButtons: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  popupButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  popupCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  popupConfirmButton: {
    backgroundColor: colors.primary,
  },
  popupCancelText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  popupConfirmText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});