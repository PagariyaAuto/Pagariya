
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../theme";

import AdminEmptyState from "../../../components/admin/AdminEmptyState";
import AdminFilterChip from "../../../components/admin/AdminFilterChip";
import AdminHeader from "../../../components/admin/AdminHeader";
import AdminModal from "../../../components/admin/AdminModal";
import AdminPopup, {
  AdminPopupType,
} from "../../../components/admin/AdminPopup";
import AdminSearchBar from "../../../components/admin/AdminSearchBar";
import AdminStatusBadge from "../../../components/admin/AdminStatusBadge";
import AdminSummaryCard from "../../../components/admin/AdminSummaryCard";

type VehicleType = "PRIVATE" | "COMMERCIAL" | "BOTH";
type VehicleFilter = "ALL" | VehicleType;
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type WorkflowStage =
  | "VEHICLE_INTAKE"
  | "SURVEY"
  | "APPROVAL"
  | "FLOOR"
  | "FINAL_INSPECTION"
  | "READY_FOR_DELIVERY";

type RequirementType = "REQUIRED" | "OPTIONAL";

type DocumentMaster = {
  id: string;
  name: string;
  vehicle_type: VehicleType;
  workflow_stage: WorkflowStage;
  requirement_type: RequirementType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PopupState = {
  visible: boolean;
  type: AdminPopupType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
};

export default function DocumentMasterScreen() {
  const [documents, setDocuments] = useState<DocumentMaster[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");

  const [vehicleFilter, setVehicleFilter] =
    useState<VehicleFilter>("ALL");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ACTIVE");

  const [modalVisible, setModalVisible] = useState(false);

  const [editingDocument, setEditingDocument] =
    useState<DocumentMaster | null>(null);

  const [documentName, setDocumentName] = useState("");

  const [vehicleType, setVehicleType] =
    useState<VehicleType>("PRIVATE");

  const [workflowStage, setWorkflowStage] =
    useState<WorkflowStage>("VEHICLE_INTAKE");

  const [requirementType, setRequirementType] =
    useState<RequirementType>("REQUIRED");

  const [saving, setSaving] = useState(false);

  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  /*
   * ---------------------------------------------------------
   * POPUP
   * ---------------------------------------------------------
   */

  const showPopup = useCallback(
    (
      type: AdminPopupType,
      title: string,
      message: string,
      options?: {
        confirmText?: string;
        cancelText?: string;
        onConfirm?: () => void | Promise<void>;
      }
    ) => {
      setPopup({
        visible: true,
        type,
        title,
        message,
        confirmText:
          options?.confirmText ??
          (type === "confirm" ? "Confirm" : "OK"),
        cancelText:
          options?.cancelText ?? "Cancel",
        onConfirm: options?.onConfirm,
      });
    },
    []
  );

  const closePopup = useCallback(() => {
    setPopup((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  const handlePopupConfirm = async () => {
    const action = popup.onConfirm;

    closePopup();

    if (action) {
      await action();
    }
  };

  /*
   * ---------------------------------------------------------
   * LOAD DOCUMENT MASTER
   * ---------------------------------------------------------
   */

  const loadDocuments = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const { data, error } =
          await supabase.rpc(
            "get_admin_document_master"
          );

        if (error) {
          throw error;
        }

        setDocuments(
          (data ?? []) as DocumentMaster[]
        );
      } catch (error: any) {
        showPopup(
          "error",
          "Unable to Load",
          error?.message ??
            "Document Master could not be loaded. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showPopup]
  );

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  /*
   * ---------------------------------------------------------
   * ANDROID BACK
   * ---------------------------------------------------------
   *
   * Priority:
   * 1. Popup
   * 2. Add/Edit modal
   * 3. Master Data screen
   */

  const closeModal = useCallback(() => {
    if (saving) {
      return;
    }

    setModalVisible(false);
    setDocumentName("");
    setVehicleType("PRIVATE");
    setWorkflowStage("VEHICLE_INTAKE");
    setRequirementType("REQUIRED");
    setEditingDocument(null);
  }, [saving]);

  useEffect(() => {
    const subscription =
      BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (popup.visible) {
            closePopup();
            return true;
          }

          if (modalVisible) {
            if (!saving) {
              closeModal();
            }

            return true;
          }

          router.replace(
            "/(tabs)/master-data"
          );

          return true;
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    popup.visible,
    modalVisible,
    saving,
    closeModal,
    closePopup,
  ]);

  /*
   * ---------------------------------------------------------
   * FILTERING
   * ---------------------------------------------------------
   */

  const filteredDocuments = useMemo(() => {
    const search = searchText
      .trim()
      .toLowerCase();

    return documents.filter((document) => {
      const matchesSearch =
        !search ||
        document.name
          .toLowerCase()
          .includes(search) ||
        document.vehicle_type
          .toLowerCase()
          .includes(search) ||
        document.workflow_stage
          .toLowerCase()
          .includes(search) ||
        document.requirement_type
          .toLowerCase()
          .includes(search);

      const matchesVehicle =
        vehicleFilter === "ALL" ||
        document.vehicle_type === vehicleFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" &&
          document.is_active) ||
        (statusFilter === "INACTIVE" &&
          !document.is_active);

      return (
        matchesSearch &&
        matchesVehicle &&
        matchesStatus
      );
    });
  }, [
    documents,
    searchText,
    vehicleFilter,
    statusFilter,
  ]);

  /*
   * ---------------------------------------------------------
   * SUMMARY
   * ---------------------------------------------------------
   */

  const activeCount = useMemo(
    () =>
      documents.filter(
        (item) => item.is_active
      ).length,
    [documents]
  );

  const inactiveCount = useMemo(
    () =>
      documents.filter(
        (item) => !item.is_active
      ).length,
    [documents]
  );

  const privateCount = useMemo(
    () =>
      documents.filter(
        (item) =>
          item.vehicle_type === "PRIVATE"
      ).length,
    [documents]
  );

  const commercialCount = useMemo(
    () =>
      documents.filter(
        (item) =>
          item.vehicle_type === "COMMERCIAL"
      ).length,
    [documents]
  );

  const bothCount = useMemo(
    () =>
      documents.filter(
        (item) => item.vehicle_type === "BOTH"
      ).length,
    [documents]
  );

  /*
   * ---------------------------------------------------------
   * FORM
   * ---------------------------------------------------------
   */

  const resetForm = () => {
    setDocumentName("");
    setVehicleType("PRIVATE");
    setWorkflowStage("VEHICLE_INTAKE");
    setRequirementType("REQUIRED");
    setEditingDocument(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (
    document: DocumentMaster
  ) => {
    setEditingDocument(document);

    setDocumentName(document.name);

    setVehicleType(document.vehicle_type);
    setWorkflowStage(document.workflow_stage);
    setRequirementType(document.requirement_type);

    setModalVisible(true);
  };

  /*
   * ---------------------------------------------------------
   * SAVE DOCUMENT
   * ---------------------------------------------------------
   */

  const saveDocument = async () => {
    const trimmedName =
      documentName.trim();

    if (!trimmedName) {
      showPopup(
        "warning",
        "Document Name Required",
        "Please enter the document name."
      );
      return;
    }

    if (trimmedName.length > 150) {
      showPopup(
        "warning",
        "Invalid Document Name",
        "Document name cannot exceed 150 characters."
      );
      return;
    }

    const duplicate = documents.find(
      (document) =>
        document.id !==
          editingDocument?.id &&
        document.name
          .trim()
          .toLowerCase() ===
          trimmedName.toLowerCase() &&
        document.vehicle_type ===
          vehicleType &&
        document.workflow_stage ===
          workflowStage
    );

    if (duplicate) {
      showPopup(
        "warning",
        "Duplicate Document",
        `"${trimmedName}" already exists for ${vehicleType.toLowerCase()} vehicles at the ${workflowStage.toLowerCase().replaceAll("_", " ")} stage.`
      );
      return;
    }

    try {
      setSaving(true);

      const { error } =
        await supabase.rpc(
          "save_document_master",
          {
            p_document_id:
              editingDocument?.id ?? null,
            p_name: trimmedName,
            p_vehicle_type: vehicleType,
            p_workflow_stage: workflowStage,
            p_requirement_type: requirementType,
          }
        );

      if (error) {
        throw error;
      }

      setModalVisible(false);
      resetForm();

      await loadDocuments(false);

      showPopup(
        "success",
        editingDocument
          ? "Document Updated"
          : "Document Added",
        editingDocument
          ? "The document requirement was updated successfully."
          : "The new document requirement was added successfully."
      );
    } catch (error: any) {
      showPopup(
        "error",
        "Save Failed",
        error?.message ??
          "The document could not be saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * STATUS
   * ---------------------------------------------------------
   */

  const changeStatus = (
    document: DocumentMaster,
    newStatus: boolean
  ) => {
    showPopup(
      "confirm",
      newStatus
        ? "Activate Document?"
        : "Deactivate Document?",
      newStatus
        ? `"${document.name}" will become available for new ${document.vehicle_type.toLowerCase()} jobs.`
        : `"${document.name}" will no longer be available for new ${document.vehicle_type.toLowerCase()} jobs. Historical records will remain unchanged.`,
      {
        confirmText: newStatus
          ? "Activate"
          : "Deactivate",
        cancelText: "Cancel",

        onConfirm: async () => {
          try {
            const { error } =
              await supabase.rpc(
                "change_document_master_status",
                {
                  p_document_id:
                    document.id,
                  p_is_active:
                    newStatus,
                }
              );

            if (error) {
              throw error;
            }

            await loadDocuments(false);

            showPopup(
              "success",
              "Status Updated",
              `Document ${
                newStatus
                  ? "activated"
                  : "deactivated"
              } successfully.`
            );
          } catch (error: any) {
            showPopup(
              "error",
              "Status Update Failed",
              error?.message ??
                "The document status could not be changed."
            );
          }
        },
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * REFRESH
   * ---------------------------------------------------------
   */

  const handleRefresh = () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    loadDocuments(false);
  };

  /*
   * ---------------------------------------------------------
   * FILTER CLEAR
   * ---------------------------------------------------------
   */

  const clearFilters = () => {
    setSearchText("");
    setVehicleFilter("ALL");
    setStatusFilter("ACTIVE");
  };

  const hasFilters =
    searchText.length > 0 ||
    vehicleFilter !== "ALL" ||
    statusFilter !== "ACTIVE";

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        "top",
        "left",
        "right",
        "bottom",
      ]}
    >
      <View style={styles.screen}>
        <AdminHeader
          title="Document Master"
          subtitle="Manage vehicle document requirements"
          rightAction={
            <Pressable
              onPress={handleRefresh}
              disabled={refreshing}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed &&
                  !refreshing &&
                  styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Refresh documents"
            >
              {refreshing ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              ) : (
                <Text
                  style={styles.refreshIcon}
                >
                  ↻
                </Text>
              )}
            </Pressable>
          }
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary */}
          <View style={styles.summaryGrid}>
            <AdminSummaryCard
              label="Total"
              value={documents.length}
              subtitle="All documents"
              accentColor={colors.primary}
              containerStyle={styles.summaryCard}
            />

            <AdminSummaryCard
              label="Active"
              value={activeCount}
              subtitle="Available"
              accentColor={colors.success}
              containerStyle={styles.summaryCard}
            />

            <AdminSummaryCard
              label="Inactive"
              value={inactiveCount}
              subtitle="Unavailable"
              accentColor={colors.danger}
              containerStyle={styles.summaryCard}
            />

            <AdminSummaryCard
              label="Private / Commercial / Both"
              value={`${privateCount} / ${commercialCount} / ${bothCount}`}
              subtitle="Vehicle types"
              accentColor={colors.info}
              containerStyle={styles.summaryCard}
            />
          </View>

          {/* Add */}
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
            onPress={openAddModal}
          >
            <Text style={styles.addButtonPlus}>
              +
            </Text>

            <Text style={styles.addButtonText}>
              Add Document
            </Text>
          </Pressable>

          {/* Search */}
          <AdminSearchBar
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search documents..."
            containerStyle={styles.searchBar}
          />

          {/* Vehicle Filter */}
          <Text style={styles.filterHeading}>
            Vehicle Type
          </Text>

          <View style={styles.filterRow}>
            <AdminFilterChip
              label="All"
              count={documents.length}
              selected={
                vehicleFilter === "ALL"
              }
              onPress={() =>
                setVehicleFilter("ALL")
              }
            />

            <AdminFilterChip
              label="Private"
              count={privateCount}
              selected={
                vehicleFilter === "PRIVATE"
              }
              onPress={() =>
                setVehicleFilter("PRIVATE")
              }
            />

            <AdminFilterChip
              label="Commercial"
              count={commercialCount}
              selected={
                vehicleFilter ===
                "COMMERCIAL"
              }
              onPress={() =>
                setVehicleFilter(
                  "COMMERCIAL"
                )
              }
            />

            <AdminFilterChip
              label="Both"
              count={bothCount}
              selected={
                vehicleFilter === "BOTH"
              }
              onPress={() =>
                setVehicleFilter("BOTH")
              }
            />
          </View>

          {/* Status Filter */}
          <Text style={styles.filterHeading}>
            Status
          </Text>

          <View style={styles.filterRow}>
            <AdminFilterChip
              label="Active"
              count={activeCount}
              selected={
                statusFilter === "ACTIVE"
              }
              onPress={() =>
                setStatusFilter("ACTIVE")
              }
            />

            <AdminFilterChip
              label="Inactive"
              count={inactiveCount}
              selected={
                statusFilter === "INACTIVE"
              }
              onPress={() =>
                setStatusFilter("INACTIVE")
              }
            />

            <AdminFilterChip
              label="All"
              count={documents.length}
              selected={
                statusFilter === "ALL"
              }
              onPress={() =>
                setStatusFilter("ALL")
              }
            />
          </View>

          {/* Result Header */}
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>
              Document Requirements
            </Text>

            <Text style={styles.resultCount}>
              {filteredDocuments.length} shown
            </Text>
          </View>

          {/* Loading */}
          {loading && (
            <View style={styles.centerState}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />

              <Text style={styles.stateText}>
                Loading Document Master...
              </Text>
            </View>
          )}

          {/* Documents */}
          {!loading &&
            filteredDocuments.map(
              (document) => (
                <View
                  key={document.id}
                  style={styles.documentCard}
                >
                  <View
                    style={styles.documentHeader}
                  >
                    <View
                      style={
                        styles.documentTitleArea
                      }
                    >
                      <Text
                        style={
                          styles.documentName
                        }
                        numberOfLines={2}
                      >
                        {document.name}
                      </Text>

                      <AdminStatusBadge
                        status={
                          document.is_active
                            ? "active"
                            : "inactive"
                        }
                        label={
                          document.is_active
                            ? "Active"
                            : "Inactive"
                        }
                        containerStyle={
                          styles.statusBadge
                        }
                      />
                    </View>

                    <View
                      style={styles.typeBadge}
                    >
                      <Text
                        style={
                          styles.typeBadgeText
                        }
                      >
                        {document.vehicle_type}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.documentMetaRow}>
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeLabel}>
                        STAGE
                      </Text>
                      <Text style={styles.metaBadgeText}>
                        {document.workflow_stage.replaceAll("_", " ")}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.metaBadge,
                        document.requirement_type === "REQUIRED" &&
                          styles.requiredMetaBadge,
                      ]}
                    >
                      <Text style={styles.metaBadgeLabel}>
                        REQUIREMENT
                      </Text>
                      <Text style={styles.metaBadgeText}>
                        {document.requirement_type}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.documentDivider
                    }
                  />

                  <View
                    style={styles.documentActions}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.editButton,
                        pressed &&
                          styles.pressed,
                      ]}
                      onPress={() =>
                        openEditModal(document)
                      }
                    >
                      <Text
                        style={
                          styles.editButtonText
                        }
                      >
                        Edit
                      </Text>
                    </Pressable>

                    {document.is_active ? (
                      <Pressable
                        style={({
                          pressed,
                        }) => [
                          styles.deactivateButton,
                          pressed &&
                            styles.pressed,
                        ]}
                        onPress={() =>
                          changeStatus(
                            document,
                            false
                          )
                        }
                      >
                        <Text
                          style={
                            styles.deactivateButtonText
                          }
                        >
                          Deactivate
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={({
                          pressed,
                        }) => [
                          styles.activateButton,
                          pressed &&
                            styles.pressed,
                        ]}
                        onPress={() =>
                          changeStatus(
                            document,
                            true
                          )
                        }
                      >
                        <Text
                          style={
                            styles.activateButtonText
                          }
                        >
                          Activate
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )
            )}

          {/* Empty State */}
          {!loading &&
            filteredDocuments.length ===
              0 && (
              <AdminEmptyState
                title={
                  hasFilters
                    ? "No matching documents"
                    : "No documents found"
                }
                message={
                  hasFilters
                    ? "Try changing your search or filters."
                    : "There are no document requirements available."
                }
                actionLabel={
                  hasFilters
                    ? "Clear Filters"
                    : undefined
                }
                onAction={
                  hasFilters
                    ? clearFilters
                    : undefined
                }
                containerStyle={
                  styles.emptyState
                }
              />
            )}

          {/* Information */}
          <View style={styles.noteCard}>
            <View style={styles.noteIcon}>
              <Text
                style={styles.noteIconText}
              >
                i
              </Text>
            </View>

            <Text style={styles.noteText}>
              Deactivated documents remain
              available for historical records but
              cannot be selected for new jobs.
            </Text>
          </View>

          <Text style={styles.footer}>
            PAGARIYA AUTO • CEO ADMIN
          </Text>
        </ScrollView>
      </View>

      {/* Add / Edit Modal */}
      <AdminModal
        visible={modalVisible}
        title={
          editingDocument
            ? "Edit Document"
            : "Add Document"
        }
        subtitle={
          editingDocument
            ? "Update the document requirement"
            : "Create a new document requirement"
        }
        onClose={closeModal}
        onSave={saveDocument}
        saveText={
          editingDocument
            ? "Update Document"
            : "Add Document"
        }
        cancelText="Cancel"
        saving={saving}
        saveDisabled={!documentName.trim()}
      >
        {/* Document Name */}
        <Text style={styles.inputLabel}>
          Document Name
          <Text style={styles.required}>
            {" "}
            *
          </Text>
        </Text>

        <View>
          <TextInput
            value={documentName}
            onChangeText={setDocumentName}
            placeholder="e.g. Aadhaar Card"
            placeholderTextColor={
              colors.textLight
            }
            style={styles.input}
            maxLength={150}
            autoCapitalize="words"
            editable={!saving}
          />

          <View
            style={styles.characterRow}
          >
            <Text style={styles.inputHint}>
              Enter the document requirement
              name.
            </Text>

            <Text
              style={styles.characterCount}
            >
              {documentName.length}/150
            </Text>
          </View>
        </View>

        {/* Vehicle Type */}
        <Text style={styles.inputLabel}>
          Vehicle Type
          <Text style={styles.required}>
            {" "}
            *
          </Text>
        </Text>

        <View style={styles.vehicleTypeRow}>
          {(["PRIVATE", "COMMERCIAL", "BOTH"] as VehicleType[]).map(
            (type) => (
              <Pressable
                key={type}
                style={[
                  styles.vehicleTypeButton,
                  vehicleType === type &&
                    styles.vehicleTypeButtonActive,
                ]}
                onPress={() => setVehicleType(type)}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.vehicleTypeButtonText,
                    vehicleType === type &&
                      styles.vehicleTypeButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {/* Workflow Stage */}
        <Text style={styles.inputLabel}>
          Workflow Stage
          <Text style={styles.required}>
            {" "}
            *
          </Text>
        </Text>

        <View style={styles.optionWrap}>
          {(
            [
              "VEHICLE_INTAKE",
              "SURVEY",
              "APPROVAL",
              "FLOOR",
              "FINAL_INSPECTION",
              "READY_FOR_DELIVERY",
            ] as WorkflowStage[]
          ).map((stage) => (
            <Pressable
              key={stage}
              style={[
                styles.optionButton,
                workflowStage === stage &&
                  styles.optionButtonActive,
              ]}
              onPress={() => setWorkflowStage(stage)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  workflowStage === stage &&
                    styles.optionButtonTextActive,
                ]}
              >
                {stage.replaceAll("_", " ")}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Requirement Type */}
        <Text style={styles.inputLabel}>
          Requirement Type
          <Text style={styles.required}>
            {" "}
            *
          </Text>
        </Text>

        <View style={styles.vehicleTypeRow}>
          {(["REQUIRED", "OPTIONAL"] as RequirementType[]).map(
            (type) => (
              <Pressable
                key={type}
                style={[
                  styles.vehicleTypeButton,
                  requirementType === type &&
                    styles.vehicleTypeButtonActive,
                ]}
                onPress={() =>
                  setRequirementType(type)
                }
                disabled={saving}
              >
                <Text
                  style={[
                    styles.vehicleTypeButtonText,
                    requirementType === type &&
                      styles.vehicleTypeButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {/* Existing Status */}
        {editingDocument && (
          <View style={styles.editInfo}>
            <Text style={styles.editInfoLabel}>
              Current Status
            </Text>

            <AdminStatusBadge
              status={
                editingDocument.is_active
                  ? "active"
                  : "inactive"
              }
              label={
                editingDocument.is_active
                  ? "Active"
                  : "Inactive"
              }
            />
          </View>
        )}
      </AdminModal>

      {/* Custom Popup */}
      <AdminPopup
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        confirmText={popup.confirmText}
        cancelText={popup.cancelText}
        onConfirm={
          popup.type === "confirm"
            ? handlePopupConfirm
            : closePopup
        }
        onCancel={closePopup}
        onClose={closePopup}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  refreshIcon: {
    fontSize: 25,
    color: colors.primary,
    lineHeight: 28,
  },

  pressed: {
    opacity: 0.75,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  summaryCard: {
    width: "48%",
    flexGrow: 1,
    minHeight: 116,
  },

  addButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  addButtonPlus: {
    fontSize: 23,
    lineHeight: 24,
    color: colors.white,
    fontWeight: "400",
  },

  addButtonText: {
    ...typography.button,
    color: colors.white,
  },

  searchBar: {
    marginBottom: spacing.md,
  },

  filterHeading: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },

  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  resultTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  resultCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  centerState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },

  stateText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  documentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  documentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  documentTitleArea: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  documentName: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
  },

  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },

  documentMetaRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },

  metaBadge: {
    flexGrow: 1,
    minWidth: "46%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },

  requiredMetaBadge: {
    borderColor: colors.success,
    backgroundColor: colors.successLight,
  },

  metaBadgeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.textLight,
    marginBottom: 3,
  },

  metaBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },

  statusBadge: {
    marginTop: 0,
  },

  documentDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },

  documentActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  editButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  editButtonText: {
    ...typography.button,
    color: colors.text,
  },

  deactivateButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
  },

  deactivateButtonText: {
    ...typography.button,
    color: colors.danger,
  },

  activateButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
  },

  activateButtonText: {
    ...typography.button,
    color: colors.success,
  },

  emptyState: {
    marginTop: spacing.sm,
  },

  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.infoLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },

  noteIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.round,
    backgroundColor: colors.info,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },

  noteIconText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },

  noteText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },

  footer: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: "center",
    marginTop: spacing.xxl,
  },

  inputLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  required: {
    color: colors.danger,
  },

  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
  },

  characterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  inputHint: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },

  characterCount: {
    ...typography.caption,
    color: colors.textLight,
    marginLeft: spacing.sm,
  },

  vehicleTypeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  vehicleTypeButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  vehicleTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  vehicleTypeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  vehicleTypeButtonTextActive: {
    color: colors.white,
  },

  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  optionButton: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  optionButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  optionButtonTextActive: {
    color: colors.white,
  },

  editInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  editInfoLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
});