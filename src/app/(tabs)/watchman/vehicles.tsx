import { Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import BackButton from "../../../components/navigation/BackButton";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../theme";

type Profile = {
  id: string;
  name: string | null;
  role: string;
  is_active: boolean;
};

type Visit = {
  id: string;
  vehicle_id: string;
  current_stage: string;
  current_status: string;
  stage_started_at: string | null;
  created_at: string;
};

type Vehicle = {
  id: string;
  vehicle_no: string;
  current_stage: string | null;
  current_status: string | null;
  current_assigned_to: string | null;
};

type GateEntry = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  gate_in_at: string;
  recorded_by: string;
};

type Assignment = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  assigned_to: string;
  assigned_by: string;
  assignment_role: string;
  assigned_at: string;
  unassigned_at: string | null;
  remarks: string | null;
};

type Advisor = {
  id: string;
  name: string | null;
  role: string;
};

type PopupType = "success" | "error" | "info";

export default function WatchmanVehiclesScreen() {
  const handleNavigationBack = () => {
    returnToRoute("/(tabs)/watchman");
  };
  useHardwareBack(handleNavigationBack);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [gateEntries, setGateEntries] = useState<GateEntry[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedVisit, setSelectedVisit] =
    useState<Visit | null>(null);

  const [selectedAdvisor, setSelectedAdvisor] =
    useState<Advisor | null>(null);

  const [remarks, setRemarks] = useState("");

  const [assigning, setAssigning] = useState(false);
  const assignmentBusy = useRef(false);

  const [showAssignModal, setShowAssignModal] =
    useState(false);

  const [showConfirmModal, setShowConfirmModal] =
    useState(false);

  const [searchText, setSearchText] = useState("");

  const [popupVisible, setPopupVisible] =
    useState(false);

  const [popupType, setPopupType] =
    useState<PopupType>("info");

  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] =
    useState("");

  /*
   * ============================================================
   * POPUP
   * ============================================================
   */

  const showPopup = (
    type: PopupType,
    title: string,
    message: string
  ) => {
    setPopupType(type);
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupVisible(true);
  };

  const closePopup = () => {
    setPopupVisible(false);
  };

  /*
   * ============================================================
   * PROFILE
   * ============================================================
   */

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (
      !data ||
      !data.is_active ||
      !["watchman", "ceo_admin"].includes(
        data.role
      )
    ) {
      router.replace("/(tabs)");
      return null;
    }

    setProfile(data);

    return data;
  }, []);

  /*
   * ============================================================
   * CURRENT VEHICLES
   * ============================================================
   */

  const loadCurrentVehicles =
    useCallback(async () => {
      const { data: visitData, error: visitError } =
        await supabase
          .from("workshop_visits")
          .select(
            "id, vehicle_id, current_stage, current_status, stage_started_at, created_at"
          )
          .eq(
            "current_stage",
            "PENDING_ADVISOR"
          )
          .is("closed_at", null)
          .in("current_status", [
            "PENDING",
            "IN_PROGRESS",
          ])
          .order("created_at", {
            ascending: false,
          });

      if (visitError) {
        throw visitError;
      }

      const loadedVisits =
        (visitData || []) as Visit[];

      setVisits(loadedVisits);

      if (loadedVisits.length === 0) {
        setVehicles([]);
        setGateEntries([]);
        return;
      }

      const vehicleIds = [
        ...new Set(
          loadedVisits.map(
            (item) => item.vehicle_id
          )
        ),
      ];

      const visitIds = loadedVisits.map(
        (item) => item.id
      );

      const [
        vehicleResult,
        gateResult,
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select(
            "id, vehicle_no, current_stage, current_status, current_assigned_to"
          )
          .in("id", vehicleIds),

        supabase
          .from("gate_entries")
          .select(
            "id, visit_id, vehicle_id, gate_in_at, recorded_by"
          )
          .in("visit_id", visitIds)
          .order("gate_in_at", {
            ascending: false,
          }),
      ]);

      if (vehicleResult.error) {
        throw vehicleResult.error;
      }

      if (gateResult.error) {
        throw gateResult.error;
      }

      setVehicles(
        (vehicleResult.data ||
          []) as Vehicle[]
      );

      setGateEntries(
        (gateResult.data ||
          []) as GateEntry[]
      );
    }, []);

  /*
   * ============================================================
   * ADVISORS
   * ============================================================
   */

  const loadAdvisors = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role")
      .eq("role", "advisor")
      .eq("is_active", true)
      .order("name", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setAdvisors(
      (data || []) as Advisor[]
    );
  }, []);

  /*
   * ============================================================
   * ASSIGNMENTS
   * ============================================================
   */

  const loadAssignments = useCallback(
    async (profileId: string) => {
      if (!profileId) {
        return;
      }

      const { data, error } =
        await supabase
          .from("vehicle_assignments")
          .select(
            "id, visit_id, vehicle_id, assigned_to, assigned_by, assignment_role, assigned_at, unassigned_at, remarks"
          )
          .eq(
            "assigned_by",
            profileId
          )
          .eq(
            "assignment_role",
            "ADVISOR"
          )
          .order("assigned_at", {
            ascending: false,
          })
          .limit(100);

      if (error) {
        throw error;
      }

      setAssignments(
        (data || []) as Assignment[]
      );
    },
    []
  );

  /*
   * ============================================================
   * LOAD EVERYTHING
   * ============================================================
   */

  const loadAll = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        }

        const currentProfile =
          profile || (await loadProfile());

        if (!currentProfile) {
          return;
        }

        await Promise.all([
          loadCurrentVehicles(),
          loadAdvisors(),
          loadAssignments(
            currentProfile.id
          ),
        ]);
      } catch (error: any) {
        console.log(
          "Watchman vehicles error:",
          error
        );

        showPopup(
          "error",
          "Unable to Load",
          error?.message ||
            "Unable to load vehicle information."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      profile,
      loadProfile,
      loadCurrentVehicles,
      loadAdvisors,
      loadAssignments,
    ]
  );

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */

  useEffect(() => {
    loadAll();
  }, []);

  /*
   * ============================================================
   * REFRESH WHEN SCREEN RETURNS
   * ============================================================
   */

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        loadAll();
      }
    }, [profile?.id, loadAll])
  );

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  const getVehicle = (
    vehicleId: string
  ) => {
    return vehicles.find(
      (item) => item.id === vehicleId
    );
  };

  const getGateEntry = (
    visitId: string
  ) => {
    return gateEntries.find(
      (item) => item.visit_id === visitId
    );
  };

  const formatDateTime = (
    value: string | null
  ) => {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTime = (
    value: string | null
  ) => {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    );
  };

  const formatStage = (
    stage: string | null
  ) => {
    if (!stage) {
      return "Unknown";
    }

    return stage
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        (letter: string) =>
          letter.toUpperCase()
      );
  };

  /*
   * ============================================================
   * WAITING DURATION
   * ============================================================
   */

  const getWaitingText = (
    value: string | null
  ) => {
    if (!value) {
      return "Waiting time unavailable";
    }

    const startedAt =
      new Date(value).getTime();

    const now = Date.now();

    const difference = Math.max(
      0,
      now - startedAt
    );

    const totalMinutes = Math.floor(
      difference / 60000
    );

    if (totalMinutes < 1) {
      return "Waiting < 1 min";
    }

    if (totalMinutes < 60) {
      return `Waiting ${totalMinutes} min`;
    }

    const hours = Math.floor(
      totalMinutes / 60
    );

    const minutes =
      totalMinutes % 60;

    if (hours < 24) {
      if (minutes === 0) {
        return `Waiting ${hours} hr`;
      }

      return `Waiting ${hours} hr ${minutes} min`;
    }

    const days = Math.floor(
      hours / 24
    );

    const remainingHours =
      hours % 24;

    if (remainingHours === 0) {
      return `Waiting ${days} day${
        days > 1 ? "s" : ""
      }`;
    }

    return `Waiting ${days} day${
      days > 1 ? "s" : ""
    } ${remainingHours} hr`;
  };

  /*
   * ============================================================
   * SEARCH
   * ============================================================
   */

  const normalizedSearch = searchText
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");

  const pendingVehicles = visits
    .map((visit) => {
      const vehicle = getVehicle(
        visit.vehicle_id
      );

      return {
        visit,
        vehicle,
        gateEntry: getGateEntry(
          visit.id
        ),
      };
    })
    .filter((item) => {
      if (!item.vehicle) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const vehicleNumber =
        item.vehicle.vehicle_no
          ?.toUpperCase()
          .replace(/[\s-]+/g, "") ||
        "";

      return vehicleNumber.includes(
        normalizedSearch
      );
    });

  /*
   * ============================================================
   * OPEN ASSIGN MODAL
   * ============================================================
   */

  const openAssignModal = (
    visit: Visit
  ) => {
    setSelectedVisit(visit);
    setSelectedAdvisor(null);
    setRemarks("");
    setShowAssignModal(true);
  };

  /*
   * ============================================================
   * CLOSE ASSIGN MODAL
   * ============================================================
   */

  const closeAssignModal = () => {
    if (assigning) {
      return;
    }

    setShowAssignModal(false);
    setSelectedVisit(null);
    setSelectedAdvisor(null);
    setRemarks("");
  };

  /*
   * ============================================================
   * OPEN CONFIRMATION
   * ============================================================
   */

  const openAssignmentConfirmation =
    () => {
      if (!selectedVisit) {
        return;
      }

      if (!selectedAdvisor) {
        showPopup(
          "info",
          "Select Advisor",
          "Please select an Advisor before continuing."
        );

        return;
      }

      setShowAssignModal(false);
      setShowConfirmModal(true);
    };

  /*
   * ============================================================
   * CANCEL CONFIRMATION
   * ============================================================
   */

  const cancelAssignmentConfirmation =
    () => {
      if (assigning) {
        return;
      }

      setShowConfirmModal(false);
      setShowAssignModal(true);
    };

  /*
   * ============================================================
   * FINAL ASSIGNMENT
   * ============================================================
   */

  const confirmAssignment = async () => {
    if (assignmentBusy.current) return;
    if (
      !selectedVisit ||
      !selectedAdvisor
    ) {
      return;
    }

    try {
      assignmentBusy.current = true;
      setAssigning(true);

      const { data, error } =
        await supabase.rpc(
          "new_workflow_assign_advisor",
          {
            p_visit_id:
              selectedVisit.id,
            p_advisor_id:
              selectedAdvisor.id,
            p_remarks:
              remarks.trim() || null,
          }
        );

      if (error) {
        throw error;
      }

      if (data?.success !== true) throw new Error("The assignment could not be confirmed. Refresh before trying again.");

      const vehicle =
        getVehicle(
          selectedVisit.vehicle_id
        );

      const vehicleNumber =
        vehicle?.vehicle_no ||
        "Vehicle";

      const advisorName =
        selectedAdvisor.name?.trim() ||
        "Advisor";

      setShowConfirmModal(false);

      setSelectedVisit(null);
      setSelectedAdvisor(null);
      setRemarks("");

      if (profile?.id) {
        await Promise.all([
          loadCurrentVehicles(),
          loadAssignments(
            profile.id
          ),
        ]);
      } else {
        await loadCurrentVehicles();
      }

      showPopup(
        "success",
        "Vehicle Assigned",
        `${vehicleNumber} has been assigned to ${advisorName}.`
      );
    } catch (error: any) {
      console.log(
        "Assign advisor error:",
        error
      );

      setShowConfirmModal(false);

      showPopup(
        "error",
        "Assignment Failed",
        error?.message ||
          "Unable to assign the vehicle to the selected Advisor."
      );
    } finally {
      assignmentBusy.current = false;
      setAssigning(false);
    }
  };

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading && !profile) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text
            style={styles.loadingText}
          >
            Loading pending vehicles...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ============================================================
   * SCREEN
   * ============================================================
   */

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadAll(true)
            }
            tintColor={
              colors.primary
            }
          />
        }
      >
        {/* ======================================================
            HEADER
        ====================================================== */}

        <BackButton accessibilityLabel="Back" onPress={handleNavigationBack} />
        <View style={styles.header}>
          <View
            style={styles.headerTextContainer}
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              Pending Advisor
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Vehicles waiting for Advisor assignment
            </Text>
          </View>

          <Pressable
            onPress={() =>
              loadAll(true)
            }
            style={({ pressed }) => [
              styles.refreshButton,
              pressed &&
                styles.pressed,
            ]}
          >
            {refreshing ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.primary
                }
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={23}
                color={
                  colors.primary
                }
              />
            )}
          </Pressable>
        </View>

        {/* ======================================================
            SUMMARY
        ====================================================== */}

        <View style={styles.summaryRow}>
          <View
            style={styles.summaryCard}
          >
            <View
              style={
                styles.summaryIcon
              }
            >
              <Ionicons
                name="car-outline"
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.summaryValue
              }
            >
              {pendingVehicles.length}
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Pending Advisor
            </Text>
          </View>

          <View
            style={styles.summaryCard}
          >
            <View
              style={
                styles.summaryIcon
              }
            >
              <Ionicons
                name="person-add-outline"
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.summaryValue
              }
            >
              {assignments.length}
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Your Assignments
            </Text>
          </View>
        </View>

        {/* ======================================================
            ASSIGNMENT HISTORY
        ====================================================== */}

        <Pressable
          onPress={() =>
            router.push({ pathname: "/(tabs)/watchman/assignment-history", params: { returnTo: "watchman-vehicles" } })
          }
          style={({ pressed }) => [
            styles.historyButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <View
            style={
              styles.historyButtonIcon
            }
          >
            <Ionicons
              name="time-outline"
              size={21}
              color={
                colors.primary
              }
            />
          </View>

          <View
            style={
              styles.historyButtonText
            }
          >
            <Text
              style={
                styles.historyButtonTitle
              }
            >
              Assignment History
            </Text>

            <Text
              style={
                styles.historyButtonSubtitle
              }
            >
              View your Advisor assignments
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={
              colors.textSecondary
            }
          />
        </Pressable>

        {/* ======================================================
            SEARCH
        ====================================================== */}

        <View
          style={
            styles.searchContainer
          }
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={
              colors.textSecondary
            }
          />

          <TextInput
            value={searchText}
            onChangeText={
              setSearchText
            }
            placeholder="Search vehicle number"
            placeholderTextColor={
              colors.textSecondary
            }
            autoCapitalize="characters"
            autoCorrect={false}
            style={
              styles.searchInput
            }
          />

          {searchText.length > 0 && (
            <Pressable
              onPress={() =>
                setSearchText("")
              }
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={
                  colors.textSecondary
                }
              />
            </Pressable>
          )}
        </View>

        {/* ======================================================
            SECTION
        ====================================================== */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Pending Advisor
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Vehicles waiting for assignment
            </Text>
          </View>

          <View
            style={
              styles.countBadge
            }
          >
            <Text
              style={
                styles.countBadgeText
              }
            >
              {pendingVehicles.length}
            </Text>
          </View>
        </View>

        {/* ======================================================
            EMPTY
        ====================================================== */}

        {pendingVehicles.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <View
              style={styles.emptyIcon}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={32}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No vehicles pending
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              {searchText.trim()
                ? "No vehicle matches your search."
                : "All vehicles currently have an Advisor assigned, or there are no new Gate In vehicles waiting."}
            </Text>
          </View>
        ) : (
          pendingVehicles.map(
            ({
              visit,
              vehicle,
              gateEntry,
            }) => {
              if (!vehicle) {
                return null;
              }

              return (
                <View
                  key={visit.id}
                  style={
                    styles.vehicleCard
                  }
                >
                  {/* Vehicle Header */}
                  <View
                    style={
                      styles.vehicleHeader
                    }
                  >
                    <View
                      style={
                        styles.vehicleNumberBox
                      }
                    >
                      <Ionicons
                        name="car-outline"
                        size={23}
                        color={
                          colors.primary
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.vehicleHeaderText
                      }
                    >
                      <Text
                        style={
                          styles.vehicleNumber
                        }
                      >
                        {
                          vehicle.vehicle_no
                        }
                      </Text>

                      <Text
                        style={
                          styles.vehicleMeta
                        }
                      >
                        Gate In{" "}
                        {formatTime(
                          gateEntry?.gate_in_at ||
                            null
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.pendingBadge
                      }
                    >
                      <Text
                        style={
                          styles.pendingBadgeText
                        }
                      >
                        Pending
                      </Text>
                    </View>
                  </View>

                  {/* Waiting */}
                  <View
                    style={
                      styles.waitingBox
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={19}
                      color={
                        colors.primary
                      }
                    />

                    <View
                      style={
                        styles.waitingTextContainer
                      }
                    >
                      <Text
                        style={
                          styles.waitingTitle
                        }
                      >
                        {getWaitingText(
                          visit.stage_started_at ||
                            gateEntry?.gate_in_at ||
                            null
                        )}
                      </Text>

                      <Text
                        style={
                          styles.waitingSubtitle
                        }
                      >
                        Since{" "}
                        {formatDateTime(
                          visit.stage_started_at ||
                            gateEntry?.gate_in_at ||
                            null
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Minimal details */}
                  <View
                    style={
                      styles.infoRow
                    }
                  >
                    <Text
                      style={
                        styles.infoLabel
                      }
                    >
                      Current Stage
                    </Text>

                    <Text
                      style={
                        styles.infoValue
                      }
                    >
                      {formatStage(
                        vehicle.current_stage
                      )}
                    </Text>
                  </View>

                  {/* Assign */}
                  <Pressable
                    onPress={() =>
                      openAssignModal(
                        visit
                      )
                    }
                    style={({ pressed }) => [
                      styles.assignButton,
                      pressed &&
                        styles.assignButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="person-add-outline"
                      size={19}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.assignButtonText
                      }
                    >
                      Assign Advisor
                    </Text>
                  </Pressable>
                </View>
              );
            }
          )
        )}
      </ScrollView>

      {/* ========================================================
          ASSIGN ADVISOR MODAL
      ======================================================== */}

      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={
          closeAssignModal
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
            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="always" nestedScrollEnabled>

            <View
              style={
                styles.modalHandle
              }
            />

            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Assign Advisor
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Select an Advisor for this vehicle
                </Text>
              </View>

              <Pressable
                onPress={
                  closeAssignModal
                }
                disabled={assigning}
                style={
                  styles.modalCloseButton
                }
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={
                    colors.textSecondary
                  }
                />
              </Pressable>
            </View>

            {/* Selected Vehicle */}
            {selectedVisit && (
              <View
                style={
                  styles.selectedVehicleCard
                }
              >
                <View
                  style={
                    styles.selectedVehicleIcon
                  }
                >
                  <Ionicons
                    name="car-outline"
                    size={22}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.selectedVehicleText
                  }
                >
                  <Text
                    style={
                      styles.selectedVehicleNumber
                    }
                  >
                    {getVehicle(
                      selectedVisit.vehicle_id
                    )?.vehicle_no ||
                      "Vehicle"}
                  </Text>

                  <Text
                    style={
                      styles.selectedVehicleStage
                    }
                  >
                    Pending Advisor Assignment
                  </Text>
                </View>
              </View>
            )}

            <Text
              style={
                styles.modalSectionTitle
              }
            >
              Select Advisor
            </Text>

            <ScrollView
              style={
                styles.advisorList
              }
              contentContainerStyle={
                styles.advisorListContent
              }
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="always"
            >
              {advisors.length === 0 ? (
                <View
                  style={
                    styles.noAdvisorCard
                  }
                >
                  <Ionicons
                    name="people-outline"
                    size={28}
                    color={
                      colors.textSecondary
                    }
                  />

                  <Text
                    style={
                      styles.noAdvisorText
                    }
                  >
                    No active Advisors available.
                  </Text>
                </View>
              ) : (
                advisors.map(
                  (advisor) => {
                    const selected =
                      selectedAdvisor?.id ===
                      advisor.id;

                    return (
                      <Pressable
                        key={
                          advisor.id
                        }
                        onPress={() =>
                          setSelectedAdvisor(
                            advisor
                          )
                        }
                        style={[
                          styles.advisorOption,
                          selected &&
                            styles.advisorOptionSelected,
                        ]}
                      >
                        <View
                          style={
                            styles.advisorAvatar
                          }
                        >
                          <Text
                            style={
                              styles.advisorAvatarText
                            }
                          >
                            {(
                              advisor.name ||
                              "A"
                            )
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.advisorInfo
                          }
                        >
                          <Text
                            style={
                              styles.advisorName
                            }
                          >
                            {advisor.name?.trim() ||
                              "Advisor"}
                          </Text>

                          <Text
                            style={
                              styles.advisorRole
                            }
                          >
                            Advisor
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.radioOuter,
                            selected &&
                              styles.radioOuterSelected,
                          ]}
                        >
                          {selected && (
                            <View
                              style={
                                styles.radioInner
                              }
                            />
                          )}
                        </View>
                      </Pressable>
                    );
                  }
                )
              )}
            </ScrollView>

            <Text
              style={
                styles.modalSectionTitle
              }
            >
              Remarks
              <Text
                style={
                  styles.optionalText
                }
              >
                {" "}
                (Optional)
              </Text>
            </Text>

            <TextInput
              value={remarks}
              onChangeText={
                setRemarks
              }
              placeholder="Add assignment remarks if required"
              placeholderTextColor={
                colors.textSecondary
              }
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={
                styles.remarksInput
              }
              editable={!assigning}
            />

            <Pressable
              onPress={
                openAssignmentConfirmation
              }
              disabled={assigning}
              style={({ pressed }) => [
                styles.modalAssignButton,
                pressed &&
                  !assigning &&
                  styles.assignButtonPressed,
                assigning &&
                  styles.disabledButton,
              ]}
            >
              <Ionicons
                name="arrow-forward-circle-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.modalAssignButtonText
                }
              >
                Continue
              </Text>
            </Pressable>
          </ScrollView>
          </View>
        </View>
        </SafeAreaView>
      </Modal>

      {/* ========================================================
          ASSIGNMENT CONFIRMATION
      ======================================================== */}

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={
          cancelAssignmentConfirmation
        }
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View
          style={
            styles.popupOverlay
          }
        >
          <View
            style={
              styles.confirmCard
            }
          >
            <View
              style={
                styles.confirmIcon
              }
            >
              <Ionicons
                name="person-add-outline"
                size={28}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.confirmTitle
              }
            >
              Confirm Assignment
            </Text>

            <Text
              style={
                styles.confirmMessage
              }
            >
              Assign{" "}
              <Text
                style={
                  styles.confirmStrong
                }
              >
                {selectedVisit
                  ? getVehicle(
                      selectedVisit.vehicle_id
                    )?.vehicle_no ||
                    "this vehicle"
                  : "this vehicle"}
              </Text>{" "}
              to{" "}
              <Text
                style={
                  styles.confirmStrong
                }
              >
                {selectedAdvisor?.name ||
                  "the selected Advisor"}
              </Text>
              ?
            </Text>

            {remarks.trim() ? (
              <View
                style={
                  styles.confirmRemarks
                }
              >
                <Text
                  style={
                    styles.confirmRemarksLabel
                  }
                >
                  Remarks
                </Text>

                <Text
                  style={
                    styles.confirmRemarksText
                  }
                >
                  {remarks.trim()}
                </Text>
              </View>
            ) : null}

            <View
              style={
                styles.confirmActions
              }
            >
              <Pressable
                onPress={
                  cancelAssignmentConfirmation
                }
                disabled={assigning}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={
                  confirmAssignment
                }
                disabled={assigning}
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed &&
                    !assigning &&
                    styles.assignButtonPressed,
                  assigning &&
                    styles.disabledButton,
                ]}
              >
                {assigning ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmButtonText
                    }
                  >
                    Confirm Assignment
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
        </SafeAreaView>
      </Modal>

      {/* ========================================================
          SUCCESS / ERROR / INFO POPUP
      ======================================================== */}

      <Modal
        visible={popupVisible}
        transparent
        animationType="fade"
        onRequestClose={
          closePopup
        }
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View
          style={
            styles.popupOverlay
          }
        >
          <View
            style={
              styles.popupCard
            }
          >
            <View
              style={[
                styles.popupIcon,
                popupType ===
                  "success" &&
                  styles.popupIconSuccess,
                popupType ===
                  "error" &&
                  styles.popupIconError,
                popupType ===
                  "info" &&
                  styles.popupIconInfo,
              ]}
            >
              <Ionicons
                name={
                  popupType ===
                  "success"
                    ? "checkmark"
                    : popupType ===
                      "error"
                    ? "close"
                    : "information"
                }
                size={27}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.popupTitle
              }
            >
              {popupTitle}
            </Text>

            <Text
              style={
                styles.popupMessage
              }
            >
              {popupMessage}
            </Text>

            <Pressable
              onPress={
                closePopup
              }
              style={({ pressed }) => [
                styles.popupButton,
                pressed &&
                  styles.assignButtonPressed,
              ]}
            >
              <Text
                style={
                  styles.popupButtonText
                }
              >
                OK
              </Text>
            </Pressable>
          </View>
        </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/*
 * =================================================================
 * STYLES
 * =================================================================
 */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  /*
   * HEADER
   */

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },

  headerTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  /*
   * SUMMARY
   */

  summaryRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  summaryValue: {
    ...typography.subheading,
    color: colors.text,
    fontSize: 26,
  },

  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  /*
   * HISTORY
   */

  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  historyButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  historyButtonText: {
    flex: 1,
  },

  historyButtonTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  historyButtonSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },

  /*
   * SEARCH
   */

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },

  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },

  /*
   * SECTION
   */

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  countBadge: {
    minWidth: 34,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  countBadgeText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  /*
   * EMPTY
   */

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
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

  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop: spacing.sm,
  },

  /*
   * VEHICLE
   */

  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  vehicleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  vehicleNumberBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  vehicleHeaderText: {
    flex: 1,
  },

  vehicleNumber: {
    ...typography.subheading,
    color: colors.text,
    letterSpacing: 0.3,
  },

  vehicleMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },

  pendingBadgeText: {
    ...typography.caption,
    color: colors.primary,
  },

  /*
   * WAITING
   */

  waitingBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  waitingTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  waitingTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  waitingSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  /*
   * VEHICLE DETAILS
   */

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.md,
  },

  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },

  infoValue: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1.5,
    textAlign: "right",
  },

  /*
   * ASSIGN BUTTON
   */

  assignButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  assignButtonText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
    marginLeft: spacing.sm,
  },

  assignButtonPressed: {
    opacity: 0.75,
  },

  disabledButton: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.72,
  },

  /*
   * ASSIGN MODAL
   */

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: "92%",
  },

  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },

  modalTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedVehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  selectedVehicleIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  selectedVehicleText: {
    flex: 1,
  },

  selectedVehicleNumber: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  selectedVehicleStage: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  modalSectionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  optionalText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  advisorList: {
    maxHeight: 230,
    marginBottom: spacing.md,
  },

  advisorListContent: {
    gap: spacing.sm,
  },

  advisorOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  advisorOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  advisorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  advisorAvatarText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  advisorInfo: {
    flex: 1,
  },

  advisorName: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  advisorRole: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  radioOuterSelected: {
    borderColor: colors.primary,
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },

  noAdvisorCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  noAdvisorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  remarksInput: {
    minHeight: 82,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },

  modalAssignButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },

  modalAssignButtonText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
    marginLeft: spacing.sm,
  },

  /*
   * CONFIRMATION
   */

  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  confirmCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  confirmIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  confirmTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
  },

  confirmMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.sm,
  },

  confirmStrong: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  confirmRemarks: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },

  confirmRemarksLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },

  confirmRemarksText: {
    ...typography.body,
    color: colors.text,
  },

  confirmActions: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.md,
    marginTop: spacing.lg,
  },

  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  confirmButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },

  confirmButtonText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
    textAlign: "center",
  },

  /*
   * SUCCESS / ERROR POPUP
   */

  popupCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  popupIconSuccess: {
    backgroundColor: colors.primaryLight,
  },

  popupIconError: {
    backgroundColor: colors.primaryLight,
  },

  popupIconInfo: {
    backgroundColor: colors.primaryLight,
  },

  popupTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
  },

  popupMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop: spacing.sm,
  },

  popupButton: {
    width: "100%",
    minHeight: 46,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },

  popupButtonText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
  },
});