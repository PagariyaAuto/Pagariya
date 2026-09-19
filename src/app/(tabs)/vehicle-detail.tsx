import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import Ionicons from "@expo/vector-icons/Ionicons";

import {
    router,
    useLocalSearchParams,
} from "expo-router";

import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../../lib/supabase";

import PhotoGallery from "../../../components/PhotoGallery";
import PhotoUploadModal from "../../../components/PhotoUploadModal";
import PhotoViewer from "../../../components/PhotoViewer";

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
};

type Profile = {
  id: string;
  name: string | null;
  role: string;
};

type InsuranceCompany = {
  id: string;
  name: string;
};

type VehicleJob = {
  id: string;
  vehicle_id: string;
  advisor_id: string | null;
  job_type: "INSURANCE" | "PAID";
  job_card_no: string | null;
  vehicle_type: string | null;
  arena_nexa: string | null;
  insurance_company_id: string | null;
  claim_intimation_at: string | null;
  estimate_id: string | null;
  claim_no: string | null;
  survey_at: string | null;
  approval_status: string;
  customer_approval_at: string | null;
  paid_job_remarks: string | null;
  advisor_remarks: string | null;
  current_job_stage: string;
  created_at: string;
  updated_at: string;
};

type PhotoItem = {
  id: string;
  uri: string;
  status:
    | "pending"
    | "uploading"
    | "uploaded"
    | "failed";
  progress?: number;
  storagePath?: string;
};

export default function VehicleDetailScreen() {
  const params = useLocalSearchParams<{
    vehicleId?: string;
  }>();

  const vehicleId = params.vehicleId;

  const [vehicle, setVehicle] =
    useState<Vehicle | null>(null);

  const [advisor, setAdvisor] =
    useState<Profile | null>(null);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [currentUserRole, setCurrentUserRole] =
    useState<string | null>(null);

  const [insuranceCompanies, setInsuranceCompanies] =
    useState<InsuranceCompany[]>([]);

  const [selectedInsuranceCompany, setSelectedInsuranceCompany] =
    useState<string | null>(null);

  const [surveyJob, setSurveyJob] =
    useState<VehicleJob | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [takingVehicle, setTakingVehicle] =
    useState(false);

  const [jobType, setJobType] =
    useState<"INSURANCE" | "PAID" | null>(null);

  const [jobCardNo, setJobCardNo] =
    useState("");

  const [claimIntimationAt, setClaimIntimationAt] =
    useState("");

  const [estimateId, setEstimateId] =
    useState("");

  const [claimNo, setClaimNo] =
    useState("");

  const [surveyAt, setSurveyAt] =
    useState("");

  const [datePickerVisible, setDatePickerVisible] =
    useState(false);

  const [datePickerTarget, setDatePickerTarget] =
    useState<"claim" | "survey" | null>(null);

  const [datePickerStep, setDatePickerStep] =
    useState<"date" | "time">("date");

  const [datePickerValue, setDatePickerValue] =
    useState(new Date());

  const [customerApprovalAt, setCustomerApprovalAt] =
    useState("");

  const [paidJobRemarks, setPaidJobRemarks] =
    useState("");

  const [advisorRemarks, setAdvisorRemarks] =
    useState("");

  const [photos, setPhotos] =
    useState<PhotoItem[]>([]);

  const [photoUploadVisible, setPhotoUploadVisible] =
    useState(false);

  const [photoViewerVisible, setPhotoViewerVisible] =
    useState(false);

  const [selectedPhotoIndex, setSelectedPhotoIndex] =
    useState(0);

  const [submitting, setSubmitting] =
    useState(false);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [modalTitle, setModalTitle] =
    useState("");

  const [modalMessage, setModalMessage] =
    useState("");

  const [insuranceDropdownVisible, setInsuranceDropdownVisible] =
    useState(false);

  function showModal(
    title: string,
    message: string
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  const loadSurveyPhotos = async (targetVehicleId: string) => {
    try {
      const { data, error } = await supabase
        .from("vehicle_photos")
        .select(`
          id,
          storage_path,
          photo_type
        `)
        .eq("vehicle_id", targetVehicleId)
        .eq("photo_type", "SURVEY")
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setPhotos([]);
        return;
      }

      const loadedPhotos: PhotoItem[] = [];

      for (const photo of data) {
        const { data: signedData, error: signedError } =
          await supabase.storage
            .from("vehicle-photos")
            .createSignedUrl(photo.storage_path, 60 * 60);

        if (signedError) {
          console.error("Signed URL error:", signedError);
          continue;
        }

        if (signedData?.signedUrl) {
          loadedPhotos.push({
            id: photo.id,
            uri: signedData.signedUrl,
            status: "uploaded",
            progress: 100,
            storagePath: photo.storage_path,
          });
        }
      }

      setPhotos(loadedPhotos);
    } catch (error) {
      console.error("Load survey photos error:", error);
      setPhotos([]);
    }
  };

  const loadVehicle = useCallback(
    async () => {
      if (!vehicleId) {
        showModal(
          "Vehicle Not Found",
          "Vehicle ID was not provided."
        );

        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const {
          data: {
            user,
          },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "User session not found."
          );
        }

        setCurrentUserId(user.id);

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id, name, role"
          )
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        setCurrentUserRole(
          profileData.role
        );

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
            current_assigned_to
          `)
          .eq("id", vehicleId)
          .single();

        if (vehicleError) {
          throw vehicleError;
        }

        setVehicle(vehicleData);

        if (
          vehicleData.current_assigned_to
        ) {
          const {
            data: advisorData,
            error: advisorError,
          } = await supabase
            .from("profiles")
            .select(
              "id, name, role"
            )
            .eq(
              "id",
              vehicleData.current_assigned_to
            )
            .single();

          if (advisorError) {
            throw advisorError;
          }

          setAdvisor(advisorData);
        } else {
          setAdvisor(null);
        }

        const {
          data: insuranceData,
          error: insuranceError,
        } = await supabase
          .from("insurance_companies")
          .select("id, name")
          .order("name", {
            ascending: true,
          });

        if (insuranceError) {
          throw insuranceError;
        }

        setInsuranceCompanies(
          insuranceData ?? []
        );

        const {
          data: jobData,
          error: jobError,
        } = await supabase
          .from("vehicle_jobs")
          .select(`
            id,
            vehicle_id,
            advisor_id,
            job_type,
            job_card_no,
            vehicle_type,
            arena_nexa,
            insurance_company_id,
            claim_intimation_at,
            estimate_id,
            claim_no,
            survey_at,
            approval_status,
            customer_approval_at,
            paid_job_remarks,
            advisor_remarks,
            current_job_stage,
            created_at,
            updated_at
          `)
          .eq("vehicle_id", vehicleId)
          .maybeSingle();

        if (jobError) {
          throw jobError;
        }

        setSurveyJob(jobData ?? null);

        if (vehicleData.current_stage === "SURVEY") {
          await loadSurveyPhotos(vehicleData.id);
        } else {
          setPhotos([]);
        }
      } catch (error: any) {
        console.error(
          "Vehicle details error:",
          error
        );

        showModal(
          "Unable to Load Vehicle",
          error?.message ||
            "Something went wrong while loading vehicle details."
        );
      } finally {
        setLoading(false);
      }
    },
    [vehicleId]
  );

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  /*
   * IMPORTANT WORKFLOW CHECK
   *
   * Survey can only be edited when:
   *
   * 1. Vehicle stage is ADVISOR_ASSIGNED
   * 2. Logged-in user is the assigned advisor
   *
   * CEO Admin is also allowed to work with the survey.
   */

  const isAssignedAdvisor =
    !!vehicle &&
    !!currentUserId &&
    vehicle.current_stage ===
      "ADVISOR_ASSIGNED" &&
    vehicle.current_assigned_to ===
      currentUserId;

  const isPendingAdvisor =
    vehicle?.current_stage ===
    "PENDING_ADVISOR";

  const isSurveyStage =
    vehicle?.current_stage === "SURVEY";

  const isLaterWorkflowStage =
    !!vehicle &&
    ![
      "PENDING_ADVISOR",
      "ADVISOR_ASSIGNED",
      "SURVEY",
    ].includes(vehicle.current_stage);

  const canEditSurvey =
    !!vehicle &&
    vehicle.current_stage === "ADVISOR_ASSIGNED" &&
    (isAssignedAdvisor || currentUserRole === "ceo_admin");

  const handleTakeVehicle = async () => {
    if (!vehicleId) {
      return;
    }

    if (
      currentUserRole !== "advisor"
    ) {
      return;
    }

    try {
      setTakingVehicle(true);

      const {
        error,
      } = await supabase.rpc(
        "take_vehicle_as_advisor",
        {
          p_vehicle_id: vehicleId,
        }
      );

      if (error) {
        throw error;
      }

      showModal(
        "Vehicle Assigned",
        "The vehicle has been assigned to you successfully."
      );

      await loadVehicle();
    } catch (error: any) {
      console.error(
        "Take vehicle error:",
        error
      );

      showModal(
        "Unable to Take Vehicle",
        error?.message ||
          "The vehicle could not be assigned to you."
      );
    } finally {
      setTakingVehicle(false);
    }
  };

  const addPhoto = async (
    source: "camera" | "gallery"
  ) => {
    if (!canEditSurvey) {
      return;
    }

    try {
      let result:
        | ImagePicker.ImagePickerResult;

      if (source === "camera") {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          showModal(
            "Camera Permission",
            "Camera permission is required to take a survey photo."
          );
          return;
        }

        result =
          await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: false,
          });
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          showModal(
            "Gallery Permission",
            "Gallery permission is required to select a survey photo."
          );
          return;
        }

        result =
          await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: false,
            allowsMultipleSelection: true,
          });
      }

      if (result.canceled) {
        return;
      }

      const selectedAssets =
        result.assets ?? [];

      const newPhotos: PhotoItem[] =
        selectedAssets.map(
          (asset, index) => ({
            id: `${Date.now()}-${index}-${Math.random()}`,
            uri: asset.uri,
            status: "pending",
          })
        );

      setPhotos((current) => [
        ...current,
        ...newPhotos,
      ]);
    } catch (error: any) {
      console.error(
        "Add survey photo error:",
        error
      );

      showModal(
        "Photo Error",
        error?.message ||
          "Unable to select photo."
      );
    }
  };

  const removePhoto = (
    photoId: string
  ) => {
    if (!canEditSurvey) {
      return;
    }

    setPhotos((current) =>
      current.filter(
        (photo) =>
          photo.id !== photoId
      )
    );
  };

  const uploadPhoto = async (
    photo: PhotoItem
  ) => {
    if (!vehicleId) {
      throw new Error(
        "Vehicle ID is missing."
      );
    }

    const fileName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}.jpg`;

    const storagePath =
      `vehicles/${vehicleId}/SURVEY/${fileName}`;

    setPhotos((current) =>
      current.map((item) =>
        item.id === photo.id
          ? {
              ...item,
              status: "uploading",
              progress: 20,
            }
          : item
      )
    );

    const response = await fetch(
      photo.uri
    );

    const arrayBuffer =
      await response.arrayBuffer();

    setPhotos((current) =>
      current.map((item) =>
        item.id === photo.id
          ? {
              ...item,
              progress: 60,
            }
          : item
      )
    );

    const {
      error: uploadError,
    } = await supabase.storage
      .from("vehicle-photos")
      .upload(
        storagePath,
        arrayBuffer,
        {
          contentType:
            "image/jpeg",
          upsert: false,
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    setPhotos((current) =>
      current.map((item) =>
        item.id === photo.id
          ? {
              ...item,
              progress: 85,
            }
          : item
      )
    );

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    const {
      error: photoDbError,
    } = await supabase
      .from("vehicle_photos")
      .insert({
        vehicle_id: vehicleId,
        event_id: null,
        photo_type: "SURVEY",
        storage_path: storagePath,
        uploaded_by:
          user?.id,
      });

    if (photoDbError) {
      await supabase.storage
        .from("vehicle-photos")
        .remove([
          storagePath,
        ]);

      throw photoDbError;
    }

    setPhotos((current) =>
      current.map((item) =>
        item.id === photo.id
          ? {
              ...item,
              status: "uploaded",
              progress: 100,
              storagePath,
            }
          : item
      )
    );
  };

  const uploadAllPhotos =
    async () => {
      const pendingPhotos =
        photos.filter(
          (photo) =>
            photo.status ===
              "pending" ||
            photo.status ===
              "failed"
        );

      for (const photo of pendingPhotos) {
        try {
          await uploadPhoto(
            photo
          );
        } catch (error) {
          console.error(
            "Survey photo upload error:",
            error
          );

          setPhotos(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  photo.id
                    ? {
                        ...item,
                        status:
                          "failed",
                      }
                    : item
              )
          );

          throw error;
        }
      }
    };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const openDateTimePicker = (
    target: "claim" | "survey"
  ) => {
    const existingValue =
      target === "claim"
        ? claimIntimationAt
        : surveyAt;

    const parsed = existingValue
      ? new Date(existingValue)
      : new Date();

    setDatePickerValue(
      Number.isNaN(parsed.getTime())
        ? new Date()
        : parsed
    );
    setDatePickerTarget(target);
    setDatePickerStep("date");
    setDatePickerVisible(true);
  };

  const handleDatePickerChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (event.type === "dismissed") {
      setDatePickerVisible(false);
      setDatePickerTarget(null);
      setDatePickerStep("date");
      return;
    }

    if (!selectedDate) {
      return;
    }

    setDatePickerValue(selectedDate);

    if (datePickerStep === "date") {
      setDatePickerStep("time");
      return;
    }

    if (datePickerTarget === "claim") {
      setClaimIntimationAt(selectedDate.toISOString());
    }

    if (datePickerTarget === "survey") {
      setSurveyAt(selectedDate.toISOString());
    }

    setDatePickerVisible(false);
    setDatePickerTarget(null);
    setDatePickerStep("date");
  };

  const getPickerLabel = (
    value: string,
    placeholder: string
  ) => {
    if (!value) {
      return placeholder;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return placeholder;
    }

    return formatDateTime(parsed);
  };

  const validateForm = () => {
    if (!canEditSurvey) {
      showModal(
        "Vehicle Not Assigned",
        "You must take this vehicle before filling the survey."
      );

      return false;
    }

    if (!jobType) {
      showModal(
        "Job Type Required",
        "Please select Insurance or Paid job."
      );

      return false;
    }

    if (
      jobType ===
        "INSURANCE" &&
      !selectedInsuranceCompany
    ) {
      showModal(
        "Insurance Company Required",
        "Please select the insurance company."
      );

      return false;
    }

    if (
      jobType === "INSURANCE" &&
      !claimIntimationAt
    ) {
      showModal(
        "Claim Intimation Required",
        "Please select the Claim Intimation date and time."
      );

      return false;
    }

    if (
      jobType === "INSURANCE" &&
      !estimateId.trim()
    ) {
      showModal(
        "Estimate ID Required",
        "Please enter the Estimate ID."
      );

      return false;
    }

    if (
      jobType === "INSURANCE" &&
      !claimNo.trim()
    ) {
      showModal(
        "Claim No. Required",
        "Please enter the Claim No."
      );

      return false;
    }

    if (!surveyAt) {
      showModal(
        "Survey Date & Time Required",
        "Please select the Survey date and time."
      );

      return false;
    }

    if (
      jobType === "PAID" &&
      !customerApprovalAt.trim()
    ) {
      showModal(
        "Customer Approval Required",
        "Please enter the customer approval date/time."
      );

      return false;
    }

    return true;
  };

  const handleSubmitSurvey =
    async () => {
      if (!vehicleId) {
        return;
      }

      if (!validateForm()) {
        return;
      }

      try {
        setSubmitting(true);

        await uploadAllPhotos();

        const {
          error,
        } = await supabase.rpc(
          "start_vehicle_survey",
          {
            p_vehicle_id:
              vehicleId,

            p_job_type:
              jobType,

            p_job_card_no:
              jobCardNo.trim() ||
              null,

            p_insurance_company_id:
              jobType ===
              "INSURANCE"
                ? selectedInsuranceCompany
                : null,

            p_claim_intimation_at:
              jobType === "INSURANCE"
                ? claimIntimationAt || null
                : null,

            p_estimate_id:
              jobType === "INSURANCE"
                ? estimateId.trim() || null
                : null,

            p_claim_no:
              jobType === "INSURANCE"
                ? claimNo.trim() || null
                : null,

            p_survey_at:
              surveyAt || null,

            p_customer_approval_at:
              jobType ===
              "PAID"
                ? new Date(
                    customerApprovalAt
                  ).toISOString()
                : null,

            p_paid_job_remarks:
              jobType ===
              "PAID"
                ? paidJobRemarks.trim() ||
                  null
                : null,

            p_advisor_remarks:
              advisorRemarks.trim() ||
              null,
          }
        );

        if (error) {
          throw error;
        }

        showModal(
          "Survey Submitted",
          "Vehicle survey has been submitted successfully."
        );
      } catch (error: any) {
        console.error(
          "Submit survey error:",
          error
        );

        showModal(
          "Unable to Submit Survey",
          error?.message ||
            "Something went wrong while submitting the survey."
        );
      } finally {
        setSubmitting(false);
      }
    };

  const openPhotoViewer = (
    photo: PhotoItem
  ) => {
    const index =
      photos.findIndex(
        (item) =>
          item.id === photo.id
      );

    if (index >= 0) {
      setSelectedPhotoIndex(
        index
      );

      setPhotoViewerVisible(
        true
      );
    }
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
            color={
              colors.primary
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading vehicle...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
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
            styles.emptyContainer
          }
        >
          <Ionicons
            name="car-outline"
            size={42}
            color={
              colors.textLight
            }
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            Vehicle not found
          </Text>

          <TouchableOpacity
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              Go Back
            </Text>
          </TouchableOpacity>
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
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            style={
              styles.headerBack
            }
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={
                colors.text
              }
            />
          </TouchableOpacity>

          <View
            style={
              styles.headerText
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Vehicle Details
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Advisor Survey
            </Text>
          </View>
        </View>

        {/* VEHICLE INFORMATION */}

        <View style={styles.card}>
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
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.cardTitle
              }
            >
              Vehicle Information
            </Text>
          </View>

          <View
            style={
              styles.vehicleNumberBox
            }
          >
            <Text
              style={
                styles.vehicleNumber
              }
            >
              {vehicle.vehicle_no}
            </Text>

            <View
              style={
                vehicle.current_stage ===
                "PENDING_ADVISOR"
                  ? styles.pendingStatus
                  : styles.assignedStatus
              }
            >
              <Text
                style={
                  vehicle.current_stage ===
                  "PENDING_ADVISOR"
                    ? styles.pendingStatusText
                    : styles.assignedStatusText
                }
              >
                {vehicle.current_stage ===
                "PENDING_ADVISOR"
                  ? "Pending Advisor"
                  : "Assigned"}
              </Text>
            </View>
          </View>

          <InfoRow
            label="Model"
            value={
              vehicle.model ||
              "Not available"
            }
          />

          <InfoRow
            label="Vehicle Type"
            value={
              vehicle.vehicle_type ||
              "Not available"
            }
          />

          <InfoRow
            label="Brand"
            value={
              vehicle.arena_nexa ||
              "Not available"
            }
          />

          <InfoRow
            label="Job Card No."
            value={
              vehicle.jc_no ||
              "Not assigned"
            }
          />
        </View>

        {/* CUSTOMER */}

        <View style={styles.card}>
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

            <Text
              style={
                styles.cardTitle
              }
            >
              Customer Information
            </Text>
          </View>

          <InfoRow
            label="Customer Name"
            value={
              vehicle.customer_name ||
              "Not available"
            }
          />

          <InfoRow
            label="Mobile"
            value={
              vehicle.customer_mobile ||
              "Not available"
            }
          />
        </View>

        {/* ADVISOR */}

        <View style={styles.card}>
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
                name="person-circle-outline"
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.cardTitle
              }
            >
              Assigned Advisor
            </Text>
          </View>

          <InfoRow
            label="Name"
            value={
              advisor?.name ||
              "Not assigned"
            }
          />

          <InfoRow
            label="Role"
            value={
              advisor?.role ||
              "Not assigned"
            }
          />
        </View>

        {/* PENDING ADVISOR LOCK */}

        {isPendingAdvisor && (
          <View
            style={
              styles.lockCard
            }
          >
            <View
              style={
                styles.lockIcon
              }
            >
              <Ionicons
                name="lock-closed-outline"
                size={28}
                color={
                  colors.warning
                }
              />
            </View>

            <Text
              style={
                styles.lockTitle
              }
            >
              Vehicle Not Assigned
            </Text>

            <Text
              style={
                styles.lockText
              }
            >
              This vehicle is waiting for an advisor. Take the vehicle first before filling the survey details.
            </Text>

            {currentUserRole ===
              "advisor" && (
              <TouchableOpacity
                style={[
                  styles.takeButton,
                  takingVehicle &&
                    styles.takeButtonDisabled,
                ]}
                onPress={
                  handleTakeVehicle
                }
                disabled={
                  takingVehicle
                }
                activeOpacity={
                  0.8
                }
              >
                {takingVehicle ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.white
                      }
                    />

                    <Text
                      style={
                        styles.takeButtonText
                      }
                    >
                      Assigning...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="hand-left-outline"
                      size={19}
                      color={
                        colors.white
                      }
                    />

                    <Text
                      style={
                        styles.takeButtonText
                      }
                    >
                      Take Vehicle
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* WRONG ADVISOR LOCK */}

        {vehicle.current_stage ===
          "ADVISOR_ASSIGNED" &&
          !isAssignedAdvisor &&
          currentUserRole !==
            "ceo_admin" && (
            <View
              style={
                styles.lockCard
              }
            >
              <View
                style={
                  styles.lockIcon
                }
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={28}
                  color={
                    colors.warning
                  }
                />
              </View>

              <Text
                style={
                  styles.lockTitle
                }
              >
                Vehicle Assigned to Another Advisor
              </Text>

              <Text
                style={
                  styles.lockText
                }
              >
                This vehicle has already been taken by another advisor. You cannot edit or submit the survey.
              </Text>
            </View>
          )}

        {/* SURVEY SUBMITTED / READ-ONLY */}

        {isSurveyStage && surveyJob && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={22}
                  color={colors.success}
                />
              </View>

              <Text style={styles.cardTitle}>
                Survey Submitted
              </Text>
            </View>

            <View style={styles.surveyStatusBox}>
              <View style={styles.surveyStatusIcon}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.success}
                />
              </View>

              <View style={styles.surveyStatusContent}>
                <Text style={styles.surveyStatusTitle}>
                  Survey Submitted Successfully
                </Text>
                <Text style={styles.surveyStatusText}>
                  This vehicle is currently in the Survey stage. The submitted survey details are read-only.
                </Text>
              </View>
            </View>

            <InfoRow
              label="Job Type"
              value={surveyJob.job_type}
            />

            <InfoRow
              label="Job Card No."
              value={surveyJob.job_card_no || "Not provided"}
            />

            {surveyJob.job_type === "INSURANCE" && (
              <>
                <InfoRow
                  label="Insurance Company"
                  value={
                    insuranceCompanies.find(
                      (company) =>
                        company.id === surveyJob.insurance_company_id
                    )?.name || "Not available"
                  }
                />

                <InfoRow
                  label="Estimate ID"
                  value={surveyJob.estimate_id || "Not provided"}
                />

                <InfoRow
                  label="Claim No."
                  value={surveyJob.claim_no || "Not provided"}
                />

                <InfoRow
                  label="Claim Intimation"
                  value={
                    surveyJob.claim_intimation_at
                      ? formatDateTime(new Date(surveyJob.claim_intimation_at))
                      : "Not provided"
                  }
                />
              </>
            )}

            <InfoRow
              label="Survey Date & Time"
              value={
                surveyJob.survey_at
                  ? formatDateTime(new Date(surveyJob.survey_at))
                  : "Not provided"
              }
            />

            {surveyJob.job_type === "PAID" && (
              <>
                <InfoRow
                  label="Customer Approval"
                  value={
                    surveyJob.customer_approval_at
                      ? formatDateTime(new Date(surveyJob.customer_approval_at))
                      : "Not provided"
                  }
                />

                <InfoRow
                  label="Paid Job Remarks"
                  value={surveyJob.paid_job_remarks || "No remarks"}
                />
              </>
            )}

            <InfoRow
              label="Advisor Remarks"
              value={surveyJob.advisor_remarks || "No remarks"}
            />

            <View style={styles.surveyPhotoSection}>
              <View style={styles.surveyPhotoHeader}>
                <Text style={styles.surveyPhotoTitle}>
                  Survey Photos
                </Text>
                <Text style={styles.surveyPhotoCount}>
                  {photos.length} photo{photos.length === 1 ? "" : "s"}
                </Text>
              </View>

              <PhotoGallery
                photos={photos}
                onAddPhoto={() => {}}
                onRemovePhoto={() => {}}
                onViewPhoto={openPhotoViewer}
                readOnly
              />
            </View>

            <View style={styles.nextStageInfoBox}>
              <Ionicons
                name="arrow-forward-circle-outline"
                size={21}
                color={colors.info}
              />
              <View style={styles.nextStageInfoContent}>
                <Text style={styles.nextStageInfoTitle}>
                  Next Stage: Approval
                </Text>
                <Text style={styles.nextStageInfoText}>
                  The approval step will be added next.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* SURVEY */}

        {canEditSurvey && (
          <View style={styles.card}>
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
                  name="clipboard-outline"
                  size={22}
                  color={
                    colors.primary
                  }
                />
              </View>

              <Text
                style={
                  styles.cardTitle
                }
              >
                Survey
              </Text>
            </View>

            <Text
              style={
                styles.fieldLabel
              }
            >
              Job Type
            </Text>

            <View
              style={
                styles.jobTypeRow
              }
            >
              <TouchableOpacity
                style={[
                  styles.jobTypeButton,
                  jobType ===
                    "INSURANCE" &&
                    styles.jobTypeButtonSelected,
                ]}
                onPress={() => {
                  setJobType(
                    "INSURANCE"
                  );

                  setCustomerApprovalAt(
                    ""
                  );

                  setPaidJobRemarks(
                    ""
                  );
                }}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={
                    jobType ===
                    "INSURANCE"
                      ? colors.white
                      : colors.primary
                  }
                />

                <Text
                  style={[
                    styles.jobTypeText,
                    jobType ===
                      "INSURANCE" &&
                      styles.jobTypeTextSelected,
                  ]}
                >
                  Insurance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.jobTypeButton,
                  jobType ===
                    "PAID" &&
                    styles.jobTypeButtonSelected,
                ]}
                onPress={() => {
                  setJobType(
                    "PAID"
                  );

                  setSelectedInsuranceCompany(
                    null
                  );

                  setClaimIntimationAt(
                    ""
                  );
                }}
              >
                <Ionicons
                  name="cash-outline"
                  size={20}
                  color={
                    jobType ===
                    "PAID"
                      ? colors.white
                      : colors.primary
                  }
                />

                <Text
                  style={[
                    styles.jobTypeText,
                    jobType ===
                      "PAID" &&
                      styles.jobTypeTextSelected,
                  ]}
                >
                  Paid
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.fieldLabel
              }
            >
              Job Card Number
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={jobCardNo}
              onChangeText={
                setJobCardNo
              }
              placeholder="Enter job card number"
              placeholderTextColor={
                colors.textLight
              }
            />

            {jobType ===
              "INSURANCE" && (
              <>
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Insurance Company
                </Text>

                <TouchableOpacity
                  style={
                    styles.dropdown
                  }
                  onPress={() =>
                    setInsuranceDropdownVisible(
                      true
                    )
                  }
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !selectedInsuranceCompany &&
                        styles.placeholderText,
                    ]}
                  >
                    {selectedInsuranceCompany
                      ? insuranceCompanies.find(
                          (
                            company
                          ) =>
                            company.id ===
                            selectedInsuranceCompany
                        )?.name ||
                        "Select insurance company"
                      : "Select insurance company"}
                  </Text>

                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={
                      colors.textSecondary
                    }
                  />
                </TouchableOpacity>

                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Claim Intimation
                </Text>

                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() =>
                    openDateTimePicker("claim")
                  }
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dateTimeText,
                      !claimIntimationAt &&
                        styles.placeholderText,
                    ]}
                  >
                    {getPickerLabel(
                      claimIntimationAt,
                      "Select claim intimation date & time"
                    )}
                  </Text>

                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Estimate ID
                </Text>

                <TextInput
                  style={styles.input}
                  value={estimateId}
                  onChangeText={setEstimateId}
                  placeholder="Enter estimate ID"
                  placeholderTextColor={
                    colors.textLight
                  }
                  autoCapitalize="characters"
                />

                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Claim No.
                </Text>

                <TextInput
                  style={styles.input}
                  value={claimNo}
                  onChangeText={setClaimNo}
                  placeholder="Enter claim number"
                  placeholderTextColor={
                    colors.textLight
                  }
                  autoCapitalize="characters"
                />
              </>
            )}

            <Text
              style={
                styles.fieldLabel
              }
            >
              Survey Date & Time
            </Text>

            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() =>
                openDateTimePicker("survey")
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dateTimeText,
                  !surveyAt &&
                    styles.placeholderText,
                ]}
              >
                {getPickerLabel(
                  surveyAt,
                  "Select survey date & time"
                )}
              </Text>

              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {jobType === "PAID" && (
              <>
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Customer Approval
                </Text>

                <TextInput
                  style={
                    styles.input
                  }
                  value={
                    customerApprovalAt
                  }
                  onChangeText={
                    setCustomerApprovalAt
                  }
                  placeholder="2026-09-18T11:00"
                  placeholderTextColor={
                    colors.textLight
                  }
                />

                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Paid Job Remarks
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                  ]}
                  value={
                    paidJobRemarks
                  }
                  onChangeText={
                    setPaidJobRemarks
                  }
                  placeholder="Enter paid job remarks"
                  placeholderTextColor={
                    colors.textLight
                  }
                  multiline
                  textAlignVertical="top"
                />
              </>
            )}

            <Text
              style={
                styles.fieldLabel
              }
            >
              Advisor Remarks
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.textArea,
              ]}
              value={
                advisorRemarks
              }
              onChangeText={
                setAdvisorRemarks
              }
              placeholder="Enter survey remarks"
              placeholderTextColor={
                colors.textLight
              }
              multiline
              textAlignVertical="top"
            />
          </View>
        )}

        {/* SURVEY PHOTOS */}

        {canEditSurvey && (
          <View style={styles.card}>
            <PhotoGallery
              photos={photos}
              onAddPhoto={() =>
                setPhotoUploadVisible(
                  true
                )
              }
              onRemovePhoto={
                removePhoto
              }
              onViewPhoto={
                openPhotoViewer
              }
            />
          </View>
        )}

        {/* LATER WORKFLOW STAGES */}

        {isLaterWorkflowStage && (
          <View style={styles.lockCard}>
            <View style={styles.lockIcon}>
              <Ionicons
                name="lock-closed-outline"
                size={28}
                color={colors.info}
              />
            </View>

            <Text style={styles.lockTitle}>
              Survey Locked
            </Text>

            <Text style={styles.lockText}>
              This vehicle has already moved beyond the Survey stage. Survey details can no longer be edited here.
            </Text>
          </View>
        )}

        {/* SUBMIT */}

        {canEditSurvey && (
          <TouchableOpacity
            style={[
              styles.submitButton,
              submitting &&
                styles.submitButtonDisabled,
            ]}
            onPress={
              handleSubmitSurvey
            }
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <>
                <ActivityIndicator
                  size="small"
                  color={
                    colors.white
                  }
                />

                <Text
                  style={
                    styles.submitButtonText
                  }
                >
                  Submitting Survey...
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={21}
                  color={
                    colors.white
                  }
                />

                <Text
                  style={
                    styles.submitButtonText
                  }
                >
                  Submit Survey
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View
          style={
            styles.bottomSpace
          }
        />
      </ScrollView>

      {/* PHOTO UPLOAD MODAL */}

      <PhotoUploadModal
        visible={
          photoUploadVisible
        }
        onClose={() =>
          setPhotoUploadVisible(
            false
          )
        }
        onTakePhoto={() => {
          setPhotoUploadVisible(
            false
          );

          addPhoto("camera");
        }}
        onChooseFromGallery={() => {
          setPhotoUploadVisible(
            false
          );

          addPhoto("gallery");
        }}
      />

      {/* PHOTO VIEWER */}

      <PhotoViewer
        visible={
          photoViewerVisible
        }
        photos={photos}
        initialIndex={
          selectedPhotoIndex
        }
        onClose={() =>
          setPhotoViewerVisible(
            false
          )
        }
      />

      {/* DATE & TIME PICKER */}

      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDatePickerVisible(false);
          setDatePickerTarget(null);
          setDatePickerStep("date");
        }}
      >
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerCard}>
            <View style={styles.datePickerHeader}>
              <View>
                <Text style={styles.datePickerTitle}>
                  {datePickerStep === "date"
                    ? "Select Date"
                    : "Select Time"}
                </Text>

                <Text style={styles.datePickerSubtitle}>
                  {datePickerTarget === "claim"
                    ? "Claim Intimation"
                    : "Survey Date & Time"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.datePickerClose}
                onPress={() => {
                  setDatePickerVisible(false);
                  setDatePickerTarget(null);
                  setDatePickerStep("date");
                }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <DateTimePicker
              value={datePickerValue}
              mode={datePickerStep}
              display="default"
              onChange={handleDatePickerChange}
            />

            <Text style={styles.datePickerHint}>
              {datePickerStep === "date"
                ? "Choose the date to continue to time."
                : "Choose the time to save the date and time."}
            </Text>
          </View>
        </View>
      </Modal>

      {/* INSURANCE DROPDOWN */}

      <Modal
        visible={
          insuranceDropdownVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setInsuranceDropdownVisible(
            false
          )
        }
      >
        <TouchableOpacity
          style={
            styles.dropdownOverlay
          }
          activeOpacity={1}
          onPress={() =>
            setInsuranceDropdownVisible(
              false
            )
          }
        >
          <View
            style={
              styles.dropdownModal
            }
          >
            <Text
              style={
                styles.dropdownTitle
              }
            >
              Select Insurance Company
            </Text>

            {insuranceCompanies.length ===
            0 ? (
              <Text
                style={
                  styles.noInsuranceText
                }
              >
                No insurance companies available.
              </Text>
            ) : (
              insuranceCompanies.map(
                (company) => (
                  <TouchableOpacity
                    key={
                      company.id
                    }
                    style={
                      styles.companyOption
                    }
                    onPress={() => {
                      setSelectedInsuranceCompany(
                        company.id
                      );

                      setInsuranceDropdownVisible(
                        false
                      );
                    }}
                  >
                    <Text
                      style={
                        styles.companyText
                      }
                    >
                      {
                        company.name
                      }
                    </Text>

                    {selectedInsuranceCompany ===
                      company.id && (
                      <Ionicons
                        name="checkmark"
                        size={21}
                        color={
                          colors.primary
                        }
                      />
                    )}
                  </TouchableOpacity>
                )
              )
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* GENERAL MODAL */}

      <Modal
        visible={
          modalVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalIcon
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={29}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.modalTitle
              }
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
              onPress={() => {
                setModalVisible(
                  false
                );

                if (
                  modalTitle ===
                  "Survey Submitted"
                ) {
                  router.back();
                }
              }}
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
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text
        style={
          styles.infoLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.infoValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  content: {
    padding:
      spacing.lg,
    paddingBottom:
      spacing.xxl,
  },

  header: {
    flexDirection:
      "row",
    alignItems:
      "center",
    marginBottom:
      spacing.xl,
  },

  headerBack: {
    width: 44,
    height: 44,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.border,
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  headerText: {
    marginLeft:
      spacing.md,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.body,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  card: {
    backgroundColor:
      colors.surface,
    borderRadius:
      radius.lg,
    padding:
      spacing.lg,
    borderWidth: 1,
    borderColor:
      colors.border,
    marginBottom:
      spacing.md,
  },

  cardHeader: {
    flexDirection:
      "row",
    alignItems:
      "center",
    marginBottom:
      spacing.lg,
  },

  cardIcon: {
    width: 42,
    height: 42,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primaryLight,
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  cardTitle: {
    ...typography.subheading,
    color: colors.text,
    marginLeft:
      spacing.md,
  },

  surveyStatusBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  surveyStatusIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  surveyStatusContent: {
    flex: 1,
    marginLeft: spacing.md,
  },

  surveyStatusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },

  surveyStatusText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 3,
  },

  surveyPhotoSection: {
    marginTop: spacing.lg,
  },

  surveyPhotoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },

  surveyPhotoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  surveyPhotoCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  nextStageInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.infoLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },

  nextStageInfoContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  nextStageInfoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  nextStageInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  vehicleNumberBox: {
    flexDirection:
      "row",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    backgroundColor:
      colors.background,
    borderRadius:
      radius.md,
    padding:
      spacing.md,
    marginBottom:
      spacing.md,
  },

  vehicleNumber: {
    fontSize: 18,
    fontWeight:
      "800",
    color:
      colors.text,
  },

  pendingStatus: {
    backgroundColor:
      colors.warningLight,
    paddingHorizontal:
      9,
    paddingVertical: 5,
    borderRadius:
      radius.round,
  },

  pendingStatusText: {
    fontSize: 10,
    fontWeight:
      "700",
    color:
      colors.warning,
  },

  assignedStatus: {
    backgroundColor:
      colors.successLight,
    paddingHorizontal:
      9,
    paddingVertical: 5,
    borderRadius:
      radius.round,
  },

  assignedStatusText: {
    fontSize: 10,
    fontWeight:
      "700",
    color:
      colors.success,
  },

  infoRow: {
    flexDirection:
      "row",
    paddingVertical:
      spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor:
      colors.divider,
  },

  infoLabel: {
    width: 125,
    fontSize: 13,
    color:
      colors.textSecondary,
  },

  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight:
      "600",
    color:
      colors.text,
  },

  /* LOCK CARD */

  lockCard: {
    backgroundColor:
      colors.warningLight,
    borderRadius:
      radius.lg,
    padding:
      spacing.xl,
    borderWidth: 1,
    borderColor:
      "#FDE68A",
    marginBottom:
      spacing.md,
    alignItems:
      "center",
  },

  lockIcon: {
    width: 58,
    height: 58,
    borderRadius:
      radius.round,
    backgroundColor:
      colors.surface,
    alignItems:
      "center",
    justifyContent:
      "center",
    marginBottom:
      spacing.md,
  },

  lockTitle: {
    fontSize: 17,
    fontWeight:
      "700",
    color:
      colors.text,
    textAlign:
      "center",
  },

  lockText: {
    fontSize: 13,
    lineHeight: 20,
    color:
      colors.textSecondary,
    textAlign:
      "center",
    marginTop:
      spacing.sm,
  },

  takeButton: {
    width: "100%",
    height: 48,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primary,
    flexDirection:
      "row",
    alignItems:
      "center",
    justifyContent:
      "center",
    gap: 8,
    marginTop:
      spacing.lg,
  },

  takeButtonDisabled: {
    opacity: 0.7,
  },

  takeButtonText: {
    color:
      colors.white,
    fontSize: 14,
    fontWeight:
      "700",
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight:
      "700",
    color:
      colors.text,
    marginTop:
      spacing.md,
    marginBottom:
      spacing.sm,
  },

  jobTypeRow: {
    flexDirection:
      "row",
    gap:
      spacing.sm,
  },

  jobTypeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius:
      radius.md,
    borderWidth: 1,
    borderColor:
      colors.primary,
    flexDirection:
      "row",
    alignItems:
      "center",
    justifyContent:
      "center",
    gap: 7,
  },

  jobTypeButtonSelected: {
    backgroundColor:
      colors.primary,
  },

  jobTypeText: {
    fontSize: 14,
    fontWeight:
      "700",
    color:
      colors.primary,
  },

  jobTypeTextSelected: {
    color:
      colors.white,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius:
      radius.md,
    paddingHorizontal:
      spacing.md,
    backgroundColor:
      colors.surface,
    color:
      colors.text,
    fontSize: 14,
  },

  textArea: {
    height: 100,
    paddingTop:
      spacing.md,
  },

  dateTimeButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateTimeText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginRight: spacing.sm,
  },

  helperText: {
    fontSize: 11,
    color:
      colors.textSecondary,
    marginTop: 5,
  },

  dropdown: {
    height: 48,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius:
      radius.md,
    paddingHorizontal:
      spacing.md,
    flexDirection:
      "row",
    alignItems:
      "center",
    justifyContent:
      "space-between",
  },

  dropdownText: {
    fontSize: 14,
    color:
      colors.text,
  },

  placeholderText: {
    color:
      colors.textLight,
  },

  submitButton: {
    height: 52,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primary,
    flexDirection:
      "row",
    alignItems:
      "center",
    justifyContent:
      "center",
    gap: 8,
    marginTop:
      spacing.sm,
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitButtonText: {
    color:
      colors.white,
    fontSize: 15,
    fontWeight:
      "700",
  },

  bottomSpace: {
    height: 20,
  },

  loadingContainer: {
    flex: 1,
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  loadingText: {
    fontSize: 14,
    color:
      colors.textSecondary,
    marginTop:
      spacing.md,
  },

  emptyContainer: {
    flex: 1,
    alignItems:
      "center",
    justifyContent:
      "center",
    padding:
      spacing.xl,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight:
      "700",
    color:
      colors.text,
    marginTop:
      spacing.md,
  },

  backButton: {
    height: 46,
    paddingHorizontal:
      spacing.xl,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primary,
    alignItems:
      "center",
    justifyContent:
      "center",
    marginTop:
      spacing.lg,
  },

  backButtonText: {
    color:
      colors.white,
    fontSize: 14,
    fontWeight:
      "700",
  },

  datePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  datePickerCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
  },

  datePickerHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },

  datePickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },

  datePickerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },

  datePickerClose: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },

  datePickerHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },

  dropdownOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    justifyContent:
      "center",
    padding:
      spacing.xl,
  },

  dropdownModal: {
    backgroundColor:
      colors.surface,
    borderRadius:
      radius.xl,
    padding:
      spacing.lg,
  },

  dropdownTitle: {
    fontSize: 18,
    fontWeight:
      "700",
    color:
      colors.text,
    marginBottom:
      spacing.md,
  },

  companyOption: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor:
      colors.divider,
    flexDirection:
      "row",
    alignItems:
      "center",
    justifyContent:
      "space-between",
  },

  companyText: {
    fontSize: 14,
    color:
      colors.text,
    fontWeight:
      "500",
  },

  noInsuranceText: {
    fontSize: 14,
    color:
      colors.textSecondary,
    paddingVertical:
      spacing.md,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    alignItems:
      "center",
    justifyContent:
      "center",
    padding:
      spacing.xl,
  },

  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor:
      colors.surface,
    borderRadius:
      radius.xl,
    padding:
      spacing.xl,
    alignItems:
      "center",
  },

  modalIcon: {
    width: 58,
    height: 58,
    borderRadius:
      radius.round,
    backgroundColor:
      colors.primaryLight,
    alignItems:
      "center",
    justifyContent:
      "center",
    marginBottom:
      spacing.md,
  },

  modalTitle: {
    fontSize: 19,
    fontWeight:
      "700",
    color:
      colors.text,
    textAlign:
      "center",
  },

  modalMessage: {
    fontSize: 14,
    color:
      colors.textSecondary,
    textAlign:
      "center",
    lineHeight: 20,
    marginTop:
      spacing.sm,
  },

  modalButton: {
    width: "100%",
    height: 46,
    borderRadius:
      radius.md,
    backgroundColor:
      colors.primary,
    alignItems:
      "center",
    justifyContent:
      "center",
    marginTop:
      spacing.lg,
  },

  modalButtonText: {
    color:
      colors.white,
    fontSize: 14,
    fontWeight:
      "700",
  },
});