import { useLocalSearchParams } from "expo-router";
import BillingWorkspace from "../../../components/billing/BillingWorkspace";
export default function BillingVehicle() {
  const { visitId } = useLocalSearchParams<{ visitId?: string | string[] }>();
  return (
    <BillingWorkspace
      visitId={Array.isArray(visitId) ? visitId[0] : visitId || ""}
    />
  );
}
