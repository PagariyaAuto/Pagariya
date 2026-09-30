import { Ionicons } from "@expo/vector-icons";
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
  greenSoft: "#EAF7F1",
  orange: "#D97706",
  orangeSoft: "#FFF4E5",
  graySoft: "#F0F0EE",
};

type RelatedRow = Record<string, any>;

type WorkCategoryStatusProps = {
  floorProgress: RelatedRow[];
};

export default function WorkCategoryStatus({
  floorProgress,
}: WorkCategoryStatusProps) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleArea}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="list-outline"
              size={18}
              color={COLORS.red}
            />
          </View>

          <Text style={styles.sectionTitle}>
            Work / Category Status
          </Text>
        </View>
      </View>

      <View style={styles.sectionBody}>
        {floorProgress.length > 0 ? (
          <View style={styles.categoryList}>
            {floorProgress.map((item, index) => {
              const name =
                item.category ||
                item.work_category ||
                item.work_type ||
                item.name ||
                `Work ${index + 1}`;

              const status =
                item.status ||
                item.current_status ||
                item.progress_status ||
                "Pending";

              const normalizedStatus =
                String(status).toLowerCase();

              const completed =
                normalizedStatus === "completed" ||
                normalizedStatus === "complete" ||
                item.completed === true;

              return (
                <View
                  key={String(item.id || index)}
                  style={styles.categoryRow}
                >
                  <View
                    style={[
                      styles.categoryStatusIcon,
                      completed
                        ? styles.categoryStatusDone
                        : styles.categoryStatusPending,
                    ]}
                  >
                    <Ionicons
                      name={
                        completed
                          ? "checkmark"
                          : "time-outline"
                      }
                      size={15}
                      color={
                        completed
                          ? COLORS.green
                          : COLORS.orange
                      }
                    />
                  </View>

                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>
                      {prettyText(String(name))}
                    </Text>

                    <Text style={styles.categoryStatus}>
                      {prettyText(String(status))}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color={COLORS.textMuted}
            />

            <Text style={styles.emptySectionText}>
              No work/category status available yet.
            </Text>
          </View>
        )}
      </View>
    </View>
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

  categoryList: {
    gap: 2,
  },

  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  categoryStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  categoryStatusDone: {
    backgroundColor: COLORS.greenSoft,
  },

  categoryStatusPending: {
    backgroundColor: COLORS.orangeSoft,
  },

  categoryInfo: {
    flex: 1,
  },

  categoryName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "800",
  },

  categoryStatus: {
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