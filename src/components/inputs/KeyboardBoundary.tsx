import type { ReactNode } from "react";
import { View } from "react-native";
import { dismissOnOutsideTouch } from "./keyboard-focus";

export default function KeyboardBoundary({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }} onStartShouldSetResponderCapture={dismissOnOutsideTouch}>
    {children}
  </View>;
}
