import { useCallback } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";

// Reject repeated route parameters instead of guessing a navigation origin.
export function singleParam(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Pop an existing Stack destination when possible; hidden tab routes use replacement.
export function returnToRoute(destination: Href) {
  if (router.canDismiss()) router.dismissTo(destination);
  else router.replace(destination);
}

export function useHardwareBack(handler: () => void, enabled = true) {
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handler();
      return true;
    });
    return () => subscription.remove();
  }, [handler, enabled]));
}
