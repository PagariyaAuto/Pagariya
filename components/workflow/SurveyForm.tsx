import useVisitDateTimeBounds from "../../src/components/inputs/useVisitDateTimeBounds";
import DateTimeField from "../../src/components/inputs/DateTimeField";
import { TextInput } from "../../src/components/inputs/KeyboardAware";

import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import {
  colors,
  radius,
  spacing,
} from "../../src/theme";

type InsuranceCompany = {
  id: string;
  name: string;
};

type Props = {
  visitId: string;
  onDateTimeValidationError: (field: "claim" | "survey" | "approval", error: string | null) => void;
  jobType: "INSURANCE" | "PAID" | null;
  setJobType: (value: "INSURANCE" | "PAID") => void;

  jobCardNo: string;
  setJobCardNo: (value: string) => void;

  selectedInsuranceCompany: string | null;
  setSelectedInsuranceCompany: (value: string | null) => void;

  insuranceCompanies: InsuranceCompany[];
  onOpenInsuranceDropdown: () => void;

  claimIntimationAt: string;
  setClaimIntimationAt: (value: string) => void;

  estimateId: string;
  setEstimateId: (value: string) => void;

  claimNo: string;
  setClaimNo: (value: string) => void;

  surveyAt: string;
  setSurveyAt: (value: string) => void;

  getPickerLabel: (value: string, placeholder: string) => string;
  onOpenDateTimePicker: (target: "claim" | "survey") => void;

  customerApprovalAt: string;
  setCustomerApprovalAt: (value: string) => void;

  paidJobRemarks: string;
  setPaidJobRemarks: (value: string) => void;

  advisorRemarks: string;
  setAdvisorRemarks: (value: string) => void;
};

// Store the current instant as an ISO timestamp.
// Supabase can store this correctly as timestamptz.
const getCurrentTimestamp = () => new Date().toISOString();

// Display timestamps in Indian Standard Time.
const formatIndianDateTime = (value: string) => {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function SurveyForm({
  visitId, onDateTimeValidationError,
  jobType,
  setJobType,
  jobCardNo,
  setJobCardNo,
  selectedInsuranceCompany,
  setSelectedInsuranceCompany,
  insuranceCompanies,
  onOpenInsuranceDropdown,
  claimIntimationAt,
  setClaimIntimationAt,
  estimateId,
  setEstimateId,
  claimNo,
  setClaimNo,
  surveyAt,
  setSurveyAt,
  getPickerLabel,
  onOpenDateTimePicker,
  customerApprovalAt,
  setCustomerApprovalAt,
  paidJobRemarks,
  setPaidJobRemarks,
  advisorRemarks,
  setAdvisorRemarks,
}: Props) {
  const visitDates = useVisitDateTimeBounds(visitId);
  const isWeb = Platform.OS === "web";

  const handleSelectInsurance = () => {
    setJobType("INSURANCE");
    setCustomerApprovalAt("");
    setPaidJobRemarks("");

    if (isWeb) {
      const now = getCurrentTimestamp();
      setClaimIntimationAt(now);
      setSurveyAt(now);
    }
  };

  const handleSelectPaid = () => {
    setJobType("PAID");
    setSelectedInsuranceCompany(null);
    setClaimIntimationAt("");
    setEstimateId("");
    setClaimNo("");

    if (isWeb) {
      const now = getCurrentTimestamp();
      setSurveyAt(now);
      setCustomerApprovalAt(now);
    } else {
      setCustomerApprovalAt("");
    }
  };

  const renderDateTime = (value: string, placeholder: string, target: "claim" | "survey") =>
    <DateTimeField {...visitDates.bounds()} error={visitDates.error} onValidationError={error => onDateTimeValidationError(target, error)} title={target === "claim" ? "Claim Intimation" : "Survey Date & Time"} value={value || null}
      onChange={next => (target === "claim" ? setClaimIntimationAt : setSurveyAt)(next || "")} />;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons
            name="clipboard-outline"
            size={22}
            color={colors.primary}
          />
        </View>

        <Text style={styles.cardTitle}>Survey</Text>
      </View>

      <Text style={styles.fieldLabel}>Job Type</Text>

      <View style={styles.jobTypeRow}>
        <TouchableOpacity
          style={[
            styles.jobTypeButton,
            jobType === "INSURANCE" && styles.jobTypeButtonSelected,
          ]}
          onPress={handleSelectInsurance}
          activeOpacity={0.8}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={jobType === "INSURANCE" ? colors.white : colors.primary}
          />

          <Text
            style={[
              styles.jobTypeText,
              jobType === "INSURANCE" && styles.jobTypeTextSelected,
            ]}
          >
            Insurance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.jobTypeButton,
            jobType === "PAID" && styles.jobTypeButtonSelected,
          ]}
          onPress={handleSelectPaid}
          activeOpacity={0.8}
        >
          <Ionicons
            name="cash-outline"
            size={20}
            color={jobType === "PAID" ? colors.white : colors.primary}
          />

          <Text
            style={[
              styles.jobTypeText,
              jobType === "PAID" && styles.jobTypeTextSelected,
            ]}
          >
            Paid
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Job Card Number</Text>

      <TextInput
        style={styles.input}
        value={jobCardNo}
        onChangeText={setJobCardNo}
        placeholder="Enter job card number"
        placeholderTextColor={colors.textLight}
      />

      {jobType === "INSURANCE" && (
        <>
          <Text style={styles.fieldLabel}>Insurance Company</Text>

          <TouchableOpacity
            style={styles.dropdown}
            onPress={onOpenInsuranceDropdown}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dropdownText,
                !selectedInsuranceCompany && styles.placeholderText,
              ]}
            >
              {selectedInsuranceCompany
                ? insuranceCompanies.find(
                    (company) => company.id === selectedInsuranceCompany
                  )?.name || "Select insurance company"
                : "Select insurance company"}
            </Text>

            <Ionicons
              name="chevron-down"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Estimate ID</Text>

          <TextInput
            style={styles.input}
            value={estimateId}
            onChangeText={setEstimateId}
            placeholder="Enter estimate ID"
            placeholderTextColor={colors.textLight}
            autoCapitalize="characters"
          />

          <Text style={styles.fieldLabel}>Claim Number</Text>

          <TextInput
            style={styles.input}
            value={claimNo}
            onChangeText={setClaimNo}
            placeholder="Enter claim number"
            placeholderTextColor={colors.textLight}
            autoCapitalize="characters"
          />

          <Text style={styles.fieldLabel}>Claim Intimation</Text>

          {renderDateTime(
            claimIntimationAt,
            "Current Indian date & time",
            "claim"
          )}
        </>
      )}

      <Text style={styles.fieldLabel}>Survey Date & Time</Text>

      {renderDateTime(
        surveyAt,
        "Current Indian date & time",
        "survey"
      )}

      {jobType === "PAID" && (
        <>
          <Text style={styles.fieldLabel}>Customer Approval</Text>

          <DateTimeField {...visitDates.bounds()} error={visitDates.error} onValidationError={error => onDateTimeValidationError("approval", error)} title="Customer Approval" value={customerApprovalAt || null} onChange={next => setCustomerApprovalAt(next || "")} />

          <Text style={styles.fieldLabel}>Paid Job Remarks</Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            value={paidJobRemarks}
            onChangeText={setPaidJobRemarks}
            placeholder="Enter paid job remarks"
            placeholderTextColor={colors.textLight}
            multiline
            textAlignVertical="top"
          />
        </>
      )}



      <Text style={styles.fieldLabel}>Advisor Remarks</Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        value={advisorRemarks}
        onChangeText={setAdvisorRemarks}
        placeholder="Enter survey remarks"
        placeholderTextColor={colors.textLight}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },

  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginLeft: spacing.md,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  jobTypeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  jobTypeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  jobTypeButtonSelected: {
    backgroundColor: colors.primary,
  },

  jobTypeText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },

  jobTypeTextSelected: {
    color: colors.white,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
  },

  textArea: {
    height: 100,
    paddingTop: spacing.md,
  },

  dateTimeButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateTimeText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginRight: spacing.sm,
  },

  timestampNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  dropdown: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownText: {
    fontSize: 14,
    color: colors.text,
  },

  placeholderText: {
    color: colors.textLight,
  },
});