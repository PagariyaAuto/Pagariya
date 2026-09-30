import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const COLORS = {
  red: "#C62828",
  charcoal: "#171717",
  white: "#FFFFFF",
  textMuted: "#999999",
  border: "#E7E5E2",
  redSoft: "#FDECEC",
  graySoft: "#F0F0EE",
};

type PhotoItem = {
  id: string;
  uri: string;
  name?: string;
};

type VehiclePhotosProps = {
  photos: PhotoItem[];
  onPhotoPress: (index: number) => void;
};

export default function VehiclePhotos({
  photos,
  onPhotoPress,
}: VehiclePhotosProps) {
  return (
    <SectionCard
      title="Vehicle Photos"
      icon="images-outline"
      rightText={
        photos.length > 0
          ? `${photos.length} photo${
              photos.length === 1 ? "" : "s"
            }`
          : undefined
      }
    >
      {photos.length > 0 ? (
        <View style={styles.photoGrid}>
          {photos.map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => onPhotoPress(index)}
              style={({ pressed }) => [
                styles.photoThumbnail,
                pressed &&
                  styles.photoThumbnailPressed,
              ]}
            >
              <Image
                source={{ uri: photo.uri }}
                style={styles.photoThumbnailImage}
                resizeMode="cover"
              />

              <View style={styles.photoThumbnailOverlay}>
                <Ionicons
                  name="expand-outline"
                  size={17}
                  color={COLORS.white}
                />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.noPhotos}>
          <Ionicons
            name="image-outline"
            size={28}
            color={COLORS.textMuted}
          />

          <Text style={styles.noPhotosText}>
            No vehicle photos available.
          </Text>
        </View>
      )}
    </SectionCard>
  );
}

function SectionCard({
  title,
  icon,
  rightText,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  rightText?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleArea}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name={icon}
              size={18}
              color={COLORS.red}
            />
          </View>

          <Text style={styles.sectionTitle}>
            {title}
          </Text>
        </View>

        {rightText ? (
          <Text style={styles.sectionRightText}>
            {rightText}
          </Text>
        ) : null}
      </View>

      <View style={styles.sectionBody}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    overflow: "hidden",
  },

  sectionHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitleArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.charcoal,
  },

  sectionRightText: {
    fontSize: 11,
    color: "#6B6B6B",
    fontWeight: "700",
  },

  sectionBody: {
    padding: 14,
  },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  photoThumbnail: {
    width: 78,
    height: 78,
    borderRadius: 11,
    backgroundColor: COLORS.graySoft,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  photoThumbnailPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },

  photoThumbnailImage: {
    width: "100%",
    height: "100%",
  },

  photoThumbnailOverlay: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  noPhotos: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
  },

  noPhotosText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
});