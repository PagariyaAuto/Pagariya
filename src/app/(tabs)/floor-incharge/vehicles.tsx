import { Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import Ionicons from "@expo/vector-icons/Ionicons";

import * as ImagePicker from "expo-image-picker";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { useCallback, useRef, useState } from "react";

import { ActivityIndicator, Image, RefreshControl, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";

import { colors } from "../../../theme";

type FloorWorkItem = {
  id: string;

  work_code: string;

  work_name: string;

  status: string;

  started_at?: string | null;

  started_by?: string | null;

  completed_at?: string | null;

  completed_by?: string | null;

  remarks?: string | null;
};

type FloorCycle = {
  id: string;

  cycle_no: number;

  vehicle_in_at?: string | null;
};

type SupplementaryCycle = {
  id: string;

  cycle_no: number;

  status: string;

  reason: string;

  requested_at?: string | null;

  returned_to_floor_at?: string | null;

  continued_without_supplementary_at?: string | null;
};

type VehicleItem = {
  visit_id: string;

  vehicle_id: string;

  vehicle_no: string;

  model: string | null;

  current_stage: string;

  current_status: string;

  job_id: string | null;

  job_type: string | null;

  floor_entered_at?: string | null;

  floor_cycle: FloorCycle | null;

  floor_items: FloorWorkItem[] | null;

  supplementary: SupplementaryCycle | null;
};

type FloorQueue = {
  role: string;

  items: VehicleItem[];
};

type Message = {
  title: string;
  body: string;
  type?: "success" | "error" | "info";
  confirm?: () => void;
  onClose?: () => void;
};

const labels: Record<string, string> = {
  FLOOR: "Floor",

  FINAL_INSPECTION: "Final Inspection",

  PENDING: "Pending",

  IN_PROGRESS: "In progress",

  COMPLETED: "Completed",

  STRIPPING: "Stripping",

  FINAL_INSPECTION_REWORK: "Final Inspection Rework",

  STOPPED_FOR_SUPPLEMENTARY: "Stopped for supplementary",

  RETURNED_TO_FLOOR: "Returned to Floor",

  CONTINUED_WITHOUT_SUPPLEMENTARY: "Continued without supplementary",

  APPROVED: "Approved",

  SUPPLEMENTARY_SURVEY: "Supplementary Survey",

  SUPPLEMENTARY_APPROVAL: "Supplementary Approval",

  ADVISOR_WORK: "Advisor Work",

  STORE: "Store",
};

function label(value?: string | null) {
  if (!value) {
    return "—";
  }

  return labels[value] || value.replaceAll("_", " ");
}

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

export default function FloorInchargeVehicleScreen() {
  const handleNavigationBack = () => {
    if (busy) return;
    returnToRoute("/(tabs)/floor-incharge");
  };
  useHardwareBack(handleNavigationBack);

  const params = useLocalSearchParams<{
    visitId?: string | string[];
  }>();

  const visitId =
    (Array.isArray(params.visitId)
      ? params.visitId[0]
      : params.visitId
    )?.trim() || "";

  const [item, setItem] = useState<VehicleItem | null>(null);
  const [supplementaryStage, setSupplementaryStage] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState<Message | null>(null);

  const [supplementaryOpen, setSupplementaryOpen] = useState(false);

  const [reason, setReason] = useState("");

  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [viewer, setViewer] = useState<string | null>(null);

  const uploaded = useRef<{
    uri: string;

    path: string;
  } | null>(null);

  const submitting = useRef(false);

  const fetchVehicle = useCallback(async (): Promise<VehicleItem | null> => {
    if (!visitId) {
      throw new Error("Vehicle visit was not provided.");
    }

    /*



     * Backend queue security is authoritative.



     *



     * A Floor Incharge receives only vehicles



     * actively assigned to their account.



     */

    const { data, error: queueError } = await supabase.rpc(
      "new_workflow_supplementary_queue",

      {
        p_floor: true,
      },
    );

    if (queueError) {
      throw queueError;
    }

    const queue = data as FloorQueue;

    const selected = queue.items?.find((row) => row.visit_id === visitId);

    if (!selected) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user)
        throw new Error("Your session has expired. Please sign in again.");
      const [assignment, visit, cycle] = await Promise.all([
        supabase
          .from("vehicle_assignments")
          .select("id")
          .eq("visit_id", visitId)
          .eq("assigned_to", user.id)
          .eq("assignment_role", "FLOOR_INCHARGE")
          .is("unassigned_at", null)
          .limit(1),
        supabase
          .from("workshop_visits")
          .select("current_stage,closed_at")
          .eq("id", visitId)
          .maybeSingle(),
        supabase
          .from("supplementary_cycles")
          .select("status")
          .eq("visit_id", visitId)
          .order("cycle_no", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (assignment.error) throw assignment.error;
      if (visit.error) throw visit.error;
      if (cycle.error) throw cycle.error;
      if (
        assignment.data?.length &&
        visit.data &&
        !visit.data.closed_at &&
        cycle.data &&
        !["RETURNED_TO_FLOOR", "CONTINUED_WITHOUT_SUPPLEMENTARY"].includes(
          cycle.data.status,
        ) &&
        [
          "SUPPLEMENTARY_SURVEY",
          "SUPPLEMENTARY_APPROVAL",
          "APPROVAL_HOLD",
          "CLAIM_REJECTED",
          "ADVISOR_WORK",
          "STORE",
        ].includes(visit.data.current_stage)
      ) {
        setSupplementaryStage(visit.data.current_stage);
        return null;
      }
      setSupplementaryStage(null);
      throw new Error(
        "This vehicle is no longer assigned to you or is no longer available in the Floor queue.",
      );
    }
    setSupplementaryStage(null);

    const { data: visit, error: visitError } = await supabase

      .from("workshop_visits")

      .select("stage_started_at,current_stage,current_status")

      .eq("id", visitId)

      .single();

    if (visitError) {
      throw visitError;
    }

    return {
      ...selected,

      current_stage: visit.current_stage ?? selected.current_stage,

      current_status: visit.current_status ?? selected.current_status,

      floor_entered_at:
        visit.stage_started_at ?? selected.floor_cycle?.vehicle_in_at ?? null,
    };
  }, [visitId]);

  const load = useCallback(
    async (refresh = false) => {
      if (!visitId) {
        setItem(null);
        setLoading(false);
        setRefreshing(false);
        setError(
          "Select a vehicle from My Assigned Vehicles to open Floor details.",
        );
        return;
      }
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const selected = await fetchVehicle();

        setItem(selected);
      } catch (e: any) {
        console.error("Failed to load Floor vehicle:", e);

        const body = e?.message || "Unable to load this Floor vehicle.";

        setError(body);

        setMessage({
          title: "Unable to load vehicle",

          body,

          type: "error",
        });
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },

    [fetchVehicle, visitId],
  );

  useFocusEffect(
    useCallback(() => {
      if (!visitId) {
        router.replace("/(tabs)/floor-incharge" as never);
        return undefined;
      }
      void load();

      return undefined;
    }, [load, visitId]),
  );

  const choosePhoto = async (camera: boolean) => {
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        throw new Error(
          camera
            ? "Camera permission is required."
            : "Photo-library permission is required.",
        );
      }

      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],

            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],

            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);

        uploaded.current = null;
      }
    } catch (e: any) {
      setMessage({
        title: "Unable to select photo",

        body: e?.message || "Photo selection failed.",

        type: "error",
      });
    }
  };

  const uploadDiscoveryPhoto = async () => {
    if (!item || !photoUri) {
      return null;
    }

    if (uploaded.current?.uri === photoUri) {
      return uploaded.current.path;
    }

    const path =
      `vehicles/${item.vehicle_id}` +
      `/SUPPLEMENTARY/${item.visit_id}` +
      `/DISCOVERY/${Date.now()}-` +
      `${Math.random().toString(36).slice(2)}.jpg`;

    const response = await fetch(photoUri);

    const bytes = await response.arrayBuffer();

    const { error: uploadError } = await supabase.storage

      .from("vehicle-photos")

      .upload(path, bytes, {
        contentType: "image/jpeg",

        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Supplementary photo upload failed: ${uploadError.message}`,
      );
    }

    uploaded.current = {
      uri: photoUri,

      path,
    };

    return path;
  };

  const perform = async (
    operation: string,

    args: Record<string, unknown>,

    uploadPhoto = false,

    leaveFloorAfterSuccess = false,
  ) => {
    if (!item || busy || submitting.current) {
      return;
    }

    submitting.current = true;

    setBusy(true);

    try {
      /*



       * Re-read the authoritative Floor queue



       * immediately before mutation.



       *



       * This also confirms the vehicle is still



       * assigned to this Floor Incharge.



       */

      const current = await fetchVehicle();
      if (!current) {
        setItem(null);
        return;
      }

      if (
        current.current_stage !== item.current_stage ||
        current.current_status !== item.current_status ||
        current.floor_cycle?.id !== item.floor_cycle?.id
      ) {
        throw new Error("The vehicle has changed. Refresh before continuing.");
      }

      const nextArgs = {
        ...args,
      };

      if (uploadPhoto) {
        nextArgs.p_photo_path = await uploadDiscoveryPhoto();
      }

      const { error: saveError } = await supabase.rpc(operation, nextArgs);

      if (saveError) {
        throw saveError;
      }

      setReason("");

      setPhotoUri(null);

      setSupplementaryOpen(false);

      uploaded.current = null;

      if (operation === "new_workflow_request_supplementary") {
        setSupplementaryStage("SUPPLEMENTARY_SURVEY");
        setItem(null);
        return;
      }

      /*



       * Once Floor is completed, the vehicle



       * leaves this assigned Floor queue.



       *



       * Do not attempt to reload it through



       * the Floor queue after that transition.



       */

      if (leaveFloorAfterSuccess) {
        setMessage({
          title: "Floor Work Completed",
          body: "Floor work is complete. The vehicle is now at Final Inspection and is pending Final Inspector assignment.",
          type: "success",
          onClose: () => {
            router.replace("/(tabs)/floor-incharge" as never);
          },
        });

        return;
      }

      await load();

      setMessage({
        title: "Saved",
        body: "The Floor workflow has been updated successfully.",
        type: "success",
      });
    } catch (e: any) {
      setMessage({
        title: "Unable to save",

        body: e?.message || "Refresh and try again.",

        type: "error",
      });
    } finally {
      submitting.current = false;

      setBusy(false);
    }
  };

  const confirm = (
    title: string,

    body: string,

    operation: string,

    args: Record<string, unknown>,

    uploadPhoto = false,

    leaveFloorAfterSuccess = false,
  ) => {
    setMessage({
      title,

      body,

      confirm: () => {
        setMessage(null);

        void perform(operation, args, uploadPhoto, leaveFloorAfterSuccess);
      },
    });
  };

  const prepareFloor = async () => {
    if (!item) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage({
        title: "Unable to continue",

        body: "You must be logged in.",

        type: "error",
      });

      return;
    }

    confirm(
      "Prepare Floor cycle?",

      "This will create the Floor cycle using only the work approved for this vehicle.",

      "new_workflow_prepare_floor",

      {
        p_visit_id: item.visit_id,

        p_floor_incharge_id: user.id,
      },
    );
  };

  if (loading && !item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.muted}>Loading Floor vehicle…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item && supplementaryStage) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Ionicons
              name="pause-circle-outline"
              size={42}
              color={colors.primary}
            />
            <Text style={styles.title}>Vehicle sent for Supplementary</Text>
            <Text style={styles.eyebrow}>FLOOR WORK PAUSED</Text>
            <Text style={styles.body}>
              Current stage: {label(supplementaryStage)}
            </Text>
            <Text style={styles.body}>
              The additional repair request is being processed. Completed Floor
              work is preserved. After Supplementary approval and any required
              parts processing, the vehicle will return to Floor so you can
              resume unfinished work.
            </Text>
            <Text style={styles.muted}>
              If the request is rejected, the Advisor must resolve it before
              work can continue. Final Inspection remains mandatory after Floor
              work.
            </Text>
            <ActionButton
              title={refreshing ? "Checking status…" : "Refresh status"}
              disabled={refreshing || busy}
              onPress={() => void load(true)}
            />
            <BackButton onPress={() => router.replace("/(tabs)/floor-incharge" as never)} accessibilityLabel="Back to My Floor Vehicles" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.error}>{error || "Vehicle unavailable."}</Text>

            <BackButton onPress={() => router.replace("/(tabs)/floor-incharge" as never)} accessibilityLabel="Back to My Floor Vehicles" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /*



   * floor_items is vehicle-specific.



   *



   * new_workflow_prepare_floor creates



   * these rows from approval_work_scope.



   */

  const work = item.floor_items ?? [];

  const completed = work.filter((row) => row.status === "COMPLETED").length;

  const stripping = work.find((row) => row.work_code === "STRIPPING");

  const strippingComplete = stripping?.status === "COMPLETED";
  const isPaid =
    String(item.job_type ?? "")
      .trim()
      .toUpperCase() === "PAID";
  const canWorkWithoutStripping = isPaid && !stripping;

  const reworkItem = work.find(
    (row) => row.work_code === "FINAL_INSPECTION_REWORK",
  );

  const isFinalInspectionRework =
    work.length > 0 &&
    work.every((row) => row.work_code === "FINAL_INSPECTION_REWORK");

  const reworkReason =
    reworkItem?.remarks?.trim() ||
    "Final Inspection requested rectification before the vehicle can proceed.";

  const activeWork = work.filter((row) => row.status === "IN_PROGRESS");

  const allComplete =
    !!work.length && work.every((row) => row.status === "COMPLETED");

  const floorActive = item.current_stage === "FLOOR";

  const canPrepare = floorActive && !item.floor_cycle;

  const canRaiseSupplementary =
    floorActive &&
    item.current_status === "IN_PROGRESS" &&
    activeWork.length > 0;

  const vehicleAwayFromFloor = item.current_stage !== "FLOOR";

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "right", "bottom", "left"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* TOP BAR */}

      <View style={styles.topBar}>
        <BackButton onPress={handleNavigationBack} disabled={busy} hitSlop={8} />

        <BrandPill />
      </View>

      {busy && (
        <View style={styles.saving}>
          <ActivityIndicator color={colors.primary} />

          <Text style={styles.muted}>Saving Floor workflow…</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* HERO */}

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>MY ASSIGNED FLOOR JOB</Text>

          <Text style={styles.vehicleNo}>{item.vehicle_no}</Text>

          <Text style={styles.heroSub}>
            {item.model || "Model not recorded"}

            {item.job_type ? ` · ${label(item.job_type)}` : ""}
          </Text>

          <View style={styles.heroStats}>
            <HeroStat
              title="Cycle"
              value={
                item.floor_cycle ? `#${item.floor_cycle.cycle_no}` : "Pending"
              }
            />

            <View style={styles.heroDivider} />

            <HeroStat
              title="Floor time"
              value={elapsed(item.floor_entered_at)}
            />

            <View style={styles.heroDivider} />

            <HeroStat
              title={isFinalInspectionRework ? "Rework" : "Approved Work"}
              value={work.length ? `${completed}/${work.length}` : "—"}
            />
          </View>
        </View>

        {/* FLOOR PREPARATION */}

        {canPrepare && (
          <View style={styles.actionCard}>
            <Text style={styles.eyebrow}>ACTION REQUIRED</Text>

            <Text style={styles.title}>Prepare Floor Cycle</Text>

            <Text style={styles.body}>
              Create the Floor checklist using only the repair work approved for
              this vehicle.
            </Text>

            <ActionButton
              title="Prepare Floor Cycle"
              disabled={busy}
              onPress={() => void prepareFloor()}
            />
          </View>
        )}

        {/* VEHICLE OUTSIDE FLOOR */}

        {vehicleAwayFromFloor && (
          <View style={styles.awayCard}>
            <View style={styles.awayIcon}>
              <Ionicons
                name="hourglass-outline"
                size={23}
                color={colors.primary}
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.eyebrow}>VEHICLE OUTSIDE FLOOR</Text>

              <Text style={styles.title}>{label(item.current_stage)}</Text>

              <Text style={styles.body}>
                This vehicle is not currently actionable on Floor. It will
                return to the Floor queue only if the workflow sends it back for
                further work.
              </Text>
            </View>
          </View>
        )}

        {/* FINAL INSPECTION REWORK */}

        {isFinalInspectionRework && floorActive && (
          <View style={styles.reworkCard}>
            <View style={styles.reworkIcon}>
              <Ionicons name="build-outline" size={24} color={colors.error} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.reworkEyebrow}>FINAL INSPECTION FAILED</Text>

              <Text style={styles.reworkTitle}>Rectification required</Text>

              <Text style={styles.reworkText}>{reworkReason}</Text>

              <Text style={styles.reworkHint}>
                This is a dedicated rework cycle. Stripping is not required.
                Complete the rectification below and return the vehicle to Final
                Inspection.
              </Text>
            </View>
          </View>
        )}

        {/* FLOOR WORK / REWORK SCOPE */}

        {!!item.floor_cycle && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.eyebrow}>
                  {isFinalInspectionRework
                    ? "FINAL INSPECTION REWORK"
                    : "APPROVED FLOOR WORK"}
                </Text>

                <Text style={styles.title}>
                  {isFinalInspectionRework
                    ? "Rework Checklist"
                    : "Vehicle Checklist"}
                </Text>

                <Text style={styles.body}>
                  {isFinalInspectionRework
                    ? "Complete the rectification requested by Final Inspection. Stripping is not required for this rework cycle."
                    : canWorkWithoutStripping
                      ? "Complete the selected approved repair work. Stripping is not included for this Paid job. Final Inspection is mandatory after Floor completion."
                      : "Complete the approved repair work. When Stripping is included, complete it before other work. Final Inspection is mandatory after Floor completion."}
                </Text>
              </View>

              <View style={styles.countPill}>
                <Text style={styles.countText}>
                  {completed}/{work.length}
                </Text>
              </View>
            </View>

            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,

                max: work.length || 1,

                now: completed,
              }}
            >
              <View
                style={[
                  styles.fill,

                  {
                    width: `${
                      work.length ? (completed / work.length) * 100 : 0
                    }%`,
                  },
                ]}
              />
            </View>

            {!work.length && (
              <View style={styles.warningCard}>
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color={colors.error}
                />

                <Text style={styles.warningText}>
                  No approved Floor work items were created for this cycle.
                  Refresh or contact CEO Admin.
                </Text>
              </View>
            )}

            {work.map((workItem, index) => {
              const pending = workItem.status === "PENDING";

              const active = workItem.status === "IN_PROGRESS";

              const done = workItem.status === "COMPLETED";

              const stopped = workItem.status === "STOPPED_FOR_SUPPLEMENTARY";

              const isReworkItem =
                workItem.work_code === "FINAL_INSPECTION_REWORK";

              /*

               * Paid cycles without Stripping may start selected repair work directly.

               * Final Inspection rework is the explicit exception.

               */

              const canStart =
                floorActive &&
                pending &&
                (workItem.work_code === "STRIPPING" ||
                  isReworkItem ||
                  canWorkWithoutStripping ||
                  strippingComplete);

              const canComplete = floorActive && active;

              return (
                <View key={workItem.id} style={styles.workRow}>
                  <View
                    style={[
                      styles.marker,

                      done && styles.markerDone,

                      active && styles.markerActive,

                      stopped && styles.markerStopped,
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={18} color="#217A50" />
                    ) : stopped ? (
                      <Ionicons name="pause" size={16} color={colors.primary} />
                    ) : (
                      <Text style={styles.markerText}>{index + 1}</Text>
                    )}
                  </View>

                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <View style={styles.workTitleRow}>
                      <Text style={styles.workName}>{workItem.work_name}</Text>

                      <Text
                        style={[
                          styles.status,

                          done && styles.statusDone,

                          active && styles.statusActive,

                          stopped && styles.statusStopped,
                        ]}
                      >
                        {label(workItem.status)}
                      </Text>
                    </View>

                    {workItem.started_at && (
                      <Text style={styles.meta}>
                        Started: {formatDateTime(workItem.started_at)}
                      </Text>
                    )}

                    {workItem.completed_at && (
                      <Text style={styles.meta}>
                        Completed: {formatDateTime(workItem.completed_at)}
                      </Text>
                    )}

                    {!!workItem.remarks && (
                      <Text style={styles.workRemarks}>{workItem.remarks}</Text>
                    )}

                    {canStart && (
                      <ActionButton
                        title={`Start ${workItem.work_name}`}
                        secondary
                        disabled={busy}
                        onPress={() => {
                          /*



                           * Stripping keeps its dedicated



                           * RPC because Supplementary



                           * discovery depends on it.



                           */

                          if (workItem.work_code === "STRIPPING") {
                            confirm(
                              "Start stripping?",

                              "Stripping will begin for this vehicle. If additional repair scope is discovered during stripping, you can raise Supplementary.",

                              "new_workflow_start_stripping",

                              {
                                p_visit_id: item.visit_id,
                              },
                            );

                            return;
                          }

                          confirm(
                            `Start ${workItem.work_name}?`,

                            isReworkItem
                              ? "This Final Inspection rework item will be marked In Progress. Stripping is not required for this rectification cycle."
                              : "This approved Floor work item will be marked In Progress.",

                            "new_workflow_start_floor_item",

                            {
                              p_floor_item_id: workItem.id,
                            },
                          );
                        }}
                      />
                    )}

                    {canComplete && (
                      <ActionButton
                        title={`Complete ${workItem.work_name}`}
                        disabled={busy}
                        onPress={() =>
                          confirm(
                            `Complete ${workItem.work_name}?`,

                            "This work item will be recorded as completed against your Floor account with the current timestamp.",

                            "new_workflow_complete_floor_item",

                            {
                              p_floor_item_id: workItem.id,

                              p_remarks: null,
                            },
                          )
                        }
                      />
                    )}

                    {pending &&
                      workItem.work_code !== "STRIPPING" &&
                      !isReworkItem &&
                      !canWorkWithoutStripping &&
                      !strippingComplete && (
                        <View style={styles.lockedRow}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={14}
                            color={colors.textSecondary}
                          />

                          <Text style={styles.locked}>
                            Complete Stripping first
                          </Text>
                        </View>
                      )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* STRIPPING / SUPPLEMENTARY */}

        {canRaiseSupplementary && (
          <View style={styles.suppCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.suppIcon}>
                <Ionicons
                  name="search-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.eyebrow}>FLOOR WORK IN PROGRESS</Text>

                <Text style={styles.title}>Additional work discovered?</Text>

                <Text style={styles.body}>
                  If no additional work is found, complete the active work and
                  continue with the approved checklist. Raise Supplementary only
                  when additional repair scope is actually discovered.
                </Text>
              </View>
            </View>

            <ActionButton
              title={
                supplementaryOpen
                  ? "Close Supplementary Request"
                  : "Raise Supplementary"
              }
              secondary
              disabled={busy}
              onPress={() => setSupplementaryOpen((current) => !current)}
            />

            {supplementaryOpen && (
              <>
                <View style={styles.divider} />

                <Text style={styles.fieldLabel}>
                  Additional work / damage discovered *
                </Text>

                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  editable={!busy}
                  placeholder="Describe the additional damage or repair work discovered during Floor work"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, styles.multiline]}
                />

                <Text style={styles.fieldLabel}>
                  Discovery Photo (optional)
                </Text>

                <Text style={styles.fieldHint}>
                  Add a photo when it helps document the additional damage.
                </Text>

                {photoUri && (
                  <TouchableOpacity onPress={() => setViewer(photoUri)}>
                    <Image
                      source={{
                        uri: photoUri,
                      }}
                      style={styles.preview}
                    />
                  </TouchableOpacity>
                )}

                <View style={styles.photoButtons}>
                  <MiniButton
                    title="Camera"
                    icon="camera-outline"
                    disabled={busy}
                    onPress={() => void choosePhoto(true)}
                  />

                  <MiniButton
                    title="Choose Photo"
                    icon="images-outline"
                    disabled={busy}
                    onPress={() => void choosePhoto(false)}
                  />
                </View>

                {photoUri && (
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => {
                      setPhotoUri(null);

                      uploaded.current = null;
                    }}
                  >
                    <Text style={styles.removePhoto}>
                      Remove selected photo
                    </Text>
                  </TouchableOpacity>
                )}

                <ActionButton
                  title="Pause Floor Work & Send to Supplementary"
                  disabled={busy || !reason.trim()}
                  onPress={() =>
                    confirm(
                      "Raise Supplementary?",

                      "Active Floor work will pause and the vehicle will move to Supplementary Survey. Completed work remains preserved; unfinished work resumes after the Supplementary decision is resolved.",

                      "new_workflow_request_supplementary",

                      {
                        p_visit_id: item.visit_id,

                        p_reason: reason.trim(),
                      },

                      true,
                    )
                  }
                />
              </>
            )}
          </View>
        )}

        {/* RETURNED FROM SUPPLEMENTARY */}

        {item.supplementary && item.current_stage === "FLOOR" && (
          <View style={styles.returnCard}>
            <View style={styles.returnIcon}>
              <Ionicons
                name="return-down-back-outline"
                size={24}
                color="#217A50"
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.returnEyebrow}>
                SUPPLEMENTARY CYCLE {item.supplementary.cycle_no}
              </Text>

              <Text style={styles.returnTitle}>Vehicle returned to Floor</Text>

              <Text style={styles.body}>
                {item.supplementary.reason ||
                  "Supplementary processing is complete and Floor work can continue."}
              </Text>

              <Text style={styles.returnStatus}>
                {label(item.supplementary.status)}
              </Text>
            </View>
          </View>
        )}

        {/* FLOOR COMPLETE */}

        {allComplete && (
          <View style={styles.completeCard}>
            <View style={styles.completeIcon}>
              <Ionicons name="checkmark-circle" size={31} color="#217A50" />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.completeEyebrow}>FLOOR WORK COMPLETE</Text>

              <Text style={styles.completeTitle}>
                {isFinalInspectionRework
                  ? "Final Inspection rework completed"
                  : "Approved Floor work completed"}
              </Text>

              <Text style={styles.completeText}>
                {isFinalInspectionRework
                  ? `The required rectification for Floor cycle ${item.floor_cycle?.cycle_no} is complete. The vehicle can now return to Final Inspection.`
                  : `All ${work.length} approved ${work.length === 1 ? "work item" : "work items"} for Floor cycle ${item.floor_cycle?.cycle_no} are complete.`}
              </Text>

              <View style={styles.nextStageCard}>
                <View style={styles.nextStageIcon}>
                  <Ionicons
                    name="clipboard-outline"
                    size={21}
                    color={colors.primary}
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text style={styles.nextStageLabel}>NEXT WORKFLOW STAGE</Text>

                  <Text style={styles.nextStageValue}>Final Inspection</Text>

                  <Text style={styles.nextStageDescription}>
                    Close this Floor cycle and move the vehicle to Final
                    Inspection. It will wait there until a Final Inspector is
                    explicitly assigned.
                  </Text>
                </View>
              </View>

              <ActionButton
                title={
                  isFinalInspectionRework
                    ? "Complete Rework & Return to Final Inspection"
                    : "Complete Floor & Send for Final Inspector Assignment"
                }
                disabled={busy}
                onPress={() =>
                  confirm(
                    isFinalInspectionRework
                      ? "Return vehicle to Final Inspection?"
                      : "Complete Floor and move to Final Inspection?",

                    isFinalInspectionRework
                      ? "The required rework is complete. This will close the current Floor rework cycle and return the vehicle to mandatory Final Inspection as Pending Assignment. The assigned Advisor or CEO Admin must assign a Final Inspector before the next inspection attempt."
                      : "All approved Floor work is complete. This will close the current Floor cycle and move the vehicle to mandatory Final Inspection as Pending Assignment. The assigned Advisor or CEO Admin must assign a Final Inspector before inspection begins.",

                    "new_workflow_complete_floor_cycle",

                    {
                      p_visit_id: item.visit_id,

                      p_remarks: null,
                    },

                    false,

                    true,
                  )
                }
              />
            </View>
          </View>
        )}

        {/* CURRENT ACTIVITY */}

        {!!activeWork.length && !allComplete && (
          <View style={styles.infoCard}>
            <Ionicons
              name="construct-outline"
              size={21}
              color={colors.primary}
            />

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.infoTitle}>Work currently in progress</Text>

              <Text style={styles.infoText}>
                {activeWork.map((row) => row.work_name).join(", ")}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* CONFIRMATION / MESSAGE */}

      <Modal
        visible={!!message}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (busy) return;
          const onClose = message?.onClose;
          setMessage(null);
          onClose?.();
        }}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.dialog}>
            <View
              style={[
                styles.dialogIcon,

                {
                  backgroundColor:
                    message?.type === "success"
                      ? "#E8F5EE"
                      : message?.type === "error"
                        ? colors.dangerLight
                        : message?.confirm
                          ? "#FFF6DD"
                          : colors.primaryLight,
                },
              ]}
            >
              <Ionicons
                name={
                  message?.type === "success"
                    ? "checkmark"
                    : message?.type === "error"
                      ? "alert-circle-outline"
                      : message?.confirm
                        ? "help-circle-outline"
                        : "information-circle-outline"
                }
                size={28}
                color={
                  message?.type === "success"
                    ? "#217A50"
                    : message?.type === "error"
                      ? colors.error
                      : colors.primary
                }
              />
            </View>

            <Text style={styles.dialogTitle}>{message?.title}</Text>

            <Text style={styles.dialogBody}>{message?.body}</Text>

            {message?.confirm ? (
              <>
                <ActionButton
                  title="Confirm"
                  disabled={busy}
                  onPress={message.confirm}
                />

                <ActionButton
                  title="Cancel"
                  secondary
                  disabled={busy}
                  onPress={() => setMessage(null)}
                />
              </>
            ) : (
              <ActionButton
                title="OK"
                onPress={() => {
                  const onClose = message?.onClose;
                  setMessage(null);
                  onClose?.();
                }}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* PHOTO VIEWER */}

      <Modal
        visible={!!viewer}
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <SafeAreaView style={styles.viewer}>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewer(null)}
          >
            <Ionicons name="close" size={25} color="#FFFFFF" />

            <Text style={styles.viewerCloseText}>Close</Text>
          </TouchableOpacity>

          {viewer && (
            <Image
              source={{
                uri: viewer,
              }}
              resizeMode="contain"
              style={styles.viewerImage}
            />
          )}
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
}: {
  title: string;

  onPress: () => void;

  disabled?: boolean;

  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.84}
      style={[
        styles.button,

        secondary && styles.buttonSecondary,

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

function MiniButton({
  title,

  icon,

  onPress,

  disabled = false,
}: {
  title: string;

  icon: keyof typeof Ionicons.glyphMap;

  onPress: () => void;

  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[styles.miniButton, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />

      <Text style={styles.miniText}>{title}</Text>
    </TouchableOpacity>
  );
}

function HeroStat({
  title,

  value,
}: {
  title: string;

  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
      }}
    >
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>

      <Text style={styles.statLabel}>{title}</Text>
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

  saving: {
    paddingVertical: 11,

    paddingHorizontal: 16,

    backgroundColor: "#FFF1F2",

    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    gap: 8,
  },

  hero: {
    padding: 20,

    borderRadius: 18,

    backgroundColor: "#F20D1D",

    gap: 9,
  },

  heroLabel: {
    alignSelf: "flex-start",

    color: "#FFFFFF",

    backgroundColor: "rgba(255,255,255,.16)",

    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 999,

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 1,
  },

  vehicleNo: {
    color: "#FFFFFF",

    fontSize: 28,

    fontWeight: "900",
  },

  heroSub: {
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

  statValue: {
    color: "#FFFFFF",

    fontSize: 16,

    fontWeight: "900",
  },

  statLabel: {
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

    gap: 14,
  },

  actionCard: {
    padding: 18,

    borderRadius: 17,

    backgroundColor: "#FFF9F9",

    borderWidth: 1,

    borderColor: "#FDE5E7",

    gap: 12,
  },

  awayCard: {
    padding: 17,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 11,
  },

  awayIcon: {
    width: 43,

    height: 43,

    borderRadius: 13,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  sectionHeader: {
    flexDirection: "row",

    alignItems: "flex-start",

    gap: 11,
  },

  eyebrow: {
    color: colors.primary,

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 0.9,
  },

  title: {
    marginTop: 3,

    color: colors.text,

    fontSize: 18,

    fontWeight: "800",
  },

  body: {
    marginTop: 5,

    color: colors.textSecondary,

    fontSize: 12,

    lineHeight: 19,
  },

  countPill: {
    paddingHorizontal: 10,

    paddingVertical: 7,

    borderRadius: 10,

    backgroundColor: colors.primaryLight,
  },

  countText: {
    color: colors.primaryDark,

    fontSize: 12,

    fontWeight: "900",
  },

  track: {
    height: 6,

    borderRadius: 3,

    backgroundColor: "#F0F1F3",

    overflow: "hidden",
  },

  fill: {
    height: 6,

    borderRadius: 3,

    backgroundColor: colors.primary,
  },

  warningCard: {
    padding: 12,

    borderRadius: 12,

    backgroundColor: colors.dangerLight,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 8,
  },

  warningText: {
    flex: 1,

    color: colors.error,

    fontSize: 12,

    lineHeight: 18,
  },

  workRow: {
    paddingTop: 14,

    borderTopWidth: 1,

    borderTopColor: "#F0F1F3",

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 11,
  },

  marker: {
    width: 34,

    height: 34,

    borderRadius: 11,

    backgroundColor: colors.background,

    alignItems: "center",

    justifyContent: "center",
  },

  markerDone: {
    backgroundColor: "#E8F5EE",
  },

  markerActive: {
    backgroundColor: "#EFF6FF",
  },

  markerStopped: {
    backgroundColor: colors.primaryLight,
  },

  markerText: {
    color: colors.textSecondary,

    fontWeight: "800",
  },

  workTitleRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    flexWrap: "wrap",

    gap: 8,
  },

  workName: {
    color: colors.text,

    fontSize: 15,

    fontWeight: "800",
  },

  status: {
    color: "#946200",

    backgroundColor: "#FFF6DD",

    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 8,

    fontSize: 10,

    fontWeight: "800",
  },

  statusDone: {
    color: "#217A50",

    backgroundColor: "#E8F5EE",
  },

  statusActive: {
    color: "#2563EB",

    backgroundColor: "#EFF6FF",
  },

  statusStopped: {
    color: colors.primaryDark,

    backgroundColor: colors.primaryLight,
  },

  meta: {
    marginTop: 5,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  workRemarks: {
    marginTop: 7,

    padding: 8,

    borderRadius: 9,

    backgroundColor: colors.background,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  lockedRow: {
    marginTop: 9,

    flexDirection: "row",

    alignItems: "center",

    gap: 5,
  },

  locked: {
    color: colors.textSecondary,

    fontSize: 11,

    fontWeight: "700",
  },

  button: {
    marginTop: 10,

    minHeight: 48,

    paddingHorizontal: 15,

    borderRadius: 12,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",
  },

  buttonSecondary: {
    backgroundColor: colors.primaryLight,

    borderWidth: 1,

    borderColor: "#FDE5E7",
  },

  buttonText: {
    color: "#FFFFFF",

    fontSize: 13,

    fontWeight: "800",

    textAlign: "center",
  },

  buttonSecondaryText: {
    color: colors.primaryDark,
  },

  disabled: {
    opacity: 0.45,
  },

  suppCard: {
    padding: 18,

    borderRadius: 17,

    backgroundColor: "#FFF9F9",

    borderWidth: 1,

    borderColor: "#FDE5E7",

    gap: 13,
  },

  suppIcon: {
    width: 42,

    height: 42,

    borderRadius: 13,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  divider: {
    height: 1,

    backgroundColor: colors.border,
  },

  fieldLabel: {
    color: colors.text,

    fontSize: 13,

    fontWeight: "800",
  },

  fieldHint: {
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

    backgroundColor: colors.surface,

    fontSize: 14,
  },

  multiline: {
    minHeight: 100,

    textAlignVertical: "top",
  },

  preview: {
    width: "100%",

    height: 180,

    borderRadius: 12,
  },

  photoButtons: {
    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,
  },

  miniButton: {
    paddingHorizontal: 12,

    minHeight: 44,

    borderRadius: 11,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "center",

    gap: 7,
  },

  miniText: {
    color: colors.primary,

    fontSize: 12,

    fontWeight: "800",
  },

  removePhoto: {
    color: colors.error,

    fontSize: 12,

    fontWeight: "700",
  },

  reworkCard: {
    padding: 17,

    borderRadius: 17,

    backgroundColor: "#FFF5F5",

    borderWidth: 1,

    borderColor: "#F3C8CB",

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 11,
  },

  reworkIcon: {
    width: 44,

    height: 44,

    borderRadius: 13,

    backgroundColor: colors.dangerLight,

    alignItems: "center",

    justifyContent: "center",
  },

  reworkEyebrow: {
    color: colors.error,

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.8,
  },

  reworkTitle: {
    marginTop: 3,

    color: colors.text,

    fontSize: 16,

    fontWeight: "900",
  },

  reworkText: {
    marginTop: 6,

    padding: 10,

    borderRadius: 10,

    backgroundColor: colors.surface,

    color: colors.text,

    fontSize: 12,

    lineHeight: 19,

    fontWeight: "700",
  },

  reworkHint: {
    marginTop: 7,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  returnCard: {
    padding: 17,

    borderRadius: 17,

    backgroundColor: "#F4FBF7",

    borderWidth: 1,

    borderColor: "#CDE9DA",

    flexDirection: "row",

    gap: 11,
  },

  returnIcon: {
    width: 44,

    height: 44,

    borderRadius: 13,

    backgroundColor: "#E8F5EE",

    alignItems: "center",

    justifyContent: "center",
  },

  returnEyebrow: {
    color: "#217A50",

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.8,
  },

  returnTitle: {
    marginTop: 3,

    color: colors.text,

    fontSize: 16,

    fontWeight: "800",
  },

  returnStatus: {
    alignSelf: "flex-start",

    marginTop: 9,

    paddingHorizontal: 9,

    paddingVertical: 5,

    borderRadius: 8,

    backgroundColor: "#E8F5EE",

    color: "#217A50",

    fontSize: 10,

    fontWeight: "800",
  },

  completeCard: {
    padding: 18,

    borderRadius: 17,

    backgroundColor: "#F4FBF7",

    borderWidth: 1,

    borderColor: "#CDE9DA",

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 12,
  },

  completeIcon: {
    width: 48,

    height: 48,

    borderRadius: 15,

    backgroundColor: "#E8F5EE",

    alignItems: "center",

    justifyContent: "center",
  },

  completeEyebrow: {
    color: "#217A50",

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.9,
  },

  completeTitle: {
    marginTop: 3,

    color: colors.text,

    fontSize: 17,

    fontWeight: "900",
  },

  completeText: {
    marginTop: 5,

    color: colors.textSecondary,

    fontSize: 12,

    lineHeight: 19,
  },

  nextStageCard: {
    marginTop: 14,

    padding: 13,

    borderRadius: 13,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,

    borderColor: "#DCEFE4",

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 10,
  },

  nextStageIcon: {
    width: 40,

    height: 40,

    borderRadius: 12,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  nextStageLabel: {
    color: colors.primary,

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.8,
  },

  nextStageValue: {
    marginTop: 2,

    color: colors.text,

    fontSize: 14,

    fontWeight: "900",
  },

  nextStageDescription: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  infoCard: {
    padding: 15,

    borderRadius: 15,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 10,
  },

  infoTitle: {
    color: colors.text,

    fontSize: 13,

    fontWeight: "800",
  },

  infoText: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 18,
  },

  error: {
    color: colors.error,

    fontSize: 13,

    lineHeight: 20,
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

  viewer: {
    flex: 1,

    padding: 12,

    backgroundColor: "#0F172A",
  },

  viewerClose: {
    minHeight: 46,

    flexDirection: "row",

    alignItems: "center",

    gap: 5,
  },

  viewerCloseText: {
    color: "#FFFFFF",

    fontWeight: "700",
  },

  viewerImage: {
    flex: 1,

    width: "100%",
  },
});
