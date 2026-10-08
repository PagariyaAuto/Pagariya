import { Modal, ScrollView } from "../../components/inputs/KeyboardAware";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import Ionicons from "@expo/vector-icons/Ionicons";

import {
  router,
  useFocusEffect,
} from "expo-router";

import { supabase } from "../../../lib/supabase";
import { getCurrentWorkflowRoute } from "../../lib/workflow-route";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../theme";

type Vehicle = {
  id: string;
  vehicle_no: string;
  jc_no: string | null;
  model: string | null;
  arena_nexa: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_type: string | null;
  current_status: string;
  current_stage: string;
  current_assigned_to: string | null;
  stage_started_at: string;
  created_at: string;
  advisor_name?: string | null;
};

type Profile = {
  id: string;
  name: string | null;
  role: string;
};

type StageConfig = {
  key: string;
  label: string;
  description: string;
};

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [takingVehicle, setTakingVehicle] =
    useState<string | null>(null);

  const [modalVisible, setModalVisible] =
    useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] =
    useState("");

  const stageConfig: StageConfig[] = [
    {
      key: "PENDING_ADVISOR",
      label: "Pending Advisor",
      description:
        "Vehicles waiting for an advisor",
    },
    {
      key: "ADVISOR_ASSIGNED",
      label: "Advisor Assigned",
      description:
        "Vehicles assigned to an advisor",
    },
    {
      key: "SURVEY",
      label: "Survey",
      description:
        "Vehicles currently under survey",
    },
    {
      key: "APPROVAL",
      label: "Approval",
      description:
        "Vehicles waiting for approval",
    },
    {
      key: "FLOOR",
      label: "Floor",
      description:
        "Vehicles waiting for floor work",
    },
    {
      key: "WORKSHOP",
      label: "Workshop",
      description:
        "Vehicles currently under workshop work",
    },
    {
      key: "READY",
      label: "Ready",
      description:
        "Vehicles ready for the next process",
    },
    {
      key: "BILLING",
      label: "Billing",
      description:
        "Vehicles under billing",
    },
    {
      key: "READY_FOR_DELIVERY",
      label: "Ready for Delivery",
      description:
        "Vehicles ready for customer delivery",
    },
  ];

  function showModal(
    title: string,
    message: string
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  const loadData = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "User session not found."
        );
      }

      // Get logged-in user's profile
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      setProfile(profileData);

      // Get vehicles from all active workflow stages
      const {
        data: vehicleData,
        error: vehicleError,
      } = await supabase
        .from("vehicles")
        .select(`
          id,
          vehicle_no,
          jc_no,
          model,
          arena_nexa,
          customer_name,
          customer_mobile,
          vehicle_type,
          current_status,
          current_stage,
          current_assigned_to,
          stage_started_at,
          created_at
        `)
        .in("current_stage", [
          "PENDING_ADVISOR",
          "ADVISOR_ASSIGNED",
          "SURVEY",
          "APPROVAL",
          "FLOOR",
          "WORKSHOP",
          "READY",
          "BILLING",
          "READY_FOR_DELIVERY",
        ])
        .order("stage_started_at", {
          ascending: true,
        });

      if (vehicleError) {
        throw vehicleError;
      }

      const rawVehicles = vehicleData ?? [];

      // Get advisor names
      const advisorIds = rawVehicles
        .map(
          (vehicle) =>
            vehicle.current_assigned_to
        )
        .filter(Boolean) as string[];

      let advisorMap: Record<
        string,
        string
      > = {};

      if (advisorIds.length > 0) {
        const uniqueAdvisorIds = [
          ...new Set(advisorIds),
        ];

        const {
          data: advisors,
          error: advisorError,
        } = await supabase
          .from("profiles")
          .select("id, name")
          .in(
            "id",
            uniqueAdvisorIds
          );

        if (advisorError) {
          throw advisorError;
        }

        advisorMap = Object.fromEntries(
          (advisors ?? []).map(
            (advisor) => [
              advisor.id,
              advisor.name || "Advisor",
            ]
          )
        );
      }

      const formattedVehicles: Vehicle[] =
        rawVehicles.map((vehicle) => ({
          ...vehicle,
          advisor_name:
            vehicle.current_assigned_to
              ? advisorMap[
                  vehicle.current_assigned_to
                ] || "Advisor"
              : null,
        }));

      setVehicles(formattedVehicles);
    } catch (error: any) {
      console.error(
        "Vehicles load error:",
        error
      );

      showModal(
        "Unable to Load Vehicles",
        error?.message ||
          "Something went wrong while loading vehicles."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenIntake = async (
    vehicleId: string
  ) => {
    if (
      !profile ||
      profile.role !== "advisor"
    ) {
      return;
    }

    try {
      setTakingVehicle(vehicleId);

      const target = await getCurrentWorkflowRoute(vehicleId, true);
      router.push({ ...target, params: { ...target.params, returnTo: "vehicles" } });
    } catch (error: any) {
      console.error(
        "Open intake error:",
        error
      );

      showModal(
        "Unable to Open Intake",
        error?.message ||
          "The Intake form could not be opened."
      );
    } finally {
      setTakingVehicle(null);
    }
  };

  const vehiclesByStage =
    stageConfig.reduce(
      (
        groups: Record<
          string,
          Vehicle[]
        >,
        stage
      ) => {
        groups[stage.key] =
          vehicles.filter(
            (vehicle) =>
              vehicle.current_stage ===
              stage.key
          );

        return groups;
      },
      {}
    );

  const formatTime = (
    dateString: string
  ) => {
    const date = new Date(dateString);

    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const formatDate = (
    dateString: string
  ) => {
    const date = new Date(dateString);

    return date.toLocaleDateString(
      [],
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const openVehicleDetails = (
    vehicleId: string
  ) => {
    router.push({
      pathname:
        "/(tabs)/vehicle-detail",
      params: {
        vehicleId,
      },
    });
  };

  const renderVehicleCard = (
    vehicle: Vehicle
  ) => {
    const isPending =
      vehicle.current_stage ===
      "PENDING_ADVISOR";

    const isAssigned =
      vehicle.current_stage ===
      "ADVISOR_ASSIGNED";

    const currentStage =
      stageConfig.find(
        (stage) =>
          stage.key ===
          vehicle.current_stage
      );

    const isMyVehicle =
      profile?.id ===
      vehicle.current_assigned_to;

    const isTaking =
      takingVehicle === vehicle.id;

    return (
      <TouchableOpacity
        key={vehicle.id}
        style={styles.vehicleCard}
        onPress={() =>
          openVehicleDetails(
            vehicle.id
          )
        }
        activeOpacity={0.9}
      >
        {/* Top row */}
        <View style={styles.vehicleTopRow}>
          <View style={styles.vehicleIcon}>
            <Ionicons
              name="car-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.vehicleMain}>
            <Text
              style={styles.vehicleNumber}
            >
              {vehicle.vehicle_no}
            </Text>

            <Text
              style={styles.vehicleModel}
            >
              {vehicle.model ||
                "Vehicle model not available"}
            </Text>
          </View>

          {/* Current Stage Badge */}
          <View
            style={[
              styles.statusBadge,
              isPending
                ? styles.pendingBadge
                : isAssigned
                ? styles.assignedBadge
                : styles.stageBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isPending
                  ? styles.pendingText
                  : isAssigned
                  ? styles.assignedText
                  : styles.stageText,
              ]}
            >
              {currentStage?.label ||
                vehicle.current_stage}
            </Text>
          </View>
        </View>

        {/* Customer */}
        <View style={styles.infoRow}>
          <Ionicons
            name="person-outline"
            size={17}
            color={
              colors.textSecondary
            }
          />

          <Text style={styles.infoText}>
            {vehicle.customer_name ||
              "Customer name not available"}
          </Text>
        </View>

        {/* Vehicle type / Arena */}
        <View style={styles.infoRow}>
          <Ionicons
            name="information-circle-outline"
            size={17}
            color={
              colors.textSecondary
            }
          />

          <Text style={styles.infoText}>
            {vehicle.vehicle_type ||
              "Vehicle type"}

            {vehicle.arena_nexa
              ? ` • ${vehicle.arena_nexa}`
              : ""}
          </Text>
        </View>

        {/* Current Stage Time */}
        <View style={styles.infoRow}>
          <Ionicons
            name="time-outline"
            size={17}
            color={
              colors.textSecondary
            }
          />

          <Text style={styles.infoText}>
            {currentStage?.label ||
              "Current stage"}{" "}
            since{" "}
            {formatDate(
              vehicle.stage_started_at
            )}{" "}
            at{" "}
            {formatTime(
              vehicle.stage_started_at
            )}
          </Text>
        </View>

        {/* Assigned advisor */}
        {isAssigned && (
          <View
            style={styles.assignedBox}
          >
            <Ionicons
              name="person-circle-outline"
              size={20}
              color={colors.success}
            />

            <View
              style={
                styles.assignedContent
              }
            >
              <Text
                style={
                  styles.assignedLabel
                }
              >
                Assigned Advisor
              </Text>

              <Text
                style={
                  styles.assignedName
                }
              >
                {vehicle.advisor_name ||
                  "Advisor"}

                {isMyVehicle
                  ? " (You)"
                  : ""}
              </Text>
            </View>
          </View>
        )}

        {/* Open Intake */}
        {profile?.role ===
          "advisor" &&
          isPending && (
            <TouchableOpacity
              style={[
                styles.takeButton,
                isTaking &&
                  styles.takeButtonDisabled,
              ]}
              onPress={(event) => {
                event.stopPropagation();

                handleOpenIntake(
                  vehicle.id
                );
              }}
              disabled={isTaking}
              activeOpacity={0.8}
            >
              {isTaking ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />

                  <Text
                    style={
                      styles.takeButtonText
                    }
                  >
                    Opening...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="hand-left-outline"
                    size={18}
                    color={colors.white}
                  />

                  <Text
                    style={
                      styles.takeButtonText
                    }
                  >
                    Open Intake
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={[
          "top",
          "bottom",
        ]}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text
            style={styles.loadingText}
          >
            Loading vehicles...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        "top",
        "bottom",
      ]}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={
              handleRefresh
            }
            tintColor={
              colors.primary
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text
              style={styles.title}
            >
              Vehicles
            </Text>

            <Text
              style={styles.subtitle}
            >
              Vehicle workflow and job status
            </Text>
          </View>

          <View
            style={styles.headerIcon}
          >
            <Ionicons
              name="car-outline"
              size={25}
              color={colors.primary}
            />
          </View>
        </View>

        {/* Workflow stages */}
        {stageConfig.map((stage) => {
          const stageVehicles =
            vehiclesByStage[
              stage.key
            ] || [];

          // Hide empty stages
          if (
            stageVehicles.length === 0
          ) {
            return null;
          }

          return (
            <View
              key={stage.key}
              style={[
                styles.stageSection,
                styles.stageSectionSpacing,
              ]}
            >
              {/* Section Header */}
              <View
                style={
                  styles.sectionHeader
                }
              >
                <View
                  style={
                    styles.sectionTitleArea
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    {stage.label}
                  </Text>

                  <Text
                    style={
                      styles.sectionSubtitle
                    }
                  >
                    {stage.description}
                  </Text>
                </View>

                <View
                  style={
                    styles.countBadge
                  }
                >
                  <Text
                    style={
                      styles.countText
                    }
                  >
                    {stageVehicles.length}
                  </Text>
                </View>
              </View>

              {/* Vehicles */}
              {stageVehicles.map(
                renderVehicleCard
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Custom Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalVisible(false)
        }
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={styles.modalCard}
          >
            <View
              style={styles.modalIcon}
            >
              <Ionicons
                name="information-circle-outline"
                size={28}
                color={colors.primary}
              />
            </View>

            <Text
              style={styles.modalTitle}
            >
              {modalTitle}
            </Text>

            <Text
              style={
                styles.modalMessage
              }
            >
              {modalMessage}
            </Text>

            <TouchableOpacity
              style={
                styles.modalButton
              }
              onPress={() =>
                setModalVisible(false)
              }
              activeOpacity={0.8}
            >
              <Text
                style={
                  styles.modalButtonText
                }
              >
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  content: {
    padding: spacing.lg,
    paddingBottom:
      spacing.xxl,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom:
      spacing.xl,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.body,
    color:
      colors.textSecondary,
    marginTop: spacing.xs,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent:
      "center",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom:
      spacing.md,
  },

  sectionTitleArea: {
    flex: 1,
    paddingRight:
      spacing.md,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  sectionSubtitle: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  countBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius:
      radius.round,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent:
      "center",
  },

  countText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  stageSection: {
    marginBottom:
      spacing.md,
  },

  stageSectionSpacing: {
    marginTop:
      spacing.xl,
  },

  vehicleCard: {
    backgroundColor:
      colors.surface,
    borderRadius:
      radius.lg,
    padding: spacing.lg,
    marginBottom:
      spacing.md,
    borderWidth: 1,
    borderColor:
      colors.border,
  },

  vehicleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom:
      spacing.md,
  },

  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent:
      "center",
  },

  vehicleMain: {
    flex: 1,
    marginLeft:
      spacing.md,
  },

  vehicleNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },

  vehicleModel: {
    fontSize: 13,
    color:
      colors.textSecondary,
    marginTop: 3,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius:
      radius.round,
  },

  pendingBadge: {
    backgroundColor:
      colors.warningLight,
  },

  assignedBadge: {
    backgroundColor:
      colors.successLight,
  },

  stageBadge: {
    backgroundColor:
      colors.infoLight,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },

  pendingText: {
    color: colors.warning,
  },

  assignedText: {
    color: colors.success,
  },

  stageText: {
    color: colors.info,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color:
      colors.textSecondary,
    marginLeft: spacing.sm,
  },

  assignedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      colors.successLight,
    borderRadius:
      radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },

  assignedContent: {
    marginLeft: spacing.sm,
  },

  assignedLabel: {
    fontSize: 11,
    color:
      colors.textSecondary,
  },

  assignedName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },

  takeButton: {
    height: 46,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "center",
    marginTop: spacing.md,
    gap: 8,
  },

  takeButtonDisabled: {
    opacity: 0.7,
  },

  takeButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent:
      "center",
  },

  loadingText: {
    fontSize: 14,
    color:
      colors.textSecondary,
    marginTop: spacing.md,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent:
      "center",
    padding: spacing.xl,
  },

  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor:
      colors.surface,
    borderRadius:
      radius.xl,
    padding: spacing.xl,
    alignItems: "center",
  },

  modalIcon: {
    width: 58,
    height: 58,
    borderRadius:
      radius.round,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent:
      "center",
    marginBottom:
      spacing.md,
  },

  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },

  modalMessage: {
    fontSize: 14,
    color:
      colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.sm,
  },

  modalButton: {
    width: "100%",
    height: 46,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primary,
    alignItems: "center",
    justifyContent:
      "center",
    marginTop: spacing.lg,
  },

  modalButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});