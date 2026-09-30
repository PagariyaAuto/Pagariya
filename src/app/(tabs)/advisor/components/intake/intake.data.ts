import { router } from "expo-router";
import { supabase } from "../../../../../../lib/supabase";
import type { DocumentMaster, GateEntry, InsuranceCompany, MiMaster, VehicleModel, VehicleRecord, VehicleType, VisitRecord } from "./intake.types";
import { normalizeMobile } from "./intake.validation";

export async function loadMasterData() {
  const [modelResult, insuranceResult, miResult] = await Promise.all([
    supabase.from("vehicle_models").select("id, name, arena_nexa, is_active").order("name", { ascending: true }),
    supabase.from("insurance_companies").select("id, name, is_active").order("name", { ascending: true }),
    supabase.from("mi_types").select("id, name, code, is_active").order("name", { ascending: true }),
  ]);
  if (modelResult.error) throw modelResult.error;
  if (insuranceResult.error) throw insuranceResult.error;
  if (miResult.error) throw miResult.error;
  const models = (modelResult.data ?? []).filter((x) => x.is_active !== false) as VehicleModel[];
  const insurance = (insuranceResult.data ?? []).filter((x) => x.is_active !== false) as InsuranceCompany[];
  const mi = (miResult.data ?? []).filter((x) => x.is_active !== false) as MiMaster[];
  return { models, insurance, mi };
}

export async function loadDocuments(currentVehicleType: VehicleType): Promise<{ documents: DocumentMaster[]; checklist: Record<string, boolean> }> {
  const { data, error } = await supabase.from("document_master").select("id, name, vehicle_type, workflow_stage, requirement_type, is_active").eq("is_active", true).eq("workflow_stage", "VEHICLE_INTAKE");
  if (error) throw error;
  const normalizedType = currentVehicleType.trim().toUpperCase();
  const documents = (data ?? []).filter((item) => { const itemType = item.vehicle_type?.trim().toUpperCase(); return itemType === normalizedType || itemType === "BOTH"; }) as DocumentMaster[];
  const checklist: Record<string, boolean> = {};
  for (const document of documents) checklist[document.id] = false;
  return { documents, checklist };
}

export async function loadInitialData(visitId?: string, vehicleId?: string) {
  if (!visitId && !vehicleId) throw new Error("Vehicle Intake could not identify the selected vehicle.");
  const { data: authData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = authData.user;
  if (!user) { router.replace("/login"); return null; }
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, is_active").eq("id", user.id).single();
  if (profileError) throw profileError;
  if (!profile || !profile.is_active) throw new Error("Your active profile could not be verified.");
  if (!["advisor", "ceo_admin"].includes(profile.role)) throw new Error("Vehicle Intake is available only to Advisors and CEO Admin.");
  const isAdmin = profile.role === "ceo_admin";
  let visit: VisitRecord | null = null;
  if (visitId) {
    const { data, error } = await supabase.from("workshop_visits").select("id, vehicle_id, current_stage, current_status, current_assigned_to").eq("id", visitId).single();
    if (error) throw error; visit = data as VisitRecord;
  } else if (vehicleId) {
    const { data, error } = await supabase.from("workshop_visits").select("id, vehicle_id, current_stage, current_status, current_assigned_to").eq("vehicle_id", vehicleId).in("current_stage", ["PENDING_ADVISOR", "ADVISOR_ASSIGNED"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error; visit = data as VisitRecord | null;
  }
  if (!visit) throw new Error("The selected workshop visit could not be found.");
  if (!["PENDING_ADVISOR", "ADVISOR_ASSIGNED"].includes(visit.current_stage)) throw new Error(`This vehicle is already at ${visit.current_stage.replace(/_/g, " ")}.`);
  if (visit.current_stage === "ADVISOR_ASSIGNED" && visit.current_assigned_to !== user.id && !isAdmin) throw new Error("This vehicle is assigned to another advisor.");
  const { data: vehicleData, error: vehicleError } = await supabase.from("vehicles").select("id, vehicle_no, customer_name, customer_mobile, vehicle_type, model, arena_nexa, jc_no").eq("id", visit.vehicle_id).single();
  if (vehicleError) throw vehicleError;
  const vehicle = vehicleData as VehicleRecord;
  const masterData = await loadMasterData();
  const vehicleType: VehicleType = vehicle.vehicle_type === "COMMERCIAL" ? "COMMERCIAL" : "PRIVATE";
  let selectedModel = masterData.models.find((item) => item.name.trim().toLowerCase() === (vehicle.model ?? "").trim().toLowerCase() && (item.arena_nexa ?? "").trim().toLowerCase() === (vehicle.arena_nexa ?? "").trim().toLowerCase());
  if (!selectedModel) selectedModel = masterData.models.find((item) => item.name.trim().toLowerCase() === (vehicle.model ?? "").trim().toLowerCase());
  const defaultMi = masterData.mi.find((item) => item.code?.trim().toUpperCase() === "MI");
  const documents = await loadDocuments(vehicleType);
  const { data: gateData, error: gateError } = await supabase.from("gate_entries").select("gate_in_at").eq("vehicle_id", vehicle.id).order("gate_in_at", { ascending: false }).limit(1).maybeSingle();
  if (gateError) console.warn("Gate entry lookup error:", gateError);
  return { userId: user.id, isAdmin, visit, vehicle, vehicleType, masterData, selectedModel, defaultMi, documents: documents.documents, checklist: documents.checklist, gateInAt: (gateData as GateEntry | null)?.gate_in_at ?? null, customerMobile: normalizeMobile(vehicle.customer_mobile ?? "") };
}
