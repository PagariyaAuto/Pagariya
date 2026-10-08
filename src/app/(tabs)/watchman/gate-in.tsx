import { Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import Ionicons from "@expo/vector-icons/Ionicons";
import BrandPill from "../../../components/navigation/BrandPill";
import { normalizeVehicleNumber, getVehicleNumberError } from "../../../lib/vehicle-registration";
import BackButton from "../../../components/navigation/BackButton";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import { SafeAreaView } from "react-native-safe-area-context";

import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Image, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import { supabase } from "../../../../lib/supabase";

import { colors } from "../../../theme";

type PhotoItem = {
  id: string;
  uri: string;
  storagePath?: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
  progress?: number;
};

type PendingGateIn = {
  vehicleId: string;
  visitId: string;
  gateEntryId: string;
  photoId: string;
  storagePath: string;
};

export default function GateInScreen() {
  const handleNavigationBack = () => {
    if (submittingRef.current) return;
    returnToRoute("/(tabs)/watchman");
  };
  useHardwareBack(handleNavigationBack);

  const submittingRef = useRef(false);
  const vehicleInputRef = useRef<TextInput>(null);
  const [vehicleError, setVehicleError] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [pendingGateIn, setPendingGateIn] =
    useState<PendingGateIn | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const photo = photos[0] ?? null;

  const photoUploaded =
    photo?.status === "uploaded";

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
  // CAMERA
  // =========================================================

  async function takePhoto() {
    if (submittingRef.current || pendingGateIn) return;

    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        showModal(
          "Camera Permission",
          "Please allow camera access to take the vehicle photo.",
          false
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 0.8,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      const selected = result.assets[0];

      setPhotos([
        {
          id: `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 10)}`,
          uri: selected.uri,
          status: "pending",
        },
      ]);
    } catch (error: any) {
      showModal(
        "Camera Error",
        error?.message ||
          "Unable to open the camera.",
        false
      );
    }
  }

  function removePhoto() {
    if (submitting || pendingGateIn) return;

    setPhotos([]);
  }

  // =========================================================
  // CREATE STORAGE PATH
  // =========================================================

  function createStoragePath() {
    const fileName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}.jpg`;

    return `gate-in-pending/${fileName}`;
  }

  // =========================================================
  // CHECK WHETHER AN OBJECT ALREADY EXISTS
  // =========================================================

  async function verifyUploadedPhoto(
    storagePath: string
  ) {
    /*
     * We intentionally do NOT use .download() here.
     *
     * If the first upload reached Supabase but the client
     * received a timeout/network error, a retry with
     * upsert:false can return a duplicate-object error.
     *
     * Instead, we check the Storage folder metadata.
     * This confirms whether the object exists without
     * downloading the image itself.
     */

    const parts = storagePath.split("/");

    const fileName =
      parts.pop() || "";

    const folderPath =
      parts.join("/");

    if (!fileName) {
      return false;
    }

    const {
      data,
      error,
    } = await supabase.storage
      .from("vehicle-photos")
      .list(folderPath, {
        limit: 100,
        search: fileName,
      });

    if (error) {
      return false;
    }

    return (
      data?.some(
        (item) => item.name === fileName
      ) ?? false
    );
  }

  // =========================================================
  // UPLOAD PHOTO
  // =========================================================

  async function uploadPhoto(
    photoUri: string,
    storagePath: string
  ) {
    setPhotos((current) =>
      current.map((item) => ({
        ...item,
        status: "uploading",
        storagePath,
        progress: 10,
      }))
    );

    const response = await fetch(photoUri);

    if (!response.ok) {
      throw new Error(
        "Unable to read the captured vehicle photo."
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    setPhotos((current) =>
      current.map((item) => ({
        ...item,
        status: "uploading",
        storagePath,
        progress: 50,
      }))
    );

    const {
      error: uploadError,
    } = await supabase.storage
      .from("vehicle-photos")
      .upload(
        storagePath,
        arrayBuffer,
        {
          contentType: "image/jpeg",
          upsert: false,
        }
      );

    if (uploadError) {
      const errorMessage =
        uploadError.message || "";

      const errorStatus =
        uploadError.statusCode || "";

      const isDuplicate =
        errorStatus === "409" ||
        /already exists|duplicate|resource already exists|key already exists/i.test(
          errorMessage
        );

      if (isDuplicate) {
        const alreadyUploaded =
          await verifyUploadedPhoto(
            storagePath
          );

        if (alreadyUploaded) {
          setPhotos((current) =>
            current.map((item) => ({
              ...item,
              status: "uploaded",
              storagePath,
              progress: 100,
            }))
          );

          return;
        }
      }

      setPhotos((current) =>
        current.map((item) => ({
          ...item,
          status: "failed",
          storagePath,
          progress: 0,
        }))
      );

      throw uploadError;
    }

    setPhotos((current) =>
      current.map((item) => ({
        ...item,
        status: "uploaded",
        storagePath,
        progress: 100,
      }))
    );
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  function validateForm() {
    const registrationError = getVehicleNumberError(vehicleNo);
    if (registrationError) {
      setVehicleError(registrationError);
      showModal("Check vehicle number", registrationError, false);
      return false;
    }
    setVehicleError("");

    if (!photo) {
      showModal(
        "Vehicle Photo Required",
        "Please take one clear photo of the vehicle.",
        false
      );

      return false;
    }

    return true;
  }

  // =========================================================
  // COMPLETE GATE IN
  // =========================================================

  async function handleGateIn() {
    if (
      submittingRef.current ||
      !validateForm()
    ) {
      return;
    }

    Keyboard.dismiss();

    submittingRef.current = true;
    setSubmitting(true);
    let recordedGateIn = pendingGateIn;

    try {
      /*
       * =======================================================
       * RETRY MODE
       * =======================================================
       */

      if (pendingGateIn) {
        await uploadPhoto(
          photo!.uri,
          pendingGateIn.storagePath
        );

        showModal(
          "Gate In Complete",
          "Vehicle entry and photo saved. An Advisor can now accept this vehicle for intake.",
          true
        );

        return;
      }

      /*
       * =======================================================
       * NEW GATE-IN
       * =======================================================
       */

      const storagePath =
        createStoragePath();

      const {
        data,
        error,
      } = await supabase.rpc(
        "new_workflow_gate_in",
        {
          p_vehicle_no:
            normalizeVehicleNumber(vehicleNo),

          p_gate_in_photo_path:
            storagePath,

          p_remarks:
            null,
        }
      );

      if (error) {
        throw error;
      }

      if (
        !data?.vehicle_id ||
        !data?.visit_id ||
        !data?.gate_entry_id ||
        !data?.gate_in_photo_id
      ) {
        throw new Error(
          "Gate In did not return the required workflow information."
        );
      }

      recordedGateIn = {
        vehicleId: data.vehicle_id,
        visitId: data.visit_id,
        gateEntryId: data.gate_entry_id,
        photoId: data.gate_in_photo_id,
        storagePath,
      };
      setPendingGateIn(recordedGateIn);

      await uploadPhoto(
        photo!.uri,
        storagePath
      );

      showModal(
        "Gate In Complete",
        "Vehicle entry and photo saved. An Advisor can now accept this vehicle for intake.",
        true
      );
    } catch (error: any) {
      console.error("Gate In failed:", error);
      const detail = String(error?.message || "");
      const message = /already|active visit|open visit/i.test(detail)
        ? "This vehicle may already have an open entry. Check the Dashboard before trying again."
        : /permission|not authorized|active.*profile|authentication/i.test(detail)
          ? "Your account could not complete Gate In. Please sign in again or contact CEO Admin."
          : "We couldn’t confirm that Gate In was completed. Check the Dashboard before trying again.";

      if (recordedGateIn) {
        showModal(
          "Photo Upload Failed",
          "Gate In is recorded, but the photo could not be saved. Tap Retry Photo Upload to finish this entry.",
          false
        );
      } else {
        showModal(
          "Gate In Failed",
          message,
          false
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // =========================================================
  // SUCCESS / NEXT VEHICLE
  // =========================================================

  function closeModal() {
    setModalVisible(false);

    if (modalSuccess) {
      setVehicleNo("");
      setVehicleError("");
      setPhotos([]);
      setPendingGateIn(null);
    } else if (vehicleError) {
      requestAnimationFrame(() => vehicleInputRef.current?.focus());
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "right", "bottom", "left"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BackButton onPress={handleNavigationBack} disabled={submitting} />
          <BrandPill />
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SECURITY · VEHICLE ENTRY</Text>
          <Text style={styles.title}>Vehicle Gate In</Text>
          <Text style={styles.subtitle}>Enter the registration number and take a clear photo of the vehicle.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>01</Text></View>
            <View style={styles.grow}><Text style={styles.sectionTitle}>Vehicle registration</Text><Text style={styles.sectionSubtitle}>Use the number shown on the number plate.</Text></View>
          </View>
          <Text style={styles.label}>Registration number <Text style={styles.required}>*</Text></Text>
          <TextInput
            ref={vehicleInputRef}
            accessibilityLabel="Vehicle registration number"
            aria-invalid={!!vehicleError}
            value={vehicleNo}
            onChangeText={value => { setVehicleNo(normalizeVehicleNumber(value)); setVehicleError(""); }}
            onBlur={() => { if (vehicleNo) setVehicleError(getVehicleNumberError(vehicleNo) || ""); }}
            placeholder="MH12AB1234"
            placeholderTextColor={colors.textLight}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={[styles.input, !!vehicleError && styles.inputError]}
            editable={!submitting && !pendingGateIn}
          />
          {vehicleError ? <Text accessibilityRole="alert" style={styles.errorText}>{vehicleError}</Text> : <Text style={styles.helperText}>State registration or BH series · e.g. MH12AB1234 or 26BH1234AA</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>02</Text></View>
            <View style={styles.grow}><Text style={styles.sectionTitle}>Vehicle photo</Text><Text style={styles.sectionSubtitle}>Include the registration plate in the photo.</Text></View>
            <Text style={styles.required}>*</Text>
          </View>
          {photo ? (
            <View style={styles.photoPreviewContainer}>
              <Pressable onPress={() => setShowPhotoViewer(true)} disabled={submitting} accessibilityRole="button" accessibilityLabel="View vehicle photo">
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
                <View style={styles.previewBadge}><Ionicons name="expand-outline" size={15} color={colors.text} /><Text style={styles.previewBadgeText}>View photo</Text></View>
              </Pressable>
              <View style={styles.photoStatusRow}>
                {submitting ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={photo.status === "failed" ? "alert-circle-outline" : "camera-outline"} size={19} color={photo.status === "failed" ? colors.primary : colors.textSecondary} />}
                <Text style={styles.photoStatusText}>{photoUploaded ? "Photo saved" : photo.status === "uploading" ? "Saving photo…" : photo.status === "failed" ? "Photo not saved. Please retry." : "Photo captured"}</Text>
              </View>
              {!submitting && !pendingGateIn && <View style={styles.photoActions}>
                <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={takePhoto}><Ionicons name="camera-outline" size={18} color={colors.primary} /><Text style={styles.secondaryButtonText}>Retake photo</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Remove vehicle photo" style={styles.removeButton} onPress={removePhoto}><Ionicons name="trash-outline" size={18} color={colors.textSecondary} /><Text style={styles.removeButtonText}>Remove</Text></Pressable>
              </View>}
            </View>
          ) : (
            <Pressable style={({ pressed }) => [styles.cameraCapture, pressed && styles.pressed]} onPress={takePhoto} disabled={submitting} accessibilityRole="button" accessibilityLabel="Take vehicle photo">
              <View style={styles.cameraIconCircle}><Ionicons name="camera-outline" size={30} color={colors.primary} /></View>
              <Text style={styles.cameraTitle}>Take vehicle photo</Text>
              <Text style={styles.cameraSubtitle}>One clear photo is required.</Text>
              <View style={styles.cameraAction}><Text style={styles.cameraActionText}>Open Camera</Text></View>
            </Pressable>
          )}
        </View>

        {!!pendingGateIn && <View style={styles.retryNotice}><Ionicons name="information-circle-outline" size={22} color={colors.primary} /><Text style={styles.retryText}>Gate In is recorded. Retry the photo upload to finish this entry.</Text></View>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting, busy: submitting }} style={({ pressed }) => [styles.actionButton, submitting && styles.disabled, pressed && !submitting && styles.pressed]} onPress={handleGateIn} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name={pendingGateIn ? "cloud-upload-outline" : "enter-outline"} size={21} color={colors.white} />}
          <Text style={styles.submitText}>{submitting ? pendingGateIn ? "Saving photo…" : "Recording Gate In…" : pendingGateIn ? "Retry Photo Upload" : "Complete Gate In"}</Text>
        </Pressable>
        <Text style={styles.footer}>After Gate In, an Advisor can accept the vehicle for intake.</Text>
      </ScrollView>

      <Modal visible={showPhotoViewer} transparent animationType="fade" onRequestClose={() => setShowPhotoViewer(false)}>
        <SafeAreaView style={styles.photoViewerOverlay} edges={["top", "right", "bottom", "left"]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photo viewer" style={styles.viewerClose} onPress={() => setShowPhotoViewer(false)}><Ionicons name="close" size={25} color={colors.white} /><Text style={styles.viewerCloseText}>Close</Text></Pressable>
          {photo && <Image source={{ uri: photo.uri }} style={styles.photoViewerImage} resizeMode="contain" />}
        </SafeAreaView>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <SafeAreaView style={styles.modalOverlay} edges={["top", "right", "bottom", "left"]}>
          <View style={styles.messageModal}>
            <View style={[styles.modalIcon, modalSuccess ? styles.successIcon : styles.errorIcon]}><Ionicons name={modalSuccess ? "checkmark" : "alert-circle-outline"} size={27} color={modalSuccess ? "#217A50" : colors.primary} /></View>
            {modalSuccess && <Text style={styles.modalVehicle}>{vehicleNo}</Text>}
            <Text style={styles.messageTitle}>{modalTitle}</Text>
            <Text style={styles.messageText}>{modalMessage}</Text>
            <Pressable accessibilityRole="button" style={styles.modalButton} onPress={closeModal}><Text style={styles.modalButtonText}>{modalSuccess ? "Next Vehicle" : "OK"}</Text></Pressable>
            {modalSuccess && <Pressable accessibilityRole="button" style={styles.viewVehiclesButton} onPress={() => { setModalVisible(false); router.replace("/(tabs)/watchman"); }}><Text style={styles.viewVehiclesButtonText}>Dashboard</Text></Pressable>}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 36, width: "100%", maxWidth: 820, alignSelf: "center" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44, marginBottom: 12 },
  hero: { backgroundColor: colors.primary, borderRadius: 20, padding: 22, marginBottom: 20, gap: 9 },
  eyebrow: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: colors.white, fontSize: 27, fontWeight: "800" },
  subtitle: { color: colors.white, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  sectionNumber: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  sectionNumberText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  grow: { flex: 1 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  sectionSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 9 },
  required: { color: colors.primary, fontWeight: "700" },
  input: { minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.background, paddingHorizontal: 15, paddingVertical: 12, color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: 1.2 },
  inputError: { borderColor: colors.primary, borderWidth: 2 },
  helperText: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 10 },
  errorText: { color: colors.primaryDark, fontSize: 13, lineHeight: 19, marginTop: 10 },
  cameraCapture: { minHeight: 205, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 14, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 20 },
  cameraIconCircle: { width: 54, height: 54, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cameraTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  cameraSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  cameraAction: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 18 },
  cameraActionText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  photoPreviewContainer: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  photoPreview: { width: "100%", aspectRatio: 16 / 9, maxHeight: 320, backgroundColor: colors.background },
  previewBadge: { position: "absolute", right: 10, bottom: 10, backgroundColor: colors.surface, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  previewBadgeText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  photoStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13 },
  photoStatusText: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 },
  photoActions: { flexDirection: "row", flexWrap: "wrap", padding: 12, paddingTop: 0, gap: 10 },
  secondaryButton: { flexGrow: 1, minHeight: 44, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12 },
  secondaryButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  removeButton: { flexDirection: "row", gap: 6, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.border },
  removeButtonText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  retryNotice: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, backgroundColor: colors.primaryLight, borderRadius: 13, marginBottom: 16 },
  retryText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20 },
  actionButton: { minHeight: 54, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderRadius: 14, padding: 15, backgroundColor: colors.primary },
  submitText: { color: colors.white, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  footer: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 12 },
  pressed: { opacity: 0.8 }, disabled: { opacity: 0.5 },
  photoViewerOverlay: { flex: 1, backgroundColor: "#111111" },
  viewerClose: { flexDirection: "row", gap: 8, minHeight: 48, alignItems: "center", alignSelf: "flex-end", paddingHorizontal: 18 },
  viewerCloseText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  photoViewerImage: { flex: 1, width: "100%" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 20 },
  messageModal: { width: "100%", maxWidth: 440, borderRadius: 20, backgroundColor: colors.surface, padding: 24, alignItems: "center" },
  modalIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  successIcon: { backgroundColor: "#E8F5EE" }, errorIcon: { backgroundColor: colors.primaryLight },
  modalVehicle: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  messageTitle: { color: colors.text, fontSize: 21, fontWeight: "800", textAlign: "center" },
  messageText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 10, textAlign: "center" },
  modalButton: { width: "100%", minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", padding: 12, marginTop: 22 },
  modalButtonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  viewVehiclesButton: { width: "100%", minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center", padding: 12, marginTop: 10 },
  viewVehiclesButtonText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
