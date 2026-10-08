import { Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
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

type Item = {
  visit_id: string;
  vehicle_no: string;
  model: string | null;
  stage: "READY_FOR_DELIVERY" | "PENDING_GATE_OUT";
  customer_name: string | null;
  customer_mobile: string | null;
  job_type: "PAID" | "INSURANCE";
  job_card_no: string | null;
  advisor_name: string | null;
  bill_no: string | null;
  tax_invoice_no: string | null;
  invoice_amount: number | string | null;
  liability_amount: number | string | null;
  customer_difference_amount: number | string | null;
  advance_amount: number | string;
  billing_collected: number | string;
  customer_balance: number | string | null;
  billing_completed_at: string | null;
  billing_completed_by: string | null;
  generated_at: string | null;
  sent_at: string | null;
  inspection_result: string | null;
  inspection_at: string | null;
  inspection_remarks: string | null;
  cleared_at: string | null;
  cleared_by: string | null;
  clearance_remarks: string | null;
};
type Notice = { title: string; body: string };
const money = (value: number | string | null) =>
  value === null
    ? "Not recorded"
    : Number(value).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
      });
function time(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) + " IST"
    : "Not recorded";
}
function blockers(item: Item) {
  const result: string[] = [];
  if (!item.billing_completed_at) result.push("Billing completion is missing.");
  if (!item.bill_no || !item.tax_invoice_no || !item.generated_at)
    result.push("Generated invoice details are incomplete.");
  if (item.job_type === "INSURANCE" && !item.sent_at)
    result.push("Insurance tax invoice sent is missing.");
  if (item.inspection_result !== "PASSED")
    result.push("The latest Final Inspection must be Passed.");
  if (item.customer_balance === null || Number(item.customer_balance) !== 0)
    result.push("The customer balance must be fully settled.");
  return result;
}

export default function ReadyForDeliveryScreen() {
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

  const [items, setItems] = useState<Item[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "READY_FOR_DELIVERY" | "PENDING_GATE_OUT"
  >("READY_FOR_DELIVERY");
  const [search, setSearch] = useState("");
  const [reviewedDetails, setReviewedDetails] = useState(false);
  const [reviewedBilling, setReviewedBilling] = useState(false);
  const [reviewedInspection, setReviewedInspection] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const requests = useRef(0);
  const busy = useRef(false);
  const selected = items.find((item) => item.visit_id === selectedId);
  const disabled = saving || loading || refreshing;
  const pending = items.filter(
    (item) => item.stage === "READY_FOR_DELIVERY",
  ).length;
  const gate = items.filter((item) => item.stage === "PENDING_GATE_OUT").length;
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          item.stage === filter &&
          [
            item.vehicle_no,
            item.model,
            item.customer_name,
            item.job_card_no,
            item.advisor_name,
          ].some((value) =>
            value?.toLowerCase().includes(search.trim().toLowerCase()),
          ),
      ),
    [items, filter, search],
  );
  const returnedVisit = singleParam(navigationParams.returnVisitId);
  useEffect(() => {
    if (!loading && returnedVisit && items.some(item => item.visit_id === returnedVisit)) {
      setSelectedId(returnedVisit);
      const returned = items.find(item => item.visit_id === returnedVisit);
      if (returned) setFilter(returned.stage);
      router.setParams({ returnVisitId: "" });
    }
  }, [loading, returnedVisit, items]);

  const load = useCallback(async (refresh = false) => {
    const id = ++requests.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "new_workflow_ready_for_delivery_queue",
      );
      if (rpcError) throw rpcError;
      if (
        !data ||
        !["advisor", "ceo_admin"].includes(data.role) ||
        !Array.isArray(data.items)
      )
        throw new Error(
          "Delivery clearance queue returned an invalid response.",
        );
      if (id === requests.current) {
        setItems(data.items);
        setRole(data.role);
      }
    } catch (e: any) {
      if (id === requests.current)
        setError(e?.message || "Unable to load delivery clearance.");
    } finally {
      if (id === requests.current) {
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
    setReviewedDetails(false);
    setReviewedBilling(false);
    setReviewedInspection(false);
    setRemarks("");
    setConfirm(false);
  }, [selectedId]);
  const clear = async () => {
    if (!selected || busy.current || disabled) return;
    if (
      !reviewedDetails ||
      !reviewedBilling ||
      !reviewedInspection ||
      blockers(selected).length
    ) {
      setConfirm(false);
      setNotice({
        title: "Review required",
        body: "Review all three sections and resolve any missing requirements before continuing.",
      });
      return;
    }
    const vehicleNo = selected.vehicle_no;
    busy.current = true;
    setSaving(true);
    setConfirm(false);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "new_workflow_mark_ready_for_delivery",
        {
          p_visit_id: selected.visit_id,
          p_review_confirmed: true,
          p_remarks: remarks.trim() || null,
        },
      );
      if (rpcError) throw rpcError;
      if (data?.success !== true || data.stage !== "PENDING_GATE_OUT")
        throw new Error(
          "Clearance could not be confirmed. Refresh before trying again.",
        );
      await load(true);
      setNotice({
        title: "Ready for Delivery recorded",
        body: `${vehicleNo} is now Pending Gate Out. The Watchman will record the vehicle's exit. Your review, user and date/time have been saved.`,
      });
    } catch (e: any) {
      setNotice({
        title: "Unable to clear delivery",
        body: e?.message || "Refresh and try again.",
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!busy.current) void load(true);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.topBar}>
          <BackButton disabled={saving} onPress={handleNavigationBack} />
          <BrandPill />
        </View>
        <View style={styles.header}>
          <View style={styles.grow}>
            <Text style={styles.eyebrow}>
              {role === "ceo_admin" ? "CEO ADMIN" : "ADVISOR"} · DELIVERY
              CLEARANCE
            </Text>
            <Text style={styles.heading}>Ready for Delivery</Text>
            <Text style={styles.body}>
              Review completed work and Billing before Gate Out.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh delivery queue"
            disabled={disabled}
            style={styles.refresh}
            onPress={() => void load(true)}
          >
            {loading || refreshing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={22}
                color={colors.primary}
              />
            )}
          </Pressable>
        </View>
        {loading && <ActivityIndicator color={colors.primary} size="large" />}
        {saving && (
          <Text style={styles.body}>Recording delivery clearance…</Text>
        )}
        {!!error && (
          <View style={styles.card}>
            <Text style={styles.title}>Delivery queue unavailable</Text>
            <Text style={styles.body}>{error}</Text>
            <Button
              title="Try Again"
              onPress={() => void load()}
              disabled={disabled}
            />
          </View>
        )}
        {!loading && !error && !selectedId && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>
                BILLING COMPLETED → ADVISOR REVIEW → GATE OUT
              </Text>
              <Text style={styles.heroTitle}>
                Make the final delivery check
              </Text>
              <Text style={styles.heroText}>
                Confirm the customer and job details, completed inspection and
                settled Billing. Mark Ready for Delivery to send the vehicle to
                the Watchman queue.
              </Text>
            </View>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Ionicons
                  name="clipboard-outline"
                  size={23}
                  color={colors.primary}
                />
                <Text style={styles.metricCount}>{pending}</Text>
                <Text style={styles.body}>Awaiting review</Text>
              </View>
              <View style={styles.metric}>
                <Ionicons name="exit-outline" size={23} color="#217A50" />
                <Text style={styles.metricCount}>{gate}</Text>
                <Text style={styles.body}>Pending Gate Out</Text>
              </View>
            </View>
            <View style={styles.tabs}>
              {(
                [
                  { key: "READY_FOR_DELIVERY", label: "Awaiting review" },
                  { key: "PENDING_GATE_OUT", label: "Pending Gate Out" },
                ] as const
              ).map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === option.key }}
                  onPress={() => setFilter(option.key)}
                  style={[
                    styles.tab,
                    filter === option.key && styles.tabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      filter === option.key && styles.tabTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.search}>
              <Ionicons
                name="search-outline"
                color={colors.textSecondary}
                size={20}
              />
              <TextInput
                accessibilityLabel="Search delivery vehicles"
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
            <Text style={styles.hint}>
              {visible.length} matching vehicle{visible.length === 1 ? "" : "s"}
              {role === "ceo_admin"
                ? " · All Advisors"
                : " · Your assigned vehicles"}
            </Text>
            {visible.map((item) => (
              <Pressable
                key={item.visit_id}
                accessibilityRole="button"
                onPress={() => setSelectedId(item.visit_id)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.row}>
                  <View style={styles.vehicleIcon}>
                    <Ionicons
                      name="car-outline"
                      color={colors.primary}
                      size={22}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.title}>{item.vehicle_no}</Text>
                    <Text style={styles.body}>
                      {item.model || "Model not recorded"}
                    </Text>
                  </View>
                  <Text style={styles.badge}>{item.job_type}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.body}>
                  {item.customer_name || "Customer not recorded"} · Job card{" "}
                  {item.job_card_no || "Not recorded"}
                </Text>
                {role === "ceo_admin" && (
                  <Text style={styles.body}>
                    Advisor: {item.advisor_name || "Not recorded"}
                  </Text>
                )}
                <Text style={styles.body}>
                  Billing completed: {time(item.billing_completed_at)}
                </Text>
                <Text
                  style={[
                    styles.status,
                    item.stage === "PENDING_GATE_OUT" && styles.success,
                  ]}
                >
                  {item.stage === "PENDING_GATE_OUT"
                    ? "Cleared · awaiting Watchman Gate Out"
                    : blockers(item).length
                      ? "Requirements need attention"
                      : "Ready for your review"}
                </Text>
              </Pressable>
            ))}
            {!visible.length && (
              <View style={styles.empty}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={34}
                  color={colors.primary}
                />
                <Text style={styles.title}>No vehicles in this view</Text>
                <Text style={[styles.body, styles.centerText]}>
                  {search
                    ? "Try another search or queue filter."
                    : filter === "READY_FOR_DELIVERY"
                      ? "Vehicles appear after Billing completes and returns them to the Advisor."
                      : "Cleared vehicles remain here until the Watchman records Gate Out."}
                </Text>
              </View>
            )}
          </>
        )}
        {!loading && !error && selectedId && !selected && (
          <View style={styles.card}>
            <Ionicons name="exit-outline" size={28} color={colors.primary} />
            <Text style={styles.title}>
              Vehicle has left this delivery queue
            </Text>
            <Text style={styles.body}>
              The vehicle may have completed Gate Out or moved to another stage.
              Return to the queue to continue.
            </Text>
            <BackButton onPress={() => setSelectedId(null)} accessibilityLabel="Back to Delivery Queue" />
          </View>
        )}
        {!loading && !error && selected && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>
                {selected.job_type} JOB ·{" "}
                {selected.stage === "PENDING_GATE_OUT"
                  ? "PENDING GATE OUT"
                  : "AWAITING YOUR REVIEW"}
              </Text>
              <Text style={styles.heroTitle}>{selected.vehicle_no}</Text>
              <Text style={styles.heroText}>
                {selected.model || "Model not recorded"} · Advisor{" "}
                {selected.advisor_name || "Not recorded"}
              </Text>
            </View>
            {selected.stage === "PENDING_GATE_OUT" && (
              <View style={[styles.card, styles.clearedCard]}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={30}
                  color="#217A50"
                />
                <Text style={styles.title}>Delivery clearance recorded</Text>
                <Text style={styles.body}>
                  Cleared by {selected.cleared_by || "Recorded user"} ·{" "}
                  {time(selected.cleared_at)}
                </Text>
                {!!selected.clearance_remarks && (
                  <Text style={styles.body}>
                    Remarks: {selected.clearance_remarks}
                  </Text>
                )}
                <Text style={styles.body}>
                  The Watchman can now perform Gate Out. This vehicle remains in
                  the workshop until its exit is recorded.
                </Text>
              </View>
            )}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>01 · CUSTOMER & JOB</Text>
              <Text style={styles.title}>Verify vehicle details</Text>
              <View style={styles.grid}>
                <Detail label="Customer" value={selected.customer_name} />
                <Detail
                  label="Mobile number"
                  value={selected.customer_mobile}
                />
                <Detail label="Job card" value={selected.job_card_no} />
                <Detail
                  label="Assigned Advisor"
                  value={selected.advisor_name}
                />
              </View>
              {selected.stage === "READY_FOR_DELIVERY" && (
                <Check
                  title="I reviewed the vehicle, customer and job details"
                  checked={reviewedDetails}
                  disabled={disabled}
                  onPress={() => setReviewedDetails(!reviewedDetails)}
                />
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>02 · FINAL INSPECTION</Text>
              <Text style={styles.title}>Review completed inspection</Text>
              <Text
                style={[
                  styles.status,
                  selected.inspection_result === "PASSED" && styles.success,
                ]}
              >
                Latest result: {selected.inspection_result || "Not recorded"}
              </Text>
              <Text style={styles.body}>
                Inspection date: {time(selected.inspection_at)}
              </Text>
              {!!selected.inspection_remarks && (
                <Text style={styles.body}>
                  Remarks: {selected.inspection_remarks}
                </Text>
              )}
              <Button
                secondary
                title="View Inspection & Rework History"
                disabled={disabled}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/advisor/final_inspection_details" as any,
                    params: { visitId: selected.visit_id, returnTo: "ready-for-delivery" },
                  })
                }
              />
              {selected.stage === "READY_FOR_DELIVERY" && (
                <Check
                  title="I reviewed the passed inspection and the vehicle is ready for delivery"
                  checked={reviewedInspection}
                  disabled={disabled}
                  onPress={() => setReviewedInspection(!reviewedInspection)}
                />
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>03 · BILLING & PAYMENT</Text>
              <Text style={styles.title}>Verify settled Billing</Text>
              <View style={styles.grid}>
                <Detail label="Internal Bill No." value={selected.bill_no} />
                <Detail
                  label="Tax invoice number"
                  value={selected.tax_invoice_no}
                />
                <Detail
                  label="Invoice amount"
                  value={money(selected.invoice_amount)}
                />
                {selected.job_type === "PAID" ? (
                  <Detail
                    label="Survey advance credited"
                    value={money(selected.advance_amount)}
                  />
                ) : (
                  <>
                    <Detail
                      label="Insurance liability"
                      value={money(selected.liability_amount)}
                    />
                    <Detail
                      label="Customer difference"
                      value={money(selected.customer_difference_amount)}
                    />
                  </>
                )}
                <Detail
                  label="Collected by Billing"
                  value={money(selected.billing_collected)}
                />
                <Detail
                  label="Customer balance"
                  value={money(selected.customer_balance)}
                />
              </View>
              <Text style={styles.body}>
                Tax invoice generated: {time(selected.generated_at)}
              </Text>
              {selected.job_type === "INSURANCE" && (
                <Text style={styles.body}>
                  Tax invoice sent: {time(selected.sent_at)}
                </Text>
              )}
              <Text style={styles.body}>
                Billing completed: {time(selected.billing_completed_at)} ·{" "}
                {selected.billing_completed_by || "User not recorded"}
              </Text>
              {selected.stage === "READY_FOR_DELIVERY" && (
                <Check
                  title="I reviewed the invoice and settled customer balance"
                  checked={reviewedBilling}
                  disabled={disabled}
                  onPress={() => setReviewedBilling(!reviewedBilling)}
                />
              )}
            </View>
            {selected.stage === "READY_FOR_DELIVERY" && (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>DELIVERY CLEARANCE</Text>
                <Text style={styles.title}>Mark Ready for Delivery</Text>
                {blockers(selected).length > 0 && (
                  <View style={styles.warning}>
                    <Text style={styles.status}>Resolve before continuing</Text>
                    {blockers(selected).map((reason) => (
                      <Text key={reason} style={styles.body}>
                        • {reason}
                      </Text>
                    ))}
                  </View>
                )}
                <Text style={styles.body}>
                  Your confirmation sends this vehicle to Pending Gate Out. The
                  Watchman records the actual vehicle exit separately.
                </Text>
                <Text style={styles.label}>Delivery remarks · optional</Text>
                <TextInput
                  accessibilityLabel="Delivery clearance remarks"
                  value={remarks}
                  onChangeText={setRemarks}
                  editable={!disabled}
                  multiline
                  maxLength={1000}
                  placeholder="Notes for delivery or the Watchman"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.remarks}
                />
                <Button
                  title="Mark Ready for Delivery & Send to Gate Out"
                  disabled={
                    disabled ||
                    !reviewedDetails ||
                    !reviewedBilling ||
                    !reviewedInspection ||
                    blockers(selected).length > 0
                  }
                  onPress={() => setConfirm(true)}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
      <Modal
        visible={confirm || !!notice}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) {
            setConfirm(false);
            setNotice(null);
          }
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Ionicons
              name={confirm ? "exit-outline" : "information-circle-outline"}
              size={30}
              color={colors.primary}
            />
            <Text style={styles.title}>
              {notice?.title || "Confirm delivery clearance?"}
            </Text>
            <Text style={styles.body}>
              {notice?.body ||
                `${selected?.vehicle_no} will move to Pending Gate Out. Your review and the clearance date/time will be recorded.`}
            </Text>
            {confirm ? (
              <>
                <Button
                  title="Confirm & Send to Gate Out"
                  disabled={disabled}
                  onPress={() => void clear()}
                />
                <Button
                  secondary
                  title="Cancel"
                  disabled={saving}
                  onPress={() => setConfirm(false)}
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
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  backText: { fontSize: 13, color: colors.textSecondary, fontWeight: "700" },
  brand: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.text,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: colors.primaryDark,
  },
  heading: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    marginVertical: 6,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: "800" },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
  hint: { color: colors.textSecondary, fontSize: 11, lineHeight: 18 },
  refresh: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hero: {
    backgroundColor: colors.primary,
    padding: 22,
    borderRadius: 18,
    gap: 10,
  },
  heroEyebrow: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 17,
  },
  heroTitle: { color: "white", fontSize: 25, fontWeight: "800" },
  heroText: { color: "#FFF0F1", fontSize: 13, lineHeight: 21 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: {
    flexGrow: 1,
    flexBasis: 140,
    padding: 18,
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  metricCount: { color: colors.text, fontSize: 27, fontWeight: "800" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    minHeight: 44,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  tabTextActive: { color: "white" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
  card: {
    padding: 18,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  vehicleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    fontSize: 10,
    fontWeight: "800",
    padding: 8,
    borderRadius: 8,
  },
  status: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 20,
  },
  success: { color: "#217A50" },
  clearedCard: { backgroundColor: "#F3FAF6", borderColor: "#D3ECDD" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detail: {
    flexGrow: 1,
    flexBasis: 160,
    padding: 12,
    gap: 5,
    backgroundColor: colors.background,
    borderRadius: 11,
  },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  check: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  warning: {
    padding: 13,
    gap: 7,
    backgroundColor: "#FFF6DD",
    borderRadius: 12,
  },
  remarks: {
    minHeight: 90,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },
  button: {
    minHeight: 50,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 13,
  },
  buttonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  secondary: { backgroundColor: colors.primaryLight },
  secondaryText: { color: colors.primaryDark },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  empty: {
    padding: 28,
    gap: 14,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerText: { textAlign: "center", maxWidth: 460 },
  overlay: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,.48)",
  },
  dialog: {
    width: "100%",
    maxWidth: 460,
    gap: 16,
    padding: 24,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
});
