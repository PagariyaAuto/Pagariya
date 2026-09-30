
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing, typography } from "../../src/theme";

type ApprovalStatus = "APPROVED" | "REJECTED" | "PARTIAL";
type ApprovalSource = "CUSTOMER" | "INSURANCE";
type PartialChoice = "PAY_REMAINDER" | "REPAIR_APPROVED_SCOPE";
type RejectionChoice = "CONVERT_TO_PAID" | "RETURN_VEHICLE";

type VehicleJob = {
  id: string;
  vehicle_id: string;
  job_type: "INSURANCE" | "PAID";
  approval_status: string;
  approval_by_type: string | null;
  approval_at: string | null;
  approval_remarks: string | null;
  partial_approval_choice: string | null;
};

type Props = {
  vehicleId: string;
  job: VehicleJob;
  currentUserRole: string | null;
  onCompleted: () => Promise<void> | void;
  showMessage: (title: string, message: string) => void;
};

export default function ApprovalStage({
  vehicleId,
  job,
  currentUserRole,
  onCompleted,
  showMessage,
}: Props) {
  const [source, setSource] = useState<ApprovalSource>(
    job.approval_by_type === "INSURANCE" ? "INSURANCE" : "CUSTOMER"
  );
  const [decision, setDecision] = useState<ApprovalStatus | null>(null);
  const [partialChoice, setPartialChoice] = useState<PartialChoice | null>(
    null
  );
  const [remarks, setRemarks] = useState("");
  const [rejectionChoice, setRejectionChoice] =
    useState<RejectionChoice | null>(null);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit =
    currentUserRole === "advisor" || currentUserRole === "ceo_admin";

  const isInsuranceRejected =
    job.job_type === "INSURANCE" && job.approval_status === "REJECTED";

  const isWaitingForPaidApproval =
    job.job_type === "PAID" && job.approval_status === "PENDING";

  const formatLabel = (value: string) =>
    value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  const saveApproval = async () => {
    if (!canSubmit) {
      showMessage("Permission Denied", "Only the assigned Advisor or CEO Admin can record approval.");
      return;
    }

    if (!decision) {
      showMessage("Decision Required", "Please select an approval decision.");
      return;
    }

    if (decision === "PARTIAL" && !partialChoice) {
      showMessage("Partial Approval Option Required", "Please select what should happen with the partial approval.");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc("record_vehicle_approval", {
        p_vehicle_id: vehicleId,
        p_approval_status: decision,
        p_approval_by_type: source,
        p_approval_remarks: remarks.trim() || null,
        p_partial_approval_choice:
          decision === "PARTIAL" ? partialChoice : null,
      });

      if (error) throw error;

    if (job.job_type === "INSURANCE" && decision === "REJECTED") {
        showMessage(
          "Insurance Rejection Recorded",
          "The rejection has been recorded. Select the customer's choice below to continue."
        );
        await onCompleted();
      } else if (job.job_type === "PAID" && decision === "REJECTED") {
        showMessage(
          "Vehicle Return Initiated",
          "The paid job was rejected and the vehicle has been moved to Gate Out Pending."
        );
        await onCompleted();
      } else if (
            decision === "PARTIAL" &&
            partialChoice === "PAY_REMAINDER"
            ) {
            showMessage(
                "Partial Insurance Approval Recorded",
                "The job remains an Insurance job. The customer will pay the remainder, and the vehicle has moved to Floor for the full repair."
            );
            await onCompleted();
      } else {
        showMessage(
          "Approval Recorded",
          "Approval was saved and the vehicle has moved to Floor."
        );
        await onCompleted();
      }
    } catch (error: any) {
      showMessage("Unable to Record Approval", error?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const resolveInsuranceRejection = async () => {
    if (!rejectionChoice) {
      showMessage("Customer Choice Required", "Please select whether to convert the job to Paid or return the vehicle.");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc("resolve_insurance_rejection", {
        p_vehicle_id: vehicleId,
        p_customer_choice: rejectionChoice,
        p_remarks: resolutionRemarks.trim() || null,
      });

      if (error) throw error;

      showMessage(
        rejectionChoice === "CONVERT_TO_PAID"
          ? "Converted to Paid"
          : "Vehicle Return Initiated",
        rejectionChoice === "CONVERT_TO_PAID"
          ? "The job is now Paid. Record the customer's paid-job approval before proceeding."
          : "The vehicle has been moved to Gate Out Pending."
      );

      await onCompleted();
    } catch (error: any) {
      showMessage("Unable to Resolve Rejection", error?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="clipboard-outline" size={23} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Approval</Text>
          <Text style={styles.subtitle}>Review the survey and record the decision.</Text>
        </View>
      </View>

      {job.approval_status !== "PENDING" && (
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Current decision</Text>
          <Text style={styles.statusValue}>{formatLabel(job.approval_status)}</Text>
        </View>
      )}

      {isWaitingForPaidApproval && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            This job is Paid and is waiting for the customer's approval. Once the required approval is recorded, submit the approval decision below.
          </Text>
        </View>
      )}

      {isInsuranceRejected ? (
        <>
          <Text style={styles.label}>Customer's choice</Text>
          <OptionButton
            label="Convert this job to Paid"
            selected={rejectionChoice === "CONVERT_TO_PAID"}
            onPress={() => setRejectionChoice("CONVERT_TO_PAID")}
          />
          <OptionButton
            label="Return the vehicle"
            selected={rejectionChoice === "RETURN_VEHICLE"}
            onPress={() => setRejectionChoice("RETURN_VEHICLE")}
          />

          <Text style={styles.label}>Remarks (optional)</Text>
          <TextInput
            value={resolutionRemarks}
            onChangeText={setResolutionRemarks}
            placeholder="Enter remarks"
            placeholderTextColor={colors.textLight}
            multiline
            style={[styles.input, styles.textArea]}
          />

          {canSubmit && (
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabled]}
              onPress={resolveInsuranceRejection}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Save Customer Choice</Text>}
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>Approval source</Text>
          <View style={styles.optionsRow}>
            <OptionButton
              label="Customer"
              selected={source === "CUSTOMER"}
              onPress={() => setSource("CUSTOMER")}
            />
            <OptionButton
              label="Insurance"
              selected={source === "INSURANCE"}
              onPress={() => setSource("INSURANCE")}
            />
          </View>

          <Text style={styles.label}>Decision</Text>
          {(["APPROVED", "REJECTED", "PARTIAL"] as ApprovalStatus[]).map((item) => (
            <OptionButton
              key={item}
              label={formatLabel(item)}
              selected={decision === item}
              onPress={() => {
                setDecision(item);
                if (item !== "PARTIAL") setPartialChoice(null);
              }}
            />
          ))}

          {decision === "PARTIAL" && (
            <>
              <Text style={styles.label}>Partial approval action</Text>
              <OptionButton
                label="Customer will pay the remainder"
                selected={partialChoice === "PAY_REMAINDER"}
                onPress={() => setPartialChoice("PAY_REMAINDER")}
              />
              <OptionButton
                label="Repair only the approved scope"
                selected={partialChoice === "REPAIR_APPROVED_SCOPE"}
                onPress={() => setPartialChoice("REPAIR_APPROVED_SCOPE")}
              />
            </>
          )}

          <Text style={styles.label}>Remarks (optional)</Text>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Enter approval remarks"
            placeholderTextColor={colors.textLight}
            multiline
            style={[styles.input, styles.textArea]}
          />

          {canSubmit && (
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabled]}
              onPress={saveApproval}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Save Approval Decision</Text>
              )}
            </TouchableOpacity>
          )}

          {!canSubmit && (
            <Text style={styles.helper}>
              Approval can be recorded by the assigned Advisor or CEO Admin.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
      activeOpacity={0.8}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark-circle" size={19} color={colors.primary} />}
    </TouchableOpacity>
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
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  iconBox: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  headerText: { flex: 1, marginLeft: spacing.md },
  title: { ...typography.subheading, color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  statusBox: {
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.infoLight, marginBottom: spacing.md,
  },
  statusLabel: { fontSize: 12, color: colors.textSecondary },
  statusValue: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 3 },
  notice: {
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.warningLight, marginBottom: spacing.md,
  },
  noticeText: { fontSize: 13, lineHeight: 19, color: colors.text },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  optionsRow: { flexDirection: "row", gap: spacing.sm },
  option: {
    minHeight: 46, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "600" },
  optionTextSelected: { color: colors.primary },
  input: {
    minHeight: 46, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, color: colors.text, fontSize: 14,
  },
  textArea: { minHeight: 90, paddingTop: spacing.md, textAlignVertical: "top" },
  primaryButton: {
    minHeight: 50, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginTop: spacing.lg,
  },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.65 },
  helper: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.md },
});