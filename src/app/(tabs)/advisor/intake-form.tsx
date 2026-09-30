import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import IntakeCustomerSection from "./components/intake/IntakeCustomerSection";
import { IntakeDocumentSection } from "./components/intake/IntakeDocumentSection";
import { IntakeJobDetailsSection } from "./components/intake/IntakeJobDetailsSection";
import { IntakeJobTypeSection } from "./components/intake/IntakeJobTypeSection";
import { IntakePhotoSection } from "./components/intake/IntakePhotoSection";
import { IntakeSaveSection } from "./components/intake/IntakeSaveSection";
import {
  DropdownModal,
  PhotoViewerModal,
  PopupModal
} from "./components/intake/IntakeUI";
import { IntakeVehicleModelSection } from "./components/intake/IntakeVehicleModelSection";
import IntakeVehicleSection from "./components/intake/IntakeVehicleSection";
import { IntakeVehicleTypeSection } from "./components/intake/IntakeVehicleTypeSection";
import { IntakeWorkerGroupSection } from "./components/intake/IntakeWorkerGroupSection";

import { supabase } from "../../../../lib/supabase";
import {
  colors,
  spacing,
  typography,
} from "../../../theme";
import {
  loadDocuments,
  loadInitialData,
} from "./components/intake/intake.data";
import {
  deleteIntakePhoto,
  loadGateInPhoto,
  loadIntakePhotos,
  uploadLocalPhoto,
} from "./components/intake/intake.photos";

import type {
  ChecklistState,
  DocumentMaster,
  DropdownType,
  InsuranceCompany,
  JobType,
  MiMaster,
  MiType,
  PhotoItem,
  PopupState,
  PopupType,
  VehicleModel,
  VehicleRecord,
  VehicleType,
  VisitRecord,
  WorkerGroup,
} from "./components/intake/intake.types";
import {
  formatDateTime,
  isRequiredDocument,
  MAX_MOBILE_LENGTH,
  normalizeMobile,
  normalizeVehicleNumber,
  validateVehicleIntake
} from "./components/intake/intake.validation";

function showPopup(
  type: PopupType,
  title: string,
  message: string,
  actionLabel = "OK"
): PopupState {
  return {
    visible: true,
    type,
    title,
    message,
    actionLabel,
  };
}

export default function AdvisorIntakeFormScreen() {
  const params =
    useLocalSearchParams<{
      visitId?: string | string[];
      vehicleId?: string | string[];
      mode?: string | string[];
    }>();

  const visitId = Array.isArray(params.visitId)
    ? params.visitId[0]
    : params.visitId;

  const vehicleId = Array.isArray(params.vehicleId)
    ? params.vehicleId[0]
    : params.vehicleId;

  const mode = Array.isArray(params.mode)
    ? params.mode[0]
    : params.mode;

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string>("");

  const [isAdmin, setIsAdmin] = useState(false);

  const [visit, setVisit] =
    useState<VisitRecord | null>(null);

  const [vehicle, setVehicle] =
    useState<VehicleRecord | null>(null);

  const [gateInAt, setGateInAt] =
    useState<string | null>(null);

  const [gateInPhoto, setGateInPhoto] =
    useState<PhotoItem | null>(null);

  const [intakePhotos, setIntakePhotos] =
    useState<PhotoItem[]>([]);

  const [photoViewerUri, setPhotoViewerUri] =
    useState<string | null>(null);

  const [customerName, setCustomerName] =
    useState("");

  const [customerMobile, setCustomerMobile] =
    useState("");

  const [jobType, setJobType] =
    useState<JobType>("PAID");

  const [miType, setMiType] =
    useState<MiType>("MI");

  const [workerGroup, setWorkerGroup] =
    useState<WorkerGroup>("CNT");

  const [vehicleType, setVehicleType] =
    useState<VehicleType>("PRIVATE");

  const [arenaNexa, setArenaNexa] =
    useState<string>("");

  const [selectedModelId, setSelectedModelId] =
    useState<string>("");

  const [
    selectedInsuranceId,
    setSelectedInsuranceId,
  ] = useState<string>("");

  const [
    selectedMiTypeId,
    setSelectedMiTypeId,
  ] = useState<string>("");

  const [jobCardNo, setJobCardNo] =
    useState("");

  const [advisorRemarks, setAdvisorRemarks] =
    useState("");

  const [vehicleModels, setVehicleModels] =
    useState<VehicleModel[]>([]);

  const [
    insuranceCompanies,
    setInsuranceCompanies,
  ] = useState<InsuranceCompany[]>([]);

  const [miTypes, setMiTypes] =
    useState<MiMaster[]>([]);

  const [documents, setDocuments] =
    useState<DocumentMaster[]>([]);

  const [
    documentChecklist,
    setDocumentChecklist,
  ] = useState<ChecklistState>({});

  const [dropdown, setDropdown] =
    useState<DropdownType>(null);

  const [popup, setPopup] =
    useState<PopupState>({
      visible: false,
      type: "info",
      title: "",
      message: "",
      actionLabel: "OK",
    });

  const [
    pendingNavigation,
    setPendingNavigation,
  ] = useState(false);

  const selectedModel = useMemo(
    () =>
      vehicleModels.find(
        (item) =>
          item.id === selectedModelId
      ) ?? null,
    [
      vehicleModels,
      selectedModelId,
    ]
  );

  const selectedInsurance =
    useMemo(
      () =>
        insuranceCompanies.find(
          (item) =>
            item.id ===
            selectedInsuranceId
        ) ?? null,
      [
        insuranceCompanies,
        selectedInsuranceId,
      ]
    );

  const selectedMiMaster =
    useMemo(
      () =>
        miTypes.find(
          (item) =>
            item.id ===
            selectedMiTypeId
        ) ?? null,
      [
        miTypes,
        selectedMiTypeId,
      ]
    );

  const currentDocuments = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.vehicle_type
            ?.trim()
            .toUpperCase() ===
          vehicleType
      ),
    [documents, vehicleType]
  );

  const requiredDocuments =
    useMemo(
      () =>
        currentDocuments.filter(
          isRequiredDocument
        ),
      [currentDocuments]
    );

  const completedRequiredDocuments =
    useMemo(
      () =>
        requiredDocuments.filter(
          (document) =>
            documentChecklist[
              document.id
            ] === true
        ).length,
      [
        requiredDocuments,
        documentChecklist,
      ]
    );

  const closePopup = useCallback(() => {
    setPopup((current) => ({
      ...current,
      visible: false,
    }));

    if (pendingNavigation) {
      setPendingNavigation(false);
      router.back();
    }
  }, [pendingNavigation]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const data = await loadInitialData(
        visitId,
        vehicleId
      );

      if (!data) return;

      setUserId(data.userId);
      setIsAdmin(data.isAdmin);
      setVisit(data.visit);
      setVehicle(data.vehicle);

      setCustomerName(
        data.vehicle.customer_name ?? ""
      );

      setCustomerMobile(
        data.customerMobile
      );

      setJobCardNo(
        data.vehicle.jc_no ?? ""
      );

      setVehicleType(data.vehicleType);

      if (data.vehicle.arena_nexa) {
        setArenaNexa(
          data.vehicle.arena_nexa
            .trim()
            .toUpperCase()
        );
      }

      setVehicleModels(
        data.masterData.models
      );

      setInsuranceCompanies(
        data.masterData.insurance
      );

      setMiTypes(data.masterData.mi);

      if (data.selectedModel) {
        setSelectedModelId(
          data.selectedModel.id
        );

        if (
          data.selectedModel.arena_nexa
        ) {
          setArenaNexa(
            data.selectedModel.arena_nexa
              .trim()
              .toUpperCase()
          );
        }
      }

      if (data.defaultMi) {
        setSelectedMiTypeId(
          data.defaultMi.id
        );
        setMiType("MI");
      }

      setDocuments(data.documents);
      setDocumentChecklist(
        data.checklist
      );

      setGateInAt(data.gateInAt);

      setGateInPhoto(
        await loadGateInPhoto(
          data.vehicle.id
        )
      );

      setIntakePhotos(
        await loadIntakePhotos(
          data.vehicle.id
        )
      );
    } catch (error: any) {
      console.error(
        "Vehicle intake form load error:",
        error
      );

      setPopup(
        showPopup(
          "error",
          "Vehicle Intake unavailable",
          error?.message ??
            "Could not load the selected vehicle."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [visitId, vehicleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (
      !selectedModelId ||
      vehicleModels.length === 0
    ) {
      return;
    }

    const exists =
      vehicleModels.some(
        (item) =>
          item.id ===
          selectedModelId
      );

    if (!exists) {
      setSelectedModelId("");
      setArenaNexa("");
    }
  }, [
    vehicleModels,
    selectedModelId,
  ]);

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    if (selectedModel.arena_nexa) {
      setArenaNexa(
        selectedModel.arena_nexa
          .trim()
          .toUpperCase()
      );
    }
  }, [selectedModel]);

  const handleVehicleTypeChange =
    async (
      value: VehicleType
    ) => {
      setVehicleType(value);

      const result =
        await loadDocuments(value);

      setDocuments(
        result.documents
      );

      setDocumentChecklist(
        result.checklist
      );
    };

  const handleJobTypeChange =
    (value: JobType) => {
      setJobType(value);

      if (value === "PAID") {
        setSelectedInsuranceId("");
        setSelectedMiTypeId("");
      } else {
        const defaultMi =
          miTypes.find(
            (item) =>
              item.code
                ?.trim()
                .toUpperCase() ===
              "MI"
          );

        if (defaultMi) {
          setSelectedMiTypeId(
            defaultMi.id
          );

          setMiType("MI");
        }
      }
    };

  const handleMiTypeChange =
    (value: MiType) => {
      setMiType(value);

      const matching =
        miTypes.find(
          (item) =>
            item.code
              ?.trim()
              .toUpperCase() ===
            value
        );

      setSelectedMiTypeId(
        matching?.id ?? ""
      );

      /*
       * Insurance Company is required for
       * both MI and NON-MI insurance jobs.
       */
    };

  const handleModelSelect =
    (id: string) => {
      const model =
        vehicleModels.find(
          (item) =>
            item.id === id
        );

      setSelectedModelId(id);

      if (model?.arena_nexa) {
        setArenaNexa(
          model.arena_nexa
            .trim()
            .toUpperCase()
        );
      } else {
        setArenaNexa("");
      }

      setDropdown(null);
    };

  const toggleDocument =
    (documentId: string) => {
      setDocumentChecklist(
        (current) => ({
          ...current,
          [documentId]:
            !current[documentId],
        })
      );
    };

  const validateForm = () =>
    validateVehicleIntake({
      vehicle,
      visit,
      customerName,
      customerMobile,
      vehicleType,
      selectedModelId,
      arenaNexa,
      jobType,
      selectedMiTypeId,
      selectedInsuranceId,
      workerGroup,
      requiredDocuments,
      documentChecklist,
      jobCardNo,
    });

  const uploadPhoto = async (
    asset: ImagePicker.ImagePickerAsset
  ) => {
    if (!vehicle) {
      throw new Error(
        "Vehicle details are unavailable."
      );
    }

    return uploadLocalPhoto(
      asset,
      vehicle.id,
      userId
    );
  };

  const chooseFromGallery =
    async () => {
      try {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (
          !permission.granted
        ) {
          setPopup(
            showPopup(
              "warning",
              "Permission required",
              "Please allow photo library access to select vehicle photos."
            )
          );

          return;
        }

        const result =
          await ImagePicker.launchImageLibraryAsync(
            {
              mediaTypes: [
                "images",
              ],
              allowsMultipleSelection:
                true,
              quality: 0.85,
            }
          );

        if (
          result.canceled ||
          result.assets.length === 0
        ) {
          return;
        }

        if (!vehicle) {
          return;
        }

        setSaving(true);

        const uploaded: PhotoItem[] =
          [];

        for (const asset of result.assets) {
          const photo =
            await uploadPhoto(asset);

          uploaded.push(photo);
        }

        setIntakePhotos(
          (current) => [
            ...current,
            ...uploaded,
          ]
        );

        /*
         * No success popup here.
         * The current photo count is already
         * displayed in the Vehicle Photos section.
         */
      } catch (error: any) {
        console.error(
          "Gallery upload error:",
          error
        );

        setPopup(
          showPopup(
            "error",
            "Photo upload failed",
            error?.message ??
              "The selected photos could not be uploaded."
          )
        );
      } finally {
        setSaving(false);
      }
    };

  const takePhoto =
    async () => {
      try {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (
          !permission.granted
        ) {
          setPopup(
            showPopup(
              "warning",
              "Permission required",
              "Please allow camera access to capture a vehicle photo."
            )
          );

          return;
        }

        const result =
          await ImagePicker.launchCameraAsync(
            {
              mediaTypes: [
                "images",
              ],
              quality: 0.85,
            }
          );

        if (
          result.canceled ||
          result.assets.length === 0
        ) {
          return;
        }

        if (!vehicle) {
          return;
        }

        setSaving(true);

        const photo =
          await uploadPhoto(
            result.assets[0]
          );

        setIntakePhotos(
          (current) => [
            ...current,
            photo,
          ]
        );

        /*
         * No success popup here.
         * The current photo count is already
         * displayed in the Vehicle Photos section.
         */
      } catch (error: any) {
        console.error(
          "Camera upload error:",
          error
        );

        setPopup(
          showPopup(
            "error",
            "Photo upload failed",
            error?.message ??
              "The captured photo could not be uploaded."
          )
        );
      } finally {
        setSaving(false);
      }
    };

      const handleRemoveIntakePhoto =
    async (photo: PhotoItem) => {
      if (saving) {
        return;
      }

      if (
        photo.photoType
          ?.trim()
          .toUpperCase() === "GATE_IN"
      ) {
        setPopup(
          showPopup(
            "warning",
            "Gate-In Photo Protected",
            "The Gate-In photo is part of the vehicle entry record and cannot be removed from Vehicle Intake."
          )
        );

        return;
      }

      try {
        setSaving(true);

        await deleteIntakePhoto(
          photo
        );

        setIntakePhotos(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                photo.id
            )
        );

        setPopup(
          showPopup(
            "success",
            "Photo Removed",
            "The vehicle intake photo has been removed successfully."
          )
        );
      } catch (error: any) {
        console.error(
          "Vehicle intake photo removal error:",
          error
        );

        setPopup(
          showPopup(
            "error",
            "Unable to Remove Photo",
            error?.message ??
              "The selected vehicle photo could not be removed."
          )
        );

        throw error;
      } finally {
        setSaving(false);
      }
    };

  const handleSave =
    async () => {
      if (saving) {
        return;
      }

      const validationError =
        validateForm();

      if (validationError) {
        setPopup(
          showPopup(
            "warning",
            "Complete Vehicle Intake",
            validationError
          )
        );

        return;
      }

      setPopup(
        showPopup(
          "info",
          "Ready to save?",
          "The vehicle intake details will be saved and the workflow will continue to the next stage."
        )
      );
    };

  const confirmSave =
    async () => {
      if (saving) {
        return;
      }

      setPopup((current) => ({
        ...current,
        visible: false,
      }));

      const validationError =
        validateForm();

      if (validationError) {
        setPopup(
          showPopup(
            "warning",
            "Complete Vehicle Intake",
            validationError
          )
        );

        return;
      }

      if (!visit || !vehicle) {
        setPopup(
          showPopup(
            "error",
            "Vehicle unavailable",
            "The selected vehicle or workshop visit could not be loaded."
          )
        );

        return;
      }

      if (!selectedModel) {
        setPopup(
          showPopup(
            "error",
            "Vehicle model unavailable",
            "Please select a valid active vehicle model."
          )
        );

        return;
      }

      try {
        setSaving(true);

        /*
         * IMPORTANT:
         * The deployed RPC signature is:
         *
         * p_visit_id
         * p_customer_name
         * p_customer_mobile
         * p_vehicle_type
         * p_vehicle_model_id
         * p_arena_nexa
         * p_insurance_type
         * p_mi_type_id
         * p_insurance_company_id
         * p_worker_group
         * p_job_card_no
         * p_advisor_remarks
         *
         * It does NOT accept p_job_type
         * and does NOT accept p_documents.
         *
         * The database creates the document checklist
         * automatically from Document Master.
         */

        const {
          data,
          error,
        } = await supabase.rpc(
          "new_workflow_save_vehicle_intake",
          {
            p_visit_id:
              visit.id,

            p_customer_name:
              customerName.trim(),

            p_customer_mobile:
              customerMobile.trim(),

            p_vehicle_type:
              vehicleType,

            p_vehicle_model_id:
              selectedModelId,

            p_arena_nexa:
              arenaNexa,

            p_insurance_type:
              jobType,

            p_mi_type_id:
              jobType ===
              "INSURANCE"
                ? selectedMiTypeId ||
                  null
                : null,

            p_insurance_company_id:
              jobType ===
              "INSURANCE"
                ? selectedInsuranceId ||
                  null
                : null,

            p_worker_group:
              workerGroup,

            p_job_card_no:
              jobCardNo.trim(),

            p_advisor_remarks:
              advisorRemarks.trim() ||
              null,
          }
        );

        if (error) {
          throw error;
        }

        console.log(
          "Vehicle intake saved:",
          data
        );

        setPendingNavigation(
          true
        );

        const returnedStage =
          typeof data?.stage === "string"
            ? data.stage
            : jobType === "INSURANCE"
              ? "CLAIM_INTIMATION"
              : "PENDING_SURVEY";

        const nextStage =
          returnedStage ===
          "CLAIM_INTIMATION"
            ? "Claim Intimation"
            : returnedStage ===
                "PENDING_SURVEY"
              ? "Survey"
              : returnedStage.replace(
                  /_/g,
                  " "
                );

        const acceptedDuringIntake =
          data?.accepted_during_intake ===
          true;

        const assignmentMessage =
          acceptedDuringIntake
            ? " The vehicle has also been assigned to you as the Advisor."
            : "";

        setPopup(
          showPopup(
            "success",
            "Vehicle Intake Completed",
            `The vehicle intake has been saved successfully.${assignmentMessage} The vehicle is now under ${nextStage}.`,
            "Go to Intake Queue"
          )
        );
      } catch (error: any) {
        console.error(
          "Vehicle intake save error:",
          error
        );

        let message =
          error?.message ??
          "The vehicle intake could not be saved.";

        /*
         * Supabase/PostgREST sometimes returns
         * the function error inside details/hint.
         */
        if (
          error?.details &&
          typeof error.details ===
            "string"
        ) {
          message = error.details;
        }

        setPopup(
          showPopup(
            "error",
            "Unable to save Vehicle Intake",
            `${message}\n\nNo workflow stage change was completed.`
          )
        );
      } finally {
        setSaving(false);
      }
    };

  const popupButtonAction =
    () => {
      if (
        popup.visible &&
        popup.type === "info" &&
        popup.title ===
          "Ready to save?"
      ) {
        setPopup((current) => ({
          ...current,
          visible: false,
        }));

        confirmSave();

        return;
      }

      closePopup();
    };

  const openModelDropdown =
    () => {
      if (
        vehicleModels.length === 0
      ) {
        setPopup(
          showPopup(
            "warning",
            "Vehicle models unavailable",
            "No active vehicle models are available in Master Data."
          )
        );

        return;
      }

      setDropdown("model");
    };

  const openInsuranceDropdown =
    () => {
      if (
        insuranceCompanies.length ===
        0
      ) {
        setPopup(
          showPopup(
            "warning",
            "Insurance companies unavailable",
            "No active insurance companies are available in Master Data."
          )
        );

        return;
      }

      setDropdown("insurance");
    };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={
            colors.background
          }
        />

        <View
          style={
            styles.loadingContainer
          }
        >
          <View
            style={styles.loadingIcon}
          >
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
          </View>

          <Text
            style={
              styles.loadingTitle
            }
          >
            Loading Vehicle Intake
          </Text>

          <Text
            style={
              styles.loadingSubtitle
            }
          >
            Preparing vehicle details,
            documents and master data…
          </Text>
        </View>

        <PopupModal
          popup={popup}
          onAction={popupButtonAction}
          styles={styles}
        />
      </SafeAreaView>
    );
  }

  if (!vehicle || !visit) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={
            colors.background
          }
        />

        <View
          style={
            styles.unavailableContainer
          }
        >
          <View
            style={
              styles.unavailableIcon
            }
          >
            <Text
              style={
                styles.unavailableIconText
              }
            >
              !
            </Text>
          </View>

          <Text
            style={
              styles.unavailableTitle
            }
          >
            Vehicle Intake unavailable
          </Text>

          <Text
            style={
              styles.unavailableMessage
            }
          >
            The selected vehicle or
            workshop visit could not be
            loaded.
          </Text>

          <Pressable
            onPress={() =>
              router.back()
            }
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Go Back
            </Text>
          </Pressable>
        </View>

        <PopupModal
          popup={popup}
          onAction={popupButtonAction}
          styles={styles}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={
          colors.background
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={styles.topBar}
          >
            <Pressable
              onPress={() =>
                router.back()
              }
              style={({ pressed }) => [
                styles.backButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.backArrow
                }
              >
                ‹
              </Text>

              <Text
                style={
                  styles.backText
                }
              >
                Back
              </Text>
            </Pressable>

            <View
              style={
                styles.brandBadge
              }
            >
              <View
                style={styles.brandDot}
              />

              <Text
                style={
                  styles.brandText
                }
              >
                PAGARIYA
              </Text>
            </View>
          </View>

          <View
            style={styles.heroCard}
          >
            <View
              style={
                styles.heroCircleOne
              }
            />

            <View
              style={
                styles.heroCircleTwo
              }
            />

            <View
              style={
                styles.heroContent
              }
            >
              <View
                style={
                  styles.heroLabel
                }
              >
                <Text
                  style={
                    styles.heroLabelText
                  }
                >
                  {isAdmin
                    ? "CEO ADMIN WORKSPACE"
                    : "ADVISOR WORKSPACE"}
                </Text>
              </View>

              <Text
                style={
                  styles.heroTitle
                }
              >
                Vehicle Intake
              </Text>

              <Text
                style={
                  styles.heroSubtitle
                }
              >
                Complete the vehicle
                details below. Saving the
                intake securely moves the
                vehicle to the next workflow
                stage.
              </Text>
            </View>
          </View>

          <IntakeVehicleSection
            vehicle={vehicle}
            currentStage={visit.current_stage}
            gateInAt={gateInAt}
            gateInPhoto={gateInPhoto}
            formatDateTime={formatDateTime}
            normalizeVehicleNumber={
              normalizeVehicleNumber
            }
            onOpenPhoto={
              setPhotoViewerUri
            }
            styles={styles}
          />

          <IntakeCustomerSection
            customerName={customerName}
            customerMobile={
              customerMobile
            }
            onCustomerNameChange={
              setCustomerName
            }
            onCustomerMobileChange={
              setCustomerMobile
            }
            normalizeMobile={
              normalizeMobile
            }
            maxMobileLength={
              MAX_MOBILE_LENGTH
            }
            styles={styles}
          />

          <IntakeJobTypeSection
            jobType={jobType}
            miType={miType}
            selectedInsurance={
              selectedInsurance
            }
            selectedMiMaster={
              selectedMiMaster
            }
            onJobTypeChange={
              handleJobTypeChange
            }
            onMiTypeChange={
              handleMiTypeChange
            }
            onOpenInsuranceDropdown={
              openInsuranceDropdown
            }
            styles={styles}
          />

          <IntakeWorkerGroupSection
            workerGroup={workerGroup}
            onWorkerGroupChange={
              setWorkerGroup
            }
            styles={styles}
          />

          <IntakeVehicleTypeSection
            vehicleType={vehicleType}
            completedRequiredDocuments={
              completedRequiredDocuments
            }
            requiredDocumentsCount={
              requiredDocuments.length
            }
            onVehicleTypeChange={
              handleVehicleTypeChange
            }
            styles={styles}
          />

          <IntakeVehicleModelSection
            vehicleModels={
              vehicleModels
            }
            selectedModelId={
              selectedModelId
            }
            selectedModel={
              selectedModel
            }
            arenaNexa={arenaNexa}
            onOpenModelDropdown={
              openModelDropdown
            }
            styles={styles}
          />

          <IntakeDocumentSection
            vehicleType={vehicleType}
            currentDocuments={
              currentDocuments
            }
            documentChecklist={
              documentChecklist
            }
            onToggleDocument={
              toggleDocument
            }
            isRequiredDocument={
              isRequiredDocument
            }
            styles={styles}
          />

            <IntakePhotoSection
              photos={intakePhotos}
              saving={saving}
              onTakePhoto={takePhoto}
              onChooseFromGallery={chooseFromGallery}
              onRemovePhoto={
                handleRemoveIntakePhoto
              }
              styles={styles}
            />

          <IntakeJobDetailsSection
            jobCardNo={jobCardNo}
            advisorRemarks={
              advisorRemarks
            }
            onJobCardNoChange={
              setJobCardNo
            }
            onAdvisorRemarksChange={
              setAdvisorRemarks
            }
            styles={styles}
          />

          <IntakeSaveSection
            saving={saving}
            onSave={handleSave}
            styles={styles}
          />

          <Text
            style={styles.footerText}
          >
            PAGARIYA AUTO • VEHICLE
            INTAKE
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <DropdownModal
        visible={
          dropdown === "model"
        }
        title="Select Vehicle Model"
        items={vehicleModels.map(
          (item) => ({
            id: item.id,
            title: item.name,
            subtitle:
              item.arena_nexa ??
              "",
          })
        )}
        selectedId={
          selectedModelId
        }
        onSelect={
          handleModelSelect
        }
        onClose={() =>
          setDropdown(null)
        }
        styles={styles}
      />

      <DropdownModal
        visible={
          dropdown === "insurance"
        }
        title="Select Insurance Company"
        items={insuranceCompanies.map(
          (item) => ({
            id: item.id,
            title: item.name,
            subtitle:
              "Insurance company",
          })
        )}
        selectedId={
          selectedInsuranceId
        }
        onSelect={(id) => {
          setSelectedInsuranceId(
            id
          );

          setDropdown(null);
        }}
        onClose={() =>
          setDropdown(null)
        }
        styles={styles}
      />

      <PhotoViewerModal
        uri={photoViewerUri}
        onClose={() =>
          setPhotoViewerUri(null)
        }
        styles={styles}
      />

      <PopupModal
        popup={popup}
        onAction={popupButtonAction}
        styles={styles}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  content: {
    paddingHorizontal:
      spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom:
      spacing.xxl,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom:
      spacing.lg,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical:
      spacing.xs,
    paddingRight:
      spacing.md,
  },

  backArrow: {
    fontSize: 30,
    lineHeight: 32,
    color: colors.primary,
    marginRight:
      spacing.xs,
  },

  backText: {
    ...typography.bodyMedium,
    color:
      colors.textSecondary,
  },

  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor:
      colors.primary,
    marginRight: 7,
  },

  brandText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.text,
  },

  heroCard: {
    backgroundColor:
      colors.primary,
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom:
      spacing.lg,
    overflow: "hidden",
    position: "relative",
    shadowColor:
      colors.primaryDark,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },

  heroCircleOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor:
      "rgba(255,255,255,0.07)",
    top: -85,
    right: -55,
  },

  heroCircleTwo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor:
      "rgba(255,255,255,0.06)",
    bottom: -80,
    right: 45,
  },

  heroContent: {
    zIndex: 1,
  },

  heroLabel: {
    alignSelf:
      "flex-start",
    backgroundColor:
      "rgba(255,255,255,0.17)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom:
      spacing.md,
  },

  heroLabelText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#FFFFFF",
  },

  heroTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom:
      spacing.sm,
  },

  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color:
      "rgba(255,255,255,0.88)",
    maxWidth: 500,
  },

  sectionCard: {
    backgroundColor:
      colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor:
      colors.border,
    marginBottom:
      spacing.md,
    overflow: "hidden",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    paddingBottom:
      spacing.sm,
  },

  sectionNumber: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight:
      spacing.sm,
  },

  sectionNumberText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
  },

  sectionHeading: {
    flex: 1,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: 3,
  },

  sectionSubtitle: {
    ...typography.caption,
    color:
      colors.textSecondary,
    lineHeight: 18,
  },

  sectionBody: {
    paddingHorizontal:
      spacing.md,
    paddingBottom:
      spacing.md,
  },

  vehicleHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      colors.background,
    borderRadius: 14,
    padding: spacing.md,
  },

  vehicleIconLarge: {
    width: 54,
    height: 54,
    borderRadius: 15,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight:
      spacing.md,
  },

  vehicleHeroInfo: {
    flex: 1,
  },

  vehicleNumberLarge: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.4,
  },

  vehicleStageText: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 3,
  },

  infoGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  infoBox: {
    flex: 1,
    minHeight: 84,
    backgroundColor:
      colors.background,
    borderRadius: 13,
    padding: spacing.md,
  },

  infoBoxLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color:
      colors.textSecondary,
    marginBottom: 6,
  },

  infoBoxValue: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 18,
  },

  gateThumbnailButton: {
    width: 54,
    height: 54,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },

  gateThumbnail: {
    width: "100%",
    height: "100%",
  },

  thumbnailOverlay: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 23,
    height: 23,
    borderRadius: 7,
    backgroundColor:
      "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  noPhotoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  noPhotoText: {
    ...typography.caption,
    color: colors.textLight,
  },

  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: 7,
  },

  fieldLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.text,
  },

  required: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 3,
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 11,
    backgroundColor:
      colors.surface,
    paddingHorizontal:
      spacing.md,
    color: colors.text,
    fontSize: 15,
    marginBottom:
      spacing.sm,
  },

  multilineInput: {
    minHeight: 110,
    paddingTop: spacing.md,
  },

  optionalText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: -3,
  },

  segmentedContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor:
      colors.background,
    borderRadius: 13,
    padding: 4,
    marginTop: spacing.sm,
  },

  segment: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal:
      spacing.sm,
  },

  segmentSelected: {
    backgroundColor:
      colors.primary,
  },

  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color:
      colors.textSecondary,
  },

  segmentTextSelected: {
    color: "#FFFFFF",
  },

  conditionalPanel: {
    backgroundColor:
      colors.primaryLight,
    borderRadius: 13,
    padding: spacing.md,
    marginTop: spacing.md,
  },

  conditionalTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  conditionalSubtitle: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 3,
  },

  miStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: 6,
  },

  miStatusText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "700",
  },

  miInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor:
      colors.infoLight,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.md,
  },

  miInfoText: {
    ...typography.caption,
    color: colors.info,
    flex: 1,
    lineHeight: 18,
  },

  insuranceDropdownContainer: {
    marginTop: spacing.md,
  },

  dropdownButton: {
    minHeight: 49,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 11,
    backgroundColor:
      colors.surface,
    paddingHorizontal:
      spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginTop: spacing.xs,
  },

  dropdownButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 9,
  },

  dropdownButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    flex: 1,
  },

  dropdownPlaceholder: {
    color: colors.textLight,
    fontWeight: "400",
  },

  arenaNexaBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor:
      colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },

  arenaNexaText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primaryDark,
  },

  checklistSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },

  checklistSummaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor:
      colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight:
      spacing.sm,
  },

  checklistSummaryText: {
    flex: 1,
  },

  checklistSummaryTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },

  checklistSummarySubtitle: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  documentList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor:
      colors.surface,
  },

  documentRowChecked: {
    borderColor:
      colors.success,
    backgroundColor:
      colors.successLight,
  },

  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor:
      colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight:
      spacing.sm,
  },

  checkboxChecked: {
    backgroundColor:
      colors.success,
    borderColor:
      colors.success,
  },

  documentInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  documentName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  documentRequirement: {
    fontSize: 11,
    color:
      colors.textSecondary,
    marginTop: 3,
  },

  emptyChecklist: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      colors.background,
    borderRadius: 13,
    padding: spacing.xl,
    marginTop: spacing.sm,
  },

  emptyChecklistTitle: {
    ...typography.subheading,
    color: colors.text,
    marginTop: spacing.sm,
  },

  emptyChecklistText: {
    ...typography.caption,
    color:
      colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },

  saveSection: {
    marginTop: spacing.sm,
    marginBottom:
      spacing.md,
  },

  saveInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor:
      colors.infoLight,
    borderRadius: 13,
    padding: spacing.md,
    marginBottom:
      spacing.md,
  },

  saveInfoIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor:
      colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight:
      spacing.sm,
  },

  saveInfoText: {
    ...typography.caption,
    color: colors.info,
    lineHeight: 18,
    flex: 1,
  },

  saveButton: {
    minHeight: 54,
    borderRadius: 13,
    backgroundColor:
      colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal:
      spacing.lg,
    shadowColor:
      colors.primaryDark,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 4,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    ...typography.button,
    color: "#FFFFFF",
    fontWeight: "800",
  },

  footerText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textLight,
    textAlign: "center",
    marginTop: spacing.md,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor:
      colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom:
      spacing.lg,
    elevation: 3,
  },

  loadingTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom:
      spacing.xs,
  },

  loadingSubtitle: {
    ...typography.body,
    color:
      colors.textSecondary,
    textAlign: "center",
  },

  unavailableContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  unavailableIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor:
      colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom:
      spacing.lg,
  },

  unavailableIconText: {
    fontSize: 31,
    fontWeight: "900",
    color: colors.danger,
  },

  unavailableTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
    marginBottom:
      spacing.sm,
  },

  unavailableMessage: {
    ...typography.body,
    color:
      colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom:
      spacing.lg,
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 11,
    backgroundColor:
      colors.primary,
    paddingHorizontal:
      spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    ...typography.button,
    color: "#FFFFFF",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  dropdownModalCard: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "78%",
    backgroundColor:
      colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor:
      colors.divider,
  },

  modalTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  modalSubtitle: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 2,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor:
      colors.background,
    alignItems: "center",
    justifyContent: "center",
  },

  dropdownList: {
    padding: spacing.md,
  },

  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  dropdownItemSelected: {
    borderColor:
      colors.primary,
    backgroundColor:
      colors.primaryLight,
  },

  dropdownItemText: {
    flex: 1,
  },

  dropdownItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  dropdownItemTitleSelected: {
    color: colors.primaryDark,
  },

  dropdownItemSubtitle: {
    ...typography.caption,
    color:
      colors.textSecondary,
    marginTop: 3,
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor:
      colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },

  radioOuterSelected: {
    borderColor:
      colors.primary,
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor:
      colors.primary,
  },

  modalEmpty: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },

  modalEmptyTitle: {
    ...typography.subheading,
    color: colors.text,
    marginTop: spacing.sm,
  },

  photoViewerOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },

  fullScreenPhoto: {
    width: "100%",
    height: "82%",
  },

  photoViewerClose: {
    position: "absolute",
    zIndex: 10,
    top:
      Platform.OS === "ios"
        ? 60
        : 35,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor:
      "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  photoViewerHint: {
    position: "absolute",
    bottom: 35,
    color:
      "rgba(255,255,255,0.7)",
    fontSize: 12,
  },

  popupCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor:
      colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom:
      spacing.md,
  },

  popupIconText: {
    fontSize: 28,
    fontWeight: "900",
  },

  popupTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
    marginBottom:
      spacing.sm,
  },

  popupMessage: {
    ...typography.body,
    color:
      colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom:
      spacing.lg,
  },

  popupButton: {
    width: "100%",
    minHeight: 46,
    borderRadius: 11,
    backgroundColor:
      colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal:
      spacing.lg,
  },

  popupButtonText: {
    ...typography.bodyMedium,
    color: "#FFFFFF",
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.82,
  },
});