import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors } from "../../../../../theme";
import { SectionCard, SegmentedTabs } from "./IntakeUI";
type IntakeStyles = Record<string, any>;
type VehicleType = "PRIVATE" | "COMMERCIAL";
export function IntakeVehicleTypeSection({ vehicleType, completedRequiredDocuments, requiredDocumentsCount, onVehicleTypeChange, styles }: { vehicleType: VehicleType; completedRequiredDocuments: number; requiredDocumentsCount: number; onVehicleTypeChange: (value: VehicleType) => void; styles: IntakeStyles }) {
  return <SectionCard eyebrow="05" title="Vehicle Type" subtitle="The vehicle type determines which document checklist is displayed." styles={styles}>
    <SegmentedTabs options={[{ value: "PRIVATE", label: "Private", icon: "person-outline" }, { value: "COMMERCIAL", label: "Commercial", icon: "business-outline" }]} value={vehicleType} onChange={v => onVehicleTypeChange(v as VehicleType)} styles={styles} />
    <View style={styles.checklistSummary}><View style={styles.checklistSummaryIcon}><Ionicons name="document-text-outline" size={18} color={colors.primary} /></View><View style={styles.checklistSummaryText}><Text style={styles.checklistSummaryTitle}>{vehicleType === "PRIVATE" ? "Private documents" : "Commercial documents"}</Text><Text style={styles.checklistSummarySubtitle}>{completedRequiredDocuments} of {requiredDocumentsCount} required documents completed</Text></View></View>
  </SectionCard>;
}
