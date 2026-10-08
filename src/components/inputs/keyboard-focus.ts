import { findNodeHandle, Keyboard, Platform, TextInput, type GestureResponderEvent } from "react-native";

const inputs = new Set<TextInput>();
export function registerInput(input: TextInput) { inputs.add(input); }
export function unregisterInput(input: TextInput) { inputs.delete(input); }

type InputTarget = { closest?: (selector: string) => unknown };

export function isInputTarget(target: unknown): boolean {
  if (!target) return false;
  if (Platform.OS === "web") {
    return !!(target as InputTarget).closest?.("input, textarea, [contenteditable='true']");
  }
  // Fabric supplies a host instance; older event targets can be native tags.
  return inputs.has(target as TextInput) || (typeof target === "number" &&
    [...inputs].some(input => findNodeHandle(input) === target));
}

/** Observe a touch without acquiring the responder or cancelling the button. */
export function dismissOnOutsideTouch(event: GestureResponderEvent): false {
  if (isInputTarget(event.target)) return false;
  if (Platform.OS === "web") {
    const focused = globalThis.document?.activeElement;
    if (focused && isInputTarget(focused) && "blur" in focused)
      (focused as HTMLElement).blur();
  } else if (TextInput.State.currentlyFocusedInput()) {
    Keyboard.dismiss();
  }
  return false;
}
