import Ionicons from "@expo/vector-icons/Ionicons";
import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";

import { router, useFocusEffect } from "expo-router";

import { useCallback, useMemo, useRef, useState } from "react";

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

import { supabase } from "../../../../lib/supabase";

import { colors } from "../../../theme";

type Inspector = {
  id: string;

  name: string | null;
};

type VehicleItem = {
  visit_id: string;

  vehicle_id: string;

  vehicle_no: string;

  model: string | null;

  customer_name: string | null;

  current_stage: string;

  current_status: string;

  stage_started_at: string | null;

  assigned_to: string | null;

  assigned_to_name: string | null;

  job_id: string | null;

  job_type: string | null;

  advisor_id: string | null;

  inspection_attempts: number;

  last_inspection_result: string | null;

  last_inspection_at: string | null;

  last_failure_reason: string | null;
};

type ManagementQueue = {
  role: string;

  can_assign: boolean;

  items: VehicleItem[];

  inspectors: Inspector[];
};

type Filter = "ALL" | "UNASSIGNED" | "ASSIGNED" | "REINSPECTION";

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
    return `${hours}h ${minutes % 60}m`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ${hours % 24}h`;
}

function waitingMinutes(value?: string | null) {
  if (!value) {
    return 0;
  }

  const start = new Date(value).getTime();

  if (!Number.isFinite(start) || start > Date.now()) {
    return 0;
  }

  return Math.floor((Date.now() - start) / 60000);
}

function filterLabel(filter: Filter) {
  switch (filter) {
    case "UNASSIGNED":
      return "unassigned";

    case "ASSIGNED":
      return "assigned";

    case "REINSPECTION":
      return "reinspection";

    default:
      return "Final Inspection";
  }
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

export default function FinalInspectionManagementScreen() {
  const handleNavigationBack = () => {
    if (assigning) return;
    returnToRoute("/(tabs)/advisor");
  };
  useHardwareBack(handleNavigationBack);

  const [queue, setQueue] = useState<ManagementQueue>({
    role: "",

    can_assign: false,

    items: [],

    inspectors: [],
  });

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState<Filter>("ALL");

  const [assignmentVehicle, setAssignmentVehicle] =
    useState<VehicleItem | null>(null);

  const [selectedInspector, setSelectedInspector] = useState<Inspector | null>(
    null,
  );

  const [assignmentRemarks, setAssignmentRemarks] = useState("");

  const [assigning, setAssigning] = useState(false);

  const submitting = useRef(false);
  const loadRequest = useRef(0);

  const [popup, setPopup] = useState<{
    title: string;

    body: string;

    type: "success" | "error" | "info";
  } | null>(null);

  const loadQueue = useCallback(async (refresh = false) => {
    if (refresh && submitting.current) return;
    const request = ++loadRequest.current;
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const { data, error: queueError } = await supabase.rpc(
        "new_workflow_final_inspection_management_queue",
      );

      if (queueError) {
        throw queueError;
      }

      const result = data as ManagementQueue;

      if (
        !result ||
        !Array.isArray(result.items) ||
        !Array.isArray(result.inspectors)
      ) {
        throw new Error(
          "Final Inspection management queue returned an invalid response.",
        );
      }

      if (!["advisor", "ceo_admin"].includes(result.role)) {
        throw new Error(
          "You are not authorized to view Final Inspection management.",
        );
      }

      if (request === loadRequest.current) setQueue(result);
    } catch (e: any) {
      if (request !== loadRequest.current) return;
      console.error("Final Inspection management load error:", e);

      setError(e?.message || "Unable to load Final Inspection vehicles.");
      setQueue({ role: "", can_assign: false, items: [], inspectors: [] });
      setAssignmentVehicle(null);
    } finally {
      if (request === loadRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();

      return () => {
        loadRequest.current += 1;
      };
    }, [loadQueue]),
  );

  const counts = useMemo(() => {
    return {
      total: queue.items.length,

      unassigned: queue.items.filter((item) => !item.assigned_to).length,

      assigned: queue.items.filter((item) => !!item.assigned_to).length,

      reinspection: queue.items.filter((item) => item.inspection_attempts > 0)
        .length,
    };
  }, [queue.items]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return queue.items.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.vehicle_no,

          item.model,

          item.customer_name,

          item.assigned_to_name,

          item.job_type,
        ].some((value) => value?.toLowerCase().includes(query));

      if (!matchesSearch) {
        return false;
      }

      if (filter === "UNASSIGNED") {
        return !item.assigned_to;
      }

      if (filter === "ASSIGNED") {
        return !!item.assigned_to;
      }

      if (filter === "REINSPECTION") {
        return item.inspection_attempts > 0;
      }

      return true;
    });
  }, [queue.items, search, filter]);

  const openDetails = (item: VehicleItem) => {
    if (assigning || !item.visit_id) return;
    router.push({
      pathname: "/(tabs)/advisor/final_inspection_details" as any,

      params: {
        visitId: item.visit_id,
        returnTo: "final-inspection",
      },
    });
  };

  const openAssignment = (item: VehicleItem) => {
    if (assigning || loading || refreshing || !item.visit_id) return;
    if (!queue.can_assign) {
      setPopup({
        title: "Assignment Unavailable",

        body: "Final Inspector assignment is not available for this vehicle or account. Refresh the queue and try again.",

        type: "info",
      });

      return;
    }

    if (item.assigned_to) {
      setPopup({
        title: "Already Assigned",

        body: `${item.vehicle_no} is already assigned to ${
          item.assigned_to_name || "a Final Inspector"
        }.`,

        type: "info",
      });

      return;
    }

    setSelectedInspector(null);

    setAssignmentRemarks("");

    setAssignmentVehicle(item);
  };

  const assignInspector = async () => {
    if (
      !assignmentVehicle ||
      !selectedInspector ||
      assigning ||
      submitting.current ||
      loading ||
      refreshing ||
      !queue.can_assign
    ) {
      return;
    }

    submitting.current = true;

    try {
      setAssigning(true);

      /*



       * Backend is authoritative.



       *



       * new_workflow_assign_final_inspector



       * independently verifies:



       *



       * - Advisor or CEO Admin role

       * - Advisor ownership when the caller is an Advisor



       * - active Final Inspection stage



       * - vehicle not already assigned



       * - selected active Final Inspector



       */

      const { data: result, error } = await supabase.rpc(
        "new_workflow_assign_final_inspector",

        {
          p_visit_id: assignmentVehicle.visit_id,

          p_final_inspector_id: selectedInspector.id,

          p_remarks: assignmentRemarks.trim() || null,
        },
      );

      if (error) {
        throw error;
      }

      if (!result || result.success !== true) {
        throw new Error(
          "The assignment could not be confirmed. Refresh the queue before trying again.",
        );
      }

      const vehicleNo = assignmentVehicle.vehicle_no;

      const inspectorName = selectedInspector.name || "Final Inspector";

      setAssignmentVehicle(null);

      setSelectedInspector(null);

      setAssignmentRemarks("");

      await loadQueue();

      setPopup({
        title: "Final Inspector Assigned",

        body: `${vehicleNo} has been assigned to ${inspectorName}. The vehicle will now appear in that inspector's workspace.`,

        type: "success",
      });
    } catch (e: any) {
      console.error("Final Inspector assignment error:", e);

      setPopup({
        title: "Unable to Assign",

        body: e?.message || "Unable to assign the Final Inspector.",

        type: "error",
      });
    } finally {
      submitting.current = false;
      setAssigning(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "right", "bottom", "left"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.inspectionTopBar}>
        <BackButton
          accessibilityLabel="Back to dashboard"
          onPress={handleNavigationBack}
          disabled={assigning}
        />
        <BrandPill />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadQueue(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* HEADER */}

        <View style={styles.inspectionHero}>
          <View pointerEvents="none" style={styles.inspectionHeroCircleTop} />
          <View
            pointerEvents="none"
            style={styles.inspectionHeroCircleBottom}
          />
          <View style={styles.inspectionHeroContent}>
            <View style={styles.inspectionHeroHeading}>
              <View style={styles.inspectionHeroPill}>
                <Text style={styles.inspectionHeroPillText}>
                  {queue.role === "ceo_admin"
                    ? "CEO ADMIN WORKSPACE"
                    : "ADVISOR WORKSPACE"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => void loadQueue(true)}
                disabled={assigning || loading || refreshing}
                accessibilityRole="button"
                accessibilityLabel="Refresh Final Inspection queue"
                accessibilityState={{
                  disabled: assigning || loading || refreshing,
                }}
                style={styles.inspectionHeroRefresh}
              >
                {loading || refreshing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={19}
                    color={colors.white}
                  />
                )}
              </TouchableOpacity>
            </View>
            <Text accessibilityRole="header" style={styles.inspectionHeroTitle}>
              Final Inspection
            </Text>
            <Text style={styles.inspectionHeroDescription}>
              Monitor inspection progress and assign an active Final Inspector
              to vehicles awaiting assignment.
            </Text>
          </View>
        </View>

        {/* ROLE NOTICE */}

        <View
          style={[
            styles.roleCard,

            queue.role === "ceo_admin"
              ? styles.adminRoleCard
              : styles.advisorRoleCard,
          ]}
        >
          <Ionicons
            name={
              queue.role === "ceo_admin"
                ? "shield-checkmark-outline"
                : "person-circle-outline"
            }
            size={19}
            color={queue.role === "ceo_admin" ? "#217A50" : "#2563EB"}
          />

          <View
            style={{
              flex: 1,
            }}
          >
            <Text style={styles.roleTitle}>
              {queue.role
                ? `${queue.role === "ceo_admin" ? "CEO Admin" : "Advisor"} · ${queue.can_assign ? "Assignment enabled" : "Assignment unavailable"}`
                : "Final Inspection management"}
            </Text>

            <Text style={styles.roleText}>
              {queue.role === "ceo_admin"
                ? "Monitor all Final Inspection vehicles and assign unassigned vehicles to active Final Inspectors."
                : "Monitor your Final Inspection vehicles and assign an active Final Inspector to your own unassigned jobs."}
            </Text>
          </View>
        </View>

        {/* SNAPSHOT */}

        <TouchableOpacity
          accessibilityRole="button"
          disabled={assigning}
          onPress={() => router.push("/(tabs)/advisor/billing" as any)}
          style={styles.assignButtonPrimary}
        >
          <Text style={styles.assignButtonPrimaryText}>
            Advisor Billing Preparation
          </Text>
        </TouchableOpacity>

        <View style={styles.snapshotCard}>
          <View style={styles.snapshotHeadingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Final Inspection Snapshot</Text>

              <Text style={styles.snapshotHint}>
                Tap a card to filter the vehicle queue.
              </Text>
            </View>

            {filter !== "ALL" && (
              <TouchableOpacity
                onPress={() => setFilter("ALL")}
                activeOpacity={0.8}
                style={styles.clearFilterButton}
              >
                <Text style={styles.clearFilterText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.snapshotGrid}>
            <Snapshot
              value={counts.total}
              label="Total"
              helper="All vehicles"
              active={filter === "ALL"}
              onPress={() => setFilter("ALL")}
            />

            <Snapshot
              value={counts.unassigned}
              label="Unassigned"
              helper="Needs assignment"
              warning
              attention={counts.unassigned > 0}
              active={filter === "UNASSIGNED"}
              onPress={() => setFilter("UNASSIGNED")}
            />

            <Snapshot
              value={counts.assigned}
              label="Assigned"
              helper="Inspector assigned"
              active={filter === "ASSIGNED"}
              onPress={() => setFilter("ASSIGNED")}
            />

            <Snapshot
              value={counts.reinspection}
              label="Reinspection"
              helper="Previous attempt"
              active={filter === "REINSPECTION"}
              onPress={() => setFilter("REINSPECTION")}
            />
          </View>

          <View style={styles.showingRow}>
            <Ionicons
              name="funnel-outline"
              size={14}
              color={colors.textSecondary}
            />

            <Text style={styles.showingText}>
              Showing {visible.length} {filterLabel(filter)}{" "}
              {visible.length === 1 ? "vehicle" : "vehicles"}
            </Text>
          </View>
        </View>

        {/* NO INSPECTORS */}

        {queue.can_assign && !queue.inspectors.length && (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={22} color="#946200" />

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.warningTitle}>
                No Final Inspectors available
              </Text>

              <Text style={styles.warningText}>
                There are currently no active profiles with the final_inspector
                role. Create or update a user before assigning these vehicles.
              </Text>
            </View>
          </View>
        )}

        {/* ERROR */}

        {!!error && (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color={colors.error}
            />

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.errorTitle}>
                Unable to load Final Inspection
              </Text>

              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        )}

        {/* SEARCH */}

        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={19}
            color={colors.textSecondary}
          />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search vehicle, customer or inspector..."
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />

          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={19}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* LIST */}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Vehicles</Text>

          <Text style={styles.resultCount}>
            {filter === "ALL"
              ? "All Final Inspection vehicles"
              : `${filterLabel(filter)} queue`}
          </Text>
        </View>

        {loading && !queue.items.length ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />

            <Text style={styles.loadingText}>Loading Final Inspection…</Text>
          </View>
        ) : !visible.length ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="clipboard-outline"
              size={33}
              color={colors.primary}
            />

            <Text style={styles.emptyTitle}>No vehicles found</Text>

            <Text style={styles.emptyText}>
              No Final Inspection vehicles match the current filter.
            </Text>
          </View>
        ) : (
          <View style={styles.vehicleList}>
            {visible.map((item) => (
              <VehicleCard
                key={item.visit_id}
                item={item}
                canAssign={
                  queue.can_assign && !loading && !refreshing && !assigning
                }
                onOpen={() => openDetails(item)}
                onAssign={() => openAssignment(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ASSIGNMENT MODAL */}

      <Modal
        visible={!!assignmentVehicle}
        transparent
        animationType="fade"
        onRequestClose={() => !assigning && setAssignmentVehicle(null)}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Assign Final Inspector</Text>

            <Text style={styles.modalVehicle}>
              {assignmentVehicle?.vehicle_no}
            </Text>

            <Text style={styles.modalHint}>
              Select an active Final Inspector. The vehicle will appear in that
              inspector's personal workspace immediately.
            </Text>

            <ScrollView style={styles.inspectorList}>
              {!queue.inspectors.length ? (
                <View style={styles.noInspectorBox}>
                  <Text style={styles.noInspectorText}>
                    No active Final Inspectors are available.
                  </Text>
                </View>
              ) : (
                queue.inspectors.map((inspector) => {
                  const selected = selectedInspector?.id === inspector.id;

                  return (
                    <TouchableOpacity
                      key={inspector.id}
                      onPress={() => setSelectedInspector(inspector)}
                      style={[
                        styles.inspectorOption,

                        selected && styles.inspectorSelected,
                      ]}
                    >
                      <View style={styles.inspectorIcon}>
                        <Ionicons
                          name="person-outline"
                          size={20}
                          color={colors.primary}
                        />
                      </View>

                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text style={styles.inspectorName}>
                          {inspector.name || "Unnamed Final Inspector"}
                        </Text>

                        <Text style={styles.inspectorRole}>
                          Final Inspector
                        </Text>
                      </View>

                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={21}
                        color={selected ? colors.primary : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <Text style={styles.fieldLabel}>Assignment Remark (optional)</Text>

            <TextInput
              value={assignmentRemarks}
              onChangeText={setAssignmentRemarks}
              multiline
              maxLength={500}
              editable={!assigning}
              placeholder="Add assignment remark..."
              placeholderTextColor={colors.textSecondary}
              style={styles.remarkInput}
            />

            <TouchableOpacity
              disabled={
                !selectedInspector ||
                assigning ||
                loading ||
                refreshing ||
                !queue.can_assign
              }
              onPress={() => void assignInspector()}
              style={[
                styles.primaryButton,

                (!selectedInspector ||
                  assigning ||
                  loading ||
                  refreshing ||
                  !queue.can_assign) &&
                  styles.disabled,
              ]}
            >
              {assigning ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Assign Final Inspector
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              disabled={assigning}
              onPress={() => setAssignmentVehicle(null)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* POPUP */}

      <Modal
        visible={!!popup}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup(null)}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.popup}>
            <View
              style={[
                styles.popupIcon,

                {
                  backgroundColor:
                    popup?.type === "success"
                      ? "#E8F5EE"
                      : popup?.type === "error"
                        ? colors.dangerLight
                        : colors.primaryLight,
                },
              ]}
            >
              <Ionicons
                name={
                  popup?.type === "success"
                    ? "checkmark"
                    : popup?.type === "error"
                      ? "alert-circle-outline"
                      : "information-circle-outline"
                }
                size={28}
                color={
                  popup?.type === "success"
                    ? "#217A50"
                    : popup?.type === "error"
                      ? colors.error
                      : colors.primary
                }
              />
            </View>

            <Text style={styles.popupTitle}>{popup?.title}</Text>

            <Text style={styles.popupText}>{popup?.body}</Text>

            <TouchableOpacity
              onPress={() => setPopup(null)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function VehicleCard({
  item,

  canAssign,

  onOpen,

  onAssign,
}: {
  item: VehicleItem;

  canAssign: boolean;

  onOpen: () => void;

  onAssign: () => void;
}) {
  const assigned = !!item.assigned_to;

  const reinspection = item.inspection_attempts > 0;

  const waiting = elapsed(item.stage_started_at);

  const longWaiting = waitingMinutes(item.stage_started_at) >= 240;

  const workflowState = !assigned
    ? "Pending Assignment"
    : item.current_status === "IN_PROGRESS"
      ? "Inspection In Progress"
      : "Pending Inspection";

  return (
    <View style={styles.vehicleCard}>
      <TouchableOpacity onPress={onOpen} activeOpacity={0.85}>
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleIcon}>
            <Ionicons
              name="car-sport-outline"
              size={24}
              color={colors.primary}
            />
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text style={styles.vehicleNo}>{item.vehicle_no}</Text>

            <Text style={styles.vehicleModel}>
              {item.model || "Model not recorded"}
            </Text>
          </View>

          <View
            style={[
              styles.workflowBadge,

              !assigned
                ? styles.pendingAssignmentBadge
                : item.current_status === "IN_PROGRESS"
                  ? styles.inProgressBadge
                  : styles.pendingInspectionBadge,
            ]}
          >
            <Text
              style={[
                styles.workflowBadgeText,

                !assigned
                  ? styles.pendingAssignmentText
                  : item.current_status === "IN_PROGRESS"
                    ? styles.inProgressText
                    : styles.pendingInspectionText,
              ]}
            >
              {workflowState}
            </Text>
          </View>
        </View>

        <View style={styles.tags}>
          <Text style={styles.tag}>{formatJobType(item.job_type)}</Text>

          <View
            style={[styles.waitingTag, longWaiting && styles.waitingTagLong]}
          >
            <Ionicons
              name="time-outline"
              size={13}
              color={longWaiting ? "#946200" : colors.textSecondary}
            />

            <Text
              style={[
                styles.waitingTagText,

                longWaiting && styles.waitingTagTextLong,
              ]}
            >
              Waiting {waiting}
            </Text>
          </View>

          {reinspection && (
            <Text style={styles.reinspectionTag}>
              Reinspection · Attempt {item.inspection_attempts + 1}
            </Text>
          )}
        </View>

        <View style={styles.assignmentSummary}>
          <View style={styles.assignmentSummaryIcon}>
            <Ionicons
              name={assigned ? "person-outline" : "person-add-outline"}
              size={18}
              color={assigned ? "#217A50" : "#946200"}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.assignmentSummaryLabel}>
              {assigned ? "FINAL INSPECTOR" : "ASSIGNMENT REQUIRED"}
            </Text>

            <Text style={styles.assignmentSummaryValue}>
              {item.assigned_to_name || "No Final Inspector assigned"}
            </Text>
          </View>
        </View>

        <View style={styles.details}>
          <Info label="Customer" value={item.customer_name || "—"} />

          <Info
            label="Previous Attempts"
            value={String(item.inspection_attempts)}
          />
        </View>

        {item.last_inspection_result && (
          <View style={styles.previousBox}>
            <View style={styles.previousHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.previousLabel}>PREVIOUS INSPECTION</Text>

                <Text style={styles.previousResult}>
                  {item.last_inspection_result.replaceAll("_", " ")}
                </Text>
              </View>

              <Text style={styles.previousTime}>
                {formatDateTime(item.last_inspection_at)}
              </Text>
            </View>

            {!!item.last_failure_reason && (
              <View style={styles.failurePreview}>
                <Ionicons
                  name="alert-circle-outline"
                  size={15}
                  color={colors.error}
                />

                <Text style={styles.failureReason} numberOfLines={2}>
                  Previous issue: {item.last_failure_reason}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.cardFooter}>
        {!assigned && canAssign ? (
          <>
            <TouchableOpacity
              onPress={onAssign}
              activeOpacity={0.84}
              style={styles.assignButtonPrimary}
            >
              <Ionicons name="person-add-outline" size={17} color="#FFFFFF" />

              <Text style={styles.assignButtonPrimaryText}>
                Assign Inspector
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onOpen}
              activeOpacity={0.84}
              style={styles.detailsButtonSecondary}
            >
              <Text style={styles.detailsButtonSecondaryText}>
                View Details
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={onOpen}
            activeOpacity={0.84}
            style={styles.detailsButtonPrimary}
          >
            <Text style={styles.detailsButtonPrimaryText}>
              {assigned ? "View Inspection Details" : "View Details"}
            </Text>

            <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Info({
  label,

  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Snapshot({
  value,

  label,

  helper,

  warning = false,

  attention = false,

  active = false,

  onPress,
}: {
  value: number;

  label: string;

  helper: string;

  warning?: boolean;

  attention?: boolean;

  active?: boolean;

  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}: ${value}`}
      style={[
        styles.snapshot,

        attention && !active && styles.snapshotAttention,

        active && styles.snapshotActive,
      ]}
    >
      <View style={styles.snapshotTopRow}>
        <Text
          style={[
            styles.snapshotValue,

            warning && !active && { color: "#946200" },

            active && styles.snapshotValueActive,
          ]}
        >
          {value}
        </Text>

        {active ? (
          <View style={styles.snapshotSelectedIcon}>
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          </View>
        ) : attention ? (
          <View style={styles.snapshotAttentionDot} />
        ) : null}
      </View>

      <Text
        style={[styles.snapshotLabel, active && styles.snapshotLabelActive]}
      >
        {label}
      </Text>

      <Text
        style={[styles.snapshotHelper, active && styles.snapshotHelperActive]}
      >
        {helper}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inspectionTopBar: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  inspectionHero: {
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#F20D1D",
    position: "relative",
    shadowColor: "#F20D1D",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  inspectionHeroCircleTop: {
    position: "absolute",
    width: 145,
    height: 145,
    borderRadius: 73,
    right: -42,
    top: -67,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  inspectionHeroCircleBottom: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    right: 18,
    bottom: -57,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  inspectionHeroContent: { padding: 18, paddingTop: 12, gap: 5 },
  inspectionHeroHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  inspectionHeroPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.17)",
  },
  inspectionHeroPillText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  inspectionHeroRefresh: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  inspectionHeroTitle: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },
  inspectionHeroDescription: {
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 540,
    marginTop: 4,
  },

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

    gap: 16,
  },

  header: {
    flexDirection: "row",

    alignItems: "flex-start",

    gap: 12,
  },

  eyebrow: {
    color: colors.primary,

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 1,
  },

  headerTitle: {
    marginTop: 4,

    color: colors.text,

    fontSize: 25,

    fontWeight: "900",
  },

  headerSubtitle: {
    marginTop: 5,

    color: colors.textSecondary,

    fontSize: 12,

    lineHeight: 18,
  },

  refreshButton: {
    width: 44,

    height: 44,

    borderRadius: 13,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    alignItems: "center",

    justifyContent: "center",
  },

  roleCard: {
    paddingHorizontal: 13,

    paddingVertical: 10,

    borderRadius: 15,

    borderWidth: 1,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 10,
  },

  adminRoleCard: {
    backgroundColor: "#F4FBF7",

    borderColor: "#CDE9DA",
  },

  advisorRoleCard: {
    backgroundColor: "#EFF6FF",

    borderColor: "#D7E7FF",
  },

  roleTitle: {
    color: colors.text,

    fontSize: 13,

    fontWeight: "900",
  },

  roleText: {
    marginTop: 2,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 15,
  },

  snapshotCard: {
    padding: 17,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,
  },

  snapshotHeadingRow: {
    flexDirection: "row",

    alignItems: "flex-start",

    gap: 10,
  },

  snapshotHint: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 15,
  },

  clearFilterButton: {
    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 9,

    backgroundColor: colors.primaryLight,
  },

  clearFilterText: {
    color: colors.primaryDark,

    fontSize: 10,

    fontWeight: "900",
  },

  sectionTitle: {
    color: colors.text,

    fontSize: 18,

    fontWeight: "900",
  },

  snapshotGrid: {
    marginTop: 13,

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,
  },

  snapshot: {
    flexGrow: 1,

    flexBasis: 145,

    minWidth: 135,

    padding: 13,

    borderRadius: 12,

    backgroundColor: colors.background,

    borderWidth: 1,

    borderColor: colors.border,
  },

  snapshotAttention: {
    backgroundColor: "#FFF9E8",

    borderColor: "#E7C66A",
  },

  snapshotActive: {
    borderColor: colors.primary,

    backgroundColor: colors.primaryLight,

    shadowColor: colors.primary,

    shadowOpacity: 0.1,

    shadowRadius: 6,

    shadowOffset: { width: 0, height: 2 },

    elevation: 2,
  },

  snapshotTopRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: 8,
  },

  snapshotSelectedIcon: {
    width: 22,

    height: 22,

    borderRadius: 11,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",
  },

  snapshotAttentionDot: {
    width: 8,

    height: 8,

    borderRadius: 4,

    backgroundColor: "#B77C00",
  },

  snapshotValue: {
    color: colors.text,

    fontSize: 22,

    fontWeight: "900",
  },

  snapshotLabel: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 10,

    fontWeight: "700",
  },

  snapshotValueActive: {
    color: colors.primaryDark,
  },

  snapshotLabelActive: {
    color: colors.primaryDark,

    fontWeight: "900",
  },

  snapshotHelper: {
    marginTop: 3,

    color: colors.textSecondary,

    fontSize: 9,

    lineHeight: 13,
  },

  snapshotHelperActive: {
    color: colors.primaryDark,
  },

  showingRow: {
    marginTop: 12,

    paddingTop: 11,

    borderTopWidth: 1,

    borderTopColor: colors.border,

    flexDirection: "row",

    alignItems: "center",

    gap: 6,
  },

  showingText: {
    color: colors.textSecondary,

    fontSize: 10,

    fontWeight: "700",
  },

  warningCard: {
    padding: 14,

    borderRadius: 14,

    backgroundColor: "#FFF6DD",

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 10,
  },

  warningTitle: {
    color: "#946200",

    fontSize: 13,

    fontWeight: "900",
  },

  warningText: {
    marginTop: 3,

    color: "#946200",

    fontSize: 11,

    lineHeight: 17,
  },

  errorCard: {
    padding: 14,

    borderRadius: 14,

    backgroundColor: colors.dangerLight,

    flexDirection: "row",

    gap: 10,
  },

  errorTitle: {
    color: colors.error,

    fontSize: 13,

    fontWeight: "900",
  },

  errorText: {
    marginTop: 3,

    color: colors.error,

    fontSize: 11,

    lineHeight: 17,
  },

  searchBox: {
    minHeight: 49,

    paddingHorizontal: 13,

    borderRadius: 14,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  searchInput: {
    flex: 1,

    color: colors.text,

    fontSize: 14,
  },

  listHeader: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  resultCount: {
    color: colors.textSecondary,

    fontSize: 11,
  },

  loading: {
    minHeight: 180,

    alignItems: "center",

    justifyContent: "center",

    gap: 10,
  },

  loadingText: {
    color: colors.textSecondary,

    fontSize: 12,
  },

  emptyCard: {
    padding: 30,

    borderRadius: 17,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

    alignItems: "center",
  },

  emptyTitle: {
    marginTop: 12,

    color: colors.text,

    fontSize: 17,

    fontWeight: "900",
  },

  emptyText: {
    marginTop: 5,

    color: colors.textSecondary,

    fontSize: 12,

    textAlign: "center",
  },

  vehicleList: {
    gap: 13,
  },

  vehicleCard: {
    padding: 17,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,
  },

  vehicleHeader: {
    flexDirection: "row",

    alignItems: "center",

    gap: 11,
  },

  vehicleIcon: {
    width: 45,

    height: 45,

    borderRadius: 13,

    backgroundColor: colors.primaryLight,

    alignItems: "center",

    justifyContent: "center",
  },

  vehicleNo: {
    color: colors.text,

    fontSize: 19,

    fontWeight: "900",
  },

  vehicleModel: {
    marginTop: 2,

    color: colors.textSecondary,

    fontSize: 11,
  },

  workflowBadge: {
    maxWidth: 145,

    paddingHorizontal: 9,

    paddingVertical: 6,

    borderRadius: 999,
  },

  pendingAssignmentBadge: {
    backgroundColor: "#FFF6DD",
  },

  pendingInspectionBadge: {
    backgroundColor: "#EFF6FF",
  },

  inProgressBadge: {
    backgroundColor: "#E8F5EE",
  },

  workflowBadgeText: {
    fontSize: 9,

    fontWeight: "900",

    textAlign: "center",
  },

  pendingAssignmentText: {
    color: "#946200",
  },

  pendingInspectionText: {
    color: "#2563EB",
  },

  inProgressText: {
    color: "#217A50",
  },

  tags: {
    marginTop: 12,

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 6,
  },

  tag: {
    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 7,

    backgroundColor: colors.background,

    color: colors.textSecondary,

    fontSize: 10,

    fontWeight: "700",
  },

  waitingTag: {
    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 7,

    backgroundColor: colors.background,

    flexDirection: "row",

    alignItems: "center",

    gap: 4,
  },

  waitingTagLong: {
    backgroundColor: "#FFF6DD",
  },

  waitingTagText: {
    color: colors.textSecondary,

    fontSize: 10,

    fontWeight: "700",
  },

  waitingTagTextLong: {
    color: "#946200",

    fontWeight: "900",
  },

  reinspectionTag: {
    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 7,

    backgroundColor: colors.primaryLight,

    color: colors.primaryDark,

    fontSize: 10,

    fontWeight: "800",
  },

  assignmentSummary: {
    marginTop: 12,

    padding: 11,

    borderRadius: 11,

    backgroundColor: colors.background,

    flexDirection: "row",

    alignItems: "center",

    gap: 9,
  },

  assignmentSummaryIcon: {
    width: 36,

    height: 36,

    borderRadius: 10,

    backgroundColor: colors.surface,

    alignItems: "center",

    justifyContent: "center",
  },

  assignmentSummaryLabel: {
    color: colors.textSecondary,

    fontSize: 8,

    fontWeight: "900",

    letterSpacing: 0.6,
  },

  assignmentSummaryValue: {
    marginTop: 3,

    color: colors.text,

    fontSize: 12,

    fontWeight: "900",
  },

  details: {
    marginTop: 10,

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,
  },

  info: {
    width: "48%",

    flexGrow: 1,

    padding: 10,

    borderRadius: 10,

    backgroundColor: colors.background,
  },

  infoLabel: {
    color: colors.textSecondary,

    fontSize: 9,

    fontWeight: "700",
  },

  infoValue: {
    marginTop: 4,

    color: colors.text,

    fontSize: 12,

    fontWeight: "900",
  },

  previousBox: {
    marginTop: 12,

    padding: 11,

    borderRadius: 11,

    backgroundColor: "#FFF9F9",
  },

  previousHeader: {
    flexDirection: "row",

    alignItems: "flex-start",

    justifyContent: "space-between",

    gap: 10,
  },

  previousLabel: {
    color: colors.primary,

    fontSize: 9,

    fontWeight: "900",
  },

  previousResult: {
    marginTop: 3,

    color: colors.text,

    fontSize: 12,

    fontWeight: "900",
  },

  previousTime: {
    marginTop: 2,

    color: colors.textSecondary,

    fontSize: 10,
  },

  failurePreview: {
    marginTop: 8,

    paddingTop: 8,

    borderTopWidth: 1,

    borderTopColor: "#F3C8CB",

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 6,
  },

  failureReason: {
    flex: 1,

    color: colors.textSecondary,

    fontSize: 10,

    lineHeight: 16,
  },

  cardFooter: {
    marginTop: 13,

    paddingTop: 12,

    borderTopWidth: 1,

    borderTopColor: colors.border,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: 8,
  },

  detailsButton: {
    flexDirection: "row",

    alignItems: "center",

    gap: 3,
  },

  detailsButtonText: {
    color: colors.primary,

    fontSize: 11,

    fontWeight: "800",
  },

  assignButton: {
    minHeight: 39,

    paddingHorizontal: 12,

    borderRadius: 10,

    backgroundColor: colors.primary,

    flexDirection: "row",

    alignItems: "center",

    gap: 6,
  },

  assignButtonText: {
    color: "#FFFFFF",

    fontSize: 11,

    fontWeight: "900",
  },

  assignButtonPrimary: {
    flex: 1,

    minHeight: 43,

    paddingHorizontal: 12,

    borderRadius: 11,

    backgroundColor: colors.primary,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 6,
  },

  assignButtonPrimaryText: {
    color: "#FFFFFF",

    fontSize: 11,

    fontWeight: "900",
  },

  detailsButtonSecondary: {
    minHeight: 43,

    paddingHorizontal: 13,

    borderRadius: 11,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

    alignItems: "center",

    justifyContent: "center",
  },

  detailsButtonSecondaryText: {
    color: colors.textSecondary,

    fontSize: 11,

    fontWeight: "800",
  },

  detailsButtonPrimary: {
    flex: 1,

    minHeight: 43,

    paddingHorizontal: 14,

    borderRadius: 11,

    backgroundColor: colors.primary,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 5,
  },

  detailsButtonPrimaryText: {
    color: "#FFFFFF",

    fontSize: 11,

    fontWeight: "900",
  },

  overlay: {
    flex: 1,

    padding: 20,

    backgroundColor: "rgba(15,23,42,.6)",

    alignItems: "center",

    justifyContent: "center",
  },

  modal: {
    width: "100%",

    maxWidth: 470,

    maxHeight: "88%",

    padding: 20,

    borderRadius: 20,

    backgroundColor: colors.surface,
  },

  modalTitle: {
    color: colors.text,

    fontSize: 20,

    fontWeight: "900",
  },

  modalVehicle: {
    marginTop: 4,

    color: colors.primary,

    fontSize: 15,

    fontWeight: "900",
  },

  modalHint: {
    marginTop: 7,

    color: colors.textSecondary,

    fontSize: 11,

    lineHeight: 17,
  },

  inspectorList: {
    maxHeight: 260,

    marginTop: 14,

    marginBottom: 14,
  },

  inspectorOption: {
    marginBottom: 8,

    padding: 12,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.background,

    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  inspectorSelected: {
    borderColor: colors.primary,

    backgroundColor: colors.primaryLight,
  },

  inspectorIcon: {
    width: 39,

    height: 39,

    borderRadius: 11,

    backgroundColor: colors.surface,

    alignItems: "center",

    justifyContent: "center",
  },

  inspectorName: {
    color: colors.text,

    fontSize: 13,

    fontWeight: "900",
  },

  inspectorRole: {
    marginTop: 2,

    color: colors.textSecondary,

    fontSize: 10,
  },

  noInspectorBox: {
    padding: 15,

    borderRadius: 12,

    backgroundColor: "#FFF6DD",
  },

  noInspectorText: {
    color: "#946200",

    fontSize: 11,

    lineHeight: 17,
  },

  fieldLabel: {
    color: colors.text,

    fontSize: 12,

    fontWeight: "800",
  },

  remarkInput: {
    marginTop: 7,

    minHeight: 80,

    padding: 12,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.background,

    color: colors.text,

    fontSize: 13,

    textAlignVertical: "top",
  },

  primaryButton: {
    marginTop: 14,

    minHeight: 48,

    paddingHorizontal: 15,

    borderRadius: 12,

    backgroundColor: colors.primary,

    alignItems: "center",

    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",

    fontSize: 13,

    fontWeight: "900",

    textAlign: "center",
  },

  secondaryButton: {
    marginTop: 8,

    minHeight: 46,

    borderRadius: 12,

    backgroundColor: colors.background,

    alignItems: "center",

    justifyContent: "center",
  },

  secondaryButtonText: {
    color: colors.textSecondary,

    fontSize: 12,

    fontWeight: "800",
  },

  disabled: {
    opacity: 0.45,
  },

  popup: {
    width: "100%",

    maxWidth: 410,

    padding: 22,

    borderRadius: 19,

    backgroundColor: colors.surface,
  },

  popupIcon: {
    width: 55,

    height: 55,

    borderRadius: 28,

    alignItems: "center",

    justifyContent: "center",

    marginBottom: 12,
  },

  popupTitle: {
    color: colors.text,

    fontSize: 19,

    fontWeight: "900",
  },

  popupText: {
    marginTop: 7,

    color: colors.textSecondary,

    fontSize: 12,

    lineHeight: 19,
  },
});
