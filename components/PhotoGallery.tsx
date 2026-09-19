import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type PhotoItem = {
  id: string;
  uri: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
  progress?: number;
};

type PhotoGalleryProps = {
  photos: PhotoItem[];
  maxPhotos?: number;
  onAddPhoto: () => void;
  onRemovePhoto: (id: string) => void;
  onViewPhoto: (photo: PhotoItem) => void;

  // When true, photos can only be viewed.
  // Add / Remove controls are hidden.
  readOnly?: boolean;
};

export default function PhotoGallery({
  photos,
  maxPhotos,
  onAddPhoto,
  onRemovePhoto,
  onViewPhoto,
  readOnly = false,
}: PhotoGalleryProps) {
  const canAddMore =
    !readOnly &&
    (maxPhotos === undefined ||
      photos.length < maxPhotos);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Vehicle Photos
          </Text>

          <Text style={styles.subtitle}>
            {photos.length}
            {maxPhotos
              ? ` / ${maxPhotos}`
              : ""}{" "}
            photos
          </Text>
        </View>

        {/* Add Photo button */}
        {canAddMore && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={onAddPhoto}
            activeOpacity={0.8}
          >
            <Ionicons
              name="add"
              size={20}
              color="#FFFFFF"
            />

            <Text
              style={styles.addButtonText}
            >
              Add Photo
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Empty state */}
      {photos.length === 0 ? (
        readOnly ? (
          <View style={styles.emptyReadOnlyBox}>
            <View
              style={styles.emptyReadOnlyIcon}
            >
              <Ionicons
                name="images-outline"
                size={28}
                color="#9CA3AF"
              />
            </View>

            <Text
              style={styles.emptyReadOnlyTitle}
            >
              No survey photos
            </Text>

            <Text
              style={styles.emptyReadOnlyText}
            >
              No photos were uploaded during the survey.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.emptyBox}
            onPress={onAddPhoto}
            activeOpacity={0.8}
          >
            <View
              style={styles.cameraCircle}
            >
              <Ionicons
                name="camera-outline"
                size={28}
                color="#F31322"
              />
            </View>

            <Text
              style={styles.emptyTitle}
            >
              Add vehicle photos
            </Text>

            <Text
              style={styles.emptyText}
            >
              Take a photo or choose one from your gallery
            </Text>
          </TouchableOpacity>
        )
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              style={styles.photoContainer}
              onPress={() =>
                onViewPhoto(photo)
              }
              activeOpacity={0.9}
            >
              <Image
                source={{
                  uri: photo.uri,
                }}
                style={styles.photo}
              />

              {/* Remove button */}
              {!readOnly &&
                (photo.status ===
                  "pending" ||
                  photo.status ===
                    "failed") && (
                  <TouchableOpacity
                    style={
                      styles.removeButton
                    }
                    onPress={() =>
                      onRemovePhoto(
                        photo.id
                      )
                    }
                    hitSlop={{
                      top: 10,
                      bottom: 10,
                      left: 10,
                      right: 10,
                    }}
                  >
                    <Ionicons
                      name="close"
                      size={14}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                )}

              {/* Uploading overlay */}
              {photo.status ===
                "uploading" && (
                <View
                  style={
                    styles.uploadingOverlay
                  }
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={24}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.uploadingText
                    }
                  >
                    Uploading
                  </Text>

                  {photo.progress !==
                    undefined && (
                    <View
                      style={
                        styles.progressBackground
                      }
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                photo.progress
                              )
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Uploaded badge */}
              {photo.status ===
                "uploaded" && (
                <View
                  style={
                    styles.uploadedBadge
                  }
                >
                  <Ionicons
                    name="checkmark"
                    size={13}
                    color="#FFFFFF"
                  />
                </View>
              )}

              {/* Failed badge */}
              {photo.status ===
                "failed" && (
                <View
                  style={
                    styles.failedOverlay
                  }
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={22}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.failedText
                    }
                  >
                    Failed
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Upload information */}
      {!readOnly &&
        photos.some(
          (photo) =>
            photo.status ===
            "uploading"
        ) && (
          <View
            style={styles.uploadInfo}
          >
            <View
              style={
                styles.uploadInfoIcon
              }
            >
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color="#2563EB"
              />
            </View>

            <View
              style={
                styles.uploadInfoContent
              }
            >
              <Text
                style={
                  styles.uploadInfoTitle
                }
              >
                Uploading photos...
              </Text>

              <Text
                style={
                  styles.uploadInfoText
                }
              >
                Please keep this screen open
              </Text>
            </View>
          </View>
        )}

      {/* Tap hint */}
      {photos.length > 0 && (
        <Text style={styles.hint}>
          Tap a photo to view it
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#171717",
  },

  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 3,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F31322",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  emptyBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  emptyReadOnlyBox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },

  emptyReadOnlyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyReadOnlyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#171717",
  },

  emptyReadOnlyText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 5,
    textAlign: "center",
  },

  cameraCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFE5E7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#171717",
  },

  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 5,
    textAlign: "center",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  photoContainer: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },

  photo: {
    width: "100%",
    height: "100%",
  },

  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor:
      "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  uploadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor:
      "rgba(0,0,0,0.48)",
    alignItems: "center",
    justifyContent: "center",
  },

  uploadingText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 5,
  },

  progressBackground: {
    width: "65%",
    height: 4,
    borderRadius: 2,
    backgroundColor:
      "rgba(255,255,255,0.35)",
    marginTop: 8,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },

  uploadedBadge: {
    position: "absolute",
    bottom: 7,
    right: 7,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },

  failedOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 6,
    backgroundColor:
      "rgba(220,38,38,0.85)",
    alignItems: "center",
  },

  failedText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },

  uploadInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DBEAFE",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },

  uploadInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  uploadInfoContent: {
    marginLeft: 10,
    flex: 1,
  },

  uploadInfoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E3A8A",
  },

  uploadInfoText: {
    fontSize: 11,
    color: "#2563EB",
    marginTop: 2,
  },

  hint: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 10,
  },
});