import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
  created_at: string;
  updated_at: string;
};

export default function MITypesScreen() {
  const router = useRouter();

  const [miTypes, setMiTypes] = useState<MIType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<MIType[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  const [editingType, setEditingType] =
    useState<MIType | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error">("success");

  useEffect(() => {
    loadMITypes();
  }, []);

  useEffect(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      setFilteredTypes(miTypes);
      return;
    }

    const filtered = miTypes.filter(
      (item) =>
        item.code.toLowerCase().includes(searchText) ||
        item.name.toLowerCase().includes(searchText)
    );

    setFilteredTypes(filtered);
  }, [search, miTypes]);

  const showMessage = (
    text: string,
    type: "success" | "error" = "success"
  ) => {
    setMessage(text);
    setMessageType(type);
    setInfoModalVisible(true);
  };

  const loadMITypes = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("mi_types")
        .select("*")
        .order("code", { ascending: true });

      if (error) {
        console.log("Load MI types error:", error);
        showMessage(error.message, "error");
        return;
      }

      setMiTypes(data || []);
    } catch (error) {
      console.log(error);
      showMessage(
        "Something went wrong while loading MI types.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingType(null);
    setCode("");
    setName("");
    setModalVisible(true);
  };

  const openEditModal = (item: MIType) => {
    setEditingType(item);
    setCode(item.code);
    setName(item.name);
    setModalVisible(true);
  };

  const saveMIType = async () => {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      showMessage("Please enter a code.", "error");
      return;
    }

    if (!cleanName) {
      showMessage("Please enter a name.", "error");
      return;
    }

    if (cleanCode.length < 2) {
      showMessage(
        "Code must be at least 2 characters.",
        "error"
      );
      return;
    }

    if (cleanName.length < 2) {
      showMessage(
        "Name must be at least 2 characters.",
        "error"
      );
      return;
    }

    try {
      setSaving(true);

      // Check duplicate code
      const {
        data: duplicateCode,
        error: duplicateCodeError,
      } = await supabase
        .from("mi_types")
        .select("id, code")
        .ilike("code", cleanCode);

      if (duplicateCodeError) {
        console.log(
          "Duplicate code check error:",
          duplicateCodeError
        );
        showMessage(
          duplicateCodeError.message,
          "error"
        );
        return;
      }

      const codeExists = duplicateCode?.some(
        (item) => item.id !== editingType?.id
      );

      if (codeExists) {
        showMessage(
          "This MI type code already exists.",
          "error"
        );
        return;
      }

      if (editingType) {
        const { error } = await supabase
          .from("mi_types")
          .update({
            code: cleanCode,
            name: cleanName,
          })
          .eq("id", editingType.id);

        if (error) {
          console.log("Update error:", error);
          showMessage(error.message, "error");
          return;
        }

        setModalVisible(false);
        showMessage("MI type updated successfully.");
      } else {
        const { error } = await supabase
          .from("mi_types")
          .insert({
            code: cleanCode,
            name: cleanName,
          });

        if (error) {
          console.log("Insert error:", error);
          showMessage(error.message, "error");
          return;
        }

        setModalVisible(false);
        showMessage("MI type added successfully.");
      }

      setCode("");
      setName("");
      setEditingType(null);

      await loadMITypes();
    } catch (error) {
      console.log(error);
      showMessage(
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: MIType) => {
    const newStatus = !item.is_active;

    try {
      const { error } = await supabase
        .from("mi_types")
        .update({
          is_active: newStatus,
        })
        .eq("id", item.id);

      if (error) {
        console.log("Status update error:", error);
        showMessage(error.message, "error");
        return;
      }

      await loadMITypes();

      showMessage(
        newStatus
          ? `${item.code} activated successfully.`
          : `${item.code} deactivated successfully.`
      );
    } catch (error) {
      console.log(error);
      showMessage(
        "Unable to update MI type status.",
        "error"
      );
    }
  };

  const renderMIType = ({
    item,
  }: {
    item: MIType;
  }) => {
    return (
      <View style={styles.typeCard}>
        {/* ICON */}
        <View style={styles.typeIcon}>
          <Ionicons
            name="construct-outline"
            size={23}
            color={colors.primary}
          />
        </View>

        {/* INFO */}
        <View style={styles.typeInfo}>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>
              {item.code}
            </Text>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: item.is_active
                    ? colors.successLight
                    : colors.dangerLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: item.is_active
                      ? colors.success
                      : colors.danger,
                  },
                ]}
              >
                {item.is_active
                  ? "Active"
                  : "Inactive"}
              </Text>
            </View>
          </View>

          <Text style={styles.typeName}>
            {item.name}
          </Text>
        </View>

        {/* ACTIONS */}
        <View style={styles.actions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => openEditModal(item)}
          >
            <Ionicons
              name="create-outline"
              size={21}
              color={colors.primary}
            />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() => toggleActive(item)}
          >
            <Ionicons
              name={
                item.is_active
                  ? "power-outline"
                  : "checkmark-outline"
              }
              size={21}
              color={
                item.is_active
                  ? colors.danger
                  : colors.success
              }
            />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back-outline"
            size={24}
            color={colors.text}
          />
        </Pressable>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            MI / NON-MI Types
          </Text>

          <Text style={styles.headerSubtitle}>
            Manage MI classification types
          </Text>
        </View>

        <Pressable
          style={styles.infoButton}
          onPress={() => {
            showMessage(
              "MI / NON-MI is used when creating a job card. The available types can be activated or deactivated by an administrator."
            );
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textSecondary}
        />

        <TextInput
          style={styles.searchInput}
          placeholder="Search by code or name..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />

        {search.length > 0 && (
          <Pressable
            onPress={() => setSearch("")}
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={colors.textLight}
            />
          </Pressable>
        )}
      </View>

      {/* COUNT + ADD */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filteredTypes.length}{" "}
          {filteredTypes.length === 1
            ? "Type"
            : "Types"}
        </Text>

        <Pressable
          style={styles.addButton}
          onPress={openAddModal}
        >
          <View style={styles.addIconCircle}>
            <Ionicons
              name="add-outline"
              size={19}
              color={colors.primary}
            />
          </View>

          <Text style={styles.addButtonText}>
            Add
          </Text>
        </Pressable>
      </View>

      {/* LIST */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading MI types...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTypes}
          keyExtractor={(item) => item.id}
          renderItem={renderMIType}
          contentContainerStyle={
            filteredTypes.length === 0
              ? styles.emptyList
              : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadMITypes}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="construct-outline"
                  size={38}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.emptyTitle}>
                No MI Types
              </Text>

              <Text style={styles.emptyText}>
                {search
                  ? "No type matches your search."
                  : "Add your first MI type."}
              </Text>

              {!search && (
                <Pressable
                  style={styles.emptyAddButton}
                  onPress={openAddModal}
                >
                  <Ionicons
                    name="add-outline"
                    size={20}
                    color={colors.white}
                  />

                  <Text
                    style={styles.emptyAddButtonText}
                  >
                    Add MI Type
                  </Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* ADD / EDIT MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) {
            setModalVisible(false);
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <View style={styles.modalBox}>
            {/* MODAL HEADER */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIcon}>
                  <Ionicons
                    name="construct-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.modalTitleContent}>
                  <Text style={styles.modalTitle}>
                    {editingType
                      ? "Edit MI Type"
                      : "Add MI Type"}
                  </Text>

                  <Text
                    style={styles.modalSubtitle}
                  >
                    Enter MI classification details
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.modalCloseButton}
                onPress={() => {
                  if (!saving) {
                    setModalVisible(false);
                  }
                }}
              >
                <Ionicons
                  name="close-outline"
                  size={25}
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
              placeholder="Example: MI"
              placeholderTextColor={colors.textLight}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              editable={!saving}
              maxLength={20}
            />

            {/* NAME */}
            <Text
              style={[
                styles.fieldLabel,
                styles.secondLabel,
              ]}
            >
              Name *
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Example: MI"
              placeholderTextColor={colors.textLight}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!saving}
              maxLength={100}
            />

            {/* BUTTONS */}
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  if (!saving) {
                    setModalVisible(false);
                  }
                }}
                disabled={saving}
              >
                <Text
                  style={styles.cancelButtonText}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.saveButton,
                  saving && styles.disabledButton,
                ]}
                onPress={saveMIType}
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
                      name="checkmark-outline"
                      size={19}
                      color={colors.white}
                    />

                    <Text
                      style={styles.saveButtonText}
                    >
                      {editingType
                        ? "Update"
                        : "Save"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MESSAGE MODAL */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setInfoModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.messageBox}>
            <View
              style={[
                styles.messageIcon,
                {
                  backgroundColor:
                    messageType === "success"
                      ? colors.successLight
                      : colors.dangerLight,
                },
              ]}
            >
              <Ionicons
                name={
                  messageType === "success"
                    ? "checkmark-circle-outline"
                    : "alert-circle-outline"
                }
                size={31}
                color={
                  messageType === "success"
                    ? colors.success
                    : colors.danger
                }
              />
            </View>

            <Text style={styles.messageTitle}>
              {messageType === "success"
                ? "Success"
                : "Error"}
            </Text>

            <Text style={styles.messageText}>
              {message}
            </Text>

            <Pressable
              style={styles.messageButton}
              onPress={() =>
                setInfoModalVisible(false)
              }
            >
              <Text
                style={styles.messageButtonText}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    ...typography.heading,
    color: colors.text,
  },

  headerSubtitle: {
    marginTop: 3,
    ...typography.caption,
    color: colors.textSecondary,
  },

  infoButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  /* SEARCH */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },

  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.text,
  },

  /* COUNT + ADD */
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  countText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingLeft: 5,
    paddingRight: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },

  addIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    marginLeft: spacing.sm,
    ...typography.button,
    color: colors.white,
  },

  /* LIST */
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  typeIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  typeInfo: {
    flex: 1,
  },

  codeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  codeText: {
    ...typography.subheading,
    color: colors.text,
  },

  statusBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  typeName: {
    marginTop: 5,
    ...typography.caption,
    color: colors.textSecondary,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  /* LOADING */
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: spacing.sm,
    ...typography.caption,
    color: colors.textSecondary,
  },

  /* EMPTY */
  emptyList: {
    flexGrow: 1,
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xxl,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: spacing.md,
    ...typography.subheading,
    color: colors.text,
  },

  emptyText: {
    marginTop: spacing.xs,
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },

  emptyAddButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },

  emptyAddButtonText: {
    marginLeft: spacing.xs,
    ...typography.button,
    color: colors.white,
  },

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  modalBox: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },

  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  modalTitleContent: {
    flex: 1,
  },

  modalTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  modalSubtitle: {
    marginTop: 3,
    ...typography.caption,
    color: colors.textSecondary,
  },

  modalCloseButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  fieldLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  secondLabel: {
    marginTop: spacing.lg,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.xl,
  },

  cancelButton: {
    height: 44,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },

  cancelButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },

  saveButton: {
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    minWidth: 90,
  },

  disabledButton: {
    opacity: 0.7,
  },

  saveButtonText: {
    marginLeft: spacing.xs,
    ...typography.button,
    color: colors.white,
  },

  /* MESSAGE MODAL */
  messageBox: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
  },

  messageIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  messageTitle: {
    marginTop: spacing.md,
    ...typography.heading,
    color: colors.text,
  },

  messageText: {
    marginTop: spacing.sm,
    ...typography.caption,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
  },

  messageButton: {
    marginTop: spacing.lg,
    minWidth: 100,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },

  messageButtonText: {
    ...typography.button,
    color: colors.white,
  },
});