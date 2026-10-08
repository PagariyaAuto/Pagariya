import BackButton from "../../../../components/navigation/BackButton";
import { Ionicons } from "@expo/vector-icons";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const COLORS = {
  red: "#C62828",
  redSoft: "#FDECEC",
  charcoal: "#171717",
  white: "#FFFFFF",
  textMuted: "#999999",
  border: "#E7E5E2",
  graySoft: "#F0F0EE",
};

export type VehicleHeaderPriority =
  | "URGENT"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

type VehicleHeaderProps = {
  vehicleNumber: string;
  priority: VehicleHeaderPriority;
  onBack: () => void;
};

function getPriorityColors(
  priority: VehicleHeaderPriority
) {
  switch (priority) {
    case "URGENT":
      return {
        background: "#FEE2E2",
        text: "#B91C1C",
      };

    case "HIGH":
      return {
        background: "#FFF4E5",
        text: "#C2410C",
      };

    case "MEDIUM":
      return {
        background: "#FFF9E5",
        text: "#A16207",
      };

    default:
      return {
        background: COLORS.graySoft,
        text: "#6B6B6B",
      };
  }
}

export default function VehicleHeader({
  vehicleNumber,
  priority,
  onBack,
}: VehicleHeaderProps) {
  const priorityColors =
    getPriorityColors(priority);

  return (
    <View style={styles.header}>
      <BackButton onPress={onBack} />

      <View style={styles.headerTextArea}>
        <Text style={styles.headerEyebrow}>
          VEHICLE MANAGEMENT
        </Text>

        <Text style={styles.headerTitle}>
          {vehicleNumber || "Vehicle"}
        </Text>
      </View>

      <View
        style={[
          styles.priorityBadge,
          {
            backgroundColor:
              priorityColors.background,
          },
        ]}
      >
        <View
          style={[
            styles.priorityDot,
            {
              backgroundColor:
                priorityColors.text,
            },
          ]}
        />

        <Text
          style={[
            styles.priorityText,
            {
              color: priorityColors.text,
            },
          ]}
        >
          {priority}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  headerTextArea: {
    flex: 1,
  },

  headerEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: COLORS.red,
    marginBottom: 2,
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.charcoal,
  },

  priorityBadge: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  priorityText: {
    fontSize: 10,
    fontWeight: "900",
  },

  buttonPressed: {
    opacity: 0.7,
  },
});