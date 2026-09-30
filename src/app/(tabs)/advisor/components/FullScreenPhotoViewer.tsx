
import { useEffect, useState } from "react";
import {
    Image,
    Modal,
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { spacing, typography } from "../../../../theme";

export type ViewerPhoto = {
  uri: string;
  id?: string;
  name?: string;
};

type FullScreenPhotoViewerProps = {
  visible: boolean;
  photos: ViewerPhoto[];
  initialIndex?: number;
  onClose: () => void;
  editable?: boolean;
  onRemove?: (index: number) => void;
};

export default function FullScreenPhotoViewer({
  visible,
  photos,
  initialIndex = 0,
  onClose,
  editable = false,
  onRemove,
}: FullScreenPhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      const safeIndex = Math.max(
        0,
        Math.min(initialIndex, Math.max(photos.length - 1, 0))
      );
      setCurrentIndex(safeIndex);
    }
  }, [visible, initialIndex, photos.length]);

  const currentPhoto = photos[currentIndex];
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < photos.length - 1;

  const goBack = () => {
    if (canGoBack) {
      setCurrentIndex((index) => index - 1);
    }
  };

  const goForward = () => {
    if (canGoForward) {
      setCurrentIndex((index) => index + 1);
    }
  };

  const removeCurrentPhoto = () => {
    if (!editable || !onRemove || !currentPhoto) return;

    onRemove(currentIndex);

    if (photos.length <= 1) {
      onClose();
      return;
    }

    setCurrentIndex((index) => Math.min(index, photos.length - 2));
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden={visible} />

      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo viewer"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [
              styles.topButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>

          <Text style={styles.counter}>
            {photos.length > 0 ? `${currentIndex + 1} / ${photos.length}` : "0 / 0"}
          </Text>

          {editable && onRemove && currentPhoto ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove this photo"
              onPress={removeCurrentPhoto}
              hitSlop={10}
              style={({ pressed }) => [
                styles.removeButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : (
            <View style={styles.topButtonPlaceholder} />
          )}
        </View>

        <View style={styles.imageArea}>
          {currentPhoto ? (
            <>
              <Image
                source={{ uri: currentPhoto.uri }}
                style={styles.image}
                resizeMode="contain"
              />

              {photos.length > 1 && (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous photo"
                    disabled={!canGoBack}
                    onPress={goBack}
                    style={({ pressed }) => [
                      styles.navigationButton,
                      styles.previousButton,
                      !canGoBack && styles.navigationButtonDisabled,
                      pressed && canGoBack && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.navigationText}>‹</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next photo"
                    disabled={!canGoForward}
                    onPress={goForward}
                    style={({ pressed }) => [
                      styles.navigationButton,
                      styles.nextButton,
                      !canGoForward && styles.navigationButtonDisabled,
                      pressed && canGoForward && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.navigationText}>›</Text>
                  </Pressable>
                </>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No photo to display</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.hint}>
            {photos.length > 1
              ? "Use the arrows to browse photos"
              : "Photo preview"}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080B12",
  },

  topBar: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  topButtonPlaceholder: {
    width: 70,
    height: 44,
  },

  closeText: {
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "400",
    marginTop: -3,
  },

  counter: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
    fontWeight: "800",
  },

  removeButton: {
    minWidth: 70,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D92D20",
  },

  removeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  imageArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  navigationButton: {
    position: "absolute",
    top: "45%",
    width: 46,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  previousButton: {
    left: spacing.md,
  },

  nextButton: {
    right: spacing.md,
  },

  navigationButtonDisabled: {
    opacity: 0.25,
  },

  navigationText: {
    color: "#FFFFFF",
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "400",
    marginTop: -5,
  },

  buttonPressed: {
    opacity: 0.7,
  },

  bottomBar: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },

  hint: {
    ...typography.caption,
    color: "rgba(255,255,255,0.65)",
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
  },
});