import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "../../../../../theme";
import { FieldLabel, SectionCard } from "./IntakeUI";

type VehicleModel = {
  id: string;
  name: string;
  arena_nexa: string | null;
  is_active?: boolean | null;
};

type Props = {
  vehicleModels: VehicleModel[];
  selectedModelId: string;
  selectedModel: VehicleModel | null | undefined;
  arenaNexa: string;
  onOpenModelDropdown: () => void;
  styles: Record<string, any>;
};

export function IntakeVehicleModelSection({
  selectedModel,
  selectedModelId,
  arenaNexa,
  onOpenModelDropdown,
  styles,
}: Props) {
  return (
    <SectionCard
      eyebrow="06"
      title="Vehicle Model"
      subtitle="Select the model from the current Master Data."
      styles={styles}
    >
      <FieldLabel
        label="Vehicle Model"
        required
        styles={styles}
      />

      <Pressable
        onPress={onOpenModelDropdown}
        style={({ pressed }) => [
          styles.dropdownButton,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.dropdownButtonContent}>
          <Ionicons
            name="car-outline"
            size={19}
            color={colors.primary}
          />

          <Text
            style={[
              styles.dropdownButtonText,
              !selectedModel && styles.dropdownPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedModel
              ? `${selectedModel.name}${
                  selectedModel.arena_nexa
                    ? ` • ${selectedModel.arena_nexa}`
                    : ""
                }`
              : "Select vehicle model"}
          </Text>
        </View>

        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {arenaNexa ? (
        <View style={styles.arenaNexaBadge}>
          <Ionicons
            name="business-outline"
            size={16}
            color={colors.primary}
          />

          <Text style={styles.arenaNexaText}>{arenaNexa}</Text>
        </View>
      ) : null}
    </SectionCard>
  );
}
