import { ScrollView, TextInput } from "../inputs/KeyboardAware";
import BackButton from "../navigation/BackButton";
import BrandPill from "../navigation/BrandPill";
import { returnToRoute, useHardwareBack } from "../../lib/back-navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatInspectionTime, InspectionFilter, InspectionVehicle, useFinalInspectorQueue } from "../../lib/final-inspector";
import { colors } from "../../theme";

const filters: { code: InspectionFilter; label: string }[] = [
  { code: "ALL", label: "All assigned" }, { code: "PENDING", label: "Pending" },
  { code: "IN_PROGRESS", label: "In progress" }, { code: "REINSPECTION", label: "Reinspection" },
];
const queuePath = "/(tabs)/final-inspector/inspections";
function routeFilter(value: unknown): InspectionFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return filters.some(filter => filter.code === candidate) ? candidate as InspectionFilter : "ALL";
}

export default function InspectionWorkspace({ dashboard = false }: { dashboard?: boolean }) {
  const handleNavigationBack = () => returnToRoute("/(tabs)/final-inspector");
  useHardwareBack(handleNavigationBack, !dashboard);

  const { items, loading, refreshing, error, refresh } = useFinalInspectorQueue();
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const [filter, setFilter] = useState<InspectionFilter>(routeFilter(params.filter));
  const [search, setSearch] = useState("");
  useEffect(() => { setFilter(routeFilter(params.filter)); }, [params.filter]);
  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter(item => item.current_status === "PENDING").length,
    progress: items.filter(item => item.current_status === "IN_PROGRESS").length,
    reinspection: items.filter(item => item.inspection_attempts > 0).length,
  }), [items]);
  const visible = useMemo(() => items.filter(item => {
    const query = search.trim().toLowerCase();
    if (query && ![item.vehicle_no, item.model, item.job_type].some(value => value?.toLowerCase().includes(query))) return false;
    return filter === "ALL" || (filter === "REINSPECTION" ? item.inspection_attempts > 0 : item.current_status === filter);
  }), [items, filter, search]);
  const openQueue = (value: InspectionFilter = "ALL") => {
    if (dashboard) router.push({ pathname: queuePath as any, params: { filter: value } });
    else { setFilter(value); setSearch(""); }
  };
  const displayed = dashboard ? items.slice(0, 3) : visible;
  return <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <View style={styles.topBar}>
      {dashboard ? <Text style={styles.workspace}>FINAL INSPECTOR</Text> : <BackButton onPress={handleNavigationBack} />}
      <BrandPill />
    </View>
    <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroCircle} />
        <Text style={styles.heroPill}>QUALITY BEFORE HANDOVER</Text>
        <Text style={styles.heroTitle}>{dashboard ? "Final Inspection" : "My assigned vehicles"}</Text>
        <Text style={styles.heroBody}>Every vehicle needs a final quality check. Pass returns it to the Advisor; fail returns it to Floor for rework.</Text>
        <View style={styles.heroFooter}><Ionicons name="shield-checkmark-outline" size={19} color="white" /><Text style={styles.heroFooterText}>Your active assignments · Paid & Insurance</Text></View>
      </View>
      {error ? <View style={styles.card}><Ionicons name="alert-circle-outline" size={27} color={colors.error} /><Text style={styles.title}>Unable to load inspections</Text><Text style={styles.body}>{error}</Text><Button title="Refresh inspections" disabled={loading || refreshing} onPress={refresh} /></View> : <>
        <View style={styles.metrics}>
          <Metric title="Assigned" count={counts.all} icon="clipboard-outline" onPress={() => openQueue("ALL")} />
          <Metric title="Pending" count={counts.pending} icon="time-outline" onPress={() => openQueue("PENDING")} />
          <Metric title="In progress" count={counts.progress} icon="search-outline" onPress={() => openQueue("IN_PROGRESS")} />
          <Metric title="Reinspection" count={counts.reinspection} icon="repeat-outline" onPress={() => openQueue("REINSPECTION")} />
        </View>
        {dashboard ? <View style={styles.notice}>
          <View style={styles.noticeIcon}><Ionicons name="checkmark-done-outline" size={25} color={colors.primary} /></View>
          <View style={styles.grow}><Text style={styles.title}>Inspect the completed work</Text><Text style={styles.body}>Review repairs, record Pass or Fail, and describe what needs correction when sending a vehicle for rework. Every attempt stays in history.</Text></View>
        </View> : <>
          <TextInput accessibilityLabel="Search assigned inspections" value={search} onChangeText={setSearch} placeholder="Search vehicle, model or job type" placeholderTextColor={colors.textSecondary} style={styles.input} />
          <View style={styles.filters}>{filters.map(option => <Pressable key={option.code} accessibilityRole="button" accessibilityState={{ selected: filter === option.code }} onPress={() => setFilter(option.code)} style={[styles.filter, filter === option.code && styles.filterActive]}><Text style={[styles.filterText, filter === option.code && styles.filterActiveText]}>{option.label}</Text></Pressable>)}</View>
        </>}
        <View style={styles.sectionHeader}><View style={styles.grow}><Text style={styles.eyebrow}>{dashboard ? "YOUR NEXT INSPECTIONS" : "INSPECTION QUEUE"}</Text><Text style={styles.title}>{dashboard ? "Awaiting your quality check" : `${visible.length} vehicle${visible.length === 1 ? "" : "s"}`}</Text></View>{dashboard && <Pressable accessibilityRole="button" onPress={() => openQueue()} style={styles.viewAll}><Text style={styles.linkText}>View all</Text><Ionicons name="arrow-forward" size={17} color={colors.primaryDark} /></Pressable>}</View>
        {loading && <ActivityIndicator size="large" color={colors.primary} />}
        {!loading && !displayed.length && <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="clipboard-outline" size={29} color={colors.primary} /></View><Text style={styles.title}>{items.length ? "No matching vehicles" : "No inspections assigned"}</Text><Text style={[styles.body, styles.center]}>{items.length ? "Change the filter or search to see your other assigned vehicles." : "Vehicles appear here when the Advisor or CEO Admin assigns you as Final Inspector."}</Text>{!!items.length && <Button secondary title="Clear search & filters" onPress={() => { setSearch(""); setFilter("ALL"); }} />}</View>}
        {displayed.map(item => <VehicleCard key={item.visit_id} item={item} filter={dashboard ? "ALL" : filter} disabled={loading || refreshing} />)}
        {dashboard && !!items.length && <Button title="Open My Inspections" onPress={() => openQueue()} />}
        <View style={styles.rule}><Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} /><Text style={[styles.body, styles.grow]}>Reinspection is required after Floor rework. Billing starts only after a passed inspection and the Advisor's Billing handoff.</Text></View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

function VehicleCard({ item, disabled, filter }: { item: InspectionVehicle; disabled: boolean; filter: InspectionFilter }) {
  const reinspection = item.inspection_attempts > 0;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${item.vehicle_no}`} disabled={disabled} onPress={() => router.push({ pathname: "/(tabs)/final-inspector/inspections/[visitId]" as any, params: { visitId: item.visit_id, filter } })} style={styles.card}>
    <View style={styles.row}><View style={styles.grow}><Text style={styles.vehicle}>{item.vehicle_no}</Text><Text style={styles.body}>{item.model || "Model not recorded"}</Text></View><Ionicons name="chevron-forward" size={22} color={colors.primary} /></View>
    <View style={styles.tags}><Text style={styles.status}>{item.current_status === "IN_PROGRESS" ? "In progress" : "Pending inspection"}</Text><Text style={styles.tag}>{item.job_type === "PAID" ? "Paid" : item.job_type === "INSURANCE" ? "Insurance" : "Job type unavailable"}</Text>{reinspection && <Text style={styles.reinspectionTag}>Reinspection</Text>}</View>
    <View style={styles.cardDetails}><View style={styles.grow}><Text style={styles.detailLabel}>NEXT ATTEMPT</Text><Text style={styles.detailValue}>#{item.inspection_attempts + 1}</Text></View><View style={styles.grow}><Text style={styles.detailLabel}>ENTERED INSPECTION</Text><Text style={styles.detailValue}>{formatInspectionTime(item.stage_started_at)}</Text></View></View>
    {reinspection && <View style={styles.previous}><Ionicons name="repeat-outline" size={17} color={colors.primaryDark} /><Text style={[styles.body, styles.grow]}>Previous result: {item.last_inspection_result || "Recorded"} · {formatInspectionTime(item.last_inspection_at)}</Text></View>}
    <Text style={styles.linkText}>Review vehicle & record result</Text>
  </Pressable>;
}
function Metric({ title, count, icon, onPress }: { title: string; count: number; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${count}`} onPress={onPress} style={styles.metric}><View style={styles.metricIcon}><Ionicons name={icon} size={19} color={colors.primary} /></View><Text style={styles.metricCount}>{count}</Text><Text style={styles.metricTitle}>{title}</Text></Pressable>;
}
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.linkText]}>{title}</Text></Pressable>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, paddingBottom: 36, gap: 16, width: "100%", maxWidth: 860, alignSelf: "center" },
  topBar: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  workspace: { color: colors.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, back: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  backText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, padding: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }, brandText: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  hero: { padding: 20, borderRadius: 17, backgroundColor: colors.primary, gap: 10, overflow: "hidden" },
  heroCircle: { position: "absolute", width: 180, height: 180, borderRadius: 90, top: -85, right: -55, backgroundColor: "rgba(255,255,255,.10)" },
  heroPill: { color: "white", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, heroTitle: { color: "white", fontSize: 27, fontWeight: "900" },
  heroBody: { color: "rgba(255,255,255,.90)", fontSize: 13, lineHeight: 21 }, heroFooter: { flexDirection: "row", gap: 8, alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.22)", paddingTop: 13, marginTop: 3 },
  heroFooterText: { color: "white", fontSize: 11, fontWeight: "700", flex: 1 }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexBasis: 150, flexGrow: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 15, gap: 8 },
  metricIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  metricCount: { color: colors.text, fontSize: 26, fontWeight: "900" }, metricTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  card: { padding: 18, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 13 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" }, body: { color: colors.textSecondary, fontSize: 12, lineHeight: 20 },
  grow: { flex: 1 }, row: { flexDirection: "row", alignItems: "center", gap: 10 }, notice: { padding: 17, flexDirection: "row", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17 },
  noticeIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primaryLight },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13, color: colors.text, backgroundColor: colors.surface, fontSize: 14 },
  filters: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, filter: { paddingHorizontal: 13, minHeight: 42, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary }, filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" }, filterActiveText: { color: "white" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, eyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: "900", letterSpacing: 0.7, marginBottom: 5 },
  viewAll: { flexDirection: "row", gap: 5, alignItems: "center", minHeight: 44 }, linkText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  vehicle: { color: colors.text, fontSize: 20, fontWeight: "900" }, tags: { flexDirection: "row", gap: 7, flexWrap: "wrap" },
  status: { color: colors.primaryDark, backgroundColor: colors.primaryLight, borderRadius: 8, padding: 7, fontSize: 10, fontWeight: "800" },
  tag: { color: colors.textSecondary, backgroundColor: colors.background, borderRadius: 8, padding: 7, fontSize: 10, fontWeight: "700" },
  reinspectionTag: { color: "#946200", backgroundColor: "#FFF6DD", borderRadius: 8, padding: 7, fontSize: 10, fontWeight: "800" },
  cardDetails: { flexDirection: "row", gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  detailLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: "700", letterSpacing: 0.4 }, detailValue: { color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 5, lineHeight: 19 },
  previous: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 11, borderRadius: 11, backgroundColor: colors.primaryLight },
  empty: { padding: 28, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12, alignItems: "center" },
  emptyIcon: { width: 58, height: 58, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }, center: { textAlign: "center" },
  rule: { flexDirection: "row", gap: 8, padding: 8 }, button: { minHeight: 50, padding: 14, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "white", fontSize: 13, fontWeight: "800", textAlign: "center" }, secondary: { backgroundColor: colors.primaryLight }, disabled: { opacity: 0.45 },
});
