import { ScrollView } from "../../../components/inputs/KeyboardAware";
import BackButton from "../../../components/navigation/BackButton";
import { returnToRoute, useHardwareBack, singleParam } from "../../../lib/back-navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { colors } from "../../../theme";

type Inspection = {
  inspection_no: number;

  inspected_at: string | null;

  inspected_by_name: string | null;

  result: string | null;

  failure_reason: string | null;

  remarks: string | null;
};

type FloorCycle = {
  cycle_no: number;

  status: string;

  vehicle_in_at: string | null;

  vehicle_out_at: string | null;

  floor_incharge_name: string | null;

  remarks: string | null;

  is_rework: boolean;
};

type VehicleDetails = {
  visit_id: string;

  vehicle_id: string;

  vehicle_no: string | null;

  model: string | null;

  customer_name: string | null;

  current_stage: string;

  current_status: string;

  stage_started_at: string | null;

  assigned_to: string | null;

  assigned_to_name: string | null;

  job_type: string | null;
};

type DetailsResponse = {
  role: string;

  can_assign: boolean;

  vehicle: VehicleDetails;

  inspections: Inspection[];

  floor_cycles: FloorCycle[];
};

type TimelineItem =
  | {
      key: string;

      type: "INSPECTION";

      timestamp: string | null;

      inspection: Inspection;
    }
  | {
      key: string;

      type: "REWORK";

      timestamp: string | null;

      cycle: FloorCycle;
    };

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return (
    date.toLocaleString("en-IN", {
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
    return "—";
  }

  const start = new Date(value).getTime();

  if (!Number.isFinite(start) || start > Date.now()) {
    return "—";
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
    const remainingMinutes = minutes % 60;

    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;

  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatJobType(value?: string | null) {
  if (!value) {
    return "—";
  }

  if (value === "PAID") {
    return "Paid Job";
  }

  if (value === "INSURANCE") {
    return "Insurance Job";
  }

  return value.replaceAll("_", " ");
}

function formatStage(value?: string | null) {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timestampValue(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function getOperationalState(vehicle: VehicleDetails) {
  if (vehicle.current_stage === "FINAL_INSPECTION") {
    if (!vehicle.assigned_to) {
      return {
        label: "Pending Assignment",

        description:
          "Waiting for the assigned Advisor or CEO Admin to assign a Final Inspector.",

        icon: "person-add-outline" as const,

        tone: "warning" as const,
      };
    }

    if (vehicle.current_status === "IN_PROGRESS") {
      return {
        label: "Inspection In Progress",

        description: `${
          vehicle.assigned_to_name || "Final Inspector"
        } is currently handling this inspection.`,

        icon: "clipboard-outline" as const,

        tone: "active" as const,
      };
    }

    return {
      label: "Pending Inspection",

      description: `${
        vehicle.assigned_to_name || "Final Inspector"
      } is assigned and the vehicle is waiting for inspection.`,

      icon: "time-outline" as const,

      tone: "pending" as const,
    };
  }

  if (vehicle.current_stage === "ADVISOR_BILLING") {
    return {
      label: "Advisor Billing preparation",
      description:
        "Final Inspection passed. The Advisor will complete verification or Insurance steps, then assign a Billing Executive.",
      icon: "person-circle-outline" as const,
      tone: "pending" as const,
    };
  }

  if (vehicle.current_stage === "BILLING") {
    return {
      label: "Moved to Billing",

      description:
        "Final Inspection passed and the vehicle has progressed to Billing.",

      icon: "receipt-outline" as const,

      tone: "success" as const,
    };
  }

  if (vehicle.current_stage === "FLOOR") {
    return {
      label: "Returned to Floor Rework",

      description:
        "Final Inspection failed and the vehicle has returned to Floor for rectification.",

      icon: "construct-outline" as const,

      tone: "danger" as const,
    };
  }

  return {
    label: formatStage(vehicle.current_stage),

    description: `Current workflow status: ${formatStage(
      vehicle.current_status,
    )}.`,

    icon: "information-circle-outline" as const,

    tone: "neutral" as const,
  };
}

export default function FinalInspectionDetailsScreen() {
  const navigationParams = useLocalSearchParams<{ returnTo?: string | string[]; returnVisitId?: string | string[]; floor?: string | string[]; filter?: string | string[] }>();
  const handleNavigationBack = () => {
    const origin = singleParam(navigationParams.returnTo);
    const id = singleParam(params.visitId);
    if (origin === "billing" && id) {
      returnToRoute({ pathname: "/(tabs)/advisor/billing", params: { returnVisitId: id } });
    } else if (origin === "ready-for-delivery" && id) {
      returnToRoute({ pathname: "/(tabs)/advisor/ready-for-delivery", params: { returnVisitId: id } });
    } else {
      returnToRoute("/(tabs)/advisor/final_inspection");
    }
  };
  useHardwareBack(handleNavigationBack);

  const params = useLocalSearchParams<{
    visitId?: string | string[];
  }>();

  const visitId = Array.isArray(params.visitId)
    ? params.visitId[0]
    : params.visitId;

  const [data, setData] = useState<DetailsResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const loadRequest = useRef(0);

  const load = useCallback(
    async (refresh = false) => {
      const request = ++loadRequest.current;
      if (!visitId) {
        setData(null);
        setRefreshing(false);
        setLoading(false);

        setError("Final Inspection visit information is missing.");

        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setData(null);
        setLoading(true);
      }

      setError("");

      try {
        const {
          data: response,

          error: detailsError,
        } = await supabase.rpc("new_workflow_final_inspection_details", {
          p_visit_id: visitId,
        });

        if (detailsError) {
          throw detailsError;
        }

        const result = response as DetailsResponse;

        if (
          !result ||
          !result.vehicle ||
          !Array.isArray(result.inspections) ||
          !Array.isArray(result.floor_cycles)
        ) {
          throw new Error(
            "Final Inspection details returned an invalid response.",
          );
        }

        if (!["advisor", "ceo_admin"].includes(result.role)) {
          throw new Error(
            "You are not authorized to view Final Inspection details.",
          );
        }

        if (request === loadRequest.current) setData(result);
      } catch (e: any) {
        if (request !== loadRequest.current) return;
        console.error("Final Inspection details load error:", e);

        setError(e?.message || "Unable to load Final Inspection details.");
        setData(null);
      } finally {
        if (request === loadRequest.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [visitId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();

      return () => {
        loadRequest.current += 1;
      };
    }, [load]),
  );

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!data) {
      return [];
    }

    const inspections: TimelineItem[] = data.inspections.map((inspection) => ({
      key: `inspection-${inspection.inspection_no}`,

      type: "INSPECTION",

      timestamp: inspection.inspected_at,

      inspection,
    }));

    const rework: TimelineItem[] = data.floor_cycles
      .filter((cycle) => cycle.is_rework)
      .map((cycle) => ({
        key: `rework-${cycle.cycle_no}`,

        type: "REWORK",

        timestamp: cycle.vehicle_in_at,

        cycle,
      }));

    return [...inspections, ...rework].sort(
      (a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp),
    );
  }, [data]);

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.loadingText}>
            Loading Final Inspection details…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data || error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />

        <View style={styles.errorWrap}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="alert-circle-outline"
              size={30}
              color={colors.error}
            />
          </View>

          <Text style={styles.errorTitle}>Details unavailable</Text>

          <Text style={styles.errorText}>
            {error || "Unable to load Final Inspection details."}
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => void load()}
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>

          <BackButton onPress={handleNavigationBack} />
        </View>
      </SafeAreaView>
    );
  }

  const vehicle = data.vehicle;

  const latestInspection = data.inspections[0] || null;

  const reworkCycles = data.floor_cycles.filter((cycle) => cycle.is_rework);

  const operationalState = getOperationalState(vehicle);

  const latestFailed = latestInspection?.result === "FAILED";

  const latestPassed = latestInspection?.result === "PASSED";

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "right", "bottom", "left"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <BackButton onPress={handleNavigationBack} accessibilityLabel="Back to Final Inspection" />

          <View
            style={{
              flex: 1,
            }}
          >
            <Text style={styles.eyebrow}>FINAL INSPECTION</Text>

            <Text style={styles.headerTitle}>Vehicle Details</Text>
          </View>

          <TouchableOpacity
            onPress={() => void load(true)}
            disabled={refreshing}
            style={styles.refreshButton}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={20}
                color={colors.primary}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* VEHICLE + CURRENT STATE */}

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="car-sport-outline"
                size={27}
                color={colors.primary}
              />
            </View>

            <View style={styles.vehicleIdentity}>
              <Text style={styles.vehicleNo}>
                {vehicle.vehicle_no || "Vehicle"}
              </Text>

              <Text style={styles.vehicleModel}>
                {vehicle.model || "Model not recorded"}
              </Text>

              <Text style={styles.customerName}>
                {vehicle.customer_name || "Customer not recorded"}
              </Text>
            </View>
          </View>

          <OperationalStateCard state={operationalState} />

          <View style={styles.summaryGrid}>
            <SummaryMetric
              icon="clipboard-outline"
              label="Attempts"
              value={String(data.inspections.length)}
            />

            <SummaryMetric
              icon="construct-outline"
              label="Rework Cycles"
              value={String(reworkCycles.length)}
            />

            <SummaryMetric
              icon="person-outline"
              label="Inspector"
              value={vehicle.assigned_to_name || "Not assigned"}
            />

            <SummaryMetric
              icon="time-outline"
              label="Current Stage Time"
              value={elapsed(vehicle.stage_started_at)}
            />
          </View>
        </View>

        {/* WORKFLOW TRAIL */}

        <View style={styles.workflowCard}>
          <Text style={styles.eyebrow}>WORKFLOW</Text>

          <Text style={styles.sectionTitle}>Current Journey</Text>

          <View style={styles.workflowTrail}>
            <WorkflowNode icon="construct-outline" label="Floor" completed />

            <WorkflowArrow />

            <WorkflowNode
              icon="search-outline"
              label="Final Inspection"
              active={vehicle.current_stage === "FINAL_INSPECTION"}
              completed={vehicle.current_stage === "BILLING" || latestPassed}
              danger={vehicle.current_stage === "FLOOR" && latestFailed}
            />

            <WorkflowArrow />

            <WorkflowNode
              icon="person-circle-outline"
              label="Advisor preparation"
              active={vehicle.current_stage === "ADVISOR_BILLING"}
              completed={vehicle.current_stage === "BILLING"}
            />

            <WorkflowArrow />

            <WorkflowNode
              icon="receipt-outline"
              label="Billing"
              active={vehicle.current_stage === "BILLING"}
            />
          </View>

          {vehicle.current_stage === "FLOOR" && latestFailed && (
            <View style={styles.reworkTrailNotice}>
              <Ionicons
                name="return-down-back-outline"
                size={18}
                color={"#946200"}
              />

              <Text style={styles.reworkTrailText}>
                Final Inspection failed. Vehicle is currently in Floor Rework
                and will return for another inspection.
              </Text>
            </View>
          )}
        </View>

        {/* ACCESS NOTICE */}

        <View
          style={[
            styles.accessStrip,

            data.can_assign ? styles.adminAccess : styles.advisorAccess,
          ]}
        >
          <Ionicons
            name={data.can_assign ? "shield-checkmark-outline" : "eye-outline"}
            size={18}
            color={data.can_assign ? "#217A50" : colors.primaryDark}
          />

          <Text style={styles.accessStripText}>
            {data.can_assign
              ? `${data.role === "advisor" ? "Advisor · you can assign inspectors to your own vehicles" : "CEO Admin · you can assign inspectors to all eligible vehicles"}. Assignment is managed from the Final Inspection queue.`
              : "View inspection results and rework history. Assignment is unavailable for this vehicle."}
          </Text>
        </View>

        {/* LATEST RESULT */}

        <View
          style={[
            styles.latestCard,

            latestPassed && styles.latestPassCard,

            latestFailed && styles.latestFailCard,
          ]}
        >
          <View style={styles.latestHeader}>
            <View>
              <Text style={styles.eyebrow}>LATEST INSPECTION</Text>

              <Text style={styles.sectionTitle}>
                {latestInspection
                  ? `Attempt ${latestInspection.inspection_no}`
                  : "Awaiting First Inspection"}
              </Text>
            </View>

            {latestInspection && (
              <View
                style={[
                  styles.resultBadge,

                  latestPassed
                    ? styles.resultBadgePass
                    : styles.resultBadgeFail,
                ]}
              >
                <Ionicons
                  name={latestPassed ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={latestPassed ? "#217A50" : colors.error}
                />

                <Text
                  style={[
                    styles.resultBadgeText,

                    latestPassed
                      ? styles.resultPassText
                      : styles.resultFailText,
                  ]}
                >
                  {latestInspection.result}
                </Text>
              </View>
            )}
          </View>

          {!latestInspection ? (
            <View style={styles.awaitingInspection}>
              <View style={styles.awaitingIcon}>
                <Ionicons
                  name="time-outline"
                  size={24}
                  color={colors.primary}
                />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.awaitingTitle}>
                  Waiting for Final Inspection Attempt 1
                </Text>

                <Text style={styles.awaitingText}>
                  {vehicle.assigned_to
                    ? `${
                        vehicle.assigned_to_name ||
                        "The assigned Final Inspector"
                      } can perform the inspection from their workspace.`
                    : "The assigned Advisor or CEO Admin must assign a Final Inspector before inspection can begin."}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.latestMetaRow}>
                <MetaItem
                  icon="person-outline"
                  label="Inspector"
                  value={latestInspection.inspected_by_name || "—"}
                />

                <MetaItem
                  icon="calendar-outline"
                  label="Inspected"
                  value={formatDateTime(latestInspection.inspected_at)}
                />
              </View>

              {latestFailed && latestInspection.failure_reason && (
                <View style={styles.failureHero}>
                  <View style={styles.failureHeroHeader}>
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color={colors.error}
                    />

                    <Text style={styles.failureHeroLabel}>FAILURE REASON</Text>
                  </View>

                  <Text style={styles.failureHeroText}>
                    {latestInspection.failure_reason}
                  </Text>
                </View>
              )}

              {!!latestInspection.remarks && (
                <View style={styles.remarksBox}>
                  <Text style={styles.remarksLabel}>INSPECTION REMARKS</Text>

                  <Text style={styles.remarksText}>
                    {latestInspection.remarks}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* UNIFIED HISTORY */}

        <View style={styles.section}>
          <Text style={styles.eyebrow}>VEHICLE HISTORY</Text>

          <Text style={styles.sectionTitle}>Inspection & Rework Timeline</Text>

          <Text style={styles.sectionDescription}>
            Final Inspection attempts and related Floor rework are shown
            together in workflow order.
          </Text>

          {!timeline.length ? (
            <View style={styles.emptyHistory}>
              <Ionicons
                name="git-commit-outline"
                size={28}
                color={colors.textSecondary}
              />

              <Text style={styles.emptyHistoryTitle}>
                No inspection history yet
              </Text>

              <Text style={styles.emptyText}>
                History will appear after the first Final Inspection attempt.
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {timeline.map((item, index) => (
                <UnifiedTimelineItem
                  key={item.key}
                  item={item}
                  isLast={index === timeline.length - 1}
                />
              ))}
            </View>
          )}
        </View>

        {/* OPERATIONAL DETAILS */}

        <View style={styles.section}>
          <Text style={styles.eyebrow}>OPERATIONAL DETAILS</Text>

          <Text style={styles.sectionTitle}>Current Assignment</Text>

          <View style={styles.detailList}>
            <DetailRow label="Vehicle" value={vehicle.vehicle_no || "—"} />

            <DetailRow
              label="Job Type"
              value={formatJobType(vehicle.job_type)}
            />

            <DetailRow
              label="Current Stage"
              value={formatStage(vehicle.current_stage)}
            />

            <DetailRow label="Workflow Status" value={operationalState.label} />

            <DetailRow
              label="Final Inspector"
              value={vehicle.assigned_to_name || "Not assigned"}
              emphasize={
                !vehicle.assigned_to &&
                vehicle.current_stage === "FINAL_INSPECTION"
              }
            />

            <DetailRow
              label="Stage Started"
              value={formatDateTime(vehicle.stage_started_at)}
            />

            <DetailRow
              label="Time in Stage"
              value={elapsed(vehicle.stage_started_at)}
            />
          </View>
        </View>

        {/* ALL FLOOR CYCLES */}

        {!!data.floor_cycles.length && (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>FLOOR HISTORY</Text>

            <Text style={styles.sectionTitle}>All Floor Cycles</Text>

            <Text style={styles.sectionDescription}>
              Includes original approved work cycles and Final Inspection rework
              cycles.
            </Text>

            <View style={styles.cycleList}>
              {data.floor_cycles.map((cycle) => (
                <FloorCycleCard key={cycle.cycle_no} cycle={cycle} />
              ))}
            </View>
          </View>
        )}

        <BackButton onPress={handleNavigationBack} />
      </ScrollView>
    </SafeAreaView>
  );
}

function OperationalStateCard({
  state,
}: {
  state: ReturnType<typeof getOperationalState>;
}) {
  const palette =
    state.tone === "success"
      ? {
          background: "#E8F5EE",

          border: "#CDE9DA",

          color: "#217A50",
        }
      : state.tone === "danger"
        ? {
            background: colors.dangerLight,

            border: "#F3C8CB",

            color: colors.error,
          }
        : state.tone === "warning"
          ? {
              background: "#FFF6DD",

              border: "#F3DE9A",

              color: "#946200",
            }
          : state.tone === "active"
            ? {
                background: "#EFF6FF",

                border: "#D7E7FF",

                color: "#2563EB",
              }
            : state.tone === "pending"
              ? {
                  background: colors.primaryLight,

                  border: "#FFD0D4",

                  color: colors.primaryDark,
                }
              : {
                  background: colors.background,

                  border: colors.border,

                  color: colors.textSecondary,
                };

  return (
    <View
      style={[
        styles.stateCard,

        {
          backgroundColor: palette.background,

          borderColor: palette.border,
        },
      ]}
    >
      <View
        style={[
          styles.stateIcon,

          {
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Ionicons name={state.icon} size={21} color={palette.color} />
      </View>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={[
            styles.stateLabel,

            {
              color: palette.color,
            },
          ]}
        >
          {state.label}
        </Text>

        <Text style={styles.stateDescription}>{state.description}</Text>
      </View>
    </View>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;

  label: string;

  value: string;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Ionicons name={icon} size={17} color={colors.primary} />

      <Text style={styles.summaryMetricValue} numberOfLines={1}>
        {value}
      </Text>

      <Text style={styles.summaryMetricLabel}>{label}</Text>
    </View>
  );
}

function WorkflowNode({
  icon,
  label,
  active = false,
  completed = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;

  label: string;

  active?: boolean;

  completed?: boolean;

  danger?: boolean;
}) {
  const color = danger
    ? colors.error
    : completed
      ? "#217A50"
      : active
        ? colors.primary
        : colors.textSecondary;

  return (
    <View style={styles.workflowNode}>
      <View
        style={[
          styles.workflowNodeIcon,

          active && styles.workflowNodeIconActive,

          completed && styles.workflowNodeIconCompleted,

          danger && styles.workflowNodeIconDanger,
        ]}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <Text
        style={[
          styles.workflowNodeText,

          {
            color,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function WorkflowArrow() {
  return (
    <View style={styles.workflowArrow}>
      <Ionicons name="chevron-forward" size={17} color={colors.textLight} />
    </View>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;

  label: string;

  value: string;
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={17} color={colors.textSecondary} />

      <View
        style={{
          flex: 1,
        }}
      >
        <Text style={styles.metaLabel}>{label}</Text>

        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

function UnifiedTimelineItem({
  item,
  isLast,
}: {
  item: TimelineItem;

  isLast: boolean;
}) {
  if (item.type === "INSPECTION") {
    const inspection = item.inspection;

    const passed = inspection.result === "PASSED";

    return (
      <View style={styles.timelineItem}>
        <View style={styles.timelineRail}>
          <View
            style={[
              styles.timelineIcon,

              passed ? styles.timelinePassIcon : styles.timelineFailIcon,
            ]}
          >
            <Ionicons
              name={passed ? "checkmark" : "close"}
              size={17}
              color={passed ? "#217A50" : colors.error}
            />
          </View>

          {!isLast && <View style={styles.timelineLine} />}
        </View>

        <View
          style={[
            styles.timelineContent,

            passed ? styles.timelinePassContent : styles.timelineFailContent,
          ]}
        >
          <View style={styles.timelineTop}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.timelineEyebrow}>FINAL INSPECTION</Text>

              <Text style={styles.timelineTitle}>
                Attempt {inspection.inspection_no} —{" "}
                {inspection.result || "Recorded"}
              </Text>
            </View>

            <Text
              style={[
                styles.timelineResult,

                passed ? styles.resultPassText : styles.resultFailText,
              ]}
            >
              {inspection.result}
            </Text>
          </View>

          <Text style={styles.timelineMeta}>
            {inspection.inspected_by_name || "Inspector"} ·{" "}
            {formatDateTime(inspection.inspected_at)}
          </Text>

          {!!inspection.failure_reason && (
            <View style={styles.timelineFailure}>
              <Text style={styles.timelineFailureLabel}>ISSUE FOUND</Text>

              <Text style={styles.timelineFailureText}>
                {inspection.failure_reason}
              </Text>
            </View>
          )}

          {!!inspection.remarks && (
            <Text style={styles.timelineRemark}>
              Remarks: {inspection.remarks}
            </Text>
          )}
        </View>
      </View>
    );
  }

  const cycle = item.cycle;

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineReworkIcon}>
          <Ionicons name="construct-outline" size={17} color="#946200" />
        </View>

        {!isLast && <View style={styles.timelineLine} />}
      </View>

      <View style={[styles.timelineContent, styles.timelineReworkContent]}>
        <Text style={styles.timelineEyebrow}>FLOOR REWORK</Text>

        <Text style={styles.timelineTitle}>Rework Cycle {cycle.cycle_no}</Text>

        <Text style={styles.timelineMeta}>
          {cycle.floor_incharge_name || "Floor Incharge"} ·{" "}
          {formatDateTime(cycle.vehicle_in_at)}
        </Text>

        <View style={styles.timelineReworkStats}>
          <SmallPill label={cycle.status?.replaceAll("_", " ") || "Recorded"} />

          {cycle.vehicle_out_at && (
            <SmallPill
              label={`Completed ${formatDateTime(cycle.vehicle_out_at)}`}
            />
          )}
        </View>

        {!!cycle.remarks && (
          <View style={styles.timelineReworkReason}>
            <Text style={styles.timelineReworkReasonLabel}>REWORK REASON</Text>

            <Text style={styles.timelineReworkReasonText}>{cycle.remarks}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function SmallPill({ label }: { label: string }) {
  return (
    <View style={styles.smallPill}>
      <Text style={styles.smallPillText}>{label}</Text>
    </View>
  );
}

function FloorCycleCard({ cycle }: { cycle: FloorCycle }) {
  return (
    <View style={[styles.cycleCard, cycle.is_rework && styles.reworkCycleCard]}>
      <View style={styles.cycleHeader}>
        <View
          style={{
            flex: 1,
          }}
        >
          <Text style={styles.cycleTitle}>Floor Cycle {cycle.cycle_no}</Text>

          <Text style={styles.cycleSubtitle}>
            {cycle.is_rework
              ? "Final Inspection Rework"
              : "Approved Floor Work"}
          </Text>
        </View>

        <View
          style={[styles.cycleBadge, cycle.is_rework && styles.reworkBadge]}
        >
          <Text
            style={[
              styles.cycleBadgeText,

              cycle.is_rework && styles.reworkBadgeText,
            ]}
          >
            {cycle.status.replaceAll("_", " ")}
          </Text>
        </View>
      </View>

      {cycle.is_rework && cycle.remarks && (
        <View style={styles.cycleReason}>
          <Text style={styles.cycleReasonLabel}>REWORK REASON</Text>

          <Text style={styles.cycleReasonText}>{cycle.remarks}</Text>
        </View>
      )}

      <DetailRow
        label="Floor Incharge"
        value={cycle.floor_incharge_name || "—"}
      />

      <DetailRow
        label="Vehicle In"
        value={formatDateTime(cycle.vehicle_in_at)}
      />

      <DetailRow
        label="Vehicle Out"
        value={formatDateTime(cycle.vehicle_out_at)}
      />

      {!cycle.is_rework && cycle.remarks && (
        <View style={styles.standardRemarks}>
          <Text style={styles.remarksLabel}>FLOOR REMARKS</Text>

          <Text style={styles.remarksText}>{cycle.remarks}</Text>
        </View>
      )}
    </View>
  );
}

function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;

  value: string;

  emphasize?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>

      <Text
        style={[styles.detailValue, emphasize && styles.detailValueWarning]}
      >
        {value}
      </Text>
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

    maxWidth: 900,

    alignSelf: "center",

    padding: 16,

    paddingBottom: 40,

    gap: 15,
  },

  loading: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    gap: 12,
  },

  loadingText: {
    color: colors.textSecondary,

    fontSize: 12,
  },

  errorWrap: {
    flex: 1,

    padding: 24,

    alignItems: "center",

    justifyContent: "center",
  },

  errorIcon: {
    width: 62,

    height: 62,

    borderRadius: 20,

    backgroundColor: colors.dangerLight,

    alignItems: "center",

    justifyContent: "center",
  },

  errorTitle: {
    marginTop: 12,

    color: colors.text,

    fontSize: 20,

    fontWeight: "900",
  },

  errorText: {
    marginTop: 7,

    maxWidth: 430,

    color: colors.textSecondary,

    fontSize: 12,

    lineHeight: 19,

    textAlign: "center",
  },

  header: {
    flexDirection: "row",

    alignItems: "center",

    gap: 12,
  },

  backButton: {
    width: 44,

    height: 44,

    borderRadius: 13,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

    alignItems: "center",

    justifyContent: "center",
  },

  refreshButton: {
    width: 44,

    height: 44,

    borderRadius: 13,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

    alignItems: "center",

    justifyContent: "center",
  },

  eyebrow: {
    color: colors.primary,

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 0.9,
  },

  headerTitle: {
    marginTop: 3,

    color: colors.text,

    fontSize: 24,

    fontWeight: "900",
  },

  hero: {
    padding: 18,

    borderRadius: 18,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,
  },

  heroTop: {
    flexDirection: "row",

    alignItems: "center",

    gap: 12,
  },

  heroIcon: {
    width: 52,

    height: 52,

    borderRadius: 15,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  vehicleIdentity: {
    flex: 1,
  },

  vehicleNo: {
    color: colors.text,

    fontSize: 22,

    fontWeight: "900",
  },

  vehicleModel: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 12,
  },

  customerName: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 11,
  },

  stateCard: {
    marginTop: 16,

    padding: 13,

    borderRadius: 13,

    borderWidth: 1,

    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  stateIcon: {
    width: 40,

    height: 40,

    borderRadius: 12,

    alignItems: "center",

    justifyContent: "center",
  },

  stateLabel: {
    fontSize: 13,

    fontWeight: "900",
  },

  stateDescription: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 16,
  },

  summaryGrid: {
    marginTop: 12,

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,
  },

  summaryMetric: {
    width: "48%",

    flexGrow: 1,

    minWidth: 135,

    padding: 11,

    borderRadius: 11,

    backgroundColor: colors.background,
  },

  summaryMetricValue: {
    marginTop: 7,

    color: colors.text,

    fontSize: 12,

    fontWeight: "900",
  },

  summaryMetricLabel: {
    marginTop: 2,

    color: colors.textSecondary,

    fontSize: 9,

    fontWeight: "700",
  },

  workflowCard: {
    padding: 17,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,
  },

  sectionTitle: {
    marginTop: 3,

    color: colors.text,

    fontSize: 18,

    fontWeight: "900",
  },

  sectionDescription: {
    marginTop: 5,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  workflowTrail: {
    marginTop: 17,

    flexDirection: "row",

    alignItems: "flex-start",

    justifyContent: "space-between",
  },

  workflowNode: {
    flex: 1,

    alignItems: "center",
  },

  workflowNodeIcon: {
    width: 38,

    height: 38,

    borderRadius: 12,

    backgroundColor: colors.background,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: "center",

    justifyContent: "center",
  },

  workflowNodeIconActive: {
    backgroundColor: colors.primaryLight,

    borderColor: "#FFD0D4",
  },

  workflowNodeIconCompleted: {
    backgroundColor: "#E8F5EE",

    borderColor: "#CDE9DA",
  },

  workflowNodeIconDanger: {
    backgroundColor: colors.dangerLight,

    borderColor: "#F3C8CB",
  },

  workflowNodeText: {
    marginTop: 6,

    fontSize: 9,

    fontWeight: "800",

    textAlign: "center",
  },

  workflowArrow: {
    paddingTop: 10,
  },

  reworkTrailNotice: {
    marginTop: 15,

    padding: 11,

    borderRadius: 11,

    backgroundColor: "#FFF6DD",

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 8,
  },

  reworkTrailText: {
    flex: 1,

    color: "#946200",

    fontSize: 10,

    lineHeight: 16,
  },

  accessStrip: {
    minHeight: 44,

    paddingHorizontal: 13,

    paddingVertical: 10,

    borderRadius: 12,

    borderWidth: 1,

    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  adminAccess: {
    backgroundColor: "#F4FBF7",

    borderColor: "#CDE9DA",
  },

  advisorAccess: {
    backgroundColor: colors.primaryLight,

    borderColor: "#FDE5E7",
  },

  accessStripText: {
    flex: 1,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 15,

    fontWeight: "700",
  },

  latestCard: {
    padding: 18,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,
  },

  latestPassCard: {
    borderColor: "#CDE9DA",
  },

  latestFailCard: {
    borderColor: "#F3C8CB",
  },

  latestHeader: {
    flexDirection: "row",

    alignItems: "flex-start",

    justifyContent: "space-between",

    gap: 10,
  },

  resultBadge: {
    paddingHorizontal: 9,

    paddingVertical: 6,

    borderRadius: 999,

    flexDirection: "row",

    alignItems: "center",

    gap: 4,
  },

  resultBadgePass: {
    backgroundColor: "#E8F5EE",
  },

  resultBadgeFail: {
    backgroundColor: colors.dangerLight,
  },

  resultBadgeText: {
    fontSize: 9,

    fontWeight: "900",
  },

  resultPassText: {
    color: "#217A50",
  },

  resultFailText: {
    color: colors.error,
  },

  awaitingInspection: {
    marginTop: 14,

    padding: 13,

    borderRadius: 13,

    backgroundColor: colors.background,

    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  awaitingIcon: {
    width: 43,

    height: 43,

    borderRadius: 13,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  awaitingTitle: {
    color: colors.text,

    fontSize: 12,

    fontWeight: "900",
  },

  awaitingText: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 16,
  },

  latestMetaRow: {
    marginTop: 14,

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,
  },

  metaItem: {
    flex: 1,

    minWidth: 160,

    padding: 11,

    borderRadius: 11,

    backgroundColor: colors.background,

    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  metaLabel: {
    color: colors.textSecondary,

    fontSize: 9,

    fontWeight: "700",
  },

  metaValue: {
    marginTop: 2,

    color: colors.text,

    fontSize: 11,

    fontWeight: "900",
  },

  failureHero: {
    marginTop: 12,

    padding: 14,

    borderRadius: 13,

    backgroundColor: colors.dangerLight,

    borderWidth: 1,

    borderColor: "#F3C8CB",
  },

  failureHeroHeader: {
    flexDirection: "row",

    alignItems: "center",

    gap: 6,
  },

  failureHeroLabel: {
    color: colors.error,

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.8,
  },

  failureHeroText: {
    marginTop: 7,

    color: colors.error,

    fontSize: 13,

    lineHeight: 20,

    fontWeight: "700",
  },

  remarksBox: {
    marginTop: 12,

    padding: 12,

    borderRadius: 11,

    backgroundColor: colors.background,
  },

  remarksLabel: {
    color: colors.textSecondary,

    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.7,
  },

  remarksText: {
    marginTop: 5,

    color: colors.text,

    fontSize: 11,

    lineHeight: 17,
  },

  section: {
    padding: 18,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,
  },

  emptyHistory: {
    marginTop: 15,

    padding: 20,

    borderRadius: 13,

    backgroundColor: colors.background,

    alignItems: "center",
  },

  emptyHistoryTitle: {
    marginTop: 8,

    color: colors.text,

    fontSize: 13,

    fontWeight: "900",
  },

  emptyText: {
    marginTop: 4,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 16,

    textAlign: "center",
  },

  timeline: {
    marginTop: 16,
  },

  timelineItem: {
    flexDirection: "row",

    gap: 11,
  },

  timelineRail: {
    width: 34,

    alignItems: "center",
  },

  timelineIcon: {
    width: 32,

    height: 32,

    borderRadius: 10,

    alignItems: "center",

    justifyContent: "center",

    zIndex: 2,
  },

  timelinePassIcon: {
    backgroundColor: "#E8F5EE",
  },

  timelineFailIcon: {
    backgroundColor: colors.dangerLight,
  },

  timelineReworkIcon: {
    width: 32,

    height: 32,

    borderRadius: 10,

    backgroundColor: "#FFF6DD",

    alignItems: "center",

    justifyContent: "center",

    zIndex: 2,
  },

  timelineLine: {
    flex: 1,

    width: 2,

    minHeight: 28,

    backgroundColor: colors.border,
  },

  timelineContent: {
    flex: 1,

    marginBottom: 13,

    padding: 13,

    borderRadius: 13,

    borderWidth: 1,
  },

  timelinePassContent: {
    backgroundColor: "#F8FCFA",

    borderColor: "#DCEFE4",
  },

  timelineFailContent: {
    backgroundColor: "#FFF9F9",

    borderColor: "#F3D6D8",
  },

  timelineReworkContent: {
    backgroundColor: "#FFFCF3",

    borderColor: "#F1E2B5",
  },

  timelineTop: {
    flexDirection: "row",

    justifyContent: "space-between",

    gap: 8,
  },

  timelineEyebrow: {
    color: colors.textSecondary,

    fontSize: 8,

    fontWeight: "900",

    letterSpacing: 0.8,
  },

  timelineTitle: {
    marginTop: 3,

    color: colors.text,

    fontSize: 13,

    fontWeight: "900",
  },

  timelineResult: {
    fontSize: 9,

    fontWeight: "900",
  },

  timelineMeta: {
    marginTop: 5,

    color: colors.textSecondary,

    fontSize: 9,

    lineHeight: 14,
  },

  timelineFailure: {
    marginTop: 9,

    padding: 10,

    borderRadius: 9,

    backgroundColor: colors.dangerLight,
  },

  timelineFailureLabel: {
    color: colors.error,

    fontSize: 8,

    fontWeight: "900",

    letterSpacing: 0.6,
  },

  timelineFailureText: {
    marginTop: 4,

    color: colors.error,

    fontSize: 10,

    lineHeight: 16,
  },

  timelineRemark: {
    marginTop: 8,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 16,
  },

  timelineReworkStats: {
    marginTop: 8,

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 6,
  },

  smallPill: {
    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 999,

    backgroundColor: "#FFF6DD",
  },

  smallPillText: {
    color: "#946200",

    fontSize: 8,

    fontWeight: "800",
  },

  timelineReworkReason: {
    marginTop: 9,

    padding: 10,

    borderRadius: 9,

    backgroundColor: "#FFF6DD",
  },

  timelineReworkReasonLabel: {
    color: "#946200",

    fontSize: 8,

    fontWeight: "900",

    letterSpacing: 0.6,
  },

  timelineReworkReasonText: {
    marginTop: 4,

    color: "#946200",

    fontSize: 10,

    lineHeight: 16,
  },

  detailList: {
    marginTop: 12,
  },

  detailRow: {
    minHeight: 43,

    paddingVertical: 9,

    borderBottomWidth: 1,

    borderBottomColor: colors.border,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: 15,
  },

  detailLabel: {
    color: colors.textSecondary,

    fontSize: 11,
  },

  detailValue: {
    flex: 1,

    color: colors.text,

    fontSize: 11,

    fontWeight: "800",

    textAlign: "right",
  },

  detailValueWarning: {
    color: "#946200",
  },

  cycleList: {
    marginTop: 14,

    gap: 10,
  },

  cycleCard: {
    padding: 13,

    borderRadius: 12,

    backgroundColor: colors.background,

    borderWidth: 1,

    borderColor: colors.border,
  },

  reworkCycleCard: {
    backgroundColor: "#FFF9F9",

    borderColor: "#F3C8CB",
  },

  cycleHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    gap: 10,

    marginBottom: 6,
  },

  cycleTitle: {
    color: colors.text,

    fontSize: 13,

    fontWeight: "900",
  },

  cycleSubtitle: {
    marginTop: 2,

    color: colors.textSecondary,

    fontSize: 9,
  },

  cycleBadge: {
    alignSelf: "flex-start",

    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 8,

    backgroundColor: "#E8F5EE",
  },

  cycleBadgeText: {
    color: "#217A50",

    fontSize: 8,

    fontWeight: "900",
  },

  reworkBadge: {
    backgroundColor: colors.dangerLight,
  },

  reworkBadgeText: {
    color: colors.error,
  },

  cycleReason: {
    marginBottom: 8,

    padding: 10,

    borderRadius: 9,

    backgroundColor: colors.dangerLight,
  },

  cycleReasonLabel: {
    color: colors.error,

    fontSize: 8,

    fontWeight: "900",

    letterSpacing: 0.6,
  },

  cycleReasonText: {
    marginTop: 4,

    color: colors.error,

    fontSize: 10,

    lineHeight: 16,
  },

  standardRemarks: {
    marginTop: 9,

    padding: 10,

    borderRadius: 9,

    backgroundColor: colors.surface,
  },

  primaryButton: {
    minHeight: 50,

    paddingHorizontal: 16,

    borderRadius: 13,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",

    flexDirection: "row",

    gap: 7,
  },

  primaryButtonText: {
    color: "#FFFFFF",

    fontSize: 13,

    fontWeight: "900",
  },

  secondaryButton: {
    marginTop: 9,

    minHeight: 46,

    paddingHorizontal: 16,

    borderRadius: 13,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: "center",

    justifyContent: "center",
  },

  secondaryButtonText: {
    color: colors.textSecondary,

    fontSize: 12,

    fontWeight: "800",
  },
});
