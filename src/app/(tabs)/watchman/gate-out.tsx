import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
  visit_no: number | null;
  current_stage: string;
  current_status: string;
  stage_started_at: string | null;
  created_at: string;
};

type Vehicle = {
  id: string;
  vehicle_no: string;
  current_stage: string;
  current_status: string;
};

type GateEntry = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  gate_in_at: string;
};

type GateOutVehicle = {
  visit: Visit;
  vehicle: Vehicle;
  gateEntry: GateEntry | null;
};

type PopupType =
  | "confirm"
  | "success"
  | "error"
  | "info";

type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
};

export default function WatchmanGateOutScreen() {
  const insets = useSafeAreaInsets();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [vehicles, setVehicles] = useState<
    GateOutVehicle[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [selectedVehicle, setSelectedVehicle] =
    useState<GateOutVehicle | null>(null);

  const [remarks, setRemarks] =
    useState("");

  const [processing, setProcessing] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  /*
   * =========================================================
   * POPUP
   * =========================================================
   */

  const [popup, setPopup] =
    useState<PopupState>({
      visible: false,
      type: "info",
      title: "",
      message: "",
    });

  const closePopup = () => {
    if (processing) {
      return;
    }

    setPopup((current) => ({
      ...current,
      visible: false,
    }));
  };

  const showPopup = (
    type: PopupType,
    title: string,
    message: string,
    options?: {
      confirmText?: string;
      cancelText?: string;
      onConfirm?: () => void;
    }
  ) => {
    setPopup({
      visible: true,
      type,
      title,
      message,
      confirmText:
        options?.confirmText,
      cancelText:
        options?.cancelText,
      onConfirm:
        options?.onConfirm,
    });
  };

  /*
   * =========================================================
   * PROFILE
   * =========================================================
   */

  const loadProfile = useCallback(
    async () => {
      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error(
          "You are not logged in."
        );
      }

      const { data, error } =
        await supabase
          .from("profiles")
          .select(
            "id, name, role, is_active"
          )
          .eq("id", user.id)
          .single();

      if (error) {
        throw error;
      }

      const loadedProfile =
        data as Profile;

      if (
        !loadedProfile.is_active ||
        ![
          "watchman",
          "ceo_admin",
        ].includes(
          loadedProfile.role
        )
      ) {
        throw new Error(
          "You are not authorized to access Gate Out."
        );
      }

      setProfile(loadedProfile);

      return loadedProfile;
    },
    []
  );

  /*
   * =========================================================
   * LOAD PENDING GATE OUT VEHICLES
   * =========================================================
   */

  const loadVehicles =
    useCallback(async () => {
      const {
        data: visitData,
        error: visitError,
      } = await supabase
        .from("workshop_visits")
        .select(
          "id, vehicle_id, visit_no, current_stage, current_status, stage_started_at, created_at"
        )
        .eq(
          "current_stage",
          "PENDING_GATE_OUT"
        )
        .in("current_status", [
          "PENDING",
          "IN_PROGRESS",
        ])
        .order("stage_started_at", {
          ascending: true,
        });

      if (visitError) {
        throw visitError;
      }

      const visits =
        (visitData || []) as Visit[];

      if (visits.length === 0) {
        setVehicles([]);
        return;
      }

      const vehicleIds = [
        ...new Set(
          visits.map(
            (visit) =>
              visit.vehicle_id
          )
        ),
      ];

      const visitIds =
        visits.map(
          (visit) => visit.id
        );

      const [
        vehicleResult,
        gateEntryResult,
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select(
            "id, vehicle_no, current_stage, current_status"
          )
          .in("id", vehicleIds),

        supabase
          .from("gate_entries")
          .select(
            "id, visit_id, vehicle_id, gate_in_at"
          )
          .in("visit_id", visitIds)
          .order("gate_in_at", {
            ascending: false,
          }),
      ]);

      if (vehicleResult.error) {
        throw vehicleResult.error;
      }

      if (gateEntryResult.error) {
        throw gateEntryResult.error;
      }

      const vehicleMap =
        new Map<string, Vehicle>();

      (
        (vehicleResult.data ||
          []) as Vehicle[]
      ).forEach((vehicle) => {
        vehicleMap.set(
          vehicle.id,
          vehicle
        );
      });

      const gateEntryMap =
        new Map<
          string,
          GateEntry
        >();

      (
        (gateEntryResult.data ||
          []) as GateEntry[]
      ).forEach((entry) => {
        if (
          !gateEntryMap.has(
            entry.visit_id
          )
        ) {
          gateEntryMap.set(
            entry.visit_id,
            entry
          );
        }
      });

      const result: GateOutVehicle[] =
        [];

      visits.forEach((visit) => {
        const vehicle =
          vehicleMap.get(
            visit.vehicle_id
          );

        if (!vehicle) {
          return;
        }

        result.push({
          visit,
          vehicle,
          gateEntry:
            gateEntryMap.get(
              visit.id
            ) || null,
        });
      });

      setVehicles(result);
    }, []);

  /*
   * =========================================================
   * LOAD ALL
   * =========================================================
   */

  const loadAll = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const currentProfile =
          profile ||
          (await loadProfile());

        if (!currentProfile) {
          return;
        }

        await loadVehicles();
      } catch (error: any) {
        console.log(
          "Watchman Gate Out error:",
          error
        );

        showPopup(
          "error",
          "Unable to Load Gate Out",
          error?.message ||
            "Something went wrong while loading vehicles."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      profile,
      loadProfile,
      loadVehicles,
    ]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /*
   * =========================================================
   * SEARCH
   * =========================================================
   */

  const filteredVehicles =
    useMemo(() => {
      const query =
        searchText
          .trim()
          .toUpperCase();

      if (!query) {
        return vehicles;
      }

      return vehicles.filter(
        (item) =>
          item.vehicle.vehicle_no
            .toUpperCase()
            .includes(query)
      );
    }, [
      vehicles,
      searchText,
    ]);

  /*
   * =========================================================
   * FORMAT DATE / TIME
   * =========================================================
   */

  const formatDateTime = (
    value: string | null
  ) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    );
  };

  /*
   * =========================================================
   * WAITING TIME
   * =========================================================
   */

  const formatWaitingTime = (
    value: string | null
  ) => {
    if (!value) {
      return "—";
    }

    const start =
      new Date(value).getTime();

    if (Number.isNaN(start)) {
      return "—";
    }

    const difference =
      Math.max(
        0,
        Date.now() - start
      );

    const totalMinutes =
      Math.floor(
        difference /
          (1000 * 60)
      );

    const days =
      Math.floor(
        totalMinutes /
          (60 * 24)
      );

    const hours =
      Math.floor(
        (totalMinutes %
          (60 * 24)) /
          60
      );

    const minutes =
      totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  };

  /*
   * =========================================================
   * BACK
   * =========================================================
   */

  const handleBack = () => {
    if (selectedVehicle) {
      setSelectedVehicle(null);
      setRemarks("");
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(
      "/(tabs)/watchman"
    );
  };

  /*
   * =========================================================
   * COMPLETE GATE OUT
   * =========================================================
   */

  const completeGateOut =
    async () => {
      if (!selectedVehicle) {
        return;
      }

      if (processing) {
        return;
      }

      const vehicleBeingProcessed =
        selectedVehicle;

      setPopup((current) => ({
        ...current,
        visible: false,
      }));

      setProcessing(true);

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "new_workflow_gate_out",
            {
              p_visit_id:
                vehicleBeingProcessed
                  .visit.id,

              p_remarks:
                remarks.trim() ||
                null,
            }
          );

        if (error) {
          throw error;
        }

        console.log(
          "Gate Out RPC result:",
          data
        );

        setSelectedVehicle(
          null
        );

        setRemarks("");

        await loadVehicles();

        showPopup(
          "success",
          "Gate Out Completed",
          `${vehicleBeingProcessed.vehicle.vehicle_no} has been successfully recorded as Gate Out.`
        );
      } catch (error: any) {
        console.log(
          "Complete Gate Out error:",
          error
        );

        showPopup(
          "error",
          "Gate Out Failed",
          error?.message ||
            "Unable to complete Gate Out."
        );
      } finally {
        setProcessing(false);
      }
    };

  /*
   * =========================================================
   * CONFIRMATION POPUP
   * =========================================================
   */

  const confirmGateOut = () => {
    if (!selectedVehicle) {
      return;
    }

    showPopup(
      "confirm",
      "Confirm Gate Out",
      `Are you sure you want to complete Gate Out for ${selectedVehicle.vehicle.vehicle_no}?`,
      {
        confirmText:
          "Confirm Gate Out",
        cancelText: "Cancel",
        onConfirm:
          completeGateOut,
      }
    );
  };

  /*
   * =========================================================
   * POPUP ICON
   * =========================================================
   */

  const getPopupIcon = () => {
    switch (popup.type) {
      case "success":
        return "checkmark-circle";

      case "error":
        return "alert-circle";

      case "confirm":
        return "help-circle";

      default:
        return "information-circle";
    }
  };

  /*
   * =========================================================
   * POPUP COLOR
   * =========================================================
   */

  const getPopupIconColor = () => {
    switch (popup.type) {
      case "success":
        return colors.success;

      case "error":
        return colors.danger;

      case "confirm":
        return colors.primary;

      default:
        return colors.primary;
    }
  };

  /*
   * =========================================================
   * POPUP
   * =========================================================
   */

  const renderPopup = () => {
    if (!popup.visible) {
      return null;
    }

    const isConfirmation =
      popup.type === "confirm";

    return (
      <Modal
        visible={popup.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!processing) {
            closePopup();
          }
        }}
      >
        <View
          style={
            styles.popupOverlay
          }
        >
          <Pressable
            style={
              styles.popupBackdrop
            }
            onPress={() => {
              if (!processing) {
                closePopup();
              }
            }}
          />

          <View
            style={[
              styles.popupCard,
              {
                marginBottom:
                  Math.max(
                    spacing.lg,
                    insets.bottom
                  ),
              },
            ]}
          >
            <View
              style={[
                styles.popupIcon,
                {
                  backgroundColor:
                    getPopupIconColor() +
                    "18",
                },
              ]}
            >
              <Ionicons
                name={
                  getPopupIcon() as any
                }
                size={32}
                color={getPopupIconColor()}
              />
            </View>

            <Text
              style={
                styles.popupTitle
              }
            >
              {popup.title}
            </Text>

            <Text
              style={
                styles.popupMessage
              }
            >
              {popup.message}
            </Text>

            {isConfirmation ? (
              <View
                style={
                  styles.popupActions
                }
              >
                <Pressable
                  onPress={
                    closePopup
                  }
                  disabled={
                    processing
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.popupCancelButton,
                    pressed &&
                      !processing &&
                      styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={
                      styles.popupCancelText
                    }
                  >
                    {popup.cancelText ||
                      "Cancel"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (
                      popup.onConfirm &&
                      !processing
                    ) {
                      popup.onConfirm();
                    }
                  }}
                  disabled={
                    processing
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.popupConfirmButton,
                    pressed &&
                      !processing &&
                      styles.buttonPressed,
                    processing &&
                      styles.buttonDisabled,
                  ]}
                >
                  {processing ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.popupConfirmText
                      }
                    >
                      {popup.confirmText ||
                        "Confirm"}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={
                  closePopup
                }
                style={({
                  pressed,
                }) => [
                  styles.popupOkButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
              >
                <Text
                  style={
                    styles.popupOkText
                  }
                >
                  OK
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

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
            style={
              styles.loadingText
            }
          >
            Loading Gate Out vehicles...
          </Text>
        </View>

        {renderPopup()}
      </SafeAreaView>
    );
  }

  /*
   * =========================================================
   * DETAIL / CONFIRMATION VIEW
   * =========================================================
   */

  if (selectedVehicle) {
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
            styles.detailContainer
          }
        >
          {/* HEADER */}

          <View
            style={styles.header}
          >
            <Pressable
              onPress={handleBack}
              style={
                styles.backButton
              }
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons
                name="arrow-back"
                size={23}
                color={colors.text}
              />
            </Pressable>

            <View
              style={
                styles.headerText
              }
            >
              <Text
                style={
                  styles.headerTitle
                }
              >
                Gate Out
              </Text>

              <Text
                style={
                  styles.headerSubtitle
                }
              >
                Complete vehicle exit
              </Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={[
              styles.detailContent,
              {
                paddingBottom:
                  spacing.xl +
                  insets.bottom,
              },
            ]}
          >
            {/* VEHICLE CARD */}

            <View
              style={styles.card}
            >
              <View
                style={
                  styles.cardHeader
                }
              >
                <View
                  style={
                    styles.cardIcon
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
                    styles.cardHeaderText
                  }
                >
                  <Text
                    style={
                      styles.cardTitle
                    }
                  >
                    Vehicle
                  </Text>

                  <Text
                    style={
                      styles.vehicleNumber
                    }
                  >
                    {
                      selectedVehicle
                        .vehicle
                        .vehicle_no
                    }
                  </Text>
                </View>
              </View>

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
                  Gate In
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {formatDateTime(
                    selectedVehicle
                      .gateEntry
                      ?.gate_in_at ||
                      null
                  )}
                </Text>
              </View>

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
                  Ready for Gate Out
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {formatDateTime(
                    selectedVehicle
                      .visit
                      .stage_started_at
                  )}
                </Text>
              </View>

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
                  Waiting
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    styles.waitingValue,
                  ]}
                >
                  {formatWaitingTime(
                    selectedVehicle
                      .visit
                      .stage_started_at
                  )}
                </Text>
              </View>

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
                  Pending Gate Out
                </Text>
              </View>
            </View>

            {/* WATCHMAN INFORMATION */}

            <View
              style={styles.card}
            >
              <View
                style={
                  styles.cardHeader
                }
              >
                <View
                  style={
                    styles.cardIcon
                  }
                >
                  <Ionicons
                    name="person-outline"
                    size={22}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.cardHeaderText
                  }
                >
                  <Text
                    style={
                      styles.cardTitle
                    }
                  >
                    Gate Out Recorded By
                  </Text>

                  <Text
                    style={
                      styles.cardSubtitle
                    }
                  >
                    Current logged-in user
                  </Text>
                </View>
              </View>

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
                  Name
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {profile?.name?.trim() ||
                    "Watchman"}
                </Text>
              </View>

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
                  Role
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {profile?.role ===
                  "ceo_admin"
                    ? "CEO Admin"
                    : "Watchman"}
                </Text>
              </View>

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
                  Gate Out Time
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  Recorded automatically
                </Text>
              </View>
            </View>

            {/* REMARKS */}

            <View
              style={styles.card}
            >
              <View
                style={
                  styles.cardHeader
                }
              >
                <View
                  style={
                    styles.cardIcon
                  }
                >
                  <Ionicons
                    name="chatbox-outline"
                    size={21}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.cardHeaderText
                  }
                >
                  <Text
                    style={
                      styles.cardTitle
                    }
                  >
                    Remarks
                  </Text>

                  <Text
                    style={
                      styles.cardSubtitle
                    }
                  >
                    Optional
                  </Text>
                </View>
              </View>

              <TextInput
                value={remarks}
                onChangeText={
                  setRemarks
                }
                placeholder="Enter remarks if required"
                placeholderTextColor={
                  colors.textSecondary
                }
                multiline
                textAlignVertical="top"
                style={
                  styles.remarksInput
                }
              />
            </View>

            {/* INFORMATION */}

            <View
              style={
                styles.warningCard
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color={colors.primary}
              />

              <Text
                style={
                  styles.warningText
                }
              >
                Gate Out is the final
                gate operation for
                this visit. Once
                completed, the vehicle
                will no longer appear
                in the Pending Gate Out
                list.
              </Text>
            </View>

            {/* COMPLETE BUTTON */}

            <Pressable
              onPress={
                confirmGateOut
              }
              disabled={processing}
              style={({
                pressed,
              }) => [
                styles.completeButton,
                pressed &&
                  !processing &&
                  styles.buttonPressed,
                processing &&
                  styles.buttonDisabled,
              ]}
            >
              {processing ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Ionicons
                  name="log-out-outline"
                  size={21}
                  color="#FFFFFF"
                />
              )}

              <Text
                style={
                  styles.completeButtonText
                }
              >
                {processing
                  ? "Completing Gate Out..."
                  : "Complete Gate Out"}
              </Text>
            </Pressable>

            {/* CANCEL */}

            <Pressable
              onPress={
                handleBack
              }
              disabled={processing}
              style={
                styles.cancelButton
              }
            >
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                Cancel
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {renderPopup()}
      </SafeAreaView>
    );
  }

  /*
   * =========================================================
   * MAIN GATE OUT LIST
   * =========================================================
   */

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        "top",
        "bottom",
      ]}
    >
      <View
        style={styles.screen}
      >
        {/* HEADER */}

        <View
          style={styles.header}
        >
          {/*
           * Main Gate Out is a permanent Watchman
           * bottom-tab screen, so there is intentionally
           * no back button here.
           */}

          <View
            style={styles.headerText}
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              Gate Out
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Vehicles ready to leave
            </Text>
          </View>

          <Pressable
            onPress={() =>
              loadAll(true)
            }
            style={
              styles.refreshButton
            }
            accessibilityRole="button"
            accessibilityLabel="Refresh Gate Out vehicles"
          >
            <Ionicons
              name="refresh-outline"
              size={22}
              color={colors.primary}
            />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
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
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                spacing.xl +
                insets.bottom,
            },
          ]}
        >
          {/* SUMMARY */}

          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={
                styles.summaryIcon
              }
            >
              <Ionicons
                name="log-out-outline"
                size={25}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.summaryText
              }
            >
              <Text
                style={
                  styles.summaryCount
                }
              >
                {vehicles.length}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                Pending Gate Out
              </Text>
            </View>
          </View>

          {/* SEARCH */}

          {vehicles.length > 0 && (
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
                value={
                  searchText
                }
                onChangeText={
                  setSearchText
                }
                placeholder="Search vehicle number"
                placeholderTextColor={
                  colors.textSecondary
                }
                autoCapitalize="characters"
                style={
                  styles.searchInput
                }
              />

              {searchText.length >
                0 && (
                <Pressable
                  onPress={() =>
                    setSearchText(
                      ""
                    )
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
          )}

          {/* SECTION HEADER */}

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
                Ready for Gate Out
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Select a vehicle to
                complete its exit
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
                {
                  filteredVehicles.length
                }
              </Text>
            </View>
          </View>

          {/* EMPTY */}

          {filteredVehicles.length ===
          0 ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={42}
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
                Gate Out
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Vehicles will appear
                here after they
                complete the workshop
                workflow and are
                marked Ready for
                Delivery.
              </Text>

              <Pressable
                onPress={() =>
                  loadAll(true)
                }
                style={
                  styles.emptyRefreshButton
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={
                    styles.emptyRefreshText
                  }
                >
                  Refresh
                </Text>
              </Pressable>
            </View>
          ) : (
            filteredVehicles.map(
              (item) => (
                <View
                  key={
                    item.visit.id
                  }
                  style={
                    styles.vehicleCard
                  }
                >
                  {/* VEHICLE HEADER */}

                  <View
                    style={
                      styles.vehicleCardHeader
                    }
                  >
                    <View
                      style={
                        styles.vehicleIcon
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
                          styles.vehicleCardNumber
                        }
                      >
                        {
                          item.vehicle
                            .vehicle_no
                        }
                      </Text>

                      <Text
                        style={
                          styles.vehicleStage
                        }
                      >
                        Pending Gate Out
                      </Text>
                    </View>

                    <View
                      style={
                        styles.readyBadge
                      }
                    >
                      <View
                        style={
                          styles.readyDot
                        }
                      />

                      <Text
                        style={
                          styles.readyBadgeText
                        }
                      >
                        READY
                      </Text>
                    </View>
                  </View>

                  {/* VEHICLE INFORMATION */}

                  <View
                    style={
                      styles.vehicleInfoRow
                    }
                  >
                    <View
                      style={
                        styles.vehicleInfoItem
                      }
                    >
                      <Ionicons
                        name="log-in-outline"
                        size={17}
                        color={
                          colors.textSecondary
                        }
                      />

                      <View>
                        <Text
                          style={
                            styles.vehicleInfoLabel
                          }
                        >
                          Gate In
                        </Text>

                        <Text
                          style={
                            styles.vehicleInfoValue
                          }
                        >
                          {formatDateTime(
                            item
                              .gateEntry
                              ?.gate_in_at ||
                              null
                          )}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.vehicleInfoItem
                      }
                    >
                      <Ionicons
                        name="time-outline"
                        size={17}
                        color={
                          colors.textSecondary
                        }
                      />

                      <View>
                        <Text
                          style={
                            styles.vehicleInfoLabel
                          }
                        >
                          Waiting
                        </Text>

                        <Text
                          style={[
                            styles.vehicleInfoValue,
                            styles.waitingValue,
                          ]}
                        >
                          {formatWaitingTime(
                            item
                              .visit
                              .stage_started_at
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* PROCESS BUTTON */}

                  <Pressable
                    onPress={() => {
                      setSelectedVehicle(
                        item
                      );
                      setRemarks("");
                    }}
                    style={({
                      pressed,
                    }) => [
                      styles.gateOutButton,
                      pressed &&
                        styles.buttonPressed,
                    ]}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={19}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.gateOutButtonText
                      }
                    >
                      Process Gate Out
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={19}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>
              )
            )
          )}
        </ScrollView>
      </View>

      {renderPopup()}
    </SafeAreaView>
  );
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    screen: {
      flex: 1,
    },

    detailContainer: {
      flex: 1,
    },

    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      padding: spacing.xl,
    },

    loadingText: {
      ...typography.body,
      color:
        colors.textSecondary,
      marginTop: spacing.md,
    },

    /*
     * HEADER
     */

    header: {
      flexDirection:
        "row",
      alignItems: "center",
      paddingHorizontal:
        spacing.lg,
      paddingVertical:
        spacing.md,
      backgroundColor:
        colors.surface,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.divider,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius:
        radius.md,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.background,
      marginRight:
        spacing.md,
    },

    refreshButton: {
      width: 42,
      height: 42,
      borderRadius:
        radius.md,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primaryLight,
      marginLeft:
        spacing.md,
    },

    headerText: {
      flex: 1,
    },

    headerTitle: {
      ...typography.heading,
      color: colors.text,
    },

    headerSubtitle: {
      ...typography.body,
      color:
        colors.textSecondary,
      marginTop: 2,
    },

    /*
     * CONTENT
     */

    content: {
      padding: spacing.lg,
    },

    detailContent: {
      padding: spacing.lg,
    },

    /*
     * SUMMARY
     */

    summaryCard: {
      flexDirection:
        "row",
      alignItems: "center",
      backgroundColor:
        colors.primaryLight,
      borderRadius:
        radius.lg,
      padding: spacing.lg,
      marginBottom:
        spacing.lg,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    summaryIcon: {
      width: 52,
      height: 52,
      borderRadius:
        radius.md,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.surface,
      marginRight:
        spacing.md,
    },

    summaryText: {
      flex: 1,
    },

    summaryCount: {
      ...typography.heading,
      color: colors.primary,
    },

    summaryLabel: {
      ...typography.body,
      color:
        colors.textSecondary,
      marginTop: 2,
    },

    /*
     * SEARCH
     */

    searchContainer: {
      flexDirection:
        "row",
      alignItems: "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius:
        radius.md,
      minHeight: 50,
      paddingHorizontal:
        spacing.md,
      marginBottom:
        spacing.lg,
    },

    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.text,
      paddingHorizontal:
        spacing.sm,
      paddingVertical:
        spacing.sm,
    },

    /*
     * SECTION
     */

    sectionHeader: {
      flexDirection:
        "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginBottom:
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
      marginTop: 3,
    },

    countBadge: {
      minWidth: 34,
      height: 34,
      paddingHorizontal:
        spacing.sm,
      borderRadius: 17,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primaryLight,
    },

    countBadgeText: {
      ...typography.bodyMedium,
      color: colors.primary,
    },

    /*
     * VEHICLE CARD
     */

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

    vehicleCardHeader: {
      flexDirection:
        "row",
      alignItems: "center",
      marginBottom:
        spacing.lg,
    },

    vehicleIcon: {
      width: 46,
      height: 46,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.primaryLight,
      alignItems: "center",
      justifyContent:
        "center",
      marginRight:
        spacing.md,
    },

    vehicleHeaderText: {
      flex: 1,
    },

    vehicleCardNumber: {
      ...typography.subheading,
      color: colors.text,
    },

    vehicleStage: {
      ...typography.caption,
      color:
        colors.textSecondary,
      marginTop: 3,
    },

    readyBadge: {
      flexDirection:
        "row",
      alignItems: "center",
      paddingHorizontal:
        spacing.sm,
      paddingVertical: 6,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.successLight,
    },

    readyDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        colors.success,
      marginRight: 5,
    },

    readyBadgeText: {
      ...typography.caption,
      color: colors.success,
    },

    /*
     * VEHICLE INFO
     */

    vehicleInfoRow: {
      flexDirection:
        "row",
      borderTopWidth: 1,
      borderTopColor:
        colors.divider,
      paddingTop:
        spacing.md,
      marginBottom:
        spacing.lg,
      gap: spacing.lg,
    },

    vehicleInfoItem: {
      flex: 1,
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      gap: spacing.sm,
    },

    vehicleInfoLabel: {
      ...typography.caption,
      color:
        colors.textSecondary,
    },

    vehicleInfoValue: {
      ...typography.bodyMedium,
      color: colors.text,
      marginTop: 2,
    },

    waitingValue: {
      color: colors.primary,
    },

    /*
     * BUTTON
     */

    gateOutButton: {
      minHeight: 48,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.primary,
      flexDirection:
        "row",
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal:
        spacing.md,
      gap: spacing.sm,
    },

    gateOutButtonText: {
      ...typography.bodyMedium,
      color: "#FFFFFF",
      flex: 1,
    },

    /*
     * EMPTY
     */

    emptyCard: {
      backgroundColor:
        colors.surface,
      borderRadius:
        radius.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems: "center",
      marginTop:
        spacing.md,
    },

    emptyIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primaryLight,
      marginBottom:
        spacing.lg,
    },

    emptyTitle: {
      ...typography.subheading,
      color: colors.text,
      textAlign: "center",
    },

    emptyText: {
      ...typography.body,
      color:
        colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginTop:
        spacing.sm,
    },

    emptyRefreshButton: {
      flexDirection:
        "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop:
        spacing.lg,
      paddingHorizontal:
        spacing.md,
      paddingVertical:
        spacing.sm,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.primaryLight,
    },

    emptyRefreshText: {
      ...typography.bodyMedium,
      color: colors.primary,
    },

    /*
     * DETAIL CARD
     */

    card: {
      backgroundColor:
        colors.surface,
      borderRadius:
        radius.lg,
      padding: spacing.lg,
      marginBottom:
        spacing.lg,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    cardHeader: {
      flexDirection:
        "row",
      alignItems: "center",
      marginBottom:
        spacing.md,
    },

    cardIcon: {
      width: 42,
      height: 42,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.primaryLight,
      alignItems: "center",
      justifyContent:
        "center",
      marginRight:
        spacing.md,
    },

    cardHeaderText: {
      flex: 1,
    },

    cardTitle: {
      ...typography.subheading,
      color: colors.text,
    },

    cardSubtitle: {
      ...typography.caption,
      color:
        colors.textSecondary,
      marginTop: 2,
    },

    vehicleNumber: {
      ...typography.heading,
      color: colors.primary,
      marginTop: 2,
    },

    infoRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
      paddingVertical:
        spacing.md,
      borderTopWidth: 1,
      borderTopColor:
        colors.divider,
      gap: spacing.md,
    },

    infoLabel: {
      ...typography.body,
      color:
        colors.textSecondary,
      flex: 1,
    },

    infoValue: {
      ...typography.bodyMedium,
      color: colors.text,
      flex: 1,
      textAlign: "right",
    },

    /*
     * REMARKS
     */

    remarksInput: {
      minHeight: 110,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.background,
      paddingHorizontal:
        spacing.md,
      paddingVertical:
        spacing.md,
      ...typography.body,
      color: colors.text,
    },

    /*
     * INFORMATION
     */

    warningCard: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      backgroundColor:
        colors.primaryLight,
      borderRadius:
        radius.md,
      padding: spacing.md,
      marginBottom:
        spacing.lg,
      gap: spacing.sm,
    },

    warningText: {
      ...typography.body,
      color: colors.text,
      flex: 1,
      lineHeight: 21,
    },

    /*
     * COMPLETE BUTTON
     */

    completeButton: {
      minHeight: 52,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.primary,
      flexDirection:
        "row",
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal:
        spacing.lg,
      gap: spacing.sm,
    },

    completeButtonText: {
      ...typography.bodyMedium,
      color: "#FFFFFF",
    },

    /*
     * CANCEL
     */

    cancelButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent:
        "center",
      marginTop:
        spacing.sm,
    },

    cancelButtonText: {
      ...typography.bodyMedium,
      color:
        colors.textSecondary,
    },

    /*
     * =========================================================
     * POPUP
     * =========================================================
     */

    popupOverlay: {
      flex: 1,
      justifyContent:
        "center",
      alignItems: "center",
      paddingHorizontal:
        spacing.lg,
    },

    popupBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        "rgba(0, 0, 0, 0.48)",
    },

    popupCard: {
      width: "100%",
      maxWidth: 430,
      backgroundColor:
        colors.surface,
      borderRadius:
        radius.xl,
      padding: spacing.xl,
      alignItems: "center",
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    popupIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent:
        "center",
      marginBottom:
        spacing.lg,
    },

    popupTitle: {
      ...typography.heading,
      color: colors.text,
      textAlign: "center",
    },

    popupMessage: {
      ...typography.body,
      color:
        colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginTop:
        spacing.sm,
    },

    popupActions: {
      width: "100%",
      flexDirection:
        "row",
      gap: spacing.sm,
      marginTop:
        spacing.xl,
    },

    popupCancelButton: {
      flex: 1,
      minHeight: 48,
      borderRadius:
        radius.md,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal:
        spacing.md,
      backgroundColor:
        colors.background,
    },

    popupCancelText: {
      ...typography.bodyMedium,
      color:
        colors.textSecondary,
    },

    popupConfirmButton: {
      flex: 1,
      minHeight: 48,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.primary,
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal:
        spacing.md,
    },

    popupConfirmText: {
      ...typography.bodyMedium,
      color: "#FFFFFF",
    },

    popupOkButton: {
      width: "100%",
      minHeight: 48,
      borderRadius:
        radius.md,
      backgroundColor:
        colors.primary,
      alignItems: "center",
      justifyContent:
        "center",
      marginTop:
        spacing.xl,
    },

    popupOkText: {
      ...typography.bodyMedium,
      color: "#FFFFFF",
    },

    /*
     * PRESS / DISABLED
     */

    buttonPressed: {
      opacity: 0.82,
    },

    buttonDisabled: {
      opacity: 0.6,
    },
  });