import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../theme";

type MasterCardProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export default function MasterData() {
  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back-outline"
              size={22}
              color={colors.text}
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Master Data
            </Text>

            <Text style={styles.subtitle}>
              Manage data used throughout Pagariya
            </Text>
          </View>
        </View>

        {/* INFO */}

        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons
              name="settings-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Master Data Management
            </Text>

            <Text style={styles.infoText}>
              Add and manage common information used when
              creating job cards and handling workshop operations.
            </Text>
          </View>
        </View>

        {/* SECTION */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Master Data
          </Text>

          <Text style={styles.sectionSubtitle}>
            Select what you want to manage
          </Text>
        </View>

        {/* VEHICLE MODELS */}

        <MasterCard
          icon="car-outline"
          title="Vehicle Models"
          subtitle="Manage vehicle models and Arena / Nexa"
          onPress={() =>
            router.push("/(tabs)/master-data/vehicle-models")
          }
        />

        {/* INSURANCE COMPANIES */}

        <MasterCard
          icon="business-outline"
          title="Insurance Companies"
          subtitle="Manage insurance companies"
          onPress={() =>
            router.push("/(tabs)/master-data/insurance-companies")
          }
        />

        {/* BUSINESS / CLAIM TYPES */}

        <MasterCard
          icon="document-text-outline"
          title="Business / Claim Types"
          subtitle="Manage CNT, PNPL and other types"
          onPress={() =>
            router.push("/(tabs)/master-data/business-types")
          }
        />

        {/* MI / NON-MI */}

        <MasterCard
          icon="construct-outline"
          title="MI / NON-MI"
          subtitle="Manage MI classification"
          onPress={() =>
            router.push("/(tabs)/master-data/mi-types")
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/* --------------------------------------------------
   MASTER DATA CARD
-------------------------------------------------- */

function MasterCard({
  title,
  subtitle,
  icon,
  onPress,
}: MasterCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.masterCard,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* ICON */}

      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={24}
          color={colors.primary}
        />
      </View>

      {/* CONTENT */}

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>
          {title}
        </Text>

        <Text style={styles.cardSubtitle}>
          {subtitle}
        </Text>
      </View>

      {/* ARROW */}

      <Ionicons
        name="chevron-forward-outline"
        size={21}
        color={colors.textLight}
      />
    </Pressable>
  );
}

/* --------------------------------------------------
   STYLES
-------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  /* HEADER */

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  pressed: {
    opacity: 0.7,
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
    marginTop: spacing.xs,
  },

  /* INFO */

  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },

  /* SECTION */

  sectionHeader: {
    marginBottom: spacing.md,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  /* CARD */

  masterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 82,
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  cardContent: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  cardTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
});