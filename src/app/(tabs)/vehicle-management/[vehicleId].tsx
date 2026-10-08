import { ScrollView } from "../../../components/inputs/KeyboardAware";
import BackButton from "../../../components/navigation/BackButton";
import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import React, {
  useCallback,
  useMemo,
  useState,
} from "react";
import { ActivityIndicator, BackHandler, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import StageProgress from "./components/StageProgress";
import VehicleEvents from "./components/VehicleEvents";
import VehicleHeader from "./components/VehicleHeader";
import VehiclePhotos from "./components/VehiclePhotos";
import VehicleSummary from "./components/VehicleSummary";
import WorkCategoryStatus from "./components/WorkCategoryStatus";

import { supabase } from "../../../../lib/supabase";
import FullScreenPhotoViewer, {
  ViewerPhoto,
} from "../advisor/components/FullScreenPhotoViewer";

const COLORS = {
  red: "#C62828",
  redDark: "#9E1F1F",
  redSoft: "#FDECEC",
  charcoal: "#171717",
  charcoalSoft: "#292929",
  background: "#F5F5F3",
  white: "#FFFFFF",
  text: "#171717",
  textSecondary: "#6B6B6B",
  textMuted: "#999999",
  border: "#E7E5E2",
  green: "#16845B",
  greenSoft: "#EAF7F1",
  orange: "#D97706",
  orangeSoft: "#FFF4E5",
  yellow: "#A16207",
  yellowSoft: "#FFF9E5",
  graySoft: "#F0F0EE",
};

/*
 * COMPLETE VEHICLE LIFECYCLE
 *
 * IMPORTANT:
 * This array is used for the main progress percentage.
 *
 * The percentage ALWAYS tracks against the complete lifecycle
 * from Gate In to Gate Out.
 *
 * Example:
 * Gate In        = 10%
 * Advisor        = 20%
 * Survey         = 30%
 * Approval       = 40%
 * Floor          = 50%
 * Ready          = 60%
 * Final Inspection = 70%
 * Ready for Delivery = 80%
 * Gate Out Pending   = 90%
 * Gate Out           = 100%
 */
const STAGES = [
  "GATE_IN",
  "ADVISOR",
  "SURVEY",
  "APPROVAL",
  "FLOOR",
  "READY",
  "FINAL_INSPECTION",
  "READY_FOR_DELIVERY",
  "GATE_OUT_PENDING",
  "GATE_OUT",
];

const STAGE_LABELS: Record<string, string> = {
  GATE_IN: "Gate In",
  ADVISOR: "Advisor",
  SURVEY: "Survey",
  APPROVAL: "Approval",
  FLOOR: "Floor",
  READY: "Ready",
  FINAL_INSPECTION: "Final Inspection",
  READY_FOR_DELIVERY: "Ready for Delivery",
  GATE_OUT_PENDING: "Gate Out Pending",
  GATE_OUT: "Gate Out",
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
  vehicle_model_id: string | null;
  current_status: string;
  current_stage: string;
  current_assigned_to: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  stage_started_at: string | null;
};

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

type RelatedRow = Record<string, any>;

type PhotoItem = {
  id: string;
  uri: string;
  name?: string;
};

function formatDateTime(
  value: string | null | undefined
) {
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

function formatDate(
  value: string | null | undefined
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function prettyText(
  value: string | null | undefined
) {
  if (!value) return "—";

  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

/*
 * Normalize any known stage/status/event value.
 */
function normalizeStageValue(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (!normalized) return null;

  if (STAGES.includes(normalized)) {
    return normalized;
  }

  const aliases: Record<string, string> = {
    PENDING_ADVISOR: "ADVISOR",
    ADVISOR_ASSIGNED: "ADVISOR",

    SURVEY_PENDING: "SURVEY",

    APPROVAL_RECORDED: "APPROVAL",

    WORKSHOP: "FLOOR",

    COMPLETED: "GATE_OUT",
    COMPLETE: "GATE_OUT",
    DELIVERED: "GATE_OUT",
    DELIVERY_COMPLETED: "GATE_OUT",
    CLOSED: "GATE_OUT",
    CLOSED_JOB: "GATE_OUT",

    RETURN_REQUESTED: "GATE_OUT_PENDING",
    TOTAL_LOSS: "GATE_OUT_PENDING",
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  if (normalized === "GATE_IN") {
    return "GATE_IN";
  }

  if (normalized === "GATE_OUT") {
    return "GATE_OUT";
  }

  if (
    normalized === "SURVEY" ||
    normalized === "SURVEY_STARTED" ||
    normalized === "SURVEY_COMPLETED"
  ) {
    return "SURVEY";
  }

  if (
    normalized === "APPROVAL" ||
    normalized === "APPROVAL_RECORDED" ||
    normalized === "APPROVED" ||
    normalized === "REJECTED"
  ) {
    return "APPROVAL";
  }

  if (normalized === "FLOOR") {
    return "FLOOR";
  }

  if (
    normalized === "WORKSHOP" ||
    normalized === "WORKSHOP_STARTED" ||
    normalized === "WORKSHOP_COMPLETED"
  ) {
    return "FLOOR";
  }

  if (normalized === "READY") {
    return "READY";
  }

  if (
    normalized === "FINAL_INSPECTION" ||
    normalized === "FINAL_INSPECTION_COMPLETED"
  ) {
    return "FINAL_INSPECTION";
  }

  if (normalized === "READY_FOR_DELIVERY") {
    return "READY_FOR_DELIVERY";
  }

  if (
    normalized === "GATE_OUT_PENDING" ||
    normalized === "RETURN_REQUESTED" ||
    normalized === "TOTAL_LOSS"
  ) {
    return "GATE_OUT_PENDING";
  }

  if (normalized.includes("GATE_IN")) {
    return "GATE_IN";
  }

  if (normalized.includes("GATE_OUT_PENDING")) {
    return "GATE_OUT_PENDING";
  }

  if (normalized.includes("GATE_OUT")) {
    return "GATE_OUT";
  }

  if (normalized.includes("ADVISOR")) {
    return "ADVISOR";
  }

  if (normalized.includes("SURVEY")) {
    return "SURVEY";
  }

  if (normalized.includes("APPROVAL")) {
    return "APPROVAL";
  }

  if (normalized.includes("FINAL_INSPECTION")) {
    return "FINAL_INSPECTION";
  }

  if (normalized.includes("READY_FOR_DELIVERY")) {
    return "READY_FOR_DELIVERY";
  }

  if (normalized.includes("WORKSHOP")) {
    return "FLOOR";
  }

  if (normalized.includes("FLOOR")) {
    return "FLOOR";
  }

  if (normalized.includes("READY")) {
    return "READY";
  }

  return null;
}

/*
 * Collect stage evidence from a database row.
 */
function collectStagesFromRow(
  row: RelatedRow | null | undefined
): string[] {
  if (!row) return [];

  const values = [
    row.stage,
    row.current_stage,
    row.from_stage,
    row.to_stage,
    row.old_stage,
    row.new_stage,
    row.event_stage,
    row.event_type,
    row.type,
    row.action,
    row.field_name === "current_stage"
      ? row.old_value
      : null,
    row.field_name === "current_stage"
      ? row.new_value
      : null,
  ];

  const result = new Set<string>();

  values.forEach((value) => {
    const stage = normalizeStageValue(
      value == null ? null : String(value)
    );

    if (stage) {
      result.add(stage);
    }
  });

  return Array.from(result);
}

/*
 * Determine which stages actually have evidence.
 *
 * This is ONLY used for the Stage Progress timeline.
 *
 * It does NOT control the main percentage.
 */
function getRelevantStages(
  vehicle: Vehicle,
  events: RelatedRow[],
  history: RelatedRow[]
) {
  const reached = new Set<string>();

  const currentStage = normalizeStageValue(
    vehicle.current_stage
  );

  if (currentStage) {
    reached.add(currentStage);
  }

  const currentStatusStage =
    normalizeStageValue(
      vehicle.current_status
    );

  if (currentStatusStage) {
    reached.add(currentStatusStage);
  }

  events.forEach((event) => {
    collectStagesFromRow(event).forEach(
      (stage) => {
        reached.add(stage);
      }
    );
  });

  history.forEach((item) => {
    collectStagesFromRow(item).forEach(
      (stage) => {
        reached.add(stage);
      }
    );
  });

  const hasGateInEvent = events.some(
    (event) =>
      String(event.event_type || "")
        .trim()
        .toUpperCase() === "GATE_IN"
  );

  const hasGateOutEvent = events.some(
    (event) =>
      String(event.event_type || "")
        .trim()
        .toUpperCase() === "GATE_OUT"
  );

  if (hasGateInEvent) {
    reached.add("GATE_IN");
  }

  if (hasGateOutEvent) {
    reached.add("GATE_OUT");
  }

  if (
    currentStage === "GATE_OUT" &&
    reached.has("GATE_OUT") &&
    !reached.has("GATE_IN")
  ) {
    reached.add("GATE_IN");
  }

  return STAGES.filter((stage) =>
    reached.has(stage)
  );
}

/*
 * MAIN PROGRESS CALCULATION
 *
 * IMPORTANT:
 * This is intentionally based on ALL STAGES.
 */
function getVehicleProgressPercent(
  currentStage: string | null | undefined,
  currentStatus: string | null | undefined
) {
  let normalizedStage =
    normalizeStageValue(currentStage);

  /*
   * If the current stage itself is not available,
   * try the current status.
   */
  if (!normalizedStage) {
    normalizedStage =
      normalizeStageValue(currentStatus);
  }

  if (!normalizedStage) {
    return 0;
  }

  const stageIndex =
    STAGES.indexOf(normalizedStage);

  if (stageIndex === -1) {
    return 0;
  }

  const completedStageCount =
    stageIndex + 1;

  const percentage = Math.round(
    (completedStageCount /
      STAGES.length) *
      100
  );

  return Math.min(
    100,
    Math.max(0, percentage)
  );
}

function getPriority(
  vehicle: Vehicle
): "URGENT" | "HIGH" | "MEDIUM" | "LOW" {
  const startDate = new Date(
    vehicle.stage_started_at ||
      vehicle.created_at
  ).getTime();

  const diff = Math.max(
    0,
    Date.now() - startDate
  );

  const days = Math.floor(
    diff /
      (1000 * 60 * 60 * 24)
  );

  if (days >= 7) return "URGENT";
  if (days >= 4) return "HIGH";
  if (days >= 2) return "MEDIUM";

  return "LOW";
}

function isCompletedStatus(
  status: string | null | undefined
) {
  if (!status) return false;

  return [
    "completed",
    "complete",
    "delivered",
    "delivery_completed",
    "closed",
    "closed_job",
  ].includes(
    status.toLowerCase()
  );
}

function getPriorityColors(
  priority: string
) {
  switch (priority) {
    case "URGENT":
      return {
        background: "#FEE2E2",
        text: "#B91C1C",
      };

    case "HIGH":
      return {
        background: "#FFF4E5",
        text: "#C2410C",
      };

    case "MEDIUM":
      return {
        background: "#FFF9E5",
        text: "#A16207",
      };

    default:
      return {
        background: COLORS.graySoft,
        text: COLORS.textSecondary,
      };
  }
}

function getPhotoStoragePath(
  row: RelatedRow
) {
  return (
    row.storage_path ||
    row.path ||
    row.file_path ||
    row.photo_path ||
    row.storagePath ||
    null
  );
}

function getPhotoName(
  row: RelatedRow,
  index: number
) {
  return String(
    row.name ||
      row.file_name ||
      row.filename ||
      row.original_name ||
      `Photo ${index + 1}`
  );
}

export default function VehicleDetailsScreen() {
  const params =
    useLocalSearchParams<{
      vehicleId?: string | string[];
    }>();

  const vehicleId = Array.isArray(
    params.vehicleId
  )
    ? params.vehicleId[0]
    : params.vehicleId;

  /*
   * SAFE AREA
   *
   * Used for notch/status-bar and bottom
   * gesture-navigation spacing.
   */
  const insets = useSafeAreaInsets();

  const [vehicle, setVehicle] =
    useState<Vehicle | null>(null);

  const [assignedProfile, setAssignedProfile] =
    useState<Profile | null>(null);

  const [vehicleModel, setVehicleModel] =
    useState<RelatedRow | null>(null);

  const [jobs, setJobs] = useState<
    RelatedRow[]
  >([]);

  const [events, setEvents] = useState<
    RelatedRow[]
  >([]);

  const [history, setHistory] = useState<
    RelatedRow[]
  >([]);

  const [photos, setPhotos] = useState<
    PhotoItem[]
  >([]);

  const [floorProgress, setFloorProgress] =
    useState<RelatedRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [viewerVisible, setViewerVisible] =
    useState(false);

  const [viewerIndex, setViewerIndex] =
    useState(0);

  /*
   * Explicit parent route.
   *
   * Vehicle Details is opened from:
   *
   * /(tabs)/vehicle-management
   *
   * Therefore Back should always return there.
   */
  const goBackToVehicleManagement =
    useCallback(() => {
      router.replace(
        "/(tabs)/vehicle-management"
      );
    }, []);

  const loadVehicle = useCallback(
    async (isRefresh = false) => {
      if (!vehicleId) {
        setError(
          "Vehicle ID is missing."
        );
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        /*
         * VEHICLE
         */
        const {
          data: loadedVehicle,
          error: vehicleError,
        } = await supabase
          .from("vehicles")
          .select("*")
          .eq("id", vehicleId)
          .maybeSingle();

        if (vehicleError) {
          throw vehicleError;
        }

        if (!loadedVehicle) {
          setVehicle(null);
          setError(
            "Vehicle not found."
          );
          return;
        }

        setVehicle(
          loadedVehicle as Vehicle
        );

        /*
         * ASSIGNED PROFILE
         */
        const assignedTo =
          loadedVehicle.current_assigned_to;

        if (assignedTo) {
          const {
            data: profileData,
          } = await supabase
            .from("profiles")
            .select(
              "id,name,phone,role,is_active"
            )
            .eq("id", assignedTo)
            .maybeSingle();

          setAssignedProfile(
            (profileData as Profile | null) ||
              null
          );
        } else {
          setAssignedProfile(null);
        }

        /*
         * VEHICLE MODEL
         */
        if (
          loadedVehicle.vehicle_model_id
        ) {
          const { data: modelData } =
            await supabase
              .from("vehicle_models")
              .select("*")
              .eq(
                "id",
                loadedVehicle.vehicle_model_id
              )
              .maybeSingle();

          setVehicleModel(
            modelData || null
          );
        } else {
          setVehicleModel(null);
        }

        /*
         * RELATED DATA
         */
        const [
          jobsResult,
          eventsResult,
          historyResult,
          photosResult,
          floorResult,
        ] = await Promise.all([
          supabase
            .from("vehicle_jobs")
            .select("*")
            .eq(
              "vehicle_id",
              vehicleId
            )
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("vehicle_events")
            .select("*")
            .eq(
              "vehicle_id",
              vehicleId
            )
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("vehicle_history")
            .select("*")
            .eq(
              "vehicle_id",
              vehicleId
            )
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("vehicle_photos")
            .select("*")
            .eq(
              "vehicle_id",
              vehicleId
            ),

          supabase
            .from("floor_work_progress")
            .select("*")
            .eq(
              "vehicle_id",
              vehicleId
            )
            .order("updated_at", {
              ascending: false,
            }),
        ]);

        /*
         * JOBS
         */
        if (jobsResult.error) {
          console.error(
            "Vehicle jobs load error:",
            jobsResult.error
          );
        }

        setJobs(
          (jobsResult.data ||
            []) as RelatedRow[]
        );

        /*
         * EVENTS
         */
        if (eventsResult.error) {
          console.error(
            "Vehicle events load error:",
            eventsResult.error
          );
        }

        setEvents(
          (eventsResult.data ||
            []) as RelatedRow[]
        );

        /*
         * HISTORY
         */
        if (historyResult.error) {
          console.error(
            "Vehicle history load error:",
            historyResult.error
          );
        }

        setHistory(
          (historyResult.data ||
            []) as RelatedRow[]
        );

        /*
         * FLOOR PROGRESS
         */
        if (floorResult.error) {
          console.error(
            "Floor work progress load error:",
            floorResult.error
          );

          setFloorProgress([]);
        } else {
          setFloorProgress(
            (floorResult.data ||
              []) as RelatedRow[]
          );
        }

        /*
         * VEHICLE PHOTOS
         */
        if (photosResult.error) {
          console.error(
            "Vehicle photos load error:",
            photosResult.error
          );

          setPhotos([]);
        } else {
          const rawPhotos =
            (photosResult.data ||
              []) as RelatedRow[];

          const photoResults: Array<
            PhotoItem | null
          > = await Promise.all(
            rawPhotos.map(
              async (
                photo,
                index
              ): Promise<
                PhotoItem | null
              > => {
                const storagePath =
                  getPhotoStoragePath(
                    photo
                  );

                if (!storagePath) {
                  console.warn(
                    "Vehicle photo has no storage path:",
                    photo
                  );

                  return null;
                }

                const {
                  data: signedData,
                  error: signedUrlError,
                } =
                  await supabase.storage
                    .from(
                      "vehicle-photos"
                    )
                    .createSignedUrl(
                      String(
                        storagePath
                      ),
                      60 * 60
                    );

                if (
                  signedUrlError ||
                  !signedData?.signedUrl
                ) {
                  console.error(
                    "Vehicle photo signed URL error:",
                    signedUrlError
                  );

                  return null;
                }

                return {
                  id: String(
                    photo.id ??
                      index
                  ),
                  uri:
                    signedData.signedUrl,
                  name:
                    getPhotoName(
                      photo,
                      index
                    ),
                };
              }
            )
          );

          const resolvedPhotos =
            photoResults.filter(
              (
                photo
              ): photo is PhotoItem =>
                photo !== null
            );

          setPhotos(
            resolvedPhotos
          );
        }
      } catch (err: any) {
        console.error(
          "Vehicle details load error:",
          err
        );

        setError(
          err?.message ||
            "Unable to load vehicle details. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [vehicleId]
  );

  /*
   * Reload whenever this screen gets focus.
   */
  useFocusEffect(
    useCallback(() => {
      loadVehicle(false);
    }, [loadVehicle])
  );

  /*
   * ANDROID HARDWARE BACK
   *
   * Priority:
   *
   * 1. Photo viewer open -> close viewer.
   * 2. Otherwise -> Vehicle Management.
   *
   * This prevents the default router history from
   * jumping directly back to Home.
   */
  useFocusEffect(
    useCallback(() => {
      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          () => {
            if (viewerVisible) {
              setViewerVisible(false);
              return true;
            }

            goBackToVehicleManagement();
            return true;
          }
        );

      return () =>
        subscription.remove();
    }, [
      viewerVisible,
      goBackToVehicleManagement,
    ])
  );

  const currentStage =
    vehicle?.current_stage || "";

  const normalizedCurrentStage =
    normalizeStageValue(
      currentStage
    );

  const priority = useMemo(() => {
    if (!vehicle) return "LOW";

    return getPriority(vehicle);
  }, [vehicle]);

  const priorityColors =
    getPriorityColors(priority);

  const currentJob =
    jobs.length > 0
      ? jobs[0]
      : null;

  const previousJobs =
    jobs.length > 1
      ? jobs.slice(1)
      : [];

  /*
   * ACTUAL STAGE EVIDENCE
   */
  const relevantStages =
    useMemo(() => {
      if (!vehicle) return [];

      return getRelevantStages(
        vehicle,
        events,
        history
      );
    }, [
      vehicle,
      events,
      history,
    ]);

  /*
   * MAIN VEHICLE PROGRESS
   */
  const progressPercent =
    useMemo(() => {
      if (!vehicle) return 0;

      return getVehicleProgressPercent(
        vehicle.current_stage,
        vehicle.current_status
      );
    }, [vehicle]);

  const viewerPhotos: ViewerPhoto[] =
    useMemo(
      () =>
        photos.map((photo) => ({
          uri: photo.uri,
          id: photo.id,
          name: photo.name,
        })),
      [photos]
    );

  const openPhoto = (
    index: number
  ) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  /*
   * LOADING
   */
  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={[
          "top",
          "bottom",
          "left",
          "right",
        ]}
      >
        <View style={styles.centerState}>
          <ActivityIndicator
            size="large"
            color={COLORS.red}
          />

          <Text
            style={styles.loadingText}
          >
            Loading vehicle...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * VEHICLE NOT FOUND
   */
  if (!vehicle) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={[
          "top",
          "bottom",
          "left",
          "right",
        ]}
      >
        <View style={styles.centerState}>
          <View
            style={styles.errorIcon}
          >
            <Ionicons
              name="car-outline"
              size={34}
              color={COLORS.red}
            />
          </View>

          <Text
            style={styles.errorTitle}
          >
            Vehicle Not Found
          </Text>

          <Text
            style={
              styles.errorMessage
            }
          >
            {error ||
              "This vehicle could not be loaded."}
          </Text>

          <BackButton onPress={
              goBackToVehicleManagement
            } />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        "top",
        "bottom",
        "left",
        "right",
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              24 + insets.bottom,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadVehicle(true)
            }
            tintColor={COLORS.red}
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* Header */}
        <VehicleHeader
          vehicleNumber={
            vehicle.vehicle_no
          }
          priority={priority}
          onBack={
            goBackToVehicleManagement
          }
        />

        {/* Current Stage Hero */}
        <View
          style={styles.stageHero}
        >
          <View
            style={
              styles.stageHeroTop
            }
          >
            <View
              style={styles.stageIcon}
            >
              <Ionicons
                name="git-branch-outline"
                size={22}
                color={COLORS.white}
              />
            </View>

            <View
              style={
                styles.stageHeroInfo
              }
            >
              <Text
                style={
                  styles.stageHeroLabel
                }
              >
                CURRENT STAGE
              </Text>

              <Text
                style={
                  styles.stageHeroTitle
                }
              >
                {prettyText(
                  currentStage
                )}
              </Text>
            </View>

            <Text
              style={
                styles.progressPercentage
              }
            >
              {progressPercent}%
            </Text>
          </View>

          <View
            style={
              styles.progressTrack
            }
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(
                    4,
                    progressPercent
                  )}%`,
                },
              ]}
            />
          </View>

          <View
            style={
              styles.stageHeroBottom
            }
          >
            <Text
              style={
                styles.stageHeroMeta
              }
            >
              Started{" "}
              {formatDateTime(
                vehicle.stage_started_at ||
                  vehicle.updated_at
              )}
            </Text>

            <Text
              style={
                styles.stageHeroMeta
              }
            >
              {isCompletedStatus(
                vehicle.current_status
              )
                ? "Completed"
                : "In Progress"}
            </Text>
          </View>
        </View>

        {/* Summary */}
        <VehicleSummary
          vehicle={vehicle}
          assignedProfile={
            assignedProfile
          }
          vehicleModel={
            vehicleModel
          }
          currentJob={currentJob}
          priority={priority}
        />

        {/* Stage Progress */}
        <StageProgress
          relevantStages={
            relevantStages
          }
          normalizedCurrentStage={
            normalizedCurrentStage
          }
        />

        {/* Work / Category Status */}
        <WorkCategoryStatus
          floorProgress={
            floorProgress
          }
        />

        {/* Vehicle Photos */}
        <VehiclePhotos
          photos={photos}
          onPhotoPress={openPhoto}
        />

        {/* Events / History */}
        <VehicleEvents
          events={events}
          history={history}
        />

        {/* Previous Job Cards */}
        <SectionCard
          title="Previous Job Cards"
          icon="documents-outline"
        >
          {previousJobs.length >
          0 ? (
            <View
              style={
                styles.previousJobList
              }
            >
              {previousJobs.map(
                (
                  job,
                  index
                ) => (
                  <View
                    key={String(
                      job.id ||
                        index
                    )}
                    style={
                      styles.previousJobRow
                    }
                  >
                    <View
                      style={
                        styles.previousJobIcon
                      }
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color={
                          COLORS.red
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.previousJobInfo
                      }
                    >
                      <Text
                        style={
                          styles.previousJobTitle
                        }
                      >
                        {job.jc_no ||
                          job.job_card_no ||
                          job.id ||
                          `Job Card ${
                            index + 1
                          }`}
                      </Text>

                      <Text
                        style={
                          styles.previousJobMeta
                        }
                      >
                        {prettyText(
                          job.status
                        )}{" "}
                        •{" "}
                        {formatDate(
                          job.created_at
                        )}
                      </Text>
                    </View>
                  </View>
                )
              )}
            </View>
          ) : (
            <EmptySection
              text="No previous job cards available."
            />
          )}
        </SectionCard>

        {/* Remarks */}
        {vehicle.remarks ? (
          <SectionCard
            title="Remarks"
            icon="chatbox-ellipses-outline"
          >
            <View
              style={
                styles.remarksBox
              }
            >
              <Text
                style={
                  styles.remarksText
                }
              >
                {vehicle.remarks}
              </Text>
            </View>
          </SectionCard>
        ) : null}

        <View
          style={[
            styles.bottomSpace,
            {
              height:
                20 + insets.bottom,
            },
          ]}
        />
      </ScrollView>

      {/* Full Screen Photo Viewer */}
      <FullScreenPhotoViewer
        visible={
          viewerVisible
        }
        photos={
          viewerPhotos
        }
        initialIndex={
          viewerIndex
        }
        onClose={() =>
          setViewerVisible(
            false
          )
        }
        editable={false}
      />
    </SafeAreaView>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <View
      style={styles.summaryItem}
    >
      <View
        style={styles.summaryIcon}
      >
        <Ionicons
          name={icon}
          size={17}
          color={COLORS.red}
        />
      </View>

      <Text
        style={styles.summaryLabel}
      >
        {label}
      </Text>

      <Text
        numberOfLines={1}
        style={styles.summaryValue}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

function SectionCard({
  title,
  icon,
  rightText,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  rightText?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={styles.sectionCard}
    >
      <View
        style={
          styles.sectionHeader
        }
      >
        <View
          style={
            styles.sectionTitleArea
          }
        >
          <View
            style={
              styles.sectionIcon
            }
          >
            <Ionicons
              name={icon}
              size={18}
              color={COLORS.red}
            />
          </View>

          <Text
            style={
              styles.sectionTitle
            }
          >
            {title}
          </Text>
        </View>

        {rightText ? (
          <Text
            style={
              styles.sectionRightText
            }
          >
            {rightText}
          </Text>
        ) : null}
      </View>

      <View
        style={styles.sectionBody}
      >
        {children}
      </View>
    </View>
  );
}

function InfoGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <View
      style={styles.infoGrid}
    >
      {children}
    </View>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <View
      style={styles.infoItem}
    >
      <Text
        style={styles.infoLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.infoValue}
      >
        {value
          ? prettyText(value)
          : "—"}
      </Text>
    </View>
  );
}

function EmptySection({
  text,
}: {
  text: string;
}) {
  return (
    <View
      style={styles.emptySection}
    >
      <Ionicons
        name="information-circle-outline"
        size={21}
        color={
          COLORS.textMuted
        }
      />

      <Text
        style={
          styles.emptySectionText
        }
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  errorIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      COLORS.redSoft,
    marginBottom: 16,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.charcoal,
    marginBottom: 7,
  },

  errorMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },

  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor:
      COLORS.red,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  headerTextArea: {
    flex: 1,
  },

  headerEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: COLORS.red,
    marginBottom: 2,
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.charcoal,
  },

  priorityBadge: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  priorityText: {
    fontSize: 10,
    fontWeight: "900",
  },

  stageHero: {
    backgroundColor:
      COLORS.charcoal,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  stageHeroTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  stageIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor:
      COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  stageHeroInfo: {
    flex: 1,
  },

  stageHeroLabel: {
    fontSize: 9,
    color:
      "rgba(255,255,255,0.55)",
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 3,
  },

  stageHeroTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.white,
  },

  progressPercentage: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.white,
  },

  progressTrack: {
    height: 7,
    backgroundColor:
      "rgba(255,255,255,0.12)",
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 16,
  },

  progressFill: {
    height: "100%",
    backgroundColor:
      COLORS.red,
    borderRadius: 5,
  },

  stageHeroBottom: {
    marginTop: 9,
    flexDirection: "row",
    justifyContent:
      "space-between",
  },

  stageHeroMeta: {
    fontSize: 10,
    color:
      "rgba(255,255,255,0.55)",
    fontWeight: "600",
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
    marginBottom: 7,
  },

  summaryItem: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 10,
  },

  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor:
      COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },

  summaryLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "700",
    marginBottom: 2,
  },

  summaryValue: {
    fontSize: 13,
    color: COLORS.charcoal,
    fontWeight: "800",
  },

  sectionCard: {
    backgroundColor:
      COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    marginBottom: 12,
    overflow: "hidden",
  },

  sectionHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  sectionTitleArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor:
      COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.charcoal,
  },

  sectionRightText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "700",
  },

  sectionBody: {
    padding: 14,
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },

  infoItem: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 14,
  },

  infoLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "700",
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 18,
  },

  assignmentCard: {
    flexDirection: "row",
    alignItems: "center",
  },

  assignmentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor:
      COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  assignmentInfo: {
    flex: 1,
  },

  assignmentName: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.charcoal,
    marginBottom: 3,
  },

  assignmentRole: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  assignmentPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },

  noteBox: {
    backgroundColor:
      COLORS.graySoft,
    borderRadius: 10,
    padding: 11,
    marginTop: 3,
  },

  noteLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "800",
    marginBottom: 4,
  },

  noteText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.text,
    fontWeight: "600",
  },

  timeline: {
    paddingVertical: 2,
  },

  timelineItem: {
    flexDirection: "row",
    minHeight: 58,
  },

  timelineRail: {
    width: 34,
    alignItems: "center",
  },

  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor:
      COLORS.graySoft,
    borderWidth: 2,
    borderColor:
      COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  timelineDotCompleted: {
    backgroundColor:
      COLORS.green,
    borderColor:
      COLORS.green,
  },

  timelineDotCurrent: {
    backgroundColor:
      COLORS.red,
    borderColor:
      COLORS.red,
  },

  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor:
      COLORS.white,
  },

  timelineLine: {
    position: "absolute",
    top: 24,
    bottom: -1,
    width: 2,
    backgroundColor:
      COLORS.border,
  },

  timelineLineCompleted: {
    backgroundColor:
      COLORS.green,
  },

  timelineContent: {
    flex: 1,
    marginLeft: 9,
    paddingBottom: 14,
    paddingTop: 2,
  },

  timelineContentCurrent: {
    backgroundColor:
      COLORS.redSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },

  timelineTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "700",
  },

  timelineTitleCurrent: {
    color: COLORS.red,
    fontWeight: "900",
  },

  timelineStatus: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "600",
  },

  categoryList: {
    gap: 2,
  },

  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
  },

  categoryStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  categoryStatusDone: {
    backgroundColor:
      COLORS.greenSoft,
  },

  categoryStatusPending: {
    backgroundColor:
      COLORS.orangeSoft,
  },

  categoryInfo: {
    flex: 1,
  },

  categoryName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "800",
  },

  categoryStatus: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "600",
  },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  photoThumbnail: {
    width: 78,
    height: 78,
    borderRadius: 11,
    backgroundColor:
      COLORS.graySoft,
    overflow: "hidden",
    borderWidth: 1,
    borderColor:
      COLORS.border,
  },

  photoThumbnailPressed: {
    opacity: 0.7,
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  photoThumbnailImage: {
    width: "100%",
    height: "100%",
  },

  photoThumbnailOverlay: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor:
      "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  noPhotos: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
  },

  noPhotosText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
  },

  eventList: {
    gap: 0,
  },

  eventRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
  },

  eventDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor:
      COLORS.red,
    marginTop: 5,
    marginRight: 10,
  },

  eventInfo: {
    flex: 1,
  },

  eventTitle: {
    fontSize: 13,
    color: COLORS.charcoal,
    fontWeight: "800",
  },

  eventDate: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginTop: 3,
  },

  eventDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginTop: 5,
  },

  previousJobList: {
    gap: 8,
  },

  previousJobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 9,
    backgroundColor:
      COLORS.graySoft,
    borderRadius: 11,
  },

  previousJobIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor:
      COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  previousJobInfo: {
    flex: 1,
  },

  previousJobTitle: {
    fontSize: 13,
    color: COLORS.charcoal,
    fontWeight: "900",
  },

  previousJobMeta: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 3,
    fontWeight: "600",
  },

  remarksBox: {
    backgroundColor:
      COLORS.graySoft,
    borderRadius: 12,
    padding: 12,
  },

  remarksText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.text,
    fontWeight: "600",
  },

  emptySection: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  emptySectionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
  },

  buttonPressed: {
    opacity: 0.7,
  },

  bottomSpace: {
    height: 20,
  },
});