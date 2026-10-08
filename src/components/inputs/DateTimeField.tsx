import Ionicons from "@expo/vector-icons/Ionicons";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useIsFocused } from "expo-router";
import { createElement, useEffect, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  clampDateTime,
  formatDateTimeIST,
  indiaLocalValue,
  mergeIndiaSelection,
  parseDateTime,
  parseIndiaLocal,
  resolveDateTimeBounds,
  validateDateTime,
  type DateTimeBounds,
} from "../../lib/date-time";
import { colors } from "../../theme";

const NativePicker =
  Platform.OS === "ios" || Platform.OS === "android"
    ? require("@react-native-community/datetimepicker").default
    : null;

export type DateTimeFieldProps = DateTimeBounds & {
  title: string;
  description?: string;
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  // Report rejected selections so the parent can block Submit and show its popup.
  onValidationError?: (error: string | null) => void;
  error?: string | null;
  disabled?: boolean;
  active?: boolean;
};

/** Pagariya date/time card. No database calls, workflow rules or popup ownership. */
export default function DateTimeField({
  title,
  description,
  label = "Date & time",
  value,
  onChange,
  onValidationError,
  minimumDate,
  maximumDate,
  required = false,
  minimumMessage,
  maximumMessage,
  error,
  disabled = false,
  active = true,
}: DateTimeFieldProps) {
  const focused = useIsFocused();
  const enabled = focused && active && !disabled;
  const bounds: DateTimeBounds = {
    minimumDate,
    maximumDate,
    required,
    minimumMessage,
    maximumMessage,
  };
  const [picker, setPicker] = useState<"date" | "time" | "datetime" | null>(
    null,
  );
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerNow, setPickerNow] = useState(Date.now());
  const [webFocused, setWebFocused] = useState(false);
  const [webFallback, setWebFallback] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const { minimum, maximum } = resolveDateTimeBounds(bounds, pickerNow);
  const configurationError = validateDateTime(
    null,
    { ...bounds, required: false },
    pickerNow,
  );
  const shownError =
    error ||
    selectionError ||
    configurationError ||
    (value ? validateDateTime(value, bounds, pickerNow) : null);

  useEffect(() => {
    if (!enabled) {
      setPicker(null);
      setWebFocused(false);
    }
  }, [enabled]);
  useEffect(() => {
    // External resets may clear an old error; invalid edits must keep theirs.
    if (
      !validateDateTime(value, {
        minimumDate,
        maximumDate,
        required,
        minimumMessage,
        maximumMessage,
      })
    )
      setSelectionError(null);
  }, [
    value,
    minimumDate,
    maximumDate,
    required,
    minimumMessage,
    maximumMessage,
  ]);
  useEffect(() => {
    // Do not rerender Android's dialog every second; its callback opens a dialog.
    if (!enabled || Platform.OS !== "web" || maximumDate !== "now") return;
    setPickerNow(Date.now());
    const timer = setInterval(() => setPickerNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled, maximumDate]);

  const reportError = (issue: string | null) => {
    setSelectionError(issue);
    onValidationError?.(issue);
  };
  const openPicker = () => {
    if (!enabled) return;
    const now = Date.now();
    const issue = validateDateTime(null, { ...bounds, required: false }, now);
    if (issue) {
      reportError(issue);
      return;
    }
    Keyboard.dismiss();
    setPickerNow(now);
    setPickerDate(
      clampDateTime(parseDateTime(value) || new Date(now), bounds, now),
    );
    setPicker(Platform.OS === "ios" ? "datetime" : "date");
  };
  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!enabled || event.type !== "set" || !selected || !picker) {
      setPicker(null);
      return;
    }
    if (Platform.OS === "android") setPicker(null);
    const merged = mergeIndiaSelection(pickerDate, selected, picker);
    const candidate =
      picker === "date" ? clampDateTime(merged, bounds) : merged;
    const issue = validateDateTime(candidate.toISOString(), bounds);
    if (issue) {
      reportError(issue);
      return;
    }
    setPickerDate(candidate);
    onChange(candidate.toISOString());
    reportError(null);
    if (Platform.OS === "android" && picker === "date") setPicker("time");
  };
  const showWebPicker = (event: {
    currentTarget: { showPicker?: () => void };
  }) => {
    if (!enabled || webFallback) return;
    if (!event.currentTarget.showPicker) {
      setWebFallback(true);
      return;
    }
    try {
      event.currentTarget.showPicker();
    } catch {
      setWebFallback(true);
    }
  };
  const summary = (
    <>
      <View
        style={styles.grow}
        pointerEvents="none"
        accessibilityElementsHidden={Platform.OS === "web"}
      >
        <Text style={styles.caption}>
          {label}
          {required ? " *" : ""} · IST
        </Text>
        <Text style={styles.selected}>{formatDateTimeIST(value)}</Text>
      </View>
      <View
        style={styles.calendar}
        pointerEvents="none"
        accessibilityElementsHidden
      >
        <Ionicons name="calendar" size={21} color={colors.primary} />
      </View>
    </>
  );

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.title}>{title}</Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
      {Platform.OS === "web" ? (
        <View
          style={[
            styles.summary,
            webFocused && styles.focused,
            !!shownError && styles.invalid,
            !enabled && styles.disabled,
          ]}
        >
          {summary}
          {createElement("input", {
            type: "datetime-local",
            "aria-label": `${label}${required ? ", required" : ""}, in IST`,
            "aria-invalid": !!shownError,
            value: parseDateTime(value)
              ? indiaLocalValue(parseDateTime(value)!)
              : "",
            min: minimum
              ? indiaLocalValue(
                  new Date(Math.ceil(minimum.getTime() / 1000) * 1000),
                )
              : undefined,
            max: maximum ? indiaLocalValue(maximum) : undefined,
            step: 1,
            required,
            disabled: !enabled || !!configurationError,
            onFocus: () => {
              setPickerNow(Date.now());
              setWebFocused(true);
            },
            onBlur: () => setWebFocused(false),
            onClick: showWebPicker,
            onKeyDown: (event: {
              key: string;
              currentTarget: { showPicker?: () => void };
            }) => {
              if (event.key === "Enter" || event.key === " ")
                showWebPicker(event);
            },
            onChange: (event: { currentTarget: { value: string } }) => {
              if (!enabled) return;
              const selected = parseIndiaLocal(event.currentTarget.value);
              const next = selected?.toISOString() || null;
              onChange(next);
              reportError(
                event.currentTarget.value && !selected
                  ? "Choose a valid date and time."
                  : validateDateTime(next, bounds),
              );
            },
            style: webFallback
              ? {
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: 44,
                  padding: 8,
                  border: "1px solid " + colors.border,
                  borderRadius: 8,
                  color: colors.text,
                  backgroundColor: colors.surface,
                  fontFamily: "inherit",
                  fontSize: 14,
                  colorScheme: "light",
                }
              : {
                  position: "absolute",
                  inset: 0,
                  boxSizing: "border-box",
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: enabled ? "pointer" : "default",
                  colorScheme: "light",
                },
          })}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose ${label}${required ? ", required" : ""}. Selected: ${formatDateTimeIST(value)} IST`}
          accessibilityState={{ disabled: !enabled || !!configurationError }}
          disabled={!enabled || !!configurationError}
          onPress={openPicker}
          style={({ pressed }) => [
            styles.summary,
            !!shownError && styles.invalid,
            pressed && styles.pressed,
            !enabled && styles.disabled,
          ]}
        >
          {summary}
        </Pressable>
      )}
      {!!shownError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {shownError}
        </Text>
      )}
      {enabled && !!NativePicker && picker && (
        <View style={styles.heading}>
          <NativePicker
            value={pickerDate}
            mode={picker}
            timeZoneName="Asia/Kolkata"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onPickerChange}
            minimumDate={minimum || undefined}
            maximumDate={maximum || undefined}
            onError={() => {
              setPicker(null);
              reportError("The date picker could not open. Please try again.");
            }}
          />
          {Platform.OS === "ios" && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPicker(null)}
              style={styles.done}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  heading: { gap: 4 },
  title: { color: colors.text, fontSize: 19, fontWeight: "800" },
  description: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
  summary: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    minHeight: 68,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: "#B42318" },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  caption: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  selected: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 21,
  },
  calendar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: "#B42318", fontSize: 12, lineHeight: 18 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  done: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignSelf: "flex-end",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  doneText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
});
