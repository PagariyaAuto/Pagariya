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

type MIType = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type FilterType = "All" | "Active" | "Inactive";

export default function MITypes() {
  const [miTypes, setMITypes] = useState<MIType[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FilterType>("All");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingMIType, setEditingMIType] =
    useState<MIType | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [saving, setSaving] = useState(false);

  const [
    confirmModalVisible,
    setConfirmModalVisible,
  ] = useState(false);

  const [miTypeToDeactivate, setMITypeToDeactivate] =
    useState<MIType | null>(null);

  const [changingStatus, setChangingStatus] =
    useState(false);

  const [
    messageModalVisible,
    setMessageModalVisible,
  ] = useState(false);

  const [messageTitle, setMessageTitle] =
    useState("");

  const [messageText, setMessageText] =
    useState("");

  useEffect(() => {
    loadMITypes();
  }, []);

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
     LOAD MI TYPES
  -------------------------------------------------- */

  const loadMITypes = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("mi_types")
        .select(
          "id, code, name, is_active, created_at, updated_at"
        )
        .order("name", {
          ascending: true,
        });

      if (error) {
        console.log(
          "MI types load error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to load MI / NON-MI types."
        );

        return;
      }

      setMITypes(data || []);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------
     OPEN ADD MODAL
  -------------------------------------------------- */

  const openAddModal = () => {
    setEditingMIType(null);
    setCode("");
    setName("");
    setModalVisible(true);
  };

  /* --------------------------------------------------
     OPEN EDIT MODAL
  -------------------------------------------------- */

  const openEditModal = (miType: MIType) => {
    setEditingMIType(miType);
    setCode(miType.code);
    setName(miType.name);
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
    setEditingMIType(null);
    setCode("");
    setName("");
  };

  /* --------------------------------------------------
     SAVE MI TYPE
  -------------------------------------------------- */

  const saveMIType = async () => {
    if (saving) {
      return;
    }

    const trimmedCode = code
      .trim()
      .toUpperCase();

    const trimmedName = name.trim();

    if (!trimmedCode) {
      showMessage(
        "Required",
        "Please enter the MI / NON-MI type code."
      );

      return;
    }

    if (!trimmedName) {
      showMessage(
        "Required",
        "Please enter the MI / NON-MI type name."
      );

      return;
    }

    if (trimmedCode.length > 20) {
      showMessage(
        "Invalid Code",
        "Code cannot exceed 20 characters."
      );

      return;
    }

    if (trimmedName.length > 100) {
      showMessage(
        "Invalid Name",
        "Name cannot exceed 100 characters."
      );

      return;
    }

    const duplicateCode = miTypes.find(
      (miType) =>
        miType.code.trim().toUpperCase() ===
          trimmedCode &&
        miType.id !== editingMIType?.id
    );

    if (duplicateCode) {
      showMessage(
        "Code Already Exists",
        `The code "${trimmedCode}" is already in use. Please use a different code.`
      );

      return;
    }

    setSaving(true);

    try {
      if (editingMIType) {
        const { error } = await supabase
          .from("mi_types")
          .update({
            code: trimmedCode,
            name: trimmedName,
          })
          .eq("id", editingMIType.id);

        if (error) {
          console.log(
            "MI type update error:",
            error.message
          );

          if (error.code === "23505") {
            showMessage(
              "Code Already Exists",
              `The code "${trimmedCode}" is already in use.`
            );
          } else {
            showMessage(
              "Error",
              "Unable to update the MI / NON-MI type."
            );
          }

          return;
        }

        setModalVisible(false);
        setEditingMIType(null);
        setCode("");
        setName("");

        await loadMITypes();

        showMessage(
          "Updated",
          `${trimmedName} has been updated successfully.`
        );
      } else {
        const { error } = await supabase
          .from("mi_types")
          .insert({
            code: trimmedCode,
            name: trimmedName,
            is_active: true,
          });

        if (error) {
          console.log(
            "MI type insert error:",
            error.message
          );

          if (error.code === "23505") {
            showMessage(
              "Code Already Exists",
              `The code "${trimmedCode}" is already in use.`
            );
          } else {
            showMessage(
              "Error",
              "Unable to add the MI / NON-MI type."
            );
          }

          return;
        }

        setModalVisible(false);
        setEditingMIType(null);
        setCode("");
        setName("");

        await loadMITypes();

        showMessage(
          "Added",
          `${trimmedName} has been added successfully.`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------
     DEACTIVATE CONFIRMATION
  -------------------------------------------------- */

  const openDeactivateConfirmation = (
    miType: MIType
  ) => {
    setMITypeToDeactivate(miType);
    setConfirmModalVisible(true);
  };

  const closeConfirmModal = () => {
    if (changingStatus) {
      return;
    }

    setConfirmModalVisible(false);
    setMITypeToDeactivate(null);
  };

  /* --------------------------------------------------
     CONFIRM DEACTIVATE
  -------------------------------------------------- */

  const confirmDeactivate = async () => {
    if (
      !miTypeToDeactivate ||
      changingStatus
    ) {
      return;
    }

    setChangingStatus(true);

    try {
      const { error } = await supabase
        .from("mi_types")
        .update({
          is_active: false,
        })
        .eq("id", miTypeToDeactivate.id);

      if (error) {
        console.log(
          "MI type deactivate error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to deactivate the MI / NON-MI type."
        );

        return;
      }

      const selectedName =
        miTypeToDeactivate.name;

      const selectedCode =
        miTypeToDeactivate.code;

      setConfirmModalVisible(false);
      setMITypeToDeactivate(null);

      await loadMITypes();

      showMessage(
        "Deactivated",
        `${selectedCode} - ${selectedName} is now inactive and will not be available for new jobs. Historical records are not affected.`
      );
    } finally {
      setChangingStatus(false);
    }
  };

  /* --------------------------------------------------
     ACTIVATE
  -------------------------------------------------- */

  const activateMIType = async (
    miType: MIType
  ) => {
    if (changingStatus) {
      return;
    }

    setChangingStatus(true);

    try {
      const { error } = await supabase
        .from("mi_types")
        .update({
          is_active: true,
        })
        .eq("id", miType.id);

      if (error) {
        console.log(
          "MI type activate error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to activate the MI / NON-MI type."
        );

        return;
      }

      await loadMITypes();

      showMessage(
        "Activated",
        `${miType.code} - ${miType.name} is now active and available for new jobs.`
      );
    } finally {
      setChangingStatus(false);
    }
  };

  /* --------------------------------------------------
     FILTERED LIST
  -------------------------------------------------- */

  const filteredMITypes = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return miTypes.filter((miType) => {
      const matchesSearch =
        !normalizedSearch ||
        miType.code
          .toLowerCase()
          .includes(normalizedSearch) ||
        miType.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        (miType.is_active
          ? "active"
          : "inactive"
        ).includes(normalizedSearch);

      let matchesFilter = true;

      if (activeFilter === "Active") {
        matchesFilter = miType.is_active;
      }

      if (activeFilter === "Inactive") {
        matchesFilter = !miType.is_active;
      }

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [miTypes, search, activeFilter]);

  /* --------------------------------------------------
     COUNTS
  -------------------------------------------------- */

  const totalCount = miTypes.length;

  const activeCount = miTypes.filter(
    (miType) => miType.is_active
  ).length;

  const inactiveCount = miTypes.filter(
    (miType) => !miType.is_active
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
          Loading MI / NON-MI types...
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
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              router.replace(
                "/(tabs)/master-data"
              )
            }
          >
            <Ionicons
              name="arrow-back-outline"
              size={21}
              color={colors.text}
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              MI / NON-MI
            </Text>

            <Text style={styles.subtitle}>
              Manage MI and NON-MI categories
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
                name="list-outline"
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
            placeholder="Search code or MI type..."
            placeholderTextColor={
              colors.textLight
            }
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

        {/* FILTERS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.filterRow
          }
        >
          <Pressable
            style={[
              styles.filterChip,
              activeFilter === "All" &&
                styles.filterChipSelected,
            ]}
            onPress={() =>
              setActiveFilter("All")
            }
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
              activeFilter === "Active" &&
                styles.filterChipSelected,
            ]}
            onPress={() =>
              setActiveFilter("Active")
            }
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === "Active" &&
                  styles.filterTextSelected,
              ]}
            >
              Active {activeCount}
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
            Add MI / NON-MI Type
          </Text>
        </Pressable>

        {/* LIST HEADER */}

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            MI / NON-MI Types
          </Text>

          <Text style={styles.listSubtitle}>
            Showing {filteredMITypes.length} of{" "}
            {miTypes.length}
          </Text>
        </View>

        {/* LIST */}

        {filteredMITypes.length === 0 ? (
          <View style={styles.emptyCard}>
            <View
              style={styles.emptyIconContainer}
            >
              <Ionicons
                name="list-outline"
                size={30}
                color={colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No MI / NON-MI types found
            </Text>

            <Text style={styles.emptyText}>
              {search.trim() ||
              activeFilter !== "All"
                ? "Try changing your search or filter."
                : "Add your first MI / NON-MI type using the button above."}
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
          filteredMITypes.map((miType) => (
            <View
              key={miType.id}
              style={[
                styles.miCard,
                !miType.is_active &&
                  styles.inactiveCard,
              ]}
            >
              <View style={styles.miTop}>
                <View
                  style={styles.miInfoRow}
                >
                  <View
                    style={styles.codeContainer}
                  >
                    <Text
                      style={styles.codeText}
                    >
                      {miType.code}
                    </Text>
                  </View>

                  <View
                    style={styles.miInfo}
                  >
                    <Text
                      style={styles.miName}
                    >
                      {miType.name}
                    </Text>

                    <Text
                      style={
                        styles.miCodeLabel
                      }
                    >
                      Code: {miType.code}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    miType.is_active
                      ? styles.activeBadge
                      : styles.inactiveBadge,
                  ]}
                >
                  <Ionicons
                    name={
                      miType.is_active
                        ? "checkmark-circle-outline"
                        : "close-circle-outline"
                    }
                    size={14}
                    color={
                      miType.is_active
                        ? colors.success
                        : colors.textLight
                    }
                  />

                  <Text
                    style={[
                      styles.statusText,
                      miType.is_active
                        ? styles.activeText
                        : styles.inactiveText,
                    ]}
                  >
                    {miType.is_active
                      ? "Active"
                      : "Inactive"}
                  </Text>
                </View>
              </View>

              <View
                style={styles.cardDivider}
              />

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.editButton,
                    pressed &&
                      styles.buttonPressed,
                  ]}
                  onPress={() =>
                    openEditModal(miType)
                  }
                >
                  <Ionicons
                    name="create-outline"
                    size={17}
                    color={colors.text}
                  />

                  <Text
                    style={
                      styles.editButtonText
                    }
                  >
                    Edit
                  </Text>
                </Pressable>

                {miType.is_active ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.statusButton,
                      styles.deactivateButton,
                      pressed &&
                        styles.buttonPressed,
                    ]}
                    onPress={() =>
                      openDeactivateConfirmation(
                        miType
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
                      activateMIType(miType)
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View
                style={
                  styles.modalIconContainer
                }
              >
                <Ionicons
                  name="list-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View
                style={styles.modalHeaderText}
              >
                <Text
                  style={styles.modalTitle}
                >
                  {editingMIType
                    ? "Edit MI / NON-MI Type"
                    : "Add MI / NON-MI Type"}
                </Text>

                <Text
                  style={styles.modalSubtitle}
                >
                  {editingMIType
                    ? "Update MI / NON-MI details"
                    : "Add a new MI / NON-MI type"}
                </Text>
              </View>

              <Pressable
                style={
                  styles.modalCloseButton
                }
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

            {/* CODE */}

            <Text style={styles.fieldLabel}>
              Code *
            </Text>

            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(value) =>
                setCode(
                  value
                    .toUpperCase()
                    .replace(/\s/g, "")
                )
              }
              placeholder="e.g. MI"
              placeholderTextColor={
                colors.textLight
              }
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              editable={!saving}
            />

            <Text style={styles.characterCount}>
              {code.length}/20
            </Text>

            {/* NAME */}

            <Text style={styles.fieldLabel}>
              MI / NON-MI Type Name *
            </Text>

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. MI"
              placeholderTextColor={
                colors.textLight
              }
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={100}
              editable={!saving}
            />

            <Text
              style={[
                styles.characterCount,
                styles.nameCharacterCount,
              ]}
            >
              {name.length}/100
            </Text>

            <View
              style={styles.modalActions}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={closeModal}
                disabled={saving}
              >
                <Text
                  style={styles.cancelText}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed &&
                    styles.buttonPressed,
                  saving &&
                    styles.saveButtonDisabled,
                ]}
                onPress={saveMIType}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={colors.white}
                    />

                    <Text
                      style={styles.saveText}
                    >
                      Saving...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={
                        editingMIType
                          ? "checkmark-outline"
                          : "add-outline"
                      }
                      size={19}
                      color={colors.white}
                    />

                    <Text
                      style={styles.saveText}
                    >
                      {editingMIType
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

      {/* DEACTIVATE CONFIRMATION */}

      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={
          closeConfirmModal
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View
              style={
                styles.confirmIconContainer
              }
            >
              <Ionicons
                name="power-outline"
                size={28}
                color={colors.danger}
              />
            </View>

            <Text
              style={styles.confirmTitle}
            >
              Deactivate MI / NON-MI Type?
            </Text>

            {miTypeToDeactivate && (
              <View
                style={styles.miPreview}
              >
                <View
                  style={styles.previewCode}
                >
                  <Text
                    style={
                      styles.previewCodeText
                    }
                  >
                    {miTypeToDeactivate.code}
                  </Text>
                </View>

                <View
                  style={styles.miPreviewText}
                >
                  <Text
                    style={styles.miPreviewName}
                  >
                    {miTypeToDeactivate.name}
                  </Text>

                  <Text
                    style={
                      styles.miPreviewCategory
                    }
                  >
                    Code:{" "}
                    {miTypeToDeactivate.code}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.confirmText}>
              This MI / NON-MI type will no
              longer be available for new jobs.
            </Text>

            <Text style={styles.confirmNote}>
              Historical records will not be
              affected.
            </Text>

            <View
              style={styles.confirmActions}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.confirmCancelButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={closeConfirmModal}
                disabled={changingStatus}
              >
                <Text
                  style={
                    styles.confirmCancelText
                  }
                >
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
      </Modal>

      {/* MESSAGE POPUP */}

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
            <View
              style={
                styles.messageIconContainer
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={28}
                color={colors.primary}
              />
            </View>

            <Text
              style={styles.messageTitle}
            >
              {messageTitle}
            </Text>

            <Text
              style={styles.messageText}
            >
              {messageText}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.messageButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() =>
                setMessageModalVisible(false)
              }
            >
              <Text
                style={
                  styles.messageButtonText
                }
              >
                OK
              </Text>
            </Pressable>
          </View>
        </View>
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

  miCard: {
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

  miTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  miInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },

  codeContainer: {
    minWidth: 58,
    height: 46,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  codeText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
  },

  miInfo: {
    flex: 1,
  },

  miName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontSize: 16,
  },

  miCodeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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

  nameCharacterCount: {
    marginBottom: spacing.xl,
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

  miPreview: {
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

  previewCode: {
    minWidth: 56,
    height: 42,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },

  previewCodeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },

  miPreviewText: {
    marginLeft: spacing.sm,
    flex: 1,
  },

  miPreviewName: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  miPreviewCategory: {
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