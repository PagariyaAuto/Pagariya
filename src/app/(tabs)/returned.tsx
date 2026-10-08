import BackButton from "../../components/navigation/BackButton";
import { returnToRoute, useHardwareBack } from "../../lib/back-navigation";

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../theme";

import { supabase } from "../../../lib/supabase";

const PAGE_SIZE = 25;
const IMMEDIATE_RETURN_REMARK =
  "Gate In followed by immediate return";

type VehicleEvent = {
  id: string;
  vehicle_id: string;
  job_id: string | null;
  event_type: string;
  remarks: string | null;
  created_at: string;
  vehicle?: Record<string, any> | null;
  job?: Record<string, any> | null;
};

type VehicleRow = Record<string, any> & {
  id: string;
};

type JobRow = Record<string, any> & {
  id: string;
};

function getText(
  row: Record<string, any> | null | undefined,
  keys: string[],
  fallback = "—"
): string {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return String(value);
    }
  }

  return fallback;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "Date unavailable",
      time: "",
    };
  }

  return {
    date: date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}


function getVehicleNumber(
    vehicle: Record<string, any> | null | undefined
  ) {
    return getText(vehicle, [
      "vehicle_no",
      "vehicle_number",
      "registration_number",
      "registration_no",
      "number",
    ]);
  }

  function getCustomerName(
    vehicle: Record<string, any> | null | undefined
  ) {
    return getText(vehicle, [
      "customer_name",
      "owner_name",
      "name",
    ]);
  }

  function getVehicleModel(
    vehicle: Record<string, any> | null | undefined
  ) {
    return getText(vehicle, [
      "vehicle_model",
      "model",
      "model_name",
    ]);
  }

  function getJobCardNumber(
    job: Record<string, any> | null | undefined
  ) {
    return getText(job, [
      "job_card_number",
      "job_number",
      "job_card_no",
      "job_no",
    ]);
  }

export default function ReturnedScreen() {
  const handleNavigationBack = () => {
    returnToRoute("/(tabs)/advisor");
  };
  useHardwareBack(handleNavigationBack);

  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(
    null
  );

  const loadReturnedEvents = useCallback(async () => {
    setErrorMessage("");

    try {
      // Only fetch Gate In records explicitly marked as immediate returns.
      const {
        data: gateInRows,
        error: gateInError,
      } = await supabase
        .from("vehicle_events")
        .select("*")
        .eq("event_type", "GATE_IN")
        .eq("remarks", IMMEDIATE_RETURN_REMARK)
        .order("created_at", { ascending: false });

      if (gateInError) throw gateInError;

      const gateIns = (gateInRows || []) as VehicleEvent[];

      if (gateIns.length === 0) {
        setEvents([]);
        setPage(0);
        setExpandedEventId(null);
        return;
      }

      const vehicleIds = [
        ...new Set(gateIns.map((event) => event.vehicle_id)),
      ];

      // Fetch departures for those vehicles, then pair by exact timestamp.
      const {
        data: gateOutRows,
        error: gateOutError,
      } = await supabase
        .from("vehicle_events")
        .select("*")
        .eq("event_type", "GATE_OUT")
        .in("vehicle_id", vehicleIds)
        .order("created_at", { ascending: false });

      if (gateOutError) throw gateOutError;

      const gateOuts = (gateOutRows || []) as VehicleEvent[];
      const matchedReturns: VehicleEvent[] = [];

      for (const gateIn of gateIns) {
        const matchingGateOut = gateOuts.find(
          (gateOut) =>
            gateOut.vehicle_id === gateIn.vehicle_id &&
            gateOut.created_at === gateIn.created_at
        );

        if (matchingGateOut) {
          matchedReturns.push(matchingGateOut);
        }
      }

      if (matchedReturns.length === 0) {
        setEvents([]);
        setPage(0);
        setExpandedEventId(null);
        return;
      }

      const jobIds = [
        ...new Set(
          matchedReturns
            .map((event) => event.job_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      const {
        data: vehicleRows,
        error: vehiclesError,
      } = await supabase
        .from("vehicles")
        .select("*")
        .in("id", vehicleIds);

      if (vehiclesError) throw vehiclesError;

      let jobRows: JobRow[] = [];

      if (jobIds.length > 0) {
        const {
          data,
          error: jobsError,
        } = await supabase
          .from("vehicle_jobs")
          .select("*")
          .in("id", jobIds);

        if (jobsError) throw jobsError;

        jobRows = (data || []) as JobRow[];
      }

      const vehicleMap = new Map<string, VehicleRow>(
        ((vehicleRows || []) as VehicleRow[]).map((vehicle) => [
          vehicle.id,
          vehicle,
        ])
      );

      const jobMap = new Map<string, JobRow>(
        jobRows.map((job) => [job.id, job])
      );

      const combined = matchedReturns
        .map((event) => ({
          ...event,
          vehicle: vehicleMap.get(event.vehicle_id) || null,
          job: event.job_id ? jobMap.get(event.job_id) || null : null,
        }))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

      setEvents(combined);
      setPage(0);
      setExpandedEventId(null);
    } catch (error: any) {
      console.error("Load returned vehicles error:", error);
      setErrorMessage(
        error?.message || "Unable to load returned vehicles."
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setLoading(true);
        await loadReturnedEvents();

        if (active) setLoading(false);
      };

      void load();

      return () => {
        active = false;
      };
    }, [loadReturnedEvents])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReturnedEvents();
    setRefreshing(false);
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredEvents = useMemo(() => {
    if (!normalizedSearch) return events;

    return events.filter((event) => {
      const vehicle = event.vehicle;
      const job = event.job;

     const searchableValues = [
      getText(vehicle ?? null, [
        "vehicle_no",
        "vehicle_number",
        "registration_no",
        "registration_number",
        "number",
      ]),
      getText(vehicle ?? null, ["customer_name", "name"]),
      getText(vehicle ?? null, ["customer_mobile", "mobile", "phone"]),
      getText(vehicle ?? null, ["model", "vehicle_model"]),
      getText(job ?? null, ["job_card_number", "job_card_no", "job_number"]),
      event.job_id ?? "",
      event.remarks ?? "",
    ];

      return searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [events, normalizedSearch]);

  const returnedTodayCount = useMemo(
    () => events.filter((event) => isToday(event.created_at)).length,
    [events]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages - 1);

  const pageEvents = filteredEvents.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <View style={styles.header}>
        <BackButton accessibilityLabel="Go back" onPress={handleNavigationBack} />

        <View style={styles.headerText}>
          <Text style={styles.title}>Returned Vehicles</Text>
          <Text style={styles.subtitle}>
            Vehicles returned at the gate
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons
              name="car-outline"
              size={21}
              color={colors.primary}
            />
          </View>
          <View style={styles.statTextWrap}>
            <Text style={styles.statLabel}>Total returned</Text>
            <Text style={styles.statValue}>{events.length}</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons
              name="calendar-outline"
              size={21}
              color={colors.primary}
            />
          </View>
          <View style={styles.statTextWrap}>
            <Text style={styles.statLabel}>Returned today</Text>
            <Text style={styles.statValue}>{returnedTodayCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textSecondary}
        />

        <TextInput
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setPage(0);
          }}
          placeholder="Search registration, customer or job ID"
          placeholderTextColor={colors.textLight}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />

        {search.length > 0 && (
          <Pressable
            onPress={() => {
              setSearch("");
              setPage(0);
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      </View>

      <View style={styles.listHeading}>
        <View style={styles.historyHeading}>
          <View style={styles.historyIcon}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.primary}
            />
          </View>

          <View>
            <Text style={styles.listTitle}>History</Text>
            <Text style={styles.listSubtitle}>
              {filteredEvents.length} record
              {filteredEvents.length === 1 ? "" : "s"} found
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onRefresh}
          style={styles.refreshButton}
          accessibilityRole="button"
          accessibilityLabel="Refresh returned vehicles"
        >
          <Ionicons
            name="refresh-outline"
            size={20}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={styles.stateText}>
            Loading returned vehicles...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color={colors.danger || colors.primary}
          />
          <Text style={styles.errorText}>{errorMessage}</Text>

          <Pressable
            style={styles.retryButton}
            onPress={loadReturnedEvents}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {pageEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="car-outline"
                    size={32}
                    color={colors.primary}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  No returned vehicles found
                </Text>

                <Text style={styles.emptyDescription}>
                  {search.trim()
                    ? "Try another registration number, customer name or job ID."
                    : "Vehicles returned at the gate without entering the workshop will appear here."}
                </Text>
              </View>
            ) : (
              pageEvents.map((event) => {
                const vehicle = event.vehicle;
                const job = event.job;
                const dateTime = formatDateTime(event.created_at);

                const vehicleNumber = getVehicleNumber(vehicle);
                const customerName = getCustomerName(vehicle);
                const vehicleModel = getVehicleModel(vehicle);
                const jobCardNumber = getJobCardNumber(job);

                const expanded = expandedEventId === event.id;

                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.vehicleIcon}>
                        <Ionicons
                          name="car-sport-outline"
                          size={23}
                          color={colors.primary}
                        />
                      </View>

                      <View style={styles.vehicleHeading}>
                        <Text style={styles.vehicleNumber}>
                          {vehicleNumber}
                        </Text>
                        <Text style={styles.customerName}>
                          {customerName}
                        </Text>
                      </View>

                      <View style={styles.returnTag}>
                        <Ionicons
                          name="return-down-back-outline"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.returnTagText}>
                          Returned
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailsBox}>
                      <InfoRow
                        icon="car-outline"
                        label="Vehicle Model"
                        value={vehicleModel}
                      />

                      <InfoRow
                        icon="clipboard-outline"
                        label="Job ID"
                        value={jobCardNumber !== "—"
                          ? jobCardNumber
                          : event.job_id || "—"}
                      />

                      <InfoRow
                        icon="calendar-outline"
                        label="Returned Date"
                        value={dateTime.date}
                      />

                      <InfoRow
                        icon="time-outline"
                        label="Returned Time"
                        value={dateTime.time || "—"}
                      />
                    </View>

                    <View style={styles.reasonBox}>
                      <View style={styles.reasonHeading}>
                        <Ionicons
                          name="information-circle-outline"
                          size={18}
                          color={colors.primary}
                        />
                        <Text style={styles.reasonTitle}>
                          Return reason
                        </Text>
                      </View>
                      <Text style={styles.reasonText}>
                        {event.remarks ||
                          "Vehicle returned without entering the workshop."}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() =>
                        setExpandedEventId(expanded ? null : event.id)
                      }
                      style={styles.viewDetailsButton}
                      accessibilityRole="button"
                      accessibilityLabel={
                        expanded ? "Hide details" : "View details"
                      }
                    >
                      <Text style={styles.viewDetailsText}>
                        {expanded ? "Hide details" : "View details"}
                      </Text>
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.primary}
                      />
                    </Pressable>

                    {expanded && (
                      <View style={styles.expandedDetails}>
                        <Text style={styles.expandedTitle}>
                          Return record details
                        </Text>

                        <InfoRow
                          icon="person-outline"
                          label="Customer"
                          value={customerName}
                        />

                        <InfoRow
                          icon="call-outline"
                          label="Customer mobile"
                          value={getText(vehicle, [
                            "customer_mobile",
                            "mobile",
                            "phone",
                          ])}
                        />

                        <InfoRow
                          icon="car-outline"
                          label="Registration"
                          value={vehicleNumber}
                        />

                        <InfoRow
                          icon="finger-print-outline"
                          label="Vehicle record ID"
                          value={event.vehicle_id}
                        />

                        <InfoRow
                          icon="document-text-outline"
                          label="Gate Out event ID"
                          value={event.id}
                        />

                        <InfoRow
                          icon="clipboard-outline"
                          label="Job record ID"
                          value={event.job_id || "No workshop job"}
                        />

                        <Text style={styles.historyNote}>
                          This entry is read-only and is based on the
                          recorded Gate In and Gate Out events.
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {filteredEvents.length > 0 && (
            <View style={styles.pagination}>
              <Text style={styles.paginationText}>
                Page {safePage + 1} of {totalPages}
              </Text>

              <View style={styles.paginationButtons}>
                <Pressable
                  disabled={safePage === 0}
                  onPress={() =>
                    setPage((current) => Math.max(0, current - 1))
                  }
                  style={[
                    styles.pageButton,
                    safePage === 0 && styles.pageButtonDisabled,
                  ]}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={
                      safePage === 0
                        ? colors.textLight
                        : colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.pageButtonText,
                      safePage === 0 && styles.pageButtonTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </Pressable>

                <Pressable
                  disabled={safePage >= totalPages - 1}
                  onPress={() =>
                    setPage((current) =>
                      Math.min(totalPages - 1, current + 1)
                    )
                  }
                  style={[
                    styles.pageButton,
                    safePage >= totalPages - 1 &&
                      styles.pageButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      safePage >= totalPages - 1 &&
                        styles.pageButtonTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      safePage >= totalPages - 1
                        ? colors.textLight
                        : colors.primary
                    }
                  />
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

type InfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons
          name={icon}
          size={16}
          color={colors.textSecondary}
        />
      </View>

      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  headerText: {
    flex: 1,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },

  statsRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },

  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  statTextWrap: {
    flex: 1,
  },

  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  statValue: {
    ...typography.title,
    color: colors.text,
    marginTop: 2,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },

  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
  },

  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  historyHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  listTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  listSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },

  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  vehicleIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },

  vehicleHeading: {
    flex: 1,
  },

  vehicleNumber: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  customerName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },

  returnTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },

  returnTagText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },

  detailsBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },

  infoIcon: {
    width: 24,
    alignItems: "center",
    marginRight: spacing.xs,
  },

  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },

  infoValue: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1.1,
    textAlign: "right",
  },

  reasonBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
  },

  reasonHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },

  reasonTitle: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  reasonText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 19,
  },

  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  viewDetailsText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  expandedDetails: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },

  expandedTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  historyNote: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  stateText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  errorText: {
    ...typography.body,
    color: colors.text,
    textAlign: "center",
    marginTop: spacing.md,
  },

  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },

  retryButtonText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    minHeight: 260,
  },

  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  emptyTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
  },

  emptyDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  paginationText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  paginationButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  pageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },

  pageButtonDisabled: {
    opacity: 0.55,
  },

  pageButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },

  pageButtonTextDisabled: {
    color: colors.textLight,
  },
});