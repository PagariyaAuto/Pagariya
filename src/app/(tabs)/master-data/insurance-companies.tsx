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

type InsuranceCompany = {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type FilterType = "All" | "Active" | "Inactive";

type PopupType = "success" | "error" | "warning" | "info";

export default function InsuranceCompanies() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FilterType>("All");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] =
    useState<InsuranceCompany | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);

  const [
    confirmModalVisible,
    setConfirmModalVisible,
  ] = useState(false);

  const [
    companyToDeactivate,
    setCompanyToDeactivate,
  ] = useState<InsuranceCompany | null>(null);

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

  const [messageType, setMessageType] =
    useState<PopupType>("info");

  useEffect(() => {
    loadCompanies();
  }, []);

  /* --------------------------------------------------
     POPUP
  -------------------------------------------------- */

  const showMessage = (
    title: string,
    text: string,
    type: PopupType = "info"
  ) => {
    setMessageTitle(title);
    setMessageText(text);
    setMessageType(type);
    setMessageModalVisible(true);
  };

  const closeMessageModal = () => {
    setMessageModalVisible(false);
  };

  const getPopupIcon = () => {
    switch (messageType) {
      case "success":
        return "checkmark-circle-outline";

      case "error":
        return "alert-circle-outline";

      case "warning":
        return "warning-outline";

      default:
        return "information-circle-outline";
    }
  };

  const getPopupColor = () => {
    switch (messageType) {
      case "success":
        return colors.success;

      case "error":
        return colors.danger;

      case "warning":
        return colors.danger;

      default:
        return colors.primary;
    }
  };

  const getPopupBackground = () => {
    switch (messageType) {
      case "success":
        return colors.successLight;

      case "error":
        return colors.dangerLight;

      case "warning":
        return colors.dangerLight;

      default:
        return colors.primaryLight;
    }
  };

  /* --------------------------------------------------
     LOAD COMPANIES
  -------------------------------------------------- */

  const loadCompanies = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("insurance_companies")
        .select(
          "id, name, is_active, created_at, updated_at"
        )
        .order("name", {
          ascending: true,
        });

      if (error) {
        console.log(
          "Insurance companies error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to load insurance companies.",
          "error"
        );

        return;
      }

      setCompanies(data || []);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------
     OPEN ADD MODAL
  -------------------------------------------------- */

  const openAddModal = () => {
    setEditingCompany(null);
    setCompanyName("");
    setModalVisible(true);
  };

  /* --------------------------------------------------
     OPEN EDIT MODAL
  -------------------------------------------------- */

  const openEditModal = (
    company: InsuranceCompany
  ) => {
    setEditingCompany(company);
    setCompanyName(company.name);
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
    setEditingCompany(null);
    setCompanyName("");
  };

  /* --------------------------------------------------
     SAVE COMPANY
  -------------------------------------------------- */

  const saveCompany = async () => {
    if (saving) {
      return;
    }

    const trimmedName = companyName.trim();

    if (!trimmedName) {
      showMessage(
        "Required",
        "Please enter the insurance company name.",
        "warning"
      );

      return;
    }

    if (trimmedName.length > 100) {
      showMessage(
        "Invalid Name",
        "Insurance company name cannot exceed 100 characters.",
        "warning"
      );

      return;
    }

    const duplicateCompany = companies.find(
      (company) =>
        company.name.trim().toLowerCase() ===
          trimmedName.toLowerCase() &&
        company.id !== editingCompany?.id
    );

    if (duplicateCompany) {
      showMessage(
        "Already Exists",
        "An insurance company with this name already exists.",
        "warning"
      );

      return;
    }

    setSaving(true);

    try {
      if (editingCompany) {
        const { error } = await supabase
          .from("insurance_companies")
          .update({
            name: trimmedName,
          })
          .eq("id", editingCompany.id);

        if (error) {
          console.log(
            "Update insurance company error:",
            error.message
          );

          if (error.code === "23505") {
            showMessage(
              "Already Exists",
              "An insurance company with this name already exists.",
              "warning"
            );
          } else {
            showMessage(
              "Error",
              "Unable to update the insurance company.",
              "error"
            );
          }

          return;
        }

        setModalVisible(false);
        setEditingCompany(null);
        setCompanyName("");

        await loadCompanies();

        showMessage(
          "Updated",
          "Insurance company updated successfully.",
          "success"
        );
      } else {
        const { error } = await supabase
          .from("insurance_companies")
          .insert({
            name: trimmedName,
            is_active: true,
          });

        if (error) {
          console.log(
            "Insert insurance company error:",
            error.message
          );

          if (error.code === "23505") {
            showMessage(
              "Already Exists",
              "An insurance company with this name already exists.",
              "warning"
            );
          } else {
            showMessage(
              "Error",
              "Unable to add the insurance company.",
              "error"
            );
          }

          return;
        }

        setModalVisible(false);
        setEditingCompany(null);
        setCompanyName("");

        await loadCompanies();

        showMessage(
          "Added",
          "Insurance company added successfully.",
          "success"
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
    company: InsuranceCompany
  ) => {
    setCompanyToDeactivate(company);
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
    setCompanyToDeactivate(null);
  };

  /* --------------------------------------------------
     CONFIRM DEACTIVATE
  -------------------------------------------------- */

  const confirmDeactivate = async () => {
    if (
      !companyToDeactivate ||
      changingStatus
    ) {
      return;
    }

    setChangingStatus(true);

    try {
      const { error } = await supabase
        .from("insurance_companies")
        .update({
          is_active: false,
        })
        .eq("id", companyToDeactivate.id);

      if (error) {
        console.log(
          "Deactivate insurance company error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to deactivate the insurance company.",
          "error"
        );

        return;
      }

      const name = companyToDeactivate.name;

      setConfirmModalVisible(false);
      setCompanyToDeactivate(null);

      await loadCompanies();

      showMessage(
        "Company Deactivated",
        `${name} is now inactive and will not be available for new job cards. Historical records are not affected.`,
        "success"
      );
    } finally {
      setChangingStatus(false);
    }
  };

  /* --------------------------------------------------
     ACTIVATE COMPANY
  -------------------------------------------------- */

  const activateCompany = async (
    company: InsuranceCompany
  ) => {
    if (changingStatus) {
      return;
    }

    setChangingStatus(true);

    try {
      const { error } = await supabase
        .from("insurance_companies")
        .update({
          is_active: true,
        })
        .eq("id", company.id);

      if (error) {
        console.log(
          "Activate insurance company error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to activate the insurance company.",
          "error"
        );

        return;
      }

      await loadCompanies();

      showMessage(
        "Company Activated",
        `${company.name} is now active and can be selected for new job cards.`,
        "success"
      );
    } finally {
      setChangingStatus(false);
    }
  };

  /* --------------------------------------------------
     FILTERED COMPANIES
  -------------------------------------------------- */

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return companies.filter((company) => {
      const matchesSearch =
        !normalizedSearch ||
        company.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        (company.is_active
          ? "active"
          : "inactive"
        ).includes(normalizedSearch);

      let matchesFilter = true;

      if (activeFilter === "Active") {
        matchesFilter = company.is_active;
      }

      if (activeFilter === "Inactive") {
        matchesFilter = !company.is_active;
      }

      return matchesSearch && matchesFilter;
    });
  }, [companies, search, activeFilter]);

  /* --------------------------------------------------
     SUMMARY COUNTS
  -------------------------------------------------- */

  const totalCount = companies.length;

  const activeCount = companies.filter(
    (company) => company.is_active
  ).length;

  const inactiveCount = companies.filter(
    (company) => !company.is_active
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
          Loading insurance companies...
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
              Insurance Companies
            </Text>

            <Text style={styles.subtitle}>
              Manage insurance companies used in job cards
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
                name="shield-checkmark-outline"
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
            placeholder="Search insurance company..."
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
            Add Insurance Company
          </Text>
        </Pressable>

        {/* LIST HEADER */}

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              Insurance Companies
            </Text>

            <Text style={styles.listSubtitle}>
              Showing {filteredCompanies.length} of{" "}
              {companies.length} compan
              {companies.length !== 1
                ? "ies"
                : "y"}
            </Text>
          </View>
        </View>

        {/* LIST */}

        {filteredCompanies.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="shield-checkmark-outline"
                size={30}
                color={colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No insurance companies found
            </Text>

            <Text style={styles.emptyText}>
              {search.trim() ||
              activeFilter !== "All"
                ? "Try changing your search or filter."
                : "Add your first insurance company using the button above."}
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
          filteredCompanies.map((company) => (
            <View
              key={company.id}
              style={[
                styles.companyCard,
                !company.is_active &&
                  styles.inactiveCard,
              ]}
            >
              <View style={styles.companyTop}>
                <View style={styles.companyInfoRow}>
                  <View
                    style={styles.companyIconContainer}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>
                      {company.name}
                    </Text>

                    <View style={styles.typeRow}>
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color={colors.textSecondary}
                      />

                      <Text style={styles.typeText}>
                        Insurance Company
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    company.is_active
                      ? styles.activeBadge
                      : styles.inactiveBadge,
                  ]}
                >
                  <Ionicons
                    name={
                      company.is_active
                        ? "checkmark-circle-outline"
                        : "close-circle-outline"
                    }
                    size={14}
                    color={
                      company.is_active
                        ? colors.success
                        : colors.textLight
                    }
                  />

                  <Text
                    style={[
                      styles.statusText,
                      company.is_active
                        ? styles.activeText
                        : styles.inactiveText,
                    ]}
                  >
                    {company.is_active
                      ? "Active"
                      : "Inactive"}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.editButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() =>
                    openEditModal(company)
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

                {company.is_active ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.statusButton,
                      styles.deactivateButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() =>
                      openDeactivateConfirmation(
                        company
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
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() =>
                      activateCompany(company)
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
                  name="shield-checkmark-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  {editingCompany
                    ? "Edit Insurance Company"
                    : "Add Insurance Company"}
                </Text>

                <Text style={styles.modalSubtitle}>
                  {editingCompany
                    ? "Update company details"
                    : "Add a new insurance company"}
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
              Insurance Company *
            </Text>

            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Enter insurance company"
              placeholderTextColor={colors.textLight}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={100}
              editable={!saving}
            />

            <Text style={styles.characterCount}>
              {companyName.length}/100
            </Text>

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
                onPress={saveCompany}
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
                        editingCompany
                          ? "checkmark-outline"
                          : "add-outline"
                      }
                      size={19}
                      color={colors.white}
                    />

                    <Text style={styles.saveText}>
                      {editingCompany
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
              Deactivate Insurance Company?
            </Text>

            {companyToDeactivate && (
              <View style={styles.companyPreview}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={21}
                  color={colors.primary}
                />

                <View style={styles.companyPreviewText}>
                  <Text
                    style={styles.companyPreviewName}
                  >
                    {companyToDeactivate.name}
                  </Text>

                  <Text
                    style={
                      styles.companyPreviewCategory
                    }
                  >
                    Insurance Company
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.confirmText}>
              This company will no longer be available
              when creating new job cards.
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

      {/* POPUP MESSAGE */}

      <Modal
        visible={messageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMessageModal}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalOverlay}>
          <View style={styles.messageCard}>
            <View
              style={[
                styles.messageIconContainer,
                {
                  backgroundColor:
                    getPopupBackground(),
                },
              ]}
            >
              <Ionicons
                name={getPopupIcon()}
                size={29}
                color={getPopupColor()}
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
                {
                  backgroundColor: getPopupColor(),
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={closeMessageModal}
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

/* --------------------------------------------------
   STYLES
-------------------------------------------------- */

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

  companyCard: {
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

  companyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  companyInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },

  companyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  companyInfo: {
    flex: 1,
  },

  companyName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontSize: 16,
  },

  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },

  typeText: {
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

  companyPreview: {
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

  companyPreviewText: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  companyPreviewName: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  companyPreviewCategory: {
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
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },

  messageButtonText: {
    ...typography.button,
    color: colors.white,
  },
});