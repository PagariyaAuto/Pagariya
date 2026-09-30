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

type BusinessType = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type FilterType = "All" | "Active" | "Inactive";

export default function BusinessTypes() {
  const [businessTypes, setBusinessTypes] = useState<
    BusinessType[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [activeFilter, setActiveFilter] =
    useState<FilterType>("All");

  const [modalVisible, setModalVisible] =
    useState(false);

  const [editingBusinessType, setEditingBusinessType] =
    useState<BusinessType | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [saving, setSaving] = useState(false);

  const [
    confirmModalVisible,
    setConfirmModalVisible,
  ] = useState(false);

  const [
    businessTypeToDeactivate,
    setBusinessTypeToDeactivate,
  ] = useState<BusinessType | null>(null);

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
    loadBusinessTypes();
  }, []);

  /* --------------------------------------------------
     LOAD BUSINESS TYPES
  -------------------------------------------------- */

  const loadBusinessTypes = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("business_types")
        .select(
          "id, code, name, is_active, created_at, updated_at"
        )
        .order("name", {
          ascending: true,
        });

      if (error) {
        console.log(
          "Business types load error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to load business / claim types."
        );

        return;
      }

      setBusinessTypes(data || []);
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
    setEditingBusinessType(null);
    setCode("");
    setName("");
    setModalVisible(true);
  };

  /* --------------------------------------------------
     OPEN EDIT MODAL
  -------------------------------------------------- */

  const openEditModal = (
    businessType: BusinessType
  ) => {
    setEditingBusinessType(businessType);
    setCode(businessType.code);
    setName(businessType.name);
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
    setEditingBusinessType(null);
    setCode("");
    setName("");
  };

  /* --------------------------------------------------
     SAVE BUSINESS TYPE
  -------------------------------------------------- */

  const saveBusinessType = async () => {
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
        "Please enter the business / claim type code."
      );

      return;
    }

    if (!trimmedName) {
      showMessage(
        "Required",
        "Please enter the business / claim type name."
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

    if (trimmedName.length > 150) {
      showMessage(
        "Invalid Name",
        "Name cannot exceed 150 characters."
      );

      return;
    }

    /*
     * Existing records:
     *
     * CNT  = Contractor
     * PNPL = Pagariya Auto Private Limited
     *
     * They can be edited, but their codes remain
     * unique because business_types.code is unique.
     */

    const duplicateCode =
      businessTypes.find(
        (businessType) =>
          businessType.code
            .trim()
            .toUpperCase() === trimmedCode &&
          businessType.id !==
            editingBusinessType?.id
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
      if (editingBusinessType) {
        const { error } = await supabase
          .from("business_types")
          .update({
            code: trimmedCode,
            name: trimmedName,
          })
          .eq(
            "id",
            editingBusinessType.id
          );

        if (error) {
          console.log(
            "Business type update error:",
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
              "Unable to update the business / claim type."
            );
          }

          return;
        }

        setModalVisible(false);
        setEditingBusinessType(null);
        setCode("");
        setName("");

        await loadBusinessTypes();

        showMessage(
          "Updated",
          `${trimmedName} has been updated successfully.`
        );
      } else {
        const { error } = await supabase
          .from("business_types")
          .insert({
            code: trimmedCode,
            name: trimmedName,
            is_active: true,
          });

        if (error) {
          console.log(
            "Business type insert error:",
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
              "Unable to add the business / claim type."
            );
          }

          return;
        }

        setModalVisible(false);
        setEditingBusinessType(null);
        setCode("");
        setName("");

        await loadBusinessTypes();

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
     OPEN DEACTIVATE CONFIRMATION
  -------------------------------------------------- */

  const openDeactivateConfirmation = (
    businessType: BusinessType
  ) => {
    setBusinessTypeToDeactivate(
      businessType
    );

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
    setBusinessTypeToDeactivate(null);
  };

  /* --------------------------------------------------
     CONFIRM DEACTIVATE
  -------------------------------------------------- */

  const confirmDeactivate = async () => {
    if (
      !businessTypeToDeactivate ||
      changingStatus
    ) {
      return;
    }

    setChangingStatus(true);

    try {
      const { error } = await supabase
        .from("business_types")
        .update({
          is_active: false,
        })
        .eq(
          "id",
          businessTypeToDeactivate.id
        );

      if (error) {
        console.log(
          "Business type deactivate error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to deactivate the business / claim type."
        );

        return;
      }

      const selectedName =
        businessTypeToDeactivate.name;

      const selectedCode =
        businessTypeToDeactivate.code;

      setConfirmModalVisible(false);
      setBusinessTypeToDeactivate(null);

      await loadBusinessTypes();

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

  const activateBusinessType = async (
    businessType: BusinessType
  ) => {
    if (changingStatus) {
      return;
    }

    setChangingStatus(true);

    try {
      const { error } = await supabase
        .from("business_types")
        .update({
          is_active: true,
        })
        .eq("id", businessType.id);

      if (error) {
        console.log(
          "Business type activate error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to activate the business / claim type."
        );

        return;
      }

      await loadBusinessTypes();

      showMessage(
        "Activated",
        `${businessType.code} - ${businessType.name} is now active and available for new jobs.`
      );
    } finally {
      setChangingStatus(false);
    }
  };

  /* --------------------------------------------------
     FILTERED LIST
  -------------------------------------------------- */

  const filteredBusinessTypes =
    useMemo(() => {
      const normalizedSearch = search
        .trim()
        .toLowerCase();

      return businessTypes.filter(
        (businessType) => {
          const matchesSearch =
            !normalizedSearch ||
            businessType.code
              .toLowerCase()
              .includes(normalizedSearch) ||
            businessType.name
              .toLowerCase()
              .includes(normalizedSearch) ||
            (businessType.is_active
              ? "active"
              : "inactive"
            ).includes(normalizedSearch);

          let matchesFilter = true;

          if (activeFilter === "Active") {
            matchesFilter =
              businessType.is_active;
          }

          if (activeFilter === "Inactive") {
            matchesFilter =
              !businessType.is_active;
          }

          return (
            matchesSearch &&
            matchesFilter
          );
        }
      );
    }, [
      businessTypes,
      search,
      activeFilter,
    ]);

  /* --------------------------------------------------
     COUNTS
  -------------------------------------------------- */

  const totalCount =
    businessTypes.length;

  const activeCount =
    businessTypes.filter(
      (businessType) =>
        businessType.is_active
    ).length;

  const inactiveCount =
    businessTypes.filter(
      (businessType) =>
        !businessType.is_active
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
          Loading business / claim types...
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
            onPress={() => router.replace("/(tabs)/master-data")}
          >
            <Ionicons
              name="arrow-back-outline"
              size={21}
              color={colors.text}
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Business / Claim Types
            </Text>

            <Text style={styles.subtitle}>
              Manage business and claim categories
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
            placeholder="Search code or business type..."
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
            Add Business / Claim Type
          </Text>
        </Pressable>

        {/* LIST HEADER */}

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            Business / Claim Types
          </Text>

          <Text style={styles.listSubtitle}>
            Showing {filteredBusinessTypes.length}{" "}
            of {businessTypes.length}
          </Text>
        </View>

        {/* LIST */}

        {filteredBusinessTypes.length === 0 ? (
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
              No business / claim types found
            </Text>

            <Text style={styles.emptyText}>
              {search.trim() ||
              activeFilter !== "All"
                ? "Try changing your search or filter."
                : "Add your first business / claim type using the button above."}
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
                  style={
                    styles.clearFilterText
                  }
                >
                  Clear Filters
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredBusinessTypes.map(
            (businessType) => (
              <View
                key={businessType.id}
                style={[
                  styles.businessCard,
                  !businessType.is_active &&
                    styles.inactiveCard,
                ]}
              >
                {/* TOP */}

                <View style={styles.businessTop}>
                  <View
                    style={
                      styles.businessInfoRow
                    }
                  >
                    <View
                      style={
                        styles.codeContainer
                      }
                    >
                      <Text
                        style={styles.codeText}
                      >
                        {businessType.code}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.businessInfo
                      }
                    >
                      <Text
                        style={
                          styles.businessName
                        }
                      >
                        {businessType.name}
                      </Text>

                      <Text
                        style={
                          styles.businessCodeLabel
                        }
                      >
                        Code:{" "}
                        {businessType.code}
                      </Text>
                    </View>
                  </View>

                  {/* STATUS */}

                  <View
                    style={[
                      styles.statusBadge,
                      businessType.is_active
                        ? styles.activeBadge
                        : styles.inactiveBadge,
                    ]}
                  >
                    <Ionicons
                      name={
                        businessType.is_active
                          ? "checkmark-circle-outline"
                          : "close-circle-outline"
                      }
                      size={14}
                      color={
                        businessType.is_active
                          ? colors.success
                          : colors.textLight
                      }
                    />

                    <Text
                      style={[
                        styles.statusText,
                        businessType.is_active
                          ? styles.activeText
                          : styles.inactiveText,
                      ]}
                    >
                      {businessType.is_active
                        ? "Active"
                        : "Inactive"}
                    </Text>
                  </View>
                </View>

                <View
                  style={styles.cardDivider}
                />

                {/* ACTIONS */}

                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed &&
                        styles.buttonPressed,
                    ]}
                    onPress={() =>
                      openEditModal(
                        businessType
                      )
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

                  {businessType.is_active ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.statusButton,
                        styles.deactivateButton,
                        pressed &&
                          styles.buttonPressed,
                      ]}
                      onPress={() =>
                        openDeactivateConfirmation(
                          businessType
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
                        activateBusinessType(
                          businessType
                        )
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
            )
          )
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
                  {editingBusinessType
                    ? "Edit Business / Claim Type"
                    : "Add Business / Claim Type"}
                </Text>

                <Text
                  style={styles.modalSubtitle}
                >
                  {editingBusinessType
                    ? "Update business / claim details"
                    : "Add a new business / claim type"}
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
              placeholder="e.g. CNT"
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
              Business / Claim Type Name *
            </Text>

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Contractor"
              placeholderTextColor={
                colors.textLight
              }
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={150}
              editable={!saving}
            />

            <Text
              style={[
                styles.characterCount,
                styles.nameCharacterCount,
              ]}
            >
              {name.length}/150
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
                onPress={saveBusinessType}
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
                        editingBusinessType
                          ? "checkmark-outline"
                          : "add-outline"
                      }
                      size={19}
                      color={colors.white}
                    />

                    <Text
                      style={styles.saveText}
                    >
                      {editingBusinessType
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
              Deactivate Business / Claim Type?
            </Text>

            {businessTypeToDeactivate && (
              <View
                style={styles.businessPreview}
              >
                <View
                  style={styles.previewCode}
                >
                  <Text
                    style={
                      styles.previewCodeText
                    }
                  >
                    {
                      businessTypeToDeactivate.code
                    }
                  </Text>
                </View>

                <View
                  style={
                    styles.businessPreviewText
                  }
                >
                  <Text
                    style={
                      styles.businessPreviewName
                    }
                  >
                    {
                      businessTypeToDeactivate.name
                    }
                  </Text>

                  <Text
                    style={
                      styles.businessPreviewCategory
                    }
                  >
                    Code:{" "}
                    {
                      businessTypeToDeactivate.code
                    }
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.confirmText}>
              This business / claim type will no
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

  businessCard: {
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

  businessTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  businessInfoRow: {
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

  businessInfo: {
    flex: 1,
  },

  businessName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontSize: 16,
  },

  businessCodeLabel: {
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

  businessPreview: {
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

  businessPreviewText: {
    marginLeft: spacing.sm,
    flex: 1,
  },

  businessPreviewName: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  businessPreviewCategory: {
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