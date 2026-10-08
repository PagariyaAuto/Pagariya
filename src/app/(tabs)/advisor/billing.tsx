import { Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import useDateTimeValidation from "../../../components/inputs/useDateTimeValidation";
import DateTimeField from "../../../components/inputs/DateTimeField";
import { parseIndiaLocal } from "../../../lib/date-time";
import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import { returnToRoute, useHardwareBack, singleParam } from "../../../lib/back-navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../lib/supabase";
import { colors } from "../../../theme";

type Executive = { id: string; name: string | null };
type Handoff = {
  pre_invoice_sent_at: string | null;
  liability_received_at: string | null;
  details_verified_at: string | null;
};
type Item = {
  visit_id: string;
  vehicle_no: string;
  model: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  job_type: "PAID" | "INSURANCE";
  job_card_no: string | null;
  claim_no: string | null;
  estimate_id: string | null;
  vehicle_type: string | null;
  insurance_company: string | null;
  approval_status: string | null;
  approval_at: string | null;
  advisor_remarks: string | null;
  inspection_at: string | null;
  inspection_remarks: string | null;
  completed_work: string[];
  handoff: Handoff | null;
};
type Queue = { role: string; items: Item[]; executives: Executive[] };
type Notice = { title: string; body: string };
const emptyQueue: Queue = { role: "", items: [], executives: [] };

type QueueFilter = "ALL" | "PAID" | "INSURANCE" | "AWAITING" | "READY";
const queueFilters: { key: QueueFilter; label: string }[] = [
  { key: "ALL", label: "All vehicles" },
  { key: "PAID", label: "Paid" },
  { key: "INSURANCE", label: "Insurance" },
  { key: "AWAITING", label: "Awaiting liability" },
  { key: "READY", label: "Ready to assign" },
];
function preparationState(item: Item) {
  if (item.job_type === "PAID") {
    return item.handoff?.details_verified_at ? "READY" : "VERIFY";
  }
  if (item.handoff?.pre_invoice_sent_at && item.handoff?.liability_received_at)
    return "READY";
  return item.handoff?.pre_invoice_sent_at ? "AWAITING" : "PRE_INVOICE";
}
function preparationLabel(item: Item) {
  switch (preparationState(item)) {
    case "READY":
      return "Ready to assign";
    case "AWAITING":
      return "Awaiting liability";
    case "VERIFY":
      return "Verification pending";
    default:
      return "Pre-invoice pending";
  }
}
function nextAction(item: Item) {
  switch (preparationState(item)) {
    case "READY":
      return "Select a Billing Executive and transfer the vehicle.";
    case "AWAITING":
      return "Record liability received before assigning Billing.";
    case "VERIFY":
      return "Review customer, job and inspection details.";
    default:
      return "Record the pre-invoice sent date and time.";
  }
}
function formatTime(value: string | null) {
  if (!value) return "Not recorded";
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
function indiaInput(value: string | null = null) {
  const d = new Date(
    (value ? new Date(value).getTime() : Date.now()) + 330 * 60000,
  );
  return d.toISOString().slice(0, 16).replace("T", " ");
}
function parseIndiaInput(input: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input))
    throw new Error("Enter the date and time as YYYY-MM-DD HH:mm, in IST.");
  const d = new Date(input.replace(" ", "T") + ":00+05:30");
  if (!Number.isFinite(d.getTime()) || indiaInput(d.toISOString()) !== input)
    throw new Error("Enter a valid date and time.");
  if (d.getTime() > Date.now())
    throw new Error("The date and time cannot be in the future.");
  return d.toISOString();
}

export default function AdvisorBillingScreen() {
  const dateValidation = useDateTimeValidation();
  const navigationParams = useLocalSearchParams<{ returnTo?: string | string[]; returnVisitId?: string | string[]; floor?: string | string[]; filter?: string | string[] }>();
  const handleNavigationBack = () => {
    if (saving) return;
    if (selectedId) {
      setSelectedId(null);
      router.setParams({ returnVisitId: "" });
    } else {
      returnToRoute("/(tabs)/advisor");
    }
  };
  useHardwareBack(handleNavigationBack);

  const [queue, setQueue] = useState<Queue>(emptyQueue);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [preSent, setPreSent] = useState(false);
  const [liabilityReceived, setLiabilityReceived] = useState(false);
  const [preTime, setPreTime] = useState(indiaInput());
  const [liabilityTime, setLiabilityTime] = useState(indiaInput());
  const [verified, setVerified] = useState(false);
  const [executiveId, setExecutiveId] = useState("");
  const [remarks, setRemarks] = useState("");
  const busy = useRef(false);
  const requests = useRef(0);
  const selected =
    queue.items.find((item) => item.visit_id === selectedId) || null;
  const metrics = useMemo(
    () => ({
      total: queue.items.length,
      pending: queue.items.filter((item) =>
        ["VERIFY", "PRE_INVOICE"].includes(preparationState(item)),
      ).length,
      awaiting: queue.items.filter(
        (item) => preparationState(item) === "AWAITING",
      ).length,
      ready: queue.items.filter((item) => preparationState(item) === "READY")
        .length,
    }),
    [queue.items],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return queue.items.filter((item) => {
      const matchesSearch = [
        item.vehicle_no,
        item.model,
        item.customer_name,
        item.job_card_no,
      ].some((value) => value?.toLowerCase().includes(query));
      const matchesFilter =
        filter === "ALL" ||
        item.job_type === filter ||
        preparationState(item) === filter;
      return matchesSearch && matchesFilter;
    });
  }, [queue.items, search, filter]);
  const returnedVisit = singleParam(navigationParams.returnVisitId);
  useEffect(() => {
    if (!loading && returnedVisit && queue.items.some(item => item.visit_id === returnedVisit)) {
      setSelectedId(returnedVisit);
      router.setParams({ returnVisitId: "" });
    }
  }, [loading, returnedVisit, queue.items]);

  const load = useCallback(async (refresh = false, afterSave = false) => {
    if (busy.current && !afterSave) return;
    const request = ++requests.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "new_workflow_advisor_billing_queue",
      );
      if (rpcError) throw rpcError;
      const result = data as Queue;
      if (
        !result ||
        !["advisor", "ceo_admin"].includes(result.role) ||
        !Array.isArray(result.items) ||
        !Array.isArray(result.executives)
      )
        throw new Error("The Advisor Billing queue could not be loaded.");
      if (request === requests.current) {
        setQueue(result);
        setSelectedId((id) =>
          result.items.some((item) => item.visit_id === id) ? id : null,
        );
      }
    } catch (e: any) {
      if (request === requests.current) {
        setError(e?.message || "Unable to load Billing preparation.");
        setQueue(emptyQueue);
        setSelectedId(null);
      }
    } finally {
      if (request === requests.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requests.current += 1;
      };
    }, [load]),
  );
  useEffect(() => {
    setPreSent(!!selected?.handoff?.pre_invoice_sent_at);
    setLiabilityReceived(!!selected?.handoff?.liability_received_at);
    setPreTime(indiaInput(selected?.handoff?.pre_invoice_sent_at || null));
    setLiabilityTime(
      indiaInput(selected?.handoff?.liability_received_at || null),
    );
    setVerified(!!selected?.handoff?.details_verified_at);
    setExecutiveId("");
    setRemarks("");
    setConfirmTransfer(false);
  }, [selectedId]);
  useEffect(() => {
    if (selected?.handoff?.pre_invoice_sent_at) {
      setPreSent(true);
      setPreTime(indiaInput(selected.handoff.pre_invoice_sent_at));
    }
    if (selected?.handoff?.liability_received_at) {
      setLiabilityReceived(true);
      setLiabilityTime(indiaInput(selected.handoff.liability_received_at));
    }
    if (selected?.handoff?.details_verified_at) setVerified(true);
  }, [
    selected?.handoff?.pre_invoice_sent_at,
    selected?.handoff?.liability_received_at,
    selected?.handoff?.details_verified_at,
  ]);

  const disabled = saving || loading || refreshing;
  const ready =
    !!selected &&
    (selected.job_type === "INSURANCE"
      ? preSent && liabilityReceived
      : verified);
  const values = () => {
    const dateError = dateValidation.getError();
    if (dateError) throw new Error(dateError);
    if (!selected) throw new Error("Select a vehicle.");
    if (selected.job_type === "PAID") {
      if (!verified)
        throw new Error(
          "Check and verify the Paid job details before continuing.",
        );
      return {
        p_visit_id: selected.visit_id,
        p_pre_invoice_sent_at: null,
        p_liability_received_at: null,
        p_details_verified: true,
      };
    }
    const pre =
      selected.handoff?.pre_invoice_sent_at ||
      (preSent ? parseIndiaInput(preTime) : null);
    const liability =
      selected.handoff?.liability_received_at ||
      (liabilityReceived ? parseIndiaInput(liabilityTime) : null);
    if (!pre)
      throw new Error(
        "Confirm that the pre-invoice has been sent and enter its date and time.",
      );
    if (liability && new Date(liability).getTime() < new Date(pre).getTime())
      throw new Error(
        "Liability received cannot be earlier than pre-invoice sent.",
      );
    return {
      p_visit_id: selected.visit_id,
      p_pre_invoice_sent_at: pre,
      p_liability_received_at: liability,
      p_details_verified: false,
    };
  };
  const save = async (transfer: boolean) => {
    if (!selected || busy.current || disabled) return;
    try {
      const payload = values();
      if (
        transfer &&
        (!ready ||
          !executiveId ||
          !queue.executives.some((person) => person.id === executiveId))
      )
        throw new Error(
          "Complete the Advisor requirements and select an active Billing Executive.",
        );
      busy.current = true;
      setSaving(true);
      setConfirmTransfer(false);
      const { data, error: saveError } = await supabase.rpc(
        "new_workflow_save_advisor_billing",
        payload,
      );
      if (saveError) throw saveError;
      if (data?.success !== true)
        throw new Error(
          "The saved progress could not be confirmed. Refresh before trying again.",
        );
      if (transfer) {
        const { data: result, error: transferError } = await supabase.rpc(
          "new_workflow_transfer_to_billing",
          {
            p_visit_id: selected.visit_id,
            p_billing_executive_id: executiveId,
            p_remarks: remarks.trim() || null,
          },
        );
        if (transferError) throw transferError;
        if (result?.success !== true)
          throw new Error(
            "The transfer could not be confirmed. Refresh before trying again.",
          );
        setSelectedId(null);
        setNotice({
          title: "Transferred to Billing",
          body: `${selected.vehicle_no} has been assigned to the selected Billing Executive. Your Advisor preparation has been recorded.`,
        });
      } else {
        setNotice({
          title: "Advisor progress saved",
          body:
            selected.job_type === "INSURANCE" &&
            !payload.p_liability_received_at
              ? "Pre-invoice sent is recorded. Return here when liability is received."
              : "The Advisor requirements are recorded. You can now assign a Billing Executive.",
        });
      }
      await load(true, true);
    } catch (e: any) {
      setConfirmTransfer(false);
      setNotice({
        title: "Unable to continue",
        body: e?.message || "Refresh and try again.",
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const requestTransfer = () => {
    try {
      values();
      setConfirmTransfer(true);
    } catch (e: any) {
      setNotice({ title: "Check Advisor requirements", body: e.message });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <BackButton disabled={saving} onPress={handleNavigationBack} />
        <BrandPill />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.pageHeader}>
          <View style={styles.grow}>
            <Text style={styles.pageEyebrow}>
              PAGARIYA AUTO · ADVISOR WORKSPACE
            </Text>
            <Text style={styles.pageTitle}>
              {selected ? "Vehicle preparation" : "Billing Preparation"}
            </Text>
            <Text style={styles.body}>
              {selected
                ? "Review the details and complete the handoff."
                : "Prepare inspected vehicles for the Billing department."}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh Billing preparation"
            disabled={disabled}
            onPress={() => void load(true)}
            style={[styles.refreshButton, disabled && styles.disabled]}
          >
            {loading || refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={21}
                color={colors.primary}
              />
            )}
          </Pressable>
        </View>
        <View style={styles.hero}>
          <View style={styles.heroCircle} />
          <View style={styles.heroHeading}>
            <View style={styles.heroTag}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="white"
              />
              <Text style={styles.heroPill}>FINAL INSPECTION PASSED</Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="receipt-outline" size={25} color="white" />
            </View>
          </View>
          <Text style={styles.heroTitle}>
            {selected?.vehicle_no || "Complete the next handoff"}
          </Text>
          <Text style={styles.heroText}>
            {selected
              ? `${selected.model || "Model not recorded"} · ${selected.job_type === "PAID" ? "Paid" : "Insurance"} job`
              : "Verify Paid jobs or record Insurance pre-invoice and liability, then assign a Billing Executive."}
          </Text>
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>Inspection passed</Text>
            <Ionicons name="chevron-forward" size={13} color="white" />
            <Text style={styles.heroFooterText}>Advisor preparation</Text>
            <Ionicons name="chevron-forward" size={13} color="white" />
            <Text style={styles.heroFooterText}>Billing</Text>
          </View>
        </View>
        {!selected && (
          <View style={styles.metrics}>
            {[
              {
                label: "In preparation",
                value: metrics.total,
                icon: "car-outline",
                color: colors.primary,
                background: colors.primaryLight,
              },
              {
                label: "Action pending",
                value: metrics.pending,
                icon: "document-text-outline",
                color: "#596273",
                background: "#F0F2F5",
              },
              {
                label: "Awaiting liability",
                value: metrics.awaiting,
                icon: "time-outline",
                color: "#946200",
                background: "#FFF6DD",
              },
              {
                label: "Ready to assign",
                value: metrics.ready,
                icon: "checkmark-circle-outline",
                color: "#217A50",
                background: "#E8F5EE",
              },
            ].map((metric) => (
              <View key={metric.label} style={styles.metric}>
                <View
                  style={[
                    styles.metricIcon,
                    { backgroundColor: metric.background },
                  ]}
                >
                  <Ionicons
                    name={metric.icon as any}
                    size={20}
                    color={metric.color}
                  />
                </View>
                <Text style={styles.metricValue}>
                  {loading || error ? "—" : metric.value}
                </Text>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
        )}
        {saving && (
          <View style={styles.inline}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>Saving…</Text>
          </View>
        )}
        {!!error && (
          <View style={styles.card}>
            <Text style={styles.title}>Preparation unavailable</Text>
            <Text style={styles.body}>{error}</Text>
            <Button
              title="Refresh"
              onPress={() => void load()}
              disabled={disabled}
            />
          </View>
        )}
        {loading && !queue.items.length && (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
        {!selected && !error && !loading && (
          <>
            <View style={styles.sectionHeading}>
              <View style={styles.grow}>
                <Text style={styles.title}>Preparation queue</Text>
                <Text style={styles.body}>
                  Choose a vehicle to review and continue.
                </Text>
              </View>
              <View style={styles.sectionCounter}>
                <Text style={styles.sectionCounterText}>
                  {queue.items.length}
                </Text>
              </View>
            </View>
            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                accessibilityLabel="Search Billing preparation vehicles"
                value={search}
                onChangeText={setSearch}
                placeholder="Vehicle, customer or job card"
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
                style={styles.searchInput}
              />
              {!!search && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearch("")}
                  style={styles.clearSearch}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>
            <View style={styles.filters}>
              {queueFilters.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === option.key }}
                  onPress={() => setFilter(option.key)}
                  style={[
                    styles.filter,
                    filter === option.key && styles.filterSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      filter === option.key && styles.filterTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              Showing {visible.length} of {queue.items.length} vehicle
              {queue.items.length === 1 ? "" : "s"} · Status reflects saved
              preparation
            </Text>
            <View style={styles.vehicleGrid}>
              {visible.map((item) => {
                const state = preparationState(item);
                const stateColor =
                  state === "READY"
                    ? "#217A50"
                    : state === "AWAITING"
                      ? "#946200"
                      : colors.primaryDark;
                const stateBackground =
                  state === "READY"
                    ? "#E8F5EE"
                    : state === "AWAITING"
                      ? "#FFF6DD"
                      : colors.primaryLight;
                return (
                  <Pressable
                    key={item.visit_id}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.vehicle_no}, ${preparationLabel(item)}. Open preparation.`}
                    onPress={() => setSelectedId(item.visit_id)}
                    style={({ pressed }) => [
                      styles.vehicleCard,
                      pressed && styles.cardPressed,
                      disabled && styles.disabled,
                    ]}
                  >
                    <View style={styles.vehicleHeading}>
                      <View style={styles.vehicleIcon}>
                        <Ionicons
                          name="car-outline"
                          size={22}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.grow}>
                        <Text style={styles.vehicleNumber}>
                          {item.vehicle_no}
                        </Text>
                        <Text style={styles.body}>
                          {item.model || "Model not recorded"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.jobBadge,
                          item.job_type === "INSURANCE" &&
                            styles.insuranceBadge,
                        ]}
                      >
                        {item.job_type === "PAID" ? "Paid" : "Insurance"}
                      </Text>
                    </View>
                    <View style={styles.vehicleDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons
                          name="person-outline"
                          size={15}
                          color={colors.textSecondary}
                        />
                        <Text style={[styles.body, styles.grow]}>
                          {item.customer_name || "Customer not recorded"}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons
                          name="document-text-outline"
                          size={15}
                          color={colors.textSecondary}
                        />
                        <Text style={[styles.body, styles.grow]}>
                          Job card · {item.job_card_no || "Not recorded"}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statePill,
                        { backgroundColor: stateBackground },
                      ]}
                    >
                      <Ionicons
                        name={
                          state === "READY"
                            ? "checkmark-circle-outline"
                            : "time-outline"
                        }
                        size={14}
                        color={stateColor}
                      />
                      <Text style={[styles.stateText, { color: stateColor }]}>
                        {preparationLabel(item)}
                      </Text>
                    </View>
                    <Text style={styles.hint}>Next: {nextAction(item)}</Text>
                    <View style={styles.vehicleFooter}>
                      <Text style={styles.vehicleAction}>
                        {state === "READY"
                          ? "Assign Billing Executive"
                          : "Continue preparation"}
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {!visible.length && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={
                      queue.items.length
                        ? "search-outline"
                        : "checkmark-circle-outline"
                    }
                    size={30}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.title}>
                  {queue.items.length
                    ? "No matching vehicles"
                    : "Your preparation queue is clear"}
                </Text>
                <Text style={[styles.body, styles.emptyText]}>
                  {queue.items.length
                    ? "Try another search or filter to find a vehicle."
                    : "Vehicles appear here after passing Final Inspection. Complete Advisor preparation here before assigning Billing."}
                </Text>
                {!!queue.items.length && (
                  <Button
                    secondary
                    title="Clear Search & Filters"
                    onPress={() => {
                      setSearch("");
                      setFilter("ALL");
                    }}
                  />
                )}
              </View>
            )}
            <View style={styles.workflowNote}>
              <Ionicons
                name="information-circle-outline"
                size={21}
                color={colors.primary}
              />
              <Text style={[styles.body, styles.grow]}>
                Paid: verify details and assign. Insurance: record pre-invoice
                and liability, then assign. Billing records the Bill No.,
                invoices and payment details.
              </Text>
            </View>
          </>
        )}
        {selected && (
          <>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>VERIFY EXISTING DETAILS</Text>
              <Text style={styles.title}>Customer & job details</Text>
              <View style={styles.grid}>
                <Detail label="Customer" value={selected.customer_name} />
                <Detail
                  label="Mobile number"
                  value={selected.customer_mobile}
                />
                <Detail label="Job card" value={selected.job_card_no} />
                <Detail label="Vehicle type" value={selected.vehicle_type} />
                <Detail label="Approval" value={selected.approval_status} />
                <Detail
                  label="Inspection passed"
                  value={formatTime(selected.inspection_at)}
                />
                {selected.job_type === "INSURANCE" && (
                  <>
                    <Detail
                      label="Insurance company"
                      value={selected.insurance_company}
                    />
                    <Detail label="Claim number" value={selected.claim_no} />
                    <Detail label="Estimate ID" value={selected.estimate_id} />
                  </>
                )}
              </View>
              <Text style={styles.body}>
                Completed work:{" "}
                {selected.completed_work.join(", ") || "See Floor history"}
              </Text>
              {!!selected.advisor_remarks && (
                <Text style={styles.body}>
                  Advisor remarks: {selected.advisor_remarks}
                </Text>
              )}
              {!!selected.inspection_remarks && (
                <Text style={styles.body}>
                  Inspection remarks: {selected.inspection_remarks}
                </Text>
              )}
              <Button
                secondary
                title="View Inspection & Rework History"
                disabled={disabled}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/advisor/final_inspection_details" as any,
                    params: { visitId: selected.visit_id, returnTo: "billing" },
                  })
                }
              />
            </View>
            {selected.job_type === "INSURANCE" ? (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>
                  INSURANCE · ADVISOR REQUIREMENTS
                </Text>
                <Text style={styles.title}>Pre-invoice & liability</Text>
                <Text style={styles.body}>
                  Record the actual date and time of each event in IST. Save the
                  pre-invoice step while liability is still awaited. Saved
                  timestamps remain in history.
                </Text>
                <Check
                  title="Pre-invoice sent"
                  checked={preSent}
                  disabled={disabled || !!selected.handoff?.pre_invoice_sent_at}
                  onPress={() => {
                    setPreSent(!preSent);
                    if (preSent) setLiabilityReceived(false);
                  }}
                />
                {preSent && (
                  <DateField onValidationError={dateValidation.field("Pre-invoice sent date & time")}
                    label="Pre-invoice sent date & time"
                    value={preTime}
                    onChange={setPreTime}
                    locked={!!selected.handoff?.pre_invoice_sent_at}
                    disabled={disabled}
                  />
                )}
                <Check
                  title="Liability received"
                  checked={liabilityReceived}
                  disabled={
                    disabled ||
                    !preSent ||
                    !!selected.handoff?.liability_received_at
                  }
                  onPress={() => setLiabilityReceived(!liabilityReceived)}
                />
                {liabilityReceived && (
                  <DateField onValidationError={dateValidation.field("Liability received date & time")}
                    label="Liability received date & time"
                    value={liabilityTime}
                    onChange={setLiabilityTime}
                    locked={!!selected.handoff?.liability_received_at}
                    disabled={disabled}
                  />
                )}
                <Button
                  secondary
                  title="Save Insurance Progress"
                  onPress={() => void save(false)}
                  disabled={disabled || !preSent}
                />
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>PAID · ADVISOR VERIFICATION</Text>
                <Text style={styles.title}>Check before transfer</Text>
                <Text style={styles.body}>
                  Review the customer, vehicle, job card, completed repairs and
                  inspection details above. Correct any discrepancy before
                  transferring.
                </Text>
                <Check
                  title="I have checked and verified the Paid job details"
                  checked={verified}
                  disabled={disabled || !!selected.handoff?.details_verified_at}
                  onPress={() => setVerified(!verified)}
                />
                {!!selected.handoff?.details_verified_at && (
                  <Text style={styles.body}>
                    Verified: {formatTime(selected.handoff.details_verified_at)}
                  </Text>
                )}
              </View>
            )}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>TRANSFER TO BILLING DEPARTMENT</Text>
              <Text style={styles.title}>Assign Billing Executive</Text>
              <Text style={styles.body}>
                The Executive will record the internal Bill No., tax invoice
                number, invoice amounts and the remaining billing and payment
                details.
              </Text>
              {!queue.executives.length && (
                <Text style={styles.body}>
                  No active Billing Executive is available. Ask CEO Admin to
                  create or activate a user with the Billing Executive role.
                </Text>
              )}
              {queue.executives.map((person) => (
                <Pressable
                  key={person.id}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: executiveId === person.id,
                    disabled,
                  }}
                  disabled={disabled}
                  onPress={() => setExecutiveId(person.id)}
                  style={[
                    styles.person,
                    executiveId === person.id && styles.personSelected,
                  ]}
                >
                  <Ionicons
                    name={
                      executiveId === person.id
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={21}
                    color={colors.primary}
                  />
                  <Text style={styles.personName}>
                    {person.name || "Billing Executive"}
                  </Text>
                </Pressable>
              ))}
              <Text style={styles.label}>Handoff remarks · optional</Text>
              <TextInput
                accessibilityLabel="Billing handoff remarks"
                value={remarks}
                onChangeText={setRemarks}
                editable={!disabled}
                multiline
                maxLength={1000}
                placeholder="Instructions for the Billing Executive"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.multiline]}
              />
              <Button
                title="Assign Executive & Transfer to Billing"
                disabled={disabled || !ready || !executiveId}
                onPress={requestTransfer}
              />
            </View>
          </>
        )}
      </ScrollView>
      <Modal
        visible={!!notice || confirmTransfer}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) {
            setNotice(null);
            setConfirmTransfer(false);
          }
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Ionicons
              name={
                confirmTransfer
                  ? "person-add-outline"
                  : "information-circle-outline"
              }
              size={29}
              color={colors.primary}
            />
            <Text style={styles.title}>
              {notice?.title || "Transfer to Billing?"}
            </Text>
            <Text style={styles.body}>
              {notice?.body ||
                `${selected?.vehicle_no} will be assigned to ${queue.executives.find((person) => person.id === executiveId)?.name || "the selected Billing Executive"}. Your Advisor requirements will be saved before transfer.`}
            </Text>
            {confirmTransfer ? (
              <>
                <Button
                  title="Confirm Transfer"
                  disabled={disabled}
                  onPress={() => void save(true)}
                />
                <Button
                  secondary
                  title="Cancel"
                  disabled={saving}
                  onPress={() => setConfirmTransfer(false)}
                />
              </>
            ) : (
              <Button title="OK" onPress={() => setNotice(null)} />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.detailValue}>{value || "Not recorded"}</Text>
    </View>
  );
}
function Check({
  title,
  checked,
  disabled,
  onPress,
}: {
  title: string;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.check}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        color={colors.primary}
        size={24}
      />
      <Text style={[styles.body, styles.grow]}>{title}</Text>
    </Pressable>
  );
}
function DateField({ label, value, onChange, onValidationError, disabled, locked }: {
 label: string; value: string; onChange: (value: string) => void; onValidationError: (error: string | null) => void; disabled: boolean; locked: boolean;
}) {
 if (locked) return <View style={styles.dateField}><Text style={styles.label}>{label} · IST</Text><Text style={styles.detailValue}>{value} · saved</Text></View>;
 return <DateTimeField required onValidationError={onValidationError} title={label} label={label} disabled={disabled} maximumDate="now"
 value={parseIndiaLocal(value.replace(" ", "T"))?.toISOString() || null}
 onChange={next => onChange(next ? indiaInput(next) : "")} />;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 16,
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
  },
  topBar: {
    paddingHorizontal: 16,
    minHeight: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  backText: { color: colors.textSecondary, fontWeight: "700", fontSize: 13 },
  brand: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  brandText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 1,
  },
  hero: {
    padding: 20,
    borderRadius: 17,
    backgroundColor: colors.primary,
    gap: 10,
    overflow: "hidden",
  },
  heroPill: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  heroTitle: { color: "white", fontSize: 26, fontWeight: "900" },
  heroText: { color: "rgba(255,255,255,.9)", fontSize: 13, lineHeight: 20 },
  card: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: "800" },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
  hint: { color: colors.textSecondary, fontSize: 11, lineHeight: 18 },
  input: {
    padding: 13,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 14,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  button: {
    backgroundColor: colors.primary,
    minHeight: 50,
    borderRadius: 13,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  secondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#FDE5E7",
  },
  secondaryText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  grow: { flex: 1 },
  inline: { flexDirection: "row", justifyContent: "center", gap: 10 },
  badge: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    padding: 8,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detail: {
    flexGrow: 1,
    flexBasis: 160,
    padding: 12,
    borderRadius: 11,
    backgroundColor: colors.background,
    gap: 5,
  },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  check: { flexDirection: "row", gap: 10, alignItems: "center", minHeight: 48 },
  dateField: { gap: 9 },
  person: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    minHeight: 50,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  personName: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.48)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 460,
    padding: 24,
    borderRadius: 18,
    backgroundColor: colors.surface,
    gap: 16,
  },
  pageHeader: { flexDirection: "row", gap: 14, alignItems: "center" },
  pageEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 7,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 5,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCircle: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255,255,255,.06)",
    right: -50,
    bottom: -65,
  },
  heroHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.12)",
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    paddingTop: 13,
    marginTop: 3,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.2)",
  },
  heroFooterText: { color: "white", fontSize: 11, fontWeight: "700" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 8,
  },
  metricIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { color: colors.text, fontSize: 25, fontWeight: "800" },
  metricLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  sectionHeading: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 5,
  },
  sectionCounter: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCounterText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },
  searchBox: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    color: colors.text,
    fontSize: 14,
  },
  clearSearch: {
    minWidth: 36,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  filterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  filterTextSelected: { color: "white" },
  vehicleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  vehicleCard: {
    flexBasis: 310,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    padding: 17,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 13,
  },
  cardPressed: { opacity: 0.82 },
  vehicleHeading: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  vehicleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleNumber: { color: colors.text, fontSize: 18, fontWeight: "800" },
  jobBadge: {
    color: "#596273",
    backgroundColor: "#F0F2F5",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: "800",
  },
  insuranceBadge: { color: "#946200", backgroundColor: "#FFF6DD" },
  vehicleDetails: { gap: 5 },
  detailRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  statePill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
  },
  stateText: { fontSize: 11, fontWeight: "800" },
  vehicleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  vehicleAction: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyState: {
    padding: 28,
    gap: 14,
    alignItems: "center",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { textAlign: "center", maxWidth: 460 },
  workflowNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 15,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
});
