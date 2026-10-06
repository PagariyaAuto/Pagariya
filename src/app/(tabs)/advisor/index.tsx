import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { colors, radius, spacing, typography } from "../../../theme";

type CountKey =
  | "INTAKE"
  | "CLAIM_INTIMATION"
  | "SURVEY"
  | "APPROVAL"
  | "APPROVAL_HOLD"
  | "SUPPLEMENTARY"
  | "ADVISOR_WORK"
  | "STORE"
  | "FLOOR"
  | "FINAL_INSPECTION"
  | "BILLING"
  | "READY_FOR_DELIVERY";

type DashboardCounts = Record<CountKey, number>;

type WorkflowItem = {
  number: string;
  title: string;
  description: string;
  action: string;
  route?: string;
  icon: string;
  featured?: boolean;
  countKey: CountKey;
  countLabel: string;
};

type AdminItem = {
  number: string;
  title: string;
  description: string;
  action: string;
  route?: string;
  icon: string;
  placeholder?: boolean;
};

const workflowItems: WorkflowItem[] = [
  {
    number: "01",
    title: "Vehicle Intake",
    description: "Accept a waiting vehicle and enter customer details.",
    action: "Start intake",
    route: "/(tabs)/advisor/intake",
    featured: true,
    icon: "🚘",
    countKey: "INTAKE",
    countLabel: "waiting",
  },
  {
    number: "02",
    title: "Claim Intimation",
    description: "Record estimate and claim information for insurance jobs.",
    action: "Review claims",
    route: "/(tabs)/advisor/claim-intimation",
    icon: "📄",
    countKey: "CLAIM_INTIMATION",
    countLabel: "pending",
  },
  {
    number: "03",
    title: "Survey",
    description: "Inspect the vehicle and complete the survey process.",
    action: "Begin survey",
    route: "/(tabs)/advisor/survey",
    icon: "📋",
    countKey: "SURVEY",
    countLabel: "pending",
  },
  {
    number: "04",
    title: "Approval",
    description: "Review and record customer or insurance approval.",
    action: "Review approvals",
    route: "/(tabs)/advisor/approval_vehicles",
    icon: "🛡️",
    countKey: "APPROVAL",
    countLabel: "pending",
  },
  {
    number: "05",
    title: "Approval Hold",
    description: "Follow up vehicles waiting for approval resolution.",
    action: "Review holds",
    route: "/(tabs)/advisor/approval_hold",
    icon: "⏸️",
    countKey: "APPROVAL_HOLD",
    countLabel: "on hold",
  },
  {
    number: "06",
    title: "Supplementary",
    description: "Handle supplementary survey and approval cycles.",
    action: "Review supplementary",
    route: "/(tabs)/advisor/supplementary",
    icon: "🔄",
    countKey: "SUPPLEMENTARY",
    countLabel: "active",
  },
  {
    number: "07",
    title: "Advisor Work",
    description: "Manage approved work requirements before execution.",
    action: "View work",
    route: "/(tabs)/advisor/work",
    icon: "📝",
    countKey: "ADVISOR_WORK",
    countLabel: "active",
  },
  {
    number: "08",
    title: "Store",
    description: "Monitor vehicles waiting for parts and store handover.",
    action: "View store",
    icon: "📦",
    countKey: "STORE",
    countLabel: "active",
    route: "/(tabs)/advisor/store-monitor",
  },
  {
    number: "09",
    title: "Floor",
    description: "Track vehicles currently moving through floor work.",
    action: "View floor",
    route: "/(tabs)/advisor/floor",
    icon: "🧰",
    countKey: "FLOOR",
    countLabel: "active",
  },
  {
    number: "10",
    title: "Final Inspection",
    description:
      "Monitor vehicles after Floor work, review inspection history and manage Final Inspector assignment.",
    action: "Review inspections",
    route: "/(tabs)/advisor/final_inspection",
    icon: "🔍",
    countKey: "FINAL_INSPECTION",
    countLabel: "pending",
  },
  {
    number: "11",
    title: "Billing Preparation",
    description:
      "Verify Paid jobs or record Insurance pre-invoice and liability, then assign a Billing Executive.",
    action: "Prepare & assign",
    route: "/(tabs)/advisor/billing",
    icon: "💳",
    countKey: "BILLING",
    countLabel: "to prepare",
  },
  {
    number: "12",
    title: "Ready for Delivery",
    description:
      "Review completed Billing and inspection, then clear the vehicle for Watchman Gate Out.",
    action: "Review & clear delivery",
    route: "/(tabs)/advisor/ready-for-delivery",
    icon: "🚗",
    countKey: "READY_FOR_DELIVERY",
    countLabel: "to review",
  },
];

const adminItems: AdminItem[] = [
  {
    number: "A1",
    title: "Master Data",
    description:
      "Manage vehicle models, insurance companies, document master and other master records.",
    action: "Open Master Data",
    route: "/(tabs)/master-data",
    icon: "⚙️",
  },
  {
    number: "A2",
    title: "Operations Monitor",
    description:
      "Monitor today's operations, activity timeline and vehicle history.",
    action: "Open Operations Monitor",
    icon: "📊",
    placeholder: true,
  },
];

const EMPTY_COUNTS: DashboardCounts = {
  INTAKE: 0,
  CLAIM_INTIMATION: 0,
  SURVEY: 0,
  APPROVAL: 0,
  APPROVAL_HOLD: 0,
  SUPPLEMENTARY: 0,
  ADVISOR_WORK: 0,
  STORE: 0,
  FLOOR: 0,
  FINAL_INSPECTION: 0,
  BILLING: 0,
  READY_FOR_DELIVERY: 0,
};

function createCounts(): DashboardCounts {
  return {
    ...EMPTY_COUNTS,
  };
}

export default function AdvisorDashboard() {
  const { width } = useWindowDimensions();

  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [countError, setCountError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [isCeoAdmin, setIsCeoAdmin] = useState(false);

  const [placeholderVisible, setPlaceholderVisible] = useState(false);
  const [placeholderTitle, setPlaceholderTitle] = useState("");
  const [placeholderMessage, setPlaceholderMessage] = useState("");

  const isDesktop = width >= 1000;
  const isTablet = width >= 700 && width < 1000;

  const gridColumns = useMemo(() => {
    if (isDesktop) return 4;
    if (isTablet) return 3;
    return 2;
  }, [isDesktop, isTablet]);

  const gridGap = 12;

  const gridWidth = useMemo(() => {
    if (!isDesktop) {
      return width - spacing.lg * 2;
    }

    return Math.min(width - 48, 1240);
  }, [width, isDesktop]);

  const cardWidth = useMemo(() => {
    const totalGap = gridGap * (gridColumns - 1);

    return (gridWidth - totalGap) / gridColumns;
  }, [gridWidth, gridColumns]);

  const totalModuleCount =
    workflowItems.length + (isCeoAdmin ? adminItems.length : 0);

  const loadDashboardCounts = useCallback(async () => {
    setRefreshing(true);
    setCountError(false);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (
        !profile?.is_active ||
        !["advisor", "ceo_admin"].includes(profile.role)
      ) {
        throw new Error(
          "Only an active Advisor or CEO Admin can access this dashboard.",
        );
      }

      setIsCeoAdmin(profile.role === "ceo_admin");

      const { data: visits, error: visitsError } = await supabase
        .from("workshop_visits")
        .select("id,current_stage,current_status,current_assigned_to")
        .in("current_status", ["PENDING", "IN_PROGRESS", "ON_HOLD"]);

      if (visitsError) {
        throw visitsError;
      }

      const nextCounts = createCounts();

      for (const visit of visits ?? []) {
        const stage = String(visit.current_stage ?? "");

        switch (stage) {
          case "PENDING_ADVISOR":
            if (!visit.current_assigned_to) {
              nextCounts.INTAKE += 1;
            }
            break;

          case "CLAIM_INTIMATION":
            nextCounts.CLAIM_INTIMATION += 1;
            break;

          case "PENDING_SURVEY":
            nextCounts.SURVEY += 1;
            break;

          case "PENDING_APPROVAL":
            nextCounts.APPROVAL += 1;
            break;

          case "APPROVAL_HOLD":
            nextCounts.APPROVAL_HOLD += 1;
            break;

          case "SUPPLEMENTARY_SURVEY":
          case "SUPPLEMENTARY_APPROVAL":
            nextCounts.SUPPLEMENTARY += 1;
            break;

          case "ADVISOR_WORK":
            nextCounts.ADVISOR_WORK += 1;
            break;

          case "STORE":
            nextCounts.STORE += 1;
            break;

          case "FLOOR":
            nextCounts.FLOOR += 1;
            break;

          case "FINAL_INSPECTION":
            nextCounts.FINAL_INSPECTION += 1;
            break;

          default:
            break;
        }
      }

      const { data: supplementaryQueue, error: supplementaryError } =
        await supabase.rpc("new_workflow_supplementary_queue", {
          p_floor: false,
        });
      if (supplementaryError) throw supplementaryError;
      nextCounts.SUPPLEMENTARY = (supplementaryQueue?.items || []).filter(
        (row: { supplementary: { status: string } | null }) =>
          row.supplementary &&
          [
            "SURVEY",
            "APPROVAL",
            "APPROVAL_HOLD",
            "APPROVED",
            "CLAIM_REJECTED",
          ].includes(row.supplementary.status),
      ).length;
      // Use the same authorized queue as the Advisor Billing screen.
      // Vehicles transferred to a Billing Executive no longer belong here.
      const { data: billingQueue, error: billingError } = await supabase.rpc(
        "new_workflow_advisor_billing_queue",
      );
      if (billingError) throw billingError;
      if (
        !billingQueue ||
        !["advisor", "ceo_admin"].includes(billingQueue.role) ||
        !Array.isArray(billingQueue.items)
      ) {
        throw new Error("The Billing preparation count could not be loaded.");
      }
      nextCounts.BILLING = billingQueue.items.length;

      const { data: deliveryQueue, error: deliveryError } = await supabase.rpc(
        "new_workflow_ready_for_delivery_queue",
      );
      if (deliveryError) throw deliveryError;
      if (
        !deliveryQueue ||
        !["advisor", "ceo_admin"].includes(deliveryQueue.role) ||
        !Array.isArray(deliveryQueue.items)
      ) {
        throw new Error("The delivery clearance count could not be loaded.");
      }
      nextCounts.READY_FOR_DELIVERY = deliveryQueue.items.filter(
        (item: { stage: string }) => item.stage === "READY_FOR_DELIVERY",
      ).length;

      setCounts(nextCounts);
    } catch (error) {
      console.error("Failed to load Advisor Dashboard:", error);
      setCountError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardCounts();
    }, [loadDashboardCounts]),
  );

  const openWorkflowModule = (item: WorkflowItem) => {
    if (item.route) {
      router.push(item.route as never);
      return;
    }

    setPlaceholderTitle(item.title);

    setPlaceholderMessage(
      `${item.title} is included in the ${
        isCeoAdmin ? "CEO Admin" : "Advisor"
      } workflow dashboard. The dedicated screen for this module will be connected as that module is implemented.`,
    );

    setPlaceholderVisible(true);
  };

  const openAdminModule = (item: AdminItem) => {
    if (item.route) {
      router.push(item.route as never);
      return;
    }

    setPlaceholderTitle(item.title);

    setPlaceholderMessage(
      "Operations Monitor is currently a placeholder. This section will later contain Today's Operations, Activity Timeline and Vehicle History.",
    );

    setPlaceholderVisible(true);
  };

  const dashboardTitle = isCeoAdmin ? "Admin Dashboard" : "Advisor Dashboard";

  const workspaceLabel = isCeoAdmin
    ? "CEO ADMIN WORKSPACE"
    : "ADVISOR WORKSPACE";

  const avatarLabel = isCeoAdmin ? "CA" : "AD";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isDesktop && styles.desktopContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadDashboardCounts}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.eyebrow}>PAGARIYA AUTO</Text>

            <Text style={styles.heading}>{dashboardTitle}</Text>

            <Text style={styles.subtitle}>
              {isCeoAdmin
                ? "Manage system configuration, operations and vehicle workflow."
                : "Manage your vehicles and daily workflow."}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh dashboard"
              onPress={loadDashboardCounts}
              disabled={refreshing}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.pressed,
                refreshing && styles.refreshButtonDisabled,
              ]}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.refreshButtonText}>↻</Text>
              )}
            </Pressable>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLabel}</Text>
            </View>
          </View>
        </View>

        {/* WELCOME CARD */}
        <View
          style={[styles.welcomeCard, isDesktop && styles.desktopWelcomeCard]}
        >
          <View style={styles.decorCircleLarge} />
          <View style={styles.decorCircleSmall} />

          <View style={styles.welcomeTopRow}>
            <View style={styles.workspacePill}>
              <View style={styles.statusDot} />

              <Text style={styles.workspaceText}>{workspaceLabel}</Text>
            </View>

            <View style={styles.modulesPill}>
              <Text style={styles.modulesText}>{totalModuleCount} MODULES</Text>
            </View>
          </View>

          <Text style={styles.welcomeTitle}>Ready to get started?</Text>

          <Text style={styles.welcomeDescription}>
            {isCeoAdmin
              ? "Choose a workflow below to manage vehicle operations or system administration."
              : "Choose a workflow below to continue managing your vehicles."}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              isDesktop && styles.desktopPrimaryButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/(tabs)/advisor/intake" as never)}
          >
            <View style={styles.primaryButtonTextContainer}>
              <Text style={styles.primaryButtonText}>Start Vehicle Intake</Text>

              <Text style={styles.primaryButtonSubtext}>
                Accept a waiting vehicle
              </Text>
            </View>

            <View style={styles.primaryButtonArrowCircle}>
              <Text style={styles.primaryButtonArrow}>→</Text>
            </View>
          </Pressable>
        </View>

        {/* WORKFLOW SECTION */}
        <View
          style={[
            styles.sectionHeader,
            isDesktop && styles.desktopSectionHeader,
          ]}
        >
          <View>
            <Text style={styles.sectionTitle}>Your Workflow</Text>

            <Text style={styles.sectionSubtitle}>
              Select a task to continue
            </Text>
          </View>

          <View style={styles.moduleCount}>
            <Text style={styles.moduleCountText}>{workflowItems.length}</Text>
          </View>
        </View>

        {/* RESPONSIVE WORKFLOW GRID */}
        <View
          style={[
            styles.grid,
            {
              width: gridWidth,
            },
          ]}
        >
          {workflowItems.map((item) => {
            const itemCount = counts?.[item.countKey] ?? null;

            return (
              <Pressable
                key={item.number}
                style={({ pressed }) => [
                  styles.workflowCard,
                  {
                    width: cardWidth,
                  },
                  item.featured && styles.featuredCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => openWorkflowModule(item)}
              >
                {item.featured && <View style={styles.featuredStripe} />}

                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.iconContainer,
                      item.featured && styles.featuredIconContainer,
                    ]}
                  >
                    <Text style={styles.cardIcon}>{item.icon}</Text>
                  </View>

                  <Text
                    style={[
                      styles.cardArrow,
                      item.featured && styles.featuredCardArrow,
                    ]}
                  >
                    ↗
                  </Text>
                </View>

                <View style={styles.cardNumberRow}>
                  <View
                    style={[
                      styles.numberBadge,
                      item.featured && styles.featuredNumberBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.numberText,
                        item.featured && styles.featuredNumberText,
                      ]}
                    >
                      {item.number}
                    </Text>
                  </View>

                  <View style={styles.waitingBadge}>
                    {counts === null && !countError ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.waitingCount}>
                        {countError ? "—" : (itemCount ?? 0)}
                      </Text>
                    )}

                    <Text style={styles.waitingLabel}>
                      {countError ? "Unavailable" : item.countLabel}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.cardTitle,
                    item.featured && styles.featuredCardTitle,
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                <Text
                  style={[
                    styles.cardDescription,
                    item.featured && styles.featuredCardDescription,
                  ]}
                  numberOfLines={3}
                >
                  {item.description}
                </Text>

                <View
                  style={[
                    styles.cardFooter,
                    item.featured && styles.featuredCardFooter,
                  ]}
                >
                  <Text
                    style={[
                      styles.cardAction,
                      item.featured && styles.featuredCardAction,
                    ]}
                    numberOfLines={1}
                  >
                    {item.action}
                  </Text>

                  <Text
                    style={[
                      styles.footerArrow,
                      item.featured && styles.featuredFooterArrow,
                    ]}
                  >
                    →
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* CEO ADMIN AREA */}
        {isCeoAdmin && (
          <>
            <View
              style={[
                styles.adminSectionHeader,
                isDesktop && styles.desktopSectionHeader,
              ]}
            >
              <View>
                <Text style={styles.sectionTitle}>Admin Tools</Text>

                <Text style={styles.sectionSubtitle}>
                  Manage system configuration and operations
                </Text>
              </View>

              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>CEO</Text>
              </View>
            </View>

            <View
              style={[
                styles.grid,
                {
                  width: gridWidth,
                },
              ]}
            >
              {adminItems.map((item) => (
                <Pressable
                  key={item.number}
                  style={({ pressed }) => [
                    styles.adminCard,
                    {
                      width: cardWidth,
                    },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => openAdminModule(item)}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.adminIconContainer}>
                      <Text style={styles.cardIcon}>{item.icon}</Text>
                    </View>

                    <Text style={styles.cardArrow}>↗</Text>
                  </View>

                  <View style={styles.adminNumberBadge}>
                    <Text style={styles.adminNumberText}>{item.number}</Text>
                  </View>

                  <Text style={styles.cardTitle}>{item.title}</Text>

                  <Text style={styles.cardDescription} numberOfLines={3}>
                    {item.description}
                  </Text>

                  <View style={styles.cardFooter}>
                    <Text style={styles.cardAction}>{item.action}</Text>

                    <Text style={styles.footerArrow}>→</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ERROR NOTICE */}
        {countError && (
          <Pressable
            accessibilityRole="button"
            onPress={loadDashboardCounts}
            disabled={refreshing}
            style={({ pressed }) => [
              styles.errorNotice,
              isDesktop && styles.desktopErrorNotice,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.errorNoticeText}>
              Some dashboard counts could not be loaded. Tap here to retry.
            </Text>
          </Pressable>
        )}

        {/* WORKFLOW REMINDER */}
        <View
          style={[styles.reminderCard, isDesktop && styles.desktopReminderCard]}
        >
          <View style={styles.reminderIcon}>
            <Text style={styles.reminderIconText}>✓</Text>
          </View>

          <View style={styles.reminderDivider} />

          <Text style={styles.reminderText}>
            After Final Inspection passes, complete Billing Preparation and
            assign a Billing Executive.
          </Text>

          <View style={styles.brandMark}>
            <View style={styles.brandMarkStripeOne} />
            <View style={styles.brandMarkStripeTwo} />
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* PLACEHOLDER MODAL */}
      <Modal
        visible={placeholderVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPlaceholderVisible(false)}
      >
        <SafeAreaView
          style={{ flex: 1 }}
          edges={["top", "right", "bottom", "left"]}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIcon}>
                <Text style={styles.modalIconText}>ℹ</Text>
              </View>

              <Text style={styles.modalTitle}>{placeholderTitle}</Text>

              <Text style={styles.modalMessage}>{placeholderMessage}</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setPlaceholderVisible(false)}
              >
                <Text style={styles.modalButtonText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  desktopContent: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 1320,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  headerTextContainer: { flex: 1, paddingRight: spacing.sm },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshButtonDisabled: { opacity: 0.7 },
  refreshButtonText: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  heading: {
    ...typography.title,
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 5,
    lineHeight: 21,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#FFD0D4",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 2,
  },
  avatarText: { color: colors.primaryDark, fontSize: 15, fontWeight: "800" },
  welcomeCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: 28,
    overflow: "hidden",
    position: "relative",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 7,
  },
  desktopWelcomeCard: { minHeight: 245 },
  decorCircleLarge: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -90,
    top: 50,
    backgroundColor: "rgba(120, 0, 10, 0.16)",
  },
  decorCircleSmall: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    right: 5,
    top: 145,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  welcomeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  workspacePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.round,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6EE7A0",
  },
  workspaceText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  modulesPill: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radius.round,
    backgroundColor: "rgba(120,0,10,0.2)",
  },
  modulesText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  welcomeTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 9,
  },
  welcomeDescription: {
    color: "#FFF0F1",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 23,
    maxWidth: 520,
  },
  primaryButton: {
    minHeight: 62,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingLeft: spacing.lg,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#7F0A12",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  desktopPrimaryButton: { maxWidth: 440 },
  primaryButtonTextContainer: { flex: 1, paddingVertical: 8 },
  primaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },
  primaryButtonSubtext: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  primaryButtonArrowCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonArrow: {
    color: colors.primary,
    fontSize: 23,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  desktopSectionHeader: { marginTop: 4 },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  moduleCount: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#FFD0D4",
  },
  moduleCountText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },
  adminSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 34,
    marginBottom: spacing.md,
  },
  adminBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  adminBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignSelf: "center",
  },
  workflowCard: {
    minHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    overflow: "hidden",
    shadowColor: "#182230",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 9,
    elevation: 3,
  },
  featuredCard: {
    backgroundColor: "#FFF8F8",
    borderColor: "#FFC9CE",
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    elevation: 5,
  },
  adminCard: {
    minHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    overflow: "hidden",
    shadowColor: "#182230",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 9,
    elevation: 3,
  },
  featuredStripe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 5,
    backgroundColor: colors.primary,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adminIconContainer: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#FFD0D4",
  },
  featuredIconContainer: {
    backgroundColor: colors.primaryLight,
    borderColor: "#FFD0D4",
  },
  cardIcon: { fontSize: 23 },
  cardArrow: { color: colors.textLight, fontSize: 21, fontWeight: "700" },
  featuredCardArrow: { color: colors.primary },
  cardNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 6,
  },
  numberBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.round,
    backgroundColor: "#F0F1F4",
  },
  featuredNumberBadge: { backgroundColor: colors.primary },
  numberText: { color: colors.textSecondary, fontSize: 11, fontWeight: "800" },
  featuredNumberText: { color: colors.white },
  adminNumberBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    marginBottom: 10,
  },
  adminNumberText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
  },
  waitingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#FFD0D4",
    maxWidth: 110,
  },
  waitingCount: { color: colors.primaryDark, fontSize: 12, fontWeight: "900" },
  waitingLabel: { color: colors.primaryDark, fontSize: 10, fontWeight: "700" },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    marginBottom: 7,
  },
  featuredCardTitle: { color: colors.primaryDark },
  cardDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  featuredCardDescription: { color: "#80545A" },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 11,
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  featuredCardFooter: { borderTopColor: "#FFD8DB" },
  cardAction: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  featuredCardAction: { color: colors.primaryDark },
  footerArrow: { color: colors.textSecondary, fontSize: 17, fontWeight: "700" },
  featuredFooterArrow: { color: colors.primary },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  errorNotice: {
    marginTop: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#FFF0F1",
    borderWidth: 1,
    borderColor: "#FFD0D4",
  },
  desktopErrorNotice: { maxWidth: 1240, alignSelf: "center", width: "100%" },
  errorNoticeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
  },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 25,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#FFF0F1",
    borderWidth: 1,
    borderColor: "#FFE0E3",
  },
  desktopReminderCard: { maxWidth: 1240, width: "100%", alignSelf: "center" },
  reminderIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderIconText: { color: colors.white, fontSize: 18, fontWeight: "800" },
  reminderDivider: { width: 1, height: 30, backgroundColor: "#E8AEB4" },
  reminderText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  brandMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 2,
  },
  brandMarkStripeOne: {
    width: 8,
    height: 25,
    borderRadius: 2,
    backgroundColor: "#F8BFC4",
    transform: [{ skewX: "-25deg" }],
  },
  brandMarkStripeTwo: {
    width: 8,
    height: 25,
    borderRadius: 2,
    backgroundColor: "#FFD4D7",
    transform: [{ skewX: "-25deg" }],
  },
  bottomSpace: { height: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(20, 24, 32, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "#FFD0D4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  modalIconText: { color: colors.primary, fontSize: 27, fontWeight: "800" },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  modalMessage: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 22,
  },
  modalButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
});
