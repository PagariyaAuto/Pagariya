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
  textSecondary: "#6B6B6B",
  textMuted: "#999999",
  border: "#E7E5E2",
  redSoft: "#FDECEC",
  green: "#16845B",
  graySoft: "#F0F0EE",
};

const STAGE_LABELS: Record<string, string> = {
  GATE_IN: "Gate In",
  ADVISOR: "Advisor",
  SURVEY: "Survey",
  APPROVAL: "Approval",
  FLOOR: "Floor",
  READY: "Ready",
  FINAL_INSPECTION: "Final Inspection",
  READY_FOR_DELIVERY: "Ready for Delivery",
  GATE_OUT_PENDING: "Gate Out Pending",
  GATE_OUT: "Gate Out",
};

type StageProgressProps = {
  relevantStages: string[];
  normalizedCurrentStage: string | null;
};

export default function StageProgress({
  relevantStages,
  normalizedCurrentStage,
}: StageProgressProps) {
  return (
    <SectionCard
      title="Stage Progress"
      icon="git-network-outline"
    >
      {relevantStages.length > 0 ? (
        <View style={styles.timeline}>
          {relevantStages.map((stage, index) => {
            const isCurrent =
              normalizedCurrentStage === stage;

            const isCompleted = !isCurrent;

            const isLast =
              index === relevantStages.length - 1;

            return (
              <View
                key={stage}
                style={styles.timelineItem}
              >
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineDot,
                      isCompleted &&
                        styles.timelineDotCompleted,
                      isCurrent &&
                        styles.timelineDotCurrent,
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={COLORS.white}
                      />
                    ) : (
                      <View
                        style={styles.timelineDotInner}
                      />
                    )}
                  </View>

                  {!isLast ? (
                    <View
                      style={[
                        styles.timelineLine,
                        isCompleted &&
                          styles.timelineLineCompleted,
                      ]}
                    />
                  ) : null}
                </View>

                <View
                  style={[
                    styles.timelineContent,
                    isCurrent &&
                      styles.timelineContentCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.timelineTitle,
                      isCurrent &&
                        styles.timelineTitleCurrent,
                    ]}
                  >
                    {STAGE_LABELS[stage] ||
                      prettyText(stage)}
                  </Text>

                  <Text
                    style={styles.timelineStatus}
                  >
                    {isCurrent
                      ? "Current Stage"
                      : "Completed"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptySection
          text="No stage progress recorded yet."
        />
      )}
    </SectionCard>
  );
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

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
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
      </View>

      <View style={styles.sectionBody}>
        {children}
      </View>
    </View>
  );
}

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

const styles = StyleSheet.create({
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

  sectionBody: {
    padding: 14,
  },

  timeline: {
    paddingVertical: 2,
  },

  timelineItem: {
    flexDirection: "row",
    minHeight: 58,
  },

  timelineRail: {
    width: 34,
    alignItems: "center",
  },

  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.graySoft,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  timelineDotCompleted: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },

  timelineDotCurrent: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },

  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },

  timelineLine: {
    position: "absolute",
    top: 24,
    bottom: -1,
    width: 2,
    backgroundColor: COLORS.border,
  },

  timelineLineCompleted: {
    backgroundColor: COLORS.green,
  },

  timelineContent: {
    flex: 1,
    marginLeft: 9,
    paddingBottom: 14,
    paddingTop: 2,
  },

  timelineContentCurrent: {
    backgroundColor: COLORS.redSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },

  timelineTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "700",
  },

  timelineTitleCurrent: {
    color: COLORS.red,
    fontWeight: "900",
  },

  timelineStatus: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "600",
  },

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