import { KeyboardAvoidingView, Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../lib/supabase";
import DateTimeField from "../../../components/inputs/DateTimeField";
import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import {
  parseDateTime as parseInput,
  validateDateTime,
} from "../../../lib/date-time";
import { colors } from "../../../theme";

const QUEUE = "/(tabs)/advisor/claim-intimation" as const;
type Visit = {
  id: string;
  vehicle_id: string;
  visit_no: number | string | null;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  stage_started_at: string | null;
  closed_at: string | null;
};
type Vehicle = {
  id: string;
  vehicle_no: string;
  customer_name: string | null;
  customer_mobile: string | null;
};
type Intake = {
  visit_id: string;
  vehicle_id: string;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_type: string | null;
  arena_nexa: string | null;
  insurance_type: string | null;
  mi_type_id: string | null;
  insurance_company_id: string | null;
  worker_group: string | null;
  job_card_no: string | null;
  advisor_remarks: string | null;
};
type Context = {
  visit: Visit;
  gateInAt: string;
  vehicle: Vehicle;
  intake: Intake;
  company: string | null;
  mi: string | null;
};
type Notice = {
  kind: "error" | "discard";
  title: string;
  message: string;
};
type Errors = { estimate?: string; claim?: string; time?: string };
const clean = (value?: string | null) => value?.trim() || null;
const messageOf = (error: unknown) =>
  typeof error === "object" && error !== null && "message" in error
    ? String(error.message)
    : "Please try again.";
const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;
function rangeError(
  date: Date,
  gateInAt: string,
  now = Date.now(),
): string | null {
  return validateDateTime(
    Number.isFinite(date.getTime()) ? date.toISOString() : "invalid",
    {
      minimumDate: gateInAt,
      maximumDate: "now",
      required: true,
      minimumMessage: "Choose a time on or after this visit's Gate In time.",
    },
    now,
  );
}
function formatTime(value: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "Not recorded";
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

async function fetchContext(
  visitId?: string,
  vehicleId?: string,
): Promise<Context> {
  if (!visitId)
    throw new Error(
      "The workshop visit was not provided. Return to the queue and select a vehicle.",
    );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Your session has ended. Please sign in again.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !["advisor", "ceo_admin"].includes(profile.role))
    throw new Error(
      "Only an active Advisor or CEO Admin can complete Claim Intimation.",
    );
  const { data: visitData, error: visitError } = await supabase
    .from("workshop_visits")
    .select(
      "id, vehicle_id, visit_no, current_stage, current_status, current_assigned_to, stage_started_at, closed_at",
    )
    .eq("id", visitId)
    .maybeSingle();
  if (visitError) throw visitError;
  if (!visitData)
    throw new Error("This workshop visit is unavailable. Return to the queue.");
  const visit = visitData as Visit;
  if (vehicleId && vehicleId !== visit.vehicle_id)
    throw new Error(
      "The vehicle does not match this visit. Select it again from the queue.",
    );
  if (
    visit.closed_at ||
    visit.current_stage !== "CLAIM_INTIMATION" ||
    !["PENDING", "IN_PROGRESS"].includes(visit.current_status)
  )
    throw new Error(
      `This visit is no longer awaiting Claim Intimation. Current stage: ${visit.current_stage.replace(/_/g, " ")}.`,
    );
  if (profile.role === "advisor" && visit.current_assigned_to !== profile.id)
    throw new Error("This vehicle is assigned to another Advisor.");
  const results = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, vehicle_no, customer_name, customer_mobile")
      .eq("id", visit.vehicle_id)
      .maybeSingle(),
    supabase
      .from("vehicle_intake")
      .select(
        "visit_id, vehicle_id, customer_name, customer_mobile, vehicle_type, arena_nexa, insurance_type, mi_type_id, insurance_company_id, worker_group, job_card_no, advisor_remarks",
      )
      .eq("visit_id", visit.id)
      .maybeSingle(),
  ]);
  for (const result of results) if (result.error) throw result.error;
  if (!results[0].data || !results[1].data)
    throw new Error(
      "Vehicle or Intake details are missing. Contact CEO Admin.",
    );
  const vehicle = results[0].data as Vehicle;
  const intake = results[1].data as Intake;
  if (
    intake.vehicle_id !== visit.vehicle_id ||
    intake.insurance_type !== "INSURANCE"
  )
    throw new Error(
      "This visit must have matching Insurance Intake details before Claim Intimation.",
    );
  const { data: gateEntry, error: gateError } = await supabase
    .from("gate_entries")
    .select("gate_in_at")
    .eq("visit_id", visit.id)
    .eq("vehicle_id", visit.vehicle_id)
    .order("gate_in_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (gateError) throw gateError;
  if (!gateEntry?.gate_in_at || rangeError(new Date(), gateEntry.gate_in_at))
    throw new Error(
      "A valid Gate In time is required before recording Claim Intimation. Refresh or contact CEO Admin.",
    );
  const [company, mi] = await Promise.all([
    intake.insurance_company_id
      ? supabase
          .from("insurance_companies")
          .select("name")
          .eq("id", intake.insurance_company_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    intake.mi_type_id
      ? supabase
          .from("mi_types")
          .select("name")
          .eq("id", intake.mi_type_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (company.error) throw company.error;
  if (mi.error) throw mi.error;
  return {
    visit,
    gateInAt: gateEntry.gate_in_at,
    vehicle,
    intake,
    company: company.data?.name || null,
    mi: mi.data?.name || null,
  };
}

export default function ClaimIntimationFormScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{
    visitId?: string | string[];
    vehicleId?: string | string[];
  }>();
  const visitId = first(params.visitId),
    vehicleId = first(params.vehicleId);
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [estimate, setEstimate] = useState("");
  const [claim, setClaim] = useState("");
  const [time, setTime] = useState(() => new Date().toISOString());
  const [remarks, setRemarks] = useState("");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const busy = useRef(false);
  // Android cannot disable out-of-range clock values. Keep a rejected choice
  // blocking submission until the Advisor chooses a valid date/time.
  const rejectedTime = useRef<string | null>(null);

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setLoadError("");
    setContext(null);
    try {
      const result = await fetchContext(visitId, vehicleId);
      if (mounted.current && request.current === current) setContext(result);
    } catch (error: unknown) {
      if (mounted.current && request.current === current)
        setLoadError(messageOf(error));
    } finally {
      if (mounted.current && request.current === current) setLoading(false);
    }
  }, [visitId, vehicleId]);
  useEffect(() => {
    mounted.current = true;
    setEstimate("");
    setClaim("");
    setRemarks("");
    setTime(new Date().toISOString());
    setDirty(false);
    setCompleted(false);
    setErrors({});
    rejectedTime.current = null;
    setNotice(null);
    void load();
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (completed) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [completed]);

  const returnToQueue = () => {
    setNotice(null);
    router.replace(QUEUE);
  };
  const leave = () => {
    if (busy.current) return;
    if (dirty && !completed && context && !loadError)
      setNotice({
        kind: "discard",
        title: "Leave this form?",
        message: "Your unsaved claim details will be discarded.",
      });
    else returnToQueue();
  };
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (busy.current) return true;
          if (dirty && !completed && context && !loadError)
            setNotice({
              kind: "discard",
              title: "Leave this form?",
              message: "Your unsaved claim details will be discarded.",
            });
          else router.replace(QUEUE);
          return true;
        },
      );
      return () => subscription.remove();
    }, [dirty, completed, context, loadError, router]),
  );
  const closeNotice = () => {
    if (busy.current) return;
    setNotice(null);
  };
  const disabled = loading || saving || completed || !context || !!loadError;
  const changeTime = (value: string | null) => {
    rejectedTime.current = null;
    setTime(value || "");
    setDirty(true);
    setErrors((old) => ({ ...old, time: undefined }));
  };
  const onTimeValidationError = (issue: string | null) => {
    rejectedTime.current = issue;
    if (issue) setDirty(true);
    setErrors((old) => ({ ...old, time: issue || undefined }));
  };
  const save = async () => {
    if (busy.current || disabled || !context) return;
    const parsed = parseInput(time);
    const next: Errors = {};
    if (!estimate.trim()) next.estimate = "Enter the Estimate ID.";
    if (!claim.trim()) next.claim = "Enter the Claim Number.";
    if (!parsed) next.time = "Choose the Claim Date & Time.";
    else {
      const issue =
        rejectedTime.current || rangeError(parsed, context.gateInAt);
      if (issue) next.time = issue;
    }
    setErrors(next);
    if (Object.keys(next).length || !parsed) {
      Keyboard.dismiss();
      setNotice({
        kind: "error",
        title: next.time ? "Check claim date & time" : "Complete claim details",
        message: [
          next.estimate,
          next.claim,
          next.time,
          next.time ? "Gate In: " + formatTime(context.gateInAt) : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
      return;
    }
    busy.current = true;
    Keyboard.dismiss();
    setNotice(null);
    setSaving(true);
    const currentRequest = request.current;
    try {
      const { data, error } = await supabase.rpc(
        "new_workflow_claim_intimation",
        {
          p_visit_id: context.visit.id,
          p_estimate_id: estimate.trim(),
          p_claim_no: claim.trim(),
          p_claim_intimated_at: parsed.toISOString(),
          p_remarks: remarks.trim() || null,
        },
      );
      if (error) throw error;
      if (
        data?.success !== true ||
        data?.visit_id !== context.visit.id ||
        data?.stage !== "PENDING_SURVEY"
      )
        throw new Error(
          "The result could not be confirmed. Return to the queue and refresh before trying again.",
        );
      if (mounted.current && request.current === currentRequest) {
        setCompleted(true);
        setDirty(false);
        setNotice(null);
      }
    } catch (error: unknown) {
      if (mounted.current && request.current === currentRequest)
        setNotice({
          kind: "error",
          title: "Unable to complete",
          message: messageOf(error),
        });
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.screen}
      edges={["top", "bottom", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.page}>
          <View style={styles.topBar}>
            <BackButton
              accessibilityLabel="Return to Claim Intimation queue"
              disabled={saving}
              onPress={leave}
            />
            <BrandPill />
          </View>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            contentContainerStyle={styles.content}
          >
            <View style={styles.hero}>
              <Text style={styles.eyebrowWhite}>ADVISOR · INSURANCE</Text>
              <Text style={styles.heroTitle}>Claim Intimation</Text>
              <Text style={styles.heroBody}>
                Record the insurer’s claim details and actual intimation time.
              </Text>
            </View>
            {completed ? (
              <View style={styles.card} accessibilityRole="alert">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={38}
                  color={colors.primary}
                />
                <Text style={styles.title}>Claim Intimation completed</Text>
                <Text style={styles.body}>
                  {context?.vehicle.vehicle_no} has moved to Pending Survey.
                  Your claim details and actual claim time have been recorded.
                </Text>
                <Text style={styles.badge}>Next: Pending Survey</Text>
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <Button title="Claim Queue" onPress={leave} secondary disabled={saving} />
                  </View>
                  <View style={styles.grow}>
                    <Button title="Survey" disabled={saving} onPress={() => {
                      if (busy.current || !completed) return;
                      setNotice(null);
                      router.replace("/(tabs)/advisor/survey");
                    }} />
                  </View>
                </View>
              </View>
            ) : loading ? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.body}>Loading vehicle details…</Text>
              </View>
            ) : loadError ? (
              <View style={styles.card} accessibilityRole="alert">
                <Text style={styles.title}>Vehicle unavailable</Text>
                <Text style={styles.body}>{loadError}</Text>
                <Button
                  title="Retry loading"
                  onPress={() => void load()}
                  secondary
                />
                <Button title="Return to Claim queue" onPress={returnToQueue} />
              </View>
            ) : (
              context && (
                <>
                  <View style={styles.card}>
                    <View style={styles.row}>
                      <View style={styles.car}>
                        <Ionicons
                          name="car-sport-outline"
                          size={25}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.grow}>
                        <Text style={styles.vehicleNumber}>
                          {context.vehicle.vehicle_no}
                        </Text>
                        <Text style={styles.body}>
                          {clean(context.intake.customer_name) ||
                            clean(context.vehicle.customer_name) ||
                            "Customer not recorded"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.badges}>
                      <Text style={styles.badge}>Insurance</Text>
                      <Text style={styles.small}>
                        Visit {context.visit.visit_no ?? "—"}
                      </Text>
                    </View>
                    <View style={styles.grid}>
                      <Detail
                        label="Mobile number"
                        value={
                          clean(context.intake.customer_mobile) ||
                          clean(context.vehicle.customer_mobile)
                        }
                      />
                      <Detail
                        label="Job card"
                        value={context.intake.job_card_no}
                      />
                      <Detail
                        label="Insurance company"
                        value={context.company}
                      />
                      <Detail label="MI / NON-MI" value={context.mi} />
                      <Detail
                        label="Gate In"
                        value={formatTime(context.gateInAt)}
                      />
                      <Detail
                        label="Vehicle type"
                        value={context.intake.vehicle_type}
                      />
                      <Detail
                        label="Arena / Nexa"
                        value={context.intake.arena_nexa}
                      />
                    </View>
                    <Text style={styles.small}>
                      Awaiting intimation since{" "}
                      {formatTime(context.visit.stage_started_at)}
                    </Text>
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.eyebrow}>CLAIM DETAILS</Text>
                    <Text style={styles.title}>Enter claim information</Text>
                    <Text style={styles.body}>
                      All three claim fields are required. Remarks are optional.
                    </Text>
                    <Field
                      label="Estimate ID"
                      value={estimate}
                      disabled={disabled}
                      error={errors.estimate}
                      placeholder="Enter Estimate ID"
                      onChange={(value) => {
                        setEstimate(value);
                        setDirty(true);
                        setErrors((old) => ({ ...old, estimate: undefined }));
                      }}
                    />
                    <Field
                      label="Claim Number"
                      value={claim}
                      disabled={disabled}
                      error={errors.claim}
                      placeholder="Enter Claim Number"
                      onChange={(value) => {
                        setClaim(value);
                        setDirty(true);
                        setErrors((old) => ({ ...old, claim: undefined }));
                      }}
                    />
                    <Field
                      label="Remarks · optional"
                      value={remarks}
                      onChange={(value) => {
                        setRemarks(value);
                        setDirty(true);
                      }}
                      disabled={disabled}
                      placeholder="Notes for the Survey stage"
                      multiline
                    />
                  </View>
                  <DateTimeField
                    key={context.visit.id}
                    title="Claim Date & Time"
                    description="Select when the insurer was notified."
                    label="Claim intimation"
                    value={time || null}
                    onChange={changeTime}
                    onValidationError={onTimeValidationError}
                    minimumDate={context.gateInAt}
                    maximumDate="now"
                    minimumMessage="Choose a time on or after this visit's Gate In time."
                    required
                    error={errors.time}
                    disabled={disabled}
                    active={isFocused && !notice}
                  />
                  <View style={styles.next}>
                    <Ionicons
                      name="arrow-forward-circle-outline"
                      size={23}
                      color={colors.primary}
                    />
                    <View style={styles.grow}>
                      <Text style={styles.nextTitle}>Next: Pending Survey</Text>
                      <Text style={styles.body}>
                        Completing Claim Intimation moves this visit to the
                        Survey queue.
                      </Text>
                    </View>
                  </View>
                  <Button
                    title={
                      saving
                        ? "Saving…"
                        : completed
                          ? "Claim Intimation completed"
                          : "Complete Claim Intimation"
                    }
                    onPress={() => void save()}
                    disabled={disabled}
                    loading={saving}
                  />
                  <Button
                    title={
                      completed
                        ? "Return to Claim queue"
                        : "Cancel & return to queue"
                    }
                    onPress={leave}
                    disabled={saving}
                    secondary
                  />
                </>
              )
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      {isFocused && notice && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeNotice}
        >
          <SafeAreaView style={styles.overlay}>
            <View style={styles.dialog} accessibilityViewIsModal>
              <Ionicons
                name={
                  notice.kind === "discard"
                    ? "exit-outline"
                    : "alert-circle-outline"
                }
                size={34}
                color={colors.primary}
              />
              <Text style={styles.title}>{notice?.title}</Text>
              <Text style={styles.body}>{notice?.message}</Text>
              {notice?.kind === "discard" ? (
                <>
                  <Button
                    title="Keep editing"
                    onPress={() => setNotice(null)}
                  />
                  <Button
                    title="Discard & return to queue"
                    secondary
                    onPress={() => {
                      setNotice(null);
                      returnToQueue();
                    }}
                  />
                </>
              ) : (
                <Button title="OK" onPress={closeNotice} />
              )}
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.small}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {clean(value) || "Not recorded"}
      </Text>
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  error?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        editable={!disabled}
        autoCorrect={false}
        autoCapitalize="none"
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          !!error && styles.inputError,
          disabled && styles.disabled,
        ]}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}
function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading && <ActivityIndicator color="white" size="small" />}
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  page: { flex: 1, width: "100%", maxWidth: 860, alignSelf: "center" },
  topBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { minHeight: 44, flexDirection: "row", gap: 4, alignItems: "center" },
  backText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  brand: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  content: { padding: 16, paddingTop: 4, paddingBottom: 36, gap: 16 },
  hero: {
    padding: 22,
    borderRadius: 20,
    backgroundColor: colors.primary,
    gap: 10,
  },
  eyebrowWhite: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroTitle: { color: "white", fontSize: 28, fontWeight: "900" },
  heroBody: { color: "rgba(255,255,255,.94)", fontSize: 13, lineHeight: 21 },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  car: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleNumber: { color: colors.text, fontSize: 21, fontWeight: "900" },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: colors.primaryLight,
    padding: 8,
    borderRadius: 8,
  },
  small: { color: colors.textSecondary, fontSize: 11, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detail: {
    flexGrow: 1,
    flexBasis: 140,
    padding: 12,
    borderRadius: 11,
    backgroundColor: colors.background,
    gap: 4,
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: "800" },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  field: { gap: 7 },
  label: { color: colors.text, fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 50,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    fontSize: 14,
    color: colors.text,
  },
  multiline: { minHeight: 104, textAlignVertical: "top" },
  inputError: { borderColor: "#B42318" },
  errorText: { color: "#B42318", fontSize: 12, lineHeight: 18 },
  next: {
    padding: 16,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  nextTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "center",
  },
  secondary: { backgroundColor: colors.primaryLight },
  secondaryText: { color: colors.primaryDark },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  empty: { paddingVertical: 50, alignItems: "center", gap: 14 },
  overlay: {
    flex: 1,
    padding: 20,
    backgroundColor: "rgba(0,0,0,.48)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    width: "100%",
    maxWidth: 440,
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.surface,
    gap: 16,
  },
});
