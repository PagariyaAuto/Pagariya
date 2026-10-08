import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "../../../../../theme";
import { FieldLabel, SectionCard, SegmentedTabs } from "./IntakeUI";

type IntakeStyles = Record<string, any>;
type JobType = "PAID" | "INSURANCE";
type MiType = "MI" | "NON-MI";
type InsuranceCompany = { id: string; name: string };
type MiMaster = { id: string; name: string; code?: string | null };

export function IntakeJobTypeSection({ jobType, miType, selectedInsurance, selectedMiMaster, onJobTypeChange, onMiTypeChange, onOpenInsuranceDropdown, styles }: {
  jobType: JobType; miType: MiType; selectedInsurance: InsuranceCompany | null | undefined; selectedMiMaster: MiMaster | null | undefined;
  onJobTypeChange: (value: JobType) => void; onMiTypeChange: (value: MiType) => void; onOpenInsuranceDropdown: () => void; styles: IntakeStyles;
}) {
  return <SectionCard eyebrow="03" title="Job Type" subtitle="Select whether this vehicle is a Paid or Insurance job." styles={styles}>
    <SegmentedTabs options={[{ value: "PAID", label: "Paid", icon: "cash-outline" }, { value: "INSURANCE", label: "Insurance", icon: "shield-checkmark-outline" }]} value={jobType} onChange={v => onJobTypeChange(v as JobType)} styles={styles} />
    {jobType === "INSURANCE" && <View style={styles.conditionalPanel}>
      <Text style={styles.conditionalTitle}>Insurance Type</Text>
      <Text style={styles.conditionalSubtitle}>Select MI or NON-MI and then select the insurance company.</Text>
      <SegmentedTabs options={[{ value: "MI", label: "MI", icon: "business-outline" }, { value: "NON-MI", label: "NON-MI", icon: "business-outline" }]} value={miType} onChange={v => onMiTypeChange(v as MiType)} styles={styles} />
      <View style={styles.insuranceDropdownContainer}>
        <FieldLabel label="Insurance Company" required styles={styles} />
        <Pressable onPress={onOpenInsuranceDropdown} style={({ pressed }) => [styles.dropdownButton, pressed && styles.pressed]}>
          <View style={styles.dropdownButtonContent}><Ionicons name="shield-outline" size={19} color={colors.primary} /><Text style={[styles.dropdownButtonText, !selectedInsurance && styles.dropdownPlaceholder]} numberOfLines={1}>{selectedInsurance?.name ?? "Select insurance company"}</Text></View>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.miInfoBox}><Ionicons name="information-circle-outline" size={18} color={colors.info} /><Text style={styles.miInfoText}>Insurance company is required for both MI and NON-MI.</Text></View>
      </View>
    </View>}
  </SectionCard>;
}
