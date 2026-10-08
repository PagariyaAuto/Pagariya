import BackButton from "../../../components/navigation/BackButton";
import { returnToRoute, useHardwareBack, singleParam } from "../../../lib/back-navigation";

import { useCallback, useEffect, useMemo, useState } from "react";

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

import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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

type Vehicle = {
  id: string;
  vehicle_no: string;
};

type Advisor = {
  id: string;
  name: string | null;
};

type FilterType =
  | "TODAY"
  | "YESTERDAY"
  | "WEEK"
  | "MONTH";

type PopupType =
  | "success"
  | "error"
  | "info";

export default function WatchmanAssignmentHistoryScreen() {
  const navigationParams = useLocalSearchParams<{ returnTo?: string | string[]; returnVisitId?: string | string[]; floor?: string | string[]; filter?: string | string[] }>();
  const handleNavigationBack = () => {
    returnToRoute(singleParam(navigationParams.returnTo) === "watchman-vehicles" ? "/(tabs)/watchman/vehicles" : "/(tabs)/watchman");
  };
  useHardwareBack(handleNavigationBack);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [advisors, setAdvisors] =
    useState<Advisor[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const [selectedFilter, setSelectedFilter] =
    useState<FilterType>("TODAY");

  const [popupVisible, setPopupVisible] =
    useState(false);

  const [popupType, setPopupType] =
    useState<PopupType>("info");

  const [popupTitle, setPopupTitle] =
    useState("");

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

  const loadProfile = useCallback(
    async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return null;
      }

      const { data, error } =
        await supabase
          .from("profiles")
          .select(
            "id, name, role, is_active"
          )
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
    },
    []
  );

  /*
   * ============================================================
   * LOAD ASSIGNMENTS
   *
   * IMPORTANT:
   * We query vehicle_assignments directly.
   * Therefore old assignments remain visible even after the
   * vehicle has moved beyond PENDING_ADVISOR.
   * ============================================================
   */

  const loadAssignments =
    useCallback(
      async (
        currentProfileId: string
      ) => {
        const { data, error } =
          await supabase
            .from("vehicle_assignments")
            .select(
              "id, visit_id, vehicle_id, assigned_to, assigned_by, assignment_role, assigned_at, unassigned_at, remarks"
            )
            .eq(
              "assigned_by",
              currentProfileId
            )
            .eq(
              "assignment_role",
              "ADVISOR"
            )
            .order("assigned_at", {
              ascending: false,
            })
            .limit(1000);

        if (error) {
          throw error;
        }

        const loadedAssignments =
          (data || []) as Assignment[];

        setAssignments(
          loadedAssignments
        );

        /*
         * Get vehicle and advisor IDs from
         * assignment history.
         */

        const vehicleIds = [
          ...new Set(
            loadedAssignments.map(
              (item) => item.vehicle_id
            )
          ),
        ];

        const advisorIds = [
          ...new Set(
            loadedAssignments.map(
              (item) => item.assigned_to
            )
          ),
        ];

        /*
         * Load both in parallel.
         */

        const [
          vehicleResult,
          advisorResult,
        ] = await Promise.all([
          vehicleIds.length > 0
            ? supabase
                .from("vehicles")
                .select(
                  "id, vehicle_no"
                )
                .in(
                  "id",
                  vehicleIds
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          advisorIds.length > 0
            ? supabase
                .from("profiles")
                .select(
                  "id, name"
                )
                .in(
                  "id",
                  advisorIds
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

        if (vehicleResult.error) {
          throw vehicleResult.error;
        }

        if (advisorResult.error) {
          throw advisorResult.error;
        }

        setVehicles(
          (vehicleResult.data ||
            []) as Vehicle[]
        );

        setAdvisors(
          (advisorResult.data ||
            []) as Advisor[]
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
          profile ||
          (await loadProfile());

        if (!currentProfile) {
          return;
        }

        await loadAssignments(
          currentProfile.id
        );
      } catch (error: any) {
        console.log(
          "Assignment history error:",
          error
        );

        showPopup(
          "error",
          "Unable to Load",
          error?.message ||
            "Unable to load assignment history."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      profile,
      loadProfile,
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
    }, [profile?.id])
  );

  /*
   * ============================================================
   * MAP HELPERS
   * ============================================================
   */

  const vehicleMap = useMemo(() => {
    const map = new Map<
      string,
      string
    >();

    vehicles.forEach((vehicle) => {
      map.set(
        vehicle.id,
        vehicle.vehicle_no
      );
    });

    return map;
  }, [vehicles]);

  const advisorMap = useMemo(() => {
    const map = new Map<
      string,
      string
    >();

    advisors.forEach((advisor) => {
      map.set(
        advisor.id,
        advisor.name?.trim() ||
          "Advisor"
      );
    });

    return map;
  }, [advisors]);

  /*
   * ============================================================
   * DATE HELPERS
   * ============================================================
   *
   * Workshop devices are expected to operate in India/IST.
   * These helpers use the device's local date/time.
   * ============================================================
   */

  const startOfDay = (
    date: Date
  ) => {
    const result = new Date(date);

    result.setHours(
      0,
      0,
      0,
      0
    );

    return result;
  };

  const endOfDay = (
    date: Date
  ) => {
    const result = new Date(date);

    result.setHours(
      23,
      59,
      59,
      999
    );

    return result;
  };

  const startOfWeek = (
    date: Date
  ) => {
    const result = startOfDay(
      date
    );

    /*
     * Monday = first day of workshop week.
     *
     * Sunday = 0
     * Monday = 1
     */

    const day =
      result.getDay();

    const difference =
      day === 0
        ? 6
        : day - 1;

    result.setDate(
      result.getDate() -
        difference
    );

    return result;
  };

  const startOfMonth = (
    date: Date
  ) => {
    const result =
      startOfDay(date);

    result.setDate(1);

    return result;
  };

  /*
   * ============================================================
   * FILTER DATE
   * ============================================================
   */

  const isInSelectedDateRange =
    useCallback(
      (
        assignedAt: string
      ) => {
        const assignmentDate =
          new Date(assignedAt);

        const now = new Date();

        if (
          selectedFilter ===
          "TODAY"
        ) {
          return (
            assignmentDate >=
              startOfDay(now) &&
            assignmentDate <=
              endOfDay(now)
          );
        }

        if (
          selectedFilter ===
          "YESTERDAY"
        ) {
          const yesterday =
            new Date(now);

          yesterday.setDate(
            yesterday.getDate() - 1
          );

          return (
            assignmentDate >=
              startOfDay(
                yesterday
              ) &&
            assignmentDate <=
              endOfDay(
                yesterday
              )
          );
        }

        if (
          selectedFilter ===
          "WEEK"
        ) {
          return (
            assignmentDate >=
            startOfWeek(now)
          );
        }

        if (
          selectedFilter ===
          "MONTH"
        ) {
          return (
            assignmentDate >=
            startOfMonth(now)
          );
        }

        return true;
      },
      [selectedFilter]
    );

  /*
   * ============================================================
   * SEARCH + FILTER
   * ============================================================
   */

  const normalizedSearch =
    searchText
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        ""
      );

  const filteredAssignments =
    useMemo(() => {
      return assignments.filter(
        (assignment) => {
          /*
           * Date filter
           */

          if (
            !isInSelectedDateRange(
              assignment.assigned_at
            )
          ) {
            return false;
          }

          /*
           * Vehicle / advisor search
           */

          if (
            normalizedSearch
          ) {
            const vehicleNumber =
              (
                vehicleMap.get(
                  assignment.vehicle_id
                ) || ""
              )
                .toUpperCase()
                .replace(
                  /[\s-]+/g,
                  ""
                );

            const advisorName =
              (
                advisorMap.get(
                  assignment.assigned_to
                ) || ""
              ).toUpperCase();

            if (
              !vehicleNumber.includes(
                normalizedSearch
              ) &&
              !advisorName.includes(
                normalizedSearch
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      assignments,
      normalizedSearch,
      vehicleMap,
      advisorMap,
      isInSelectedDateRange,
    ]);

  /*
   * ============================================================
   * TODAY COUNT
   * ============================================================
   */

  const todayCount = useMemo(() => {
    const now = new Date();

    return assignments.filter(
      (assignment) => {
        const date =
          new Date(
            assignment.assigned_at
          );

        return (
          date >=
            startOfDay(now) &&
          date <=
            endOfDay(now)
        );
      }
    ).length;
  }, [assignments]);

  /*
   * ============================================================
   * FORMAT DATE / TIME
   * ============================================================
   */

  const formatDate = (
    value: string
  ) => {
    return new Date(
      value
    ).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatTime = (
    value: string
  ) => {
    return new Date(
      value
    ).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    );
  };

  const formatDateTime = (
    value: string
  ) => {
    return new Date(
      value
    ).toLocaleString(
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
   * ============================================================
   * FILTER LABEL
   * ============================================================
   */

  const filterLabel =
    selectedFilter ===
    "TODAY"
      ? "Today"
      : selectedFilter ===
        "YESTERDAY"
      ? "Yesterday"
      : selectedFilter ===
        "WEEK"
      ? "This Week"
      : "This Month";

  /*
   * ============================================================
   * LOADING SCREEN
   * ============================================================
   */

  if (loading && !profile) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color={
              colors.primary
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading assignment history...
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
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
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
        <View
          style={styles.header}
        >
          <View
            style={
              styles.headerTextContainer
            }
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              Assignment History
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Advisor assignments made by you
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
              name="time-outline"
              size={23}
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
                styles.summaryValue
              }
            >
              {filteredAssignments.length}
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              {filterLabel} assignments
            </Text>
          </View>

          <View
            style={
              styles.todayBadge
            }
          >
            <Text
              style={
                styles.todayBadgeValue
              }
            >
              {todayCount}
            </Text>

            <Text
              style={
                styles.todayBadgeLabel
              }
            >
              Today
            </Text>
          </View>
        </View>

        {/* ======================================================
            DATE FILTERS
        ====================================================== */}

        <Text
          style={
            styles.sectionLabel
          }
        >
          Date Range
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filterRow
          }
        >
          {(
            [
              [
                "TODAY",
                "Today",
              ],
              [
                "YESTERDAY",
                "Yesterday",
              ],
              [
                "WEEK",
                "This Week",
              ],
              [
                "MONTH",
                "This Month",
              ],
            ] as [
              FilterType,
              string
            ][]
          ).map(
            ([value, label]) => {
              const selected =
                selectedFilter ===
                value;

              return (
                <Pressable
                  key={value}
                  onPress={() =>
                    setSelectedFilter(
                      value
                    )
                  }
                  style={[
                    styles.filterButton,
                    selected &&
                      styles.filterButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selected &&
                        styles.filterButtonTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {/* ======================================================
            SEARCH
        ====================================================== */}

        <Text
          style={
            styles.sectionLabel
          }
        >
          Search
        </Text>

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
            placeholder="Vehicle number or Advisor name"
            placeholderTextColor={
              colors.textSecondary
            }
            autoCapitalize="characters"
            autoCorrect={false}
            style={
              styles.searchInput
            }
          />

          {searchText.length >
            0 && (
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
            RESULTS HEADER
        ====================================================== */}

        <View
          style={
            styles.resultsHeader
          }
        >
          <View>
            <Text
              style={
                styles.resultsTitle
              }
            >
              {filterLabel}
            </Text>

            <Text
              style={
                styles.resultsSubtitle
              }
            >
              Advisor assignments made by you
            </Text>
          </View>

          <View
            style={
              styles.resultsCount
            }
          >
            <Text
              style={
                styles.resultsCountText
              }
            >
              {
                filteredAssignments.length
              }
            </Text>
          </View>
        </View>

        {/* ======================================================
            EMPTY STATE
        ====================================================== */}

        {filteredAssignments.length ===
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
                name="document-text-outline"
                size={30}
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
              No assignments found
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              {searchText.trim()
                ? "No assignment matches your search."
                : `There are no Advisor assignments for ${filterLabel.toLowerCase()}.`}
            </Text>
          </View>
        ) : (
          /*
           * ======================================================
           * ASSIGNMENT CARDS
           * ======================================================
           */

          filteredAssignments.map(
            (assignment) => {
              const vehicleNumber =
                vehicleMap.get(
                  assignment.vehicle_id
                ) ||
                "Vehicle";

              const advisorName =
                advisorMap.get(
                  assignment.assigned_to
                ) ||
                "Advisor";

              const isActive =
                !assignment.unassigned_at;

              return (
                <View
                  key={
                    assignment.id
                  }
                  style={
                    styles.assignmentCard
                  }
                >
                  {/* Card Header */}

                  <View
                    style={
                      styles.assignmentHeader
                    }
                  >
                    <View
                      style={
                        styles.vehicleIcon
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
                        styles.assignmentHeaderText
                      }
                    >
                      <Text
                        style={
                          styles.vehicleNumber
                        }
                      >
                        {vehicleNumber}
                      </Text>

                      <Text
                        style={
                          styles.assignmentDate
                        }
                      >
                        {formatDate(
                          assignment.assigned_at
                        )}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isActive
                          ? styles.statusBadgeActive
                          : styles.statusBadgeClosed,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          isActive
                            ? styles.statusDotActive
                            : styles.statusDotClosed,
                        ]}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          isActive
                            ? styles.statusTextActive
                            : styles.statusTextClosed,
                        ]}
                      >
                        {isActive
                          ? "Active"
                          : "Closed"}
                      </Text>
                    </View>
                  </View>

                  {/* Advisor */}

                  <View
                    style={
                      styles.detailRow
                    }
                  >
                    <View
                      style={
                        styles.detailIcon
                      }
                    >
                      <Ionicons
                        name="person-outline"
                        size={18}
                        color={
                          colors.textSecondary
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.detailContent
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        Assigned Advisor
                      </Text>

                      <Text
                        style={
                          styles.detailValue
                        }
                      >
                        {advisorName}
                      </Text>
                    </View>
                  </View>

                  {/* Assignment Time */}

                  <View
                    style={
                      styles.detailRow
                    }
                  >
                    <View
                      style={
                        styles.detailIcon
                      }
                    >
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color={
                          colors.textSecondary
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.detailContent
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        Assigned At
                      </Text>

                      <Text
                        style={
                          styles.detailValue
                        }
                      >
                        {formatTime(
                          assignment.assigned_at
                        )}
                      </Text>

                      <Text
                        style={
                          styles.detailSubValue
                        }
                      >
                        {formatDateTime(
                          assignment.assigned_at
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Remarks */}

                  {assignment.remarks?.trim() ? (
                    <View
                      style={
                        styles.remarksBox
                      }
                    >
                      <View
                        style={
                          styles.remarksHeader
                        }
                      >
                        <Ionicons
                          name="chatbox-ellipses-outline"
                          size={17}
                          color={
                            colors.primary
                          }
                        />

                        <Text
                          style={
                            styles.remarksLabel
                          }
                        >
                          Remarks
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.remarksText
                        }
                      >
                        {
                          assignment.remarks
                        }
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={
                        styles.noRemarksRow
                      }
                    >
                      <Ionicons
                        name="remove-outline"
                        size={16}
                        color={
                          colors.textSecondary
                        }
                      />

                      <Text
                        style={
                          styles.noRemarksText
                        }
                      >
                        No remarks
                      </Text>
                    </View>
                  )}
                </View>
              );
            }
          )
        )}
      </ScrollView>

      {/* ========================================================
          POPUP
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
              style={
                styles.popupIcon
              }
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
                  styles.pressed,
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
    backgroundColor:
      colors.background,
  },

  container: {
    padding: spacing.lg,
    paddingBottom:
      spacing.xl * 2,
  },

  /*
   * LOADING
   */

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom:
      spacing.lg,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight:
      spacing.md,
  },

  headerTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  headerSubtitle: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  /*
   * SUMMARY
   */

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor:
      colors.border,
    padding: spacing.lg,
    marginBottom:
      spacing.lg,
  },

  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  summaryText: {
    flex: 1,
  },

  summaryValue: {
    ...typography.subheading,
    color: colors.text,
    fontSize: 25,
  },

  summaryLabel: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  todayBadge: {
    minWidth: 58,
    alignItems: "center",
    backgroundColor:
      colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical:
      spacing.sm,
    paddingHorizontal:
      spacing.sm,
  },

  todayBadgeValue: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontSize: 18,
  },

  todayBadgeLabel: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 1,
  },

  /*
   * SECTION LABEL
   */

  sectionLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom:
      spacing.sm,
  },

  /*
   * FILTERS
   */

  filterRow: {
    gap: spacing.sm,
    paddingBottom:
      spacing.lg,
  },

  filterButton: {
    minHeight: 40,
    paddingHorizontal:
      spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor:
      colors.border,
    backgroundColor:
      colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  filterButtonSelected: {
    backgroundColor:
      colors.primary,
    borderColor:
      colors.primary,
  },

  filterButtonText: {
    ...typography.bodyMedium,
    color:
      colors.textSecondary,
  },

  filterButtonTextSelected: {
    color: "#FFFFFF",
  },

  /*
   * SEARCH
   */

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: radius.md,
    paddingHorizontal:
      spacing.md,
    marginBottom:
      spacing.lg,
  },

  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal:
      spacing.sm,
  },

  /*
   * RESULTS HEADER
   */

  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom:
      spacing.md,
  },

  resultsTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  resultsSubtitle: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  resultsCount: {
    minWidth: 34,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 15,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  resultsCountText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },

  /*
   * EMPTY
   */

  emptyCard: {
    backgroundColor:
      colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor:
      colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom:
      spacing.md,
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
    lineHeight: 21,
    marginTop:
      spacing.sm,
  },

  /*
   * ASSIGNMENT CARD
   */

  assignmentCard: {
    backgroundColor:
      colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor:
      colors.border,
    padding: spacing.lg,
    marginBottom:
      spacing.md,
  },

  assignmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom:
      spacing.md,
    borderBottomWidth: 1,
    borderBottomColor:
      colors.divider,
    marginBottom:
      spacing.sm,
  },

  vehicleIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  assignmentHeaderText: {
    flex: 1,
  },

  vehicleNumber: {
    ...typography.subheading,
    color: colors.text,
    letterSpacing: 0.3,
  },

  assignmentDate: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
  },

  statusBadgeActive: {
    backgroundColor:
      colors.primaryLight,
  },

  statusBadgeClosed: {
    backgroundColor:
      colors.background,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },

  statusDotActive: {
    backgroundColor:
      colors.primary,
  },

  statusDotClosed: {
    backgroundColor:
      colors.textSecondary,
  },

  statusText: {
    ...typography.caption,
  },

  statusTextActive: {
    color: colors.primary,
  },

  statusTextClosed: {
    color:
      colors.textSecondary,
  },

  /*
   * DETAIL ROW
   */

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical:
      spacing.sm,
  },

  detailIcon: {
    width: 30,
    alignItems: "center",
    paddingTop: 2,
    marginRight: spacing.sm,
  },

  detailContent: {
    flex: 1,
  },

  detailLabel: {
    ...typography.caption,
    color:
      colors.textSecondary,
  },

  detailValue: {
    ...typography.bodyMedium,
    color: colors.text,
    marginTop: 2,
  },

  detailSubValue: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  /*
   * REMARKS
   */

  remarksBox: {
    backgroundColor:
      colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },

  remarksHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  remarksLabel: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: 6,
  },

  remarksText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 20,
  },

  noRemarksRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor:
      colors.divider,
  },

  noRemarksText: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginLeft: 5,
  },

  /*
   * POPUP
   */

  popupOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  popupCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor:
      colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor:
      colors.border,
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom:
      spacing.md,
  },

  popupTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
  },

  popupMessage: {
    ...typography.body,
    color:
      colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop:
      spacing.sm,
  },

  popupButton: {
    width: "100%",
    minHeight: 46,
    backgroundColor:
      colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop:
      spacing.lg,
  },

  popupButtonText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
  },

  pressed: {
    opacity: 0.72,
  },
});