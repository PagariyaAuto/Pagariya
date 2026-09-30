import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { supabase } from "../../../../lib/supabase";
import { colors, radius, spacing, typography } from "../../../theme";

type VisitRow = {
  id: string;
  vehicle_id: string;
  visit_no: string | null;
  current_stage: string;
  current_status: string;
  current_assigned_to: string | null;
  stage_started_at: string | null;
  created_at: string | null;
};

type VehicleRow = {
  id: string;
  vehicle_no: string;
};

type IntakeRow = {
  visit_id: string;
  vehicle_id: string;
  customer_name: string;
  customer_mobile: string;
  vehicle_type: string;
  arena_nexa: string;
  insurance_type: string;
  mi_type_id: string | null;
  insurance_company_id: string | null;
  job_card_no: string;
};

type InsuranceCompanyRow = {
  id: string;
  name: string;
};

type MiTypeRow = {
  id: string;
  name: string;
};

type ClaimVehicle = {
  visit: VisitRow;
  vehicle: VehicleRow;
  intake: IntakeRow;
  insuranceCompany: InsuranceCompanyRow | null;
  miType: MiTypeRow | null;
};

type Profile = {
  id: string;
  role: string;
  name: string | null;
};

type PopupType = "error" | "info";

type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getWaitingTime(value: string | null) {
  if (!value) return "—";

  const start = new Date(value).getTime();

  if (Number.isNaN(start)) {
    return "—";
  }

  const now = Date.now();
  const diff = Math.max(0, now - start);

  const totalMinutes = Math.floor(diff / (1000 * 60));

  if (totalMinutes < 1) {
    return "Just now";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours < 24) {
    return minutes > 0
      ? `${hours}h ${minutes}m`
      : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours > 0
    ? `${days}d ${remainingHours}h`
    : `${days}d`;
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export default function ClaimIntimationScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicles, setVehicles] = useState<ClaimVehicle[]>([]);
  const [search, setSearch] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);

  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const showPopup = (
    type: PopupType,
    title: string,
    message: string
  ) => {
    setPopup({
      visible: true,
      type,
      title,
      message,
    });
  };

  const closePopup = () => {
    setPopup((current) => ({
      ...current,
      visible: false,
    }));
  };

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error("You are not logged in.");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, name")
      .eq("id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Active user profile not found.");
    }

    const currentProfile = data as Profile;

    if (
      currentProfile.role !== "advisor" &&
      currentProfile.role !== "ceo_admin"
    ) {
      throw new Error(
        "Only Advisor or CEO Admin can access Claim Intimation."
      );
    }

    setProfile(currentProfile);

    return currentProfile;
  }, []);

  const loadVehicles = useCallback(async () => {
    const currentProfile = profile;

    if (!currentProfile) {
      return;
    }

    let visitQuery = supabase
      .from("workshop_visits")
      .select(
        `
          id,
          vehicle_id,
          visit_no,
          current_stage,
          current_status,
          current_assigned_to,
          stage_started_at,
          created_at
        `
      )
      .eq("current_stage", "CLAIM_INTIMATION")
      .in("current_status", ["PENDING", "IN_PROGRESS"])
      .order("stage_started_at", {
        ascending: true,
        nullsFirst: false,
      });

    if (currentProfile.role === "advisor") {
      visitQuery = visitQuery.eq(
        "current_assigned_to",
        currentProfile.id
      );
    }

    const { data: visits, error: visitsError } = await visitQuery;

    if (visitsError) {
      throw visitsError;
    }

    const visitRows = (visits || []) as VisitRow[];

    if (visitRows.length === 0) {
      setVehicles([]);
      return;
    }

    const vehicleIds = Array.from(
      new Set(visitRows.map((item) => item.vehicle_id))
    );

    const visitIds = Array.from(
      new Set(visitRows.map((item) => item.id))
    );

    const [
      vehiclesResult,
      intakeResult,
    ] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, vehicle_no")
        .in("id", vehicleIds),

      supabase
        .from("vehicle_intake")
        .select(
          `
            visit_id,
            vehicle_id,
            customer_name,
            customer_mobile,
            vehicle_type,
            arena_nexa,
            insurance_type,
            mi_type_id,
            insurance_company_id,
            job_card_no
          `
        )
        .in("visit_id", visitIds),
    ]);

    if (vehiclesResult.error) {
      throw vehiclesResult.error;
    }

    if (intakeResult.error) {
      throw intakeResult.error;
    }

    const vehicleRows = (vehiclesResult.data || []) as VehicleRow[];
    const intakeRows = (intakeResult.data || []) as IntakeRow[];

    const insuranceCompanyIds = Array.from(
      new Set(
        intakeRows
          .map((item) => item.insurance_company_id)
          .filter(
            (id): id is string => Boolean(id)
          )
      )
    );

    const miTypeIds = Array.from(
      new Set(
        intakeRows
          .map((item) => item.mi_type_id)
          .filter(
            (id): id is string => Boolean(id)
          )
      )
    );

    let insuranceCompanies: InsuranceCompanyRow[] = [];
    let miTypes: MiTypeRow[] = [];

    if (insuranceCompanyIds.length > 0) {
      const { data, error } = await supabase
        .from("insurance_companies")
        .select("id, name")
        .in("id", insuranceCompanyIds);

      if (error) {
        throw error;
      }

      insuranceCompanies = (data || []) as InsuranceCompanyRow[];
    }

    if (miTypeIds.length > 0) {
      const { data, error } = await supabase
        .from("mi_types")
        .select("id, name")
        .in("id", miTypeIds);

      if (error) {
        throw error;
      }

      miTypes = (data || []) as MiTypeRow[];
    }

    const vehicleMap = new Map<string, VehicleRow>();

    vehicleRows.forEach((vehicle) => {
      vehicleMap.set(vehicle.id, vehicle);
    });

    const intakeMap = new Map<string, IntakeRow>();

    intakeRows.forEach((intake) => {
      intakeMap.set(intake.visit_id, intake);
    });

    const insuranceCompanyMap =
      new Map<string, InsuranceCompanyRow>();

    insuranceCompanies.forEach((company) => {
      insuranceCompanyMap.set(company.id, company);
    });

    const miTypeMap = new Map<string, MiTypeRow>();

    miTypes.forEach((miType) => {
      miTypeMap.set(miType.id, miType);
    });

    const combined: ClaimVehicle[] = [];

    visitRows.forEach((visit) => {
      const vehicle = vehicleMap.get(visit.vehicle_id);
      const intake = intakeMap.get(visit.id);

      if (!vehicle || !intake) {
        return;
      }

      const insuranceCompany = intake.insurance_company_id
        ? insuranceCompanyMap.get(
            intake.insurance_company_id
          ) || null
        : null;

      const miType = intake.mi_type_id
        ? miTypeMap.get(intake.mi_type_id) || null
        : null;

      combined.push({
        visit,
        vehicle,
        intake,
        insuranceCompany,
        miType,
      });
    });

    setVehicles(combined);
  }, [profile]);

  const loadAll = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const currentProfile = await loadProfile();

        if (!currentProfile) {
          return;
        }

        await loadVehicles();
      } catch (error: any) {
        console.error(
          "Claim Intimation load error:",
          error
        );

        showPopup(
          "error",
          "Unable to Load",
          error?.message ||
            "Something went wrong while loading Claim Intimation."
        );
      } finally {
        setLoading(false);
      }
    },
    [loadProfile, loadVehicles]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        try {
          setLoading(true);

          const currentProfile = await loadProfile();

          if (!active || !currentProfile) {
            return;
          }

          let visitQuery = supabase
            .from("workshop_visits")
            .select(
              `
                id,
                vehicle_id,
                visit_no,
                current_stage,
                current_status,
                current_assigned_to,
                stage_started_at,
                created_at
              `
            )
            .eq("current_stage", "CLAIM_INTIMATION")
            .in("current_status", [
              "PENDING",
              "IN_PROGRESS",
            ])
            .order("stage_started_at", {
              ascending: true,
              nullsFirst: false,
            });

          if (currentProfile.role === "advisor") {
            visitQuery = visitQuery.eq(
              "current_assigned_to",
              currentProfile.id
            );
          }

          const { data: visits, error: visitsError } =
            await visitQuery;

          if (visitsError) {
            throw visitsError;
          }

          const visitRows = (visits || []) as VisitRow[];

          if (!active) {
            return;
          }

          if (visitRows.length === 0) {
            setVehicles([]);
            return;
          }

          const vehicleIds = Array.from(
            new Set(
              visitRows.map(
                (item) => item.vehicle_id
              )
            )
          );

          const visitIds = Array.from(
            new Set(
              visitRows.map((item) => item.id)
            )
          );

          const [
            vehiclesResult,
            intakeResult,
          ] = await Promise.all([
            supabase
              .from("vehicles")
              .select("id, vehicle_no")
              .in("id", vehicleIds),

            supabase
              .from("vehicle_intake")
              .select(
                `
                  visit_id,
                  vehicle_id,
                  customer_name,
                  customer_mobile,
                  vehicle_type,
                  arena_nexa,
                  insurance_type,
                  mi_type_id,
                  insurance_company_id,
                  job_card_no
                `
              )
              .in("visit_id", visitIds),
          ]);

          if (vehiclesResult.error) {
            throw vehiclesResult.error;
          }

          if (intakeResult.error) {
            throw intakeResult.error;
          }

          const vehicleRows =
            (vehiclesResult.data || []) as VehicleRow[];

          const intakeRows =
            (intakeResult.data || []) as IntakeRow[];

          const insuranceCompanyIds =
            Array.from(
              new Set(
                intakeRows
                  .map(
                    (item) =>
                      item.insurance_company_id
                  )
                  .filter(
                    (id): id is string =>
                      Boolean(id)
                  )
              )
            );

          const miTypeIds = Array.from(
            new Set(
              intakeRows
                .map(
                  (item) => item.mi_type_id
                )
                .filter(
                  (id): id is string =>
                    Boolean(id)
                )
            )
          );

          let insuranceCompanies: InsuranceCompanyRow[] =
            [];

          let miTypes: MiTypeRow[] = [];

          if (
            insuranceCompanyIds.length > 0
          ) {
            const { data, error } =
              await supabase
                .from("insurance_companies")
                .select("id, name")
                .in(
                  "id",
                  insuranceCompanyIds
                );

            if (error) {
              throw error;
            }

            insuranceCompanies =
              (data || []) as InsuranceCompanyRow[];
          }

          if (miTypeIds.length > 0) {
            const { data, error } =
              await supabase
                .from("mi_types")
                .select("id, name")
                .in("id", miTypeIds);

            if (error) {
              throw error;
            }

            miTypes =
              (data || []) as MiTypeRow[];
          }

          const vehicleMap = new Map<
            string,
            VehicleRow
          >();

          vehicleRows.forEach((vehicle) => {
            vehicleMap.set(
              vehicle.id,
              vehicle
            );
          });

          const intakeMap = new Map<
            string,
            IntakeRow
          >();

          intakeRows.forEach((intake) => {
            intakeMap.set(
              intake.visit_id,
              intake
            );
          });

          const insuranceCompanyMap =
            new Map<
              string,
              InsuranceCompanyRow
            >();

          insuranceCompanies.forEach(
            (company) => {
              insuranceCompanyMap.set(
                company.id,
                company
              );
            }
          );

          const miTypeMap = new Map<
            string,
            MiTypeRow
          >();

          miTypes.forEach((miType) => {
            miTypeMap.set(
              miType.id,
              miType
            );
          });

          const combined: ClaimVehicle[] =
            [];

          visitRows.forEach((visit) => {
            const vehicle =
              vehicleMap.get(
                visit.vehicle_id
              );

            const intake =
              intakeMap.get(visit.id);

            if (!vehicle || !intake) {
              return;
            }

            const insuranceCompany =
              intake.insurance_company_id
                ? insuranceCompanyMap.get(
                    intake.insurance_company_id
                  ) || null
                : null;

            const miType =
              intake.mi_type_id
                ? miTypeMap.get(
                    intake.mi_type_id
                  ) || null
                : null;

            combined.push({
              visit,
              vehicle,
              intake,
              insuranceCompany,
              miType,
            });
          });

          if (active) {
            setVehicles(combined);
          }
        } catch (error: any) {
          console.error(
            "Claim Intimation load error:",
            error
          );

          if (active) {
            showPopup(
              "error",
              "Unable to Load",
              error?.message ||
                "Something went wrong while loading Claim Intimation."
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      run();

      return () => {
        active = false;
      };
    }, [loadProfile])
  );

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      const currentProfile =
        await loadProfile();

      if (!currentProfile) {
        return;
      }

      let visitQuery = supabase
        .from("workshop_visits")
        .select(
          `
            id,
            vehicle_id,
            visit_no,
            current_stage,
            current_status,
            current_assigned_to,
            stage_started_at,
            created_at
          `
        )
        .eq(
          "current_stage",
          "CLAIM_INTIMATION"
        )
        .in("current_status", [
          "PENDING",
          "IN_PROGRESS",
        ])
        .order("stage_started_at", {
          ascending: true,
          nullsFirst: false,
        });

      if (currentProfile.role === "advisor") {
        visitQuery = visitQuery.eq(
          "current_assigned_to",
          currentProfile.id
        );
      }

      const { data: visits, error } =
        await visitQuery;

      if (error) {
        throw error;
      }

      const visitRows =
        (visits || []) as VisitRow[];

      if (visitRows.length === 0) {
        setVehicles([]);
        return;
      }

      const vehicleIds = Array.from(
        new Set(
          visitRows.map(
            (item) => item.vehicle_id
          )
        )
      );

      const visitIds = Array.from(
        new Set(
          visitRows.map((item) => item.id)
        )
      );

      const [
        vehiclesResult,
        intakeResult,
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, vehicle_no")
          .in("id", vehicleIds),

        supabase
          .from("vehicle_intake")
          .select(
            `
              visit_id,
              vehicle_id,
              customer_name,
              customer_mobile,
              vehicle_type,
              arena_nexa,
              insurance_type,
              mi_type_id,
              insurance_company_id,
              job_card_no
            `
          )
          .in("visit_id", visitIds),
      ]);

      if (vehiclesResult.error) {
        throw vehiclesResult.error;
      }

      if (intakeResult.error) {
        throw intakeResult.error;
      }

      const vehicleRows =
        (vehiclesResult.data || []) as VehicleRow[];

      const intakeRows =
        (intakeResult.data || []) as IntakeRow[];

      const insuranceCompanyIds =
        Array.from(
          new Set(
            intakeRows
              .map(
                (item) =>
                  item.insurance_company_id
              )
              .filter(
                (id): id is string =>
                  Boolean(id)
              )
          )
        );

      const miTypeIds = Array.from(
        new Set(
          intakeRows
            .map(
              (item) => item.mi_type_id
            )
            .filter(
              (id): id is string =>
                Boolean(id)
            )
        )
      );

      let insuranceCompanies: InsuranceCompanyRow[] =
        [];

      let miTypes: MiTypeRow[] = [];

      if (
        insuranceCompanyIds.length > 0
      ) {
        const { data, error } =
          await supabase
            .from("insurance_companies")
            .select("id, name")
            .in(
              "id",
              insuranceCompanyIds
            );

        if (error) {
          throw error;
        }

        insuranceCompanies =
          (data || []) as InsuranceCompanyRow[];
      }

      if (miTypeIds.length > 0) {
        const { data, error } =
          await supabase
            .from("mi_types")
            .select("id, name")
            .in("id", miTypeIds);

        if (error) {
          throw error;
        }

        miTypes =
          (data || []) as MiTypeRow[];
      }

      const vehicleMap = new Map<
        string,
        VehicleRow
      >();

      vehicleRows.forEach((vehicle) => {
        vehicleMap.set(
          vehicle.id,
          vehicle
        );
      });

      const intakeMap = new Map<
        string,
        IntakeRow
      >();

      intakeRows.forEach((intake) => {
        intakeMap.set(
          intake.visit_id,
          intake
        );
      });

      const insuranceCompanyMap =
        new Map<
          string,
          InsuranceCompanyRow
        >();

      insuranceCompanies.forEach(
        (company) => {
          insuranceCompanyMap.set(
            company.id,
            company
          );
        }
      );

      const miTypeMap = new Map<
        string,
        MiTypeRow
      >();

      miTypes.forEach((miType) => {
        miTypeMap.set(
          miType.id,
          miType
        );
      });

      const combined: ClaimVehicle[] =
        [];

      visitRows.forEach((visit) => {
        const vehicle =
          vehicleMap.get(
            visit.vehicle_id
          );

        const intake =
          intakeMap.get(visit.id);

        if (!vehicle || !intake) {
          return;
        }

        const insuranceCompany =
          intake.insurance_company_id
            ? insuranceCompanyMap.get(
                intake.insurance_company_id
              ) || null
            : null;

        const miType =
          intake.mi_type_id
            ? miTypeMap.get(
                intake.mi_type_id
              ) || null
            : null;

        combined.push({
          visit,
          vehicle,
          intake,
          insuranceCompany,
          miType,
        });
      });

      setVehicles(combined);
    } catch (error: any) {
      console.error(
        "Claim Intimation refresh error:",
        error
      );

      showPopup(
        "error",
        "Refresh Failed",
        error?.message ||
          "Unable to refresh Claim Intimation."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    const term = normalizeSearch(search);

    if (!term) {
      return vehicles;
    }

    return vehicles.filter((item) => {
      const vehicleNumber =
        item.vehicle.vehicle_no || "";

      const customerName =
        item.intake.customer_name || "";

      const customerMobile =
        item.intake.customer_mobile || "";

      const insuranceCompany =
        item.insuranceCompany?.name || "";

      const jobCard =
        item.intake.job_card_no || "";

      return (
        normalizeSearch(
          vehicleNumber
        ).includes(term) ||
        normalizeSearch(
          customerName
        ).includes(term) ||
        normalizeSearch(
          customerMobile
        ).includes(term) ||
        normalizeSearch(
          insuranceCompany
        ).includes(term) ||
        normalizeSearch(
          jobCard
        ).includes(term)
      );
    });
  }, [vehicles, search]);

  const openClaimIntimation = (
    item: ClaimVehicle
  ) => {
    router.push({
      pathname:
        "/(tabs)/advisor/claim-intimation-form",
      params: {
        visitId: item.visit.id,
        vehicleId: item.vehicle.id,
      },
    });
  };

  const renderVehicle = ({
    item,
  }: {
    item: ClaimVehicle;
  }) => {
    const insuranceLabel =
      item.insuranceCompany?.name ||
      "Insurance Company not available";

    const miLabel =
      item.miType?.name ||
      "MI / NON-MI not available";

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.vehicleIcon}>
            <Ionicons
              name="car-sport-outline"
              size={23}
              color={colors.primary}
            />
          </View>

          <View style={styles.vehicleMain}>
            <Text style={styles.vehicleNumber}>
              {item.vehicle.vehicle_no}
            </Text>

            <Text
              style={styles.customerName}
              numberOfLines={1}
            >
              {item.intake.customer_name}
            </Text>
          </View>

          <View style={styles.waitingBadge}>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.warning}
            />

            <Text style={styles.waitingText}>
              {getWaitingTime(
                item.visit.stage_started_at
              )}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              Insurance
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={1}
            >
              {insuranceLabel}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              Type
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={1}
            >
              {miLabel}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              Vehicle
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={1}
            >
              {item.intake.arena_nexa || "—"}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              Job Card
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={1}
            >
              {item.intake.job_card_no || "—"}
            </Text>
          </View>
        </View>

        <View style={styles.stageRow}>
          <View style={styles.stageIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={colors.primary}
            />
          </View>

          <View style={styles.stageTextContainer}>
            <Text style={styles.stageTitle}>
              Claim Intimation Pending
            </Text>

            <Text style={styles.stageSubtitle}>
              Since{" "}
              {formatDateTime(
                item.visit.stage_started_at
              )}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={() =>
            openClaimIntimation(item)
          }
        >
          <Text style={styles.actionButtonText}>
            Start Claim Intimation
          </Text>

          <Ionicons
            name="arrow-forward"
            size={18}
            color={colors.white}
          />
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading Claim Intimation...
          </Text>
        </View>

        <Modal
          transparent
          visible={popup.visible}
          animationType="fade"
          onRequestClose={closePopup}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.popupCard}>
              <View
                style={[
                  styles.popupIcon,
                  popup.type === "error"
                    ? styles.popupIconError
                    : styles.popupIconInfo,
                ]}
              >
                <Ionicons
                  name={
                    popup.type === "error"
                      ? "alert-circle"
                      : "information-circle"
                  }
                  size={27}
                  color={
                    popup.type === "error"
                      ? colors.danger
                      : colors.info
                  }
                />
              </View>

              <Text style={styles.popupTitle}>
                {popup.title}
              </Text>

              <Text style={styles.popupMessage}>
                {popup.message}
              </Text>

              <Pressable
                style={styles.popupButton}
                onPress={closePopup}
              >
                <Text
                  style={styles.popupButtonText}
                >
                  OK
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>
              Claim Intimation
            </Text>

            <Text style={styles.subtitle}>
              Insurance vehicles waiting for claim intimation
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {vehicles.length}
            </Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.textSecondary}
          />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search vehicle, customer, mobile..."
            placeholderTextColor={
              colors.textLight
            }
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={10}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textLight}
              />
            </Pressable>
          )}
        </View>

        <FlatList
          data={filteredVehicles}
          keyExtractor={(item) =>
            item.visit.id
          }
          renderItem={renderVehicle}
          contentContainerStyle={[
            styles.listContent,
            filteredVehicles.length === 0 &&
              styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            filteredVehicles.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {filteredVehicles.length}{" "}
                  {filteredVehicles.length === 1
                    ? "vehicle"
                    : "vehicles"}{" "}
                  pending
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={38}
                  color={colors.textLight}
                />
              </View>

              <Text style={styles.emptyTitle}>
                {search.trim()
                  ? "No vehicles found"
                  : "No Claim Intimation pending"}
              </Text>

              <Text style={styles.emptyMessage}>
                {search.trim()
                  ? "Try searching with another vehicle number, customer name, mobile number or job card."
                  : "Vehicles will appear here after Insurance intake is completed."}
              </Text>

              {search.trim().length > 0 && (
                <Pressable
                    style={styles.clearSearchButton}
                    onPress={() => setSearch("")}
                >
                    <Text style={styles.clearSearchButtonText}>
                    Clear Search
                    </Text>
                </Pressable>
                )}
            </View>
          }
        />
      </View>

      <Modal
        transparent
        visible={popup.visible}
        animationType="fade"
        onRequestClose={closePopup}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.popupCard}>
            <View
              style={[
                styles.popupIcon,
                popup.type === "error"
                  ? styles.popupIconError
                  : styles.popupIconInfo,
              ]}
            >
              <Ionicons
                name={
                  popup.type === "error"
                    ? "alert-circle"
                    : "information-circle"
                }
                size={27}
                color={
                  popup.type === "error"
                    ? colors.danger
                    : colors.info
                }
              />
            </View>

            <Text style={styles.popupTitle}>
              {popup.title}
            </Text>

            <Text style={styles.popupMessage}>
              {popup.message}
            </Text>

            <Pressable
              style={styles.popupButton}
              onPress={closePopup}
            >
              <Text
                style={styles.popupButtonText}
              >
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
  },

  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.body.fontSize,
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },

  title: {
    ...typography.heading,
    color: colors.text,
  },

  subtitle: {
    marginTop: 4,
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  countBadge: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },

  countText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "700",
  },

  searchContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },

  searchInput: {
    flex: 1,
    marginHorizontal: spacing.sm,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 15,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 32,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  listHeader: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },

  listHeaderText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  vehicleIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  vehicleMain: {
    flex: 1,
    marginLeft: spacing.md,
  },

  vehicleNumber: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },

  customerName: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 14,
  },

  waitingBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.round,
    backgroundColor: colors.warningLight,
    flexDirection: "row",
    alignItems: "center",
  },

  waitingText: {
    marginLeft: 4,
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },

  infoItem: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: spacing.md,
  },

  infoLabel: {
    color: colors.textLight,
    fontSize: 12,
    marginBottom: 4,
  },

  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  stageRow: {
    marginTop: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
  },

  stageIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  stageTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  stageTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },

  stageSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
  },

  actionButton: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },

  actionButtonPressed: {
    backgroundColor: colors.primaryDark,
  },

  actionButtonText: {
    marginRight: spacing.sm,
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },

  emptyContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: 60,
  },

  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyTitle: {
    marginTop: spacing.lg,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  emptyMessage: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  clearSearchButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },

  clearSearchButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },

  popupCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: "center",
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },

  popupIconError: {
    backgroundColor: colors.dangerLight,
  },

  popupIconInfo: {
    backgroundColor: colors.infoLight,
  },

  popupTitle: {
    marginTop: spacing.md,
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },

  popupMessage: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  popupButton: {
    width: "100%",
    marginTop: spacing.xl,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  popupButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
});