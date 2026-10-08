import { createContext, forwardRef, useContext, useEffect, useRef, useState, type Ref } from "react";
import {
  Dimensions, Keyboard, KeyboardAvoidingView as NativeAvoidingView, Modal as NativeModal,
  Platform, ScrollView as NativeScrollView, TextInput as NativeTextInput, View,
  type KeyboardAvoidingViewProps, type ModalProps, type ScrollViewProps, type TextInputProps,
  type KeyboardEvent,
} from "react-native";
import KeyboardBoundary from "./KeyboardBoundary";
import { registerInput, unregisterInput } from "./keyboard-focus";
import { keyboardRevealDelta } from "./keyboard-visibility";

type RevealInput = (input: NativeTextInput | null, blurred?: NativeTextInput | null) => void;
const RevealContext = createContext<RevealInput>(() => {});
const AvoidingContext = createContext(false);
const ignoreReveal: RevealInput = () => {};
function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function KeyboardTextInput({ onFocus, onBlur, onContentSizeChange, onSelectionChange, ...props }, ref) {
  const input = useRef<NativeTextInput | null>(null);
  const reveal = useContext(RevealContext);
  return <NativeTextInput {...props} ref={value => {
    if (input.current) unregisterInput(input.current);
    input.current = value;
    if (value) registerInput(value);
    assignRef(ref, value);
  }}
    onFocus={event => { onFocus?.(event); reveal(input.current); }}
    onBlur={event => { onBlur?.(event); reveal(null, input.current); }}
    onContentSizeChange={event => { onContentSizeChange?.(event); if (input.current?.isFocused()) reveal(input.current); }}
    onSelectionChange={event => { onSelectionChange?.(event); if (input.current?.isFocused()) reveal(input.current); }} />;
});
export type TextInput = NativeTextInput;

export const ScrollView = forwardRef<NativeScrollView, ScrollViewProps>(function KeyboardScrollView({ children, onLayout, onScroll, onContentSizeChange, ...props }, ref) {
  const scroll = useRef<NativeScrollView | null>(null);
  const focused = useRef<NativeTextInput | null>(null);
  const avoiding = useContext(AvoidingContext);
  const frame = useRef<number | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const offset = useRef(0);
  const keyboard = useRef<KeyboardEvent["endCoordinates"] | undefined>(undefined);
  const [bottomSpace, setBottomSpace] = useState(0);
  const space = useRef(0);
  const automaticInsets = props.automaticallyAdjustKeyboardInsets ?? (Platform.OS === "ios" && !avoiding);

  const reveal: RevealInput = (input, blurred) => {
    if (!input && blurred && focused.current !== blurred) return;
    focused.current = input;
    const request = ++generation.current;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (!input) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const current = focused.current;
      const owner = scroll.current;
      const active = () => mounted.current && generation.current === request && focused.current === current && current?.isFocused();
      if (!current || !owner || !active()) return;

      if (Platform.OS === "web") {
        const element = current as unknown as HTMLElement;
        const container = owner.getScrollableNode() as HTMLElement | null;
        if (!element.getBoundingClientRect || !container?.getBoundingClientRect) return;
        const field = element.getBoundingClientRect();
        const bounds = container.getBoundingClientRect();
        const visual = globalThis.window?.visualViewport;
        const top = Math.max(bounds.top, visual?.offsetTop ?? 0);
        const bottom = Math.min(bounds.bottom, visual ? visual.offsetTop + visual.height : globalThis.window.innerHeight);
        const overlap = Math.max(0, bounds.bottom - bottom);
        // Use the visual viewport on mobile browsers, rather than scrollIntoView,
        // which can move unrelated ancestors and ignores some keyboard overlays.
        if (space.current !== overlap) { space.current = overlap; setBottomSpace(overlap); return; }
        const delta = keyboardRevealDelta(field, { top, bottom });
        if (Math.abs(delta) > 1 && active()) owner.scrollTo({ y: Math.max(0, container.scrollTop + delta), animated: true });
        return;
      }

      owner.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        if (!active() || height <= 0) return;
        current.measureInWindow((fieldX, fieldTop, fieldWidth, fieldHeight) => {
          if (!active() || fieldHeight <= 0) return;
          const metrics = keyboard.current ?? Keyboard.metrics();
          const intersects = !!metrics && metrics.height > 0 && metrics.screenY > 0 &&
            fieldX < metrics.screenX + metrics.width && fieldX + fieldWidth > metrics.screenX;
          const bottom = intersects ? Math.min(top + height, metrics.screenY) : top + height;
          const overlap = Platform.OS === "ios" && automaticInsets ? 0 : Math.max(0, top + height - bottom);
          // Resized windows/KAVs already provide space. Add only the remaining
          // overlay, never a second full keyboard-height padding.
          if (space.current !== overlap) { space.current = overlap; setBottomSpace(overlap); return; }
          const delta = keyboardRevealDelta({ top: fieldTop, bottom: fieldTop + fieldHeight }, { top, bottom });
          if (Math.abs(delta) > 1 && active()) owner.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
        });
      });
    });
  };
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => { revealRef.current(focused.current); }, [bottomSpace]);
  useEffect(() => {
    mounted.current = true;
    const show = (event: KeyboardEvent) => { keyboard.current = event.endCoordinates; revealRef.current(focused.current); };
    const hide = () => {
      keyboard.current = undefined;
      generation.current++;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      space.current = 0;
      setBottomSpace(0);
    };
    const subscriptions = [Keyboard.addListener("keyboardDidShow", show), Keyboard.addListener("keyboardDidHide", hide)];
    if (Platform.OS === "ios") subscriptions.push(Keyboard.addListener("keyboardDidChangeFrame", show));
    const resize = Dimensions.addEventListener("change", () => revealRef.current(focused.current));
    const visual = Platform.OS === "web" ? globalThis.window?.visualViewport : null;
    const update = () => revealRef.current(focused.current);
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    return () => {
      mounted.current = false;
      generation.current++;
      subscriptions.forEach(subscription => subscription.remove());
      resize.remove();
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);
  return <RevealContext.Provider value={reveal}>
    <NativeScrollView {...props}
      ref={value => { scroll.current = value; assignRef(ref, value); }}
      keyboardShouldPersistTaps="always"
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      keyboardDismissMode={props.keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")}
      automaticallyAdjustKeyboardInsets={automaticInsets}
      onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
      onContentSizeChange={(width, height) => { onContentSizeChange?.(width, height); reveal(focused.current); }}
      onLayout={event => { onLayout?.(event); reveal(focused.current); }}>
      {children}
      {bottomSpace > 0 && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: bottomSpace, flexShrink: 0 }} />}
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
  return <NativeModal {...props}><AvoidingContext.Provider value={false}>
    <RevealContext.Provider value={ignoreReveal}>
      <KeyboardBoundary>{children}</KeyboardBoundary>
    </RevealContext.Provider></AvoidingContext.Provider></NativeModal>;
}
