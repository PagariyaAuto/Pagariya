import { Ionicons } from "@expo/vector-icons";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type PhotoUploadModalProps = {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseFromGallery: () => void;
};

export default function PhotoUploadModal({
  visible,
  onClose,
  onTakePhoto,
  onChooseFromGallery,
}: PhotoUploadModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Close when tapping outside */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Add Vehicle Photo</Text>
              <Text style={styles.subtitle}>
                Choose how you want to add a photo
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons
                name="close"
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View style={styles.options}>
            {/* Camera */}
            <TouchableOpacity
              style={styles.option}
              onPress={onTakePhoto}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.iconContainer,
                  styles.cameraIcon,
                ]}
              >
                <Ionicons
                  name="camera"
                  size={26}
                  color="#F31322"
                />
              </View>

              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>
                  Take Photo
                </Text>

                <Text style={styles.optionDescription}>
                  Use your camera to take a new photo
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>

            {/* Gallery */}
            <TouchableOpacity
              style={styles.option}
              onPress={onChooseFromGallery}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.iconContainer,
                  styles.galleryIcon,
                ]}
              >
                <Ionicons
                  name="images"
                  size={26}
                  color="#2563EB"
                />
              </View>

              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>
                  Choose from Gallery
                </Text>

                <Text style={styles.optionDescription}>
                  Select photos from your phone
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },

  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 18,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#171717",
  },

  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  options: {
    gap: 10,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
  },

  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  cameraIcon: {
    backgroundColor: "#FFE5E7",
  },

  galleryIcon: {
    backgroundColor: "#DBEAFE",
  },

  optionContent: {
    flex: 1,
    marginLeft: 13,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#171717",
  },

  optionDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
  },

  cancelButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
});