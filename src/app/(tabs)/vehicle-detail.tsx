import { Modal, ScrollView } from "../../components/inputs/KeyboardAware";
import BackButton from "../../components/navigation/BackButton";
import { returnToRoute, useHardwareBack } from "../../lib/back-navigation";

import Ionicons from "@expo/vector-icons/Ionicons";

import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PhotoViewer from "../../../components/PhotoViewer";
import AssignedAdvisor from "../../../components/workflow/AssignedAdvisor";
import CustomerInformation from "../../../components/workflow/CustomerInformation";
import SurveySubmittedStage from "../../../components/workflow/SurveySubmittedStage";
import VehicleInformation from "../../../components/workflow/VehicleInformation";
import { supabase } from "../../../lib/supabase";
import { getCurrentWorkflowRoute } from "../../lib/workflow-route";
import { colors, radius, spacing, typography } from "../../theme";

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

type FloorIncharge = {
  id: string;
  name: string | null;
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
  approval_by_type: string | null;
  approval_at: string | null;
  approval_remarks: string | null;
  partial_approval_choice: string | null;
  customer_approval_at: string | null;
  paid_job_remarks: string | null;
  advisor_remarks: string | null;
  current_job_stage: string;
  floor_incharge_id: string | null;
  floor_assigned_at: string | null;
  floor_assigned_by: string | null;
  created_at: string;
  updated_at: string;
};

type PhotoItem = {
  id: string;
  uri: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
  progress?: number;
  storagePath?: string;
};

export default function VehicleDetailScreen() {
  const handleNavigationBack = () => {
    returnToRoute("/(tabs)/vehicles");
  };
  useHardwareBack(handleNavigationBack);

  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicleId = params.vehicleId;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [advisor, setAdvisor] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [insuranceCompanies, setInsuranceCompanies] = useState<
    InsuranceCompany[]
  >([]);
  const [selectedInsuranceCompany, setSelectedInsuranceCompany] = useState<
    string | null
  >(null);

  const [surveyJob, setSurveyJob] = useState<VehicleJob | null>(null);

  // Floor Incharge assignment state
  const [floorIncharges, setFloorIncharges] = useState<FloorIncharge[]>([]);
  const [selectedFloorInchargeId, setSelectedFloorInchargeId] = useState<
    string | null
  >(null);
  const [floorDropdownVisible, setFloorDropdownVisible] = useState(false);
  const [assigningFloorIncharge, setAssigningFloorIncharge] = useState(false);
  const floorAssignmentBusy = useRef(false);

  const [loading, setLoading] = useState(true);
  const [takingVehicle, setTakingVehicle] = useState(false);

  const [jobType, setJobType] = useState<"INSURANCE" | "PAID" | null>(null);
  const [jobCardNo, setJobCardNo] = useState("");
  const [estimateId, setEstimateId] = useState("");
  const [claimNo, setClaimNo] = useState("");
  const [claimIntimationAt, setClaimIntimationAt] = useState("");
  const [surveyAt, setSurveyAt] = useState("");






  const [customerApprovalAt, setCustomerApprovalAt] = useState("");
  const [paidJobRemarks, setPaidJobRemarks] = useState("");
  const [advisorRemarks, setAdvisorRemarks] = useState("");

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const [deleteConfirmationVisible, setDeleteConfirmationVisible] =
    useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<PhotoItem | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [insuranceDropdownVisible, setInsuranceDropdownVisible] =
    useState(false);

  function showModal(title: string, message: string) {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  const loadSurveyPhotos = async (targetVehicleId: string) => {
    try {
      const { data, error } = await supabase
        .from("vehicle_photos")
        .select("id, storage_path, photo_type")
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
        const { data: signedData, error: signedError } = await supabase.storage
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

  const handleDeleteUploadedPhoto = (photo: PhotoItem) => {
    if (currentUserRole !== "ceo_admin") {
      showModal(
        "Permission Denied",
        "Only CEO Admin can delete uploaded survey photos."
      );
      return;
    }

    if (photo.status !== "uploaded" || !photo.storagePath) {
      showModal(
        "Unable to Delete Photo",
        "This photo is not a valid uploaded survey photo."
      );
      return;
    }

    setPhotoToDelete(photo);
    setDeleteConfirmationVisible(true);
  };

  const confirmDeleteUploadedPhoto = async () => {
    if (!photoToDelete || !vehicleId || deletingPhoto) return;

    const photo = photoToDelete;

    try {
      setDeletingPhoto(true);

      const { error: storageError } = await supabase.storage
        .from("vehicle-photos")
        .remove([photo.storagePath!]);

      if (storageError) throw storageError;

      const { error: databaseError } = await supabase
        .from("vehicle_photos")
        .delete()
        .eq("id", photo.id);

      if (databaseError) {
        console.error("Photo metadata deletion error:", databaseError);

        setDeleteConfirmationVisible(false);
        setPhotoToDelete(null);

        showModal(
          "Photo Partially Deleted",
          "The photo file was removed from storage, but its database record could not be deleted. Please contact your administrator to resolve this."
        );

        await loadSurveyPhotos(vehicleId);
        return;
      }

      setDeleteConfirmationVisible(false);
      setPhotoToDelete(null);

      await loadSurveyPhotos(vehicleId);

      showModal(
        "Photo Deleted",
        "The survey photo has been deleted successfully."
      );
    } catch (error: any) {
      console.error("Delete survey photo error:", error);

      setDeleteConfirmationVisible(false);
      setPhotoToDelete(null);

      showModal(
        "Unable to Delete Photo",
        error?.message ||
          "Something went wrong while deleting the survey photo."
      );
    } finally {
      setDeletingPhoto(false);
    }
  };

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) {
      showModal("Vehicle Not Found", "Vehicle ID was not provided.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User session not found.");
      }

      setCurrentUserId(user.id);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentUserRole(profileData.role);

      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .select(
          `
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
        `
        )
        .eq("id", vehicleId)
        .single();

      if (vehicleError) throw vehicleError;

      setVehicle(vehicleData);

      const { data: insuranceData, error: insuranceError } = await supabase
        .from("insurance_companies")
        .select("id, name")
        .order("name", { ascending: true });

      if (insuranceError) throw insuranceError;
      setInsuranceCompanies(insuranceData ?? []);

      // Load active Floor Incharges for the assignment dropdown
      const { data: floorInchargeData, error: floorInchargeError } =
        await supabase
          .from("profiles")
          .select("id, name")
          .eq("role", "floor_incharge")
          .eq("is_active", true)
          .order("name", { ascending: true });

      if (floorInchargeError) throw floorInchargeError;
      setFloorIncharges(floorInchargeData ?? []);

      const { data: jobData, error: jobError } = await supabase
        .from("vehicle_jobs")
        .select(
          `
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
          approval_by_type,
          approval_at,
          approval_remarks,
          partial_approval_choice,
          customer_approval_at,
          paid_job_remarks,
          advisor_remarks,
          current_job_stage,
          floor_incharge_id,
          floor_assigned_at,
          floor_assigned_by,
          created_at,
          updated_at
        `
        )
        .eq("vehicle_id", vehicleId)
        .neq("current_job_stage", "CLOSED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jobError) throw jobError;

      const advisorId = jobData?.advisor_id ||
        (vehicleData.current_stage === "ADVISOR_ASSIGNED" ? vehicleData.current_assigned_to : null);
      if (advisorId) {
        const { data: advisorData, error: advisorError } = await supabase.from("profiles")
          .select("id, name, role").eq("id", advisorId).eq("role", "advisor").maybeSingle();
        if (advisorError) throw advisorError;
        setAdvisor(advisorData);
      } else setAdvisor(null);
      setSurveyJob(jobData ?? null);
      setSelectedFloorInchargeId(jobData?.floor_incharge_id ?? null);

      if (jobData) {
        await loadSurveyPhotos(vehicleData.id);
      } else {
        setPhotos([]);
      }
    } catch (error: any) {
      console.error("Vehicle details error:", error);
      showModal(
        "Unable to Load Vehicle",
        error?.message || "Something went wrong while loading vehicle details."
      );
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  const isAssignedAdvisor =
    !!vehicle &&
    !!currentUserId &&
    vehicle.current_stage === "ADVISOR_ASSIGNED" &&
    vehicle.current_assigned_to === currentUserId;

  const isPendingAdvisor = vehicle?.current_stage === "PENDING_ADVISOR";


  const isLaterWorkflowStage =
    !!vehicle &&
    !["PENDING_ADVISOR", "ADVISOR_ASSIGNED", "SURVEY"].includes(
      vehicle.current_stage
    );

  // Only the assigned Advisor or a CEO Admin can assign/update the Floor Incharge.
  const canAssignFloorIncharge =
    !!vehicle &&
    !!surveyJob &&
    vehicle.current_stage === "FLOOR" &&
    surveyJob.current_job_stage === "FLOOR" &&
    ["PENDING", "IN_PROGRESS"].includes(vehicle.current_status) &&
    (currentUserRole === "ceo_admin" ||
      (currentUserRole === "advisor" &&
        surveyJob.advisor_id === currentUserId));

  const selectedFloorIncharge = floorIncharges.find(
    (person) => person.id === selectedFloorInchargeId
  );

  const assignedFloorIncharge = floorIncharges.find(
    (person) => person.id === surveyJob?.floor_incharge_id
  );

  const handleAssignFloorIncharge = async () => {
    if (floorAssignmentBusy.current) return;
    if (!vehicleId || !surveyJob || !selectedFloorInchargeId) {
      showModal(
        "Floor Incharge Required",
        "Please select a Floor Incharge before assigning."
      );
      return;
    }

    if (!canAssignFloorIncharge) {
      showModal(
        "Permission Denied",
        "Only the assigned Advisor or a CEO Admin can assign a Floor Incharge to this vehicle."
      );
      return;
    }

    try {
      floorAssignmentBusy.current = true;
      setAssigningFloorIncharge(true);

      const { data, error } = await supabase.rpc("assign_floor_incharge", {
        p_vehicle_id: vehicleId,
        p_floor_incharge_id: selectedFloorInchargeId,
        p_remarks: null,
      });

      if (error) throw error;
      if (data?.success !== true) throw new Error("The assignment could not be confirmed. Refresh before trying again.");

      showModal(
        "Floor Incharge Assigned",
        "The Floor Incharge has been assigned successfully."
      );

      await loadVehicle();
    } catch (error: any) {
      console.error("Assign Floor Incharge error:", error);
      showModal(
        "Unable to Assign Floor Incharge",
        error?.message ||
          "Something went wrong while assigning the Floor Incharge."
      );
    } finally {
      floorAssignmentBusy.current = false;
      setAssigningFloorIncharge(false);
    }
  };

  const handleOpenWorkflow = async (intakeOnly = false) => {
    if (!vehicleId || takingVehicle) return;
    try {
      setTakingVehicle(true);
      const target = await getCurrentWorkflowRoute(vehicleId, intakeOnly);
      router.push({ ...target, params: { ...target.params, returnTo: "vehicle-detail" } });
    } catch (error: any) {
      showModal("Unable to Open Workflow", error?.message || "Please refresh and try again.");
    } finally {
      setTakingVehicle(false);
    }
  };

  const formatDateTime = (date: Date) =>
    date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const formatSavedDateTime = (value: string | null | undefined) => {
    if (!value) return "Not assigned";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Not available";

    return formatDateTime(parsed);
  };





  const getPickerLabel = (value: string, placeholder: string) => {
    if (!value) return placeholder;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return placeholder;

    return formatDateTime(parsed);
  };

  const openPhotoViewer = (photo: PhotoItem) => {
    const index = photos.findIndex((item) => item.id === photo.id);

    if (index >= 0) {
      setSelectedPhotoIndex(index);
      setPhotoViewerVisible(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading vehicle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={42} color={colors.textLight} />
          <Text style={styles.emptyTitle}>Vehicle not found</Text>
          <BackButton onPress={handleNavigationBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <BackButton onPress={handleNavigationBack} />

          <View style={styles.headerText}>
            <Text style={styles.title}>Vehicle Details</Text>
            <Text style={styles.subtitle}>Advisor Survey</Text>
          </View>
        </View>

        {/* VEHICLE INFORMATION */}
        <VehicleInformation vehicle={vehicle} />

        {/* CUSTOMER */}
        <CustomerInformation vehicle={vehicle} />

        {/* ADVISOR */}
        <AssignedAdvisor
          advisorName={advisor?.name ?? null}
          advisorRole={advisor?.role ?? null}
        />

        {/* PENDING ADVISOR LOCK */}
        {isPendingAdvisor && (
          <View style={styles.lockCard}>
            <View style={styles.lockIcon}>
              <Ionicons
                name="lock-closed-outline"
                size={28}
                color={colors.warning}
              />
            </View>

            <Text style={styles.lockTitle}>Vehicle Not Assigned</Text>
            <Text style={styles.lockText}>
              This vehicle is waiting for an advisor. Take the vehicle first
              before filling the survey details.
            </Text>

            {["advisor", "ceo_admin"].includes(currentUserRole ?? "") && (
              <TouchableOpacity
                style={[
                  styles.takeButton,
                  takingVehicle && styles.takeButtonDisabled,
                ]}
                onPress={() => handleOpenWorkflow(true)}
                disabled={takingVehicle}
                activeOpacity={0.8}
              >
                {takingVehicle ? (
                  <>
                    <ActivityIndicator size="small" color={colors.white} />
                    <Text style={styles.takeButtonText}>Opening...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="hand-left-outline"
                      size={19}
                      color={colors.white}
                    />
                    <Text style={styles.takeButtonText}>Open Intake</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* WRONG ADVISOR LOCK */}
        {vehicle.current_stage === "ADVISOR_ASSIGNED" &&
          currentUserRole === "advisor" && !isAssignedAdvisor &&
          (
            <View style={styles.lockCard}>
              <View style={styles.lockIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={28}
                  color={colors.warning}
                />
              </View>

              <Text style={styles.lockTitle}>
                Vehicle Assigned to Another Advisor
              </Text>
              <Text style={styles.lockText}>
                This vehicle has already been taken by another advisor. You
                cannot edit or submit the survey.
              </Text>
            </View>
          )}

        {/* SURVEY DETAILS - REMAIN VISIBLE AFTER SURVEY */}
        {surveyJob && (
          <SurveySubmittedStage
            surveyJob={surveyJob}
            insuranceCompanies={insuranceCompanies}
            photos={photos}
            formatDateTime={formatDateTime}
            onViewPhoto={openPhotoViewer}
            canDeletePhotos={currentUserRole === "ceo_admin"}
            onDeletePhoto={handleDeleteUploadedPhoto}
          />
        )}

        {/* Visit-based workflow entry; vehicle details remain on this screen. */}
        {!isPendingAdvisor && ["advisor", "ceo_admin"].includes(currentUserRole ?? "") && (
          <View style={styles.lockCard}>
            <Text style={styles.lockTitle}>Current Workflow</Text>
            <Text style={styles.lockText}>
              Open the current Intake, Survey, Approval or Approval Hold screen.
              The active workshop visit determines the available action.
            </Text>
            <TouchableOpacity
              style={[styles.takeButton, takingVehicle && styles.takeButtonDisabled]}
              onPress={() => handleOpenWorkflow()}
              disabled={takingVehicle}
              activeOpacity={0.8}
            >
              <Text style={styles.takeButtonText}>
                {takingVehicle ? "Opening..." : "Open Current Workflow"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FLOOR INCHARGE ASSIGNMENT */}
        {canAssignFloorIncharge && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name="people-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.cardTitle}>Floor Incharge Assignment</Text>
            </View>

            <Text style={styles.fieldLabel}>Selected Floor Incharge</Text>

            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setFloorDropdownVisible(true)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !selectedFloorIncharge && styles.placeholderText,
                ]}
              >
                {selectedFloorIncharge?.name ||
                  (selectedFloorInchargeId
                    ? "Current assignment selected"
                    : "Select Floor Incharge")}
              </Text>

              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {surveyJob.floor_incharge_id ? (
              <View style={styles.floorAssignedBox}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.success}
                />
                <View style={styles.floorAssignedContent}>
                  <Text style={styles.floorAssignedTitle}>
                    Current Floor Incharge
                  </Text>
                  <Text style={styles.floorAssignedName}>
                    {assignedFloorIncharge?.name ||
                      "Assigned Floor Incharge"}
                  </Text>
                  <Text style={styles.floorAssignedDate}>
                    Assigned on:{" "}
                    {formatSavedDateTime(surveyJob.floor_assigned_at)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.helperText}>
                No Floor Incharge has been assigned to this vehicle yet.
              </Text>
            )}

            {floorIncharges.length === 0 && (
              <Text style={styles.noInsuranceText}>
                No active Floor Incharges are available.
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (assigningFloorIncharge ||
                  !selectedFloorInchargeId ||
                  floorIncharges.length === 0) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleAssignFloorIncharge}
              disabled={
                assigningFloorIncharge ||
                !selectedFloorInchargeId ||
                floorIncharges.length === 0
              }
              activeOpacity={0.8}
            >
              {assigningFloorIncharge ? (
                <>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.submitButtonText}>
                    Saving Assignment...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color={colors.white}
                  />
                  <Text style={styles.submitButtonText}>
                    {surveyJob.floor_incharge_id
                      ? "Update Floor Incharge"
                      : "Assign Floor Incharge"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
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

            <Text style={styles.lockTitle}>Survey Locked</Text>
            <Text style={styles.lockText}>
              This vehicle has already moved beyond the Survey stage. Survey
              details can no longer be edited here.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* PHOTO VIEWER */}
      <PhotoViewer
        visible={photoViewerVisible}
        photos={photos}
        initialIndex={selectedPhotoIndex}
        onClose={() => setPhotoViewerVisible(false)}
      />

      {/* DATE & TIME PICKER */}


      {/* INSURANCE DROPDOWN */}
      <Modal
        visible={insuranceDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsuranceDropdownVisible(false)}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setInsuranceDropdownVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownTitle}>Select Insurance Company</Text>

            {insuranceCompanies.length === 0 ? (
              <Text style={styles.noInsuranceText}>
                No insurance companies available.
              </Text>
            ) : (
              insuranceCompanies.map((company) => (
                <TouchableOpacity
                  key={company.id}
                  style={styles.companyOption}
                  onPress={() => {
                    setSelectedInsuranceCompany(company.id);
                    setInsuranceDropdownVisible(false);
                  }}
                >
                  <Text style={styles.companyText}>{company.name}</Text>

                  {selectedInsuranceCompany === company.id && (
                    <Ionicons
                      name="checkmark"
                      size={21}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* FLOOR INCHARGE DROPDOWN */}
      <Modal
        visible={floorDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFloorDropdownVisible(false)}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setFloorDropdownVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownTitle}>Select Floor Incharge</Text>

            {floorIncharges.length === 0 ? (
              <Text style={styles.noInsuranceText}>
                No active Floor Incharges are available.
              </Text>
            ) : (
              <ScrollView
                style={styles.floorOptionsList}
                showsVerticalScrollIndicator
              >
                {floorIncharges.map((person) => (
                  <TouchableOpacity
                    key={person.id}
                    style={styles.companyOption}
                    onPress={() => {
                      setSelectedFloorInchargeId(person.id);
                      setFloorDropdownVisible(false);
                    }}
                  >
                    <Text style={styles.companyText}>
                      {person.name || "Unnamed Floor Incharge"}
                    </Text>

                    {selectedFloorInchargeId === person.id && (
                      <Ionicons
                        name="checkmark"
                        size={21}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setFloorDropdownVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* DELETE PHOTO CONFIRMATION */}
      <Modal
        visible={deleteConfirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (deletingPhoto) return;
          setDeleteConfirmationVisible(false);
          setPhotoToDelete(null);
        }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="trash-outline" size={29} color="#DC2626" />
            </View>

            <Text style={styles.modalTitle}>Delete Survey Photo?</Text>

            <Text style={styles.modalMessage}>
              Are you sure you want to permanently delete this uploaded survey
              photo? This action cannot be undone.
            </Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                disabled={deletingPhoto}
                onPress={() => {
                  setDeleteConfirmationVisible(false);
                  setPhotoToDelete(null);
                }}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.deleteConfirmButton,
                  deletingPhoto && styles.deleteButtonDisabled,
                ]}
                disabled={deletingPhoto}
                onPress={confirmDeleteUploadedPhoto}
              >
                {deletingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </SafeAreaView>
      </Modal>

      {/* GENERAL MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons
                name="information-circle-outline"
                size={29}
                color={colors.primary}
              />
            </View>

            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setModalVisible(false);

                if (modalTitle === "Survey Submitted") {
                  router.back();
                }
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  headerBack: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    marginLeft: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.text,
    marginLeft: spacing.md,
    flexShrink: 1,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  vehicleNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  pendingStatus: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  pendingStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.warning,
  },
  assignedStatus: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  assignedStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.success,
  },
  infoRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    width: 125,
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  lockCard: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: spacing.md,
    alignItems: "center",
  },
  lockIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  lockTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  lockText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  takeButton: {
    width: "100%",
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.lg,
  },
  takeButtonDisabled: {
    opacity: 0.7,
  },
  takeButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  jobTypeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  jobTypeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  jobTypeButtonSelected: {
    backgroundColor: colors.primary,
  },
  jobTypeText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  jobTypeTextSelected: {
    color: colors.white,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    paddingTop: spacing.md,
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
    color: colors.textSecondary,
    marginTop: 5,
  },
  dropdown: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginRight: spacing.sm,
  },
  placeholderText: {
    color: colors.textLight,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  floorAssignedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  floorAssignedContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  floorAssignedTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  floorAssignedName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 3,
  },
  floorAssignedDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  floorOptionsList: {
    maxHeight: 360,
  },
  bottomSpace: {
    height: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
  },
  backButton: {
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dropdownModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  companyOption: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  companyText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
    marginRight: spacing.sm,
  },
  noInsuranceText: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingVertical: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
  },
  modalIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  modalButton: {
    width: "100%",
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  modalButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  deleteActions: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  deleteCancelButton: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  deleteConfirmButton: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  deleteButtonDisabled: {
    opacity: 0.65,
  },
});