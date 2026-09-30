import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { colors } from "../../../../../theme";

type Props = {
  saving: boolean;
  onSave: () => void;
  styles: any;
};

export function IntakeSaveSection({ saving, onSave, styles }: Props) {
  return (
    <View style={styles.saveSection}>
      <View style={styles.saveInfo}>
        <View style={styles.saveInfoIcon}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.info} />
        </View>
        <Text style={styles.saveInfoText}>
          Save securely saves the intake and moves the vehicle to the next workflow
          stage only when the backend operation succeeds.
        </Text>
      </View>

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={({ pressed }) => [
          styles.saveButton,
          saving && styles.saveButtonDisabled,
          pressed && !saving && styles.pressed,
        ]}
      >
        {saving ? (
          <>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Saving…</Text>
          </>
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={21} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Save Vehicle Intake</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
