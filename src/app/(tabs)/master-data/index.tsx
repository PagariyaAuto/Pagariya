import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import { colors, radius, spacing, typography } from "../../../theme";

type MasterItem = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route:
    | "/(tabs)/master-data/vehicle-models"
    | "/(tabs)/master-data/insurance-companies"
    | "/(tabs)/master-data/business-types"
    | "/(tabs)/master-data/mi-types"
    | "/(tabs)/master-data/users"
    | "/(tabs)/master-data/document-master";
};

type MasterSection = {
  title: string;
  description: string;
  items: MasterItem[];
};

const sections: MasterSection[] = [
  {
    title: "Vehicle setup",
    description: "Models and workshop classifications",
    items: [
      {
        title: "Vehicle Models",
        description: "Vehicle models and Arena / Nexa classification",
        icon: "car-outline",
        route: "/(tabs)/master-data/vehicle-models",
      },
      {
        title: "MI / NON-MI",
        description: "MI classifications used in vehicle intake",
        icon: "construct-outline",
        route: "/(tabs)/master-data/mi-types",
      },
    ],
  },
  {
    title: "Insurance & claims",
    description: "Reference information for insurance jobs",
    items: [
      {
        title: "Insurance Companies",
        description: "Insurance companies available for selection",
        icon: "business-outline",
        route: "/(tabs)/master-data/insurance-companies",
      },
      {
        title: "Business / Claim Types",
        description: "CNT, PNPL and other business or claim types",
        icon: "document-text-outline",
        route: "/(tabs)/master-data/business-types",
      },
    ],
  },
  {
    title: "Users & documents",
    description: "System roles and workflow requirements",
    items: [
      {
        title: "Users",
        description: "User accounts, system roles and active status",
        icon: "people-outline",
        route: "/(tabs)/master-data/users",
      },
      {
        title: "Document Master",
        description: "Document requirements for each workflow stage",
        icon: "documents-outline",
        route: "/(tabs)/master-data/document-master",
      },
    ],
  },
];

export default function MasterData() {
  const handleNavigationBack = useCallback(() => {
    returnToRoute("/(tabs)/advisor");
  }, []);
  useHardwareBack(handleNavigationBack);

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.topBar}>
        <BackButton accessibilityLabel="Back to dashboard" onPress={handleNavigationBack} />

        <BrandPill />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroHeading}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="settings-outline"
                size={24}
                color={colors.white}
              />
            </View>
            <Text style={styles.eyebrow}>WORKSHOP SETTINGS</Text>
          </View>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            Master Data
          </Text>
          <Text style={styles.heroDescription}>
            Manage the reference information, users and documents used across
            Pagariya.
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {section.title}
              </Text>
              <Text style={styles.sectionDescription}>
                {section.description}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <MasterRow key={item.route} item={item} divided={index > 0} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function MasterRow({ item, divided }: { item: MasterItem; divided: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={`Opens ${item.title} management`}
      onPress={() => router.push(item.route)}
      style={({ pressed }) => [
        styles.masterRow,
        divided && styles.dividedRow,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon} size={23} color={colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDescription}>{item.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  topBar: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  backButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: spacing.sm,
  },
  backText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  pressed: { opacity: 0.7 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  brandText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },
  scrollContent: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  hero: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDark,
    gap: spacing.sm,
  },
  heroHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  eyebrow: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.white,
  },
  heroTitle: {
    ...typography.title,
    fontSize: 28,
    fontWeight: "800",
    color: colors.white,
  },
  heroDescription: {
    ...typography.caption,
    lineHeight: 21,
    color: colors.white,
  },
  section: { gap: spacing.md },
  sectionHeading: { gap: spacing.xs },
  sectionTitle: { ...typography.subheading, color: colors.text },
  sectionDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  sectionCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  masterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    minHeight: 92,
  },
  dividedRow: { borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.primaryLight },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1, minWidth: 0, gap: spacing.xs },
  rowTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: "700" },
  rowDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
