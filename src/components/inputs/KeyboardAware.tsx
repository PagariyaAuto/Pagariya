import { createContext, forwardRef, useContext, useEffect, useRef, type Ref } from "react";
import {
  Keyboard, KeyboardAvoidingView as NativeAvoidingView, Modal as NativeModal,
  Platform, ScrollView as NativeScrollView, TextInput as NativeTextInput,
  type KeyboardAvoidingViewProps, type ModalProps, type ScrollViewProps, type TextInputProps,
} from "react-native";
import KeyboardBoundary from "./KeyboardBoundary";
import { registerInput, unregisterInput } from "./keyboard-focus";

type RevealInput = (input: NativeTextInput | null) => void;
const RevealContext = createContext<RevealInput>(() => {});
const AvoidingContext = createContext(false);
const ignoreReveal: RevealInput = () => {};
function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function KeyboardTextInput({ onFocus, onBlur, ...props }, ref) {
  const input = useRef<NativeTextInput | null>(null);
  const reveal = useContext(RevealContext);
  return <NativeTextInput {...props} ref={value => {
    if (input.current) unregisterInput(input.current);
    input.current = value;
    if (value) registerInput(value);
    assignRef(ref, value);
  }}
    onFocus={event => { onFocus?.(event); reveal(input.current); }}
    onBlur={event => { onBlur?.(event); reveal(null); }} />;
});
// Preserve instance types used by existing refs, without changing callers.
export type TextInput = NativeTextInput;

export const ScrollView = forwardRef<NativeScrollView, ScrollViewProps>(function KeyboardScrollView({ children, onLayout, ...props }, ref) {
  const scroll = useRef<NativeScrollView | null>(null);
  const focused = useRef<NativeTextInput | null>(null);
  const avoiding = useContext(AvoidingContext);
  const frame = useRef<number | null>(null);
  const reveal: RevealInput = input => {
    focused.current = input;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const current = focused.current;
      if (!current?.isFocused()) return;
      if (Platform.OS === "web") {
        // Browser/OS viewport resizing handles the keyboard; nearest avoids
        // moving an already visible field or changing the surrounding layout.
        (current as unknown as HTMLElement).scrollIntoView?.({ block: "nearest", inline: "nearest" });
      } else if (Keyboard.isVisible()) {
        scroll.current?.scrollResponderScrollNativeHandleToKeyboard(current, 20, true);
      }
    });
  };
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => revealRef.current(focused.current));
    return () => { subscription.remove(); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);
  return <RevealContext.Provider value={reveal}>
    <NativeScrollView {...props}
      ref={value => { scroll.current = value; assignRef(ref, value); }}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode={props.keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")}
      automaticallyAdjustKeyboardInsets={props.automaticallyAdjustKeyboardInsets ?? !avoiding}
      onLayout={event => { onLayout?.(event); reveal(focused.current); }}>
      {children}
    </NativeScrollView>
  </RevealContext.Provider>;
});
export type ScrollView = NativeScrollView;

export function KeyboardAvoidingView({ children, ...props }: KeyboardAvoidingViewProps) {
  const parentAvoids = useContext(AvoidingContext);
  const avoids = parentAvoids || (props.enabled !== false && !!props.behavior);
  return <AvoidingContext.Provider value={avoids}>
    <NativeAvoidingView {...props}>{children}</NativeAvoidingView>
  </AvoidingContext.Provider>;
}

export function Modal({ children, ...props }: ModalProps) {
  // Native modals are separate windows: the root boundary cannot see their taps.
  return <NativeModal {...props}><AvoidingContext.Provider value={false}>
    <RevealContext.Provider value={ignoreReveal}>
      <KeyboardBoundary>{children}</KeyboardBoundary>
    </RevealContext.Provider>
  </AvoidingContext.Provider></NativeModal>;
}
