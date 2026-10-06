CREATE OR REPLACE FUNCTION pagariya_workflow_private.reconcile_floor_record(
 p_visit_id uuid, p_approval_cycle_id uuid, p_source_event_id uuid,
 p_expected_job_id uuid, p_normalize_legacy_initial boolean, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
DECLARE
 u uuid:=auth.uid(); w public.workshop_visits%ROWTYPE; v public.vehicles%ROWTYPE;
 i public.vehicle_intake%ROWTYPE; s public.surveys%ROWTYPE; a public.approval_cycles%ROWTYPE;
 e public.workflow_events%ROWTYPE; j public.vehicle_jobs%ROWTYPE;
 advisor_assignment public.vehicle_assignments%ROWTYPE; floor_assignment public.vehicle_assignments%ROWTYPE;
 proof public.vehicle_photos%ROWTYPE; photo_path text; old_job jsonb; new_job jsonb;
 old_cycle text; v_job_id uuid; audit_id uuid; maintenance boolean:=false;
BEGIN
 IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Correction reason is required.'; END IF;
 IF u IS NULL THEN
   IF session_user <> 'postgres' OR current_user <> 'postgres' OR current_setting('role') <> 'none' THEN
     RAISE EXCEPTION 'CEO authentication or owner-approved database maintenance is required.';
   END IF;
   maintenance:=true;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=u AND role='ceo_admin' AND is_active) THEN
     RAISE EXCEPTION 'Only an active CEO Admin can reconcile Floor records.';
   END IF;
 END IF;
 SELECT * INTO w FROM public.workshop_visits WHERE id=p_visit_id FOR UPDATE;
 IF NOT FOUND OR w.closed_at IS NOT NULL OR w.current_stage<>'FLOOR' OR w.current_status<>'PENDING' THEN RAISE EXCEPTION 'Expected open Pending Floor visit.'; END IF;
 SELECT * INTO v FROM public.vehicles WHERE id=w.vehicle_id FOR UPDATE;
 IF NOT FOUND OR v.current_stage<>w.current_stage OR v.current_status<>w.current_status THEN RAISE EXCEPTION 'Vehicle and visit state disagree.'; END IF;
 IF (SELECT count(*) FROM public.workshop_visits WHERE vehicle_id=v.id AND closed_at IS NULL)<>1 THEN RAISE EXCEPTION 'Expected one open visit.'; END IF;
 SELECT * INTO j FROM public.vehicle_jobs WHERE vehicle_id=v.id AND current_job_stage<>'CLOSED' FOR UPDATE;
 IF j.id IS DISTINCT FROM p_expected_job_id THEN RAISE EXCEPTION 'Active job changed. Refresh the correction preview.'; END IF;
 IF EXISTS(SELECT 1 FROM public.workflow_events WHERE visit_id=w.id AND event_type='FLOOR_RECORD_RECONCILED' AND metadata->>'source_approval_cycle_id'=p_approval_cycle_id::text) THEN RAISE EXCEPTION 'This correction has already been applied.'; END IF;
 SELECT * INTO advisor_assignment FROM public.vehicle_assignments WHERE visit_id=w.id AND assignment_role='ADVISOR' AND unassigned_at IS NULL FOR UPDATE;
 IF NOT FOUND OR (SELECT count(*) FROM public.vehicle_assignments WHERE visit_id=w.id AND assignment_role='ADVISOR' AND unassigned_at IS NULL)<>1 OR advisor_assignment.assigned_to IS DISTINCT FROM w.current_assigned_to OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=advisor_assignment.assigned_to AND role='advisor' AND is_active) THEN RAISE EXCEPTION 'A unique active assigned Advisor is required.'; END IF;
 SELECT * INTO i FROM public.vehicle_intake WHERE visit_id=w.id AND vehicle_id=v.id FOR UPDATE;
 IF NOT FOUND OR (SELECT count(*) FROM public.vehicle_intake WHERE visit_id=w.id)<>1 OR i.completed_at IS NULL OR i.completed_by IS DISTINCT FROM advisor_assignment.assigned_to THEN RAISE EXCEPTION 'Completed Intake evidence is incomplete.'; END IF;
 SELECT * INTO s FROM public.surveys WHERE visit_id=w.id AND vehicle_id=v.id AND survey_type='INITIAL' AND completed_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND OR (SELECT count(*) FROM public.surveys WHERE visit_id=w.id AND survey_type='INITIAL' AND completed_at IS NOT NULL)<>1 THEN RAISE EXCEPTION 'A unique completed initial Survey is required.'; END IF;
 SELECT * INTO a FROM public.approval_cycles WHERE id=p_approval_cycle_id AND visit_id=w.id AND vehicle_id=v.id FOR UPDATE;
 IF NOT FOUND OR a.decision<>'APPROVED' OR a.approval_received_at IS NULL OR (SELECT count(*) FROM public.approval_cycles WHERE visit_id=w.id AND decision='APPROVED')<>1 OR a.decided_by IS DISTINCT FROM advisor_assignment.assigned_to THEN RAISE EXCEPTION 'Verified approval evidence is required.'; END IF;
 SELECT * INTO e FROM public.workflow_events WHERE id=p_source_event_id AND visit_id=w.id AND vehicle_id=v.id;
 IF NOT FOUND OR e.metadata->>'approval_cycle_id' IS DISTINCT FROM a.id::text OR e.stage_after<>'ADVISOR_WORK' OR e.performed_by IS DISTINCT FROM a.decided_by THEN RAISE EXCEPTION 'Approval source event does not match.'; END IF;
 old_cycle:=a.cycle_type;
 IF p_normalize_legacy_initial THEN
   IF a.cycle_type<>'SUPPLEMENTARY' OR e.event_type<>'APPROVAL_RECEIVED' OR e.stage_before<>'PENDING_APPROVAL' OR EXISTS(SELECT 1 FROM public.supplementary_cycles WHERE visit_id=w.id) OR EXISTS(SELECT 1 FROM public.surveys WHERE visit_id=w.id AND survey_type='SUPPLEMENTARY') THEN RAISE EXCEPTION 'Legacy initial-approval interpretation is not proven.'; END IF;
 ELSE
   IF a.cycle_type<>'INITIAL' OR e.event_type<>'SURVEY_COMPLETED_APPROVAL_RECEIVED' OR e.stage_before<>'PENDING_SURVEY' THEN RAISE EXCEPTION 'Direct Survey approval source is required.'; END IF;
 END IF;
 photo_path:=coalesce(e.metadata->>'assessment_sheet_photo_path',e.metadata->>'photo_reference');
 SELECT * INTO proof FROM public.vehicle_photos WHERE vehicle_id=v.id AND storage_path=photo_path AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR proof.uploaded_by IS DISTINCT FROM a.decided_by OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='vehicle-photos' AND name=photo_path) THEN RAISE EXCEPTION 'Approval photo evidence is missing.'; END IF;
 IF (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=w.id AND status='OPEN')<>1 OR NOT EXISTS(SELECT 1 FROM public.workflow_stage_history WHERE visit_id=w.id AND status='OPEN' AND stage='FLOOR' AND entered_at=w.stage_started_at) THEN RAISE EXCEPTION 'Floor entry history does not agree.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.advisor_work WHERE visit_id=w.id AND vehicle_id=v.id) THEN RAISE EXCEPTION 'Advisor Work evidence is missing.'; END IF;
 SELECT * INTO floor_assignment FROM public.vehicle_assignments WHERE visit_id=w.id AND assignment_role='FLOOR_INCHARGE' AND unassigned_at IS NULL FOR UPDATE;
 IF (SELECT count(*) FROM public.vehicle_assignments WHERE visit_id=w.id AND assignment_role='FLOOR_INCHARGE' AND unassigned_at IS NULL)>1 THEN RAISE EXCEPTION 'Multiple Floor assignments.'; END IF;
 IF floor_assignment.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.part_handovers WHERE visit_id=w.id AND vehicle_id=v.id AND handed_to=floor_assignment.assigned_to AND handed_by=floor_assignment.assigned_by AND handed_over_at=floor_assignment.assigned_at) THEN RAISE EXCEPTION 'Existing Floor assignment lacks handover evidence.'; END IF;
 old_job:=CASE WHEN j.id IS NULL THEN NULL ELSE to_jsonb(j) END;
 IF j.id IS NULL THEN
   IF EXISTS(SELECT 1 FROM public.vehicle_jobs WHERE vehicle_id=v.id) OR i.insurance_type<>'PAID' THEN RAISE EXCEPTION 'Missing-job reconstruction needs further business evidence.'; END IF;
   INSERT INTO public.vehicle_jobs(vehicle_id,advisor_id,job_type,job_card_no,vehicle_type,arena_nexa,insurance_company_id,mi_type_id,
     survey_at,approval_status,approval_at,approval_remarks,advisor_remarks,current_job_stage,
     floor_incharge_id,floor_assigned_at,floor_assigned_by,vehicle_model_id_snapshot,arena_nexa_snapshot,vehicle_type_snapshot)
   VALUES(v.id,advisor_assignment.assigned_to,i.insurance_type,i.job_card_no,i.vehicle_type,i.arena_nexa,i.insurance_company_id,i.mi_type_id,
     s.completed_at,'APPROVED',a.approval_received_at,a.remarks,i.advisor_remarks,'FLOOR',
     floor_assignment.assigned_to,floor_assignment.assigned_at,floor_assignment.assigned_by,i.vehicle_model_id,i.arena_nexa,i.vehicle_type)
   RETURNING id INTO v_job_id;
 ELSE
   IF j.current_job_stage<>'FLOOR' OR j.advisor_id IS DISTINCT FROM advisor_assignment.assigned_to OR j.approval_status<>'PENDING' OR j.approval_at IS NOT NULL OR j.survey_at IS DISTINCT FROM s.completed_at OR e.metadata->>'vehicle_job_id' IS DISTINCT FROM j.id::text THEN RAISE EXCEPTION 'Expected direct-Survey approval job mismatch.'; END IF;
   UPDATE public.vehicle_jobs SET approval_status='APPROVED',approval_at=a.approval_received_at,approval_remarks=a.remarks WHERE id=j.id;
   v_job_id:=j.id;
 END IF;
 IF proof.job_id IS NOT NULL AND proof.job_id<>v_job_id THEN RAISE EXCEPTION 'Approval photo belongs to a different job.'; END IF;
 IF proof.job_id IS NULL THEN UPDATE public.vehicle_photos SET job_id=v_job_id WHERE id=proof.id; END IF;
 IF p_normalize_legacy_initial THEN UPDATE public.approval_cycles SET cycle_type='INITIAL' WHERE id=a.id; END IF;
 SELECT to_jsonb(x) INTO new_job FROM public.vehicle_jobs x WHERE x.id=v_job_id;
 INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata)
 VALUES(w.id,v.id,'FLOOR_RECORD_RECONCILED',w.current_stage,w.current_stage,w.current_status,w.current_status,u,now(),p_reason,
 jsonb_build_object('actor_type',CASE WHEN maintenance THEN 'OWNER_APPROVED_DATABASE_MAINTENANCE' ELSE 'CEO_ADMIN' END,
   'database_operator',CASE WHEN maintenance THEN session_user::text ELSE NULL END,'authorization','Owner approved FLOOR_DATA_CORRECTION_PROPOSAL.md in chat',
   'source_intake_id',i.id,'source_intake_completed_at',i.completed_at,'source_survey_id',s.id,'source_approval_cycle_id',a.id,'source_event_id',e.id,
   'approval_cycle_type_before',old_cycle,'approval_cycle_type_after',CASE WHEN p_normalize_legacy_initial THEN 'INITIAL' ELSE old_cycle END,
   'source_photo_id',proof.id,'photo_job_before',proof.job_id,'photo_job_after',v_job_id,
   'source_floor_assignment_id',floor_assignment.id,'job_before',old_job,'job_after',new_job,
   'unavailable_historical_snapshots',CASE WHEN old_job IS NULL THEN jsonb_build_array('customer_name','customer_mobile','vehicle_model_name') ELSE '[]'::jsonb END,
   'legacy_pending_cycles_preserved',p_normalize_legacy_initial))
 RETURNING id INTO audit_id;
 RETURN jsonb_build_object('vehicle_no',v.vehicle_no,'job_id',v_job_id,'audit_event_id',audit_id,'legacy_cycle_normalized',p_normalize_legacy_initial);
END;
$function$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.reconcile_floor_record(uuid,uuid,uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated,service_role;

