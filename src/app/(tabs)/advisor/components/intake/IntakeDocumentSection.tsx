import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "../../../../../theme";
import { SectionCard } from "./IntakeUI";

type DocumentMaster = {
  id: string;
  name: string;
  vehicle_type: string;
  workflow_stage: string;
  requirement_type: string | null;
  is_active: boolean;
};

type Props = {
  vehicleType: "PRIVATE" | "COMMERCIAL";
  currentDocuments: DocumentMaster[];
  documentChecklist: Record<string, boolean>;
  onToggleDocument: (documentId: string) => void;
  isRequiredDocument: (document: DocumentMaster) => boolean;
  styles: Record<string, any>;
};

export function IntakeDocumentSection({
  vehicleType,
  currentDocuments,
  documentChecklist,
  onToggleDocument,
  isRequiredDocument,
  styles,
}: Props) {
  return (
    <SectionCard
      eyebrow="07"
      title={
        vehicleType === "PRIVATE"
          ? "Private Document Checklist"
          : "Commercial Document Checklist"
      }
      subtitle="Confirm the documents available for this vehicle."
      styles={styles}
    >
      {currentDocuments.length === 0 ? (
        <View style={styles.emptyChecklist}>
          <Ionicons
            name="document-text-outline"
            size={28}
            color={colors.textLight}
          />

          <Text style={styles.emptyChecklistTitle}>
            No documents configured
          </Text>

          <Text style={styles.emptyChecklistText}>
            No active Vehicle Intake documents are configured for this vehicle
            type in Document Master.
          </Text>
        </View>
      ) : (
        <View style={styles.documentList}>
          {currentDocuments.map((document) => {
            const checked = documentChecklist[document.id] === true;
            const required = isRequiredDocument(document);

            return (
              <Pressable
                key={document.id}
                onPress={() => onToggleDocument(document.id)}
                style={({ pressed }) => [
                  styles.documentRow,
                  checked && styles.documentRowChecked,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    checked && styles.checkboxChecked,
                  ]}
                >
                  {checked && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color="#FFFFFF"
                    />
                  )}
                </View>

                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>
                    {document.name}
                  </Text>

                  <Text style={styles.documentRequirement}>
                    {required ? "Required" : "Optional"}
                  </Text>
                </View>

                <Ionicons
                  name={
                    checked
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={22}
                  color={
                    checked
                      ? colors.success
                      : colors.textLight
                  }
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </SectionCard>
  );
}
