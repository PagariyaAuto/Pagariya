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

type InsuranceCompany = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function InsuranceCompanies() {
  const [companies, setCompanies] = useState<
    InsuranceCompany[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalVisible, setModalVisible] =
    useState(false);

  const [editingCompany, setEditingCompany] =
    useState<InsuranceCompany | null>(null);

  const [companyName, setCompanyName] =
    useState("");

  const [saving, setSaving] = useState(false);

  const [messageModalVisible, setMessageModalVisible] =
    useState(false);

  const [messageTitle, setMessageTitle] =
    useState("");

  const [messageText, setMessageText] =
    useState("");

  useEffect(() => {
    loadCompanies();
  }, []);

  /* --------------------------------------------------
     LOAD COMPANIES
  -------------------------------------------------- */

  const loadCompanies = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("insurance_companies")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.log(
          "Insurance companies error:",
          error.message
        );

        showMessage(
          "Error",
          "Unable to load insurance companies."
        );

        return;
      }

      setCompanies(data || []);
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
     SAVE COMPANY
  -------------------------------------------------- */

  const saveCompany = async () => {
    const trimmedName = companyName.trim();

    if (!trimmedName) {
      showMessage(
        "Required",
        "Please enter the insurance company name."
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
              "An insurance company with this name already exists."
            );
          } else {
            showMessage(
              "Error",
              "Unable to update the insurance company."
            );
          }

          return;
        }

        setModalVisible(false);

        await loadCompanies();

        showMessage(
          "Updated",
          "Insurance company updated successfully."
        );
      } else {
        const { error } = await supabase
          .from("insurance_companies")
          .insert({
            name: trimmedName,
          });

        if (error) {
          console.log(
            "Insert insurance company error:",
            error.message
          );

          if (error.code === "23505") {
            showMessage(
              "Already Exists",
              "An insurance company with this name already exists."
            );
          } else {
            showMessage(
              "Error",
              "Unable to add the insurance company."
            );
          }

          return;
        }

        setModalVisible(false);

        await loadCompanies();

        showMessage(
          "Added",
          "Insurance company added successfully."
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
    company: InsuranceCompany
  ) => {
    const newStatus = !company.is_active;

    const { error } = await supabase
      .from("insurance_companies")
      .update({
        is_active: newStatus,
      })
      .eq("id", company.id);

    if (error) {
      console.log(
        "Toggle insurance company error:",
        error.message
      );

      showMessage(
        "Error",
        "Unable to change the company status."
      );

      return;
    }

    await loadCompanies();
  };

  /* --------------------------------------------------
     SEARCH
  -------------------------------------------------- */

  const filteredCompanies =
    companies.filter((company) =>
      company.name
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );

  /* --------------------------------------------------
     LOADING
  -------------------------------------------------- */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading insurance companies...
          </Text>
        </View>
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
              {filteredCompanies.length} compan
              {filteredCompanies.length !== 1
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
              {search.trim()
                ? "Try a different search."
                : "Add your first insurance company using the button above."}
            </Text>
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
              {/* COMPANY INFO */}

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

                {/* STATUS */}

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

              {/* ACTIONS */}

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

                <Pressable
                  style={({ pressed }) => [
                    styles.statusButton,
                    company.is_active
                      ? styles.deactivateButton
                      : styles.activateButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() =>
                    toggleActive(company)
                  }
                >
                  <Ionicons
                    name={
                      company.is_active
                        ? "power-outline"
                        : "checkmark-outline"
                    }
                    size={17}
                    color={
                      company.is_active
                        ? colors.danger
                        : colors.success
                    }
                  />

                  <Text
                    style={[
                      styles.statusButtonText,
                      company.is_active
                        ? styles.deactivateText
                        : styles.activateText,
                    ]}
                  >
                    {company.is_active
                      ? "Deactivate"
                      : "Activate"}
                  </Text>
                </Pressable>
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

            {/* COMPANY NAME */}

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
            />

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
                onPress={saveCompany}
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
    fontSize: 22,
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
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
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

  /* COMPANY CARD */

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
    fontSize: 16,
    color: colors.text,
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
    marginBottom: spacing.xl,
    backgroundColor: colors.background,
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