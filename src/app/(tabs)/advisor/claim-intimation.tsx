import { TextInput } from "../../../components/inputs/KeyboardAware";
import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../lib/supabase";
import { colors } from "../../../theme";

type Visit = {
  id: string;
  vehicle_id: string;
  visit_no: number | string | null;
  current_stage: string;
  current_status: string;
  stage_started_at: string | null;
  created_at: string | null;
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
  job_card_no: string | null;
};
type Master = { id: string; name: string | null };
type Profile = { id: string; role: string };
type Item = {
  visit: Visit;
  vehicle: Vehicle | null;
  intake: Intake | null;
  company: string | null;
  mi: string | null;
};

const textValue = (value: string | null | undefined) => value?.trim() || null;
const startTime = (item: Item) =>
  item.visit.stage_started_at || item.visit.created_at;
function elapsed(value: string | null, now: number) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? Math.max(0, now - time) : null;
}
function waiting(value: string | null, now: number) {
  const ms = elapsed(value, now);
  if (ms === null) return "Time unavailable";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  return `${Math.floor(hours / 24)}d${hours % 24 ? ` ${hours % 24}h` : ""}`;
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
function issue(item: Item) {
  if (!item.vehicle)
    return "Vehicle details are unavailable. Refresh or contact CEO Admin.";
  if (!item.intake || item.intake.vehicle_id !== item.visit.vehicle_id)
    return "Intake details are missing or do not match this visit. Contact CEO Admin.";
  if (item.intake.insurance_type !== "INSURANCE")
    return "This visit is not marked as an Insurance job. Contact CEO Admin.";
  return null;
}

async function fetchQueue(profile: Profile): Promise<Item[]> {
  // Paginate the queue so the API's default row limit cannot hide vehicles.
  const visits: Visit[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase
      .from("workshop_visits")
      .select(
        "id, vehicle_id, visit_no, current_stage, current_status, stage_started_at, created_at",
      )
      .eq("current_stage", "CLAIM_INTIMATION")
      .in("current_status", ["PENDING", "IN_PROGRESS"])
      .is("closed_at", null)
      .order("stage_started_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (profile.role === "advisor")
      query = query.eq("current_assigned_to", profile.id);
    const { data, error } = await query;
    if (error) throw error;
    const page = (data || []) as Visit[];
    visits.push(...page);
    if (page.length < 500) break;
  }
  if (!visits.length) return [];

  const vehicleMap = new Map<string, Vehicle>();
  const intakeMap = new Map<string, Intake>();
  // Small batches also keep filter URLs within practical limits.
  for (let offset = 0; offset < visits.length; offset += 100) {
    const batch = visits.slice(offset, offset + 100);
    const results = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, vehicle_no, customer_name, customer_mobile")
        .in("id", [...new Set(batch.map((v) => v.vehicle_id))]),
      supabase
        .from("vehicle_intake")
        .select(
          "visit_id, vehicle_id, customer_name, customer_mobile, vehicle_type, arena_nexa, insurance_type, mi_type_id, insurance_company_id, job_card_no",
        )
        .in(
          "visit_id",
          batch.map((v) => v.id),
        ),
    ]);
    for (const result of results) if (result.error) throw result.error;
    for (const vehicle of (results[0].data || []) as Vehicle[])
      vehicleMap.set(vehicle.id, vehicle);
    for (const intake of (results[1].data || []) as Intake[])
      intakeMap.set(intake.visit_id, intake);
  }
  const companyMap = new Map<string, string | null>();
  const miMap = new Map<string, string | null>();
  const companyIds = [
    ...new Set(
      [...intakeMap.values()]
        .map((i) => i.insurance_company_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const miIds = [
    ...new Set(
      [...intakeMap.values()]
        .map((i) => i.mi_type_id)
        .filter((id): id is string => !!id),
    ),
  ];
  await Promise.all([
    (async () => {
      for (let offset = 0; offset < companyIds.length; offset += 100) {
        const { data, error } = await supabase
          .from("insurance_companies")
          .select("id, name")
          .in("id", companyIds.slice(offset, offset + 100));
        if (error) throw error;
        for (const row of (data || []) as Master[])
          companyMap.set(row.id, row.name);
      }
    })(),
    (async () => {
      for (let offset = 0; offset < miIds.length; offset += 100) {
        const { data, error } = await supabase
          .from("mi_types")
          .select("id, name")
          .in("id", miIds.slice(offset, offset + 100));
        if (error) throw error;
        for (const row of (data || []) as Master[]) miMap.set(row.id, row.name);
      }
    })(),
  ]);
  return visits.map((visit) => {
    const intake = intakeMap.get(visit.id) || null;
    return {
      visit,
      intake,
      vehicle: vehicleMap.get(visit.vehicle_id) || null,
      company: intake?.insurance_company_id
        ? companyMap.get(intake.insurance_company_id) || null
        : null,
      mi: intake?.mi_type_id ? miMap.get(intake.mi_type_id) || null : null,
    };
  });
}

export default function ClaimIntimationScreen() {
  const handleNavigationBack = () => {
    returnToRoute("/(tabs)/advisor");
  };
  useHardwareBack(handleNavigationBack);

  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("Your Insurance vehicles");
  const [now, setNow] = useState(Date.now());
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const focused = useRef(false);
  const request = useRef(0);
  const inFlight = useRef(false);
  const navigating = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (!focused.current || inFlight.current) return;
    inFlight.current = true;
    const current = ++request.current;
    const isCurrent = () => focused.current && request.current === current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user)
        throw new Error("Your session has ended. Please sign in again.");
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!data || !["advisor", "ceo_admin"].includes(data.role))
        throw new Error(
          "Only an active Advisor or CEO Admin can access Claim Intimation.",
        );
      if (!isCurrent()) return;
      const queue = await fetchQueue(data as Profile);
      if (!isCurrent()) return;
      setItems(queue);
      setScope(
        data.role === "ceo_admin"
          ? "All Insurance vehicles"
          : "Your Insurance vehicles",
      );
      setNow(Date.now());
      setUpdatedAt(new Date().toISOString());
    } catch (caught: unknown) {
      if (isCurrent())
        setError(
          typeof caught === "object" && caught !== null && "message" in caught
            ? String(caught.message)
            : "Unable to load Claim Intimation. Please retry.",
        );
    } finally {
      if (isCurrent()) {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      inFlight.current = false;
      navigating.current = false;
      setItems([]);
      setUpdatedAt(null);
      void load();
      const timer = setInterval(() => setNow(Date.now()), 30000);
      return () => {
        focused.current = false;
        request.current += 1;
        inFlight.current = false;
        clearInterval(timer);
      };
    }, [load]),
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const compact = term.replace(/\s+/g, "");
    if (!term) return items;
    return items.filter((item) => {
      const values = [
        item.vehicle?.vehicle_no,
        item.intake?.customer_name,
        item.vehicle?.customer_name,
        item.intake?.customer_mobile,
        item.vehicle?.customer_mobile,
        item.intake?.job_card_no,
        item.company,
        item.mi,
      ];
      return values.some(
        (value) =>
          value &&
          (value.toLowerCase().includes(term) ||
            value.toLowerCase().replace(/\s+/g, "").includes(compact)),
      );
    });
  }, [items, search]);
  const longWait = items.filter(
    (item) => (elapsed(startTime(item), now) || 0) >= 86400000,
  ).length;
  const blocked = loading || refreshing || !!error;
  const open = (item: Item) => {
    if (blocked || issue(item) || navigating.current) return;
    navigating.current = true;
    router.push({
      pathname: "/(tabs)/advisor/claim-intimation-form",
      params: { visitId: item.visit.id, vehicleId: item.visit.vehicle_id },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <BackButton accessibilityLabel="Back to dashboard" onPress={handleNavigationBack} />
          <BrandPill />
        </View>
        <FlatList
          data={visible}
          keyExtractor={(item) => item.visit.id}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.hero}>
                <Text style={styles.eyebrowWhite}>ADVISOR · INSURANCE</Text>
                <Text style={styles.heroTitle}>Claim Intimation</Text>
                <Text style={styles.heroBody}>
                  Notify the insurer and record claim details before Survey.
                </Text>
                <View style={styles.heroFooter}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="white"
                  />
                  <Text style={styles.heroBody}>{scope}</Text>
                </View>
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>
                    {loading ? "—" : items.length}
                  </Text>
                  <Text style={styles.small}>Awaiting intimation</Text>
                </View>
                <View style={styles.stat}>
                  <Text
                    style={[styles.statNumber, longWait > 0 && styles.amber]}
                  >
                    {loading ? "—" : longWait}
                  </Text>
                  <Text style={styles.small}>Waiting 24h or more</Text>
                </View>
              </View>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  accessibilityLabel="Search Claim Intimation vehicles"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Vehicle, customer, mobile or job card"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.searchInput}
                />
                {!!search && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => setSearch("")}
                    style={styles.iconButton}
                  >
                    <Ionicons
                      name="close-circle"
                      size={21}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
              {!!error && (
                <View style={styles.errorCard} accessibilityRole="alert">
                  <Text style={styles.cardTitle}>Queue unavailable</Text>
                  <Text style={styles.body}>{error}</Text>
                  {!!items.length && (
                    <Text style={styles.small}>
                      Previously loaded vehicles are shown. Refresh before
                      opening a form.
                    </Text>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void load(true)}
                    disabled={loading || refreshing}
                    style={styles.retry}
                  >
                    <Text style={styles.retryText}>Retry loading</Text>
                  </Pressable>
                </View>
              )}
              {!loading && (
                <View style={styles.queueHeading}>
                  <Text style={styles.sectionTitle}>
                    {search.trim()
                      ? `${visible.length} of ${items.length} vehicles`
                      : "Pending vehicles"}
                  </Text>
                  <Text style={styles.small}>Oldest first</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => {
            const problem = issue(item);
            const overdue = (elapsed(startTime(item), now) || 0) >= 86400000;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.carIcon}>
                    <Ionicons
                      name="car-sport-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.vehicleNumber}>
                      {item.vehicle?.vehicle_no || "Vehicle number unavailable"}
                    </Text>
                    <Text style={styles.body}>
                      {textValue(item.intake?.customer_name) ||
                        textValue(item.vehicle?.customer_name) ||
                        "Customer not recorded"}
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  <View
                    style={[styles.waitBadge, overdue && styles.overdueBadge]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={overdue ? "#946200" : colors.primaryDark}
                    />
                    <Text style={[styles.badgeText, overdue && styles.amber]}>
                      Waiting {waiting(startTime(item), now)}
                    </Text>
                  </View>
                  <Text style={styles.visitBadge}>
                    Visit {item.visit.visit_no ?? "—"}
                  </Text>
                </View>
                <View style={styles.grid}>
                  <Detail label="Job card" value={item.intake?.job_card_no} />
                  <Detail
                    label="Mobile number"
                    value={
                      textValue(item.intake?.customer_mobile) ||
                      textValue(item.vehicle?.customer_mobile)
                    }
                  />
                  <Detail label="Insurance company" value={item.company} />
                  <Detail label="MI / NON-MI" value={item.mi} />
                </View>
                <Text style={styles.small}>
                  Awaiting since {formatTime(startTime(item))}
                </Text>
                {!!problem && (
                  <View style={styles.warning}>
                    <Text style={styles.warningText}>{problem}</Text>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Start Claim Intimation for ${item.vehicle?.vehicle_no || "vehicle"}`}
                  accessibilityState={{ disabled: blocked || !!problem }}
                  disabled={blocked || !!problem}
                  onPress={() => open(item)}
                  style={({ pressed }) => [
                    styles.action,
                    pressed && styles.pressed,
                    (blocked || !!problem) && styles.disabled,
                  ]}
                >
                  <Text style={styles.actionText}>
                    {problem
                      ? "Details need attention"
                      : "Start Claim Intimation"}
                  </Text>
                  {!problem && (
                    <Ionicons name="arrow-forward" size={18} color="white" />
                  )}
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.body}>Loading Claim Intimation…</Text>
              </View>
            ) : error ? null : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={
                      search.trim()
                        ? "search-outline"
                        : "shield-checkmark-outline"
                    }
                    size={34}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.cardTitle}>
                  {search.trim() ? "No matching vehicles" : "All caught up"}
                </Text>
                <Text style={[styles.body, styles.center]}>
                  {search.trim()
                    ? "Try another vehicle number, customer, mobile or job card."
                    : "Insurance vehicles appear here after Vehicle Intake is completed."}
                </Text>
                {!!search.trim() && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSearch("")}
                    style={styles.retry}
                  >
                    <Text style={styles.retryText}>Clear search</Text>
                  </Pressable>
                )}
              </View>
            )
          }
          ListFooterComponent={
            updatedAt && !loading ? (
              <Text style={styles.footer}>
                Updated {formatTime(updatedAt)} · Pull down to refresh
              </Text>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.small}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {textValue(value) || "Not recorded"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: "100%", maxWidth: 860, alignSelf: "center" },
  topBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  brand: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  content: { padding: 16, paddingTop: 4, paddingBottom: 40 },
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
  heroBody: {
    color: "rgba(255,255,255,.94)",
    fontSize: 13,
    lineHeight: 21,
    flexShrink: 1,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  stats: { flexDirection: "row", gap: 12, marginVertical: 16 },
  stat: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 5,
  },
  statNumber: { color: colors.text, fontSize: 25, fontWeight: "900" },
  small: { color: colors.textSecondary, fontSize: 11, lineHeight: 18 },
  amber: { color: "#946200" },
  searchBox: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 13,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  queueHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
  },
  sectionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 14,
    gap: 13,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  carIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleNumber: { color: colors.text, fontSize: 20, fontWeight: "900" },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  waitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  overdueBadge: { backgroundColor: "#FFF6DD" },
  badgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: "700" },
  visitBadge: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    padding: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detail: {
    flexGrow: 1,
    flexBasis: 140,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 11,
    gap: 4,
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  action: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 13,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actionText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },
  pressed: { backgroundColor: colors.primaryDark },
  disabled: { opacity: 0.45 },
  warning: { padding: 12, borderRadius: 11, backgroundColor: "#FFF6DD" },
  warningText: { color: "#946200", fontSize: 12, lineHeight: 19 },
  errorCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  retry: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
  },
  retryText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  empty: {
    paddingVertical: 44,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 14,
  },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  center: { textAlign: "center" },
  footer: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 18,
    marginVertical: 12,
  },
});
