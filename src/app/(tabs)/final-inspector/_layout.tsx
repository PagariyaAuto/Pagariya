import { Stack } from "expo-router";

export default function FinalInspectorLayout() {
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="inspections/index" />
    <Stack.Screen name="inspections/[visitId]" />
    <Stack.Screen name="vehicles" />
  </Stack>;
}
