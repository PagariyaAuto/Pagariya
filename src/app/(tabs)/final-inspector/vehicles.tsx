import { Redirect, useLocalSearchParams } from "expo-router";

// Preserve links from the previous Final Inspector vehicle screen.
export default function LegacyInspectionRoute() {
  const params = useLocalSearchParams<{ visitId?: string | string[] }>();
  const visitId = (Array.isArray(params.visitId) ? params.visitId[0] : params.visitId)?.trim();
  if (!visitId) return <Redirect href={"/(tabs)/final-inspector/inspections" as any} />;
  return <Redirect href={{ pathname: "/(tabs)/final-inspector/inspections/[visitId]" as any, params: { visitId } }} />;
}
