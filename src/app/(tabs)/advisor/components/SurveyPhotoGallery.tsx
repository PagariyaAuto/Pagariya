
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../../../theme";

export type SurveyPhoto = {
  uri: string;
  id?: string;
  name?: string;
};

type SurveyPhotoGalleryProps = {
  selectedPhotos?: SurveyPhoto[];
  savedPhotos?: SurveyPhoto[];
  onPhotoPress: (
    photo: SurveyPhoto,
    index: number,
    source: "selected" | "saved"
  ) => void;
  onRemovePhoto?: (index: number) => void;
  onRemoveSavedPhoto?: (photo: SurveyPhoto, index: number) => void;
  editable?: boolean;
};

type PhotoTileProps = {
  photo: SurveyPhoto;
  onPress: () => void;
  onRemove?: () => void;
  removeLabel: string;
};

function PhotoTile({
  photo,
  onPress,
  onRemove,
  removeLabel,
}: PhotoTileProps) {
  return (
    <View style={styles.photoTile}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View photo${photo.name ? ` ${photo.name}` : ""}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.photoPressable,
          pressed && styles.photoPressed,
        ]}
      >
        <Image
          source={{ uri: photo.uri }}
          style={styles.photoImage}
        />
        <View pointerEvents="none" style={styles.viewOverlay}>
          <Text style={styles.viewOverlayText}>View</Text>
        </View>
      </Pressable>

      {!!onRemove && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.removeButtonPressed,
          ]}
        >
          <Text style={styles.removeButtonText}>🗑</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function SurveyPhotoGallery({
  selectedPhotos = [],
  savedPhotos = [],
  onPhotoPress,
  onRemovePhoto,
  onRemoveSavedPhoto,
  editable = false,
}: SurveyPhotoGalleryProps) {
  const hasSelectedPhotos = selectedPhotos.length > 0;
  const hasSavedPhotos = savedPhotos.length > 0;
  const hasPhotos = hasSelectedPhotos || hasSavedPhotos;
  const totalPhotos = selectedPhotos.length + savedPhotos.length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📸</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Survey Photos</Text>
          <Text style={styles.subtitle}>
            {hasPhotos
              ? `${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}`
              : "Photos captured for this survey"}
          </Text>
        </View>
      </View>

      {!hasPhotos ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🖼️</Text>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptyMessage}>
            Photos added during the survey will appear here.
          </Text>
        </View>
      ) : (
        <>
          {hasSelectedPhotos && (
            <View style={styles.photoSection}>
              <Text style={styles.sectionTitle}>New photos</Text>
              <View style={styles.photoGrid}>
                {selectedPhotos.map((photo, index) => (
                  <PhotoTile
                    key={photo.id ?? `selected-${photo.uri}-${index}`}
                    photo={photo}
                    removeLabel="Remove selected photo"
                    onPress={() => onPhotoPress(photo, index, "selected")}
                    onRemove={
                      editable && onRemovePhoto
                        ? () => onRemovePhoto(index)
                        : undefined
                    }
                  />
                ))}
              </View>
            </View>
          )}

          {hasSavedPhotos && (
            <View style={styles.photoSection}>
              <Text style={styles.sectionTitle}>Saved photos</Text>
              <View style={styles.photoGrid}>
                {savedPhotos.map((photo, index) => (
                  <PhotoTile
                    key={photo.id ?? `saved-${photo.uri}-${index}`}
                    photo={photo}
                    removeLabel="Delete saved survey photo"
                    onPress={() => onPhotoPress(photo, index, "saved")}
                    onRemove={
                      onRemoveSavedPhoto
                        ? () => onRemoveSavedPhoto(photo, index)
                        : undefined
                    }
                  />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: "#172033",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    marginRight: spacing.md,
  },
  iconText: { fontSize: 22 },
  headerText: { flex: 1 },
  title: {
    ...typography.heading,
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 3,
  },
  photoSection: { marginTop: spacing.sm },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  photoTile: {
    width: 76,
    paddingHorizontal: 4,
    paddingBottom: spacing.sm,
    position: "relative",
  },
  photoPressable: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  photoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  viewOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 5,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  viewOverlayText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  removeButton: {
    position: "absolute",
    top: -3,
    right: 0,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D92D20",
    borderWidth: 2,
    borderColor: colors.surface,
    zIndex: 2,
    elevation: 4,
  },
  removeButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
  removeButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    borderStyle: "dashed",
    backgroundColor: colors.background,
  },
  emptyIcon: { fontSize: 30, marginBottom: spacing.sm },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: "800",
    marginBottom: 5,
  },
  emptyMessage: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: "center",
    lineHeight: 19,
  },
  photoPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});