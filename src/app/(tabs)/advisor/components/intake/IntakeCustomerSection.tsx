import { TextInput } from "../../../../../components/inputs/KeyboardAware";

import { colors } from "../../../../../theme";
import { FieldLabel, SectionCard } from "./IntakeUI";

type IntakeCustomerSectionProps = {
  customerName: string;
  customerMobile: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerMobileChange: (value: string) => void;
  normalizeMobile: (value: string) => string;
  maxMobileLength: number;
  styles: any;
};

export default function IntakeCustomerSection({
  customerName,
  customerMobile,
  onCustomerNameChange,
  onCustomerMobileChange,
  normalizeMobile,
  maxMobileLength,
  styles,
}: IntakeCustomerSectionProps) {
  return (
    <SectionCard
      eyebrow="02"
      title="Customer Details"
      subtitle="Enter the customer information for this workshop visit."
      styles={styles}
    >
      <FieldLabel label="Customer Name" required styles={styles} />

      <TextInput
        value={customerName}
        onChangeText={onCustomerNameChange}
        placeholder="Enter customer name"
        placeholderTextColor={colors.textLight}
        style={styles.input}
        autoCapitalize="words"
      />

      <FieldLabel label="Customer Mobile Number" required styles={styles} />

      <TextInput
        value={customerMobile}
        onChangeText={(value) =>
          onCustomerMobileChange(normalizeMobile(value))
        }
        placeholder="10-digit mobile number"
        placeholderTextColor={colors.textLight}
        style={styles.input}
        keyboardType="phone-pad"
        maxLength={maxMobileLength}
      />
    </SectionCard>
  );
}
