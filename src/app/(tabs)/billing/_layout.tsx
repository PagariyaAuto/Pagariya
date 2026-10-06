import { Stack } from "expo-router";
export default function BillingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="vehicles" />
      <Stack.Screen name="vehicle" />
    </Stack>
  );
}
