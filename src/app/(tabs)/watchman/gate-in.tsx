
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../../../../lib/supabase";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../theme";

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

  const formReady =
    vehicleNo.trim().length > 0 && !!photo;

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
    if (submitting) return;

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
    if (!vehicleNo.trim()) {
      showModal(
        "Vehicle Number Required",
        "Please enter the vehicle registration number.",
        false
      );

      return false;
    }

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
      submitting ||
      !validateForm()
    ) {
      return;
    }

    Keyboard.dismiss();

    setSubmitting(true);

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
          "The vehicle entry and photo have been recorded successfully. The vehicle is now pending Advisor assignment.",
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
            vehicleNo.trim(),

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

      setPendingGateIn({
        vehicleId: data.vehicle_id,
        visitId: data.visit_id,
        gateEntryId: data.gate_entry_id,
        photoId: data.gate_in_photo_id,
        storagePath,
      });

      await uploadPhoto(
        photo!.uri,
        storagePath
      );

      showModal(
        "Gate In Complete",
        "The vehicle entry and photo have been recorded successfully. The vehicle is now pending Advisor assignment.",
        true
      );
    } catch (error: any) {
      const message =
        error?.message ||
        "Something went wrong while completing Gate In.";

      if (pendingGateIn) {
        showModal(
          "Photo Upload Failed",
          `${message}\n\nThe vehicle entry has already been recorded. Please retry the photo upload. Do not start another Gate In for this vehicle.`,
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
      setPhotos([]);
      setPendingGateIn(null);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>
              ↗
            </Text>
          </View>

          <View
            style={styles.headerTextContainer}
          >
            <Text style={styles.eyebrow}>
              VEHICLE OPERATIONS
            </Text>

            <Text style={styles.title}>
              Vehicle Gate In
            </Text>

            <Text style={styles.subtitle}>
              Register a vehicle entering the premises
            </Text>
          </View>
        </View>

        {/* Steps */}

        <View style={styles.stepsCard}>
          <View style={styles.stepItem}>
            <View
              style={styles.stepNumberActive}
            >
              <Text
                style={
                  styles.stepNumberTextActive
                }
              >
                1
              </Text>
            </View>

            <Text
              style={styles.stepTextActive}
            >
              Registration
            </Text>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                !!photo &&
                  styles.stepNumberActive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  !!photo &&
                    styles.stepNumberTextActive,
                ]}
              >
                2
              </Text>
            </View>

            <Text
              style={
                photo
                  ? styles.stepTextActive
                  : styles.stepText
              }
            >
              Photo
            </Text>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                formReady &&
                  styles.stepNumberActive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  formReady &&
                    styles.stepNumberTextActive,
                ]}
              >
                3
              </Text>
            </View>

            <Text
              style={
                formReady
                  ? styles.stepTextActive
                  : styles.stepText
              }
            >
              Submit
            </Text>
          </View>
        </View>

        {/* Registration */}

        <View style={styles.card}>
          <View style={styles.cardHeadingRow}>
            <View style={styles.sectionIcon}>
              <Text
                style={styles.sectionIconText}
              >
                01
              </Text>
            </View>

            <View
              style={styles.cardHeadingText}
            >
              <Text
                style={styles.sectionTitle}
              >
                Vehicle registration
              </Text>

              <Text
                style={styles.sectionSubtitle}
              >
                Enter the number displayed on the vehicle
              </Text>
            </View>

            <View
              style={styles.requiredBadge}
            >
              <Text
                style={
                  styles.requiredBadgeText
                }
              >
                Required
              </Text>
            </View>
          </View>

          <Text style={styles.label}>
            Vehicle registration number
          </Text>

          <TextInput
            value={vehicleNo}
            onChangeText={setVehicleNo}
            placeholder="e.g. MH 12 AB 1234"
            placeholderTextColor={
              colors.textLight
            }
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={
              Keyboard.dismiss
            }
            style={[
              styles.input,
              vehicleNo.trim().length > 0 &&
                styles.inputFilled,
            ]}
            editable={
              !submitting &&
              !pendingGateIn
            }
          />

          <Text style={styles.helperText}>
            Check the registration number carefully before continuing.
          </Text>
        </View>

        {/* Photo */}

        <View style={styles.card}>
          <View style={styles.cardHeadingRow}>
            <View style={styles.sectionIcon}>
              <Text
                style={styles.sectionIconText}
              >
                02
              </Text>
            </View>

            <View
              style={styles.cardHeadingText}
            >
              <Text
                style={styles.sectionTitle}
              >
                Vehicle photo
              </Text>

              <Text
                style={styles.sectionSubtitle}
              >
                Capture one clear photo of the vehicle
              </Text>
            </View>

            <View
              style={styles.requiredBadge}
            >
              <Text
                style={
                  styles.requiredBadgeText
                }
              >
                Required
              </Text>
            </View>
          </View>

          {photo ? (
            <View
              style={
                styles.photoPreviewContainer
              }
            >
              <Pressable
                onPress={() =>
                  setShowPhotoViewer(true)
                }
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="View captured vehicle photo"
              >
                <Image
                  source={{
                    uri: photo.uri,
                  }}
                  style={
                    styles.photoPreview
                  }
                  resizeMode="cover"
                />
              </Pressable>

              <View
                style={
                  styles.photoStatusRow
                }
              >
                <View
                  style={[
                    styles.statusDot,
                    photoUploaded
                      ? styles.statusDotSuccess
                      : photo.status ===
                        "failed"
                      ? styles.statusDotError
                      : styles.statusDotPending,
                  ]}
                />

                <Text
                  style={
                    styles.photoStatusText
                  }
                >
                  {photo.status ===
                  "uploaded"
                    ? "Photo saved successfully"
                    : photo.status ===
                      "uploading"
                    ? `Uploading photo${
                        photo.progress
                          ? ` · ${photo.progress}%`
                          : "..."
                      }`
                    : photo.status ===
                      "failed"
                    ? "Upload failed · Retry available"
                    : "Photo captured · Ready to upload"}
                </Text>
              </View>

              {photo.status ===
                "uploading" && (
                <View
                  style={
                    styles.progressTrack
                  }
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${
                          photo.progress ??
                          0
                        }%`,
                      },
                    ]}
                  />
                </View>
              )}

              {!submitting &&
                !pendingGateIn && (
                  <View
                    style={
                      styles.photoActions
                    }
                  >
                    <Pressable
                      style={
                        styles.secondaryButton
                      }
                      onPress={takePhoto}
                    >
                      <Text
                        style={
                          styles.secondaryButtonText
                        }
                      >
                        Retake photo
                      </Text>
                    </Pressable>

                    <Pressable
                      style={
                        styles.removeButton
                      }
                      onPress={
                        removePhoto
                      }
                    >
                      <Text
                        style={
                          styles.removeButtonText
                        }
                      >
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                )}
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.cameraCapture,
                pressed &&
                  styles.cameraCapturePressed,
              ]}
              onPress={takePhoto}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Open camera to capture vehicle photo"
            >
              <View
                style={
                  styles.cameraIconCircle
                }
              >
                <Text
                  style={styles.cameraIcon}
                >
                  📷
                </Text>
              </View>

              <Text
                style={styles.cameraTitle}
              >
                Capture vehicle photo
              </Text>

              <Text
                style={styles.cameraSubtitle}
              >
                Tap to open the camera
              </Text>

              <View
                style={styles.cameraAction}
              >
                <Text
                  style={
                    styles.cameraActionText
                  }
                >
                  Open Camera
                </Text>
              </View>
            </Pressable>
          )}

          <View style={styles.photoNote}>
            <Text
              style={styles.photoNoteText}
            >
              One photo is required. Gallery selection is not available on this screen.
            </Text>
          </View>
        </View>

        {/* Primary action */}

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            !formReady &&
              styles.actionButtonDisabled,
            pressed &&
              formReady &&
              styles.buttonPressed,
            submitting &&
              styles.actionButtonDisabled,
          ]}
          onPress={handleGateIn}
          disabled={
            !formReady || submitting
          }
        >
          {submitting ? (
            <View
              style={styles.loadingRow}
            >
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />

              <Text
                style={styles.submitText}
              >
                {pendingGateIn
                  ? "Retrying photo upload..."
                  : "Processing Gate In..."}
              </Text>
            </View>
          ) : (
            <Text
              style={styles.submitText}
            >
              {pendingGateIn
                ? "Retry Photo Upload"
                : "Complete Gate In"}
            </Text>
          )}
        </Pressable>

        {!formReady && (
          <Text
            style={styles.buttonHint}
          >
            Enter the vehicle number and capture a photo to continue.
          </Text>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>
            ⓘ
          </Text>

          <Text style={styles.infoText}>
            The vehicle will enter Pending Advisor after Gate In. The Advisor will then collect the customer name, mobile number, vehicle type, model, Arena/Nexa, insurance and other intake details.
          </Text>
        </View>

        <View
          style={styles.bottomSpace}
        />
      </ScrollView>

      {/* Photo viewer */}

      <Modal
        visible={showPhotoViewer}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowPhotoViewer(false)
        }
      >
        <Pressable
          style={
            styles.photoViewerOverlay
          }
          onPress={() =>
            setShowPhotoViewer(false)
          }
        >
          <View
            style={
              styles.photoViewerContent
            }
          >
            {photo && (
              <Image
                source={{
                  uri: photo.uri,
                }}
                style={
                  styles.photoViewerImage
                }
                resizeMode="contain"
              />
            )}

            <Text
              style={
                styles.photoViewerClose
              }
            >
              Tap anywhere to close
            </Text>
          </View>
        </Pressable>
      </Modal>

      {/* Message modal */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.messageModal}
          >
            <View
              style={[
                styles.modalIcon,
                modalSuccess
                  ? styles.successIcon
                  : styles.errorIcon,
              ]}
            >
              <Text
                style={
                  styles.modalIconText
                }
              >
                {modalSuccess
                  ? "✓"
                  : "!"}
              </Text>
            </View>

            <Text
              style={styles.messageTitle}
            >
              {modalTitle}
            </Text>

            <Text
              style={styles.messageText}
            >
              {modalMessage}
            </Text>

            <Pressable
              style={styles.modalButton}
              onPress={closeModal}
            >
              <Text
                style={
                  styles.modalButtonText
                }
              >
                {modalSuccess
                  ? "Register Next Vehicle"
                  : "OK"}
              </Text>
            </Pressable>

            {modalSuccess && (
              <Pressable
                style={
                  styles.viewVehiclesButton
                }
                onPress={() => {
                  setModalVisible(false);

                  router.replace(
                    "/(tabs)/watchman"
                  );
                }}
              >
                <Text
                  style={
                    styles.viewVehiclesButtonText
                  }
                >
                  Go to Dashboard
                </Text>
              </Pressable>
            )}
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
    paddingBottom: spacing.xxl,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },

  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  headerIconText: {
    fontSize: 27,
    fontWeight: "800",
    color: colors.primary,
  },

  headerTextContainer: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.primary,
    marginBottom: 3,
  },

  title: {
    fontSize: typography.title.fontSize,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: {
    marginTop: spacing.xs,
    fontSize: typography.body.fontSize,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  stepsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },

  stepItem: {
    alignItems: "center",
    gap: 6,
  },

  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  stepNumberActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  stepNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  stepNumberTextActive: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  stepText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  stepTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },

  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
    marginBottom: 20,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cardHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  sectionIconText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },

  cardHeadingText: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: typography.subheading.fontSize,
    fontWeight: "700",
    color: colors.text,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: typography.caption.fontSize,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  requiredBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginLeft: spacing.xs,
  },

  requiredBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },

  label: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },

  input: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.text,
    backgroundColor: colors.background,
  },

  inputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },

  helperText: {
    marginTop: spacing.sm,
    fontSize: typography.caption.fontSize,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  cameraCapture: {
    minHeight: 220,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  cameraCapturePressed: {
    opacity: 0.8,
  },

  cameraIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  cameraIcon: {
    fontSize: 27,
  },

  cameraTitle: {
    fontSize: typography.subheading.fontSize,
    fontWeight: "700",
    color: colors.text,
  },

  cameraSubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },

  cameraAction: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },

  cameraActionText: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  photoPreviewContainer: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },

  photoPreview: {
    width: "100%",
    height: 220,
    backgroundColor: colors.background,
  },

  photoStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusDotSuccess: {
    backgroundColor:
      colors.success ?? "#2E7D32",
  },

  statusDotError: {
    backgroundColor:
      colors.danger ?? "#C62828",
  },

  statusDotPending: {
    backgroundColor: colors.primary,
  },

  photoStatusText: {
    flex: 1,
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
  },

  progressTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: "hidden",
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 5,
  },

  photoActions: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },

  secondaryButtonText: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "700",
    color: colors.primary,
  },

  removeButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },

  removeButtonText: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  photoNote: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },

  photoNoteText: {
    fontSize: typography.caption.fontSize,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  actionButton: {
    minHeight: 60,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },

  actionButtonDisabled: {
    opacity: 0.45,
  },

  buttonPressed: {
    opacity: 0.86,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  submitText: {
    fontSize: typography.button.fontSize,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  buttonHint: {
    marginTop: spacing.sm,
    fontSize: typography.caption.fontSize,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },

  infoIcon: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primary,
  },

  infoText: {
    flex: 1,
    fontSize: typography.caption.fontSize,
    lineHeight: 19,
    color: colors.text,
  },

  bottomSpace: {
    height: spacing.xxl,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },

  messageModal: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
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
    fontWeight: "800",
    color: colors.text,
  },

  messageTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },

  messageText: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
    textAlign: "center",
  },

  modalButton: {
    width: "100%",
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },

  modalButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },

  viewVehiclesButton: {
    width: "100%",
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },

  viewVehiclesButtonText: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "700",
    color: colors.text,
  },

  photoViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },

  photoViewerContent: {
    width: "100%",
    alignItems: "center",
  },

  photoViewerImage: {
    width: "100%",
    height: "80%",
  },

  photoViewerClose: {
    marginTop: spacing.lg,
    color: "#FFFFFF",
    fontSize: typography.body.fontSize,
  },
});