import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Pressable, Text, View } from "react-native";
import { colors } from "../../../../../theme";
import { InfoBox, SectionCard } from "./IntakeUI";

type Vehicle = {
  vehicle_no: string;
};

type GateInPhoto = {
  uri: string;
} | null;

type IntakeVehicleSectionProps = {
  vehicle: Vehicle;
  currentStage: string;
  gateInAt: string | null;
  gateInPhoto: GateInPhoto;
  formatDateTime: (value: string | null) => string;
  normalizeVehicleNumber: (value: string) => string;
  onOpenPhoto: (uri: string) => void;
  styles: any;
};

export default function IntakeVehicleSection({
  vehicle,
  currentStage,
  gateInAt,
  gateInPhoto,
  formatDateTime,
  normalizeVehicleNumber,
  onOpenPhoto,
  styles,
}: IntakeVehicleSectionProps) {
  return (
    <SectionCard
      eyebrow="01"
      title="Vehicle & Gate In"
      subtitle="Review the arrival information before starting the intake."
      styles={styles}
    >
      <View style={styles.vehicleHeroRow}>
        <View style={styles.vehicleIconLarge}>
          <Ionicons
            name="car-sport-outline"
            size={30}
            color={colors.primary}
          />
        </View>

        <View style={styles.vehicleHeroInfo}>
          <Text style={styles.vehicleNumberLarge}>
            {normalizeVehicleNumber(vehicle.vehicle_no)}
          </Text>

          <Text style={styles.vehicleStageText}>
            {currentStage === "PENDING_ADVISOR"
              ? "Waiting for advisor"
              : "Advisor assigned"}
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <InfoBox label="Gate In" value={formatDateTime(gateInAt)} styles={styles} />

        <View style={styles.infoBox}>
          <Text style={styles.infoBoxLabel}>Gate-In Photo</Text>

          {gateInPhoto ? (
            <Pressable
              onPress={() => onOpenPhoto(gateInPhoto.uri)}
              style={({ pressed }) => [
                styles.gateThumbnailButton,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={{ uri: gateInPhoto.uri }}
                style={styles.gateThumbnail}
              />

              <View style={styles.thumbnailOverlay}>
                <Ionicons
                  name="expand-outline"
                  size={17}
                  color="#FFFFFF"
                />
              </View>
            </Pressable>
          ) : (
            <View style={styles.noPhotoBox}>
              <Ionicons
                name="image-outline"
                size={20}
                color={colors.textLight}
              />

              <Text style={styles.noPhotoText}>Not available</Text>
            </View>
          )}
        </View>
      </View>
    </SectionCard>
  );
}
