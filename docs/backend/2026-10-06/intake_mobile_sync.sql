-- Preserve the current Intake implementation; add its omitted vehicle mobile update.
DO $fix$
DECLARE function_oid oid; definition text; marker text := 'customer_name = v_customer_name,';
BEGIN
 SELECT p.oid INTO STRICT function_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='new_workflow_save_vehicle_intake' AND p.pronargs=12;
 definition := pg_get_functiondef(function_oid);
 IF definition !~ 'customer_mobile\s*=\s*v_customer_mobile' THEN
  IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Expected Intake update marker not found; no changes applied.'; END IF;
  definition := replace(definition,marker,marker||E'\n        customer_mobile = v_customer_mobile,');
  EXECUTE definition;
 END IF;
END $fix$;

-- Fill an empty vehicle master mobile from its latest open visit's Intake.
-- Keep existing master values and all historical visit details.
UPDATE public.vehicles v SET customer_mobile=btrim(i.customer_mobile),updated_at=now()
FROM public.workshop_visits w JOIN public.vehicle_intake i ON i.visit_id=w.id AND i.vehicle_id=w.vehicle_id
WHERE v.id=w.vehicle_id AND w.closed_at IS NULL
  AND nullif(btrim(v.customer_mobile),'') IS NULL
  AND nullif(btrim(i.customer_mobile),'') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.workshop_visits newer WHERE newer.vehicle_id=w.vehicle_id AND newer.visit_no>w.visit_no);

