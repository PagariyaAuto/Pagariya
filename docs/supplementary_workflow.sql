-- Approved Supplementary implementation. Complete definitions; no historical repairs.
CREATE SCHEMA IF NOT EXISTS pagariya_workflow_private;
REVOKE ALL ON SCHEMA pagariya_workflow_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA pagariya_workflow_private TO authenticated;

ALTER TABLE public.supplementary_cycles
  ADD COLUMN source_floor_cycle_id uuid REFERENCES public.floor_work_cycles(id),
  ADD COLUMN return_floor_cycle_id uuid REFERENCES public.floor_work_cycles(id),
  ADD COLUMN work_path text CHECK (work_path IN ('ONLY_PARTS','DENTING_PAINTING_PARTS','ONLY_DENTING_PAINTING')),
  ADD COLUMN discovery_photo_id uuid REFERENCES public.vehicle_photos(id),
  ADD COLUMN continued_without_supplementary_at timestamptz;
ALTER TABLE public.part_requisitions ADD COLUMN supplementary_cycle_id uuid REFERENCES public.supplementary_cycles(id);
CREATE UNIQUE INDEX ux_supplementary_requisition ON public.part_requisitions(supplementary_cycle_id) WHERE supplementary_cycle_id IS NOT NULL;
ALTER TABLE public.supplementary_cycles DROP CONSTRAINT supplementary_cycle_status_check;
ALTER TABLE public.supplementary_cycles ADD CONSTRAINT supplementary_cycle_status_check CHECK
  (status IN ('PENDING','SURVEY','APPROVAL','APPROVAL_HOLD','APPROVED','CLAIM_REJECTED','RETURNED_TO_FLOOR','COMPLETED','CONTINUED_WITHOUT_SUPPLEMENTARY'));
CREATE UNIQUE INDEX ux_supplementary_one_unresolved ON public.supplementary_cycles(visit_id)
  WHERE status IN ('PENDING','SURVEY','APPROVAL','APPROVAL_HOLD','APPROVED','CLAIM_REJECTED');
CREATE UNIQUE INDEX ux_floor_one_active ON public.floor_work_cycles(visit_id) WHERE status='ACTIVE';
CREATE UNIQUE INDEX ux_floor_item_type ON public.floor_work_items(floor_work_cycle_id,work_type_id);

CREATE OR REPLACE FUNCTION pagariya_workflow_private.can_read_visit(p_visit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.workshop_visits w ON w.id=p_visit_id
    WHERE p.id=auth.uid() AND p.is_active AND (
      p.role='ceo_admin' OR
      (p.role='advisor' AND EXISTS(SELECT 1 FROM public.vehicle_assignments a WHERE a.visit_id=w.id AND a.assigned_to=p.id AND a.assignment_role='ADVISOR' AND a.unassigned_at IS NULL)) OR
      (p.role='floor_incharge' AND EXISTS(SELECT 1 FROM public.vehicle_assignments a WHERE a.visit_id=w.id AND a.assigned_to=p.id AND a.assignment_role='FLOOR_INCHARGE' AND a.unassigned_at IS NULL))
    )
  );
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.can_read_visit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION pagariya_workflow_private.can_read_visit(uuid) TO authenticated;
ALTER POLICY supplementary_cycles_select_active_users ON public.supplementary_cycles USING(pagariya_workflow_private.can_read_visit(visit_id));
ALTER POLICY floor_work_cycles_select_active_users ON public.floor_work_cycles USING(pagariya_workflow_private.can_read_visit(visit_id));
ALTER POLICY floor_work_items_select_active_users ON public.floor_work_items USING(EXISTS(SELECT 1 FROM public.floor_work_cycles c WHERE c.id=floor_work_cycle_id AND pagariya_workflow_private.can_read_visit(c.visit_id)));

-- Internal helpers have no client execute permission. All mutation entry points below authenticate.
CREATE OR REPLACE FUNCTION pagariya_workflow_private.lock_context(p_visit_id uuid,p_floor_allowed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r text; w public.workshop_visits%ROWTYPE; v public.vehicles%ROWTYPE; j public.vehicle_jobs%ROWTYPE;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT role INTO r FROM public.profiles WHERE id=u AND is_active;
  IF r IS NULL OR r NOT IN ('advisor','ceo_admin','floor_incharge') OR (r='floor_incharge' AND NOT p_floor_allowed) THEN RAISE EXCEPTION 'Your account is not authorized for this action.'; END IF;
  SELECT * INTO w FROM public.workshop_visits WHERE id=p_visit_id FOR UPDATE;
  IF NOT FOUND OR w.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Active workshop visit not found.'; END IF;
  SELECT * INTO v FROM public.vehicles WHERE id=w.vehicle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found.'; END IF;
  IF v.current_stage IS DISTINCT FROM w.current_stage OR v.current_status IS DISTINCT FROM w.current_status THEN RAISE EXCEPTION 'Vehicle and visit state disagree. Contact CEO Admin before continuing.'; END IF;
  SELECT * INTO j FROM public.vehicle_jobs WHERE vehicle_id=w.vehicle_id AND current_job_stage<>'CLOSED' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active vehicle job not found for this vehicle.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=j.advisor_id AND role='advisor' AND is_active) THEN RAISE EXCEPTION 'Active assigned Advisor required.'; END IF;
  IF r='advisor' AND (j.advisor_id IS DISTINCT FROM u OR NOT EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=w.id AND assignment_role='ADVISOR' AND assigned_to=u AND unassigned_at IS NULL)) THEN RAISE EXCEPTION 'This vehicle is not assigned to you.'; END IF;
  IF r='floor_incharge' AND (j.floor_incharge_id IS DISTINCT FROM u OR NOT EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=w.id AND assignment_role='FLOOR_INCHARGE' AND assigned_to=u AND unassigned_at IS NULL)) THEN RAISE EXCEPTION 'This vehicle is not assigned to your Floor account.'; END IF;
  RETURN jsonb_build_object('visit_id',w.id,'vehicle_id',w.vehicle_id,'job_id',j.id,'advisor_id',j.advisor_id,'floor_incharge_id',j.floor_incharge_id,'role',r,'stage',w.current_stage,'status',w.current_status,'job_type',j.job_type);
END;
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.lock_context(uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION pagariya_workflow_private.move_stage(p_context jsonb,p_stage text,p_status text,p_event text,p_cycle_id uuid,p_remarks text DEFAULT NULL,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=(p_context->>'visit_id')::uuid; v uuid:=(p_context->>'vehicle_id')::uuid; n timestamptz:=now(); a uuid:=(p_context->>'advisor_id')::uuid;
BEGIN
  IF (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=w AND status='OPEN')<>1 THEN RAISE EXCEPTION 'Exactly one open workflow stage is required.'; END IF;
  UPDATE public.workflow_stage_history SET exited_at=n,exited_by=auth.uid(),status='COMPLETED' WHERE visit_id=w AND status='OPEN' AND stage=p_context->>'stage';
  IF NOT FOUND THEN RAISE EXCEPTION 'Current open workflow stage does not match the visit.'; END IF;
  INSERT INTO public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,entered_by,status,remarks) VALUES(w,v,p_stage,n,auth.uid(),'OPEN',p_remarks);
  UPDATE public.workshop_visits SET current_stage=p_stage,current_status=p_status,current_assigned_to=a,stage_started_at=n,updated_at=n WHERE id=w;
  UPDATE public.vehicles SET current_stage=p_stage,current_status=p_status,current_assigned_to=CASE WHEN p_stage='FLOOR' THEN (p_context->>'floor_incharge_id')::uuid ELSE a END,stage_started_at=n,updated_at=n WHERE id=v;
  UPDATE public.vehicle_jobs SET current_job_stage=CASE WHEN p_stage IN ('FLOOR','STORE') THEN p_stage ELSE 'ADVISOR' END,updated_at=n WHERE id=(p_context->>'job_id')::uuid;
  INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata)
  VALUES(w,v,p_event,p_context->>'stage',p_stage,p_context->>'status',p_status,auth.uid(),n,p_remarks,p_metadata||jsonb_build_object('supplementary_cycle_id',p_cycle_id,'vehicle_job_id',p_context->>'job_id'));
END;
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.move_stage(jsonb,text,text,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION pagariya_workflow_private.save_photo(p_context jsonb,p_path text,p_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE photo uuid;
BEGIN
  IF nullif(btrim(p_path),'') IS NULL THEN RETURN NULL; END IF;
  IF position('vehicles/'||(p_context->>'vehicle_id')||'/SUPPLEMENTARY/'||(p_context->>'visit_id')||'/' IN p_path)<>1 OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='vehicle-photos' AND name=p_path AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Valid uploaded supplementary photo required.'; END IF;
  IF EXISTS(SELECT 1 FROM public.vehicle_photos WHERE storage_path=p_path) THEN RAISE EXCEPTION 'This evidence has already been submitted. Refresh the workflow before retrying.'; END IF;
  INSERT INTO public.vehicle_photos(vehicle_id,job_id,photo_type,storage_path,uploaded_by) VALUES((p_context->>'vehicle_id')::uuid,(p_context->>'job_id')::uuid,p_type,p_path,auth.uid()) RETURNING id INTO photo;
  RETURN photo;
END;
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.save_photo(jsonb,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION pagariya_workflow_private.return_floor(p_context jsonb,p_cycle_id uuid,p_without boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.supplementary_cycles%ROWTYPE; source public.floor_work_cycles%ROWTYPE; dest uuid; floor_id uuid; n timestamptz:=now();
BEGIN
  SELECT * INTO s FROM public.supplementary_cycles WHERE id=p_cycle_id AND visit_id=(p_context->>'visit_id')::uuid FOR UPDATE;
  IF NOT FOUND OR s.status NOT IN ('APPROVED','CLAIM_REJECTED') THEN RAISE EXCEPTION 'Supplementary is not ready to return to Floor.'; END IF;
  IF (p_without AND s.status<>'CLAIM_REJECTED') OR (NOT p_without AND s.status<>'APPROVED') THEN RAISE EXCEPTION 'Invalid return decision.'; END IF;
  SELECT * INTO source FROM public.floor_work_cycles WHERE id=s.source_floor_cycle_id AND visit_id=s.visit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source Floor cycle not found.'; END IF;
  floor_id:=(p_context->>'floor_incharge_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=floor_id AND role='floor_incharge' AND is_active) OR NOT EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=s.visit_id AND assigned_to=floor_id AND assignment_role='FLOOR_INCHARGE' AND unassigned_at IS NULL) THEN RAISE EXCEPTION 'Active assigned Floor Incharge required before returning.'; END IF;
  INSERT INTO public.floor_work_cycles(visit_id,vehicle_id,cycle_no,floor_incharge_id,vehicle_in_at,status,remarks)
  SELECT s.visit_id,s.vehicle_id,coalesce(max(cycle_no),0)+1,floor_id,n,'ACTIVE',CASE WHEN p_without THEN 'Continue original approved work; supplementary claim rejected.' ELSE 'Return after supplementary approval.' END FROM public.floor_work_cycles WHERE visit_id=s.visit_id RETURNING id INTO dest;
  INSERT INTO public.floor_work_items(floor_work_cycle_id,work_type_id,status,remarks)
  SELECT dest,work_type_id,'PENDING','Resumed from Floor cycle '||source.cycle_no FROM public.floor_work_items WHERE floor_work_cycle_id=source.id AND status<>'COMPLETED';
  UPDATE public.supplementary_cycles SET return_floor_cycle_id=dest,returned_to_floor_at=n,status=CASE WHEN p_without THEN 'CONTINUED_WITHOUT_SUPPLEMENTARY' ELSE 'RETURNED_TO_FLOOR' END,continued_without_supplementary_at=CASE WHEN p_without THEN n ELSE NULL END WHERE id=s.id;
  PERFORM pagariya_workflow_private.move_stage(p_context,'FLOOR','PENDING',CASE WHEN p_without THEN 'SUPPLEMENTARY_CONTINUED_WITHOUT' ELSE 'SUPPLEMENTARY_RETURNED_TO_FLOOR' END,s.id,NULL,jsonb_build_object('source_floor_cycle_id',source.id,'return_floor_cycle_id',dest,'approval_cycle_id',s.approval_cycle_id,'approved_scope_only',p_without));
END;
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.return_floor(jsonb,uuid,boolean) FROM PUBLIC,anon,authenticated;

-- Minimum visit-based Floor connection: assignment, cycle preparation and stripping start only.
CREATE OR REPLACE FUNCTION public.new_workflow_prepare_floor(p_visit_id uuid,p_floor_incharge_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; v_cycle_id uuid; v uuid; floor_id uuid;
BEGIN
  c:=pagariya_workflow_private.lock_context(p_visit_id,true); v:=(c->>'vehicle_id')::uuid; floor_id:=p_floor_incharge_id;
  IF c->>'stage'<>'FLOOR' OR c->>'status' NOT IN ('PENDING','IN_PROGRESS') THEN RAISE EXCEPTION 'Vehicle must be available at Floor.'; END IF;
  IF EXISTS(SELECT 1 FROM public.floor_work_cycles WHERE visit_id=p_visit_id AND status='ACTIVE') THEN RAISE EXCEPTION 'Floor cycle already prepared. Refresh the queue.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=floor_id AND role='floor_incharge' AND is_active) THEN RAISE EXCEPTION 'Select an active Floor Incharge.'; END IF;
  IF c->>'role'='floor_incharge' AND floor_id<>auth.uid() THEN RAISE EXCEPTION 'You may prepare only your own assigned Floor vehicle.'; END IF;
  IF EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=p_visit_id AND assignment_role='FLOOR_INCHARGE' AND unassigned_at IS NULL AND assigned_to<>floor_id) THEN RAISE EXCEPTION 'This vehicle already has a different Floor Incharge.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=p_visit_id AND assignment_role='FLOOR_INCHARGE' AND assigned_to=floor_id AND unassigned_at IS NULL) THEN
    INSERT INTO public.vehicle_assignments(visit_id,vehicle_id,assigned_to,assigned_by,assignment_role,assigned_at) VALUES(p_visit_id,v,floor_id,auth.uid(),'FLOOR_INCHARGE',now());
  END IF;
  INSERT INTO public.floor_work_cycles(visit_id,vehicle_id,cycle_no,floor_incharge_id,status) SELECT p_visit_id,v,coalesce(max(cycle_no),0)+1,floor_id,'ACTIVE' FROM public.floor_work_cycles WHERE visit_id=p_visit_id RETURNING public.floor_work_cycles.id INTO v_cycle_id;
  INSERT INTO public.floor_work_items(floor_work_cycle_id,work_type_id) SELECT v_cycle_id,m.id FROM public.work_type_master m WHERE m.is_active;
  IF NOT EXISTS(SELECT 1 FROM public.floor_work_items i JOIN public.work_type_master m ON m.id=i.work_type_id WHERE i.floor_work_cycle_id=v_cycle_id AND m.code='STRIPPING') THEN RAISE EXCEPTION 'Active Stripping work master is required.'; END IF;
  UPDATE public.vehicle_jobs SET floor_incharge_id=floor_id,floor_assigned_at=now(),floor_assigned_by=auth.uid(),current_job_stage='FLOOR',updated_at=now() WHERE public.vehicle_jobs.id=(c->>'job_id')::uuid;
  UPDATE public.vehicles SET current_assigned_to=floor_id,updated_at=now() WHERE public.vehicles.id=v;
  INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,metadata) VALUES(p_visit_id,v,'FLOOR_CYCLE_PREPARED','FLOOR','FLOOR',c->>'status',c->>'status',auth.uid(),now(),jsonb_build_object('floor_work_cycle_id',v_cycle_id,'floor_incharge_id',floor_id,'vehicle_job_id',c->>'job_id'));
  RETURN jsonb_build_object('floor_cycle_id',v_cycle_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.new_workflow_start_stripping(p_visit_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; f public.floor_work_cycles%ROWTYPE; item uuid;
BEGIN
  c:=pagariya_workflow_private.lock_context(p_visit_id,true);
  IF c->>'role' NOT IN ('floor_incharge','ceo_admin') THEN RAISE EXCEPTION 'Only the assigned Floor Incharge can start stripping.'; END IF;
  IF c->>'stage'<>'FLOOR' OR c->>'status' NOT IN ('PENDING','IN_PROGRESS') THEN RAISE EXCEPTION 'Vehicle must be available at Floor.'; END IF;
  SELECT * INTO f FROM public.floor_work_cycles WHERE visit_id=p_visit_id AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prepare the Floor cycle first.'; END IF;
  UPDATE public.floor_work_items i SET started_at=now(),started_by=auth.uid(),status='IN_PROGRESS' FROM public.work_type_master m WHERE i.floor_work_cycle_id=f.id AND i.work_type_id=m.id AND m.code='STRIPPING' AND i.status='PENDING' RETURNING i.id INTO item;
  IF item IS NULL THEN RAISE EXCEPTION 'Stripping has already started or is unavailable.'; END IF;
  UPDATE public.workshop_visits SET current_status='IN_PROGRESS',updated_at=now() WHERE id=p_visit_id;
  UPDATE public.vehicles SET current_status='IN_PROGRESS',updated_at=now() WHERE id=f.vehicle_id;
  INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,metadata) VALUES(p_visit_id,f.vehicle_id,'STRIPPING_STARTED','FLOOR','FLOOR',c->>'status','IN_PROGRESS',auth.uid(),now(),jsonb_build_object('floor_work_cycle_id',f.id,'floor_work_item_id',item));
  RETURN jsonb_build_object('floor_item_id',item);
END;
$$;

CREATE OR REPLACE FUNCTION public.new_workflow_request_supplementary(p_visit_id uuid,p_reason text,p_photo_path text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; f public.floor_work_cycles%ROWTYPE; v_cycle_id uuid; photo uuid;
BEGIN
  c:=pagariya_workflow_private.lock_context(p_visit_id,true);
  IF c->>'role' NOT IN ('advisor','floor_incharge') THEN RAISE EXCEPTION 'Only the assigned Advisor or Floor Incharge can raise Supplementary.'; END IF;
  IF c->>'stage'<>'FLOOR' OR c->>'status'<>'IN_PROGRESS' THEN RAISE EXCEPTION 'Supplementary may be raised during active Floor stripping.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.vehicle_jobs WHERE id=(c->>'job_id')::uuid AND current_job_stage='FLOOR' AND approval_status='APPROVED') OR NOT EXISTS(SELECT 1 FROM public.approval_cycles WHERE visit_id=p_visit_id AND cycle_type='INITIAL' AND decision='APPROVED') THEN RAISE EXCEPTION 'Previously approved work at Floor is required.'; END IF;
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Supplementary reason is required.'; END IF;
  SELECT * INTO f FROM public.floor_work_cycles WHERE visit_id=p_visit_id AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.floor_work_items i JOIN public.work_type_master m ON m.id=i.work_type_id WHERE i.floor_work_cycle_id=f.id AND m.code='STRIPPING' AND i.status='IN_PROGRESS') THEN RAISE EXCEPTION 'Active Stripping work is required.'; END IF;
  IF f.floor_incharge_id IS DISTINCT FROM (c->>'floor_incharge_id')::uuid THEN RAISE EXCEPTION 'Floor assignment conflict.'; END IF;
  photo:=pagariya_workflow_private.save_photo(c,p_photo_path,'SUPPLEMENTARY_DISCOVERY');
  INSERT INTO public.supplementary_cycles(visit_id,vehicle_id,cycle_no,requested_by,reason,status,source_floor_cycle_id,discovery_photo_id)
  SELECT p_visit_id,f.vehicle_id,coalesce(max(cycle_no),0)+1,auth.uid(),btrim(p_reason),'SURVEY',f.id,photo FROM public.supplementary_cycles WHERE visit_id=p_visit_id RETURNING public.supplementary_cycles.id INTO v_cycle_id;
  UPDATE public.floor_work_cycles SET status='RETURNED_TO_ADVISOR',vehicle_out_at=now() WHERE public.floor_work_cycles.id=f.id;
  UPDATE public.floor_work_items SET status='STOPPED_FOR_SUPPLEMENTARY',supplementary_required=true,supplementary_cycle_id=v_cycle_id WHERE floor_work_cycle_id=f.id AND status='IN_PROGRESS';
  PERFORM pagariya_workflow_private.move_stage(c,'SUPPLEMENTARY_SURVEY','PENDING','SUPPLEMENTARY_REQUESTED',v_cycle_id,btrim(p_reason),jsonb_build_object('source_floor_cycle_id',f.id,'discovery_photo_id',photo));
  RETURN jsonb_build_object('supplementary_cycle_id',v_cycle_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.new_workflow_complete_supplementary_survey(p_cycle_id uuid,p_survey_at timestamptz,p_remarks text DEFAULT NULL,p_paid_amount numeric DEFAULT NULL,p_receipt_reference_no text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; s public.supplementary_cycles%ROWTYPE; survey uuid; approval uuid; visit uuid;
BEGIN
  SELECT visit_id INTO visit FROM public.supplementary_cycles WHERE id=p_cycle_id;
  c:=pagariya_workflow_private.lock_context(visit);
  IF c->>'role'<>'advisor' THEN RAISE EXCEPTION 'Only the assigned Advisor can complete Supplementary Survey.'; END IF;
  SELECT * INTO s FROM public.supplementary_cycles WHERE id=p_cycle_id FOR UPDATE;
  IF s.status<>'SURVEY' OR c->>'stage'<>'SUPPLEMENTARY_SURVEY' OR c->>'status' NOT IN ('PENDING','IN_PROGRESS') THEN RAISE EXCEPTION 'Supplementary Survey is no longer available. Refresh the queue.'; END IF;
  IF p_survey_at IS NULL OR p_survey_at>now() OR p_survey_at<s.requested_at THEN RAISE EXCEPTION 'Survey time must be between the supplementary request and now.'; END IF;
  IF p_paid_amount IS NOT NULL AND (p_paid_amount<0 OR p_paid_amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Paid amount must be a valid nonnegative number.'; END IF;
  IF c->>'job_type'<>'PAID' AND (p_paid_amount IS NOT NULL OR nullif(btrim(p_receipt_reference_no),'') IS NOT NULL) THEN RAISE EXCEPTION 'Amount and receipt are available only for Paid jobs.'; END IF;
  INSERT INTO public.surveys(visit_id,vehicle_id,survey_no,survey_type,started_at,completed_at,completed_by,paid_amount,receipt_reference_no,remarks)
  SELECT s.visit_id,s.vehicle_id,coalesce(max(survey_no),0)+1,'SUPPLEMENTARY',p_survey_at,p_survey_at,auth.uid(),p_paid_amount,nullif(btrim(p_receipt_reference_no),''),nullif(btrim(p_remarks),'') FROM public.surveys WHERE visit_id=s.visit_id RETURNING id INTO survey;
  INSERT INTO public.approval_cycles(visit_id,vehicle_id,cycle_no,cycle_type,decision)
  SELECT s.visit_id,s.vehicle_id,coalesce(max(cycle_no),0)+1,'SUPPLEMENTARY','PENDING' FROM public.approval_cycles WHERE visit_id=s.visit_id RETURNING id INTO approval;
  UPDATE public.supplementary_cycles SET survey_id=survey,approval_cycle_id=approval,status='APPROVAL' WHERE id=s.id;
  PERFORM pagariya_workflow_private.move_stage(c,'SUPPLEMENTARY_APPROVAL','PENDING','SUPPLEMENTARY_SURVEY_COMPLETED',s.id,p_remarks,jsonb_build_object('survey_id',survey,'approval_cycle_id',approval,'survey_completed_at',p_survey_at));
  RETURN jsonb_build_object('survey_id',survey,'approval_cycle_id',approval);
END;
$$;

CREATE OR REPLACE FUNCTION public.new_workflow_decide_supplementary(p_cycle_id uuid,p_decision text,p_decision_at timestamptz,p_remarks text DEFAULT NULL,p_photo_path text DEFAULT NULL,p_extra_parts boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; s public.supplementary_cycles%ROWTYPE; a public.approval_cycles%ROWTYPE; visit uuid; v_decision text:=upper(btrim(p_decision)); photo uuid; ctx jsonb;
BEGIN
  SELECT visit_id INTO visit FROM public.supplementary_cycles WHERE id=p_cycle_id;
  c:=pagariya_workflow_private.lock_context(visit);
  SELECT * INTO s FROM public.supplementary_cycles WHERE id=p_cycle_id FOR UPDATE;
  IF s.status<>'APPROVAL' OR c->>'stage' NOT IN ('SUPPLEMENTARY_APPROVAL','PENDING_APPROVAL') OR c->>'status' NOT IN ('PENDING','IN_PROGRESS') THEN RAISE EXCEPTION 'Supplementary Approval is no longer available. Refresh the queue.'; END IF;
  SELECT * INTO a FROM public.approval_cycles WHERE id=s.approval_cycle_id AND visit_id=s.visit_id AND vehicle_id=s.vehicle_id FOR UPDATE;
  IF NOT FOUND OR a.cycle_type<>'SUPPLEMENTARY' OR a.decision<>'PENDING' THEN RAISE EXCEPTION 'Linked pending Supplementary approval cycle required.'; END IF;
  IF v_decision IS NULL OR v_decision NOT IN ('APPROVED','APPROVAL_HOLD','CLAIM_REJECTED') THEN RAISE EXCEPTION 'Allowed decisions: Approve, Hold, Claim Rejected.'; END IF;
  IF p_decision_at IS NULL OR p_decision_at>now() OR p_decision_at<(SELECT completed_at FROM public.surveys WHERE id=s.survey_id) THEN RAISE EXCEPTION 'Decision time must be between Survey completion and now.'; END IF;
  IF v_decision IN ('APPROVAL_HOLD','CLAIM_REJECTED') AND nullif(btrim(p_remarks),'') IS NULL THEN RAISE EXCEPTION 'A remark is required for Hold or Claim Rejected.'; END IF;
  IF v_decision IN ('APPROVED','APPROVAL_HOLD') AND nullif(btrim(p_photo_path),'') IS NULL THEN RAISE EXCEPTION 'Assessment photo is required for Approval; assignment photo is required for Hold.'; END IF;
  photo:=pagariya_workflow_private.save_photo(c,p_photo_path,CASE WHEN v_decision='APPROVAL_HOLD' THEN 'APPROVAL_ASSIGNMENT' ELSE 'APPROVAL_ASSESSMENT' END);
  UPDATE public.approval_cycles SET decision=v_decision,decided_by=auth.uid(),remarks=nullif(btrim(p_remarks),''),approval_received_at=CASE WHEN v_decision='APPROVED' THEN p_decision_at ELSE approval_received_at END,approval_hold_at=CASE WHEN v_decision='APPROVAL_HOLD' THEN p_decision_at ELSE approval_hold_at END,approval_hold_remark=CASE WHEN v_decision='APPROVAL_HOLD' THEN btrim(p_remarks) ELSE approval_hold_remark END,claim_rejected_at=CASE WHEN v_decision='CLAIM_REJECTED' THEN p_decision_at ELSE claim_rejected_at END WHERE id=a.id;
  -- The job's initial approved scope remains authoritative; supplementary decisions live on their own cycle.
  UPDATE public.supplementary_cycles SET status=CASE WHEN v_decision='APPROVED' THEN 'APPROVED' WHEN v_decision='APPROVAL_HOLD' THEN 'APPROVAL_HOLD' ELSE 'CLAIM_REJECTED' END WHERE id=s.id;
  ctx:=jsonb_build_object('approval_cycle_id',a.id,'decision',v_decision,'decision_at',p_decision_at,'photo_id',photo,'photo_reference',p_photo_path,'extra_parts',coalesce(p_extra_parts,false));
  IF v_decision='APPROVED' AND NOT coalesce(p_extra_parts,false) THEN
    -- Record v_decision separately, then the return event/stage in the same transaction.
    INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata) VALUES(s.visit_id,s.vehicle_id,'SUPPLEMENTARY_APPROVAL_RECEIVED',c->>'stage',c->>'stage',c->>'status',c->>'status',auth.uid(),now(),p_remarks,ctx||jsonb_build_object('supplementary_cycle_id',s.id));
    PERFORM pagariya_workflow_private.return_floor(c,s.id,false);
  ELSE
    PERFORM pagariya_workflow_private.move_stage(c,CASE WHEN v_decision='APPROVED' THEN 'ADVISOR_WORK' WHEN v_decision='APPROVAL_HOLD' THEN 'APPROVAL_HOLD' ELSE 'CLAIM_REJECTED' END,CASE WHEN v_decision='APPROVAL_HOLD' THEN 'ON_HOLD' WHEN v_decision='CLAIM_REJECTED' THEN 'REJECTED' ELSE 'PENDING' END,CASE WHEN v_decision='APPROVED' THEN 'SUPPLEMENTARY_APPROVAL_RECEIVED' WHEN v_decision='APPROVAL_HOLD' THEN 'APPROVAL_HOLD' ELSE 'SUPPLEMENTARY_CLAIM_REJECTED' END,s.id,p_remarks,ctx);
  END IF;
  RETURN jsonb_build_object('supplementary_cycle_id',s.id,'decision',v_decision);
END;
$$;

CREATE OR REPLACE FUNCTION public.new_workflow_continue_without_supplementary(p_cycle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; visit uuid;
BEGIN
  SELECT visit_id INTO visit FROM public.supplementary_cycles WHERE id=p_cycle_id;
  c:=pagariya_workflow_private.lock_context(visit);
  IF c->>'stage'<>'CLAIM_REJECTED' OR c->>'status'<>'REJECTED' THEN RAISE EXCEPTION 'A rejected supplementary claim is required.'; END IF;
  PERFORM pagariya_workflow_private.return_floor(c,p_cycle_id,true);
  RETURN jsonb_build_object('supplementary_cycle_id',p_cycle_id,'continued_without_supplementary',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.new_workflow_supplementary_parts(p_cycle_id uuid,p_work_path text,p_requisition_no text,p_requisition_at timestamptz,p_remarks text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; s public.supplementary_cycles%ROWTYPE; visit uuid; work uuid; req uuid;
BEGIN
  SELECT visit_id INTO visit FROM public.supplementary_cycles WHERE id=p_cycle_id;
  c:=pagariya_workflow_private.lock_context(visit);
  SELECT * INTO s FROM public.supplementary_cycles WHERE id=p_cycle_id FOR UPDATE;
  IF s.status<>'APPROVED' OR c->>'stage'<>'ADVISOR_WORK' OR c->>'status' NOT IN ('PENDING','IN_PROGRESS') THEN RAISE EXCEPTION 'Approved supplementary parts work is required.'; END IF;
  IF p_work_path IS NULL OR p_work_path NOT IN ('ONLY_PARTS','DENTING_PAINTING_PARTS') THEN RAISE EXCEPTION 'Select the supplementary parts work path.'; END IF;
  IF nullif(btrim(p_requisition_no),'') IS NULL OR p_requisition_at IS NULL OR p_requisition_at>now() OR p_requisition_at<s.requested_at THEN RAISE EXCEPTION 'Valid requisition number and time required.'; END IF;
  SELECT id INTO work FROM public.advisor_work WHERE visit_id=visit;
  IF work IS NULL THEN RAISE EXCEPTION 'Original Advisor Work record required; contact CEO Admin.'; END IF;
  INSERT INTO public.part_requisitions(visit_id,vehicle_id,advisor_work_id,supplementary_cycle_id,requisition_no,requisition_at,requested_by,remarks) VALUES(visit,s.vehicle_id,work,s.id,btrim(p_requisition_no),p_requisition_at,auth.uid(),p_remarks) RETURNING id INTO req;
  UPDATE public.supplementary_cycles SET work_path=p_work_path WHERE id=s.id;
  PERFORM pagariya_workflow_private.move_stage(c,'STORE','PENDING','SUPPLEMENTARY_WORK_REQUIREMENT_SAVED',s.id,p_remarks,jsonb_build_object('part_requisition_id',req,'work_path',p_work_path));
  RETURN jsonb_build_object('part_requisition_id',req);
END;
$$;

CREATE OR REPLACE FUNCTION public.new_workflow_supplementary_queue(p_floor boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text; result jsonb;
BEGIN
  SELECT role INTO r FROM public.profiles WHERE id=auth.uid() AND is_active;
  IF r IS NULL OR r NOT IN ('advisor','ceo_admin','floor_incharge') OR (r='floor_incharge' AND NOT p_floor) THEN RAISE EXCEPTION 'Your account cannot access this queue.'; END IF;
  SELECT coalesce(jsonb_agg(q ORDER BY q.opened_at),'[]'::jsonb) INTO result FROM (
    SELECT w.id AS visit_id,w.vehicle_id,w.current_stage,w.current_status,w.opened_at,v.vehicle_no,v.model,j.id AS job_id,j.job_type,j.floor_incharge_id,
      (SELECT to_jsonb(s) FROM public.supplementary_cycles s WHERE s.visit_id=w.id ORDER BY s.cycle_no DESC LIMIT 1) AS supplementary,
      (SELECT to_jsonb(f) FROM public.floor_work_cycles f WHERE f.visit_id=w.id AND f.status='ACTIVE') AS floor_cycle,
      (SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('work_name',m.name,'work_code',m.code)) FROM public.floor_work_items i JOIN public.floor_work_cycles f ON f.id=i.floor_work_cycle_id JOIN public.work_type_master m ON m.id=i.work_type_id WHERE f.visit_id=w.id AND f.status='ACTIVE') AS floor_items
    FROM public.workshop_visits w JOIN public.vehicles v ON v.id=w.vehicle_id LEFT JOIN public.vehicle_jobs j ON j.vehicle_id=w.vehicle_id AND j.current_job_stage<>'CLOSED'
    WHERE w.closed_at IS NULL AND pagariya_workflow_private.can_read_visit(w.id) AND
      CASE WHEN p_floor THEN w.current_stage='FLOOR' ELSE EXISTS(SELECT 1 FROM public.supplementary_cycles s WHERE s.visit_id=w.id) END
  ) q;
  RETURN jsonb_build_object('role',r,'items',result);
END;
$$;

-- Floor discovery uploads only: scoped to a current assigned Floor visit, never broad bucket access.
CREATE POLICY supplementary_floor_discovery_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
  bucket_id='vehicle-photos' AND EXISTS(SELECT 1 FROM public.workshop_visits w JOIN public.profiles p ON p.id=auth.uid() WHERE p.is_active AND p.role='floor_incharge' AND w.current_stage='FLOOR' AND w.closed_at IS NULL AND pagariya_workflow_private.can_read_visit(w.id) AND position('vehicles/'||w.vehicle_id::text||'/SUPPLEMENTARY/'||w.id::text||'/DISCOVERY/' IN name)=1)
);

CREATE POLICY supplementary_photo_read_scope ON public.vehicle_photos AS RESTRICTIVE FOR SELECT TO authenticated USING(
  storage_path NOT LIKE '%/SUPPLEMENTARY/%' OR EXISTS(SELECT 1 FROM public.workshop_visits w WHERE w.vehicle_id=vehicle_photos.vehicle_id AND position('vehicles/'||w.vehicle_id::text||'/SUPPLEMENTARY/'||w.id::text||'/' IN storage_path)=1 AND pagariya_workflow_private.can_read_visit(w.id))
);
CREATE POLICY supplementary_storage_read_scope ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
  bucket_id<>'vehicle-photos' OR name NOT LIKE '%/SUPPLEMENTARY/%' OR EXISTS(SELECT 1 FROM public.workshop_visits w WHERE position('vehicles/'||w.vehicle_id::text||'/SUPPLEMENTARY/'||w.id::text||'/' IN name)=1 AND pagariya_workflow_private.can_read_visit(w.id))
);

REVOKE ALL ON FUNCTION public.new_workflow_prepare_floor(uuid,uuid),public.new_workflow_start_stripping(uuid),public.new_workflow_request_supplementary(uuid,text,text),public.new_workflow_complete_supplementary_survey(uuid,timestamptz,text,numeric,text),public.new_workflow_decide_supplementary(uuid,text,timestamptz,text,text,boolean),public.new_workflow_continue_without_supplementary(uuid),public.new_workflow_supplementary_parts(uuid,text,text,timestamptz,text),public.new_workflow_supplementary_queue(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_prepare_floor(uuid,uuid),public.new_workflow_start_stripping(uuid),public.new_workflow_request_supplementary(uuid,text,text),public.new_workflow_complete_supplementary_survey(uuid,timestamptz,text,numeric,text),public.new_workflow_decide_supplementary(uuid,text,timestamptz,text,text,boolean),public.new_workflow_continue_without_supplementary(uuid),public.new_workflow_supplementary_parts(uuid,text,text,timestamptz,text),public.new_workflow_supplementary_queue(boolean) TO authenticated;
