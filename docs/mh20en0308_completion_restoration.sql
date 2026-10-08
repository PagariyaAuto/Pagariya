BEGIN;
DO $$
DECLARE w public.workshop_visits%ROWTYPE; s public.supplementary_cycles%ROWTYPE; old public.floor_work_items%ROWTYPE; dest public.floor_work_cycles%ROWTYPE; restored uuid;
BEGIN
 SELECT * INTO w FROM public.workshop_visits WHERE id='2199a827-f5f8-4ff9-a48f-a1dbbadbdc59' FOR UPDATE;
 IF NOT FOUND OR w.closed_at IS NOT NULL OR w.current_stage<>'FLOOR' OR w.current_status NOT IN ('PENDING','IN_PROGRESS') THEN RAISE EXCEPTION 'Visit moved; repair cancelled'; END IF;
 PERFORM 1 FROM public.vehicles WHERE id=w.vehicle_id AND vehicle_no='MH20EN0308' AND current_stage=w.current_stage AND current_status=w.current_status AND current_assigned_to=w.current_assigned_to FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle state differs; repair cancelled'; END IF;
 SELECT * INTO s FROM public.supplementary_cycles WHERE id='4b8e57c0-1410-4a9a-a126-720526461611' AND visit_id=w.id AND status='RETURNED_TO_FLOOR' FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.approval_cycles WHERE id=s.approval_cycle_id AND decision='APPROVED') THEN RAISE EXCEPTION 'Approved supplementary return required'; END IF;
 SELECT * INTO dest FROM public.floor_work_cycles WHERE id=s.return_floor_cycle_id AND id='08631d39-2fca-4f39-b6c8-e69bcff304ef' AND visit_id=w.id AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Return Floor cycle moved; repair cancelled'; END IF;
 SELECT wi.* INTO old FROM public.floor_work_items wi JOIN public.work_type_master m ON m.id=wi.work_type_id
 WHERE wi.id='1ff52adf-9ed9-441e-b69c-bd501e5785f6' AND wi.floor_work_cycle_id=s.source_floor_cycle_id AND m.code='STRIPPING' AND wi.status='COMPLETED' AND wi.completed_at IS NOT NULL AND wi.completed_by IS NOT NULL FOR UPDATE OF wi;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recorded Stripping completion not found; repair cancelled'; END IF;
 IF EXISTS(SELECT 1 FROM public.floor_work_items WHERE floor_work_cycle_id=dest.id AND work_type_id=old.work_type_id) THEN
   IF NOT EXISTS(SELECT 1 FROM public.floor_work_items WHERE floor_work_cycle_id=dest.id AND work_type_id=old.work_type_id AND status='COMPLETED' AND completed_at=old.completed_at AND completed_by=old.completed_by) THEN RAISE EXCEPTION 'Existing return work differs; no overwrite allowed'; END IF;
   RETURN;
 END IF;
 INSERT INTO public.floor_work_items(floor_work_cycle_id,work_type_id,status,remarks,started_at,started_by,completed_at,completed_by)
 VALUES(dest.id,old.work_type_id,'COMPLETED',concat_ws(E'\n',old.remarks,'Restored recorded completion from source Floor cycle after supplementary return.'),old.started_at,old.started_by,old.completed_at,old.completed_by) RETURNING id INTO restored;
 INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata)
 VALUES(w.id,w.vehicle_id,'FLOOR_RETURN_COMPLETION_RESTORED','FLOOR','FLOOR',w.current_status,w.current_status,NULL,now(),'Restored missing recorded Stripping completion after supplementary parts return; original completion evidence preserved.',
 jsonb_build_object('repair_source','administrative database repair','supplementary_cycle_id',s.id,'source_floor_cycle_id',s.source_floor_cycle_id,'return_floor_cycle_id',dest.id,'source_floor_item_id',old.id,'restored_floor_item_id',restored,'original_completed_at',old.completed_at,'original_completed_by',old.completed_by));
END; $$;
COMMIT;
SELECT 'MH20EN0308: missing completed Stripping restored from original cycle; original timestamps and actor preserved.' result;

