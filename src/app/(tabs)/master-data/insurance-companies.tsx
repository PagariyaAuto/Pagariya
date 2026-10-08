import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useIsFocused } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../lib/supabase";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import { colors, radius, spacing, typography } from "../../../theme";

type Filter = "All" | "Active" | "Inactive";
type InsuranceCompany = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type Editor = { kind: "editor"; model: InsuranceCompany | null };
type Dialog =
  | Editor
  | { kind: "discard"; editor: Editor }
  | { kind: "status"; model: InsuranceCompany; activate: boolean }
  | { kind: "notice"; title: string; body: string };
const columns = "id, name, is_active, created_at, updated_at";
const normalize = (value: string) => value.trim().toLowerCase();

function errorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "23505")
    return "This company already exists. Use its existing entry, or reactivate it if it is inactive.";
  if (code === "42501")
    return "Your account cannot change insurance companies. An active CEO Admin account is required.";
  if (code === "PGRST116")
    return "This company changed or is no longer available to your account. Close this dialog, refresh the list and try again.";
  if (code === "23514")
    return "The company details did not pass database validation. Check the company name.";
  return (
    (error as { message?: string })?.message ||
    "Unable to complete the request. Please try again."
  );
}

export default function InsuranceCompanys() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const requests = useRef(0);
  const disabled = saving || loading || refreshing;
  const isFocused = useIsFocused();

  const loadCompanies = useCallback(async (refresh = false) => {
    if (busy.current) return;
    const request = ++requests.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setLoadError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user)
        throw new Error(
          "Your session has expired. Sign in again to view insurance companies.",
        );
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", auth.user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.is_active)
        throw new Error(
          "An active account is required to view insurance companies.",
        );

      // Fetch all pages so the list and duplicate checks are not capped by the API limit.
      const fetched = new Map<string, InsuranceCompany>();
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("insurance_companies")
          .select(columns)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        if (!mounted.current || request !== requests.current) return;
        for (const item of (data ?? []) as InsuranceCompany[])
          fetched.set(item.id, item);
        if ((data ?? []).length < pageSize) break;
      }
      if (mounted.current && request === requests.current) {
        setCompanies([...fetched.values()]);
        setCanManage(profile.role === "ceo_admin");
      }
    } catch (error) {
      if (mounted.current && request === requests.current) {
        setCanManage(false);
        setLoadError(errorMessage(error));
      }
    } finally {
      if (mounted.current && request === requests.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      if (!busy.current) setSaving(false);
      void loadCompanies();
      return () => {
        mounted.current = false;
        requests.current += 1;
      };
    }, [loadCompanies]),
  );

  const closeDialog = useCallback(() => {
    if (busy.current) return;
    if (dialog?.kind === "editor") {
      const originalName = dialog.model?.name || "";
      if (companyName.trim() !== originalName.trim()) {
        setDialog({ kind: "discard", editor: dialog });
        return;
      }
    }
    if (dialog?.kind === "discard") setDialog(dialog.editor);
    else setDialog(null);
    setFormError("");
  }, [dialog, companyName]);

  const handleBack = useCallback(() => {
    if (busy.current) return;
    if (dialog) closeDialog();
    else returnToRoute("/(tabs)/master-data");
  }, [dialog, closeDialog]);
  useHardwareBack(handleBack);
  // Native stack gestures/removal must respect the same dialog and saving guards.
  usePreventRemove(isFocused && (saving || dialog !== null), closeDialog);

  const openEditor = (model: InsuranceCompany | null = null) => {
    if (!canManage || disabled || busy.current) return;
    setCompanyName(model?.name || "");
    setFormError("");
    setDialog({ kind: "editor", model });
  };

  const updateLocalCompany = (saved: InsuranceCompany) => {
    setCompanies((current) =>
      [...current.filter((item) => item.id !== saved.id), saved].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      ),
    );
  };

  const saveCompany = async () => {
    if (!canManage || disabled || busy.current || dialog?.kind !== "editor")
      return;
    const name = companyName.trim();
    if (!name || name.length > 150) {
      setFormError("Enter a company name between 1 and 150 characters.");
      return;
    }
    const editing = dialog.model;
    const duplicate = companies.find(
      (item) =>
        item.id !== editing?.id && normalize(item.name) === normalize(name),
    );
    if (duplicate) {
      setFormError(
        `${duplicate.name} already exists${duplicate.is_active ? ". Edit its existing entry." : " and is inactive. Reactivate its existing entry instead."}`,
      );
      return;
    }
    busy.current = true;
    setSaving(true);
    setFormError("");
    try {
      const result = editing
        ? await supabase
            .from("insurance_companies")
            .update({ name })
            .eq("id", editing.id)
            .eq("updated_at", editing.updated_at)
            .select(columns)
            .single()
        : await supabase
            .from("insurance_companies")
            .insert({ name, is_active: true })
            .select(columns)
            .single();
      if (result.error) throw result.error;
      if (!result.data?.id)
        throw new Error(
          "The saved company could not be confirmed. Refresh before trying again.",
        );
      if (mounted.current) {
        updateLocalCompany(result.data as InsuranceCompany);
        setDialog({
          kind: "notice",
          title: editing ? "Company updated" : "Company added",
          body: `${name} has been ${editing ? "updated" : "added"}.`,
        });
      }
    } catch (error) {
      if (mounted.current) setFormError(errorMessage(error));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!canManage || disabled || busy.current || dialog?.kind !== "status")
      return;
    const { model, activate } = dialog;
    busy.current = true;
    setSaving(true);
    setFormError("");
    try {
      const { data, error } = await supabase
        .from("insurance_companies")
        .update({ is_active: activate })
        .eq("id", model.id)
        .eq("updated_at", model.updated_at)
        .select(columns)
        .single();
      if (error) throw error;
      if (!data?.id)
        throw new Error(
          "The status change could not be confirmed. Refresh before trying again.",
        );
      if (mounted.current) {
        updateLocalCompany(data as InsuranceCompany);
        setDialog({
          kind: "notice",
          title: activate ? "Company activated" : "Company deactivated",
          body: `${model.name} ${activate ? "is now available for new Insurance Intake selections" : "will no longer be available for new Insurance Intake selections"}. Saved references are retained.`,
        });
      }
    } catch (error) {
      if (mounted.current) setFormError(errorMessage(error));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const counts = useMemo(
    () => ({
      All: companies.length,
      Active: companies.filter((item) => item.is_active).length,
      Inactive: companies.filter((item) => !item.is_active).length,
    }),
    [companies],
  );
  const visible = useMemo(
    () =>
      companies.filter((item) => {
        const query = normalize(search);
        const statusMatches =
          query === "active"
            ? item.is_active
            : query === "inactive"
              ? !item.is_active
              : false;
        const matchesSearch =
          !query || normalize(item.name).includes(query) || statusMatches;
        const matchesFilter =
          filter === "All" ||
          (filter === "Active" ? item.is_active : !item.is_active);
        return matchesSearch && matchesFilter;
      }),
    [companies, search, filter],
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.topBar}>
        <BackButton accessibilityLabel="Back to Master Data" disabled={saving} onPress={handleBack} />
        <BrandPill />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadCompanies(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MASTER DATA · INSURANCE SETUP</Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            Insurance Companies
          </Text>
          <Text style={styles.heroText}>
            Manage the companies available for Insurance jobs during Vehicle
            Intake.
          </Text>
        </View>
        {loading && (
          <View style={styles.inline}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>Loading insurance companies…</Text>
          </View>
        )}
        {!!loadError && (
          <View style={styles.card}>
            <Text style={styles.title}>Unable to refresh companies</Text>
            <Text style={styles.body}>{loadError}</Text>
            <Button
              title="Try again"
              onPress={() => void loadCompanies()}
              disabled={saving || loading || refreshing}
            />
          </View>
        )}
        {!loading && !loadError && (
          <>
            <View style={styles.metrics}>
              {(["All", "Active", "Inactive"] as Filter[]).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`${key}: ${counts[key]} companies`}
                  accessibilityState={{ selected: filter === key }}
                  onPress={() => setFilter(key)}
                  style={[
                    styles.metric,
                    filter === key && styles.metricSelected,
                  ]}
                >
                  <Text style={styles.metricCount}>{counts[key]}</Text>
                  <Text style={styles.body}>
                    {key === "All" ? "Total" : key}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.card}>
              <View style={styles.heading}>
                <View style={styles.grow}>
                  <Text style={styles.title}>Company directory</Text>
                  <Text style={styles.body}>
                    {canManage
                      ? "Add companies, edit names or change active status."
                      : "View only. An active CEO Admin can manage companies."}
                  </Text>
                </View>
                {canManage && (
                  <Button
                    title="Add company"
                    icon="add-outline"
                    onPress={() => openEditor()}
                    disabled={disabled}
                  />
                )}
              </View>
              <Text style={styles.hint}>
                Insurance Company is required for both MI and NON-MI Insurance
                jobs. Paid jobs do not use this selection.
              </Text>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  accessibilityLabel="Search insurance companies"
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search company name"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!search && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => setSearch("")}
                    style={styles.iconButton}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={22}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
              <Text style={styles.body}>
                {visible.length} of {companies.length} companies · Active
                companies are available for new Insurance Intake.
              </Text>
            </View>
            {!visible.length && (
              <View style={styles.empty}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.title}>
                  {companies.length
                    ? "No matching companies"
                    : "No insurance companies yet"}
                </Text>
                <Text style={styles.body}>
                  {companies.length
                    ? "Change your search or filter to see other companies."
                    : canManage
                      ? "Add a company to make it available for Insurance Intake."
                      : "Companies will appear here after CEO Admin adds them."}
                </Text>
                {!!companies.length && (
                  <Button
                    secondary
                    title="Clear search & filters"
                    onPress={() => {
                      setSearch("");
                      setFilter("All");
                    }}
                  />
                )}
              </View>
            )}
            {visible.map((model) => (
              <View key={model.id} style={styles.card}>
                <View style={styles.modelHeading}>
                  <View style={styles.modelIcon}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.title}>{model.name}</Text>
                    <Text style={styles.body}>Insurance company</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      model.is_active
                        ? styles.activeBadge
                        : styles.inactiveBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: model.is_active
                            ? "#217A50"
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {model.is_active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
                {canManage && (
                  <View style={styles.actions}>
                    <Button
                      secondary
                      title="Edit details"
                      icon="create-outline"
                      onPress={() => openEditor(model)}
                      disabled={disabled}
                    />
                    <Button
                      secondary
                      title={model.is_active ? "Deactivate" : "Activate"}
                      icon="power-outline"
                      disabled={disabled}
                      onPress={() => {
                        setFormError("");
                        setDialog({
                          kind: "status",
                          model,
                          activate: !model.is_active,
                        });
                      }}
                    />
                  </View>
                )}
              </View>
            ))}
            <View style={styles.note}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={[styles.body, styles.grow]}>
                Deactivate an unused company instead of deleting it. Reactivate
                the existing entry when you need it again; saved references are
                retained.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <SafeAreaView
          style={styles.overlay}
          edges={["top", "bottom", "left", "right"]}
        >
          <KeyboardAvoidingView
            style={styles.modalFrame}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.dialog}>
                {dialog?.kind === "editor" && (
                  <>
                    <View style={styles.heading}>
                      <View style={styles.grow}>
                        <Text style={styles.title}>
                          {dialog.model
                            ? "Edit insurance company"
                            : "Add insurance company"}
                        </Text>
                        <Text style={styles.body}>
                          Enter the company name used for Insurance Intake.
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close company editor"
                        disabled={saving}
                        onPress={closeDialog}
                        style={styles.iconButton}
                      >
                        <Ionicons
                          name="close-outline"
                          size={24}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    </View>
                    <Text style={styles.label}>Company name *</Text>
                    <TextInput
                      accessibilityLabel="Company name"
                      value={companyName}
                      onChangeText={(value) => {
                        setCompanyName(value);
                        setFormError("");
                      }}
                      placeholder="Enter company name"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={150}
                      editable={!saving}
                      style={styles.input}
                    />
                    <Text style={styles.hint}>
                      {companyName.length} / 150 characters
                    </Text>
                    {dialog.model && (
                      <Text style={styles.hint}>
                        Saved references are retained. Screens that read the
                        master name may show its updated label.
                      </Text>
                    )}
                    {!!formError && (
                      <Text accessibilityRole="alert" style={styles.error}>
                        {formError}
                      </Text>
                    )}
                    <View style={styles.actions}>
                      <Button
                        secondary
                        title="Cancel"
                        onPress={closeDialog}
                        disabled={saving}
                      />
                      <Button
                        title={
                          saving
                            ? "Saving…"
                            : dialog.model
                              ? "Save changes"
                              : "Add company"
                        }
                        onPress={() => void saveCompany()}
                        disabled={disabled}
                        busy={saving}
                      />
                    </View>
                  </>
                )}
                {dialog?.kind === "status" && (
                  <>
                    <Ionicons
                      name="power-outline"
                      size={30}
                      color={colors.primary}
                    />
                    <Text style={styles.title}>
                      {dialog.activate ? "Activate" : "Deactivate"} company?
                    </Text>
                    <Text style={styles.modelPreview}>{dialog.model.name}</Text>
                    <Text style={styles.body}>
                      {dialog.activate
                        ? "This company will become available for new Insurance Intake selections."
                        : "This company will be unavailable for new Insurance Intake selections. Saved company references are retained."}
                    </Text>
                    {!!formError && (
                      <Text accessibilityRole="alert" style={styles.error}>
                        {formError}
                      </Text>
                    )}
                    <View style={styles.actions}>
                      <Button
                        secondary
                        title="Cancel"
                        onPress={closeDialog}
                        disabled={saving}
                      />
                      <Button
                        title={
                          saving
                            ? "Updating…"
                            : dialog.activate
                              ? "Activate company"
                              : "Deactivate company"
                        }
                        onPress={() => void changeStatus()}
                        disabled={disabled}
                        busy={saving}
                      />
                    </View>
                  </>
                )}
                {dialog?.kind === "discard" && (
                  <>
                    <Ionicons
                      name="create-outline"
                      size={30}
                      color={colors.primary}
                    />
                    <Text style={styles.title}>Discard unsaved changes?</Text>
                    <Text style={styles.body}>
                      The changes in this form have not been saved.
                    </Text>
                    <Button
                      title="Keep editing"
                      onPress={() => setDialog(dialog.editor)}
                    />
                    <Button
                      secondary
                      title="Discard changes"
                      onPress={() => {
                        setDialog(null);
                        setFormError("");
                      }}
                    />
                  </>
                )}
                {dialog?.kind === "notice" && (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={32}
                      color={colors.success}
                    />
                    <Text style={styles.title}>{dialog.title}</Text>
                    <Text style={styles.body}>{dialog.body}</Text>
                    <Button title="OK" onPress={closeDialog} />
                  </>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={secondary ? colors.primaryDark : colors.white}
        />
      ) : (
        icon && (
          <Ionicons
            name={icon}
            size={18}
            color={secondary ? colors.primaryDark : colors.white}
          />
        )
      )}
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  back: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: spacing.sm,
  },
  backText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    padding: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  brandText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },
  content: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 0.7,
    fontWeight: "800",
    color: colors.white,
  },
  heroTitle: { ...typography.title, fontSize: 27, color: colors.white },
  heroText: { ...typography.caption, color: colors.white, lineHeight: 21 },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  grow: { flex: 1, minWidth: 0 },
  title: { ...typography.subheading, color: colors.text },
  body: { ...typography.caption, lineHeight: 20, color: colors.textSecondary },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: {
    flex: 1,
    minWidth: 88,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  metricSelected: { borderColor: colors.primary },
  metricCount: { fontSize: 25, fontWeight: "800", color: colors.text },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    backgroundColor: colors.background,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  modelHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  modelIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm },
  activeBadge: { backgroundColor: "#E8F5EE" },
  inactiveBadge: { backgroundColor: colors.background },
  badgeText: { fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  button: {
    minHeight: 48,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    textAlign: "center",
    flexShrink: 1,
  },
  secondaryButton: { backgroundColor: colors.primaryLight },
  secondaryText: { color: colors.primaryDark },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)" },
  modalFrame: { flex: 1 },
  modalScroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  dialog: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  label: { ...typography.bodyMedium, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  hint: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  option: {
    flex: 1,
    minHeight: 48,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  optionText: { ...typography.bodyMedium, color: colors.primaryDark },
  error: { ...typography.caption, color: colors.error, lineHeight: 20 },
  modelPreview: {
    ...typography.bodyMedium,
    color: colors.text,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
});
