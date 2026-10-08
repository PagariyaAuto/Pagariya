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

type VehicleType = "PRIVATE" | "COMMERCIAL" | "BOTH";
type Requirement = "REQUIRED" | "OPTIONAL";
const vehicleTypes: VehicleType[] = ["PRIVATE", "COMMERCIAL", "BOTH"];
const INTAKE_STAGE = "VEHICLE_INTAKE";
const requirements: Requirement[] = ["REQUIRED", "OPTIONAL"];
const label = (value: string) =>
  value === "BOTH"
    ? "Both vehicle types"
    : value === "ALL"
      ? "All"
      : value
          .toLowerCase()
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
type Filter = "All" | "Active" | "Inactive";
type DocumentMaster = {
  id: string;
  name: string;
  vehicle_type: VehicleType;
  workflow_stage: string;
  requirement_type: Requirement;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type Editor = { kind: "editor"; model: DocumentMaster | null };
type Dialog =
  | Editor
  | { kind: "discard"; editor: Editor }
  | { kind: "status"; model: DocumentMaster; activate: boolean }
  | { kind: "filters" }
  | { kind: "notice"; title: string; body: string };
const normalize = (value: string) => value.trim().toLowerCase();

function errorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "23505")
    return "This document already exists for the selected vehicle type and stage. Use its existing entry, or reactivate it if it is inactive.";
  if (code === "42501")
    return "Your account cannot change document requirements. An active CEO Admin account is required.";
  if (code === "PGRST116")
    return "This document changed or is no longer available to your account. Close this dialog, refresh the list and try again.";
  if (code === "23514")
    return "The document details did not pass database validation. Check the document name.";
  return (
    (error as { message?: string })?.message ||
    "Unable to complete the request. Please try again."
  );
}

function validDocuments(value: unknown): value is DocumentMaster[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.is_active === "boolean" &&
        typeof item.updated_at === "string" &&
        vehicleTypes.includes(item.vehicle_type) &&
        typeof item.workflow_stage === "string" &&
        requirements.includes(item.requirement_type),
    )
  );
}
async function readDocument(id: string) {
  const { data, error } = await supabase
    .rpc("get_admin_document_master")
    .eq("id", id);
  if (error) throw error;
  if (!validDocuments(data) || data.length !== 1)
    throw new Error(
      "The document could not be read back. Refresh before continuing.",
    );
  return data[0];
}
async function assertCurrent(document: DocumentMaster) {
  const current = await readDocument(document.id);
  if (
    [
      "name",
      "vehicle_type",
      "workflow_stage",
      "requirement_type",
      "is_active",
      "updated_at",
    ].some(
      (key) =>
        current[key as keyof DocumentMaster] !==
        document[key as keyof DocumentMaster],
    )
  )
    throw new Error(
      "This requirement changed since you opened it. Close the dialog, refresh and review it again.",
    );
}

export default function DocumentMasterScreen() {
  const [documents, setDocuments] = useState<DocumentMaster[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("PRIVATE");
  const [requirement, setRequirement] = useState<Requirement>("REQUIRED");
  const [vehicleFilter, setVehicleFilter] = useState<"ALL" | VehicleType>(
    "ALL",
  );
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const requests = useRef(0);
  const disabled = saving || loading || refreshing;
  const isFocused = useIsFocused();

  const loadDocuments = useCallback(async (refresh = false) => {
    if (busy.current) return;
    const request = ++requests.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setLoadError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user)
        throw new Error(
          "Your session has expired. Sign in again to view document requirements.",
        );
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", auth.user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.is_active || profile.role !== "ceo_admin")
        throw new Error(
          "An active CEO Admin account is required to manage document requirements.",
        );

      // Fetch all pages so the list and duplicate checks are not capped by the API limit.
      const fetched = new Map<string, DocumentMaster>();
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .rpc("get_admin_document_master")
          .eq("workflow_stage", INTAKE_STAGE)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        if (!mounted.current || request !== requests.current) return;
        if (!validDocuments(data))
          throw new Error(
            "The document directory returned an invalid response.",
          );
        for (const item of data) fetched.set(item.id, item);
        if ((data ?? []).length < pageSize) break;
      }
      if (mounted.current && request === requests.current) {
        setDocuments([...fetched.values()]);
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
      void loadDocuments();
      return () => {
        mounted.current = false;
        requests.current += 1;
      };
    }, [loadDocuments]),
  );

  const closeDialog = useCallback(() => {
    if (busy.current) return;
    if (dialog?.kind === "editor") {
      const originalName = dialog.model?.name || "";
      if (
        documentName.trim() !== originalName.trim() ||
        vehicleType !== (dialog.model?.vehicle_type || "PRIVATE") ||
        requirement !== (dialog.model?.requirement_type || "REQUIRED")
      ) {
        setDialog({ kind: "discard", editor: dialog });
        return;
      }
    }
    if (dialog?.kind === "discard") setDialog(dialog.editor);
    else setDialog(null);
    setFormError("");
  }, [dialog, documentName, vehicleType, requirement]);

  const handleBack = useCallback(() => {
    if (busy.current) return;
    if (dialog) closeDialog();
    else returnToRoute("/(tabs)/master-data");
  }, [dialog, closeDialog]);
  useHardwareBack(handleBack);
  // Native stack gestures/removal must respect the same dialog and saving guards.
  usePreventRemove(isFocused && (saving || dialog !== null), closeDialog);

  const openEditor = (model: DocumentMaster | null = null) => {
    if (
      !canManage ||
      disabled ||
      busy.current ||
      (model && model.workflow_stage !== INTAKE_STAGE)
    )
      return;
    setDocumentName(model?.name || "");
    setVehicleType(model?.vehicle_type || "PRIVATE");
    setRequirement(model?.requirement_type || "REQUIRED");
    setFormError("");
    setDialog({ kind: "editor", model });
  };

  const updateLocalDocument = (saved: DocumentMaster) => {
    setDocuments((current) =>
      [...current.filter((item) => item.id !== saved.id), saved].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      ),
    );
  };

  const saveDocument = async () => {
    if (!canManage || disabled || busy.current || dialog?.kind !== "editor")
      return;
    const name = documentName.trim();
    if (!name || name.length > 150) {
      setFormError("Enter a document name between 1 and 150 characters.");
      return;
    }
    if (
      !vehicleTypes.includes(vehicleType) ||
      !requirements.includes(requirement)
    ) {
      setFormError("Select a vehicle type and requirement.");
      return;
    }
    const editing = dialog.model;
    if (editing && editing.workflow_stage !== INTAKE_STAGE) {
      setFormError("Only Vehicle Intake requirements can be edited here.");
      return;
    }
    const duplicate = documents.find(
      (item) =>
        item.id !== editing?.id &&
        normalize(item.name) === normalize(name) &&
        item.vehicle_type === vehicleType &&
        item.workflow_stage === INTAKE_STAGE,
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
    let applied = false;
    try {
      if (editing) await assertCurrent(editing);
      const { data: savedId, error } = await supabase.rpc(
        "save_document_master",
        {
          p_document_id: editing?.id || null,
          p_name: name,
          p_vehicle_type: vehicleType,
          p_workflow_stage: INTAKE_STAGE,
          p_requirement_type: requirement,
        },
      );
      if (error) throw error;
      applied = true;
      if (
        typeof savedId !== "string" ||
        !savedId ||
        (editing && savedId !== editing.id)
      )
        throw new Error("The saved document ID could not be confirmed.");
      const saved = await readDocument(savedId);
      if (
        saved.name !== name ||
        saved.vehicle_type !== vehicleType ||
        saved.workflow_stage !== INTAKE_STAGE ||
        saved.requirement_type !== requirement ||
        saved.is_active !== (editing?.is_active ?? true)
      )
        throw new Error("The saved requirement could not be confirmed.");
      if (mounted.current) {
        updateLocalDocument(saved);
        setDialog({
          kind: "notice",
          title: editing ? "Requirement updated" : "Requirement added",
          body: `${name} has been ${editing ? "updated" : "added"}. Saved visit checklist snapshots are retained.`,
        });
      }
    } catch (error) {
      if (mounted.current) {
        if (applied)
          setDialog({
            kind: "notice",
            title: "Change sent — refresh required",
            body:
              "The change was accepted, but its current result could not be verified. Refresh before trying again. " +
              errorMessage(error),
          });
        else setFormError(errorMessage(error));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!canManage || disabled || busy.current || dialog?.kind !== "status")
      return;
    const { model, activate } = dialog;
    if (model.workflow_stage !== INTAKE_STAGE) {
      setFormError("Only Vehicle Intake requirements can be managed here.");
      return;
    }
    busy.current = true;
    setSaving(true);
    setFormError("");
    let applied = false;
    try {
      await assertCurrent(model);
      const { error } = await supabase.rpc("change_document_master_status", {
        p_document_id: model.id,
        p_is_active: activate,
      });
      if (error) throw error;
      applied = true;
      const saved = await readDocument(model.id);
      if (saved.is_active !== activate)
        throw new Error("The status change could not be confirmed.");
      if (mounted.current) {
        updateLocalDocument(saved);
        setDialog({
          kind: "notice",
          title: activate ? "Requirement activated" : "Requirement deactivated",
          body: `${model.name} is now ${activate ? "active" : "inactive"}. Active Vehicle Intake requirements are used when creating new Intake checklists. Saved visit snapshots are retained.`,
        });
      }
    } catch (error) {
      if (mounted.current) {
        if (applied)
          setDialog({
            kind: "notice",
            title: "Change sent — refresh required",
            body:
              "The change was accepted, but its current result could not be verified. Refresh before trying again. " +
              errorMessage(error),
          });
        else setFormError(errorMessage(error));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const counts = useMemo(
    () => ({
      All: documents.length,
      Active: documents.filter((item) => item.is_active).length,
      Inactive: documents.filter((item) => !item.is_active).length,
    }),
    [documents],
  );
  const visible = useMemo(
    () =>
      documents.filter((item) => {
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
          statusMatches ||
          normalize(label(item.vehicle_type)).includes(query) ||
          normalize(label(item.requirement_type)).includes(query);
        const matchesFilter =
          filter === "All" ||
          (filter === "Active" ? item.is_active : !item.is_active);
        return (
          matchesSearch &&
          matchesFilter &&
          (vehicleFilter === "ALL" || item.vehicle_type === vehicleFilter)
        );
      }),
    [documents, search, filter, vehicleFilter],
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
            onRefresh={() => void loadDocuments(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>
            MASTER DATA · DOCUMENT REQUIREMENTS
          </Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            Document Requirements
          </Text>
          <Text style={styles.heroText}>
            Manage documents required during Vehicle Intake.
          </Text>
        </View>
        {loading && (
          <View style={styles.inline}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>Loading document requirements…</Text>
          </View>
        )}
        {!!loadError && (
          <View style={styles.card}>
            <Text style={styles.title}>Unable to refresh documents</Text>
            <Text style={styles.body}>{loadError}</Text>
            <Button
              title="Try again"
              onPress={() => void loadDocuments()}
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
                  accessibilityLabel={`${key}: ${counts[key]} documents`}
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
                  <Text style={styles.title}>Document directory</Text>
                  <Text style={styles.body}>
                    {canManage
                      ? "Add documents, edit names or change active status."
                      : "View only. An active CEO Admin can manage documents."}
                  </Text>
                </View>
                {canManage && (
                  <Button
                    title="Add requirement"
                    icon="add-outline"
                    onPress={() => openEditor()}
                    disabled={disabled}
                  />
                )}
              </View>
              <Text style={styles.hint}>
                These settings control the Vehicle Intake document checklist.
                Both applies to Private and Commercial vehicles. Survey and
                Approval assessment documents are managed in their own forms.
              </Text>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  accessibilityLabel="Search document requirements"
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search document name or vehicle type"
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
              <Button
                secondary
                title={`Vehicle: ${label(vehicleFilter)}`}
                icon="filter-outline"
                disabled={disabled}
                onPress={() => setDialog({ kind: "filters" })}
              />
              <Text style={styles.body}>
                {visible.length} of {documents.length} documents · Vehicle
                filters show the exact configured scope; Both means Private and
                Commercial.
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
                  {documents.length
                    ? "No matching documents"
                    : "No document requirements yet"}
                </Text>
                <Text style={styles.body}>
                  {documents.length
                    ? "Change your search or filter to see other documents."
                    : canManage
                      ? "Add a Vehicle Intake document for its vehicle type."
                      : "Documents will appear here after CEO Admin adds them."}
                </Text>
                {!!documents.length && (
                  <Button
                    secondary
                    title="Clear search & filters"
                    onPress={() => {
                      setSearch("");
                      setFilter("All");
                      setVehicleFilter("ALL");
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
                    <Text style={styles.body}>{label(model.vehicle_type)}</Text>
                    <Text style={styles.hint}>
                      {label(model.requirement_type)}
                    </Text>
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
                Saved visit checklists retain their requirement snapshots.
                Master changes affect new Intake checklists, not completed visit
                snapshots. Document requirements do not make Final Inspection
                optional.
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
                {dialog?.kind === "filters" && (
                  <>
                    <Text style={styles.title}>Filter requirements</Text>
                    <Text style={styles.label}>Vehicle scope</Text>
                    <Choice
                      options={["ALL", ...vehicleTypes]}
                      value={vehicleFilter}
                      onChange={(value) =>
                        setVehicleFilter(value as "ALL" | VehicleType)
                      }
                    />
                    <Button title="Done" onPress={closeDialog} />
                    <Button
                      secondary
                      title="Reset vehicle filter"
                      onPress={() => {
                        setVehicleFilter("ALL");
                      }}
                    />
                  </>
                )}
                {dialog?.kind === "editor" && (
                  <>
                    <View style={styles.heading}>
                      <View style={styles.grow}>
                        <Text style={styles.title}>
                          {dialog.model
                            ? "Edit document requirement"
                            : "Add document requirement"}
                        </Text>
                        <Text style={styles.body}>
                          Choose the document name, applicable vehicles and
                          requirement.
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close document editor"
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
                    <Text style={styles.label}>Document name *</Text>
                    <TextInput
                      accessibilityLabel="Document name"
                      value={documentName}
                      onChangeText={(value) => {
                        setDocumentName(value);
                        setFormError("");
                      }}
                      placeholder="Enter document name"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={150}
                      editable={!saving}
                      style={styles.input}
                    />
                    <Text style={styles.hint}>
                      {documentName.length} / 150 characters
                    </Text>
                    <Text style={styles.label}>Vehicle scope *</Text>
                    <Choice
                      options={vehicleTypes}
                      value={vehicleType}
                      disabled={saving}
                      onChange={(value) => setVehicleType(value as VehicleType)}
                    />
                    <Text style={styles.hint}>
                      Both applies to Private and Commercial vehicles.
                    </Text>
                    {documents.some(
                      (item) =>
                        item.id !== dialog.model?.id &&
                        item.is_active &&
                        normalize(item.name) === normalize(documentName) &&
                        item.workflow_stage === INTAKE_STAGE &&
                        item.vehicle_type !== vehicleType &&
                        (item.vehicle_type === "BOTH" ||
                          vehicleType === "BOTH"),
                    ) && (
                      <Text style={styles.hint}>
                        An active requirement with this name overlaps this
                        vehicle scope. Both plus a separate Private or
                        Commercial entry can produce two checklist rows for the
                        same document.
                      </Text>
                    )}
                    <Text style={styles.label}>Requirement *</Text>
                    <Choice
                      options={requirements}
                      value={requirement}
                      disabled={saving}
                      onChange={(value) => setRequirement(value as Requirement)}
                    />
                    {dialog.model && (
                      <Text style={styles.hint}>
                        Editing preserves the master ID and active status.
                        Existing visit checklist snapshots are not rewritten.
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
                              : "Add requirement"
                        }
                        onPress={() => void saveDocument()}
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
                      {dialog.activate ? "Activate" : "Deactivate"} requirement?
                    </Text>
                    <Text style={styles.modelPreview}>{dialog.model.name}</Text>
                    <Text style={styles.body}>
                      {dialog.activate
                        ? "This requirement will be active. At Vehicle Intake, it will be included in new matching visit checklists."
                        : "This requirement will be inactive. It will be excluded from new Intake checklists. Saved visit checklist snapshots are retained."}
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
                              ? "Activate requirement"
                              : "Deactivate requirement"
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
                      name="information-circle-outline"
                      size={32}
                      color={colors.primary}
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

function Choice({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.actions}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ checked: option === value, disabled }}
          disabled={disabled}
          onPress={() => onChange(option)}
          style={[
            styles.option,
            option === value && styles.optionSelected,
            disabled && styles.disabled,
          ]}
        >
          <Text style={styles.optionText}>{label(option)}</Text>
        </Pressable>
      ))}
    </View>
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
