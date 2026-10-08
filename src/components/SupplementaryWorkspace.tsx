import { Modal, ScrollView, TextInput } from "./inputs/KeyboardAware";
import useDateTimeValidation from "./inputs/useDateTimeValidation";
import BackButton from "./navigation/BackButton";
import BrandPill from "./navigation/BrandPill";
import { returnToRoute, singleParam } from "../lib/back-navigation";
import Ionicons from "@expo/vector-icons/Ionicons";

import DateValueField from "./inputs/DateValueField";

import * as ImagePicker from "expo-image-picker";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import { ActivityIndicator, BackHandler, Image, Platform, RefreshControl, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

import { colors } from "../theme";

import FloorVehicleCard from "./FloorVehicleCard";

import FloorWorkChecklist from "./FloorWorkChecklist";

import FloorAccountability, {
  type FloorAccountabilityData,
  type FloorWorkRecord,
} from "./FloorAccountability";

type Approval = {
  decision: string;
  approval_hold_at: string | null;
  approval_hold_remark: string | null;
  approval_received_at: string | null;
  claim_rejected_at: string | null;
};

type Cycle = {
  id: string;
  cycle_no: number;
  status: string;
  reason: string;
  requested_at: string;
  returned_to_floor_at: string | null;
  continued_without_supplementary_at: string | null;
  approval: Approval | null;
  survey?: {
    completed_at: string;
    paid_amount: number | null;
    receipt_reference_no: string | null;
  } | null;
};

type Evidence = { id: string; storage_path: string; photo_type: string };

type WorkflowEvent = {
  id: string;
  event_type: string;
  stage_before: string | null;
  stage_after: string | null;
  status_before: string | null;
  status_after: string | null;
  performed_by: string | null;
  performed_at: string;
  remarks: string | null;
  metadata: Record<string, unknown> | null;
  actor_name?: string | null;
};

type Item = {
  accountability?: FloorAccountabilityData;
  floor_timeline?: WorkflowEvent[];
  supplementary_timeline?: WorkflowEvent[];
  floor_entered_at?: string | null;
  stage_started_at?: string | null;
  visit_id: string;
  vehicle_id: string;
  vehicle_no: string;
  model: string | null;
  current_stage: string;
  current_status: string;
  job_id: string | null;
  job_type: string | null;
  supplementary: Cycle | null;
  floor_cycle: {
    id: string;
    cycle_no: number;
    vehicle_in_at?: string | null;
  } | null;
  floor_items: (FloorWorkRecord & { work_code: string })[] | null;
  cycle_history: Cycle[] | null;
  evidence: Evidence[] | null;
  events:
    | { event_type: string; performed_at: string; remarks: string | null }[]
    | null;
};

type Queue = { role: string; items: Item[] };

type Message = {
  title: string;
  body: string;
  type?: "success" | "error" | "info";
  confirm?: () => void;
  retry?: () => void;
};

const labels: Record<string, string> = {
  SUPPLEMENTARY_SURVEY: "Supplementary Survey",
  SUPPLEMENTARY_APPROVAL: "Supplementary Approval",
  PENDING_APPROVAL: "Pending Approval",
  APPROVAL_HOLD: "Approval Hold",
  ADVISOR_WORK: "Advisor Work",
  STORE: "Store",
  FLOOR: "Floor",
  FINAL_INSPECTION: "Final Inspection",
  FINAL_INSPECTION_REWORK: "Final Inspection Rework",
  FLOOR_CYCLE_COMPLETED: "Floor completed · Final Inspection",
  CLAIM_REJECTED: "Claim Rejected",
  CONTINUED_WITHOUT_SUPPLEMENTARY: "Continued without supplementary",
  RETURNED_TO_FLOOR: "Returned to Floor",
  APPROVED: "Approved",
  APPROVAL: "Approval",
  SURVEY: "Survey",
  PENDING: "Pending",
  FLOOR_ENTRY: "Vehicle entered Floor",
  FLOOR_CYCLE_PREPARED: "Floor cycle prepared",
  FLOOR_INCHARGE_ASSIGNED: "Floor Incharge assigned",
  STRIPPING_STARTED: "Stripping started",
  FLOOR_WORK_STARTED: "Floor work started",
  FLOOR_WORK_COMPLETED: "Floor work completed",
  STOPPED_FOR_SUPPLEMENTARY: "Stopped for supplementary",
  SUPPLEMENTARY_REQUESTED: "Supplementary requested",
  SUPPLEMENTARY_SURVEY_COMPLETED: "Supplementary survey completed",
  SUPPLEMENTARY_APPROVAL_RECEIVED: "Supplementary approved",
  SUPPLEMENTARY_CLAIM_REJECTED: "Supplementary claim rejected",
  SUPPLEMENTARY_CONTINUED_WITHOUT: "Continued without supplementary",
  SUPPLEMENTARY_CONTINUED_WITHOUT_SUPPLEMENTARY:
    "Continued without supplementary",
  CONTINUE_WITHOUT_SUPPLEMENTARY: "Continued without supplementary",
  SUPPLEMENTARY_RETURNED_TO_FLOOR: "Supplementary returned to Floor",
  PARTS_HANDED_TO_FLOOR: "Parts handed to Floor",
  PARTS_RECEIVED: "Parts received",
  PART_ORDER_CREATED: "Parts order created",
  PART_REQUISITION_CREATED: "Parts requisition created",
  SUPPLEMENTARY_PARTS_REQUISITIONED: "Supplementary parts requisitioned",
  HANDED_TO_FLOOR: "Handed to Floor",
  FLOOR_RECORD_RECONCILED: "Floor record corrected",
  APPROVAL_HOLD_RESOLVED: "Approval hold resolved",
  SURVEY_COMPLETED: "Survey completed",
  APPROVAL_RECEIVED: "Approval received",
};

const label = (value: string) => labels[value] || value.replaceAll("_", " ");

const FloorDesign = createContext(false);

const time = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) + " IST"
    : "—";

function Button({
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
  const floorDesign = useContext(FloorDesign);

  const styles = floorDesign ? { ...baseStyles, ...floorStyles } : baseStyles;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function floorEventRelevant(event: WorkflowEvent) {
  const key =
    `${event.event_type} ${event.stage_before || ""} ${event.stage_after || ""}`.toUpperCase();
  return [
    "FLOOR",
    "STRIPPING",
    "SUPPLEMENTARY",
    "RETURN",
    "PART",
    "CORRECTION",
    "RECONCIL",
    "WORK",
  ].some((token) => key.includes(token));
}

function timelineTone(eventType: string) {
  const value = eventType.toUpperCase();
  if (
    value.includes("COMPLETED") ||
    value.includes("APPROVED") ||
    value.includes("RETURNED_TO_FLOOR") ||
    value.includes("HANDED_TO_FLOOR")
  )
    return { icon: "checkmark", color: "#217A50", background: "#E8F5EE" };
  if (
    value.includes("SUPPLEMENTARY") ||
    value.includes("HOLD") ||
    value.includes("REJECTED") ||
    value.includes("STOPPED")
  )
    return {
      icon: "alert-circle-outline",
      color: colors.primaryDark,
      background: colors.primaryLight,
    };
  if (value.includes("STARTED") || value.includes("IN_PROGRESS"))
    return { icon: "play", color: "#2563EB", background: "#EFF6FF" };
  if (value.includes("CORRECT") || value.includes("RECONCIL"))
    return { icon: "build-outline", color: "#7C3AED", background: "#F3E8FF" };
  return { icon: "time-outline", color: "#616874", background: "#F5F6F7" };
}

function FloorActivityTimeline({
  enteredAt,
  events,
}: {
  enteredAt?: string | null;
  events?: WorkflowEvent[] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const relevant = (events ?? []).filter(floorEventRelevant);
  const hasEntryNearStart =
    !!enteredAt &&
    relevant.some(
      (event) =>
        Math.abs(
          new Date(event.performed_at).getTime() -
            new Date(enteredAt).getTime(),
        ) < 60000 &&
        (event.stage_after === "FLOOR" || event.event_type.includes("FLOOR")),
    );
  const timeline: WorkflowEvent[] = [
    ...relevant,
    ...(enteredAt && !hasEntryNearStart
      ? [
          {
            id: "floor-entry",
            event_type: "FLOOR_ENTRY",
            stage_before: null,
            stage_after: "FLOOR",
            status_before: null,
            status_after: "PENDING",
            performed_by: null,
            performed_at: enteredAt,
            remarks: "Recorded from the current Floor stage entry time.",
            metadata: null,
            actor_name: null,
          },
        ]
      : []),
  ].sort(
    (a, b) =>
      new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
  );
  const visible = expanded ? timeline : timeline.slice(0, 6);

  return (
    <View style={floorStyles.timelineCard}>
      <View style={floorStyles.timelineHeader}>
        <View style={baseStyles.grow}>
          <Text style={floorStyles.timelineEyebrow}>ACCOUNTABILITY</Text>
          <Text style={floorStyles.timelineTitle}>Floor activity timeline</Text>
          <Text style={floorStyles.timelineHint}>
            Recorded actions, responsible users and IST timestamps. Latest
            activity is shown first.
          </Text>
        </View>
        <View style={floorStyles.timelineCount}>
          <Text style={floorStyles.timelineCountText}>{timeline.length}</Text>
        </View>
      </View>
      {!timeline.length && (
        <View style={floorStyles.timelineEmpty}>
          <Ionicons
            name="time-outline"
            size={22}
            color={colors.textSecondary}
          />
          <View style={baseStyles.grow}>
            <Text style={floorStyles.timelineItemTitle}>Activity pending</Text>
            <Text style={baseStyles.small}>
              No Floor workflow event has been recorded for this vehicle yet.
            </Text>
          </View>
        </View>
      )}
      {visible.map((event, index) => {
        const tone = timelineTone(event.event_type);
        const stageChanged =
          event.stage_before &&
          event.stage_after &&
          event.stage_before !== event.stage_after;
        const statusChanged =
          event.status_before &&
          event.status_after &&
          event.status_before !== event.status_after;
        return (
          <View
            key={
              event.id || `${event.event_type}-${event.performed_at}-${index}`
            }
            style={floorStyles.timelineItem}
          >
            <View style={floorStyles.timelineRail}>
              <View
                style={[
                  floorStyles.timelineIcon,
                  { backgroundColor: tone.background },
                ]}
              >
                <Ionicons
                  name={tone.icon as any}
                  size={17}
                  color={tone.color}
                />
              </View>
              {index < visible.length - 1 && (
                <View style={floorStyles.timelineLine} />
              )}
            </View>
            <View style={floorStyles.timelineContent}>
              <View style={floorStyles.timelineTitleRow}>
                <Text style={floorStyles.timelineItemTitle}>
                  {label(event.event_type)}
                </Text>
                <Text style={floorStyles.timelineTime}>
                  {time(event.performed_at)}
                </Text>
              </View>
              <Text style={floorStyles.timelineActor}>
                {event.actor_name ||
                  (event.performed_by
                    ? "User name unavailable"
                    : "System / stage record")}
              </Text>
              {!!stageChanged && (
                <Text style={floorStyles.timelineMeta}>
                  {label(event.stage_before!)} → {label(event.stage_after!)}
                </Text>
              )}
              {!!statusChanged && (
                <Text style={floorStyles.timelineMeta}>
                  {label(event.status_before!)} → {label(event.status_after!)}
                </Text>
              )}
              {!!event.remarks && (
                <Text style={floorStyles.timelineRemarks}>{event.remarks}</Text>
              )}
            </View>
          </View>
        );
      })}
      {timeline.length > 6 && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={floorStyles.timelineToggle}
        >
          <Text style={floorStyles.timelineToggleText}>
            {expanded
              ? "Show recent activity"
              : `Show all ${timeline.length} updates`}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

function supplementaryEventRelevant(event: WorkflowEvent) {
  const key =
    `${event.event_type} ${event.stage_before || ""} ${event.stage_after || ""}`.toUpperCase();
  return [
    "SUPPLEMENTARY",
    "SURVEY",
    "APPROVAL",
    "HOLD",
    "CLAIM",
    "REJECT",
    "ADVISOR_WORK",
    "STORE",
    "PART",
    "REQUISITION",
    "HANDOVER",
    "HANDED",
    "RETURN",
    "CONTINUE_WITHOUT",
  ].some((token) => key.includes(token));
}

function eventCycle(event: WorkflowEvent) {
  const raw =
    event.metadata?.cycle_no ?? event.metadata?.supplementary_cycle_no;
  return typeof raw === "number" || typeof raw === "string"
    ? String(raw)
    : null;
}

function SupplementaryActivityTimeline({
  events,
}: {
  events?: WorkflowEvent[] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const timeline = (events ?? [])
    .filter(supplementaryEventRelevant)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
    );
  const visible = expanded ? timeline : timeline.slice(0, 7);

  return (
    <View style={supplementaryStyles.auditCard}>
      <View style={supplementaryStyles.auditHeader}>
        <View style={baseStyles.grow}>
          <Text style={supplementaryStyles.sectionEyebrow}>ACCOUNTABILITY</Text>
          <Text style={supplementaryStyles.sectionTitle}>
            Supplementary activity timeline
          </Text>
          <Text style={supplementaryStyles.sectionHint}>
            Every recorded action shows who performed it and the exact IST time.
            Latest activity is shown first.
          </Text>
        </View>
        <View style={supplementaryStyles.auditCount}>
          <Text style={supplementaryStyles.auditCountText}>
            {timeline.length}
          </Text>
        </View>
      </View>

      {!timeline.length && (
        <View style={supplementaryStyles.auditEmpty}>
          <Ionicons
            name="time-outline"
            size={22}
            color={colors.textSecondary}
          />
          <View style={baseStyles.grow}>
            <Text style={supplementaryStyles.auditItemTitle}>
              Audit activity pending
            </Text>
            <Text style={baseStyles.small}>
              No detailed Supplementary workflow event is available for this
              visit yet.
            </Text>
          </View>
        </View>
      )}

      {visible.map((event, index) => {
        const tone = timelineTone(event.event_type);
        const cycleNo = eventCycle(event);
        const stageChanged =
          event.stage_before &&
          event.stage_after &&
          event.stage_before !== event.stage_after;
        const statusChanged =
          event.status_before &&
          event.status_after &&
          event.status_before !== event.status_after;
        return (
          <View
            key={
              event.id || `${event.event_type}-${event.performed_at}-${index}`
            }
            style={supplementaryStyles.auditItem}
          >
            <View style={supplementaryStyles.auditRail}>
              <View
                style={[
                  supplementaryStyles.auditIcon,
                  { backgroundColor: tone.background },
                ]}
              >
                <Ionicons
                  name={tone.icon as any}
                  size={17}
                  color={tone.color}
                />
              </View>
              {index < visible.length - 1 && (
                <View style={supplementaryStyles.auditLine} />
              )}
            </View>
            <View style={supplementaryStyles.auditContent}>
              <View style={supplementaryStyles.auditTitleRow}>
                <Text style={supplementaryStyles.auditItemTitle}>
                  {label(event.event_type)}
                </Text>
                {cycleNo && (
                  <Text style={supplementaryStyles.auditCycle}>
                    Cycle {cycleNo}
                  </Text>
                )}
              </View>
              <Text style={supplementaryStyles.auditTime}>
                {time(event.performed_at)}
              </Text>
              <View style={supplementaryStyles.auditActorRow}>
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={supplementaryStyles.auditActor}>
                  {event.actor_name ||
                    (event.performed_by
                      ? "User name unavailable"
                      : "System / automated record")}
                </Text>
              </View>
              {!!stageChanged && (
                <View style={supplementaryStyles.auditChange}>
                  <Text style={supplementaryStyles.auditChangeLabel}>
                    Stage
                  </Text>
                  <Text style={supplementaryStyles.auditChangeText}>
                    {label(event.stage_before!)} → {label(event.stage_after!)}
                  </Text>
                </View>
              )}
              {!!statusChanged && (
                <View style={supplementaryStyles.auditChange}>
                  <Text style={supplementaryStyles.auditChangeLabel}>
                    Status
                  </Text>
                  <Text style={supplementaryStyles.auditChangeText}>
                    {label(event.status_before!)} → {label(event.status_after!)}
                  </Text>
                </View>
              )}
              {!!event.remarks && (
                <Text style={supplementaryStyles.auditRemarks}>
                  {event.remarks}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {timeline.length > 7 && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={supplementaryStyles.auditToggle}
        >
          <Text style={supplementaryStyles.auditToggleText}>
            {expanded
              ? "Show recent activity"
              : `Show all ${timeline.length} audit updates`}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

function elapsedStage(value?: string | null) {
  if (!value) return "Time unavailable";
  const start = new Date(value).getTime();
  if (!Number.isFinite(start) || start > Date.now()) return "Time unavailable";
  const minutes = Math.floor((Date.now() - start) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  const days = Math.floor(hours / 24);
  return `${days}d${hours % 24 ? ` ${hours % 24}h` : ""}`;
}

function supplementaryState(row: Item) {
  const status = row.supplementary?.status || row.current_status;
  if (status === "SURVEY")
    return {
      title: "Survey pending",
      icon: "clipboard-outline" as const,
      color: "#2563EB",
      background: "#EFF6FF",
    };
  if (status === "APPROVAL")
    return {
      title: "Approval pending",
      icon: "checkmark-circle-outline" as const,
      color: "#946200",
      background: "#FFF6DD",
    };
  if (status === "APPROVAL_HOLD")
    return {
      title: "Approval hold",
      icon: "pause-circle-outline" as const,
      color: "#B45309",
      background: "#FFF7ED",
    };
  if (status === "CLAIM_REJECTED")
    return {
      title: "Claim rejected",
      icon: "close-circle-outline" as const,
      color: colors.error,
      background: colors.dangerLight,
    };
  if (row.current_stage === "ADVISOR_WORK")
    return {
      title: "Advisor work",
      icon: "document-text-outline" as const,
      color: "#7C3AED",
      background: "#F3E8FF",
    };
  if (row.current_stage === "STORE")
    return {
      title: "With Store",
      icon: "cube-outline" as const,
      color: "#0369A1",
      background: "#E0F2FE",
    };
  if (status === "RETURNED_TO_FLOOR")
    return {
      title: "Returned to Floor",
      icon: "return-down-back-outline" as const,
      color: "#217A50",
      background: "#E8F5EE",
    };
  if (status === "APPROVED")
    return {
      title: "Approved",
      icon: "checkmark-circle-outline" as const,
      color: "#217A50",
      background: "#E8F5EE",
    };
  return {
    title: label(row.current_stage),
    icon: "time-outline" as const,
    color: colors.textSecondary,
    background: colors.background,
  };
}

function supplementaryAction(row: Item) {
  const status = row.supplementary?.status;
  if (status === "SURVEY") return "Open Supplementary Survey";
  if (status === "APPROVAL") return "Open Supplementary Approval";
  if (status === "APPROVAL_HOLD") return "Review Approval Hold";
  if (status === "CLAIM_REJECTED") return "Review Claim Rejection";
  if (row.current_stage === "ADVISOR_WORK") return "Open Advisor Work";
  if (row.current_stage === "STORE") return "View Store status";
  return "View Supplementary details";
}

function SupplementaryVehicleCard({
  row,
  onPress,
}: {
  row: Item;
  onPress: () => void;
}) {
  const state = supplementaryState(row);
  return (
    <View style={supplementaryStyles.vehicleCard}>
      <View style={supplementaryStyles.vehicleTopRow}>
        <View style={supplementaryStyles.vehicleIcon}>
          <Ionicons name="car-sport-outline" size={23} color={colors.primary} />
        </View>
        <View style={supplementaryStyles.vehicleMain}>
          <Text style={supplementaryStyles.vehicleNumber}>
            {row.vehicle_no}
          </Text>
          <Text style={supplementaryStyles.vehicleModel} numberOfLines={1}>
            {row.model || "Model not recorded"}
          </Text>
        </View>
        <View
          style={[
            supplementaryStyles.timeBadge,
            { backgroundColor: state.background },
          ]}
        >
          <Ionicons name="time-outline" size={14} color={state.color} />
          <Text
            style={[supplementaryStyles.timeBadgeText, { color: state.color }]}
          >
            {elapsedStage(row.stage_started_at)}
          </Text>
        </View>
      </View>

      <View style={supplementaryStyles.divider} />

      <View style={supplementaryStyles.infoGrid}>
        <View style={supplementaryStyles.infoItem}>
          <Text style={supplementaryStyles.infoLabel}>Job type</Text>
          <Text style={supplementaryStyles.infoValue} numberOfLines={1}>
            {row.job_type ? label(row.job_type) : "Not recorded"}
          </Text>
        </View>
        <View style={supplementaryStyles.infoItem}>
          <Text style={supplementaryStyles.infoLabel}>Cycle</Text>
          <Text style={supplementaryStyles.infoValue}>
            {row.supplementary
              ? `Supplementary ${row.supplementary.cycle_no}`
              : "—"}
          </Text>
        </View>
        <View style={supplementaryStyles.infoItem}>
          <Text style={supplementaryStyles.infoLabel}>Stage</Text>
          <Text style={supplementaryStyles.infoValue} numberOfLines={1}>
            {label(row.current_stage)}
          </Text>
        </View>
        <View style={supplementaryStyles.infoItem}>
          <Text style={supplementaryStyles.infoLabel}>Status</Text>
          <Text style={supplementaryStyles.infoValue} numberOfLines={1}>
            {label(row.supplementary?.status || row.current_status)}
          </Text>
        </View>
      </View>

      {!!row.supplementary?.reason && (
        <View style={supplementaryStyles.reasonBox}>
          <Text style={supplementaryStyles.reasonLabel}>
            SUPPLEMENTARY REASON
          </Text>
          <Text style={supplementaryStyles.reasonText}>
            {row.supplementary.reason}
          </Text>
        </View>
      )}

      <View style={supplementaryStyles.stageRow}>
        <View
          style={[
            supplementaryStyles.stageIcon,
            { backgroundColor: state.background },
          ]}
        >
          <Ionicons name={state.icon} size={17} color={state.color} />
        </View>
        <View style={supplementaryStyles.stageText}>
          <Text style={supplementaryStyles.stageTitle}>{state.title}</Text>
          <Text style={supplementaryStyles.stageSubtitle}>
            Since {time(row.stage_started_at)}
          </Text>
        </View>
      </View>

      {!row.job_id && (
        <View style={supplementaryStyles.warning}>
          <Ionicons name="warning-outline" size={17} color={colors.error} />
          <Text style={supplementaryStyles.warningText}>
            Vehicle record correction pending · CEO Admin review required
          </Text>
        </View>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        onPress={onPress}
        activeOpacity={0.85}
        style={supplementaryStyles.actionButton}
      >
        <Text style={supplementaryStyles.actionButtonText}>
          {supplementaryAction(row)}
        </Text>
        <Ionicons name="arrow-forward" size={18} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

function supplementaryProgress(item: Item) {
  const cycle = item.supplementary;
  const status = cycle?.status || item.current_status;
  const surveyDone = !!cycle?.survey || status !== "SURVEY";
  const approvalCurrent = [
    "APPROVAL",
    "APPROVAL_HOLD",
    "CLAIM_REJECTED",
  ].includes(status);
  const approvalDone =
    [
      "APPROVED",
      "RETURNED_TO_FLOOR",
      "CONTINUED_WITHOUT_SUPPLEMENTARY",
    ].includes(status) || !!cycle?.approval?.approval_received_at;
  const finalDone =
    !!cycle?.returned_to_floor_at ||
    !!cycle?.continued_without_supplementary_at ||
    status === "RETURNED_TO_FLOOR";
  const finalCurrent =
    item.current_stage === "ADVISOR_WORK" ||
    item.current_stage === "STORE" ||
    status === "CLAIM_REJECTED";
  return [
    {
      key: "requested",
      title: "Requested",
      subtitle: cycle ? time(cycle.requested_at) : "Request recorded",
      state: "done" as const,
    },
    {
      key: "survey",
      title: "Survey",
      subtitle: surveyDone
        ? cycle?.survey
          ? time(cycle.survey.completed_at)
          : "Completed"
        : "Advisor action pending",
      state: surveyDone ? ("done" as const) : ("current" as const),
    },
    {
      key: "approval",
      title: "Approval",
      subtitle: approvalDone
        ? "Decision recorded"
        : approvalCurrent
          ? label(status)
          : "Pending after survey",
      state: approvalDone
        ? ("done" as const)
        : approvalCurrent
          ? ("current" as const)
          : ("pending" as const),
    },
    {
      key: "outcome",
      title: finalDone
        ? "Returned to Floor"
        : item.current_stage === "STORE"
          ? "Store / Parts"
          : item.current_stage === "ADVISOR_WORK"
            ? "Advisor Work"
            : "Return / Parts",
      subtitle: finalDone
        ? time(
            cycle?.returned_to_floor_at ||
              cycle?.continued_without_supplementary_at,
          )
        : finalCurrent
          ? label(
              item.current_stage === "CLAIM_REJECTED"
                ? "CLAIM_REJECTED"
                : item.current_stage,
            )
          : "Pending after approval",
      state: finalDone
        ? ("done" as const)
        : finalCurrent
          ? ("current" as const)
          : ("pending" as const),
    },
  ];
}

function supplementaryResponsibility(item: Item, role: string) {
  const status = item.supplementary?.status;
  if (status === "SURVEY")
    return {
      owner: "Assigned Advisor",
      title: "Complete Supplementary Survey",
      body:
        role === "advisor"
          ? "Record the survey date and supporting details, then send the same cycle to approval."
          : "The assigned Advisor must complete the Supplementary Survey before this case can move forward.",
      icon: "clipboard-outline" as const,
    };
  if (status === "APPROVAL")
    return {
      owner: "Advisor / CEO Admin",
      title: "Record Supplementary Decision",
      body: "Approve, place the cycle on hold, or record claim rejection. The decision remains attached to this supplementary cycle.",
      icon: "checkmark-circle-outline" as const,
    };
  if (status === "APPROVAL_HOLD")
    return {
      owner: "Advisor / CEO Admin",
      title: "Resolve Approval Hold",
      body: "The current approval cycle is paused. Resolve the hold to return it to Pending Approval without creating a new cycle.",
      icon: "pause-circle-outline" as const,
    };
  if (status === "CLAIM_REJECTED")
    return {
      owner: "Advisor / CEO Admin",
      title: "Resolve Claim Rejection",
      body: "The rejection is preserved in history. Continue without supplementary only if the vehicle should resume the previously approved scope.",
      icon: "close-circle-outline" as const,
    };
  if (item.current_stage === "ADVISOR_WORK")
    return {
      owner: "Advisor workflow",
      title: "Record Additional Parts Requirement",
      body: "Create the supplementary requisition without changing the original Advisor Work record.",
      icon: "document-text-outline" as const,
    };
  if (item.current_stage === "STORE")
    return {
      owner: "Store team",
      title: "Parts Processing",
      body: "The supplementary requisition is with Store. Parts handover will return this cycle to Floor.",
      icon: "cube-outline" as const,
    };
  if (item.current_stage === "FLOOR")
    return {
      owner: "Floor team",
      title: "Returned to Floor",
      body: "The supplementary cycle has returned to Floor. Floor work continues through the recorded Floor workflow.",
      icon: "return-down-back-outline" as const,
    };
  return {
    owner: "Current workflow owner",
    title: label(item.current_stage),
    body: "Review the recorded stage and continue using the available workflow action.",
    icon: "time-outline" as const,
  };
}

function SupplementaryDetailOverview({
  item,
  role,
}: {
  item: Item;
  role: string;
}) {
  const state = supplementaryState(item);
  const responsibility = supplementaryResponsibility(item, role);
  const steps = supplementaryProgress(item);
  return (
    <>
      <View style={supplementaryStyles.detailHero}>
        <View
          pointerEvents="none"
          style={supplementaryStyles.detailHeroCircle}
        />
        <View style={supplementaryStyles.detailHeroTop}>
          <View style={baseStyles.grow}>
            <Text style={supplementaryStyles.detailEyebrow}>
              SUPPLEMENTARY CASE
            </Text>
            <Text style={supplementaryStyles.detailVehicle}>
              {item.vehicle_no}
            </Text>
            <Text style={supplementaryStyles.detailModel}>
              {item.model || "Model not recorded"}
              {item.job_type
                ? ` · ${label(item.job_type)} job`
                : " · Job type not recorded"}
            </Text>
          </View>
          <View
            style={[
              supplementaryStyles.detailStatusBadge,
              { backgroundColor: state.background },
            ]}
          >
            <Ionicons name={state.icon} size={15} color={state.color} />
            <Text
              style={[
                supplementaryStyles.detailStatusText,
                { color: state.color },
              ]}
            >
              {state.title}
            </Text>
          </View>
        </View>
        <View style={supplementaryStyles.detailHeroMeta}>
          <View style={supplementaryStyles.detailMetaItem}>
            <Text style={supplementaryStyles.detailMetaLabel}>Cycle</Text>
            <Text style={supplementaryStyles.detailMetaValue}>
              {item.supplementary ? `#${item.supplementary.cycle_no}` : "—"}
            </Text>
          </View>
          <View style={supplementaryStyles.detailHeroDivider} />
          <View style={supplementaryStyles.detailMetaItem}>
            <Text style={supplementaryStyles.detailMetaLabel}>
              Current stage
            </Text>
            <Text style={supplementaryStyles.detailMetaValue}>
              {label(item.current_stage)}
            </Text>
          </View>
          <View style={supplementaryStyles.detailHeroDivider} />
          <View style={supplementaryStyles.detailMetaItem}>
            <Text style={supplementaryStyles.detailMetaLabel}>Pending</Text>
            <Text style={supplementaryStyles.detailMetaValue}>
              {elapsedStage(item.stage_started_at)}
            </Text>
          </View>
        </View>
        {!!item.supplementary?.reason && (
          <View style={supplementaryStyles.detailReason}>
            <Text style={supplementaryStyles.detailReasonLabel}>REASON</Text>
            <Text style={supplementaryStyles.detailReasonText}>
              {item.supplementary.reason}
            </Text>
          </View>
        )}
      </View>

      <View style={supplementaryStyles.progressCard}>
        <View style={supplementaryStyles.sectionHeader}>
          <View style={baseStyles.grow}>
            <Text style={supplementaryStyles.sectionEyebrow}>WORKFLOW</Text>
            <Text style={supplementaryStyles.sectionTitle}>
              Supplementary progress
            </Text>
            <Text style={supplementaryStyles.sectionHint}>
              One cycle stays traceable from discovery through its final
              outcome.
            </Text>
          </View>
          <View style={supplementaryStyles.cyclePill}>
            <Text style={supplementaryStyles.cyclePillText}>
              Cycle {item.supplementary?.cycle_no || "—"}
            </Text>
          </View>
        </View>
        <View style={supplementaryStyles.progressSteps}>
          {steps.map((step, index) => {
            const done = step.state === "done";
            const current = step.state === "current";
            return (
              <View key={step.key} style={supplementaryStyles.progressStep}>
                <View style={supplementaryStyles.progressRail}>
                  <View
                    style={[
                      supplementaryStyles.progressMarker,
                      done && supplementaryStyles.progressMarkerDone,
                      current && supplementaryStyles.progressMarkerCurrent,
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={16} color="#217A50" />
                    ) : (
                      <Text
                        style={[
                          supplementaryStyles.progressNumber,
                          current && supplementaryStyles.progressNumberCurrent,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  {index < steps.length - 1 && (
                    <View
                      style={[
                        supplementaryStyles.progressLine,
                        done && supplementaryStyles.progressLineDone,
                      ]}
                    />
                  )}
                </View>
                <View style={supplementaryStyles.progressCopy}>
                  <View style={supplementaryStyles.progressTitleRow}>
                    <Text
                      style={[
                        supplementaryStyles.progressTitle,
                        current && supplementaryStyles.progressTitleCurrent,
                      ]}
                    >
                      {step.title}
                    </Text>
                    {current && (
                      <Text style={supplementaryStyles.currentPill}>
                        Current
                      </Text>
                    )}
                  </View>
                  <Text style={supplementaryStyles.progressSubtitle}>
                    {step.subtitle}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={supplementaryStyles.responsibilityCard}>
        <View style={supplementaryStyles.responsibilityIcon}>
          <Ionicons
            name={responsibility.icon}
            size={22}
            color={colors.primary}
          />
        </View>
        <View style={baseStyles.grow}>
          <Text style={supplementaryStyles.sectionEyebrow}>
            ACTION REQUIRED
          </Text>
          <Text style={supplementaryStyles.responsibilityTitle}>
            {responsibility.title}
          </Text>
          <Text style={supplementaryStyles.responsibilityBody}>
            {responsibility.body}
          </Text>
          <View style={supplementaryStyles.ownerRow}>
            <Ionicons
              name="person-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={supplementaryStyles.ownerText}>
              {responsibility.owner}
            </Text>
            <Text style={supplementaryStyles.ownerDot}>•</Text>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={supplementaryStyles.ownerText}>
              {elapsedStage(item.stage_started_at)} in current stage
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}

export default function SupplementaryWorkspace({
  floor = false,
  detail = false,
}: {
  floor?: boolean;
  detail?: boolean;
}) {
  const dateValidation = useDateTimeValidation();
  const params = useLocalSearchParams<{
    visitId?: string;
    floor?: string;
    vehicleId?: string;
    returnTo?: string;
  }>();

  const isFloor = floor || params.floor === "1";

  const styles = isFloor ? { ...baseStyles, ...floorStyles } : baseStyles;

  const [queue, setQueue] = useState<Queue>({ role: "", items: [] });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  const submitting = useRef(false);

  const [message, setMessage] = useState<Message | null>(null);

  const [reason, setReason] = useState("");

  const [remarks, setRemarks] = useState("");

  const [amount, setAmount] = useState("");

  const [receipt, setReceipt] = useState("");

  const [decision, setDecision] = useState("APPROVED");

  const [extraParts, setExtraParts] = useState(false);

  const [workPath, setWorkPath] = useState("DENTING_PAINTING_PARTS");

  const [requisition, setRequisition] = useState("");

  const [date, setDate] = useState(new Date());



  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const uploaded = useRef<{ uri: string; path: string; folder: string } | null>(
    null,
  );

  const [viewer, setViewer] = useState<string | null>(null);

  const [tab, setTab] = useState("Active");

  const [floorFilter, setFloorFilter] = useState<
    "ALL" | "PENDING" | "IN_PROGRESS"
  >("ALL");

  const [historyOpen, setHistoryOpen] = useState(false);

  const [activityOpen, setActivityOpen] = useState(false);

  const [requestOpen, setRequestOpen] = useState(false);

  const [search, setSearch] = useState("");

  const fetchQueue = useCallback(async (): Promise<Queue> => {
    const { data, error: queryError } = await supabase.rpc(
      "new_workflow_supplementary_queue",
      { p_floor: isFloor },
    );

    if (queryError) throw queryError;

    const result = data as Queue;

    if (!["advisor", "ceo_admin"].includes(result.role))
      throw new Error(
        "This workspace is available to Advisors and CEO Admin only.",
      );

    if (result.items.length) {
      const { data: visits, error: timeError } = await supabase
        .from("workshop_visits")

        .select("id,stage_started_at,current_stage,closed_at")
        .in(
          "id",
          result.items.map((row) => row.visit_id),
        );

      if (timeError) throw timeError;

      const stageTimes = new Map(
        (visits ?? []).map((visit) => [visit.id, visit.stage_started_at]),
      );

      result.items = result.items.map((row) => ({
        ...row,
        stage_started_at: stageTimes.get(row.visit_id) ?? null,
        ...(isFloor
          ? { floor_entered_at: stageTimes.get(row.visit_id) ?? null }
          : {}),
      }));

      const selected = detail
        ? result.items.find((row) => row.visit_id === params.visitId)
        : undefined;

      if (selected) {
        const [
          { data: assignments, error: assignmentError },
          { data: workflowEvents, error: eventsError },
        ] = await Promise.all([
          supabase
            .from("vehicle_assignments")
            .select("assigned_to")
            .eq("visit_id", selected.visit_id)
            .eq("assignment_role", "ADVISOR")
            .is("unassigned_at", null),
          supabase
            .from("workflow_events")
            .select(
              "id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata",
            )
            .eq("visit_id", selected.visit_id)
            .order("performed_at", { ascending: false })
            .limit(100),
        ]);

        if (assignmentError) throw assignmentError;
        if (eventsError) throw eventsError;

        const advisorId =
          assignments?.length === 1 ? assignments[0].assigned_to : null;
        const ids = new Set<string>();
        if (advisorId) ids.add(advisorId);

        for (const work of selected.floor_items ?? []) {
          if (work.started_by) ids.add(work.started_by);
          if (work.completed_by) ids.add(work.completed_by);
        }
        for (const event of workflowEvents ?? []) {
          if (event.performed_by) ids.add(event.performed_by);
        }

        let actorNames: Record<string, string> = {};
        if (ids.size) {
          const { data: people, error: peopleError } = await supabase
            .from("profiles")
            .select("id,name")
            .in("id", [...ids]);
          if (peopleError) throw peopleError;
          actorNames = Object.fromEntries(
            (people ?? [])
              .filter((person) => person.name)
              .map((person) => [person.id, person.name]),
          );
        }

        selected.accountability = {
          advisor: advisorId
            ? actorNames[advisorId] || "Advisor name unavailable"
            : "Assignment verification pending",
          actorNames,
        };
        const namedEvents = (workflowEvents ?? []).map((event) => ({
          ...event,
          actor_name: event.performed_by
            ? actorNames[event.performed_by] || "User name unavailable"
            : null,
        })) as WorkflowEvent[];
        if (isFloor) selected.floor_timeline = namedEvents;
        else selected.supplementary_timeline = namedEvents;
      }
    }

    return result;
  }, [detail, isFloor, params.visitId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const next = await fetchQueue();
      setQueue(next);
    } catch (e: any) {
      const body = e.message || "Unable to load this workflow.";

      setError(body);

      setMessage({
        title: isFloor
          ? "Unable to load Floor"
          : "Unable to load Supplementary",
        body,
        type: "error",
        retry: () => {
          setMessage(null);
          void load();
        },
      });
    } finally {
      setLoading(false);
    }
  }, [detail, fetchQueue, isFloor, params.visitId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const item = detail
    ? queue.items.find((x) => x.visit_id === params.visitId)
    : undefined;

  const cycle = item?.supplementary;

  const floorStage = item?.current_stage === "FLOOR";

  const surveyStage =
    item?.current_stage === "SUPPLEMENTARY_SURVEY" &&
    cycle?.status === "SURVEY";

  const approvalStage =
    ["SUPPLEMENTARY_APPROVAL", "PENDING_APPROVAL"].includes(
      item?.current_stage || "",
    ) && cycle?.status === "APPROVAL";

  const holdStage =
    item?.current_stage === "APPROVAL_HOLD" &&
    cycle?.status === "APPROVAL_HOLD";

  const rejectedStage =
    item?.current_stage === "CLAIM_REJECTED" &&
    cycle?.status === "CLAIM_REJECTED";

  const partsStage =
    item?.current_stage === "ADVISOR_WORK" && cycle?.status === "APPROVED";

  const hasActiveFloorWork =
    item?.current_status === "IN_PROGRESS" &&
    !!item.floor_items?.some((work) => work.status === "IN_PROGRESS");

  const goBack = useCallback(() => {
    if (busy) return;

    if (
      detail &&
      singleParam(params.returnTo) === "vehicle-detail" &&
      singleParam(params.vehicleId)
    ) {
      returnToRoute({
        pathname: "/(tabs)/vehicle-detail",
        params: { vehicleId: params.vehicleId! },
      });
      return;
    }
    if (detail && singleParam(params.returnTo) === "vehicles") {
      returnToRoute("/(tabs)/vehicles");
      return;
    }

    returnToRoute(
      detail
        ? isFloor
          ? "/(tabs)/advisor/floor"
          : "/(tabs)/advisor/supplementary"
        : "/(tabs)/advisor",
    );
  }, [busy, detail, isFloor, params.returnTo, params.vehicleId]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (viewer) setViewer(null);
          else if (message) setMessage(null);
          else goBack();

          return true;
        },
      );

      return () => subscription.remove();
    }, [goBack, isFloor, message, viewer]),
  );

  const choosePhoto = async (camera: boolean) => {
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted)
        throw new Error(
          camera
            ? "Camera permission is required."
            : "Photo-library permission is required.",
        );

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
      setMessage({ title: "Unable to select photo", body: e.message });
    }
  };

  const upload = async (row: Item, folder: string) => {
    if (!photoUri) return null;

    if (
      uploaded.current?.uri === photoUri &&
      uploaded.current.folder === folder
    )
      return uploaded.current.path;

    const path = `vehicles/${row.vehicle_id}/SUPPLEMENTARY/${row.visit_id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const response = await fetch(photoUri);
    const bytes = await response.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("vehicle-photos")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });

    if (uploadError) throw uploadError;

    uploaded.current = { uri: photoUri, path, folder };
    return path;
  };

  const perform = async (
    operation: string,
    args: Record<string, unknown>,
    photoFolder?: string,
  ) => {
    if (!item || submitting.current || loading || error) return;

    submitting.current = true;
    setBusy(true);

    try {
      const current = (await fetchQueue()).items.find(
        (x) => x.visit_id === item.visit_id,
      );

      if (
        !current ||
        current.current_stage !== item.current_stage ||
        current.current_status !== item.current_status ||
        current.supplementary?.id !== cycle?.id
      )
        throw new Error("The vehicle has moved. Refresh before continuing.");

      if (!current.job_id)
        throw new Error(
          "Active vehicle job not found. Contact CEO Admin before continuing.",
        );

      if (photoFolder) args.p_photo_path = await upload(current, photoFolder);

      const { error: saveError } = await supabase.rpc(operation, args);

      if (saveError) throw saveError;

      setPhotoUri(null);
      uploaded.current = null;
      setRemarks("");
      setReason("");
      setAmount("");
      setReceipt("");
      setDate(new Date());

      await load();

      setMessage({
        title: "Saved",
        body: "The workflow and history have been saved successfully.",
        type: "success",
      });
    } catch (e: any) {
      setMessage({
        title: "Unable to save",
        body:
          e.message ||
          "Refresh and try again. Any submitted evidence will be preserved.",
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
    folder?: string,
  ) => {
    const dateError = dateValidation.getError();
    if (dateError) { setMessage({ title: "Check date & time", body: dateError }); return; }
    setMessage({
      title,
      body,
      confirm: () => {
        setMessage(null);
        void perform(operation, args, folder);
      },
    });
  };

  const showEvidence = async (evidence: Evidence) => {
    try {
      const { data, error: photoError } = await supabase.storage
        .from("vehicle-photos")
        .createSignedUrl(evidence.storage_path, 300);
      if (photoError) throw photoError;
      if (data?.signedUrl) setViewer(data.signedUrl);
    } catch (e: any) {
      setMessage({ title: "Unable to open photo", body: e.message });
    }
  };

  const submitSurvey = () => {
    if (!cycle) return;

    const paid = amount.trim() ? Number(amount) : null;

    if (paid !== null && (!Number.isFinite(paid) || paid < 0)) {
      setMessage({
        title: "Check amount",
        body: "Enter a valid amount, or leave the optional field empty.",
      });
      return;
    }

    confirm(
      "Save Supplementary Survey?",
      "This will send the vehicle to Supplementary Approval. It will not approve it.",
      "new_workflow_complete_supplementary_survey",
      {
        p_cycle_id: cycle.id,
        p_survey_at: date.toISOString(),
        p_remarks: remarks.trim() || null,
        p_paid_amount: paid,
        p_receipt_reference_no: receipt.trim() || null,
      },
    );
  };

  const submitDecision = () => {
    if (!cycle) return;

    if (decision !== "APPROVED" && !remarks.trim()) {
      setMessage({
        title: "Remark required",
        body: "Enter a remark for Hold or Claim Rejected.",
      });
      return;
    }

    if (decision !== "CLAIM_REJECTED" && !photoUri) {
      setMessage({
        title: "Photo required",
        body:
          decision === "APPROVED"
            ? "Add the supplementary assessment sheet."
            : "Add the assignment sheet for this Hold.",
      });
      return;
    }

    confirm(
      "Submit Supplementary Decision?",
      decision === "CLAIM_REJECTED"
        ? "The supplementary claim will be recorded as rejected. Work will remain stopped until you choose Continue without supplementary."
        : decision === "APPROVAL_HOLD"
          ? "The same supplementary approval cycle will be placed on Hold."
          : extraParts
            ? "The vehicle will move to Advisor Work for the supplementary parts requirement."
            : "The approved supplementary work will return to Floor. The Floor Incharge must start work separately.",
      "new_workflow_decide_supplementary",
      {
        p_cycle_id: cycle.id,
        p_decision: decision,
        p_decision_at: date.toISOString(),
        p_remarks: remarks.trim() || null,
        p_extra_parts: decision === "APPROVED" && extraParts,
      },
      decision === "CLAIM_REJECTED"
        ? undefined
        : decision === "APPROVAL_HOLD"
          ? "ASSIGNMENT"
          : "ASSESSMENT",
    );
  };



  const dateInput = <DateValueField onValidationError={dateValidation.field(surveyStage ? "Survey completed at" : partsStage ? "Requisition date and time" : "Decision date and time")} label={surveyStage ? "Survey completed at" : partsStage ? "Requisition date and time" : "Decision date and time"}
 value={date} onChange={setDate} maximumDate="now" disabled={busy} active={!message && !viewer} />;
  const remarkInput = (
    <View style={styles.card}>
      <Text style={styles.fieldLabel}>
        {decision === "APPROVAL_HOLD" && approvalStage
          ? "Hold remark *"
          : decision === "CLAIM_REJECTED" && approvalStage
            ? "Rejection remark *"
            : "Remarks (optional)"}
      </Text>
      <TextInput
        value={remarks}
        onChangeText={setRemarks}
        editable={!busy}
        multiline
        placeholder="Enter remarks"
        placeholderTextColor="#64748b"
        style={[styles.input, styles.multiline]}
      />
    </View>
  );

  const photoInput = (
    <View style={styles.card}>
      <Text style={styles.fieldLabel}>
        {floorStage
          ? "Discovery photo (optional)"
          : decision === "APPROVAL_HOLD"
            ? "Assignment sheet photo *"
            : "Assessment sheet photo *"}
      </Text>
      {photoUri && (
        <TouchableOpacity onPress={() => setViewer(photoUri)}>
          <Image source={{ uri: photoUri }} style={styles.preview} />
        </TouchableOpacity>
      )}
      <View style={styles.row}>
        <Button
          title="Camera"
          secondary
          disabled={busy}
          onPress={() => void choosePhoto(true)}
        />
        <Button
          title="Choose photo"
          secondary
          disabled={busy}
          onPress={() => void choosePhoto(false)}
        />
      </View>
      {photoUri && (
        <Button
          title="Remove selected photo"
          secondary
          disabled={busy}
          onPress={() => {
            setPhotoUri(null);
            uploaded.current = null;
          }}
        />
      )}
    </View>
  );

  const visibleItems = queue.items.filter((row) => {
    const matchesSearch = [
      row.vehicle_no,
      row.model,
      row.supplementary?.reason,
    ].some((value) =>
      value?.toLowerCase().includes(search.trim().toLowerCase()),
    );

    const matchesTab =
      isFloor ||
      tab === "History" ||
      (tab === "Survey" && row.supplementary?.status === "SURVEY") ||
      (tab === "Approval" &&
        ["APPROVAL", "APPROVAL_HOLD", "CLAIM_REJECTED"].includes(
          row.supplementary?.status || "",
        )) ||
      (tab === "Active" &&
        [
          "SURVEY",
          "APPROVAL",
          "APPROVAL_HOLD",
          "APPROVED",
          "CLAIM_REJECTED",
        ].includes(row.supplementary?.status || ""));

    return (
      matchesSearch &&
      matchesTab &&
      (!isFloor || floorFilter === "ALL" || row.current_status === floorFilter)
    );
  });

  return (
    <FloorDesign.Provider value={isFloor}>
      <SafeAreaView
        style={styles.container}
        edges={["top", "right", "bottom", "left"]}
      >
        {isFloor && (
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.background}
          />
        )}

        {isFloor ? (
          <View style={floorStyles.topBar}>
            <BackButton
              onPress={goBack}
              disabled={busy}
              hitSlop={8}
              accessibilityLabel={
                detail ? "Back to Floor queue" : "Back to workspace"
              }
            />

            <BrandPill />
          </View>
        ) : (
          <View style={baseStyles.supplementaryTopBar}>
            <BackButton
              onPress={goBack}
              disabled={busy}
              accessibilityLabel={
                detail ? "Back to Supplementary queue" : "Back to workspace"
              }
            />
            <View style={baseStyles.supplementaryHeaderActions}>
              <BrandPill />
              <TouchableOpacity
                onPress={() => void load()}
                disabled={busy || loading}
                accessibilityRole="button"
                accessibilityLabel="Refresh supplementary cases"
                accessibilityState={{ disabled: busy || loading }}
                style={baseStyles.supplementaryRefresh}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={19}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {busy && (
          <View style={styles.saving}>
            <ActivityIndicator color={colors.primary} />
            <Text>Saving workflow…</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
            />
          }
        >
          {isFloor && (
            <View style={floorStyles.floorHero}>
              <View pointerEvents="none" style={floorStyles.heroCircle} />

              <Text style={floorStyles.workspaceLabel}>
                {queue.role === "ceo_admin"
                  ? "CEO ADMIN WORKSPACE"
                  : "ADVISOR WORKSPACE"}
              </Text>

              <Text style={floorStyles.floorTitle}>
                {detail ? item?.vehicle_no || "Floor vehicle" : "Floor"}
              </Text>

              <Text style={floorStyles.heroDescription}>
                {detail
                  ? "Review work progress and additional requirements for this vehicle."
                  : "Monitor vehicles on Floor and review their work progress."}
              </Text>

              <View style={floorStyles.statsRow}>
                <View>
                  <Text style={floorStyles.statNumber}>
                    {detail
                      ? item?.floor_cycle?.cycle_no || "—"
                      : queue.items.length}
                  </Text>
                  <Text style={floorStyles.statLabel}>
                    {detail ? "Floor cycle" : "On Floor"}
                  </Text>
                </View>
                <View style={floorStyles.heroDivider} />
                <View>
                  <Text style={floorStyles.statNumber}>
                    {detail
                      ? label(item?.current_status || "PENDING")
                      : queue.items.filter((row) =>
                          row.floor_items?.some(
                            (work) =>
                              row.current_stage === "FLOOR" &&
                              work.status === "IN_PROGRESS",
                          ),
                        ).length}
                  </Text>
                  <Text style={floorStyles.statLabel}>
                    {detail ? "Current status" : "Repair work in progress"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {!isFloor && !detail && (
            <View style={supplementaryStyles.queueHero}>
              <View
                pointerEvents="none"
                style={supplementaryStyles.heroCircle}
              />
              <Text style={supplementaryStyles.workspaceLabel}>
                {queue.role === "ceo_admin"
                  ? "CEO ADMIN WORKSPACE"
                  : "ADVISOR WORKSPACE"}
              </Text>
              <Text style={supplementaryStyles.heroTitle}>Supplementary</Text>
              <Text style={supplementaryStyles.heroDescription}>
                Track additional repair requirements from discovery through
                survey, approval, parts and return to Floor.
              </Text>
              <View style={supplementaryStyles.heroStats}>
                <View>
                  <Text style={supplementaryStyles.heroStatNumber}>
                    {queue.items.length}
                  </Text>
                  <Text style={supplementaryStyles.heroStatLabel}>
                    Total cases
                  </Text>
                </View>
                <View style={supplementaryStyles.heroDivider} />
                <View>
                  <Text style={supplementaryStyles.heroStatNumber}>
                    {
                      queue.items.filter(
                        (row) => row.supplementary?.status === "SURVEY",
                      ).length
                    }
                  </Text>
                  <Text style={supplementaryStyles.heroStatLabel}>
                    Survey pending
                  </Text>
                </View>
                <View style={supplementaryStyles.heroDivider} />
                <View>
                  <Text style={supplementaryStyles.heroStatNumber}>
                    {
                      queue.items.filter((row) =>
                        ["APPROVAL", "APPROVAL_HOLD"].includes(
                          row.supplementary?.status || "",
                        ),
                      ).length
                    }
                  </Text>
                  <Text style={supplementaryStyles.heroStatLabel}>
                    Approval
                  </Text>
                </View>
              </View>
            </View>
          )}

          {error ? (
            <View style={styles.card}>
              <Text style={styles.error}>{error}</Text>
              <Button
                title="Refresh"
                onPress={() => void load()}
                disabled={busy}
              />
            </View>
          ) : loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : detail ? (
            !item ? (
              <View style={styles.card}>
                <Text style={styles.body}>
                  This vehicle is no longer in this queue. Refresh the queue to
                  see its current stage.
                </Text>
                <BackButton
                  onPress={goBack}
                  accessibilityLabel="Back to queue"
                />
              </View>
            ) : (
              <>
                {isFloor ? (
                  <View style={styles.hero}>
                    <Text style={floorStyles.searchLabel}>VEHICLE SUMMARY</Text>
                    <Text style={styles.heroTitle}>
                      {item.model || "Model not recorded"}
                    </Text>
                    <Text style={styles.body}>
                      {item.job_type
                        ? `${item.job_type} job`
                        : "Job type not recorded"}
                    </Text>
                    {item.floor_entered_at && (
                      <Text style={styles.small}>
                        On Floor since: {time(item.floor_entered_at)}
                      </Text>
                    )}
                    <Text style={styles.badge}>
                      {label(item.current_status)}
                      {cycle ? ` · Supplementary ${cycle.cycle_no}` : ""}
                    </Text>
                    {cycle && <Text style={styles.body}>{cycle.reason}</Text>}
                  </View>
                ) : (
                  <SupplementaryDetailOverview item={item} role={queue.role} />
                )}

                {!item.job_id ? (
                  <View style={styles.card}>
                    <Text style={styles.error}>
                      Active vehicle job not found. Contact CEO Admin before
                      continuing.
                    </Text>
                  </View>
                ) : (
                  <>
                    {floorStage && (
                      <>
                        <FloorAccountability
                          enteredAt={item.floor_entered_at}
                          data={item.accountability}
                          items={item.floor_items}
                        />
                        <FloorWorkChecklist
                          cycle={item.floor_cycle?.cycle_no ?? null}
                          items={item.floor_items}
                        />
                        <View style={styles.card}>
                          <Text style={styles.subtitle}>
                            Approved work & Final Inspection
                          </Text>
                          <Text style={styles.body}>
                            Paid jobs can proceed without Stripping when it is
                            not in the approved checklist. When Stripping is
                            included, it must finish before other repair work.
                            Every vehicle must go to Final Inspection after
                            Floor work, including vehicles returning from
                            inspection rework.
                          </Text>
                        </View>
                        <FloorActivityTimeline
                          enteredAt={item.floor_entered_at}
                          events={item.floor_timeline}
                        />
                      </>
                    )}

                    {floorStage &&
                      hasActiveFloorWork &&
                      queue.role === "advisor" && (
                        <Button
                          title={
                            requestOpen
                              ? "Close supplementary request"
                              : "Raise supplementary request"
                          }
                          secondary={requestOpen}
                          disabled={busy}
                          onPress={() => setRequestOpen((value) => !value)}
                        />
                      )}

                    {floorStage &&
                      hasActiveFloorWork &&
                      queue.role === "advisor" &&
                      requestOpen && (
                        <>
                          <View style={styles.card}>
                            <Text style={styles.subtitle}>
                              Raise Supplementary
                            </Text>
                            <Text style={styles.body}>
                              Saving stops Floor work and sends the request to
                              the assigned Advisor.
                            </Text>
                            <Text style={styles.fieldLabel}>Reason *</Text>
                            <TextInput
                              style={[styles.input, styles.multiline]}
                              value={reason}
                              onChangeText={setReason}
                              editable={!busy}
                              multiline
                              placeholder="Describe the additional damage or work"
                              placeholderTextColor="#64748b"
                            />
                          </View>
                          {photoInput}
                          <Button
                            title="Save Supplementary request"
                            disabled={busy || !reason.trim()}
                            onPress={() =>
                              confirm(
                                "Stop work and raise Supplementary?",
                                "Active Floor work will pause. Completed work remains preserved and unfinished work resumes after the Supplementary decision is resolved.",
                                "new_workflow_request_supplementary",
                                {
                                  p_visit_id: item.visit_id,
                                  p_reason: reason.trim(),
                                },
                                "DISCOVERY",
                              )
                            }
                          />
                        </>
                      )}

                    {surveyStage && queue.role === "advisor" && (
                      <>
                        <View style={supplementaryStyles.formIntro}>
                          <View style={supplementaryStyles.formIntroIcon}>
                            <Ionicons
                              name="clipboard-outline"
                              size={20}
                              color={colors.primaryDark}
                            />
                          </View>
                          <View style={styles.grow}>
                            <Text style={supplementaryStyles.formTitle}>
                              Supplementary Survey
                            </Text>
                            <Text style={supplementaryStyles.formHint}>
                              Record what was confirmed during the supplementary
                              survey. Saving moves this same cycle to approval.
                            </Text>
                          </View>
                        </View>
                        {dateInput}
                        {item.job_type === "PAID" && (
                          <View style={styles.card}>
                            <Text style={styles.fieldLabel}>
                              Amount (optional)
                            </Text>
                            <TextInput
                              value={amount}
                              onChangeText={setAmount}
                              keyboardType="decimal-pad"
                              editable={!busy}
                              style={styles.input}
                              placeholder="Leave blank if not recorded"
                            />
                            <Text style={styles.fieldLabel}>
                              Receipt reference (optional)
                            </Text>
                            <TextInput
                              value={receipt}
                              onChangeText={setReceipt}
                              editable={!busy}
                              style={styles.input}
                              placeholder="Receipt reference"
                            />
                          </View>
                        )}
                        {remarkInput}
                        <Button
                          title="Save Survey → Supplementary Approval"
                          disabled={busy}
                          onPress={submitSurvey}
                        />
                      </>
                    )}

                    {surveyStage && queue.role === "ceo_admin" && (
                      <View style={supplementaryStyles.readOnlyNotice}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={20}
                          color={colors.textSecondary}
                        />
                        <View style={styles.grow}>
                          <Text style={supplementaryStyles.readOnlyTitle}>
                            Advisor action pending
                          </Text>
                          <Text style={supplementaryStyles.readOnlyText}>
                            The assigned Advisor must complete Supplementary
                            Survey. CEO Admin can review this case and its
                            history without changing the survey record.
                          </Text>
                        </View>
                      </View>
                    )}

                    {approvalStage && (
                      <>
                        <View style={supplementaryStyles.decisionCard}>
                          <Text style={supplementaryStyles.sectionEyebrow}>
                            DECISION
                          </Text>
                          <Text style={supplementaryStyles.sectionTitle}>
                            Supplementary approval
                          </Text>
                          <Text style={supplementaryStyles.sectionHint}>
                            Choose the recorded outcome. The selected option
                            determines what happens next.
                          </Text>
                          <View style={supplementaryStyles.decisionOptions}>
                            {[
                              {
                                value: "APPROVED",
                                title: "Approve",
                                body: "Approve the additional work and return to Floor, or route through Advisor Work if parts are required.",
                                icon: "checkmark-circle-outline" as const,
                                color: "#217A50",
                                background: "#E8F5EE",
                              },
                              {
                                value: "APPROVAL_HOLD",
                                title: "Hold",
                                body: "Pause this same approval cycle while information or insurer confirmation is pending.",
                                icon: "pause-circle-outline" as const,
                                color: "#B45309",
                                background: "#FFF7ED",
                              },
                              {
                                value: "CLAIM_REJECTED",
                                title: "Claim Rejected",
                                body: "Preserve the rejection and stop the additional scope until a continuation decision is recorded.",
                                icon: "close-circle-outline" as const,
                                color: colors.error,
                                background: colors.dangerLight,
                              },
                            ].map((option) => {
                              const selected = decision === option.value;
                              return (
                                <TouchableOpacity
                                  key={option.value}
                                  disabled={busy}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected }}
                                  onPress={() => {
                                    setDecision(option.value);
                                    setPhotoUri(null);
                                    uploaded.current = null;
                                  }}
                                  style={[
                                    supplementaryStyles.decisionOption,
                                    selected && {
                                      borderColor: option.color,
                                      backgroundColor: option.background,
                                    },
                                  ]}
                                >
                                  <View
                                    style={[
                                      supplementaryStyles.decisionIcon,
                                      { backgroundColor: option.background },
                                    ]}
                                  >
                                    <Ionicons
                                      name={option.icon}
                                      size={21}
                                      color={option.color}
                                    />
                                  </View>
                                  <View style={styles.grow}>
                                    <View
                                      style={
                                        supplementaryStyles.decisionTitleRow
                                      }
                                    >
                                      <Text
                                        style={
                                          supplementaryStyles.decisionTitle
                                        }
                                      >
                                        {option.title}
                                      </Text>
                                      {selected && (
                                        <Ionicons
                                          name="checkmark-circle"
                                          size={20}
                                          color={option.color}
                                        />
                                      )}
                                    </View>
                                    <Text
                                      style={supplementaryStyles.decisionBody}
                                    >
                                      {option.body}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {decision === "APPROVED" && (
                            <View style={supplementaryStyles.partsToggle}>
                              <View style={styles.grow}>
                                <Text
                                  style={supplementaryStyles.partsToggleTitle}
                                >
                                  Additional parts required
                                </Text>
                                <Text
                                  style={supplementaryStyles.partsToggleText}
                                >
                                  Enable this only when supplementary approval
                                  needs a new parts requisition before returning
                                  to Floor.
                                </Text>
                              </View>
                              <Switch
                                value={extraParts}
                                onValueChange={setExtraParts}
                                disabled={busy}
                              />
                            </View>
                          )}
                        </View>
                        {dateInput}
                        {remarkInput}
                        {decision !== "CLAIM_REJECTED" && photoInput}
                        <Button
                          title="Submit Supplementary Decision"
                          disabled={busy}
                          onPress={submitDecision}
                        />
                      </>
                    )}

                    {holdStage && (
                      <View
                        style={[
                          supplementaryStyles.outcomeCard,
                          supplementaryStyles.holdCard,
                        ]}
                      >
                        <View style={supplementaryStyles.outcomeHeader}>
                          <View
                            style={[
                              supplementaryStyles.outcomeIcon,
                              { backgroundColor: "#FFF7ED" },
                            ]}
                          >
                            <Ionicons
                              name="pause-circle-outline"
                              size={22}
                              color="#B45309"
                            />
                          </View>
                          <View style={styles.grow}>
                            <Text style={supplementaryStyles.outcomeTitle}>
                              Approval on hold
                            </Text>
                            <Text style={supplementaryStyles.outcomeTime}>
                              {time(cycle?.approval?.approval_hold_at)}
                            </Text>
                          </View>
                        </View>
                        <Text style={supplementaryStyles.outcomeBody}>
                          {cycle?.approval?.approval_hold_remark ||
                            "Hold remark not recorded."}
                        </Text>
                        <Button
                          title="Resolve Hold → Pending Approval"
                          disabled={busy}
                          onPress={() =>
                            confirm(
                              "Resolve Supplementary Hold?",
                              "Return to Pending Approval using this same cycle. This will not approve the vehicle.",
                              "new_workflow_resolve_approval_hold",
                              { p_visit_id: item.visit_id, p_remarks: null },
                            )
                          }
                        />
                      </View>
                    )}

                    {rejectedStage && (
                      <View
                        style={[
                          supplementaryStyles.outcomeCard,
                          supplementaryStyles.rejectedCard,
                        ]}
                      >
                        <View style={supplementaryStyles.outcomeHeader}>
                          <View
                            style={[
                              supplementaryStyles.outcomeIcon,
                              { backgroundColor: colors.dangerLight },
                            ]}
                          >
                            <Ionicons
                              name="close-circle-outline"
                              size={22}
                              color={colors.error}
                            />
                          </View>
                          <View style={styles.grow}>
                            <Text style={supplementaryStyles.outcomeTitle}>
                              Supplementary claim rejected
                            </Text>
                            <Text style={supplementaryStyles.outcomeTime}>
                              {time(cycle?.approval?.claim_rejected_at)}
                            </Text>
                          </View>
                        </View>
                        <Text style={supplementaryStyles.outcomeBody}>
                          The rejection remains in the audit history. Continue
                          without supplementary returns the vehicle to Floor for
                          the previously approved scope only.
                        </Text>
                        <Button
                          title="Continue without Supplementary"
                          disabled={busy}
                          onPress={() =>
                            confirm(
                              "Continue without supplementary?",
                              "Resume only the previously approved work. The rejected additional work will not be approved or added to the work scope.",
                              "new_workflow_continue_without_supplementary",
                              { p_cycle_id: cycle!.id },
                            )
                          }
                        />
                      </View>
                    )}

                    {partsStage && (
                      <>
                        <View style={supplementaryStyles.decisionCard}>
                          <Text style={supplementaryStyles.sectionEyebrow}>
                            ADVISOR WORK
                          </Text>
                          <Text style={supplementaryStyles.sectionTitle}>
                            Additional parts requirement
                          </Text>
                          <Text style={supplementaryStyles.sectionHint}>
                            This creates a separate supplementary requisition.
                            The original Advisor Work record stays unchanged.
                          </Text>
                          <View style={supplementaryStyles.pathOptions}>
                            {[
                              [
                                "DENTING_PAINTING_PARTS",
                                "Parts + denting / painting",
                                "Repair work and additional parts are both required.",
                              ],
                              [
                                "ONLY_PARTS",
                                "Only parts",
                                "Only an additional parts requirement needs to be sent to Store.",
                              ],
                            ].map(([value, title, body]) => {
                              const selected = workPath === value;
                              return (
                                <TouchableOpacity
                                  key={value}
                                  disabled={busy}
                                  onPress={() => setWorkPath(value)}
                                  style={[
                                    supplementaryStyles.pathOption,
                                    selected &&
                                      supplementaryStyles.pathOptionSelected,
                                  ]}
                                >
                                  <View
                                    style={[
                                      supplementaryStyles.pathRadio,
                                      selected &&
                                        supplementaryStyles.pathRadioSelected,
                                    ]}
                                  >
                                    {selected && (
                                      <View
                                        style={supplementaryStyles.pathRadioDot}
                                      />
                                    )}
                                  </View>
                                  <View style={styles.grow}>
                                    <Text style={supplementaryStyles.pathTitle}>
                                      {title}
                                    </Text>
                                    <Text style={supplementaryStyles.pathBody}>
                                      {body}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          <Text style={styles.fieldLabel}>
                            Requisition number *
                          </Text>
                          <TextInput
                            style={styles.input}
                            value={requisition}
                            onChangeText={setRequisition}
                            editable={!busy}
                            placeholder="Enter requisition number"
                          />
                        </View>
                        {dateInput}
                        {remarkInput}
                        <Button
                          title="Save Requirement → Store"
                          disabled={busy || !requisition.trim()}
                          onPress={() =>
                            confirm(
                              "Send supplementary requirement to Store?",
                              "Create a separate requisition for this supplementary cycle.",
                              "new_workflow_supplementary_parts",
                              {
                                p_cycle_id: cycle!.id,
                                p_work_path: workPath,
                                p_requisition_no: requisition.trim(),
                                p_requisition_at: date.toISOString(),
                                p_remarks: remarks.trim() || null,
                              },
                            )
                          }
                        />
                      </>
                    )}

                    {item.current_stage === "STORE" &&
                      cycle?.status === "APPROVED" && (
                        <View style={supplementaryStyles.storeNotice}>
                          <View style={supplementaryStyles.storeIcon}>
                            <Ionicons
                              name="cube-outline"
                              size={22}
                              color={colors.primaryDark}
                            />
                          </View>
                          <View style={styles.grow}>
                            <Text style={supplementaryStyles.outcomeTitle}>
                              With Store
                            </Text>
                            <Text style={supplementaryStyles.outcomeBody}>
                              The supplementary parts requirement is being
                              processed by Store. Parts handover will return
                              this same cycle to Floor.
                            </Text>
                          </View>
                          <Button
                            title="Open Store Monitoring"
                            secondary
                            onPress={() =>
                              router.push({
                                pathname: "/(tabs)/advisor/store-monitor",
                                params: {
                                  returnTo: "supplementary-detail",
                                  returnVisitId: params.visitId,
                                  floor: isFloor ? "1" : "0",
                                },
                              })
                            }
                          />
                        </View>
                      )}
                  </>
                )}

                {!!item.evidence?.length && (
                  <View style={styles.card}>
                    <View style={supplementaryStyles.sectionHeader}>
                      <View style={supplementaryStyles.evidenceIcon}>
                        <Ionicons
                          name="images-outline"
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.grow}>
                        <Text style={styles.subtitle}>
                          Supplementary evidence
                        </Text>
                        <Text style={styles.small}>
                          {item.evidence.length} recorded photo
                          {item.evidence.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </View>
                    {item.evidence.map((photo) => (
                      <Button
                        key={photo.id}
                        title={`View ${label(photo.photo_type)}`}
                        secondary
                        onPress={() => void showEvidence(photo)}
                        disabled={busy}
                      />
                    ))}
                  </View>
                )}

                {!isFloor && (
                  <SupplementaryActivityTimeline
                    events={item.supplementary_timeline}
                  />
                )}

                {!!item.cycle_history?.length && (
                  <View style={styles.card}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ expanded: historyOpen }}
                      onPress={() => setHistoryOpen((value) => !value)}
                      style={
                        isFloor
                          ? floorStyles.disclosure
                          : supplementaryStyles.disclosure
                      }
                    >
                      <View style={styles.grow}>
                        <Text style={styles.subtitle}>
                          Supplementary history
                        </Text>
                        <Text style={styles.small}>
                          {item.cycle_history.length} recorded cycle
                          {item.cycle_history.length === 1 ? "" : "s"} · tap to{" "}
                          {historyOpen ? "collapse" : "review"}
                        </Text>
                      </View>
                      <Ionicons
                        name={historyOpen ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {historyOpen &&
                      item.cycle_history.map((previous) => (
                        <View style={styles.history} key={previous.id}>
                          <Text style={styles.fieldLabel}>
                            Supplementary {previous.cycle_no} ·{" "}
                            {label(previous.status)}
                          </Text>
                          <Text style={styles.body}>{previous.reason}</Text>
                          <Text style={styles.small}>
                            Requested: {time(previous.requested_at)}
                          </Text>
                          {previous.survey && (
                            <>
                              <Text style={styles.small}>
                                Survey: {time(previous.survey.completed_at)}
                              </Text>
                              {previous.survey.paid_amount != null && (
                                <Text style={styles.small}>
                                  Recorded amount: ₹
                                  {previous.survey.paid_amount}
                                </Text>
                              )}
                              {previous.survey.receipt_reference_no && (
                                <Text style={styles.small}>
                                  Receipt:{" "}
                                  {previous.survey.receipt_reference_no}
                                </Text>
                              )}
                            </>
                          )}
                          {previous.approval && (
                            <Text style={styles.small}>
                              Decision: {label(previous.approval.decision)}
                              {previous.approval.approval_received_at
                                ? ` · ${time(previous.approval.approval_received_at)}`
                                : previous.approval.claim_rejected_at
                                  ? ` · ${time(previous.approval.claim_rejected_at)}`
                                  : ""}
                            </Text>
                          )}
                          {previous.approval?.approval_hold_remark && (
                            <Text style={styles.small}>
                              Hold: {previous.approval.approval_hold_remark} ·{" "}
                              {time(previous.approval.approval_hold_at)}
                            </Text>
                          )}
                          {previous.returned_to_floor_at && (
                            <Text style={styles.small}>
                              Returned to Floor:{" "}
                              {time(previous.returned_to_floor_at)}
                            </Text>
                          )}
                          {previous.continued_without_supplementary_at && (
                            <Text style={styles.small}>
                              Continued without supplementary:{" "}
                              {time(
                                previous.continued_without_supplementary_at,
                              )}
                            </Text>
                          )}
                        </View>
                      ))}
                  </View>
                )}

                {isFloor && !!item.events?.length && (
                  <View style={styles.card}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ expanded: activityOpen }}
                      onPress={() => setActivityOpen((value) => !value)}
                      style={floorStyles.disclosure}
                    >
                      <View style={styles.grow}>
                        <Text style={styles.subtitle}>
                          Supplementary activity
                        </Text>
                        <Text style={styles.small}>
                          {item.events.length} recorded update
                          {item.events.length === 1 ? "" : "s"} · tap to{" "}
                          {activityOpen ? "collapse" : "review"}
                        </Text>
                      </View>
                      <Ionicons
                        name={activityOpen ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {activityOpen &&
                      item.events.map((event, index) => (
                        <View key={index} style={styles.history}>
                          <Text style={styles.fieldLabel}>
                            {label(event.event_type)}
                          </Text>
                          <Text style={styles.small}>
                            {time(event.performed_at)}
                          </Text>
                          {event.remarks && (
                            <Text style={styles.body}>{event.remarks}</Text>
                          )}
                        </View>
                      ))}
                  </View>
                )}
              </>
            )
          ) : (
            <>
              {isFloor && (
                <View style={floorStyles.filters}>
                  {(
                    [
                      { value: "ALL", title: "All" },
                      { value: "PENDING", title: "Pending" },
                      { value: "IN_PROGRESS", title: "In Progress" },
                    ] as const
                  ).map((filter) => {
                    const selected = floorFilter === filter.value;

                    const count =
                      filter.value === "ALL"
                        ? queue.items.length
                        : queue.items.filter(
                            (row) => row.current_status === filter.value,
                          ).length;

                    return (
                      <TouchableOpacity
                        key={filter.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${filter.title}, ${count} vehicles`}
                        onPress={() => setFloorFilter(filter.value)}
                        style={[
                          floorStyles.filter,
                          selected && floorStyles.filterSelected,
                        ]}
                      >
                        <Text
                          style={[
                            floorStyles.filterText,
                            selected && floorStyles.filterTextSelected,
                          ]}
                        >
                          {filter.title}
                        </Text>
                        <View
                          style={[
                            floorStyles.filterCount,
                            selected && floorStyles.filterCountSelected,
                          ]}
                        >
                          <Text
                            style={[
                              floorStyles.filterCountText,
                              selected && floorStyles.filterTextSelected,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {!isFloor && (
                <View style={supplementaryStyles.filters}>
                  {["Active", "Survey", "Approval", "History"].map((value) => {
                    const count =
                      value === "Survey"
                        ? queue.items.filter(
                            (row) => row.supplementary?.status === "SURVEY",
                          ).length
                        : value === "Approval"
                          ? queue.items.filter((row) =>
                              [
                                "APPROVAL",
                                "APPROVAL_HOLD",
                                "CLAIM_REJECTED",
                              ].includes(row.supplementary?.status || ""),
                            ).length
                          : value === "Active"
                            ? queue.items.filter((row) =>
                                [
                                  "SURVEY",
                                  "APPROVAL",
                                  "APPROVAL_HOLD",
                                  "APPROVED",
                                  "CLAIM_REJECTED",
                                ].includes(row.supplementary?.status || ""),
                              ).length
                            : queue.items.length;
                    const selected = tab === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setTab(value)}
                        style={[
                          supplementaryStyles.filter,
                          selected && supplementaryStyles.filterSelected,
                        ]}
                      >
                        <Text
                          style={[
                            supplementaryStyles.filterText,
                            selected && supplementaryStyles.filterTextSelected,
                          ]}
                        >
                          {value}
                        </Text>
                        <View
                          style={[
                            supplementaryStyles.filterCount,
                            selected && supplementaryStyles.filterCountSelected,
                          ]}
                        >
                          <Text
                            style={[
                              supplementaryStyles.filterCountText,
                              selected &&
                                supplementaryStyles.filterTextSelected,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {isFloor ? (
                <View style={floorStyles.searchCard}>
                  <Text style={floorStyles.searchLabel}>FIND A VEHICLE</Text>
                  <Text style={floorStyles.searchHint}>
                    Registration, model or supplementary reason
                  </Text>

                  <View style={floorStyles.searchWrap}>
                    <Ionicons
                      name="search-outline"
                      size={20}
                      color={colors.textSecondary}
                    />

                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      style={floorStyles.searchInput}
                      placeholder="Search Floor vehicles..."
                      placeholderTextColor={colors.textSecondary}
                      autoCorrect={false}
                      returnKeyType="search"
                      accessibilityLabel="Search Floor vehicles"
                    />

                    {!!search.length && (
                      <TouchableOpacity
                        onPress={() => setSearch("")}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        style={floorStyles.clearSearch}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <View style={supplementaryStyles.searchCard}>
                  <Text style={supplementaryStyles.searchLabel}>
                    FIND A SUPPLEMENTARY CASE
                  </Text>
                  <Text style={supplementaryStyles.searchHint}>
                    Registration, model or supplementary reason
                  </Text>
                  <View style={supplementaryStyles.searchWrap}>
                    <Ionicons
                      name="search-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      style={supplementaryStyles.searchInput}
                      placeholder="Search supplementary cases..."
                      placeholderTextColor={colors.textSecondary}
                      autoCorrect={false}
                      returnKeyType="search"
                      accessibilityLabel="Search supplementary cases"
                    />
                    {!!search.length && (
                      <TouchableOpacity
                        onPress={() => setSearch("")}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        style={supplementaryStyles.clearSearch}
                      >
                        <Ionicons
                          name="close-circle"
                          size={19}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {isFloor ? (
                <Text style={styles.body}>
                  Review the approved work for each vehicle. Paid jobs may have
                  no Stripping work. Final Inspection is mandatory after Floor
                  work. Supplementary requests can be raised during any approved
                  Floor work in progress.
                </Text>
              ) : (
                <Text style={supplementaryStyles.introText}>
                  Each case stays traceable through survey, approval, parts and
                  return to Floor. Open a vehicle to complete the current action
                  or review its history.
                </Text>
              )}

              {isFloor ? (
                <View style={floorStyles.listHeading}>
                  <View>
                    <Text style={floorStyles.listTitle}>Floor Vehicles</Text>
                    <Text style={styles.small}>
                      {visibleItems.length} matching vehicle
                      {visibleItems.length === 1 ? "" : "s"}
                      {search.trim() ? " · Search applied" : ""}
                    </Text>
                  </View>
                  <Text style={floorStyles.viewBadge}>
                    {floorFilter === "ALL"
                      ? "All vehicles"
                      : floorFilter === "PENDING"
                        ? "Pending"
                        : "In progress"}
                  </Text>
                </View>
              ) : (
                <View style={supplementaryStyles.listHeading}>
                  <View style={styles.grow}>
                    <Text style={supplementaryStyles.listTitle}>
                      Supplementary Cases
                    </Text>
                    <Text style={styles.small}>
                      {visibleItems.length} matching case
                      {visibleItems.length === 1 ? "" : "s"}
                      {search.trim() ? " · Search applied" : ""}
                    </Text>
                  </View>
                  <Text style={supplementaryStyles.viewBadge}>{tab}</Text>
                </View>
              )}

              {!visibleItems.length &&
                (isFloor ? (
                  <View style={styles.card}>
                    <View style={floorStyles.emptyIcon}>
                      <Ionicons
                        name="car-outline"
                        size={28}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.subtitle}>
                      {queue.items.length
                        ? "No matching vehicles"
                        : "No Floor vehicles"}
                    </Text>
                    <Text style={styles.body}>
                      {search.trim()
                        ? "No Floor vehicles match your search in this filter."
                        : floorFilter === "PENDING"
                          ? "No Floor vehicles are pending."
                          : floorFilter === "IN_PROGRESS"
                            ? "No Floor vehicles are in progress."
                            : "No Floor vehicles available."}
                    </Text>
                    {(floorFilter !== "ALL" || !!search.trim()) && (
                      <Button
                        title="Show all Floor vehicles"
                        secondary
                        onPress={() => {
                          setFloorFilter("ALL");
                          setSearch("");
                        }}
                      />
                    )}
                  </View>
                ) : (
                  <View style={supplementaryStyles.emptyCard}>
                    <View style={supplementaryStyles.emptyIcon}>
                      <Ionicons
                        name="documents-outline"
                        size={32}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text style={supplementaryStyles.emptyTitle}>
                      {search.trim()
                        ? "No supplementary cases found"
                        : `No ${tab.toLowerCase()} supplementary cases`}
                    </Text>
                    <Text style={supplementaryStyles.emptyText}>
                      {search.trim()
                        ? "Try another registration, model or supplementary reason."
                        : "Cases will appear here when they reach this supplementary stage."}
                    </Text>
                    {(search.trim() || tab !== "Active") && (
                      <TouchableOpacity
                        style={supplementaryStyles.clearButton}
                        onPress={() => {
                          setSearch("");
                          setTab("Active");
                        }}
                      >
                        <Text style={supplementaryStyles.clearButtonText}>
                          Show active cases
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

              {visibleItems.map((row) =>
                isFloor ? (
                  <FloorVehicleCard
                    key={row.visit_id}
                    vehicle={row}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/advisor/supplementary-detail",
                        params: { visitId: row.visit_id, floor: "1" },
                      })
                    }
                  />
                ) : (
                  <SupplementaryVehicleCard
                    key={row.visit_id}
                    row={row}
                    onPress={() => {
                      setDate(new Date());
                      router.push({
                        pathname: "/(tabs)/advisor/supplementary-detail",
                        params: { visitId: row.visit_id, floor: "0" },
                      });
                    }}
                  />
                ),
              )}
            </>
          )}
        </ScrollView>

        <Modal
          visible={!!message}
          transparent
          animationType="fade"
          onRequestClose={() => setMessage(null)}
        >
          <SafeAreaView
            style={styles.overlay}
            edges={["top", "right", "bottom", "left"]}
          >
            <View style={styles.dialog}>
              <View
                style={[
                  floorStyles.popupIcon,
                  {
                    backgroundColor:
                      message?.type === "success"
                        ? colors.successLight
                        : message?.type === "error" ||
                            message?.title.startsWith("Unable")
                          ? colors.dangerLight
                          : message?.confirm
                            ? colors.warningLight
                            : colors.infoLight,
                  },
                ]}
              >
                <Ionicons
                  name={
                    message?.type === "success"
                      ? "checkmark"
                      : message?.type === "error" ||
                          message?.title.startsWith("Unable")
                        ? "alert-circle-outline"
                        : message?.confirm
                          ? "help-circle-outline"
                          : "information-circle-outline"
                  }
                  size={28}
                  color={
                    message?.type === "success"
                      ? colors.success
                      : message?.type === "error" ||
                          message?.title.startsWith("Unable")
                        ? colors.error
                        : message?.confirm
                          ? colors.warning
                          : colors.info
                  }
                />
              </View>

              <Text style={styles.subtitle}>{message?.title}</Text>
              <Text style={styles.body}>{message?.body}</Text>
              {message?.confirm ? (
                <>
                  <Button
                    title="Confirm"
                    onPress={message.confirm}
                    disabled={busy}
                  />
                  <Button
                    title="Cancel"
                    secondary
                    onPress={() => setMessage(null)}
                  />
                </>
              ) : message?.retry ? (
                <>
                  <Button title="Refresh" onPress={message.retry} />
                  <Button
                    title="Close"
                    secondary
                    onPress={() => setMessage(null)}
                  />
                </>
              ) : (
                <Button title="OK" onPress={() => setMessage(null)} />
              )}
            </View>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={!!viewer}
          animationType="fade"
          onRequestClose={() => setViewer(null)}
        >
          <SafeAreaView
            style={styles.viewer}
            edges={["top", "right", "bottom", "left"]}
          >
            <Button
              title="Close photo"
              secondary
              onPress={() => setViewer(null)}
            />
            {viewer && (
              <Image
                source={{ uri: viewer }}
                resizeMode="contain"
                style={styles.viewerImage}
              />
            )}
          </SafeAreaView>
        </Modal>




      </SafeAreaView>
    </FloorDesign.Provider>
  );
}

const supplementaryStyles = StyleSheet.create({
  queueHero: {
    backgroundColor: "#F20D1D",
    padding: 20,
    borderRadius: 18,
    overflow: "hidden",
    gap: 10,
    shadowColor: "#F20D1D",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  heroCircle: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -62,
    top: -70,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  workspaceLabel: {
    alignSelf: "flex-start",
    color: colors.white,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroTitle: { color: colors.white, fontSize: 29, fontWeight: "800" },
  heroDescription: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 620,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 18,
    paddingTop: 13,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  heroDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  heroStatNumber: { color: colors.white, fontSize: 20, fontWeight: "800" },
  heroStatLabel: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 10,
    marginTop: 3,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  filterTextSelected: { color: colors.white },
  filterCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  filterCountSelected: { backgroundColor: "rgba(255,255,255,0.2)" },
  filterCountText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
  },
  searchCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  searchLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  searchHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  searchWrap: {
    marginTop: 7,
    minHeight: 50,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  clearSearch: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  introText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  listTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 3,
  },
  viewBadge: {
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  vehicleCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 13,
    shadowColor: "#171717",
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  vehicleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    flexWrap: "wrap",
  },
  vehicleIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleMain: { flex: 1, minWidth: 140 },
  vehicleNumber: { color: colors.text, fontSize: 18, fontWeight: "800" },
  vehicleModel: { marginTop: 3, color: colors.textSecondary, fontSize: 13 },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
  },
  timeBadgeText: { fontSize: 11, fontWeight: "800" },
  divider: { height: 1, backgroundColor: colors.divider },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  infoItem: { width: "50%", paddingHorizontal: 5, marginBottom: 8 },
  infoLabel: { color: colors.textSecondary, fontSize: 11, marginBottom: 4 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  reasonBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFF8F8",
    borderWidth: 1,
    borderColor: "#FDE5E7",
    gap: 4,
  },
  reasonLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  reasonText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  stageRow: {
    padding: 13,
    borderRadius: 13,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
  },
  stageIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stageText: { flex: 1, minWidth: 0, marginLeft: 10 },
  stageTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  stageSubtitle: { marginTop: 2, color: colors.textSecondary, fontSize: 11 },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.dangerLight,
  },
  warningText: { flex: 1, color: colors.error, fontSize: 12, lineHeight: 18 },
  actionButton: {
    minHeight: 49,
    borderRadius: 13,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 34,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 7,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 430,
  },
  clearButton: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  detailHero: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: "hidden",
    gap: 15,
  },
  detailHeroCircle: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -65,
    top: -75,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  detailHeroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  detailEyebrow: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  detailVehicle: {
    marginTop: 5,
    color: "white",
    fontSize: 25,
    fontWeight: "900",
  },
  detailModel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.90)",
    fontSize: 13,
    lineHeight: 20,
  },
  detailStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  detailStatusText: { fontSize: 11, fontWeight: "800" },
  detailHeroMeta: {
    flexDirection: "row",
    alignItems: "stretch",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.24)",
  },
  detailMetaItem: { minWidth: 90, flexGrow: 1, flexBasis: 100 },
  detailMetaLabel: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailMetaValue: {
    marginTop: 4,
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
  detailHeroDivider: {
    width: 1,
    minHeight: 34,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  detailReason: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  detailReasonLabel: {
    color: "white",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  detailReasonText: {
    marginTop: 5,
    color: "rgba(255,255,255,0.90)",
    fontSize: 13,
    lineHeight: 20,
  },
  progressCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sectionEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  sectionTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },
  sectionHint: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  cyclePill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
  },
  cyclePillText: { color: colors.primaryDark, fontSize: 11, fontWeight: "800" },
  progressSteps: { gap: 0 },
  progressStep: { flexDirection: "row", gap: 12, minHeight: 66 },
  progressRail: { width: 34, alignItems: "center" },
  progressMarker: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  progressMarkerDone: { backgroundColor: "#E8F5EE", borderColor: "#CDE9DA" },
  progressMarkerCurrent: {
    backgroundColor: colors.primaryLight,
    borderColor: "#F7B8BE",
  },
  progressNumber: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  progressNumberCurrent: { color: colors.primaryDark },
  progressLine: {
    flex: 1,
    width: 2,
    minHeight: 30,
    backgroundColor: "#ECEDEF",
    marginVertical: 3,
  },
  progressLineDone: { backgroundColor: "#CDE9DA" },
  progressCopy: { flex: 1, minWidth: 0, paddingBottom: 14 },
  progressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  progressTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  progressTitleCurrent: { color: colors.primaryDark, fontWeight: "900" },
  currentPill: {
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  progressSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  responsibilityCard: {
    padding: 17,
    borderRadius: 17,
    backgroundColor: "#FFF9F9",
    borderWidth: 1,
    borderColor: "#FDE5E7",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  responsibilityIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  responsibilityTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  responsibilityBody: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  ownerRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  ownerText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  ownerDot: { color: colors.textLight, fontSize: 11 },
  formIntro: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  formIntroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  formTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  formHint: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  readOnlyNotice: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  readOnlyTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  readOnlyText: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  decisionCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  decisionOptions: { gap: 9 },
  decisionOption: {
    minHeight: 74,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  decisionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  decisionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  decisionTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  decisionBody: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  partsToggle: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  partsToggleTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  partsToggleText: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  outcomeCard: { padding: 18, borderRadius: 18, borderWidth: 1, gap: 13 },
  holdCard: { backgroundColor: "#FFFBF4", borderColor: "#FED7AA" },
  rejectedCard: { backgroundColor: "#FFF7F7", borderColor: "#FECACA" },
  outcomeHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  outcomeIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  outcomeTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  outcomeTime: { marginTop: 3, color: colors.textSecondary, fontSize: 11 },
  outcomeBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  pathOptions: { gap: 9 },
  pathOption: {
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  pathOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#FFF8F8",
  },
  pathRadio: {
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pathRadioSelected: { borderColor: colors.primary },
  pathRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pathTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  pathBody: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  storeNotice: {
    padding: 17,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  storeIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  evidenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  disclosure: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  auditCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  auditHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  auditCount: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  auditCountText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },
  auditEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 14,
    borderRadius: 13,
    backgroundColor: colors.background,
  },
  auditItem: { flexDirection: "row", gap: 12 },
  auditRail: { width: 36, alignItems: "center" },
  auditIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  auditLine: {
    width: 2,
    flex: 1,
    minHeight: 44,
    marginTop: 4,
    backgroundColor: "#ECEDEF",
  },
  auditContent: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F3",
    gap: 6,
  },
  auditTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  auditItemTitle: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  auditCycle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "800",
  },
  auditTime: { color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  auditActorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  auditActor: { flex: 1, color: "#616874", fontSize: 12, fontWeight: "700" },
  auditChange: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  auditChangeLabel: {
    minWidth: 42,
    color: colors.textLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  auditChangeText: {
    flex: 1,
    minWidth: 140,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  auditRemarks: {
    marginTop: 2,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    color: "#616874",
    fontSize: 12,
    lineHeight: 19,
  },
  auditToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#F0F1F3",
    paddingTop: 10,
  },
  auditToggleText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
});

const floorStyles = StyleSheet.create({
  timelineCard: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  timelineHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.primary,
  },
  timelineTitle: {
    marginTop: 4,
    fontSize: 19,
    fontWeight: "800",
    color: "#30343B",
  },
  timelineHint: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  timelineCount: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 9,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineCountText: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.primaryDark,
  },
  timelineEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 14,
    borderRadius: 13,
    backgroundColor: colors.background,
  },
  timelineItem: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 36, alignItems: "center" },
  timelineIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 34,
    marginTop: 4,
    backgroundColor: "#ECEDEF",
  },
  timelineContent: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F3",
    gap: 5,
  },
  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  timelineItemTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#30343B",
  },
  timelineTime: { fontSize: 11, lineHeight: 17, color: colors.textSecondary },
  timelineActor: { fontSize: 12, fontWeight: "700", color: "#616874" },
  timelineMeta: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  timelineRemarks: {
    marginTop: 2,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    fontSize: 12,
    lineHeight: 19,
    color: "#616874",
  },
  timelineToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#F0F1F3",
    paddingTop: 10,
  },
  timelineToggleText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },

  disclosure: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  searchCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },

  searchLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },

  searchHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 19 },

  searchWrap: {
    marginTop: 7,
    minHeight: 50,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },

  clearSearch: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },

  listTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#30343B",
    marginBottom: 4,
  },

  viewBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },

  popupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  filter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E9EC",
    backgroundColor: colors.surface,
  },

  filterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterText: { fontSize: 13, fontWeight: "700", color: "#616874" },

  filterTextSelected: { color: colors.white },

  filterCount: {
    borderRadius: 8,
    backgroundColor: "#F0F1F3",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  filterCountSelected: { backgroundColor: "rgba(255,255,255,0.2)" },

  filterCountText: { fontSize: 11, fontWeight: "800", color: "#616874" },

  container: { flex: 1, backgroundColor: colors.background },

  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 16,
    maxWidth: 860,
    width: "100%",
    alignSelf: "center",
  },

  topBar: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 2 },

  backText: { fontSize: 15, fontWeight: "600", color: "#7A808A" },

  brandPill: {
    minHeight: 31,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E8E9EC",
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
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#30343B",
  },

  floorHero: {
    backgroundColor: "#F20D1D",
    padding: 20,
    borderRadius: 17,
    overflow: "hidden",
    gap: 12,
    shadowColor: "#F20D1D",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  heroCircle: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -60,
    top: -60,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  workspaceLabel: {
    alignSelf: "flex-start",
    color: "white",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  floorTitle: { fontSize: 30, fontWeight: "800", color: "white" },

  heroDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.9)",
    maxWidth: 540,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },

  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  statNumber: { fontSize: 22, fontWeight: "800", color: "white" },

  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 4 },

  card: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E8E9EC",
    shadowColor: "#171717",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  hero: {
    backgroundColor: "#FFF1F2",
    padding: 20,
    borderRadius: 17,
    gap: 8,
    borderWidth: 1,
    borderColor: "#FDE5E7",
  },

  heroTitle: { fontSize: 22, color: colors.text, fontWeight: "800" },

  badge: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },

  subtitle: { fontSize: 19, fontWeight: "800", color: "#30343B" },

  body: { color: "#616874", fontSize: 15, lineHeight: 23 },

  input: {
    borderWidth: 1,
    borderColor: "#E8E9EC",
    padding: 15,
    borderRadius: 13,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.surface,
  },

  button: {
    backgroundColor: "#F20D1D",
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },

  secondaryButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FDE5E7",
  },

  secondaryText: { color: colors.primaryDark },

  dateText: { fontSize: 16, color: colors.primaryDark, paddingVertical: 8 },

  saving: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
  },
});

const baseStyles = StyleSheet.create({
  supplementaryTopBar: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    minHeight: 60,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  supplementaryHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  supplementaryRefresh: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  grow: { flex: 1 },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: 3 },
  content: {
    padding: 18,
    gap: 14,
    paddingBottom: 32,
    maxWidth: 860,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hero: {
    backgroundColor: colors.primaryLight,
    padding: 20,
    borderRadius: 17,
    gap: 8,
  },
  heroTitle: { fontSize: 24, color: colors.primaryDark, fontWeight: "700" },
  badge: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
  subtitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 23 },
  small: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  fieldLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    borderRadius: 13,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  dateText: { fontSize: 16, color: colors.primaryDark, paddingVertical: 8 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 13,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#FDE5E7",
  },
  secondaryText: { color: colors.primaryDark },
  disabled: { opacity: 0.45 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  history: {
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  error: { color: "#b91c1c", fontSize: 14, lineHeight: 22 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.6)",
    padding: 24,
  },
  dialog: {
    backgroundColor: colors.surface,
    width: "100%",
    maxWidth: 440,
    padding: 24,
    borderRadius: 18,
    gap: 18,
  },
  preview: {
    height: 150,
    width: "100%",
    borderRadius: 13,
    resizeMode: "cover",
  },
  viewer: { flex: 1, backgroundColor: "#0f172a", padding: 12 },
  viewerImage: { flex: 1, width: "100%" },
  saving: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
});
