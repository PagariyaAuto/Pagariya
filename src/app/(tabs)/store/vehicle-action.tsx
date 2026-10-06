import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";

/* ============================================================
   TYPES
============================================================ */

type PopupType = "success" | "error" | "warning" | "info";

type PopupConfig = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
  primaryText?: string;
  secondaryText?: string;
  onPrimary?: () => void | Promise<void>;
  onSecondary?: () => void | Promise<void>;
};

type Vehicle = {
  id: string;
  vehicle_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  model: string | null;
  arena_nexa: string | null;
  vehicle_type: string | null;
  jc_no: string | null;
  current_stage: string | null;
  current_status: string | null;
};

type PartRequisition = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  advisor_work_id: string | null;
  supplementary_cycle_id: string | null;
  requisition_no: string;
  requisition_at: string;
  requested_by: string;
  status: string;
  remarks: string | null;
  created_at: string;
};

type PartOrder = {
  id: string;
  visit_id: string;
  vehicle_id: string;
  part_requisition_id: string;
  part_order_no: string;
  order_type: string;
  ordered_at: string;
  ordered_by: string;
  parts_received_at: string | null;
  parts_received_by: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
};

type FloorIncharge = {
  id: string;
  name: string | null;
};

type FloorInchargeRpcResponse = {
  role: string;
  items: FloorIncharge[];
};

type ActionMode =
  | "CREATE_ORDER"
  | "RECEIVE_PARTS"
  | "HAND_OVER"
  | "COMPLETED"
  | "UNKNOWN";

type PickerTarget = "ORDERED_AT" | "RECEIVED_AT" | "HANDOVER_AT";

/* ============================================================
   CONSTANTS
============================================================ */

const COLORS = {
  background: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  border: "#E5E7EB",
  borderStrong: "#D7DCE5",
  text: "#172033",
  textSecondary: "#667085",
  textMuted: "#98A2B3",
  primary: "#C62828",
  primaryDark: "#A61F1F",
  primarySoft: "#FFF1F1",
  success: "#168A4A",
  successSoft: "#EAF8F0",
  warning: "#B77900",
  warningSoft: "#FFF7E5",
  info: "#2563EB",
  infoSoft: "#EEF4FF",
  danger: "#C62828",
  dangerSoft: "#FFF0F0",
  purple: "#7157C8",
  purpleSoft: "#F1EDFF",
  white: "#FFFFFF",
  black: "#111827",
};

const ORDER_TYPES = [
  {
    value: "REGULAR",
    label: "Regular",
    description: "Normal parts order",
  },
  {
    value: "EXPRESS",
    label: "Express",
    description: "Urgent requirement",
  },
  {
    value: "PVIP",
    label: "PVIP",
    description: "Priority VIP",
  },
  {
    value: "VOR",
    label: "VOR",
    description: "Vehicle off road",
  },
];

/* ============================================================
   HELPERS
============================================================ */

function formatIndiaDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatDateForInput(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function normalizeOrderType(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  switch (value) {
    case "REGULAR":
      return "Regular";

    case "EXPRESS":
      return "Express";

    case "PVIP":
      return "PVIP";

    case "VOR":
      return "VOR";

    default:
      return value;
  }
}

function getActionMode(order: PartOrder | null): ActionMode {
  if (!order) {
    return "CREATE_ORDER";
  }

  switch (order.status) {
    case "ORDERED":
    case "PARTIALLY_RECEIVED":
      return "RECEIVE_PARTS";

    case "RECEIVED":
      return "HAND_OVER";

    case "HANDED_TO_FLOOR":
      return "COMPLETED";

    default:
      return "UNKNOWN";
  }
}

function popupIcon(type: PopupType) {
  switch (type) {
    case "success":
      return "✓";

    case "error":
      return "×";

    case "warning":
      return "!";

    default:
      return "i";
  }
}

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "Something went wrong. Please try again.";
}

/* ============================================================
   CUSTOM POPUP
============================================================ */

function CustomPopup({
  popup,
  onClose,
}: {
  popup: PopupConfig;
  onClose: () => void;
}) {
  if (!popup.visible) {
    return null;
  }

  const handlePrimary = async () => {
    if (popup.onPrimary) {
      await popup.onPrimary();
    } else {
      onClose();
    }
  };

  const handleSecondary = async () => {
    if (popup.onSecondary) {
      await popup.onSecondary();
    } else {
      onClose();
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
      <View style={styles.popupOverlay}>
        <View style={styles.popupCard}>
          <View
            style={[
              styles.popupIcon,
              popup.type === "success" && styles.popupIconSuccess,
              popup.type === "error" && styles.popupIconError,
              popup.type === "warning" && styles.popupIconWarning,
              popup.type === "info" && styles.popupIconInfo,
            ]}
          >
            <Text style={styles.popupIconText}>{popupIcon(popup.type)}</Text>
          </View>

          <Text style={styles.popupTitle}>{popup.title}</Text>

          <Text style={styles.popupMessage}>{popup.message}</Text>

          <View style={styles.popupButtons}>
            {popup.secondaryText ? (
              <Pressable
                onPress={handleSecondary}
                style={({ pressed }) => [
                  styles.popupSecondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.popupSecondaryButtonText}>
                  {popup.secondaryText}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handlePrimary}
              style={({ pressed }) => [
                styles.popupPrimaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.popupPrimaryButtonText}>
                {popup.primaryText || "OK"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      </SafeAreaView>
    </Modal>
  );
}

/* ============================================================
   INFO ROW
============================================================ */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}

/* ============================================================
   SCREEN
============================================================ */

export default function StoreVehicleActionScreen() {
  const params = useLocalSearchParams<{
    vehicleId?: string;
    visitId?: string;
  }>();

  const vehicleId = params.vehicleId || "";
  const initialVisitId = params.visitId || "";

  /* ==========================================================
     DATA
  ========================================================== */

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [requisition, setRequisition] = useState<PartRequisition | null>(null);
  const [order, setOrder] = useState<PartOrder | null>(null);
  const [floorIncharges, setFloorIncharges] = useState<FloorIncharge[]>([]);

  const [resolvedVisitId, setResolvedVisitId] =
    useState<string>(initialVisitId);

  /* ==========================================================
     UI STATE
  ========================================================== */

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [popup, setPopup] = useState<PopupConfig>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const [floorSelectorVisible, setFloorSelectorVisible] = useState(false);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const [androidPickerMode, setAndroidPickerMode] = useState<"date" | "time">(
    "date",
  );

  /* ==========================================================
     CREATE ORDER FORM
  ========================================================== */

  const [partOrderNo, setPartOrderNo] = useState("");

  const [orderType, setOrderType] = useState<string>("REGULAR");

  const [orderedAt, setOrderedAt] = useState<Date>(new Date());

  const [orderRemarks, setOrderRemarks] = useState("");

  /* ==========================================================
     RECEIVE FORM
  ========================================================== */

  const [receivedAt, setReceivedAt] = useState<Date>(new Date());

  const [receiveRemarks, setReceiveRemarks] = useState("");

  /* ==========================================================
     HANDOVER FORM
  ========================================================== */

  const [selectedFloorInchargeId, setSelectedFloorInchargeId] = useState("");

  const [handoverAt, setHandoverAt] = useState<Date>(new Date());

  const [handoverRemarks, setHandoverRemarks] = useState("");

  /* ==========================================================
     POPUP HELPERS
  ========================================================== */

  const closePopup = useCallback(() => {
    setPopup((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  const showPopup = useCallback((config: Omit<PopupConfig, "visible">) => {
    setPopup({
      visible: true,
      ...config,
    });
  }, []);

  /* ==========================================================
     BACK
  ========================================================== */

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({
      pathname: "/(tabs)/store",
    } as never);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        goBack();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [goBack]);

  /* ==========================================================
     LOAD DATA
  ========================================================== */

  const loadData = useCallback(
    async (showErrors = false) => {
      if (!vehicleId) {
        if (showErrors) {
          showPopup({
            type: "error",
            title: "Vehicle Missing",
            message:
              "Vehicle information was not provided. Please return to the Store workspace and open the vehicle again.",
            primaryText: "Go Back",
            onPrimary: goBack,
          });
        }

        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (!vehicle) {
          setLoading(true);
        }

        const userResult = await supabase.auth.getUser();

        if (userResult.error) {
          throw userResult.error;
        }

        const userId = userResult.data.user?.id;

        if (!userId) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        /* ------------------------------------------------------
           VEHICLE
        ------------------------------------------------------ */

        const vehicleResult = await supabase
          .from("vehicles")
          .select(
            "id,vehicle_no,customer_name,customer_mobile,model,arena_nexa,vehicle_type,jc_no,current_stage,current_status",
          )
          .eq("id", vehicleId)
          .maybeSingle();

        if (vehicleResult.error) {
          throw vehicleResult.error;
        }

        if (!vehicleResult.data) {
          throw new Error("Vehicle could not be found.");
        }

        setVehicle(vehicleResult.data as Vehicle);

        /* ------------------------------------------------------
           REQUISITION
        ------------------------------------------------------ */

        const requisitionResult = await supabase
          .from("part_requisitions")
          .select(
            "id,visit_id,vehicle_id,advisor_work_id,supplementary_cycle_id,requisition_no,requisition_at,requested_by,status,remarks,created_at",
          )
          .eq("vehicle_id", vehicleId)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (requisitionResult.error) {
          throw requisitionResult.error;
        }

        const requisitionData =
          (requisitionResult.data as PartRequisition | null) || null;

        setRequisition(requisitionData);

        /* ------------------------------------------------------
           PART ORDER
        ------------------------------------------------------ */

        const orderResult = await supabase
          .from("part_orders")
          .select(
            "id,visit_id,vehicle_id,part_requisition_id,part_order_no,order_type,ordered_at,ordered_by,parts_received_at,parts_received_by,status,remarks,created_at",
          )
          .eq("vehicle_id", vehicleId)
          .eq(
            "part_requisition_id",
            requisitionData?.id || "00000000-0000-0000-0000-000000000000",
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (orderResult.error) {
          throw orderResult.error;
        }

        const orderData = (orderResult.data as PartOrder | null) || null;

        setOrder(orderData);

        /* ------------------------------------------------------
           RESOLVE VISIT ID
        ------------------------------------------------------ */

        const nextVisitId =
          orderData?.visit_id || requisitionData?.visit_id || initialVisitId;

        if (nextVisitId) {
          setResolvedVisitId(nextVisitId);
        }

        /* ------------------------------------------------------
           FLOOR INCHARGES
        ------------------------------------------------------ */

        const { data: floorResponse, error: floorError } = await supabase.rpc(
          "new_workflow_active_floor_incharges",
        );

        if (floorError) {
          throw floorError;
        }

        const parsedFloorResponse = floorResponse as FloorInchargeRpcResponse;

        if (!parsedFloorResponse || !Array.isArray(parsedFloorResponse.items)) {
          throw new Error("Floor Incharge list returned an invalid response.");
        }

        setFloorIncharges(parsedFloorResponse.items);
      } catch (error) {
        console.error("Store vehicle action load error:", error);

        if (showErrors) {
          showPopup({
            type: "error",
            title: "Unable to Load Vehicle",
            message: getErrorMessage(error),
            primaryText: "Try Again",
            secondaryText: "Back",
            onPrimary: () => {
              closePopup();
              loadData(true);
            },
            onSecondary: closePopup,
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [closePopup, goBack, initialVisitId, showPopup, vehicle, vehicleId],
  );

  /* ==========================================================
     LOAD ON SCREEN FOCUS
  ========================================================== */

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData]),
  );

  /* ==========================================================
     CURRENT ACTION
  ========================================================== */

  const actionMode = useMemo(() => {
    return getActionMode(order);
  }, [order]);

  const currentOrder = order;

  const selectedFloorIncharge = useMemo(() => {
    return floorIncharges.find((item) => item.id === selectedFloorInchargeId);
  }, [floorIncharges, selectedFloorInchargeId]);

  /* ==========================================================
     RESET ACTION FORM WHEN WORKFLOW CHANGES
  ========================================================== */

  useEffect(() => {
    if (actionMode === "CREATE_ORDER") {
      setReceivedAt(new Date());
      setHandoverAt(new Date());
    }

    if (actionMode === "RECEIVE_PARTS") {
      setReceivedAt(new Date());
      setReceiveRemarks("");
    }

    if (actionMode === "HAND_OVER") {
      setHandoverAt(new Date());
      setHandoverRemarks("");
    }
  }, [actionMode]);

  /* ==========================================================
     DATE PICKER
  ========================================================== */

  const openDatePicker = (target: PickerTarget) => {
    setPickerTarget(target);
    setAndroidPickerMode("date");
  };

  const getPickerDate = () => {
    switch (pickerTarget) {
      case "ORDERED_AT":
        return orderedAt;

      case "RECEIVED_AT":
        return receivedAt;

      case "HANDOVER_AT":
        return handoverAt;

      default:
        return new Date();
    }
  };

  const setPickerDate = (date: Date) => {
    switch (pickerTarget) {
      case "ORDERED_AT":
        setOrderedAt(date);
        break;

      case "RECEIVED_AT":
        setReceivedAt(date);
        break;

      case "HANDOVER_AT":
        setHandoverAt(date);
        break;
    }
  };

  const handleDatePickerChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (event.type === "dismissed" || !selectedDate) {
      setPickerTarget(null);
      return;
    }

    if (Platform.OS === "android") {
      if (androidPickerMode === "date") {
        const existing = getPickerDate();

        const merged = new Date(existing);

        merged.setFullYear(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
        );

        setPickerDate(merged);
        setAndroidPickerMode("time");
        return;
      }

      const existing = getPickerDate();

      const merged = new Date(existing);

      merged.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);

      setPickerDate(merged);
      setPickerTarget(null);
      setAndroidPickerMode("date");
      return;
    }

    setPickerDate(selectedDate);
  };

  /* ==========================================================
     CREATE PART ORDER
  ========================================================== */

  const submitCreateOrder = useCallback(async () => {
    if (saving) {
      return;
    }

    if (!resolvedVisitId) {
      showPopup({
        type: "error",
        title: "Visit Missing",
        message:
          "The vehicle does not have a valid visit ID, so the part order cannot be created.",
        primaryText: "OK",
      });

      return;
    }

    const trimmedOrderNo = partOrderNo.trim();

    if (!trimmedOrderNo) {
      showPopup({
        type: "warning",
        title: "Part Order No. Required",
        message:
          "Please enter the Part Order No. provided by the Store before creating the order.",
        primaryText: "Enter Order No.",
      });

      return;
    }

    if (!orderType) {
      showPopup({
        type: "warning",
        title: "Order Type Required",
        message: "Please select an Order Type.",
        primaryText: "OK",
      });

      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc("new_workflow_create_part_order", {
        p_visit_id: resolvedVisitId,
        p_part_order_no: trimmedOrderNo,
        p_order_type: orderType,
        p_ordered_at: orderedAt.toISOString(),
        p_remarks: orderRemarks.trim() || null,
      });

      if (error) {
        throw error;
      }

      await loadData(false);

      showPopup({
        type: "success",
        title: "Part Order Created",
        message: `Part Order ${trimmedOrderNo} has been created successfully.`,
        primaryText: "Continue",
      });
    } catch (error) {
      console.error("Create part order error:", error);

      showPopup({
        type: "error",
        title: "Order Creation Failed",
        message: getErrorMessage(error),
        primaryText: "OK",
      });
    } finally {
      setSaving(false);
    }
  }, [
    loadData,
    orderRemarks,
    orderType,
    orderedAt,
    partOrderNo,
    resolvedVisitId,
    saving,
    showPopup,
  ]);

  const confirmCreateOrder = () => {
    const trimmedOrderNo = partOrderNo.trim();

    if (!trimmedOrderNo) {
      showPopup({
        type: "warning",
        title: "Part Order No. Required",
        message:
          "Enter the Part Order No. manually. The system will not generate one automatically.",
        primaryText: "Enter Order No.",
      });

      return;
    }

    showPopup({
      type: "warning",
      title: "Create Part Order?",
      message: `Create Part Order ${trimmedOrderNo} as ${normalizeOrderType(
        orderType,
      )}?`,
      primaryText: "Create Order",
      secondaryText: "Cancel",
      onPrimary: async () => {
        closePopup();
        await submitCreateOrder();
      },
      onSecondary: closePopup,
    });
  };

  /* ============================================================
     RECEIVE PARTS
  ============================================================ */

  const submitReceiveParts = useCallback(async () => {
    if (saving) {
      return;
    }

    if (!resolvedVisitId) {
      showPopup({
        type: "error",
        title: "Visit Missing",
        message: "The current vehicle does not have a valid visit ID.",
        primaryText: "OK",
      });

      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc("new_workflow_receive_parts", {
        p_part_order_id: order?.id,
        p_parts_received_at: receivedAt.toISOString(),
        p_remarks: receiveRemarks.trim() || null,
      });

      if (error) {
        throw error;
      }

      await loadData(false);

      showPopup({
        type: "success",
        title: "Parts Received",
        message: "Parts receipt has been recorded successfully.",
        primaryText: "Continue",
      });
    } catch (error) {
      console.error("Receive parts error:", error);

      showPopup({
        type: "error",
        title: "Receive Failed",
        message: getErrorMessage(error),
        primaryText: "OK",
      });
    } finally {
      setSaving(false);
    }
  }, [
    loadData,
    receiveRemarks,
    receivedAt,
    resolvedVisitId,
    saving,
    showPopup,
  ]);

  const confirmReceiveParts = () => {
    if (!currentOrder) {
      showPopup({
        type: "error",
        title: "Order Not Found",
        message: "There is no active part order available for receiving.",
        primaryText: "OK",
      });

      return;
    }

    showPopup({
      type: "warning",
      title: "Receive Parts?",
      message: `Record parts receipt for Part Order ${currentOrder.part_order_no}?`,
      primaryText: "Receive Parts",
      secondaryText: "Cancel",
      onPrimary: async () => {
        closePopup();
        await submitReceiveParts();
      },
      onSecondary: closePopup,
    });
  };

  /* ============================================================
     HAND OVER TO FLOOR
  ============================================================ */

  const submitHandover = async () => {
    if (!currentOrder?.id) {
      showPopup({
        type: "error",
        title: "Part Order Missing",
        message: "No Part Order was found for this vehicle.",
      });
      return;
    }

    if (!selectedFloorInchargeId) {
      showPopup({
        type: "warning",
        title: "Select Floor Incharge",
        message: "Please select the Floor Incharge before continuing.",
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc(
      "new_workflow_hand_over_parts_to_floor",
      {
        p_part_order_id: currentOrder.id,
        p_floor_incharge_id: selectedFloorInchargeId,
        p_handed_over_at: handoverAt.toISOString(),
        p_remarks: handoverRemarks.trim() || null,
      },
    );

    setSaving(false);

    if (error) {
      showPopup({
        type: "error",
        title: "Unable to Hand Over Parts",
        message: error.message,
      });
      return;
    }

    showPopup({
      type: "success",
      title: "Parts Handed Over",
      message:
        "Parts have been successfully handed over to the Floor Incharge.",
      primaryText: "Continue",
      onPrimary: async () => {
        closePopup();
        await loadData();
      },
    });
  };

  const confirmHandover = () => {
    if (!currentOrder) {
      showPopup({
        type: "error",
        title: "Order Not Found",
        message: "There is no active part order available for handover.",
        primaryText: "OK",
      });

      return;
    }

    if (!selectedFloorInchargeId) {
      showPopup({
        type: "warning",
        title: "Select Floor Incharge",
        message:
          "Please select the Floor Incharge before handing over the parts.",
        primaryText: "Select",
      });

      return;
    }

    showPopup({
      type: "warning",
      title: "Hand Over Parts?",
      message: `Hand over Part Order ${currentOrder.part_order_no} to ${
        selectedFloorIncharge?.name || "the selected Floor Incharge"
      }?`,
      primaryText: "Hand Over",
      secondaryText: "Cancel",
      onPrimary: async () => {
        closePopup();
        await submitHandover();
      },
      onSecondary: closePopup,
    });
  };

  /* ============================================================
     ACTION CONTENT
  ============================================================ */

  const renderActionContent = () => {
    if (actionMode === "CREATE_ORDER") {
      return (
        <>
          <View style={styles.actionHeader}>
            <View style={[styles.actionIcon, styles.actionIconRequest]}>
              <Text style={styles.actionIconText}>+</Text>
            </View>

            <View style={styles.actionHeaderCopy}>
              <Text style={styles.actionEyebrow}>PART ORDER</Text>

              <Text style={styles.actionTitle}>Create Part Order</Text>

              <Text style={styles.actionDescription}>
                Enter the Store Part Order No. manually and create the order for
                this vehicle.
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Part Order Details</Text>

            <Text style={styles.fieldLabel}>
              Part Order No. <Text style={styles.required}>*</Text>
            </Text>

            <TextInput
              value={partOrderNo}
              onChangeText={setPartOrderNo}
              placeholder="Enter Part Order No."
              placeholderTextColor={COLORS.textMuted}
              style={styles.textInput}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!saving}
            />

            <Text style={styles.fieldHint}>
              Enter the order number provided by the Store. It will not be
              generated automatically.
            </Text>

            <Text style={styles.fieldLabel}>
              Order Type <Text style={styles.required}>*</Text>
            </Text>

            <View style={styles.orderTypeGrid}>
              {ORDER_TYPES.map((item) => {
                const selected = orderType === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setOrderType(item.value)}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.orderTypeCard,
                      selected && styles.orderTypeCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.orderTypeRadio,
                        selected && styles.orderTypeRadioSelected,
                      ]}
                    >
                      {selected ? (
                        <View style={styles.orderTypeRadioDot} />
                      ) : null}
                    </View>

                    <View style={styles.orderTypeCopy}>
                      <Text
                        style={[
                          styles.orderTypeLabel,
                          selected && styles.orderTypeLabelSelected,
                        ]}
                      >
                        {item.label}
                      </Text>

                      <Text style={styles.orderTypeDescription}>
                        {item.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Ordered At</Text>

            <Pressable
              onPress={() => openDatePicker("ORDERED_AT")}
              disabled={saving}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dateIcon}>◷</Text>

              <View style={styles.dateCopy}>
                <Text style={styles.dateValue}>
                  {formatDateForInput(orderedAt)}
                </Text>

                <Text style={styles.dateHint}>Tap to change date/time</Text>
              </View>

              <Text style={styles.dateArrow}>›</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>Remarks</Text>

            <TextInput
              value={orderRemarks}
              onChangeText={setOrderRemarks}
              placeholder="Optional remarks"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.textInput, styles.textArea]}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
          </View>

          <Pressable
            onPress={confirmCreateOrder}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryActionButton,
              pressed && styles.pressed,
              saving && styles.disabledButton,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.primaryActionButtonText}>
                  Create Part Order
                </Text>

                <Text style={styles.primaryActionArrow}>→</Text>
              </>
            )}
          </Pressable>
        </>
      );
    }

    if (actionMode === "RECEIVE_PARTS") {
      if (!currentOrder) {
        return null;
      }

      return (
        <>
          <View style={styles.actionHeader}>
            <View style={[styles.actionIcon, styles.actionIconOrdered]}>
              <Text style={styles.actionIconText}>↓</Text>
            </View>

            <View style={styles.actionHeaderCopy}>
              <Text style={styles.actionEyebrow}>ORDER CREATED</Text>

              <Text style={styles.actionTitle}>Receive Parts</Text>

              <Text style={styles.actionDescription}>
                Record the arrival of parts against this Part Order.
              </Text>
            </View>
          </View>

          <View style={styles.orderSummaryCard}>
            <View style={styles.orderSummaryTop}>
              <View>
                <Text style={styles.summaryEyebrow}>PART ORDER</Text>

                <Text style={styles.summaryOrderNo}>
                  {currentOrder.part_order_no}
                </Text>
              </View>

              <View style={styles.summaryTypePill}>
                <Text style={styles.summaryTypeText}>
                  {normalizeOrderType(currentOrder.order_type)}
                </Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            <InfoRow
              label="Ordered At"
              value={formatIndiaDateTime(currentOrder.ordered_at)}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Receipt Details</Text>

            <Text style={styles.fieldLabel}>Parts Received At</Text>

            <Pressable
              onPress={() => openDatePicker("RECEIVED_AT")}
              disabled={saving}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dateIcon}>◷</Text>

              <View style={styles.dateCopy}>
                <Text style={styles.dateValue}>
                  {formatDateForInput(receivedAt)}
                </Text>

                <Text style={styles.dateHint}>Tap to change date/time</Text>
              </View>

              <Text style={styles.dateArrow}>›</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>Remarks</Text>

            <TextInput
              value={receiveRemarks}
              onChangeText={setReceiveRemarks}
              placeholder="Optional remarks"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.textInput, styles.textArea]}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
          </View>

          <Pressable
            onPress={confirmReceiveParts}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryActionButton,
              pressed && styles.pressed,
              saving && styles.disabledButton,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.primaryActionButtonText}>
                  Receive Parts
                </Text>

                <Text style={styles.primaryActionArrow}>→</Text>
              </>
            )}
          </Pressable>
        </>
      );
    }

    if (actionMode === "HAND_OVER") {
      if (!currentOrder) {
        return null;
      }

      return (
        <>
          <View style={styles.actionHeader}>
            <View style={[styles.actionIcon, styles.actionIconReceived]}>
              <Text style={styles.actionIconText}>→</Text>
            </View>

            <View style={styles.actionHeaderCopy}>
              <Text style={styles.actionEyebrow}>PARTS RECEIVED</Text>

              <Text style={styles.actionTitle}>Hand Over to Floor</Text>

              <Text style={styles.actionDescription}>
                Select the Floor Incharge who will receive the parts.
              </Text>
            </View>
          </View>

          <View style={styles.orderSummaryCard}>
            <View style={styles.orderSummaryTop}>
              <View>
                <Text style={styles.summaryEyebrow}>PART ORDER</Text>

                <Text style={styles.summaryOrderNo}>
                  {currentOrder.part_order_no}
                </Text>
              </View>

              <View
                style={[styles.summaryTypePill, styles.summaryTypePillSuccess]}
              >
                <Text
                  style={[
                    styles.summaryTypeText,
                    styles.summaryTypeTextSuccess,
                  ]}
                >
                  RECEIVED
                </Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            <InfoRow
              label="Order Type"
              value={normalizeOrderType(currentOrder.order_type)}
            />

            <InfoRow
              label="Parts Received"
              value={formatIndiaDateTime(currentOrder.parts_received_at)}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Handover Details</Text>

            <Text style={styles.fieldLabel}>
              Floor Incharge <Text style={styles.required}>*</Text>
            </Text>

            <Pressable
              onPress={() => setFloorSelectorVisible(true)}
              disabled={saving}
              style={({ pressed }) => [
                styles.selectorButton,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.selectorIcon}>
                <Text style={styles.selectorIconText}>F</Text>
              </View>

              <View style={styles.selectorCopy}>
                <Text
                  style={[
                    styles.selectorTitle,
                    !selectedFloorIncharge && styles.selectorPlaceholder,
                  ]}
                >
                  {selectedFloorIncharge?.name || "Select Floor Incharge"}
                </Text>

                <Text style={styles.selectorSubtitle}>
                  {selectedFloorIncharge
                    ? "Active Floor Incharge"
                    : "Select the Floor Incharge receiving this vehicle"}
                </Text>
              </View>

              <Text style={styles.selectorArrow}>›</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>Handover At</Text>

            <Pressable
              onPress={() => openDatePicker("HANDOVER_AT")}
              disabled={saving}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dateIcon}>◷</Text>

              <View style={styles.dateCopy}>
                <Text style={styles.dateValue}>
                  {formatDateForInput(handoverAt)}
                </Text>

                <Text style={styles.dateHint}>Tap to change date/time</Text>
              </View>

              <Text style={styles.dateArrow}>›</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>Remarks</Text>

            <TextInput
              value={handoverRemarks}
              onChangeText={setHandoverRemarks}
              placeholder="Optional remarks"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.textInput, styles.textArea]}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
          </View>

          <Pressable
            onPress={confirmHandover}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryActionButton,
              pressed && styles.pressed,
              saving && styles.disabledButton,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.primaryActionButtonText}>
                  Hand Over to Floor
                </Text>

                <Text style={styles.primaryActionArrow}>→</Text>
              </>
            )}
          </Pressable>
        </>
      );
    }

    if (actionMode === "COMPLETED") {
      return (
        <>
          <View style={styles.completedCard}>
            <View style={styles.completedIcon}>
              <Text style={styles.completedIconText}>✓</Text>
            </View>

            <Text style={styles.completedEyebrow}>STORE WORKFLOW COMPLETE</Text>

            <Text style={styles.completedTitle}>Parts Handed to Floor</Text>

            <Text style={styles.completedDescription}>
              The Store has completed the parts workflow for this vehicle. The
              parts have been handed over to Floor.
            </Text>

            {currentOrder ? (
              <View style={styles.completedOrderBox}>
                <Text style={styles.completedOrderLabel}>PART ORDER</Text>

                <Text style={styles.completedOrderNumber}>
                  {currentOrder.part_order_no}
                </Text>

                <Text style={styles.completedOrderType}>
                  {normalizeOrderType(currentOrder.order_type)}
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={goBack}
            style={({ pressed }) => [
              styles.secondaryFullButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryFullButtonText}>
              Back to Store Workspace
            </Text>
          </Pressable>
        </>
      );
    }

    return (
      <View style={styles.unknownCard}>
        <Text style={styles.unknownTitle}>Workflow Status</Text>

        <Text style={styles.unknownText}>
          The current Part Order status does not have a Store action configured.
        </Text>

        {currentOrder ? (
          <Text style={styles.unknownStatus}>
            Current status: {currentOrder.status}
          </Text>
        ) : null}
      </View>
    );
  };

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom", "left", "right"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background}
        />

        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>

          <Text style={styles.loadingTitle}>Loading Vehicle</Text>

          <Text style={styles.loadingDescription}>
            Preparing the Store workflow...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ============================================================
     MAIN UI
  ============================================================ */

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>STORE WORKSPACE</Text>

            <Text style={styles.headerTitle}>Vehicle Action</Text>
          </View>

          <View style={styles.headerStatus}>
            <View style={styles.headerStatusDot} />

            <Text style={styles.headerStatusText}>STORE</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleTop}>
              <View style={styles.vehicleIconBox}>
                <Text style={styles.vehicleIcon}>🚗</Text>
              </View>

              <View style={styles.vehicleMain}>
                <Text style={styles.vehicleNumber}>
                  {vehicle?.vehicle_no || "Vehicle"}
                </Text>

                <Text style={styles.vehicleCustomer}>
                  {vehicle?.customer_name || "Customer name unavailable"}
                </Text>

                <View style={styles.vehicleMetaRow}>
                  {vehicle?.arena_nexa ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>
                        {vehicle.arena_nexa}
                      </Text>
                    </View>
                  ) : null}

                  {vehicle?.model ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{vehicle.model}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.vehicleDivider} />

            <View style={styles.vehicleInfoGrid}>
              <View style={styles.vehicleInfoItem}>
                <Text style={styles.vehicleInfoLabel}>JC NO.</Text>

                <Text style={styles.vehicleInfoValue}>
                  {vehicle?.jc_no || "—"}
                </Text>
              </View>

              <View style={styles.vehicleInfoItem}>
                <Text style={styles.vehicleInfoLabel}>REQUISITION</Text>

                <Text style={styles.vehicleInfoValue}>
                  {requisition?.requisition_no || "—"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.workflowCard}>
            <Text style={styles.workflowTitle}>Parts Workflow</Text>

            <View style={styles.workflowSteps}>
              <View style={styles.workflowStep}>
                <View
                  style={[styles.workflowCircle, styles.workflowCircleDone]}
                >
                  <Text style={styles.workflowCircleText}>✓</Text>
                </View>

                <Text style={styles.workflowStepText}>Requested</Text>
              </View>

              <View
                style={[styles.workflowLine, order && styles.workflowLineDone]}
              />

              <View style={styles.workflowStep}>
                <View
                  style={[
                    styles.workflowCircle,
                    order && styles.workflowCircleDone,
                    !order && styles.workflowCircleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.workflowCircleText,
                      !order && styles.workflowCircleTextActive,
                    ]}
                  >
                    2
                  </Text>
                </View>

                <Text style={styles.workflowStepText}>Ordered</Text>
              </View>

              <View
                style={[
                  styles.workflowLine,
                  (order?.status === "RECEIVED" ||
                    order?.status === "HANDED_TO_FLOOR") &&
                    styles.workflowLineDone,
                ]}
              />

              <View style={styles.workflowStep}>
                <View
                  style={[
                    styles.workflowCircle,
                    (order?.status === "RECEIVED" ||
                      order?.status === "HANDED_TO_FLOOR") &&
                      styles.workflowCircleDone,
                    order?.status !== "RECEIVED" &&
                      order?.status !== "HANDED_TO_FLOOR" &&
                      styles.workflowCircleInactive,
                  ]}
                >
                  <Text style={styles.workflowCircleText}>3</Text>
                </View>

                <Text style={styles.workflowStepText}>Received</Text>
              </View>

              <View
                style={[
                  styles.workflowLine,
                  order?.status === "HANDED_TO_FLOOR" &&
                    styles.workflowLineDone,
                ]}
              />

              <View style={styles.workflowStep}>
                <View
                  style={[
                    styles.workflowCircle,
                    order?.status === "HANDED_TO_FLOOR" &&
                      styles.workflowCircleDone,
                    order?.status !== "HANDED_TO_FLOOR" &&
                      styles.workflowCircleInactive,
                  ]}
                >
                  <Text style={styles.workflowCircleText}>4</Text>
                </View>

                <Text style={styles.workflowStepText}>Floor</Text>
              </View>
            </View>
          </View>

          {requisition ? (
            <View style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.requestIcon}>
                  <Text style={styles.requestIconText}>#</Text>
                </View>

                <View>
                  <Text style={styles.requestEyebrow}>PARTS REQUEST</Text>

                  <Text style={styles.requestTitle}>
                    {requisition.requisition_no}
                  </Text>
                </View>
              </View>

              <View style={styles.requestInfo}>
                <InfoRow
                  label="Requested At"
                  value={formatIndiaDateTime(requisition.requisition_at)}
                />

                <InfoRow label="Request Status" value={requisition.status} />

                {requisition.remarks ? (
                  <InfoRow label="Remarks" value={requisition.remarks} />
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.currentActionHeading}>
            <View>
              <Text style={styles.currentActionEyebrow}>CURRENT ACTION</Text>

              <Text style={styles.currentActionTitle}>
                {actionMode === "CREATE_ORDER"
                  ? "Part Order Required"
                  : actionMode === "RECEIVE_PARTS"
                    ? "Parts Awaiting Receipt"
                    : actionMode === "HAND_OVER"
                      ? "Ready for Floor"
                      : actionMode === "COMPLETED"
                        ? "Workflow Complete"
                        : "Review Status"}
              </Text>
            </View>
          </View>

          {renderActionContent()}

          <Text style={styles.footerText}>PAGARIYA AUTO • STORE WORKSPACE</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={floorSelectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFloorSelectorVisible(false)}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorModal}>
            <View style={styles.selectorModalHeader}>
              <View>
                <Text style={styles.selectorModalEyebrow}>FLOOR HANDOVER</Text>

                <Text style={styles.selectorModalTitle}>
                  Select Floor Incharge
                </Text>
              </View>

              <Pressable
                onPress={() => setFloorSelectorVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.floorList}
              contentContainerStyle={styles.floorListContent}
              showsVerticalScrollIndicator={false}
            >
              {floorIncharges.length === 0 ? (
                <View style={styles.noFloorCard}>
                  <Text style={styles.noFloorTitle}>
                    No Floor Incharge Found
                  </Text>

                  <Text style={styles.noFloorText}>
                    There are currently no active Floor Incharge profiles
                    available.
                  </Text>
                </View>
              ) : (
                floorIncharges.map((floor) => {
                  const selected = selectedFloorInchargeId === floor.id;

                  return (
                    <Pressable
                      key={floor.id}
                      onPress={() => {
                        setSelectedFloorInchargeId(floor.id);
                        setFloorSelectorVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.floorItem,
                        selected && styles.floorItemSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.floorAvatar,
                          selected && styles.floorAvatarSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.floorAvatarText,
                            selected && styles.floorAvatarTextSelected,
                          ]}
                        >
                          {(floor.name || "F").charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.floorCopy}>
                        <Text style={styles.floorName}>
                          {floor.name || "Unnamed"}
                        </Text>

                        <Text style={styles.floorPhone}>
                          Active Floor Incharge
                        </Text>
                      </View>

                      {selected ? (
                        <View style={styles.selectedCheck}>
                          <Text style={styles.selectedCheckText}>✓</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
        </SafeAreaView>
      </Modal>

      {pickerTarget ? (
        <DateTimePicker
          value={getPickerDate()}
          mode={Platform.OS === "ios" ? "datetime" : androidPickerMode}
          display="default"
          onChange={handleDatePickerChange}
        />
      ) : null}

      <CustomPopup popup={popup} onClose={closePopup} />
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },

  pressed: {
    opacity: 0.82,
  },

  disabledButton: {
    opacity: 0.55,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    marginBottom: 18,
  },

  loadingTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: COLORS.text,
  },

  loadingDescription: {
    marginTop: 7,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  header: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12,
  },

  backButtonText: {
    fontSize: 31,
    lineHeight: 34,
    fontWeight: "400",
    color: COLORS.text,
    marginTop: -2,
  },

  headerCopy: {
    flex: 1,
  },

  headerEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: COLORS.primary,
  },

  headerTitle: {
    marginTop: 2,
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.text,
  },

  headerStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.successSoft,
  },

  headerStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },

  headerStatusText: {
    fontSize: 9,
    fontWeight: "900",
    color: COLORS.success,
    letterSpacing: 0.8,
  },

  vehicleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 23,
    padding: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },

  vehicleTop: {
    flexDirection: "row",
  },

  vehicleIconBox: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    marginRight: 13,
  },

  vehicleIcon: {
    fontSize: 23,
  },

  vehicleMain: {
    flex: 1,
  },

  vehicleNumber: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    color: COLORS.text,
  },

  vehicleCustomer: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  vehicleMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 9,
    gap: 6,
  },

  metaPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  metaPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.textSecondary,
  },

  vehicleDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 15,
  },

  vehicleInfoGrid: {
    flexDirection: "row",
    gap: 10,
  },

  vehicleInfoItem: {
    flex: 1,
    padding: 11,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSoft,
  },

  vehicleInfoLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },

  vehicleInfoValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  workflowCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },

  workflowTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 16,
  },

  workflowSteps: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  workflowStep: {
    width: 54,
    alignItems: "center",
  },

  workflowCircle: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },

  workflowCircleDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },

  workflowCircleActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },

  workflowCircleInactive: {
    backgroundColor: COLORS.surfaceSoft,
  },

  workflowCircleText: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.textMuted,
  },

  workflowCircleTextActive: {
    color: COLORS.primary,
  },

  workflowLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.border,
    marginTop: 15,
  },

  workflowLineDone: {
    backgroundColor: COLORS.success,
  },

  workflowStepText: {
    marginTop: 7,
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  requestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 18,
  },

  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  requestIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.warningSoft,
    marginRight: 11,
  },

  requestIconText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.warning,
  },

  requestEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textMuted,
  },

  requestTitle: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },

  requestInfo: {
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
  },

  infoLabel: {
    width: 110,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  infoValue: {
    flex: 1,
    fontSize: 11,
    color: COLORS.text,
    fontWeight: "800",
    textAlign: "right",
  },

  currentActionHeading: {
    marginBottom: 11,
    paddingHorizontal: 2,
  },

  currentActionEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: COLORS.primary,
  },

  currentActionTitle: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },

  actionHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },

  actionIcon: {
    width: 49,
    height: 49,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  actionIconRequest: {
    backgroundColor: COLORS.warningSoft,
  },

  actionIconOrdered: {
    backgroundColor: COLORS.infoSoft,
  },

  actionIconReceived: {
    backgroundColor: COLORS.successSoft,
  },

  actionIconText: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
  },

  actionHeaderCopy: {
    flex: 1,
  },

  actionEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textMuted,
  },

  actionTitle: {
    marginTop: 3,
    fontSize: 19,
    fontWeight: "900",
    color: COLORS.text,
  },

  actionDescription: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 15,
  },

  fieldLabel: {
    marginTop: 13,
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.text,
  },

  required: {
    color: COLORS.primary,
  },

  fieldHint: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.textMuted,
  },

  textInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSoft,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  textArea: {
    minHeight: 95,
    paddingTop: 12,
  },

  orderTypeGrid: {
    gap: 8,
  },

  orderTypeCard: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },

  orderTypeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },

  orderTypeRadio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  orderTypeRadioSelected: {
    borderColor: COLORS.primary,
  },

  orderTypeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },

  orderTypeCopy: {
    flex: 1,
  },

  orderTypeLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.text,
  },

  orderTypeLabelSelected: {
    color: COLORS.primary,
  },

  orderTypeDescription: {
    marginTop: 2,
    fontSize: 10,
    color: COLORS.textSecondary,
  },

  dateButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceSoft,
    paddingHorizontal: 12,
  },

  dateIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: COLORS.infoSoft,
    color: COLORS.info,
    fontSize: 18,
    marginRight: 10,
  },

  dateCopy: {
    flex: 1,
  },

  dateValue: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },

  dateHint: {
    marginTop: 2,
    fontSize: 9,
    color: COLORS.textMuted,
  },

  dateArrow: {
    fontSize: 26,
    color: COLORS.textMuted,
    marginLeft: 8,
  },

  orderSummaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },

  orderSummaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textMuted,
  },

  summaryOrderNo: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },

  summaryTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.infoSoft,
  },

  summaryTypePillSuccess: {
    backgroundColor: COLORS.successSoft,
  },

  summaryTypeText: {
    fontSize: 9,
    fontWeight: "900",
    color: COLORS.info,
    letterSpacing: 0.7,
  },

  summaryTypeTextSuccess: {
    color: COLORS.success,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 13,
  },

  selectorButton: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
  },

  selectorIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.purpleSoft,
    marginRight: 10,
  },

  selectorIconText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.purple,
  },

  selectorCopy: {
    flex: 1,
  },

  selectorTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.text,
  },

  selectorPlaceholder: {
    color: COLORS.textMuted,
  },

  selectorSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: COLORS.textSecondary,
  },

  selectorArrow: {
    fontSize: 27,
    color: COLORS.textMuted,
  },

  primaryActionButton: {
    minHeight: 58,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 2,
    marginBottom: 18,
  },

  primaryActionButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.white,
  },

  primaryActionArrow: {
    marginLeft: 12,
    fontSize: 21,
    fontWeight: "800",
    color: COLORS.white,
  },

  completedCard: {
    backgroundColor: COLORS.successSoft,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#BCE7CD",
    padding: 22,
    alignItems: "center",
  },

  completedIcon: {
    width: 66,
    height: 66,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
    marginBottom: 15,
  },

  completedIconText: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.white,
  },

  completedEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: COLORS.success,
  },

  completedTitle: {
    marginTop: 5,
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },

  completedDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  completedOrderBox: {
    width: "100%",
    marginTop: 18,
    padding: 14,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    alignItems: "center",
  },

  completedOrderLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    color: COLORS.textMuted,
  },

  completedOrderNumber: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },

  completedOrderType: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },

  secondaryFullButton: {
    minHeight: 55,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  secondaryFullButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.text,
  },

  unknownCard: {
    padding: 20,
    borderRadius: 21,
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: "#F0D58A",
  },

  unknownTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.text,
  },

  unknownText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  unknownStatus: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.warning,
  },

  selectorOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },

  selectorModal: {
    maxHeight: "82%",
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
  },

  selectorModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  selectorModalEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: COLORS.primary,
  },

  selectorModalTitle: {
    marginTop: 3,
    fontSize: 19,
    fontWeight: "900",
    color: COLORS.text,
  },

  modalCloseButton: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSoft,
  },

  modalCloseText: {
    fontSize: 26,
    lineHeight: 28,
    color: COLORS.textSecondary,
  },

  floorList: {
    maxHeight: 500,
  },

  floorListContent: {
    padding: 15,
    gap: 9,
  },

  floorItem: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },

  floorItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },

  floorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.purpleSoft,
    marginRight: 11,
  },

  floorAvatarSelected: {
    backgroundColor: COLORS.primary,
  },

  floorAvatarText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.purple,
  },

  floorAvatarTextSelected: {
    color: COLORS.white,
  },

  floorCopy: {
    flex: 1,
  },

  floorName: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.text,
  },

  floorPhone: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  selectedCheck: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
  },

  selectedCheckText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.white,
  },

  noFloorCard: {
    padding: 20,
    borderRadius: 17,
    backgroundColor: COLORS.warningSoft,
  },

  noFloorTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.text,
  },

  noFloorText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  popupOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(15,23,42,0.5)",
  },

  popupCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 25,
    backgroundColor: COLORS.surface,
    padding: 22,
    alignItems: "center",
  },

  popupIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
    backgroundColor: COLORS.infoSoft,
  },

  popupIconSuccess: {
    backgroundColor: COLORS.successSoft,
  },

  popupIconError: {
    backgroundColor: COLORS.dangerSoft,
  },

  popupIconWarning: {
    backgroundColor: COLORS.warningSoft,
  },

  popupIconInfo: {
    backgroundColor: COLORS.infoSoft,
  },

  popupIconText: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    color: COLORS.text,
  },

  popupTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },

  popupMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  popupButtons: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
    marginTop: 19,
  },

  popupSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  popupSecondaryButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textSecondary,
  },

  popupPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  popupPrimaryButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.white,
  },

  footerText: {
    marginTop: 10,
    marginBottom: 10,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: COLORS.textMuted,
  },
});
