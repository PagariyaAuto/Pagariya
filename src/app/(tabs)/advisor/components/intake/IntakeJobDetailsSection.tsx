import { TextInput } from "../../../../../components/inputs/KeyboardAware";
import { Text } from "react-native";
import { colors } from "../../../../../theme";
import { FieldLabel, SectionCard } from "./IntakeUI";

type Props = {
  jobCardNo: string;
  advisorRemarks: string;
  onJobCardNoChange: (value: string) => void;
  onAdvisorRemarksChange: (value: string) => void;
  styles: any;
};

export function IntakeJobDetailsSection({
  jobCardNo,
  advisorRemarks,
  onJobCardNoChange,
  onAdvisorRemarksChange,
  styles,
}: Props) {
  return (
    <>
      <SectionCard
        eyebrow="09"
        title="Job Card"
        subtitle="Enter the job card number for this vehicle."
        styles={styles}
      >
        <FieldLabel label="Job Card No." required styles={styles} />
        <TextInput
          value={jobCardNo}
          onChangeText={onJobCardNoChange}
          placeholder="Enter Job Card No."
          placeholderTextColor={colors.textLight}
          style={styles.input}
          autoCapitalize="characters"
        />
      </SectionCard>

      <SectionCard
        eyebrow="10"
        title="Advisor Remarks"
        subtitle="Add any relevant intake observation or note."
        styles={styles}
      >
        <TextInput
          value={advisorRemarks}
          onChangeText={onAdvisorRemarksChange}
          placeholder="Enter remarks if required"
          placeholderTextColor={colors.textLight}
          style={[styles.input, styles.multilineInput]}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.optionalText}>Optional</Text>
      </SectionCard>
    </>
  );
}
