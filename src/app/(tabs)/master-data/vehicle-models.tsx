import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../theme";

import { supabase } from "../../../../lib/supabase";

type VehicleModel = {
  id: string;
  name: string;
  arena_nexa: string;
  is_active: boolean;
};

export default function VehicleModels() {
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [modalVisible, setModalVisible] = useState(false);

  const [editingModel, setEditingModel] =
    useState<VehicleModel | null>(null);

  const [modelName, setModelName] = useState("");
  const [arenaNexa, setArenaNexa] = useState("");

  const [saving, setSaving] = useState(false);

  const [messageModalVisible, setMessageModalVisible] =
    useState(false);

  const [messageTitle, setMessageTitle] = useState("");
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    loadModels();
  }, []);

  /* --------------------------------------------------
     LOAD MODELS
  -------------------------------------------------- */

  const loadModels = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("vehicle_models")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.log("Vehicle models error:", error.message);

        showMessage(
          "Error",
          "Unable to load vehicle models."
        );

        return;
      }

      setModels(data || []);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------
     MESSAGE
  -------------------------------------------------- */

  const showMessage = (
    title: string,
    text: string
  ) => {
    setMessageTitle(title);
    setMessageText(text);
    setMessageModalVisible(true);
  };

  /* --------------------------------------------------
     OPEN ADD MODAL
  -------------------------------------------------- */

  const openAddModal = () => {
    setEditingModel(null);
    setModelName("");
    setArenaNexa("");
    setModalVisible(true);
  };

  /* --------------------------------------------------
     OPEN EDIT MODAL
  -------------------------------------------------- */

  const openEditModal = (model: VehicleModel) => {
    setEditingModel(model);
    setModelName(model.name);
    setArenaNexa(model.arena_nexa);
    setModalVisible(true);
  };

  /* --------------------------------------------------
     SAVE MODEL
  -------------------------------------------------- */

  const saveModel = async () => {
    const trimmedName = modelName.trim();

    if (!trimmedName) {
      showMessage(
        "Required",
        "Please enter the vehicle model name."
      );

      return;
    }

    if (!arenaNexa) {
      showMessage(
        "Required",
        "Please select Arena or Nexa."
      );

      return;
    }

    setSaving(true);

    try {
      if (editingModel) {
        const { error } = await supabase
          .from("vehicle_models")
          .update({
            name: trimmedName,
            arena_nexa: arenaNexa,
          })
          .eq("id", editingModel.id);

        if (error) {
          console.log(
            "Update model error:",
            error.message
          );

          if (error.code === "23505") {
            showMessage(
              "Already Exists",
              "A vehicle model with this name already exists."
            );
          } else {
            showMessage(
              "Error",
              "Unable to update the vehicle model."
            );
          }

          return;
        }

        setModalVisible(false);

        await loadModels();

        showMessage(
          "Updated",
          "Vehicle model updated successfully."
        );
      } else {
        const { error } = await supabase
          .from("vehicle_models")
          .insert({
            name: trimmedName,
            arena_nexa: arenaNexa,
          });

        if (error) {
          console.log(
            "Insert model error:",
            error.message
          );

          if (error.code === "23505") {
            showMessage(
              "Already Exists",
              "A vehicle model with this name already exists."
            );
          } else {
            showMessage(
              "Error",
              "Unable to add the vehicle model."
            );
          }

          return;
        }

        setModalVisible(false);

        await loadModels();

        showMessage(
          "Added",
          "Vehicle model added successfully."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------
     TOGGLE ACTIVE
  -------------------------------------------------- */

  const toggleActive = async (
    model: VehicleModel
  ) => {
    const newStatus = !model.is_active;

    const { error } = await supabase
      .from("vehicle_models")
      .update({
        is_active: newStatus,
      })
      .eq("id", model.id);

    if (error) {
      console.log(
        "Toggle active error:",
        error.message
      );

      showMessage(
        "Error",
        "Unable to change the model status."
      );

      return;
    }

    await loadModels();
  };

  /* --------------------------------------------------
     SEARCH
  -------------------------------------------------- */

  const filteredModels = models.filter((model) =>
    model.name
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  /* --------------------------------------------------
     LOADING
  -------------------------------------------------- */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
        edges={["top", "bottom"]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.loadingText}>
          Loading vehicle models...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back-outline"
              size={21}
              color={colors.text}
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Vehicle Models
            </Text>

            <Text style={styles.subtitle}>
              Manage vehicle models and Arena / Nexa
            </Text>
          </View>
        </View>

        {/* SEARCH */}

        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.textLight}
            style={styles.searchIcon}
          />

          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search vehicle model..."
            placeholderTextColor={colors.textLight}
          />

          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              style={styles.clearSearch}
            >
              <Ionicons
                name="close-circle"
                size={19}
                color={colors.textLight}
              />
            </Pressable>
          )}
        </View>

        {/* ADD BUTTON */}

        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={openAddModal}
        >
          <View style={styles.addIcon}>
            <Ionicons
              name="add-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <Text style={styles.addButtonText}>
            Add Vehicle Model
          </Text>
        </Pressable>

        {/* LIST HEADER */}

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              Vehicle Models
            </Text>

            <Text style={styles.listSubtitle}>
              {filteredModels.length} model
              {filteredModels.length !== 1
                ? "s"
                : ""}
            </Text>
          </View>
        </View>

        {/* LIST */}

        {filteredModels.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="car-outline"
                size={30}
                color={colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No vehicle models found
            </Text>

            <Text style={styles.emptyText}>
              {search.trim()
                ? "Try a different search."
                : "Add your first vehicle model using the button above."}
            </Text>
          </View>
        ) : (
          filteredModels.map((model) => (
            <View
              key={model.id}
              style={[
                styles.modelCard,
                !model.is_active &&
                  styles.inactiveCard,
              ]}
            >
              {/* MODEL TOP */}

              <View style={styles.modelTop}>
                <View style={styles.modelInfoRow}>
                  <View style={styles.modelIconContainer}>
                    <Ionicons
                      name="car-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.modelInfo}>
                    <Text style={styles.modelName}>
                      {model.name}
                    </Text>

                    <View style={styles.arenaRow}>
                      <Ionicons
                        name="business-outline"
                        size={14}
                        color={colors.textSecondary}
                      />

                      <Text style={styles.arenaNexa}>
                        {model.arena_nexa}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* STATUS */}

                <View
                  style={[
                    styles.statusBadge,
                    model.is_active
                      ? styles.activeBadge
                      : styles.inactiveBadge,
                  ]}
                >
                  <Ionicons
                    name={
                      model.is_active
                        ? "checkmark-circle-outline"
                        : "close-circle-outline"
                    }
                    size={14}
                    color={
                      model.is_active
                        ? colors.success
                        : colors.textLight
                    }
                  />

                  <Text
                    style={[
                      styles.statusText,
                      model.is_active
                        ? styles.activeText
                        : styles.inactiveText,
                    ]}
                  >
                    {model.is_active
                      ? "Active"
                      : "Inactive"}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              {/* ACTIONS */}

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.editButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() =>
                    openEditModal(model)
                  }
                >
                  <Ionicons
                    name="create-outline"
                    size={17}
                    color={colors.text}
                  />

                  <Text style={styles.editButtonText}>
                    Edit
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.statusButton,
                    model.is_active
                      ? styles.deactivateButton
                      : styles.activateButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() =>
                    toggleActive(model)
                  }
                >
                  <Ionicons
                    name={
                      model.is_active
                        ? "power-outline"
                        : "checkmark-outline"
                    }
                    size={17}
                    color={
                      model.is_active
                        ? colors.danger
                        : colors.success
                    }
                  />

                  <Text
                    style={[
                      styles.statusButtonText,
                      model.is_active
                        ? styles.deactivateText
                        : styles.activateText,
                    ]}
                  >
                    {model.is_active
                      ? "Deactivate"
                      : "Activate"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* --------------------------------------------------
         ADD / EDIT MODAL
      -------------------------------------------------- */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          !saving && setModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* MODAL HEADER */}

            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons
                  name="car-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  {editingModel
                    ? "Edit Vehicle Model"
                    : "Add Vehicle Model"}
                </Text>

                <Text style={styles.modalSubtitle}>
                  {editingModel
                    ? "Update vehicle model details"
                    : "Add a new vehicle model"}
                </Text>
              </View>

              <Pressable
                style={styles.modalCloseButton}
                onPress={() =>
                  !saving &&
                  setModalVisible(false)
                }
                disabled={saving}
              >
                <Ionicons
                  name="close-outline"
                  size={21}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* MODEL NAME */}

            <Text style={styles.fieldLabel}>
              Vehicle Model *
            </Text>

            <TextInput
              style={styles.input}
              value={modelName}
              onChangeText={setModelName}
              placeholder="Enter vehicle model"
              placeholderTextColor={colors.textLight}
              autoCapitalize="words"
            />

            {/* ARENA / NEXA */}

            <Text style={styles.fieldLabel}>
              Arena / Nexa *
            </Text>

            <View style={styles.optionRow}>
              <Pressable
                style={[
                  styles.optionButton,
                  arenaNexa === "Arena" &&
                    styles.optionSelected,
                ]}
                onPress={() =>
                  setArenaNexa("Arena")
                }
              >
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={
                    arenaNexa === "Arena"
                      ? colors.white
                      : colors.text
                  }
                />

                <Text
                  style={[
                    styles.optionText,
                    arenaNexa === "Arena" &&
                      styles.optionSelectedText,
                  ]}
                >
                  Arena
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.optionButton,
                  arenaNexa === "Nexa" &&
                    styles.optionSelected,
                ]}
                onPress={() =>
                  setArenaNexa("Nexa")
                }
              >
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={
                    arenaNexa === "Nexa"
                      ? colors.white
                      : colors.text
                  }
                />

                <Text
                  style={[
                    styles.optionText,
                    arenaNexa === "Nexa" &&
                      styles.optionSelectedText,
                  ]}
                >
                  Nexa
                </Text>
              </Pressable>
            </View>

            {/* MODAL ACTIONS */}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() =>
                  setModalVisible(false)
                }
                disabled={saving}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={saveModel}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />
                ) : (
                  <>
                    <Ionicons
                      name={
                        editingModel
                          ? "checkmark-outline"
                          : "add-outline"
                      }
                      size={19}
                      color={colors.white}
                    />

                    <Text style={styles.saveText}>
                      {editingModel
                        ? "Update"
                        : "Add"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* --------------------------------------------------
         MESSAGE MODAL
      -------------------------------------------------- */}

      <Modal
        visible={messageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMessageModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.messageCard}>
            <View style={styles.messageIconContainer}>
              <Ionicons
                name="information-circle-outline"
                size={28}
                color={colors.primary}
              />
            </View>

            <Text style={styles.messageTitle}>
              {messageTitle}
            </Text>

            <Text style={styles.messageText}>
              {messageText}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.messageButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() =>
                setMessageModalVisible(false)
              }
            >
              <Text style={styles.messageButtonText}>
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* --------------------------------------------------
   STYLES
-------------------------------------------------- */

const styles = StyleSheet.create({
  /* LOADING */

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },

  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.textSecondary,
  },

  /* CONTAINER */

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  /* HEADER */

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  pressed: {
    opacity: 0.7,
  },

  headerText: {
    flex: 1,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  /* SEARCH */

  searchContainer: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },

  searchIcon: {
    marginLeft: spacing.md,
  },

  searchInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },

  clearSearch: {
    paddingHorizontal: spacing.md,
  },

  /* ADD BUTTON */

  addButton: {
    minHeight: 54,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
  },

  addIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.round,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },

  addButtonText: {
    ...typography.button,
    color: colors.white,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  /* LIST HEADER */

  listHeader: {
    marginBottom: spacing.md,
  },

  listTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  listSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  /* MODEL CARD */

  modelCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  inactiveCard: {
    opacity: 0.72,
  },

  modelTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modelInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },

  modelIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  modelInfo: {
    flex: 1,
  },

  modelName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontSize: 16,
  },

  arenaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },

  arenaNexa: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 5,
  },

  /* STATUS */

  statusBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },

  activeBadge: {
    backgroundColor: colors.successLight,
  },

  inactiveBadge: {
    backgroundColor: colors.border,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },

  activeText: {
    color: colors.success,
  },

  inactiveText: {
    color: colors.textSecondary,
  },

  cardDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },

  /* ACTIONS */

  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  editButton: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  editButtonText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 5,
  },

  statusButton: {
    flex: 1,
    height: 42,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  deactivateButton: {
    backgroundColor: colors.dangerLight,
  },

  activateButton: {
    backgroundColor: colors.successLight,
  },

  statusButtonText: {
    ...typography.caption,
    fontWeight: "600",
    marginLeft: 5,
  },

  deactivateText: {
    color: colors.danger,
  },

  activateText: {
    color: colors.success,
  },

  /* EMPTY */

  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },

  emptyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    textAlign: "center",
  },

  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 19,
  },

  /* MODAL */

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },

  modalCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },

  modalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  modalHeaderText: {
    flex: 1,
  },

  modalTitle: {
    ...typography.subheading,
    fontSize: 18,
    color: colors.text,
  },

  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },

  fieldLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
  },

  /* OPTIONS */

  optionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },

  optionButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    backgroundColor: colors.surface,
  },

  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  optionText: {
    ...typography.bodyMedium,
    color: colors.text,
    marginLeft: 6,
  },

  optionSelectedText: {
    color: colors.white,
  },

  /* MODAL ACTIONS */

  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  cancelButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },

  cancelText: {
    ...typography.button,
    color: colors.text,
  },

  saveButton: {
    flex: 1,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  saveText: {
    ...typography.button,
    color: colors.white,
    marginLeft: 5,
  },

  /* MESSAGE MODAL */

  messageCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
  },

  messageIconContainer: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  messageTitle: {
    ...typography.subheading,
    fontSize: 19,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },

  messageText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.lg,
    textAlign: "center",
  },

  messageButton: {
    width: "100%",
    height: 46,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },

  messageButtonText: {
    ...typography.button,
    color: colors.white,
  },
});