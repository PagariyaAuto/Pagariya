import * as ImagePicker from "expo-image-picker";
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

import { supabase } from "../../../lib/supabase";

import PhotoGallery from "../../../components/PhotoGallery";
import PhotoUploadModal from "../../../components/PhotoUploadModal";
import PhotoViewer from "../../../components/PhotoViewer";

import {
    colors,
    radius,
    spacing,
    typography,
} from "../../theme";

type VehicleModel = {
  id: string;
  name: string;
  arena_nexa: string;
};

type PhotoItem = {
  id: string;
  uri: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
  progress?: number;
};

export default function GateInScreen() {
  const [vehicleNo, setVehicleNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");

  const [vehicleType, setVehicleType] = useState<
    "PRIVATE" | "COMMERCIAL" | ""
  >("");

  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([]);
  const [selectedModel, setSelectedModel] =
    useState<VehicleModel | null>(null);

  const [showModelModal, setShowModelModal] = useState(false);

  // Photo system
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [showPhotoUploadModal, setShowPhotoUploadModal] =
    useState(false);

  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [loadingModels, setLoadingModels] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  useEffect(() => {
    loadVehicleModels();
  }, []);

  async function loadVehicleModels() {
    try {
      const { data, error } = await supabase
        .from("vehicle_models")
        .select("id, name, arena_nexa")
        .eq("is_active", true)
        .order("name");

      if (error) {
        throw error;
      }

      setVehicleModels(data || []);
    } catch (error: any) {
      showModal(
        "Error",
        error?.message || "Unable to load vehicle models.",
        false
      );
    } finally {
      setLoadingModels(false);
    }
  }

  // =========================================================
  // PHOTO SYSTEM
  // =========================================================

  async function takePhoto() {
    setShowPhotoUploadModal(false);

    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      showModal(
        "Camera Permission",
        "Camera permission is required to take the Gate In vehicle photo.",
        false
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const selected = result.assets[0];

    const newPhoto: PhotoItem = {
      id: `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}`,
      uri: selected.uri,
      status: "pending",
    };

    // Gate In allows exactly one photo.
    setPhotos([newPhoto]);
  }

  async function chooseFromGallery() {
    setShowPhotoUploadModal(false);

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showModal(
        "Gallery Permission",
        "Gallery permission is required to choose a vehicle photo.",
        false
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const selected = result.assets[0];

    const newPhoto: PhotoItem = {
      id: `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}`,
      uri: selected.uri,
      status: "pending",
    };

    // Gate In allows exactly one photo.
    setPhotos([newPhoto]);
  }

  function removePhoto(id: string) {
    if (submitting) {
      return;
    }

    setPhotos((current) =>
      current.filter((photo) => photo.id !== id)
    );
  }

  function viewPhoto(photo: PhotoItem) {
    const index = photos.findIndex(
      (item) => item.id === photo.id
    );

    if (index === -1) {
      return;
    }

    setViewerIndex(index);
    setShowPhotoViewer(true);
  }

  // =========================================================
  // GENERAL MODAL
  // =========================================================

  function showModal(
    title: string,
    message: string,
    success: boolean
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setModalSuccess(success);
    setModalVisible(true);
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  function validateForm() {
    if (!vehicleNo.trim()) {
      showModal(
        "Required",
        "Please enter the vehicle number.",
        false
      );
      return false;
    }

    if (!customerName.trim()) {
      showModal(
        "Required",
        "Please enter the customer name.",
        false
      );
      return false;
    }

    if (!/^[6-9]\d{9}$/.test(customerMobile.trim())) {
      showModal(
        "Invalid Mobile",
        "Please enter a valid 10-digit mobile number.",
        false
      );
      return false;
    }

    if (!vehicleType) {
      showModal(
        "Required",
        "Please select Private or Commercial.",
        false
      );
      return false;
    }

    if (!selectedModel) {
      showModal(
        "Required",
        "Please select the vehicle model.",
        false
      );
      return false;
    }

    if (photos.length !== 1) {
      showModal(
        "Photo Required",
        "Please add exactly one vehicle photo before Gate In.",
        false
      );
      return false;
    }

    return true;
  }

  // =========================================================
  // UPLOAD PHOTO
  // =========================================================

  async function uploadPhoto(
    vehicleId: string,
    eventId: string,
    photoUri: string
  ) {
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}.jpg`;

    const storagePath =
      `vehicles/${vehicleId}/GATE_IN/${fileName}`;

    // Show uploading state
    setPhotos((current) =>
      current.map((photo) => ({
        ...photo,
        status: "uploading",
        progress: 10,
      }))
    );

    const response = await fetch(photoUri);
    const arrayBuffer = await response.arrayBuffer();

    setPhotos((current) =>
      current.map((photo) => ({
        ...photo,
        status: "uploading",
        progress: 50,
      }))
    );

    const { error: uploadError } = await supabase.storage
      .from("vehicle-photos")
      .upload(storagePath, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      setPhotos((current) =>
        current.map((photo) => ({
          ...photo,
          status: "failed",
          progress: 0,
        }))
      );

      throw uploadError;
    }

    setPhotos((current) =>
      current.map((photo) => ({
        ...photo,
        status: "uploading",
        progress: 90,
      }))
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: photoRecordError } = await supabase
      .from("vehicle_photos")
      .insert({
        vehicle_id: vehicleId,
        event_id: eventId,
        photo_type: "GATE_IN",
        storage_path: storagePath,
        uploaded_by: user?.id ?? null,
      });

    if (photoRecordError) {
      setPhotos((current) =>
        current.map((photo) => ({
          ...photo,
          status: "failed",
          progress: 0,
        }))
      );

      throw photoRecordError;
    }

    // Upload completed
    setPhotos((current) =>
      current.map((photo) => ({
        ...photo,
        status: "uploaded",
        progress: 100,
      }))
    );
  }

  // =========================================================
  // COMPLETE GATE IN
  // =========================================================

  async function handleGateIn() {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      /*
       * Step 1:
       * Create vehicle and Gate In event.
       */
      const { data, error } = await supabase.rpc(
        "gate_in_vehicle",
        {
          p_vehicle_no: vehicleNo.trim(),
          p_customer_name: customerName.trim(),
          p_customer_mobile: customerMobile.trim(),
          p_vehicle_model_id: selectedModel!.id,
          p_vehicle_type: vehicleType,
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.vehicle_id || !data?.event_id) {
        throw new Error(
          "Gate In was created but vehicle/event information was not returned."
        );
      }

      /*
       * Step 2:
       * Upload the selected photo.
       */
      await uploadPhoto(
        data.vehicle_id,
        data.event_id,
        photos[0].uri
      );

      /*
       * Step 3:
       * Everything completed.
       */
      showModal(
        "Gate In Complete",
        "Vehicle has been successfully checked in.",
        true
      );
    } catch (error: any) {
      showModal(
        "Gate In Failed",
        error?.message ||
          "Something went wrong while completing Gate In.",
        false
      );
    } finally {
      setSubmitting(false);
    }
  }

  function closeModal() {
    setModalVisible(false);

    if (modalSuccess) {
      router.replace("/(tabs)/vehicles");
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Gate In</Text>

          <Text style={styles.subtitle}>
            Register vehicle entry
          </Text>
        </View>

        {/* Vehicle Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Vehicle Details
          </Text>

          <Text style={styles.label}>Vehicle Number</Text>

          <TextInput
            value={vehicleNo}
            onChangeText={setVehicleNo}
            placeholder="Enter vehicle number"
            placeholderTextColor={colors.textLight}
            autoCapitalize="characters"
            style={styles.input}
          />

          <Text style={styles.label}>Customer Name</Text>

          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Enter customer name"
            placeholderTextColor={colors.textLight}
            style={styles.input}
          />

          <Text style={styles.label}>Mobile Number</Text>

          <TextInput
            value={customerMobile}
            onChangeText={(text) =>
              setCustomerMobile(
                text.replace(/\D/g, "").slice(0, 10)
              )
            }
            placeholder="10-digit mobile number"
            placeholderTextColor={colors.textLight}
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.input}
          />

          {/* Vehicle Type */}
          <Text style={styles.label}>Vehicle Type</Text>

          <View style={styles.optionRow}>
            <Pressable
              style={[
                styles.option,
                vehicleType === "PRIVATE" &&
                  styles.optionSelected,
              ]}
              onPress={() => setVehicleType("PRIVATE")}
            >
              <Text
                style={[
                  styles.optionText,
                  vehicleType === "PRIVATE" &&
                    styles.optionTextSelected,
                ]}
              >
                Private
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.option,
                vehicleType === "COMMERCIAL" &&
                  styles.optionSelected,
              ]}
              onPress={() => setVehicleType("COMMERCIAL")}
            >
              <Text
                style={[
                  styles.optionText,
                  vehicleType === "COMMERCIAL" &&
                    styles.optionTextSelected,
                ]}
              >
                Commercial
              </Text>
            </Pressable>
          </View>

          {/* Vehicle Model */}
          <Text style={styles.label}>Vehicle Model</Text>

          <Pressable
            style={styles.dropdown}
            onPress={() => setShowModelModal(true)}
          >
            <Text
              style={
                selectedModel
                  ? styles.dropdownText
                  : styles.dropdownPlaceholder
              }
            >
              {selectedModel
                ? selectedModel.name
                : "Select vehicle model"}
            </Text>

            <Text style={styles.dropdownArrow}>⌄</Text>
          </Pressable>

          {/* Arena / Nexa */}
          {selectedModel && (
            <View style={styles.brandBox}>
              <Text style={styles.brandLabel}>
                Arena / Nexa
              </Text>

              <Text style={styles.brandValue}>
                {selectedModel.arena_nexa}
              </Text>
            </View>
          )}
        </View>

        {/* Modern Photo Gallery */}
        <View style={styles.card}>
          <PhotoGallery
            photos={photos}
            maxPhotos={1}
            onAddPhoto={() =>
              setShowPhotoUploadModal(true)
            }
            onRemovePhoto={removePhoto}
            onViewPhoto={viewPhoto}
          />

          <View style={styles.requiredRow}>
            <Text style={styles.requiredText}>
              Exactly 1 photo is required for Gate In
            </Text>
          </View>
        </View>

        {/* Submit */}
        <Pressable
          style={[
            styles.submitButton,
            submitting && styles.submitDisabled,
          ]}
          onPress={handleGateIn}
          disabled={submitting}
        >
          {submitting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator
                size="small"
                color={colors.white}
              />

              <Text style={styles.submitText}>
                Processing...
              </Text>
            </View>
          ) : (
            <Text style={styles.submitText}>
              Complete Gate In
            </Text>
          )}
        </Pressable>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* =====================================================
          PHOTO UPLOAD MODAL
      ===================================================== */}
      <PhotoUploadModal
        visible={showPhotoUploadModal}
        onClose={() => setShowPhotoUploadModal(false)}
        onTakePhoto={takePhoto}
        onChooseFromGallery={chooseFromGallery}
      />

      {/* =====================================================
          PHOTO VIEWER
      ===================================================== */}
      <PhotoViewer
        visible={showPhotoViewer}
        photos={photos}
        initialIndex={viewerIndex}
        onClose={() => setShowPhotoViewer(false)}
      />

      {/* =====================================================
          VEHICLE MODEL MODAL
      ===================================================== */}
      <Modal
        visible={showModelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modelModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select Vehicle Model
              </Text>

              <Pressable
                onPress={() => setShowModelModal(false)}
              >
                <Text style={styles.closeButton}>×</Text>
              </Pressable>
            </View>

            {loadingModels ? (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.modalLoader}
              />
            ) : vehicleModels.length === 0 ? (
              <Text style={styles.emptyText}>
                No active vehicle models found.
              </Text>
            ) : (
              <ScrollView>
                {vehicleModels.map((model) => (
                  <Pressable
                    key={model.id}
                    style={styles.modelItem}
                    onPress={() => {
                      setSelectedModel(model);
                      setShowModelModal(false);
                    }}
                  >
                    <View>
                      <Text style={styles.modelName}>
                        {model.name}
                      </Text>

                      <Text style={styles.modelBrand}>
                        {model.arena_nexa}
                      </Text>
                    </View>

                    {selectedModel?.id === model.id && (
                      <Text style={styles.checkmark}>
                        ✓
                      </Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* =====================================================
          GENERAL MESSAGE MODAL
      ===================================================== */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.messageModal}>
            <View
              style={[
                styles.modalIcon,
                modalSuccess
                  ? styles.successIcon
                  : styles.errorIcon,
              ]}
            >
              <Text style={styles.modalIconText}>
                {modalSuccess ? "✓" : "!"}
              </Text>
            </View>

            <Text style={styles.messageTitle}>
              {modalTitle}
            </Text>

            <Text style={styles.messageText}>
              {modalMessage}
            </Text>

            <Pressable
              style={styles.modalButton}
              onPress={closeModal}
            >
              <Text style={styles.modalButtonText}>
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
  },

  header: {
    marginBottom: spacing.lg,
  },

  title: {
    fontSize: typography.title.fontSize,
    fontWeight: "700",
    color: colors.text,
  },

  subtitle: {
    marginTop: spacing.xs,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionTitle: {
    fontSize: typography.subheading.fontSize,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },

  label: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "500",
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
    backgroundColor: colors.surface,
  },

  optionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  option: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  optionText: {
    fontSize: typography.bodyMedium.fontSize,
    color: colors.textSecondary,
  },

  optionTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },

  dropdown: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
  },

  dropdownPlaceholder: {
    fontSize: typography.body.fontSize,
    color: colors.textLight,
  },

  dropdownArrow: {
    fontSize: 22,
    color: colors.textSecondary,
  },

  brandBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brandLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
  },

  brandValue: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "600",
    color: colors.text,
  },

  requiredRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },

  requiredText: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
  },

  submitButton: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  submitDisabled: {
    opacity: 0.7,
  },

  submitText: {
    fontSize: typography.button.fontSize,
    fontWeight: "600",
    color: colors.white,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  bottomSpace: {
    height: spacing.xxl,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },

  modelModal: {
    width: "100%",
    maxHeight: "75%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  messageModal: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  modalTitle: {
    fontSize: typography.subheading.fontSize,
    fontWeight: "600",
    color: colors.text,
  },

  closeButton: {
    fontSize: 30,
    lineHeight: 30,
    color: colors.textSecondary,
  },

  modalLoader: {
    marginVertical: spacing.xl,
  },

  emptyText: {
    textAlign: "center",
    color: colors.textSecondary,
    paddingVertical: spacing.xl,
  },

  modelItem: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },

  modelName: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "600",
    color: colors.text,
  },

  modelBrand: {
    marginTop: 2,
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
  },

  checkmark: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },

  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  successIcon: {
    backgroundColor: colors.successLight,
  },

  errorIcon: {
    backgroundColor: colors.dangerLight,
  },

  modalIconText: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },

  messageTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },

  messageText: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  modalButton: {
    width: "100%",
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },

  modalButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: "600",
    color: colors.white,
  },
});