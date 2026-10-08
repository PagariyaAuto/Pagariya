import { KeyboardAvoidingView, Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useIsFocused } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../lib/supabase";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import { colors, radius, spacing, typography } from "../../../theme";

type Category = "Arena" | "Nexa";
type Filter = "All" | "Active" | "Arena" | "Nexa" | "Inactive";
type VehicleModel = {
  id: string;
  name: string;
  arena_nexa: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type Editor = { kind: "editor"; model: VehicleModel | null };
type Dialog =
  | Editor
  | { kind: "discard"; editor: Editor }
  | { kind: "status"; model: VehicleModel; activate: boolean }
  | { kind: "notice"; title: string; body: string };
const columns = "id, name, arena_nexa, is_active, created_at, updated_at";
const filters: Filter[] = ["All", "Active", "Arena", "Nexa", "Inactive"];
const normalize = (value: string) => value.trim().toLowerCase();

function errorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "23505")
    return "This model already exists in the selected category. Use its existing entry, or reactivate it if it is inactive.";
  if (code === "42501")
    return "Your account cannot change vehicle models. An active CEO Admin account is required.";
  if (code === "PGRST116")
    return "This model changed or is no longer available to your account. Close this dialog, refresh the list and try again.";
  if (code === "23514")
    return "The model details did not pass database validation. Check the name and category.";
  return (
    (error as { message?: string })?.message ||
    "Unable to complete the request. Please try again."
  );
}

export default function VehicleModels() {
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const requests = useRef(0);
  const disabled = saving || loading || refreshing;
  const isFocused = useIsFocused();

  const loadModels = useCallback(async (refresh = false) => {
    if (busy.current) return;
    const request = ++requests.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setLoadError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user)
        throw new Error(
          "Your session has expired. Sign in again to view vehicle models.",
        );
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", auth.user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.is_active)
        throw new Error(
          "An active account is required to view vehicle models.",
        );

      // Fetch all pages so the list and duplicate checks are not capped by the API limit.
      const fetched = new Map<string, VehicleModel>();
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("vehicle_models")
          .select(columns)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        if (!mounted.current || request !== requests.current) return;
        for (const item of (data ?? []) as VehicleModel[])
          fetched.set(item.id, item);
        if ((data ?? []).length < pageSize) break;
      }
      if (mounted.current && request === requests.current) {
        setModels([...fetched.values()]);
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
      void loadModels();
      return () => {
        mounted.current = false;
        requests.current += 1;
      };
    }, [loadModels]),
  );

  const closeDialog = useCallback(() => {
    if (busy.current) return;
    if (dialog?.kind === "editor") {
      const originalName = dialog.model?.name || "";
      const originalCategory = dialog.model?.arena_nexa || "";
      if (
        modelName.trim() !== originalName.trim() ||
        category !== originalCategory
      ) {
        setDialog({ kind: "discard", editor: dialog });
        return;
      }
    }
    if (dialog?.kind === "discard") setDialog(dialog.editor);
    else setDialog(null);
    setFormError("");
  }, [dialog, modelName, category]);

  const handleBack = useCallback(() => {
    if (busy.current) return;
    if (dialog) closeDialog();
    else returnToRoute("/(tabs)/master-data");
  }, [dialog, closeDialog]);
  useHardwareBack(handleBack);
  // Native stack gestures/removal must respect the same dialog and saving guards.
  usePreventRemove(isFocused && (saving || dialog !== null), closeDialog);

  const openEditor = (model: VehicleModel | null = null) => {
    if (!canManage || disabled || busy.current) return;
    setModelName(model?.name || "");
    setCategory(
      model?.arena_nexa === "Arena" || model?.arena_nexa === "Nexa"
        ? model.arena_nexa
        : "",
    );
    setFormError("");
    setDialog({ kind: "editor", model });
  };

  const updateLocalModel = (saved: VehicleModel) => {
    setModels((current) =>
      [...current.filter((item) => item.id !== saved.id), saved].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      ),
    );
  };

  const saveModel = async () => {
    if (!canManage || disabled || busy.current || dialog?.kind !== "editor")
      return;
    const name = modelName.trim();
    if (!name || name.length > 100) {
      setFormError("Enter a model name between 1 and 100 characters.");
      return;
    }
    if (category !== "Arena" && category !== "Nexa") {
      setFormError("Select Arena or Nexa.");
      return;
    }
    const editing = dialog.model;
    const duplicate = models.find(
      (item) =>
        item.id !== editing?.id &&
        normalize(item.name) === normalize(name) &&
        normalize(item.arena_nexa) === normalize(category),
    );
    if (duplicate) {
      setFormError(
        `${duplicate.name} already exists under ${duplicate.arena_nexa}${duplicate.is_active ? "." : " and is inactive. Reactivate its existing entry instead."}`,
      );
      return;
    }
    busy.current = true;
    setSaving(true);
    setFormError("");
    try {
      const result = editing
        ? await supabase
            .from("vehicle_models")
            .update({ name, arena_nexa: category })
            .eq("id", editing.id)
            .eq("updated_at", editing.updated_at)
            .select(columns)
            .single()
        : await supabase
            .from("vehicle_models")
            .insert({ name, arena_nexa: category, is_active: true })
            .select(columns)
            .single();
      if (result.error) throw result.error;
      if (!result.data?.id)
        throw new Error(
          "The saved model could not be confirmed. Refresh before trying again.",
        );
      if (mounted.current) {
        updateLocalModel(result.data as VehicleModel);
        setDialog({
          kind: "notice",
          title: editing ? "Model updated" : "Model added",
          body: `${name} (${category}) has been ${editing ? "updated" : "added"}.`,
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
        .from("vehicle_models")
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
        updateLocalModel(data as VehicleModel);
        setDialog({
          kind: "notice",
          title: activate ? "Model activated" : "Model deactivated",
          body: `${model.name} (${model.arena_nexa}) ${activate ? "is now available for new Intake selections" : "will no longer be available for new Intake selections"}. Saved records are retained.`,
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
      All: models.length,
      Active: models.filter((item) => item.is_active).length,
      Inactive: models.filter((item) => !item.is_active).length,
      Arena: models.filter((item) => item.arena_nexa === "Arena").length,
      Nexa: models.filter((item) => item.arena_nexa === "Nexa").length,
    }),
    [models],
  );
  const visible = useMemo(
    () =>
      models.filter((item) => {
        const query = normalize(search);
        const statusMatches =
          query === "active"
            ? item.is_active
            : query === "inactive"
              ? !item.is_active
              : false;
        const matchesSearch =
          !query ||
          normalize(item.name).includes(query) ||
          normalize(item.arena_nexa).includes(query) ||
          statusMatches;
        const matchesFilter =
          filter === "All" ||
          (filter === "Active"
            ? item.is_active
            : filter === "Inactive"
              ? !item.is_active
              : item.arena_nexa === filter);
        return matchesSearch && matchesFilter;
      }),
    [models, search, filter],
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
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadModels(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MASTER DATA · VEHICLE SETUP</Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            Vehicle Models
          </Text>
          <Text style={styles.heroText}>
            Manage the models and Arena / Nexa categories used during Vehicle
            Intake.
          </Text>
        </View>
        {loading && (
          <View style={styles.inline}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>Loading vehicle models…</Text>
          </View>
        )}
        {!!loadError && (
          <View style={styles.card}>
            <Text style={styles.title}>Unable to refresh models</Text>
            <Text style={styles.body}>{loadError}</Text>
            <Button
              title="Try again"
              onPress={() => void loadModels()}
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
                  accessibilityLabel={`${key}: ${counts[key]} models`}
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
                  <Text style={styles.title}>Model directory</Text>
                  <Text style={styles.body}>
                    {canManage
                      ? "Add, edit or change a model’s active status."
                      : "View only. An active CEO Admin can manage models."}
                  </Text>
                </View>
                {canManage && (
                  <Button
                    title="Add model"
                    icon="add-outline"
                    onPress={() => openEditor()}
                    disabled={disabled}
                  />
                )}
              </View>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  accessibilityLabel="Search vehicle models"
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search model or category"
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
              <View style={styles.filters}>
                {filters.map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === key }}
                    onPress={() => setFilter(key)}
                    style={[styles.chip, filter === key && styles.chipSelected]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filter === key && styles.chipSelectedText,
                      ]}
                    >
                      {key} · {counts[key]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.body}>
                {visible.length} of {models.length} models · Category filters
                include active and inactive entries.
              </Text>
            </View>
            {!visible.length && (
              <View style={styles.empty}>
                <Ionicons name="car-outline" size={32} color={colors.primary} />
                <Text style={styles.title}>
                  {models.length
                    ? "No matching models"
                    : "No vehicle models yet"}
                </Text>
                <Text style={styles.body}>
                  {models.length
                    ? "Change your search or filter to see other models."
                    : canManage
                      ? "Add your first model to make it available during Intake."
                      : "Models will appear here after CEO Admin adds them."}
                </Text>
                {!!models.length && (
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
                      name="car-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.title}>{model.name}</Text>
                    <Text style={styles.body}>{model.arena_nexa}</Text>
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
                Deactivate unused models instead of deleting them. The same name
                can exist under Arena and Nexa.
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
              keyboardShouldPersistTaps="always"
            >
              <View style={styles.dialog}>
                {dialog?.kind === "editor" && (
                  <>
                    <View style={styles.heading}>
                      <View style={styles.grow}>
                        <Text style={styles.title}>
                          {dialog.model
                            ? "Edit vehicle model"
                            : "Add vehicle model"}
                        </Text>
                        <Text style={styles.body}>
                          Enter the model name and select its category.
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close model editor"
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
                    <Text style={styles.label}>Vehicle model *</Text>
                    <TextInput
                      accessibilityLabel="Vehicle model name"
                      value={modelName}
                      onChangeText={(value) => {
                        setModelName(value);
                        setFormError("");
                      }}
                      placeholder="Enter vehicle model"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={100}
                      editable={!saving}
                      style={styles.input}
                    />
                    <Text style={styles.hint}>
                      {modelName.length} / 100 characters
                    </Text>
                    <Text style={styles.label}>Arena / Nexa *</Text>
                    <View style={styles.actions}>
                      {(["Arena", "Nexa"] as Category[]).map((value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          accessibilityState={{
                            checked: category === value,
                            disabled: saving,
                          }}
                          disabled={saving}
                          onPress={() => {
                            setCategory(value);
                            setFormError("");
                          }}
                          style={[
                            styles.option,
                            category === value && styles.optionSelected,
                          ]}
                        >
                          <Ionicons
                            name={
                              category === value
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={20}
                            color={colors.primaryDark}
                          />
                          <Text style={styles.optionText}>{value}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {dialog.model && (
                      <Text style={styles.hint}>
                        This edits the master entry. Existing saved job
                        snapshots are not rewritten.
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
                              : "Add model"
                        }
                        onPress={() => void saveModel()}
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
                      {dialog.activate ? "Activate" : "Deactivate"} model?
                    </Text>
                    <Text style={styles.modelPreview}>
                      {dialog.model.name} · {dialog.model.arena_nexa}
                    </Text>
                    <Text style={styles.body}>
                      {dialog.activate
                        ? "This model will become available for new Intake selections."
                        : "This model will be hidden from new Intake selections. Saved records and model references are retained."}
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
                              ? "Activate model"
                              : "Deactivate model"
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
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  chipSelectedText: { color: colors.primaryDark },
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
