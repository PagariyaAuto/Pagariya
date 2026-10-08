import { Modal, ScrollView, TextInput } from "../inputs/KeyboardAware";
import useDateTimeValidation from "../inputs/useDateTimeValidation";
import DateTimeField from "../inputs/DateTimeField";
import { parseIndiaLocal } from "../../lib/date-time";
import BackButton from "../navigation/BackButton";
import { returnToRoute, useHardwareBack, singleParam } from "../../lib/back-navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { colors } from "../../theme";

type Payment = {
  id: string;
  amount: number | string;
  payment_mode: string;
  payment_at: string;
  utr_no: string | null;
  proof_path: string | null;
};
type Vehicle = {
  visit_id: string;
  vehicle_no: string;
  model: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  job_card_no: string | null;
  job_type: "PAID" | "INSURANCE";
  advisor_name: string | null;
  handoff_remarks: string | null;
  assigned_at: string;
  pre_invoice_sent_at: string | null;
  liability_received_at: string | null;
  generated_at: string | null;
  sent_at: string | null;
  advance_amount: number | string;
  advance_reference: string | null;
  paid_amount: number | string;
  amount_due: number | string | null;
  payments: Payment[];
  billing: {
    bill_no: string | null;
    tax_invoice_no: string | null;
    invoice_amount: number | string | null;
    liability_amount: number | string | null;
    customer_difference_amount: number | string | null;
    updated_at: string;
  };
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
function inputTime(value?: string | null) {
  return new Date(
    (value ? new Date(value).getTime() : Date.now()) + 330 * 60000,
  )
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}
function parseTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))
    throw new Error("Use YYYY-MM-DD HH:mm in IST.");
  const date = new Date(value.replace(" ", "T") + ":00+05:30");
  if (
    !Number.isFinite(date.getTime()) ||
    inputTime(date.toISOString()) !== value ||
    date.getTime() > Date.now()
  )
    throw new Error("Enter a valid date and time that is not in the future.");
  return date.toISOString();
}
function amount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter an amount with up to two decimal places.");
  return Number(value);
}
function status(item: Vehicle) {
  if (!item.generated_at) return "Invoice pending";
  if (item.job_type === "INSURANCE" && !item.sent_at)
    return "Invoice send pending";
  return Number(item.amount_due) > 0 ? "Payment pending" : "Ready to return";
}

export default function BillingWorkspace({
  dashboard = false,
  visitId,
}: {
  dashboard?: boolean;
  visitId?: string;
}) {
  const dateValidation = useDateTimeValidation();
  const navigationParams = useLocalSearchParams<{ filter?: string | string[] }>();
  const handleNavigationBack = () => {
    if (saving || busy.current) return;
    if (detail) returnToRoute({ pathname: "/(tabs)/billing/vehicles", params: { filter: singleParam(navigationParams.filter) || "ALL" } });
    else returnToRoute("/(tabs)/billing");
  };
  useHardwareBack(handleNavigationBack, !dashboard);

  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  useEffect(() => {
    const candidate = singleParam(navigationParams.filter);
    if (["ALL", "PAID", "INSURANCE", "READY"].includes(candidate || "")) setFilter(candidate!);
  }, [navigationParams.filter]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<
    "COMPLETE" | "PAYMENT" | null
  >(null);
  const [bill, setBill] = useState("");
  const [invoice, setInvoice] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [liability, setLiability] = useState("");
  const [generated, setGenerated] = useState(false);
  const [sent, setSent] = useState(false);
  const [generatedTime, setGeneratedTime] = useState(inputTime());
  const [sentTime, setSentTime] = useState(inputTime());
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE">("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentTime, setPaymentTime] = useState(inputTime());
  const [utr, setUtr] = useState("");
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const busy = useRef(false);
  const request = useRef(0);
  const pendingPayment = useRef<{
    id: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const selected = items.find((item) => item.visit_id === visitId);
  const disabled = saving || loading || refreshing;
  const detail = visitId !== undefined;

  const load = useCallback(async (refresh = false) => {
    const id = ++request.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "new_workflow_billing_queue",
      );
      if (rpcError) throw rpcError;
      if (
        !data ||
        !["billing_executive", "ceo_admin"].includes(data.role) ||
        !Array.isArray(data.items)
      )
        throw new Error("Billing queue returned an invalid response.");
      if (id === request.current) setItems(data.items);
    } catch (e: any) {
      if (id === request.current)
        setError(e?.message || "Unable to load Billing.");
    } finally {
      if (id === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current += 1;
      };
    }, [load]),
  );
  useEffect(() => {
    if (!selected) return;
    setBill(selected.billing.bill_no || "");
    setInvoice(selected.billing.tax_invoice_no || "");
    setInvoiceAmount(selected.billing.invoice_amount?.toString() || "");
    setLiability(selected.billing.liability_amount?.toString() || "");
    setGenerated(!!selected.generated_at);
    setSent(!!selected.sent_at);
    setGeneratedTime(inputTime(selected.generated_at));
    setSentTime(inputTime(selected.sent_at));
  }, [
    selected?.visit_id,
    selected?.billing.updated_at,
    selected?.generated_at,
    selected?.sent_at,
  ]);

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (filter === "ALL" ||
            item.job_type === filter ||
            (filter === "READY" && status(item) === "Ready to return")) &&
          [
            item.vehicle_no,
            item.model,
            item.customer_name,
            item.job_card_no,
          ].some((value) =>
            value?.toLowerCase().includes(search.trim().toLowerCase()),
          ),
      ),
    [items, search, filter],
  );
  const canComplete =
    !!selected?.generated_at &&
    (selected.job_type === "PAID" || !!selected.sent_at) &&
    Number(selected.amount_due) === 0;
  const run = async (action: () => Promise<void>) => {
    if (busy.current || disabled) return;
    busy.current = true;
    setSaving(true);
    setConfirmation(null);
    try {
      const dateError = dateValidation.getError();
      if (dateError) throw new Error(dateError);
      await action();
    } catch (e: any) {
      setNotice({
        title: "Unable to continue",
        body: e?.message || "Refresh and try again.",
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const saveInvoice = () =>
    run(async () => {
      if (!selected) throw new Error("Select a vehicle.");
      const total = amount(invoiceAmount);
      const insuranceLiability =
        selected.job_type === "INSURANCE" ? amount(liability) : null;
      if (generated && (!bill.trim() || !invoice.trim()))
        throw new Error("Enter the internal Bill No. and tax invoice number.");
      const { data, error: rpcError } = await supabase.rpc(
        "new_workflow_save_billing_invoice",
        {
          p_visit_id: selected.visit_id,
          p_data: {
            bill_no: bill.trim() || null,
            tax_invoice_no: invoice.trim() || null,
            invoice_amount: total,
            liability_amount: insuranceLiability,
            generated_at:
              selected.generated_at ||
              (generated ? parseTime(generatedTime) : null),
            sent_at: selected.sent_at || (sent ? parseTime(sentTime) : null),
          },
        },
      );
      if (rpcError) throw rpcError;
      if (data?.success !== true)
        throw new Error(
          "The invoice save could not be confirmed. Refresh before retrying.",
        );
      await load(true);
      setNotice({
        title: "Invoice progress saved",
        body: generated
          ? "Invoice details and recorded timestamps are saved. Continue with payment and return to the Advisor."
          : "Your draft is saved. Confirm invoice generation when the tax invoice is ready.",
      });
    });
  const chooseProof = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled) setPhoto(result.assets[0]);
    } catch (e: any) {
      setNotice({ title: "Unable to select proof", body: e.message });
    }
  };
  const recordPayment = () =>
    run(async () => {
      if (!selected) throw new Error("Select a vehicle.");
      if (!pendingPayment.current) {
        const paid = amount(paymentAmount);
        if (paid <= 0 || paid > Number(selected.amount_due))
          throw new Error("Enter an amount within the remaining balance.");
        const occurred = parseTime(paymentTime);
        if (paymentMode === "ONLINE" && (!utr.trim() || !photo))
          throw new Error("Online payment requires a UTR and payment proof.");
        let proofPath: string | null = null;
        if (paymentMode === "ONLINE" && photo) {
          const {
            data: { user },
            error: authError,
          } = await supabase.auth.getUser();
          if (authError) throw authError;
          if (!user) throw new Error("Please log in again.");
          const mime = photo.mimeType || "image/jpeg";
          if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
            throw new Error("Select a JPG, PNG or WebP proof image.");
          const extension =
            mime === "image/png"
              ? "png"
              : mime === "image/webp"
                ? "webp"
                : "jpg";
          proofPath = `${selected.visit_id}/${user.id}/${Crypto.randomUUID()}.${extension}`;
          let bytes: Uint8Array;
          if (photo.base64) {
            const decoded = atob(photo.base64);
            bytes = Uint8Array.from(decoded, (letter) => letter.charCodeAt(0));
          } else {
            const response = await fetch(photo.uri);
            bytes = new Uint8Array(await response.arrayBuffer());
          }
          if (bytes.byteLength > 10 * 1024 * 1024)
            throw new Error("Payment proof must be smaller than 10 MB.");
          const { error: uploadError } = await supabase.storage
            .from("billing-proofs")
            .upload(proofPath, bytes, { contentType: mime, upsert: false });
          if (uploadError) throw uploadError;
        }
        pendingPayment.current = {
          id: Crypto.randomUUID(),
          payload: {
            p_visit_id: selected.visit_id,
            p_mode: paymentMode,
            p_amount: paid,
            p_payment_at: occurred,
            p_utr: paymentMode === "ONLINE" ? utr.trim() : null,
            p_proof_path: proofPath,
          },
        };
      }
      const pending = pendingPayment.current;
      const { data, error: rpcError } = await supabase.rpc(
        "new_workflow_record_billing_payment",
        { ...pending.payload, p_request_id: pending.id },
      );
      if (rpcError) {
        if (rpcError.code === "P0001") pendingPayment.current = null;
        throw rpcError;
      }
      if (data?.success !== true)
        throw new Error(
          "Payment could not be confirmed. Retry this payment to check the same request.",
        );
      pendingPayment.current = null;
      setPaymentAmount("");
      setUtr("");
      setPhoto(null);
      setPaymentTime(inputTime());
      await load(true);
      setNotice({
        title: "Payment recorded",
        body: "The payment is saved in the vehicle history and the balance has been updated.",
      });
    });
  const complete = () =>
    run(async () => {
      if (!selected) throw new Error("Select a vehicle.");
      const { data, error: rpcError } = await supabase.rpc(
        "new_workflow_complete_billing",
        { p_visit_id: selected.visit_id },
      );
      if (rpcError) throw rpcError;
      if (data?.success !== true)
        throw new Error(
          "Completion could not be confirmed. Refresh before retrying.",
        );
      router.replace("/(tabs)/billing/vehicles" as any);
    });
  const showProof = (path: string) =>
    run(async () => {
      const { data, error: storageError } = await supabase.storage
        .from("billing-proofs")
        .createSignedUrl(path.replace(/^billing-proofs\//, ""), 120);
      if (storageError) throw storageError;
      if (!data?.signedUrl) throw new Error("Proof could not be opened.");
      await Linking.openURL(data.signedUrl);
    });
  const open = (item: Vehicle) =>
    router.push({
      pathname: "/(tabs)/billing/vehicle" as any,
      params: { visitId: item.visit_id, filter },
    });

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
        <View style={styles.header}>
          <View style={styles.grow}>
            <Text style={styles.eyebrow}>
              PAGARIYA AUTO · BILLING DEPARTMENT
            </Text>
            <Text style={styles.heading}>
              {detail
                ? "Vehicle Billing"
                : dashboard
                  ? "Billing Dashboard"
                  : "Billing Queue"}
            </Text>
            <Text style={styles.body}>
              Invoice, customer payment and Advisor handoff
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh Billing"
            disabled={disabled}
            onPress={() => void load(true)}
            style={styles.iconButton}
          >
            <Ionicons name="refresh-outline" color={colors.primary} size={22} />
          </Pressable>
        </View>
        {!dashboard && (
          <BackButton disabled={saving} onPress={handleNavigationBack} accessibilityLabel={detail ? "Back to Billing Queue" : "Back to Billing Dashboard"} />
        )}
        {loading && <ActivityIndicator color={colors.primary} size="large" />}
        {saving && <Text style={styles.body}>Saving…</Text>}
        {!!error && (
          <View style={styles.card}>
            <Text style={styles.title}>Billing unavailable</Text>
            <Text style={styles.body}>{error}</Text>
            <Button
              title="Try Again"
              onPress={() => void load()}
              disabled={disabled}
            />
          </View>
        )}
        {!loading && !error && !detail && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>ASSIGNED BY THE ADVISOR</Text>
              <Text style={styles.heroTitle}>
                Complete Billing, return to Advisor
              </Text>
              <Text style={styles.heroText}>
                Paid advances are credited. Insurance customer differences must
                be collected before completion.
              </Text>
            </View>
            <View style={styles.metrics}>
              {[
                { label: "Assigned vehicles", count: items.length },
                {
                  label: "Paid",
                  count: items.filter((i) => i.job_type === "PAID").length,
                },
                {
                  label: "Insurance",
                  count: items.filter((i) => i.job_type === "INSURANCE").length,
                },
                {
                  label: "Ready to return",
                  count: items.filter((i) => status(i) === "Ready to return")
                    .length,
                },
              ].map((m) => (
                <View key={m.label} style={styles.metric}>
                  <Text style={styles.metricCount}>{m.count}</Text>
                  <Text style={styles.body}>{m.label}</Text>
                </View>
              ))}
            </View>
            {dashboard ? (
              <Button
                title="Open All Assigned Vehicles"
                onPress={() => router.push("/(tabs)/billing/vehicles" as any)}
              />
            ) : (
              <>
                <Field
                  label="Search vehicle, customer or job card"
                  value={search}
                  onChange={setSearch}
                />
                <View style={styles.row}>
                  {["ALL", "PAID", "INSURANCE", "READY"].map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filter === key }}
                      onPress={() => setFilter(key)}
                      style={[
                        styles.filter,
                        filter === key && styles.filterActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          filter === key && styles.filterTextActive,
                        ]}
                      >
                        {key === "ALL"
                          ? "All"
                          : key === "READY"
                            ? "Ready to return"
                            : key === "PAID"
                              ? "Paid"
                              : "Insurance"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.title}>
              {dashboard
                ? "Next vehicles"
                : `${visible.length} matching vehicles`}
            </Text>
            {(dashboard ? items.slice(0, 3) : visible).map((item) => (
              <Pressable
                key={item.visit_id}
                accessibilityRole="button"
                onPress={() => open(item)}
                style={styles.card}
              >
                <View style={styles.row}>
                  <Text style={[styles.title, styles.grow]}>
                    {item.vehicle_no}
                  </Text>
                  <Text style={styles.badge}>{item.job_type}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.body}>
                  {item.model || "Model not recorded"} ·{" "}
                  {item.customer_name || "Customer not recorded"}
                </Text>
                <Text style={styles.body}>
                  Advisor: {item.advisor_name || "Not recorded"} · Balance:{" "}
                  {money(item.amount_due)}
                </Text>
                <Text style={styles.status}>{status(item)}</Text>
              </Pressable>
            ))}
            {!(dashboard ? items : visible).length && (
              <View style={styles.card}>
                <Ionicons
                  name="checkmark-circle-outline"
                  color={colors.primary}
                  size={30}
                />
                <Text style={styles.title}>
                  {items.length
                    ? "No matching vehicles"
                    : "No vehicles assigned"}
                </Text>
                <Text style={styles.body}>
                  Vehicles appear after the Advisor completes preparation and
                  assigns a Billing Executive.
                </Text>
              </View>
            )}
          </>
        )}
        {!loading && !error && detail && !selected && (
          <View style={styles.card}>
            <Text style={styles.title}>
              {visitId
                ? "Vehicle no longer in your Billing queue"
                : "Select a vehicle"}
            </Text>
            <Text style={styles.body}>
              A completed vehicle returns to the Advisor for delivery clearance.
              Open the queue to continue with another vehicle.
            </Text>
            <Button
              title="Open Billing Queue"
              onPress={() => router.replace("/(tabs)/billing/vehicles" as any)}
            />
          </View>
        )}
        {!loading && !error && selected && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>
                {selected.job_type} JOB · {status(selected)}
              </Text>
              <Text style={styles.heroTitle}>{selected.vehicle_no}</Text>
              <Text style={styles.heroText}>
                {selected.model || "Model not recorded"} ·{" "}
                {selected.customer_name || "Customer not recorded"}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.title}>Advisor handoff</Text>
              <Text style={styles.body}>
                Customer mobile: {selected.customer_mobile || "Not recorded"}
              </Text>
              <Text style={styles.body}>
                Job card: {selected.job_card_no || "Not recorded"}
              </Text>
              <Text style={styles.body}>
                Advisor: {selected.advisor_name || "Not recorded"} · Assigned{" "}
                {time(selected.assigned_at)}
              </Text>
              {selected.job_type === "INSURANCE" ? (
                <>
                  <Text style={styles.body}>
                    Pre-invoice sent: {time(selected.pre_invoice_sent_at)}
                  </Text>
                  <Text style={styles.body}>
                    Liability received: {time(selected.liability_received_at)}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.status}>
                    Survey advance: {money(selected.advance_amount)}
                  </Text>
                  <Text style={styles.body}>
                    Receipt/reference:{" "}
                    {selected.advance_reference || "Not recorded"}
                  </Text>
                </>
              )}
              {!!selected.handoff_remarks && (
                <Text style={styles.body}>
                  Remarks: {selected.handoff_remarks}
                </Text>
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>01 · INVOICE</Text>
              <Text style={styles.title}>Internal bill & tax invoice</Text>
              <Text style={styles.body}>
                Bill No. is separate from the tax invoice number. Generated
                invoice details and saved dates are locked.
              </Text>
              <Field
                label="Internal Bill No."
                value={bill}
                onChange={setBill}
                disabled={disabled || !!selected.generated_at}
                maxLength={100}
              />
              <Field
                label="Tax invoice number"
                value={invoice}
                onChange={setInvoice}
                disabled={disabled || !!selected.generated_at}
                maxLength={100}
              />
              <Field
                label="Invoice amount · ₹"
                value={invoiceAmount}
                onChange={setInvoiceAmount}
                numeric
                disabled={disabled || !!selected.generated_at}
              />
              {selected.job_type === "INSURANCE" && (
                <>
                  <Field
                    label="Insurance liability amount · ₹"
                    value={liability}
                    onChange={setLiability}
                    numeric
                    disabled={disabled || !!selected.generated_at}
                  />
                  <Text style={styles.status}>
                    Customer difference:{" "}
                    {invoiceAmount && liability
                      ? money(Number(invoiceAmount) - Number(liability))
                      : "Enter both amounts"}
                  </Text>
                </>
              )}
              <Check
                title="Tax invoice generated"
                checked={generated}
                disabled={disabled || !!selected.generated_at}
                onPress={() => {
                  setGenerated(!generated);
                  if (generated) setSent(false);
                }}
              />
              {generated && (
                <DateField onValidationError={dateValidation.field("Generated date & time")}
                  label="Generated date & time"
                  value={generatedTime}
                  onChange={setGeneratedTime}
                  disabled={disabled || !!selected.generated_at}
                />
              )}
              {selected.job_type === "INSURANCE" && (
                <>
                  <Check
                    title="Tax invoice sent"
                    checked={sent}
                    disabled={disabled || !generated || !!selected.sent_at}
                    onPress={() => setSent(!sent)}
                  />
                  {sent && (
                    <DateField onValidationError={dateValidation.field("Sent date & time")}
                      label="Sent date & time"
                      value={sentTime}
                      onChange={setSentTime}
                      disabled={disabled || !!selected.sent_at}
                    />
                  )}
                </>
              )}
              <Button
                title="Save Invoice Progress"
                disabled={disabled}
                onPress={() => void saveInvoice()}
              />
            </View>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>02 · CUSTOMER PAYMENT</Text>
              <Text style={styles.title}>Balance & payment history</Text>
              <Text style={styles.body}>
                Invoice: {money(selected.billing.invoice_amount)}
              </Text>
              {selected.job_type === "PAID" ? (
                <Text style={styles.body}>
                  Less Survey advance: {money(selected.advance_amount)}
                </Text>
              ) : (
                <Text style={styles.body}>
                  Insurance liability:{" "}
                  {money(selected.billing.liability_amount)}
                </Text>
              )}
              <Text style={styles.body}>
                Collected by Billing: {money(selected.paid_amount)}
              </Text>
              <Text style={styles.balance}>
                Remaining: {money(selected.amount_due)}
              </Text>
              {selected.payments.map((payment) => (
                <View key={payment.id} style={styles.payment}>
                  <Text style={styles.status}>
                    {payment.payment_mode} · {money(payment.amount)}
                  </Text>
                  <Text style={styles.body}>{time(payment.payment_at)}</Text>
                  {!!payment.utr_no && (
                    <Text style={styles.body}>UTR: {payment.utr_no}</Text>
                  )}
                  {!!payment.proof_path && (
                    <Button
                      secondary
                      title="View Payment Proof"
                      disabled={disabled}
                      onPress={() => void showProof(payment.proof_path!)}
                    />
                  )}
                </View>
              ))}
              {!selected.generated_at && (
                <Text style={styles.body}>
                  Save invoice generation before recording payment.
                </Text>
              )}
              {selected.generated_at && Number(selected.amount_due) > 0 && (
                <>
                  {pendingPayment.current && (
                    <Text style={styles.status}>
                      A previous payment request needs confirmation. Retry it
                      before entering another payment.
                    </Text>
                  )}
                  <View style={styles.row}>
                    {(["CASH", "ONLINE"] as const).map((mode) => (
                      <Button
                        key={mode}
                        secondary={paymentMode !== mode}
                        title={mode === "CASH" ? "Cash" : "Online"}
                        disabled={disabled || !!pendingPayment.current}
                        onPress={() => {
                          setPaymentMode(mode);
                          setPhoto(null);
                          setUtr("");
                        }}
                      />
                    ))}
                  </View>
                  <Field
                    label="Payment amount · ₹"
                    value={paymentAmount}
                    onChange={setPaymentAmount}
                    numeric
                    disabled={disabled || !!pendingPayment.current}
                  />
                  <DateField onValidationError={dateValidation.field("Payment received date & time")}
                    label="Payment received date & time"
                    value={paymentTime}
                    onChange={setPaymentTime}
                    disabled={disabled || !!pendingPayment.current}
                  />
                  {paymentMode === "ONLINE" && (
                    <>
                      <Field
                        label="UTR / transaction number"
                        value={utr}
                        onChange={setUtr}
                        maxLength={100}
                        disabled={disabled || !!pendingPayment.current}
                      />
                      <Button
                        secondary
                        title={
                          photo
                            ? "Change Payment Proof"
                            : "Upload Payment Proof"
                        }
                        onPress={() => void chooseProof()}
                        disabled={disabled || !!pendingPayment.current}
                      />
                      {photo && (
                        <Image
                          source={{ uri: photo.uri }}
                          style={styles.proof}
                          resizeMode="contain"
                        />
                      )}
                    </>
                  )}
                  <Button
                    title={
                      pendingPayment.current
                        ? "Retry Payment Confirmation"
                        : "Record Payment"
                    }
                    disabled={disabled}
                    onPress={() => setConfirmation("PAYMENT")}
                  />
                </>
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>03 · RETURN TO ADVISOR</Text>
              <Text style={styles.title}>Complete Billing</Text>
              <Text style={styles.body}>
                Complete invoice steps and collect the full customer balance.
                The vehicle returns to its assigned Advisor for delivery
                clearance.
              </Text>
              <Button
                title="Complete Billing & Return to Advisor"
                disabled={disabled || !canComplete}
                onPress={() => setConfirmation("COMPLETE")}
              />
            </View>
          </>
        )}
      </ScrollView>
      <Modal
        visible={!!notice || !!confirmation}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) {
            setNotice(null);
            setConfirmation(null);
          }
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Ionicons
              name="information-circle-outline"
              color={colors.primary}
              size={30}
            />
            <Text style={styles.title}>
              {notice?.title ||
                (confirmation === "COMPLETE"
                  ? "Return to Advisor?"
                  : "Record payment?")}
            </Text>
            <Text style={styles.body}>
              {notice?.body ||
                (confirmation === "COMPLETE"
                  ? "Billing will close and this vehicle will return to the Advisor for delivery clearance."
                  : "Confirm the received amount, payment mode and date. Saved payments remain in history.")}
            </Text>
            {confirmation ? (
              <>
                <Button
                  title="Confirm"
                  disabled={disabled}
                  onPress={() => {
                    if (confirmation === "COMPLETE") void complete();
                    else void recordPayment();
                  }}
                />
                <Button
                  secondary
                  title="Cancel"
                  disabled={saving}
                  onPress={() => setConfirmation(null)}
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
function Field({
  label,
  value,
  onChange,
  disabled = false,
  numeric = false,
  maxLength = 100,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  numeric?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCorrect={false}
        maxLength={maxLength}
        style={[styles.input, disabled && styles.locked]}
      />
    </View>
  );
}
function DateField({ label, value, onChange, onValidationError, disabled }: {
 label: string; value: string; onChange: (value: string) => void; onValidationError: (error: string | null) => void; disabled: boolean;
}) {

 return <DateTimeField required onValidationError={onValidationError} title={label} label={label} disabled={disabled} maximumDate="now"
 value={parseIndiaLocal(value.replace(" ", "T"))?.toISOString() || null}
 onChange={next => onChange(next ? inputTime(next) : "")} />;
}
function Check({
  title,
  checked,
  onPress,
  disabled,
}: {
  title: string;
  checked: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.row}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={24}
        color={colors.primary}
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
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1 },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heading: {
    fontSize: 26,
    color: colors.text,
    fontWeight: "800",
    marginVertical: 6,
  },
  title: { fontSize: 19, color: colors.text, fontWeight: "800" },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 21 },
  hint: { fontSize: 11, lineHeight: 18, color: colors.textSecondary },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    padding: 18,
    gap: 12,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hero: {
    padding: 22,
    gap: 10,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  heroEyebrow: { color: "white", fontSize: 10, fontWeight: "800" },
  heroTitle: { color: "white", fontSize: 25, fontWeight: "800" },
  heroText: { color: "#FFF0F1", fontSize: 13, lineHeight: 21 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    flexGrow: 1,
    flexBasis: 140,
    borderRadius: 15,
    padding: 16,
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricCount: { color: colors.text, fontSize: 25, fontWeight: "800" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  badge: {
    fontSize: 10,
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    padding: 8,
    borderRadius: 8,
    fontWeight: "800",
  },
  status: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: "800",
    lineHeight: 20,
  },
  balance: { fontSize: 22, fontWeight: "800", color: colors.text },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "white",
    textAlign: "center",
  },
  secondary: { backgroundColor: colors.primaryLight },
  secondaryText: { color: colors.primaryDark },
  disabled: { opacity: 0.45 },
  filter: {
    minHeight: 44,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "white" },
  field: { gap: 7 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  input: {
    padding: 13,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 14,
  },
  locked: { opacity: 0.7 },
  payment: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  proof: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  overlay: {
    flex: 1,
    padding: 24,
    backgroundColor: "rgba(0,0,0,.48)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialog: {
    width: "100%",
    maxWidth: 460,
    padding: 24,
    gap: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
});
