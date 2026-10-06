import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

import { supabase } from "../../../../lib/supabase";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../theme";

type VehicleModel = {
  id: string;
  name: string;
  arena_nexa: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type FilterType =
  | "All"
  | "Arena"
  | "Nexa"
  | "Inactive";

export default function VehicleModels() {
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FilterType>("All");

  const [modalVisible, setModalVisible] = useState(false);

  const [editingModel, setEditingModel] =
    useState<VehicleModel | null>(null);

  const [modelName, setModelName] = useState("");
  const [arenaNexa, setArenaNexa] = useState("");

  const [saving, setSaving] = useState(false);

  const [confirmModalVisible, setConfirmModalVisible] =
    useState(false);

  const [modelToDeactivate, setModelToDeactivate] =
    useState<VehicleModel | null>(null);

  const [changingStatus, setChangingStatus] =
    useState(false);

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
        .select(
          "id, name, arena_nexa, is_active, created_at, updated_at"
        )
        .order("name", { ascending: true });

      if (error) {
        console.log(
          "Vehicle models error:",
          error.message
        );

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
     MESSAGE POPUP
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

  const openEditModal = (
    model: VehicleModel
  ) => {
    setEditingModel(model);
    setModelName(model.name);
    setArenaNexa(model.arena_nexa);
    setModalVisible(true);
  };

  /* --------------------------------------------------
     CLOSE ADD / EDIT MODAL
  -------------------------------------------------- */

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalVisible(false);
    setEditingModel(null);
    setModelName("");
    setArenaNexa("");
  };

  /* --------------------------------------------------
     SAVE MODEL
     
     UNIQUE COMBINATION:
     name + arena_nexa
  -------------------------------------------------- */

  const saveModel = async () => {
    if (saving) {
      return;
    }

    const trimmedName = modelName.trim();

    if (!trimmedName) {
      showMessage(
        "Required",
        "Please enter the vehicle model name."
      );

      return;
    }

    if (trimmedName.length > 100) {
      showMessage(
        "Invalid Name",
        "Vehicle model name cannot exceed 100 characters."
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

    if (
      arenaNexa !== "Arena" &&
      arenaNexa !== "Nexa"
    ) {
      showMessage(
        "Invalid Type",
        "Please select either Arena or Nexa."
      );

      return;
    }

    /*
     * IMPORTANT:
     * Same model name is allowed in Arena and Nexa.
     *
     * Example:
     * Baleno + Arena = allowed
     * Baleno + Nexa  = allowed
     *
     * But:
     * Baleno + Nexa + again = duplicate
     */

    const duplicateModel = models.find(
      (model) =>
        model.name.trim().toLowerCase() ===
          trimmedName.toLowerCase() &&
        model.arena_nexa.toLowerCase() ===
          arenaNexa.toLowerCase() &&
        model.id !== editingModel?.id
    );

    if (duplicateModel) {
      showMessage(
        "Already Exists",
        `${trimmedName} is already available under ${arenaNexa}. Please use a different model name or select the other Arena/Nexa type.`
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

          /*
           * PostgreSQL unique constraint:
           * name + arena_nexa
           */
          if (error.code === "23505") {
            showMessage(
              "Already Exists",
              `${trimmedName} is already available under ${arenaNexa}.`
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
        setEditingModel(null);
        setModelName("");
        setArenaNexa("");

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
            is_active: true,
          });

        if (error) {
          console.log(
            "Insert model error:",
            error.message
          );

          /*
           * PostgreSQL unique constraint:
           * name + arena_nexa
           */
          if (error.code === "23505") {
            showMessage(
              "Already Exists",
              `${trimmedName} is already available under ${arenaNexa}.`
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
        setEditingModel(null);
        setModelName("");
        setArenaNexa("");

        await loadModels();

        showMessage(
          "Added",
          `${trimmedName} has been added under ${arenaNexa}.`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------
     OPEN DEACTIVATE CONFIRMATION
  -------------------------------------------------- */

  const openDeactivateConfirmation = (
    model: VehicleModel
  ) => {
    setModelToDeactivate(model);
    setConfirmModalVisible(true);
  };

  /* --------------------------------------------------
     CLOSE CONFIRMATION
  -------------------------------------------------- */

  const closeConfirmModal = () => {
    if (changingStatus) {
      return;
    }

    setConfirmModalVisible(false);
    setModelToDeactivate(null);
  };

  /* --------------------------------------------------
     CONFIRM DEACTIVATE
  -------------------------------------------------- */

  const confirmDeactivate = async () => {
    if (!modelToDeactivate || changingStatus) {
      return;
    }

    setChangingStatus(true);

    try {
      const { error } = await supabase
        .from("vehicle_models")
        .update({
          is_active: false,
        })
        .eq("id", modelToDeactivate.id);

      if (error) {
        console.log(
          "Deactivate model error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to deactivate the vehicle model."
        );

        return;
      }

      const modelName = modelToDeactivate.name;
      const modelType =
        modelToDeactivate.arena_nexa;

      setConfirmModalVisible(false);
      setModelToDeactivate(null);

      await loadModels();

      showMessage(
        "Model Deactivated",
        `${modelName} (${modelType}) is now inactive and will not be available for new vehicle entries. Historical records are not affected.`
      );
    } finally {
      setChangingStatus(false);
    }
  };

  /* --------------------------------------------------
     ACTIVATE MODEL
  -------------------------------------------------- */

  const activateModel = async (
    model: VehicleModel
  ) => {
    if (changingStatus) {
      return;
    }

    setChangingStatus(true);

    try {
      const { error } = await supabase
        .from("vehicle_models")
        .update({
          is_active: true,
        })
        .eq("id", model.id);

      if (error) {
        console.log(
          "Activate model error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to activate the vehicle model."
        );

        return;
      }

      await loadModels();

      showMessage(
        "Model Activated",
        `${model.name} (${model.arena_nexa}) is now active and can be selected for new vehicle entries.`
      );
    } finally {
      setChangingStatus(false);
    }
  };

  /* --------------------------------------------------
     FILTERED MODELS
  -------------------------------------------------- */

  const filteredModels = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return models.filter((model) => {
      const matchesSearch =
        !normalizedSearch ||
        model.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        model.arena_nexa
          .toLowerCase()
          .includes(normalizedSearch) ||
        (model.is_active
          ? "active"
          : "inactive"
        ).includes(normalizedSearch);

      let matchesFilter = true;

      if (activeFilter === "Arena") {
        matchesFilter =
          model.arena_nexa === "Arena";
      }

      if (activeFilter === "Nexa") {
        matchesFilter =
          model.arena_nexa === "Nexa";
      }

      if (activeFilter === "Inactive") {
        matchesFilter = !model.is_active;
      }

      return matchesSearch && matchesFilter;
    });
  }, [models, search, activeFilter]);

  /* --------------------------------------------------
     SUMMARY COUNTS
  -------------------------------------------------- */

  const totalCount = models.length;

  const activeCount = models.filter(
    (model) => model.is_active
  ).length;

  const inactiveCount = models.filter(
    (model) => !model.is_active
  ).length;

  const arenaCount = models.filter(
    (model) => model.arena_nexa === "Arena"
  ).length;

  const nexaCount = models.filter(
    (model) => model.arena_nexa === "Nexa"
  ).length;

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

        {/* SUMMARY */}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View
              style={[
                styles.summaryIcon,
                styles.summaryTotalIcon,
              ]}
            >
              <Ionicons
                name="car-outline"
                size={18}
                color={colors.primary}
              />
            </View>

            <Text style={styles.summaryValue}>
              {totalCount}
            </Text>

            <Text style={styles.summaryLabel}>
              Total
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View
              style={[
                styles.summaryIcon,
                styles.summaryActiveIcon,
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={colors.success}
              />
            </View>

            <Text style={styles.summaryValue}>
              {activeCount}
            </Text>

            <Text style={styles.summaryLabel}>
              Active
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View
              style={[
                styles.summaryIcon,
                styles.summaryInactiveIcon,
              ]}
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={colors.textSecondary}
              />
            </View>

            <Text style={styles.summaryValue}>
              {inactiveCount}
            </Text>

            <Text style={styles.summaryLabel}>
              Inactive
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
            placeholder="Search model, Arena, Nexa..."
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
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

        {/* FILTER CHIPS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            style={[
              styles.filterChip,
              activeFilter === "All" &&
                styles.filterChipSelected,
            ]}
            onPress={() => setActiveFilter("All")}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === "All" &&
                  styles.filterTextSelected,
              ]}
            >
              All {totalCount}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterChip,
              activeFilter === "Arena" &&
                styles.filterChipSelected,
            ]}
            onPress={() =>
              setActiveFilter("Arena")
            }
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === "Arena" &&
                  styles.filterTextSelected,
              ]}
            >
              Arena {arenaCount}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterChip,
              activeFilter === "Nexa" &&
                styles.filterChipSelected,
            ]}
            onPress={() =>
              setActiveFilter("Nexa")
            }
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === "Nexa" &&
                  styles.filterTextSelected,
              ]}
            >
              Nexa {nexaCount}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterChip,
              activeFilter === "Inactive" &&
                styles.filterChipSelectedInactive,
            ]}
            onPress={() =>
              setActiveFilter("Inactive")
            }
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === "Inactive" &&
                  styles.filterTextSelectedInactive,
              ]}
            >
              Inactive {inactiveCount}
            </Text>
          </Pressable>
        </ScrollView>

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
              Showing {filteredModels.length} of{" "}
              {models.length} model
              {models.length !== 1 ? "s" : ""}
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
              {search.trim() ||
              activeFilter !== "All"
                ? "Try changing your search or filter."
                : "Add your first vehicle model using the button above."}
            </Text>

            {(search.trim() ||
              activeFilter !== "All") && (
              <Pressable
                style={({ pressed }) => [
                  styles.clearFilterButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={() => {
                  setSearch("");
                  setActiveFilter("All");
                }}
              >
                <Text
                  style={styles.clearFilterText}
                >
                  Clear Filters
                </Text>
              </Pressable>
            )}
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
                    pressed &&
                      styles.buttonPressed,
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

                {model.is_active ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.statusButton,
                      styles.deactivateButton,
                      pressed &&
                        styles.buttonPressed,
                    ]}
                    onPress={() =>
                      openDeactivateConfirmation(
                        model
                      )
                    }
                    disabled={changingStatus}
                  >
                    <Ionicons
                      name="power-outline"
                      size={17}
                      color={colors.danger}
                    />

                    <Text
                      style={[
                        styles.statusButtonText,
                        styles.deactivateText,
                      ]}
                    >
                      Deactivate
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.statusButton,
                      styles.activateButton,
                      pressed &&
                        styles.buttonPressed,
                    ]}
                    onPress={() =>
                      activateModel(model)
                    }
                    disabled={changingStatus}
                  >
                    <Ionicons
                      name="checkmark-outline"
                      size={17}
                      color={colors.success}
                    />

                    <Text
                      style={[
                        styles.statusButtonText,
                        styles.activateText,
                      ]}
                    >
                      Activate
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ADD / EDIT MODAL */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
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
                onPress={closeModal}
                disabled={saving}
              >
                <Ionicons
                  name="close-outline"
                  size={21}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

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
              autoCorrect={false}
              maxLength={100}
              editable={!saving}
            />

            <Text style={styles.characterCount}>
              {modelName.length}/100
            </Text>

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
                  !saving && setArenaNexa("Arena")
                }
                disabled={saving}
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
                  !saving && setArenaNexa("Nexa")
                }
                disabled={saving}
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

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={closeModal}
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
                  saving &&
                    styles.saveButtonDisabled,
                ]}
                onPress={saveModel}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={colors.white}
                    />

                    <Text style={styles.saveText}>
                      Saving...
                    </Text>
                  </>
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
        </SafeAreaView>
      </Modal>

      {/* DEACTIVATE CONFIRMATION */}

      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeConfirmModal}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconContainer}>
              <Ionicons
                name="power-outline"
                size={28}
                color={colors.danger}
              />
            </View>

            <Text style={styles.confirmTitle}>
              Deactivate Vehicle Model?
            </Text>

            {modelToDeactivate && (
              <View style={styles.modelPreview}>
                <Ionicons
                  name="car-outline"
                  size={20}
                  color={colors.primary}
                />

                <View style={styles.modelPreviewText}>
                  <Text style={styles.modelPreviewName}>
                    {modelToDeactivate.name}
                  </Text>

                  <Text
                    style={
                      styles.modelPreviewCategory
                    }
                  >
                    {modelToDeactivate.arena_nexa}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.confirmText}>
              This model will no longer be available
              when creating new vehicle entries.
            </Text>

            <Text style={styles.confirmNote}>
              Historical records will not be affected.
            </Text>

            <View style={styles.confirmActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmCancelButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={closeConfirmModal}
                disabled={changingStatus}
              >
                <Text style={styles.confirmCancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmDeactivateButton,
                  pressed &&
                    styles.buttonPressed,
                  changingStatus &&
                    styles.saveButtonDisabled,
                ]}
                onPress={confirmDeactivate}
                disabled={changingStatus}
              >
                {changingStatus ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="power-outline"
                      size={18}
                      color={colors.white}
                    />

                    <Text
                      style={
                        styles.confirmDeactivateText
                      }
                    >
                      Deactivate
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
        </SafeAreaView>
      </Modal>

      {/* MESSAGE MODAL */}

      <Modal
        visible={messageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMessageModalVisible(false)
        }
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
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

  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },

  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.round,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },

  summaryTotalIcon: {
    backgroundColor: colors.primaryLight,
  },

  summaryActiveIcon: {
    backgroundColor: colors.successLight,
  },

  summaryInactiveIcon: {
    backgroundColor: colors.border,
  },

  summaryValue: {
    ...typography.subheading,
    color: colors.text,
    fontSize: 19,
  },

  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },

  searchContainer: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
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

  filterRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    marginBottom: spacing.md,
  },

  filterChip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },

  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterChipSelectedInactive: {
    backgroundColor: colors.textSecondary,
    borderColor: colors.textSecondary,
  },

  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  filterTextSelected: {
    color: colors.white,
  },

  filterTextSelectedInactive: {
    color: colors.white,
  },

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

  clearFilterButton: {
    height: 40,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
  },

  clearFilterText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.primary,
  },

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
    backgroundColor: colors.background,
  },

  characterCount: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: "right",
    marginBottom: spacing.lg,
  },

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

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveText: {
    ...typography.button,
    color: colors.white,
    marginLeft: 5,
  },

  confirmCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
  },

  confirmIconContainer: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  confirmTitle: {
    ...typography.subheading,
    fontSize: 19,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.lg,
  },

  modelPreview: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  modelPreviewText: {
    marginLeft: spacing.sm,
    flex: 1,
  },

  modelPreviewName: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  modelPreviewCategory: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  confirmText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },

  confirmNote: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  confirmActions: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.sm,
  },

  confirmCancelButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },

  confirmCancelText: {
    ...typography.button,
    color: colors.text,
  },

  confirmDeactivateButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  confirmDeactivateText: {
    ...typography.button,
    color: colors.white,
    marginLeft: 5,
  },

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