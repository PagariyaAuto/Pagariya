CREATE OR REPLACE FUNCTION pagariya_workflow_private.move_stage(p_context jsonb, p_stage text, p_status text, p_event text, p_cycle_id uuid, p_remarks text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE w uuid:=(p_context->>'visit_id')::uuid; v uuid:=(p_context->>'vehicle_id')::uuid; n timestamptz:=now(); a uuid:=(p_context->>'advisor_id')::uuid;
BEGIN
  IF (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=w AND status='OPEN')<>1 THEN RAISE EXCEPTION 'Exactly one open workflow stage is required.'; END IF;
  UPDATE public.workflow_stage_history SET exited_at=n,exited_by=auth.uid(),status='COMPLETED' WHERE visit_id=w AND status='OPEN' AND stage=p_context->>'stage';
  IF NOT FOUND THEN RAISE EXCEPTION 'Current open workflow stage does not match the visit.'; END IF;
  INSERT INTO public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,entered_by,status,remarks) VALUES(w,v,p_stage,n,auth.uid(),'OPEN',p_remarks);
  UPDATE public.workshop_visits SET current_stage=p_stage,current_status=p_status,current_assigned_to=CASE WHEN p_stage='FLOOR' THEN (p_context->>'floor_incharge_id')::uuid ELSE a END,stage_started_at=n,updated_at=n WHERE id=w;
  UPDATE public.vehicles SET current_stage=p_stage,current_status=p_status,current_assigned_to=CASE WHEN p_stage='FLOOR' THEN (p_context->>'floor_incharge_id')::uuid ELSE a END,stage_started_at=n,updated_at=n WHERE id=v;
  UPDATE public.vehicle_jobs SET current_job_stage=CASE WHEN p_stage IN ('FLOOR','STORE') THEN p_stage ELSE 'ADVISOR' END,updated_at=n WHERE id=(p_context->>'job_id')::uuid;
  INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata)
  VALUES(w,v,p_event,p_context->>'stage',p_stage,p_context->>'status',p_status,auth.uid(),n,p_remarks,p_metadata||jsonb_build_object('supplementary_cycle_id',p_cycle_id,'vehicle_job_id',p_context->>'job_id'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_floor_incharge(p_vehicle_id uuid, p_floor_incharge_id uuid, p_remarks text DEFAULT NULL::text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
 w public.workshop_visits%ROWTYPE; j public.vehicle_jobs%ROWTYPE;
 c public.floor_work_cycles%ROWTYPE; r text; t timestamptz:=now();
 note text:=nullif(btrim(p_remarks),'');
BEGIN
 SELECT role INTO r FROM public.profiles WHERE id=auth.uid() AND is_active;
 IF r IS NULL OR r NOT IN ('advisor','ceo_admin') THEN RAISE EXCEPTION 'Only an active Advisor or CEO Admin can assign a Floor Incharge.'; END IF;
 SELECT * INTO w FROM public.workshop_visits WHERE vehicle_id=p_vehicle_id AND closed_at IS NULL AND current_status IN ('PENDING','IN_PROGRESS') FOR UPDATE;
 IF NOT FOUND OR w.current_stage<>'FLOOR' THEN RAISE EXCEPTION 'An active Floor visit is required. Refresh the vehicle.'; END IF;
 IF (SELECT count(*) FROM public.workshop_visits WHERE vehicle_id=p_vehicle_id AND closed_at IS NULL AND current_status IN ('PENDING','IN_PROGRESS'))<>1 THEN RAISE EXCEPTION 'One active workshop visit is required. Ask CEO Admin to review this vehicle.'; END IF;
 PERFORM 1 FROM public.vehicles WHERE id=w.vehicle_id AND current_stage='FLOOR' AND current_status=w.current_status FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle and visit do not agree. Ask CEO Admin to review this vehicle.'; END IF;
 SELECT * INTO j FROM public.vehicle_jobs WHERE vehicle_id=w.vehicle_id AND current_job_stage<>'CLOSED' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR j.current_job_stage<>'FLOOR' THEN RAISE EXCEPTION 'An active Floor job is required.'; END IF;
 IF r='advisor' AND (j.advisor_id IS DISTINCT FROM auth.uid() OR NOT EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=w.id AND assignment_role='ADVISOR' AND assigned_to=auth.uid() AND unassigned_at IS NULL)) THEN RAISE EXCEPTION 'This vehicle is not assigned to you as Advisor.'; END IF;
 IF j.approval_status NOT IN ('APPROVED','PARTIAL') THEN RAISE EXCEPTION 'Approved work is required before Floor assignment.'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_floor_incharge_id AND role='floor_incharge' AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select an active Floor Incharge.'; END IF;
 SELECT * INTO c FROM public.floor_work_cycles WHERE visit_id=w.id AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND OR (SELECT count(*) FROM public.floor_work_cycles WHERE visit_id=w.id AND status='ACTIVE')<>1 THEN RAISE EXCEPTION 'One active Floor checklist is required. Ask CEO Admin to review this vehicle.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.floor_work_items WHERE floor_work_cycle_id=c.id) THEN RAISE EXCEPTION 'The Floor checklist is missing. Ask CEO Admin to review this vehicle.'; END IF;
 UPDATE public.vehicle_assignments SET unassigned_at=t WHERE visit_id=w.id AND assignment_role='FLOOR_INCHARGE' AND unassigned_at IS NULL;
 INSERT INTO public.vehicle_assignments(visit_id,vehicle_id,assigned_to,assigned_by,assignment_role,assigned_at,remarks) VALUES(w.id,w.vehicle_id,p_floor_incharge_id,auth.uid(),'FLOOR_INCHARGE',t,note);
 UPDATE public.floor_work_cycles SET floor_incharge_id=p_floor_incharge_id,updated_at=t WHERE id=c.id;
 UPDATE public.vehicle_jobs SET floor_incharge_id=p_floor_incharge_id,floor_assigned_at=t,floor_assigned_by=auth.uid(),updated_at=t WHERE id=j.id;
 UPDATE public.workshop_visits SET current_assigned_to=p_floor_incharge_id,updated_at=t WHERE id=w.id;
 UPDATE public.vehicles SET current_assigned_to=p_floor_incharge_id,updated_at=t WHERE id=w.vehicle_id;
 INSERT INTO public.vehicle_history(vehicle_id,job_id,changed_by,action,field_name,old_value,new_value,reason) VALUES(w.vehicle_id,j.id,auth.uid(),'FLOOR_INCHARGE_ASSIGNED','floor_incharge_id',j.floor_incharge_id::text,p_floor_incharge_id::text,note);
 INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata) VALUES(w.id,w.vehicle_id,'FLOOR_INCHARGE_ASSIGNED','FLOOR','FLOOR',w.current_status,w.current_status,auth.uid(),t,note,jsonb_build_object('previous_floor_incharge_id',j.floor_incharge_id,'floor_incharge_id',p_floor_incharge_id,'floor_work_cycle_id',c.id));
 RETURN json_build_object('success',true,'vehicle_id',w.vehicle_id,'visit_id',w.id,'job_id',j.id,'floor_incharge_id',p_floor_incharge_id,'floor_assigned_at',t,'stage','FLOOR');
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.assign_floor_incharge(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_floor_incharge(uuid,uuid,text) TO authenticated,service_role;


CREATE OR REPLACE FUNCTION public.new_workflow_assign_advisor(p_visit_id uuid, p_advisor_id uuid DEFAULT NULL::uuid, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

    v_user_id uuid := auth.uid();
    v_role text;

    v_visit public.workshop_visits%ROWTYPE;

    v_target_advisor uuid;

    v_now timestamptz := now();

BEGIN

    v_role := public.require_new_workflow_role(
        ARRAY[
            'watchman',
            'advisor',
            'ceo_admin'
        ]
    );


    -- Lock visit.
    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = p_visit_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Workshop visit not found.';
    END IF;


    IF v_visit.closed_at IS NOT NULL OR v_visit.current_status NOT IN ('PENDING','IN_PROGRESS') THEN
      RAISE EXCEPTION 'This visit is no longer available for Advisor assignment. Refresh the queue.';
    END IF;
    PERFORM 1 FROM public.vehicles WHERE id=v_visit.vehicle_id AND current_stage='PENDING_ADVISOR' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The vehicle has moved. Refresh the queue.'; END IF;
    IF (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=p_visit_id AND status='OPEN')<>1 OR NOT EXISTS(SELECT 1 FROM public.workflow_stage_history WHERE visit_id=p_visit_id AND stage='PENDING_ADVISOR' AND status='OPEN') THEN
      RAISE EXCEPTION 'The current vehicle stage needs review. Ask CEO Admin to check this vehicle.';
    END IF;

    -- Must still be waiting for Advisor.
    IF v_visit.current_stage <> 'PENDING_ADVISOR' THEN
        RAISE EXCEPTION
            'This vehicle is no longer waiting for Advisor assignment. Current stage: %',
            v_visit.current_stage;
    END IF;


    -- Must not already be assigned.
    IF v_visit.current_assigned_to IS NOT NULL THEN
        RAISE EXCEPTION
            'This vehicle has already been assigned to an Advisor.';
    END IF;


    -- ========================================================
    -- WATCHMAN / CEO ADMIN
    -- ========================================================

    IF v_role IN (
        'watchman',
        'ceo_admin'
    ) THEN

        IF p_advisor_id IS NULL THEN
            RAISE EXCEPTION
                'Please select an Advisor.';
        END IF;

        SELECT p.id
        INTO v_target_advisor
        FROM public.profiles p
        WHERE p.id = p_advisor_id
          AND p.role = 'advisor'
          AND p.is_active = true FOR SHARE;

        IF v_target_advisor IS NULL THEN
            RAISE EXCEPTION
                'Selected Advisor is not active or does not exist.';
        END IF;


    -- ========================================================
    -- ADVISOR
    -- ========================================================

    ELSE

        IF p_advisor_id IS NOT NULL
           AND p_advisor_id <> v_user_id
        THEN
            RAISE EXCEPTION
                'An Advisor can only assign the vehicle to themselves.';
        END IF;

        v_target_advisor := v_user_id;

    END IF;


    -- ========================================================
    -- ASSIGNMENT RECORD
    -- ========================================================

    INSERT INTO public.vehicle_assignments (
        visit_id,
        vehicle_id,
        assigned_to,
        assigned_by,
        assignment_role,
        assigned_at,
        remarks
    )
    VALUES (
        p_visit_id,
        v_visit.vehicle_id,
        v_target_advisor,
        v_user_id,
        'ADVISOR',
        v_now,
        NULLIF(TRIM(p_remarks), '')
    );


    -- ========================================================
    -- UPDATE VISIT
    -- ========================================================

    UPDATE public.workshop_visits
    SET
        current_stage = 'ADVISOR_ASSIGNED',
        current_status = 'IN_PROGRESS',
        current_assigned_to = v_target_advisor,
        stage_started_at = v_now,
        updated_at = v_now
    WHERE id = p_visit_id;


    -- ========================================================
    -- UPDATE VEHICLE MASTER STATUS
    -- ========================================================

    UPDATE public.vehicles
    SET
        current_stage = 'ADVISOR_ASSIGNED',
        current_status = 'IN_PROGRESS',
        current_assigned_to = v_target_advisor,
        stage_started_at = v_now,
        updated_at = v_now
    WHERE id = v_visit.vehicle_id;


    -- Close PENDING_ADVISOR.
    UPDATE public.workflow_stage_history
    SET
        exited_at = v_now,
        exited_by = v_user_id,
        status = 'COMPLETED'
    WHERE visit_id = p_visit_id
      AND stage = 'PENDING_ADVISOR'
      AND status = 'OPEN';


    -- Open ADVISOR_ASSIGNED.
    INSERT INTO public.workflow_stage_history (
        visit_id,
        vehicle_id,
        stage,
        entered_at,
        entered_by,
        status,
        remarks
    )
    VALUES (
        p_visit_id,
        v_visit.vehicle_id,
        'ADVISOR_ASSIGNED',
        v_now,
        v_user_id,
        'OPEN',
        NULLIF(TRIM(p_remarks), '')
    );


    -- ========================================================
    -- EVENT
    -- ========================================================

    INSERT INTO public.workflow_events (
        visit_id,
        vehicle_id,
        event_type,
        stage_before,
        stage_after,
        status_before,
        status_after,
        performed_by,
        performed_at,
        remarks,
        metadata
    )
    VALUES (
        p_visit_id,
        v_visit.vehicle_id,
        'ADVISOR_ASSIGNED',
        'PENDING_ADVISOR',
        'ADVISOR_ASSIGNED',
        'PENDING',
        'IN_PROGRESS',
        v_user_id,
        v_now,
        NULLIF(TRIM(p_remarks), ''),
        jsonb_build_object(
            'assigned_to',
            v_target_advisor,
            'assigned_by',
            v_user_id
        )
    );


    RETURN jsonb_build_object(
        'success', true,
        'visit_id', p_visit_id,
        'vehicle_id', v_visit.vehicle_id,
        'assigned_to', v_target_advisor,
        'assigned_by', v_user_id,
        'stage', 'ADVISOR_ASSIGNED',
        'assigned_at', v_now
    );

END;
$function$;
REVOKE EXECUTE ON FUNCTION public.new_workflow_assign_advisor(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_assign_advisor(uuid,uuid,text) TO authenticated,service_role;

