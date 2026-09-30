import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    StyleSheet,
    Text,
    View,
} from "react-native";

const COLORS = {
  red: "#C62828",
  charcoal: "#171717",
  white: "#FFFFFF",
  text: "#171717",
  textSecondary: "#6B6B6B",
  textMuted: "#999999",
  border: "#E7E5E2",
  redSoft: "#FDECEC",
  green: "#16845B",
  graySoft: "#F0F0EE",
};

type RelatedRow = Record<string, any>;

type Vehicle = {
  id: string;
  vehicle_no: string;
  jc_no: string | null;
  model: string | null;
  arena_nexa: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_type: string | null;
  vehicle_model_id: string | null;
  current_status: string;
  current_stage: string;
  current_assigned_to: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  stage_started_at: string | null;
};

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

type VehicleSummaryProps = {
  vehicle: Vehicle;
  assignedProfile: Profile | null;
  vehicleModel: RelatedRow | null;
  currentJob: RelatedRow | null;
  priority: string;
};

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function prettyText(
  value: string | null | undefined
) {
  if (!value) return "—";

  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

/**
 * Resolve the actual Job Card number.
 *
 * Important:
 * vehicle.jc_no may contain incorrect/legacy data such as
 * the vehicle model. Prefer the current job-card record first.
 */
function getJobCardNumber(
  vehicle: Vehicle,
  currentJob: RelatedRow | null
) {
  const jobCardValue =
    currentJob?.jc_no ||
    currentJob?.job_card_no ||
    currentJob?.jobCardNo ||
    currentJob?.job_card_number;

  if (
    jobCardValue &&
    String(jobCardValue).trim()
  ) {
    return String(jobCardValue);
  }

  if (
    vehicle.jc_no &&
    String(vehicle.jc_no).trim() &&
    String(vehicle.jc_no).toLowerCase() !==
      String(vehicle.model || "").toLowerCase()
  ) {
    return String(vehicle.jc_no);
  }

  return "—";
}

export default function VehicleSummary({
  vehicle,
  assignedProfile,
  vehicleModel,
  currentJob,
  priority,
}: VehicleSummaryProps) {
  const jobCardNumber = getJobCardNumber(
    vehicle,
    currentJob
  );

  const modelName =
    vehicleModel?.name ||
    vehicle.model ||
    "—";

  return (
    <>
      {/* =========================================================
          TOP SUMMARY
          ========================================================= */}
      <View style={styles.summaryGrid}>
        <SummaryItem
          icon="document-text-outline"
          label="Job Card"
          value={jobCardNumber}
        />

        <SummaryItem
          icon="car-outline"
          label="Model"
          value={modelName}
        />

        <SummaryItem
          icon="person-outline"
          label="Advisor"
          value={
            assignedProfile?.name ||
            "Unassigned"
          }
        />

        <SummaryItem
          icon="calendar-outline"
          label="Created"
          value={formatDate(
            vehicle.created_at
          )}
        />
      </View>

      {/* =========================================================
          VEHICLE INFORMATION
          ========================================================= */}
      <SectionCard
        title="Vehicle Information"
        icon="car-outline"
      >
        <InfoGrid>
          <InfoItem
            label="Registration No."
            value={vehicle.vehicle_no}
          />

          <InfoItem
            label="Job Card No."
            value={jobCardNumber}
          />

          <InfoItem
            label="Model"
            value={modelName}
          />

          <InfoItem
            label="Brand / Variant"
            value={vehicle.arena_nexa}
          />

          <InfoItem
            label="Vehicle Type"
            value={vehicle.vehicle_type}
          />

          <InfoItem
            label="Status"
            value={prettyText(
              vehicle.current_status
            )}
          />
        </InfoGrid>
      </SectionCard>

      {/* =========================================================
          CUSTOMER INFORMATION
          ========================================================= */}
      <SectionCard
        title="Customer Information"
        icon="person-outline"
      >
        <InfoGrid>
          <InfoItem
            label="Customer Name"
            value={vehicle.customer_name}
          />

          <InfoItem
            label="Mobile Number"
            value={vehicle.customer_mobile}
          />
        </InfoGrid>
      </SectionCard>

      {/* =========================================================
          ASSIGNMENT
          ========================================================= */}
      <SectionCard
        title="Assignment"
        icon="people-outline"
      >
        <View style={styles.assignmentCard}>
          <View style={styles.assignmentAvatar}>
            <Ionicons
              name="person"
              size={22}
              color={COLORS.red}
            />
          </View>

          <View style={styles.assignmentInfo}>
            <Text style={styles.assignmentName}>
              {assignedProfile?.name ||
                "Not Assigned"}
            </Text>

            <Text style={styles.assignmentRole}>
              {assignedProfile?.role
                ? prettyText(
                    assignedProfile.role
                  )
                : "No advisor assigned"}
            </Text>

            {assignedProfile?.phone ? (
              <Text style={styles.assignmentPhone}>
                {assignedProfile.phone}
              </Text>
            ) : null}
          </View>
        </View>
      </SectionCard>

      {/* =========================================================
          CURRENT JOB CARD
          ========================================================= */}
      <SectionCard
        title="Current Job Card"
        icon="clipboard-outline"
      >
        {currentJob ? (
          <View>
            <InfoGrid>
              <InfoItem
                label="Job ID"
                value={
                  currentJob.jc_no ||
                  currentJob.job_card_no ||
                  currentJob.job_card_number ||
                  currentJob.id
                }
              />

              <InfoItem
                label="Status"
                value={prettyText(
                  currentJob.status
                )}
              />

              <InfoItem
                label="Created"
                value={formatDateTime(
                  currentJob.created_at
                )}
              />

              <InfoItem
                label="Updated"
                value={formatDateTime(
                  currentJob.updated_at
                )}
              />
            </InfoGrid>

            {currentJob.remarks ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>
                  Remarks
                </Text>

                <Text style={styles.noteText}>
                  {String(
                    currentJob.remarks
                  )}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <EmptySection
            text="No job card information available."
          />
        )}
      </SectionCard>

      {/* =========================================================
          JOB INFORMATION
          ========================================================= */}
      <SectionCard
        title="Job Information"
        icon="construct-outline"
      >
        {currentJob ? (
          <InfoGrid>
            <InfoItem
              label="Work Type"
              value={
                currentJob.work_type ||
                currentJob.job_type ||
                currentJob.category
              }
            />

            <InfoItem
              label="Priority"
              value={prettyText(
                currentJob.priority ||
                  priority
              )}
            />

            <InfoItem
              label="Assigned To"
              value={
                currentJob.assigned_to_name ||
                assignedProfile?.name
              }
            />

            <InfoItem
              label="Started"
              value={formatDateTime(
                currentJob.started_at ||
                  currentJob.created_at
              )}
            />

            <InfoItem
              label="Completed"
              value={formatDateTime(
                currentJob.completed_at
              )}
            />
          </InfoGrid>
        ) : (
          <EmptySection
            text="No job information available."
          />
        )}
      </SectionCard>
    </>
  );
}

/* =============================================================
   TOP SUMMARY ITEM
   ============================================================= */

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.summaryItem}>
      <View style={styles.summaryIcon}>
        <Ionicons
          name={icon}
          size={17}
          color={COLORS.red}
        />
      </View>

      <View style={styles.summaryText}>
        <Text style={styles.summaryLabel}>
          {label}
        </Text>

        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={styles.summaryValue}
        >
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

/* =============================================================
   SECTION CARD
   ============================================================= */

function SectionCard({
  title,
  icon,
  rightText,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  rightText?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleArea}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name={icon}
              size={18}
              color={COLORS.red}
            />
          </View>

          <Text style={styles.sectionTitle}>
            {title}
          </Text>
        </View>

        {rightText ? (
          <Text style={styles.sectionRightText}>
            {rightText}
          </Text>
        ) : null}
      </View>

      <View style={styles.sectionBody}>
        {children}
      </View>
    </View>
  );
}

/* =============================================================
   INFO GRID
   ============================================================= */

function InfoGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <View style={styles.infoGrid}>
      {children}
    </View>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value
          ? prettyText(value)
          : "—"}
      </Text>
    </View>
  );
}

/* =============================================================
   EMPTY STATE
   ============================================================= */

function EmptySection({
  text,
}: {
  text: string;
}) {
  return (
    <View style={styles.emptySection}>
      <Ionicons
        name="information-circle-outline"
        size={21}
        color={COLORS.textMuted}
      />

      <Text style={styles.emptySectionText}>
        {text}
      </Text>
    </View>
  );
}

/* =============================================================
   STYLES
   ============================================================= */

const styles = StyleSheet.create({
  /*
   * TOP SUMMARY
   *
   * Compact 2 x 2 layout.
   * No large enclosing card so it does not create
   * the empty white area seen in the screenshot.
   */
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
    marginBottom: 7,
  },

  summaryItem: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
  },

  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  summaryText: {
    flex: 1,
    minWidth: 0,
  },

  summaryLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "700",
    marginBottom: 2,
  },

  summaryValue: {
    fontSize: 13,
    color: COLORS.charcoal,
    fontWeight: "800",
  },

  /*
   * SECTION CARD
   */
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    overflow: "hidden",
  },

  sectionHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitleArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.charcoal,
  },

  sectionRightText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "700",
  },

  sectionBody: {
    padding: 14,
  },

  /*
   * INFORMATION GRID
   */
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },

  infoItem: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 14,
  },

  infoLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "700",
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 18,
  },

  /*
   * ASSIGNMENT
   */
  assignmentCard: {
    flexDirection: "row",
    alignItems: "center",
  },

  assignmentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  assignmentInfo: {
    flex: 1,
  },

  assignmentName: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.charcoal,
    marginBottom: 3,
  },

  assignmentRole: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  assignmentPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },

  /*
   * NOTES
   */
  noteBox: {
    backgroundColor: COLORS.graySoft,
    borderRadius: 10,
    padding: 11,
    marginTop: 3,
  },

  noteLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "800",
    marginBottom: 4,
  },

  noteText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.text,
    fontWeight: "600",
  },

  /*
   * EMPTY STATE
   */
  emptySection: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  emptySectionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
});