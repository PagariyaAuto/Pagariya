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
  textSecondary: "#555555",
  textMuted: "#999999",
  white: "#FFFFFF",
  border: "#E7E5E2",
  redSoft: "#FDECEC",
};

type RelatedRow = Record<string, any>;

type VehicleEventsProps = {
  events: RelatedRow[];
  history: RelatedRow[];
};

export default function VehicleEvents({
  events,
  history,
}: VehicleEventsProps) {
  return (
    <SectionCard title="Events / History" icon="time-outline">
      {events.length > 0 ? (
        <View style={styles.eventList}>
          {events.map((event, index) => (
            <View
              key={String(event.id || index)}
              style={styles.eventRow}
            >
              <View style={styles.eventDot} />

              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>
                  {prettyText(
                    event.event_type ||
                      event.type ||
                      event.action ||
                      "Vehicle Event"
                  )}
                </Text>

                <Text style={styles.eventDate}>
                  {formatDateTime(
                    event.created_at ||
                      event.event_time ||
                      event.occurred_at
                  )}
                </Text>

                {event.description ||
                event.remarks ||
                event.note ? (
                  <Text style={styles.eventDescription}>
                    {String(
                      event.description ||
                        event.remarks ||
                        event.note
                    )}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : history.length > 0 ? (
        <View style={styles.eventList}>
          {history.map((item, index) => (
            <View
              key={String(item.id || index)}
              style={styles.eventRow}
            >
              <View style={styles.eventDot} />

              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>
                  {prettyText(
                    item.event_type ||
                      item.type ||
                      item.action ||
                      "Vehicle History"
                  )}
                </Text>

                <Text style={styles.eventDate}>
                  {formatDateTime(item.created_at)}
                </Text>

                {item.description ||
                item.remarks ||
                item.note ? (
                  <Text style={styles.eventDescription}>
                    {String(
                      item.description ||
                        item.remarks ||
                        item.note
                    )}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptySection text="No events or history available." />
      )}
    </SectionCard>
  );
}

function prettyText(value: any) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: any) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        size={18}
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

  eventList: {
    gap: 0,
  },

  eventRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  eventDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.red,
    marginTop: 5,
    marginRight: 10,
  },

  eventInfo: {
    flex: 1,
  },

  eventTitle: {
    fontSize: 13,
    color: COLORS.charcoal,
    fontWeight: "800",
  },

  eventDate: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginTop: 3,
  },

  eventDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginTop: 5,
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