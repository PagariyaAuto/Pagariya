import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const { width, height } = Dimensions.get("window");

type PhotoItem = {
  id: string;
  uri: string;
  status?: "pending" | "uploading" | "uploaded" | "failed";
};

type PhotoViewerProps = {
  visible: boolean;
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
};

export default function PhotoViewer({
  visible,
  photos,
  initialIndex = 0,
  onClose,
}: PhotoViewerProps) {
  const listRef = useRef<FlatList<PhotoItem>>(null);

  React.useEffect(() => {
    if (visible && photos.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 50);
    }
  }, [visible, initialIndex, photos.length]);

  if (photos.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Ionicons
            name="close"
            size={26}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {/* Photo counter */}
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {initialIndex + 1} / {photos.length}
          </Text>
        </View>

        {/* Photos */}
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          keyExtractor={(item) => item.id}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={styles.photoPage}>
              <Image
                source={{ uri: item.uri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>
          )}
          onScrollToIndexFailed={() => {
            // Ignore if the list hasn't finished mounting yet.
          }}
        />
      </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  photoPage: {
    width,
    height,
    alignItems: "center",
    justifyContent: "center",
  },

  fullImage: {
    width,
    height: height * 0.8,
  },

  closeButton: {
    position: "absolute",
    top: 52,
    right: 18,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  counter: {
    position: "absolute",
    top: 62,
    left: 18,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },

  counterText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});