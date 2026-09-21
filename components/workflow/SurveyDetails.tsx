
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";

import PhotoGallery from "../PhotoGallery";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../src/theme";

type VehicleJob = {
  id: string;
  vehicle_id: string;
  advisor_id: string | null;
  job_type: "INSURANCE" | "PAID";
  job_card_no: string | null;
  vehicle_type: string | null;
  arena_nexa: string | null;
  insurance_company_id: string | null;
  claim_intimation_at: string | null;
  estimate_id: string | null;
  claim_no: string | null;
  survey_at: string | null;
  approval_status: string;
  approval_by_type: string | null;
  approval_at: string | null;
  approval_remarks: string | null;
  partial_approval_choice: string | null;
  customer_approval_at: string | null;
  paid_job_remarks: string | null;
  advisor_remarks: string | null;
  current_job_stage: string;
  created_at: string;
  updated_at: string;
};

type InsuranceCompany = {
  id: string;
  name: string;
};

type PhotoItem = {
  id: string;
  uri: string;
  status:
    | "pending"
    | "uploading"
    | "uploaded"
    | "failed";
  progress?: number;
  storagePath?: string;
};

type Props = {
  surveyJob: VehicleJob;
  insuranceCompanies: InsuranceCompany[];
  photos: PhotoItem[];
  formatDateTime: (date: Date) => string;
  onViewPhoto: (photo: PhotoItem) => void;

  // CEO Admin uploaded-photo deletion controls.
  canDeletePhotos: boolean;
  onDeletePhoto: (photo: PhotoItem) => void;
};

export default function SurveyDetails({
  surveyJob,
  insuranceCompanies,
  photos,
  formatDateTime,
  onViewPhoto,
  canDeletePhotos,
  onDeletePhoto,
}: Props) {
  const insuranceCompanyName =
    insuranceCompanies.find(
      (company) =>
        company.id === surveyJob.insurance_company_id
    )?.name || "Not available";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons
            name="checkmark-circle-outline"
            size={22}
            color={colors.success}
          />
        </View>

        <Text style={styles.cardTitle}>
          Survey Submitted
        </Text>
      </View>

      <View style={styles.surveyStatusBox}>
        <View style={styles.surveyStatusIcon}>
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={colors.success}
          />
        </View>

        <View style={styles.surveyStatusContent}>
          <Text style={styles.surveyStatusTitle}>
            Survey Submitted Successfully
          </Text>

          <Text style={styles.surveyStatusText}>
            The survey has been submitted. Survey details are read-only.
          </Text>
        </View>
      </View>

      <InfoRow
        label="Job Type"
        value={surveyJob.job_type}
      />

      <InfoRow
        label="Job Card No."
        value={surveyJob.job_card_no || "Not provided"}
      />

      {surveyJob.job_type === "INSURANCE" && (
        <>
          <InfoRow
            label="Insurance Company"
            value={insuranceCompanyName}
          />

          <InfoRow
            label="Estimate ID"
            value={surveyJob.estimate_id || "Not provided"}
          />

          <InfoRow
            label="Claim No."
            value={surveyJob.claim_no || "Not provided"}
          />

          <InfoRow
            label="Claim Intimation"
            value={
              surveyJob.claim_intimation_at
                ? formatDateTime(
                    new Date(surveyJob.claim_intimation_at)
                  )
                : "Not provided"
            }
          />
        </>
      )}

      <InfoRow
        label="Survey Date & Time"
        value={
          surveyJob.survey_at
            ? formatDateTime(new Date(surveyJob.survey_at))
            : "Not provided"
        }
      />

      {surveyJob.job_type === "PAID" && (
        <>
          <InfoRow
            label="Customer Approval"
            value={
              surveyJob.customer_approval_at
                ? formatDateTime(
                    new Date(surveyJob.customer_approval_at)
                  )
                : "Not provided"
            }
          />

          <InfoRow
            label="Paid Job Remarks"
            value={surveyJob.paid_job_remarks || "No remarks"}
          />
        </>
      )}

      <InfoRow
        label="Advisor Remarks"
        value={surveyJob.advisor_remarks || "No remarks"}
      />

            <InfoRow
        label="Approval Status"
        value={surveyJob.approval_status || "PENDING"}
      />

      {surveyJob.approval_by_type && (
        <InfoRow
          label="Approval Source"
          value={surveyJob.approval_by_type}
        />
      )}

      {surveyJob.approval_at && (
        <InfoRow
          label="Approval Date"
          value={formatDateTime(new Date(surveyJob.approval_at))}
        />
      )}

      {surveyJob.partial_approval_choice && (
        <InfoRow
          label="Partial Choice"
          value={surveyJob.partial_approval_choice.replaceAll("_", " ")}
        />
      )}

      {surveyJob.approval_remarks && (
        <InfoRow
          label="Approval Remarks"
          value={surveyJob.approval_remarks}
        />
      )}

      <View style={styles.surveyPhotoSection}>
        <View style={styles.surveyPhotoHeader}>
          <Text style={styles.surveyPhotoTitle}>
            Survey Photos
          </Text>

          <Text style={styles.surveyPhotoCount}>
            {photos.length} photo{photos.length === 1 ? "" : "s"}
          </Text>
        </View>

        <PhotoGallery
          photos={photos}
          onAddPhoto={() => {}}
          onRemovePhoto={() => {}}
          onViewPhoto={onViewPhoto}
          readOnly
          canDeleteUploaded={canDeletePhotos}
          onDeleteUploadedPhoto={onDeletePhoto}
        />
      </View>

      {!(
        surveyJob.approval_status === "APPROVED" ||
        (
          surveyJob.approval_status === "PARTIAL" &&
          (
            surveyJob.partial_approval_choice === "PAY_REMAINDER" ||
            surveyJob.partial_approval_choice === "REPAIR_APPROVED_SCOPE"
          )
        )
      ) && (
        <View style={styles.nextStageInfoBox}>
          <Ionicons
            name="arrow-forward-circle-outline"
            size={21}
            color={colors.info}
          />

          <View style={styles.nextStageInfoContent}>
            <Text style={styles.nextStageInfoTitle}>
              {surveyJob.approval_status === "REJECTED"
                ? "Next Step: Resolve Rejection"
                : "Next Stage: Approval"}
            </Text>

            <Text style={styles.nextStageInfoText}>
              {surveyJob.approval_status === "REJECTED"
                ? "The customer's choice is required to resolve the rejection."
                : "Record the approval decision to continue the workflow."}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value}
      </Text>
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
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    ...typography.subheading,
    color: colors.text,
    marginLeft: spacing.md,
  },

  surveyStatusBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  surveyStatusIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  surveyStatusContent: {
    flex: 1,
    marginLeft: spacing.md,
  },

  surveyStatusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },

  surveyStatusText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 3,
  },

  infoRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  infoLabel: {
    width: 125,
    fontSize: 13,
    color: colors.textSecondary,
  },

  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },

  surveyPhotoSection: {
    marginTop: spacing.lg,
  },

  surveyPhotoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },

  surveyPhotoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  surveyPhotoCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  nextStageInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.infoLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },

  nextStageInfoContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  nextStageInfoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  nextStageInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});