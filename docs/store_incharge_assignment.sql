-- Assignment helpers reuse the existing vehicle_assignments history.
CREATE OR REPLACE FUNCTION pagariya_workflow_private.validate_store_incharge(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id=p_user_id AND role='store_team' AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select an active Store Incharge.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.validate_store_incharge(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION pagariya_workflow_private.set_store_assignment(p_visit_id uuid,p_store_incharge_id uuid,p_remarks text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.workshop_visits%ROWTYPE; a uuid; previous uuid; n timestamptz:=now();
BEGIN
  PERFORM pagariya_workflow_private.validate_store_incharge(p_store_incharge_id);
  SELECT * INTO w FROM public.workshop_visits WHERE id=p_visit_id FOR UPDATE;
  IF NOT FOUND OR w.closed_at IS NOT NULL OR w.current_stage<>'STORE' OR w.current_status NOT IN ('PENDING','IN_PROGRESS') THEN
    RAISE EXCEPTION 'This vehicle is no longer available in Store.';
  END IF;
  PERFORM 1 FROM public.vehicles WHERE id=w.vehicle_id AND current_stage=w.current_stage AND current_status=w.current_status FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle and visit details do not match. Contact CEO Admin.'; END IF;
  previous:=w.current_assigned_to;
  SELECT id INTO a FROM public.vehicle_assignments WHERE visit_id=w.id AND assignment_role='STORE_TEAM' AND unassigned_at IS NULL AND assigned_to=p_store_incharge_id;
  IF a IS NOT NULL AND w.current_assigned_to=p_store_incharge_id THEN RETURN a; END IF;
  UPDATE public.vehicle_assignments SET unassigned_at=n WHERE visit_id=w.id AND assignment_role='STORE_TEAM' AND unassigned_at IS NULL;
  INSERT INTO public.vehicle_assignments(visit_id,vehicle_id,assigned_to,assigned_by,assignment_role,assigned_at,remarks)
  VALUES(w.id,w.vehicle_id,p_store_incharge_id,auth.uid(),'STORE_TEAM',n,nullif(btrim(p_remarks),'')) RETURNING id INTO a;
  UPDATE public.workshop_visits SET current_assigned_to=p_store_incharge_id,updated_at=n WHERE id=w.id;
  UPDATE public.vehicles SET current_assigned_to=p_store_incharge_id WHERE id=w.vehicle_id;
  INSERT INTO public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata)
  VALUES(w.id,w.vehicle_id,'STORE_INCHARGE_ASSIGNED','STORE','STORE',w.current_status,w.current_status,auth.uid(),n,nullif(btrim(p_remarks),''),jsonb_build_object('store_assignment_id',a,'previous_assigned_to',previous,'store_incharge_id',p_store_incharge_id));
  RETURN a;
END;
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.set_store_assignment(uuid,uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION pagariya_workflow_private.assert_store_actor(p_visit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text; w public.workshop_visits%ROWTYPE;
BEGIN
  SELECT role INTO r FROM public.profiles WHERE id=auth.uid() AND is_active;
  IF r IS NULL OR r NOT IN ('store_team','ceo_admin') THEN RAISE EXCEPTION 'Your account cannot process Store vehicles.'; END IF;
  SELECT * INTO w FROM public.workshop_visits WHERE id=p_visit_id FOR UPDATE;
  IF NOT FOUND OR w.closed_at IS NOT NULL OR w.current_stage<>'STORE' OR w.current_status NOT IN ('PENDING','IN_PROGRESS') THEN
    RAISE EXCEPTION 'This vehicle is no longer available in Store.';
  END IF;
  IF r='store_team' AND (w.current_assigned_to IS DISTINCT FROM auth.uid() OR NOT EXISTS(
    SELECT 1 FROM public.vehicle_assignments WHERE visit_id=w.id AND vehicle_id=w.vehicle_id AND assignment_role='STORE_TEAM' AND assigned_to=auth.uid() AND unassigned_at IS NULL
  )) THEN RAISE EXCEPTION 'This vehicle is not assigned to your Store account.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.assert_store_actor(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.new_workflow_active_store_incharges()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text; people jsonb;
BEGIN
  SELECT role INTO r FROM public.profiles WHERE id=auth.uid() AND is_active;
  IF r IS NULL OR r NOT IN ('advisor','ceo_admin') THEN RAISE EXCEPTION 'Your account cannot assign Store vehicles.'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name NULLS LAST,id),'[]'::jsonb)
  INTO people FROM public.profiles WHERE role='store_team' AND is_active;
  RETURN jsonb_build_object('items',people);
END;
$$;
REVOKE ALL ON FUNCTION public.new_workflow_active_store_incharges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_active_store_incharges() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.new_workflow_assign_store(p_visit_id uuid,p_store_incharge_id uuid,p_expected_assigned_to uuid,p_remarks text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.workshop_visits%ROWTYPE; a uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='ceo_admin' AND is_active) THEN
    RAISE EXCEPTION 'Only CEO Admin can change the Store Incharge.';
  END IF;
  SELECT * INTO w FROM public.workshop_visits WHERE id=p_visit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workshop visit not found.'; END IF;
  IF w.current_assigned_to IS DISTINCT FROM p_expected_assigned_to THEN RAISE EXCEPTION 'The assignment has changed. Refresh and try again.'; END IF;
  a:=pagariya_workflow_private.set_store_assignment(w.id,p_store_incharge_id,p_remarks);
  RETURN jsonb_build_object('success',true,'visit_id',w.id,'store_assignment_id',a,'store_incharge_id',p_store_incharge_id);
END;
$$;
REVOKE ALL ON FUNCTION public.new_workflow_assign_store(uuid,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_assign_store(uuid,uuid,uuid,text) TO authenticated, service_role;

-- Restrictive policies combine with existing policies; other roles keep their current scope.
CREATE OR REPLACE FUNCTION pagariya_workflow_private.store_vehicle_visible(p_vehicle_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active AND (
    p.role<>'store_team' OR EXISTS(
      SELECT 1 FROM public.workshop_visits w JOIN public.vehicle_assignments a ON a.visit_id=w.id AND a.vehicle_id=w.vehicle_id
      WHERE w.vehicle_id=p_vehicle_id AND w.closed_at IS NULL AND w.current_stage='STORE' AND w.current_status IN ('PENDING','IN_PROGRESS')
        AND w.current_assigned_to=p.id AND a.assignment_role='STORE_TEAM' AND a.assigned_to=p.id AND a.unassigned_at IS NULL
    )
  ));
$$;
REVOKE ALL ON FUNCTION pagariya_workflow_private.store_vehicle_visible(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA pagariya_workflow_private TO authenticated;
GRANT EXECUTE ON FUNCTION pagariya_workflow_private.store_vehicle_visible(uuid) TO authenticated;
CREATE POLICY store_assigned_scope ON public.vehicles AS RESTRICTIVE FOR SELECT TO authenticated USING(pagariya_workflow_private.store_vehicle_visible(id));
CREATE POLICY store_assigned_scope ON public.workshop_visits AS RESTRICTIVE FOR SELECT TO authenticated USING(pagariya_workflow_private.store_vehicle_visible(vehicle_id));
CREATE POLICY store_assigned_scope ON public.part_requisitions AS RESTRICTIVE FOR SELECT TO authenticated USING(pagariya_workflow_private.store_vehicle_visible(vehicle_id));
CREATE POLICY store_assigned_scope ON public.part_orders AS RESTRICTIVE FOR SELECT TO authenticated USING(pagariya_workflow_private.store_vehicle_visible(vehicle_id));
CREATE POLICY store_assigned_scope ON public.advisor_work AS RESTRICTIVE FOR SELECT TO authenticated USING(pagariya_workflow_private.store_vehicle_visible(vehicle_id));
CREATE POLICY store_assigned_scope ON public.vehicle_assignments AS RESTRICTIVE FOR SELECT TO authenticated USING(pagariya_workflow_private.store_vehicle_visible(vehicle_id));

CREATE OR REPLACE FUNCTION public.new_workflow_process_advisor_work_assigned(p_visit_id uuid, p_work_path text, p_requisition_no text DEFAULT NULL::text, p_requisition_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_remarks text DEFAULT NULL::text, p_store_incharge_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
  v_role text;

  v_visit public.workshop_visits%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_job public.vehicle_jobs%rowtype;

  v_advisor_work_id uuid;
  v_part_requisition_id uuid;
  v_event_id uuid;
  v_stage_history_id uuid;

  v_now timestamptz := now();

  v_input_path text;
  v_stored_path text;
  v_requisition_no text;
  v_remarks text;

  v_parts_required boolean := false;
  v_denting_required boolean := false;
  v_painting_required boolean := false;

  v_next_stage text;
  v_next_status text := 'PENDING';

  v_from_stage text;
  v_from_status text;

  v_approval_cycle_id uuid;
  v_scope_count integer := 0;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id=v_user_id
    and p.is_active=true
  limit 1;

  if v_role is null then
    raise exception 'Active user profile not found.';
  end if;

  if v_role not in ('advisor','ceo_admin') then
    raise exception 'Only Advisors or CEO Admin can process Advisor Work.';
  end if;

  if p_visit_id is null then
    raise exception 'Visit ID is required.';
  end if;

  v_input_path := upper(trim(coalesce(p_work_path,'')));
  v_requisition_no := nullif(trim(coalesce(p_requisition_no,'')),'');
  v_remarks := nullif(trim(coalesce(p_remarks,'')),'');

  if v_input_path not in (
    'PARTS_REQUIRED',
    'NO_PARTS_REQUIRED',
    'ONLY_PARTS',
    'DENTING_PAINTING_PARTS',
    'ONLY_DENTING_PAINTING'
  ) then
    raise exception 'Invalid Advisor Work selection.';
  end if;

  v_parts_required := v_input_path in (
    'PARTS_REQUIRED',
    'ONLY_PARTS',
    'DENTING_PAINTING_PARTS'
  );

  v_stored_path :=
    case
      when v_parts_required then 'PARTS_REQUIRED'
      else 'NO_PARTS_REQUIRED'
    end;

  if v_parts_required then
    perform pagariya_workflow_private.validate_store_incharge(p_store_incharge_id);
  end if;

  v_next_stage :=
    case
      when v_parts_required then 'STORE'
      else 'FLOOR'
    end;

  select *
  into v_visit
  from public.workshop_visits
  where id=p_visit_id
  for update;

  if not found then
    raise exception 'Workshop visit not found.';
  end if;

  if v_visit.current_stage <> 'ADVISOR_WORK' then
    raise exception 'Vehicle is not currently in Advisor Work. Current stage: %', v_visit.current_stage;
  end if;

  if v_visit.current_status not in ('PENDING','IN_PROGRESS') then
    raise exception 'Vehicle cannot be processed from its current status: %', v_visit.current_status;
  end if;

  if v_role='advisor' then
    if v_visit.current_assigned_to is null then
      raise exception 'This vehicle is not assigned to an Advisor.';
    end if;

    if v_visit.current_assigned_to<>v_user_id then
      raise exception 'You are not the Advisor assigned to this vehicle.';
    end if;
  end if;

  select *
  into v_vehicle
  from public.vehicles
  where id=v_visit.vehicle_id
  for update;

  if not found then
    raise exception 'Vehicle not found.';
  end if;

  select *
  into v_job
  from public.vehicle_jobs
  where vehicle_id=v_visit.vehicle_id
    and current_job_stage<>'CLOSED'
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Active vehicle job not found for this vehicle.';
  end if;

  if v_job.approval_status<>'APPROVED'
     or not exists (
       select 1
       from public.approval_cycles
       where visit_id=p_visit_id
         and vehicle_id=v_job.vehicle_id
         and cycle_type='INITIAL'
         and decision='APPROVED'
     ) then
    raise exception 'Initial approval and active job approval must agree before continuing. Ask CEO Admin to reconcile this record.';
  end if;

  if exists (
    select 1
    from public.supplementary_cycles
    where visit_id=p_visit_id
      and status='APPROVED'
  ) then
    raise exception 'Use Supplementary Advisor Work for this requirement.';
  end if;

  if exists (
    select 1
    from public.advisor_work aw
    where aw.visit_id=p_visit_id
  ) then
    raise exception 'Advisor Work has already been recorded for this vehicle.';
  end if;

  select ac.id
  into v_approval_cycle_id
  from public.approval_cycles ac
  where ac.visit_id=p_visit_id
    and ac.vehicle_id=v_vehicle.id
    and ac.cycle_type='INITIAL'
    and ac.decision='APPROVED'
  order by ac.cycle_no desc, ac.created_at desc
  limit 1;

  select count(*)
  into v_scope_count
  from public.approval_work_scope aws
  where aws.approval_cycle_id=v_approval_cycle_id;

  if v_scope_count > 0 then
    select exists(
      select 1
      from public.approval_work_scope aws
      join public.work_type_master w on w.id=aws.work_type_id
      where aws.approval_cycle_id=v_approval_cycle_id
        and w.code='DENTING'
    )
    into v_denting_required;

    select exists(
      select 1
      from public.approval_work_scope aws
      join public.work_type_master w on w.id=aws.work_type_id
      where aws.approval_cycle_id=v_approval_cycle_id
        and w.code='PAINTING'
    )
    into v_painting_required;
  else
    -- Historical compatibility only.
    v_denting_required :=
      v_input_path in ('DENTING_PAINTING_PARTS','ONLY_DENTING_PAINTING');

    v_painting_required :=
      v_input_path in ('DENTING_PAINTING_PARTS','ONLY_DENTING_PAINTING');
  end if;

  if v_parts_required then
    if v_requisition_no is null then
      raise exception 'Requisition No. is required when parts are required.';
    end if;

    if p_requisition_at is null then
      raise exception 'Requisition Date & Time is required when parts are required.';
    end if;

    if p_requisition_at > v_now then
      raise exception 'Requisition Date & Time cannot be in the future.';
    end if;
  else
    v_requisition_no := null;
  end if;

  update public.workflow_stage_history
  set
    exited_at=v_now,
    exited_by=v_user_id,
    status='COMPLETED'
  where visit_id=p_visit_id
    and stage='ADVISOR_WORK'
    and status='OPEN';

  insert into public.advisor_work(
    visit_id,
    vehicle_id,
    work_path,
    parts_required,
    denting_required,
    painting_required,
    advisor_requisition_no,
    requisition_at,
    assigned_by,
    remarks,
    created_at,
    updated_at
  )
  values(
    p_visit_id,
    v_vehicle.id,
    v_stored_path,
    v_parts_required,
    v_denting_required,
    v_painting_required,
    v_requisition_no,
    case when v_parts_required then p_requisition_at else null end,
    v_user_id,
    v_remarks,
    v_now,
    v_now
  )
  returning id into v_advisor_work_id;

  if v_parts_required then
    insert into public.part_requisitions(
      visit_id,
      vehicle_id,
      advisor_work_id,
      requisition_no,
      requisition_at,
      requested_by,
      status,
      remarks,
      created_at
    )
    values(
      p_visit_id,
      v_vehicle.id,
      v_advisor_work_id,
      v_requisition_no,
      p_requisition_at,
      v_user_id,
      'PENDING',
      v_remarks,
      v_now
    )
    returning id into v_part_requisition_id;
  end if;

  v_from_stage := v_visit.current_stage;
  v_from_status := v_visit.current_status;

  insert into public.workflow_events(
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
    metadata,
    created_at
  )
  values(
    p_visit_id,
    v_vehicle.id,
    'ADVISOR_WORK_COMPLETED',
    v_from_stage,
    v_next_stage,
    v_from_status,
    v_next_status,
    v_user_id,
    v_now,
    v_remarks,
    jsonb_build_object(
      'advisor_work_id',v_advisor_work_id,
      'part_requisition_id',v_part_requisition_id,
      'work_path',v_stored_path,
      'parts_required',v_parts_required,
      'approved_floor_scope_source',
        case when v_scope_count>0 then 'APPROVAL_WORK_SCOPE' else 'LEGACY_FALLBACK' end,
      'approval_cycle_id',v_approval_cycle_id,
      'denting_required',v_denting_required,
      'painting_required',v_painting_required,
      'requisition_no',v_requisition_no,
      'requisition_at',p_requisition_at
    ),
    v_now
  )
  returning id into v_event_id;

  insert into public.workflow_stage_history(
    visit_id,
    vehicle_id,
    stage,
    entered_at,
    entered_by,
    status,
    remarks,
    created_at
  )
  values(
    p_visit_id,
    v_vehicle.id,
    v_next_stage,
    v_now,
    v_user_id,
    'OPEN',
    v_remarks,
    v_now
  )
  returning id into v_stage_history_id;

  update public.workshop_visits
  set
    current_stage=v_next_stage,
    current_status=v_next_status,
    stage_started_at=v_now
  where id=p_visit_id;

  update public.vehicles
  set
    current_stage=v_next_stage,
    current_status=v_next_status,
    stage_started_at=v_now
  where id=v_vehicle.id;

  update public.vehicle_jobs
  set
    current_job_stage=v_next_stage,
    updated_at=v_now
  where id=v_job.id;

  if v_parts_required then
    perform pagariya_workflow_private.set_store_assignment(p_visit_id,p_store_incharge_id,v_remarks);
  end if;

  return jsonb_build_object(
    'success',true,
    'visit_id',p_visit_id,
    'vehicle_id',v_vehicle.id,
    'advisor_work_id',v_advisor_work_id,
    'part_requisition_id',v_part_requisition_id,
    'work_path',v_stored_path,
    'parts_required',v_parts_required,
    'denting_required',v_denting_required,
    'painting_required',v_painting_required,
    'approved_floor_scope_source',
      case when v_scope_count>0 then 'APPROVAL_WORK_SCOPE' else 'LEGACY_FALLBACK' end,
    'approval_cycle_id',v_approval_cycle_id,
    'requisition_no',v_requisition_no,
    'requisition_at',case when v_parts_required then p_requisition_at else null end,
    'from_stage',v_from_stage,
    'from_status',v_from_status,
    'stage',v_next_stage,
    'status',v_next_status,
    'workflow_event_id',v_event_id,
    'stage_history_id',v_stage_history_id,
    'processed_at',v_now
  );
end;
$function$
;

REVOKE ALL ON FUNCTION public.new_workflow_process_advisor_work_assigned(uuid,text,text,timestamptz,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_process_advisor_work_assigned(uuid,text,text,timestamptz,text,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.new_workflow_process_advisor_work(p_visit_id uuid,p_work_path text,p_requisition_no text DEFAULT NULL,p_requisition_at timestamptz DEFAULT NULL,p_remarks text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF upper(trim(coalesce(p_work_path,''))) IN ('PARTS_REQUIRED','ONLY_PARTS','DENTING_PAINTING_PARTS') THEN
    RAISE EXCEPTION 'Select a Store Incharge before sending this vehicle to Store. Refresh the app and try again.';
  END IF;
  RETURN public.new_workflow_process_advisor_work_assigned(p_visit_id,p_work_path,p_requisition_no,p_requisition_at,p_remarks,NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.new_workflow_process_advisor_work_v3(p_visit_id uuid,p_work_path text,p_requisition_no text DEFAULT NULL,p_requisition_at timestamptz DEFAULT NULL,p_remarks text DEFAULT NULL,p_floor_incharge_id uuid DEFAULT NULL,p_store_incharge_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF upper(trim(coalesce(p_work_path,''))) IN ('PARTS_REQUIRED','ONLY_PARTS','DENTING_PAINTING_PARTS') THEN
    RETURN public.new_workflow_process_advisor_work_assigned(p_visit_id,p_work_path,p_requisition_no,p_requisition_at,p_remarks,p_store_incharge_id);
  END IF;
  RETURN public.new_workflow_process_advisor_work_v2(p_visit_id,p_work_path,p_requisition_no,p_requisition_at,p_remarks,p_floor_incharge_id);
END; $$;
REVOKE ALL ON FUNCTION public.new_workflow_process_advisor_work_v3(uuid,text,text,timestamptz,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_process_advisor_work_v3(uuid,text,text,timestamptz,text,uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.new_workflow_supplementary_parts_assigned(p_cycle_id uuid, p_work_path text, p_requisition_no text, p_requisition_at timestamp with time zone, p_remarks text DEFAULT NULL::text, p_store_incharge_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  PERFORM pagariya_workflow_private.validate_store_incharge(p_store_incharge_id);
  INSERT INTO public.part_requisitions(visit_id,vehicle_id,advisor_work_id,supplementary_cycle_id,requisition_no,requisition_at,requested_by,remarks) VALUES(visit,s.vehicle_id,work,s.id,btrim(p_requisition_no),p_requisition_at,auth.uid(),p_remarks) RETURNING id INTO req;
  UPDATE public.supplementary_cycles SET work_path=p_work_path WHERE id=s.id;
  PERFORM pagariya_workflow_private.move_stage(c,'STORE','PENDING','SUPPLEMENTARY_WORK_REQUIREMENT_SAVED',s.id,p_remarks,jsonb_build_object('part_requisition_id',req,'work_path',p_work_path));
  PERFORM pagariya_workflow_private.set_store_assignment(visit,p_store_incharge_id,p_remarks);
  RETURN jsonb_build_object('success',true,'part_requisition_id',req,'store_incharge_id',p_store_incharge_id);
END;
$function$
;

REVOKE ALL ON FUNCTION public.new_workflow_supplementary_parts_assigned(uuid,text,text,timestamptz,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_supplementary_parts_assigned(uuid,text,text,timestamptz,text,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.new_workflow_supplementary_parts(p_cycle_id uuid,p_work_path text,p_requisition_no text,p_requisition_at timestamptz,p_remarks text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Select a Store Incharge before sending this vehicle to Store. Refresh the app and try again.'; END; $$;

CREATE OR REPLACE FUNCTION public.new_workflow_create_part_order(p_visit_id uuid, p_part_order_no text, p_order_type text, p_ordered_at timestamp with time zone, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE
    v_user_id uuid;
    v_role text;

    v_visit public.workshop_visits%rowtype;
    v_vehicle public.vehicles%rowtype;

    v_part_requisition public.part_requisitions%rowtype;

    v_part_order_id uuid;
    v_event_id uuid;

    v_now timestamptz := now();

    v_part_order_no text;
    v_order_type text;
    v_remarks text;

BEGIN

    -- ========================================================
    -- 1. Authentication
    -- ========================================================

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;


    -- ========================================================
    -- 2. Active profile + role
    -- ========================================================

    SELECT
        p.role
    INTO
        v_role
    FROM public.profiles p
    WHERE p.id = v_user_id
      AND p.is_active = true
    LIMIT 1;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Active user profile not found.';
    END IF;


    IF v_role NOT IN (
        'store_team',
        'ceo_admin'
    ) THEN
        RAISE EXCEPTION
            'Only Store Team or CEO Admin can create Part Orders.';
    END IF;


    -- ========================================================
    -- 3. Validate Visit ID
    -- ========================================================

    IF p_visit_id IS NULL THEN
        RAISE EXCEPTION 'Visit ID is required.';
    END IF;


    -- ========================================================
    -- 4. Normalize inputs
    -- ========================================================

    v_part_order_no :=
        nullif(trim(coalesce(p_part_order_no, '')), '');

    v_order_type :=
        upper(trim(coalesce(p_order_type, '')));

    v_remarks :=
        nullif(trim(coalesce(p_remarks, '')), '');


    -- ========================================================
    -- 5. Validate Part Order No.
    -- ========================================================

    IF v_part_order_no IS NULL THEN
        RAISE EXCEPTION 'Part Order No. is required.';
    END IF;


    -- ========================================================
    -- 6. Validate Order Type
    -- ========================================================

    IF v_order_type NOT IN (
        'REGULAR',
        'EXPRESS',
        'PVIP',
        'VOR'
    ) THEN
        RAISE EXCEPTION
            'Invalid Order Type. Allowed values are REGULAR, EXPRESS, PVIP, VOR.';
    END IF;


    -- ========================================================
    -- 7. Validate Order Date & Time
    -- ========================================================

    IF p_ordered_at IS NULL THEN
        RAISE EXCEPTION 'Order Date & Time is required.';
    END IF;


    IF p_ordered_at > v_now THEN
        RAISE EXCEPTION
            'Order Date & Time cannot be in the future.';
    END IF;


    -- ========================================================
    -- 8. Lock Workshop Visit
    -- ========================================================

    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = p_visit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workshop visit not found.';
    END IF;


    PERFORM pagariya_workflow_private.assert_store_actor(v_visit.id);

    -- ========================================================
    -- 9. Validate Current Stage
    -- ========================================================

    IF v_visit.current_stage <> 'STORE' THEN
        RAISE EXCEPTION
            'Vehicle is not currently in Store. Current stage: %',
            v_visit.current_stage;
    END IF;


    -- ========================================================
    -- 10. Validate Current Status
    -- ========================================================

    IF v_visit.current_status NOT IN (
        'PENDING',
        'IN_PROGRESS'
    ) THEN
        RAISE EXCEPTION
            'Vehicle cannot be processed from its current status: %',
            v_visit.current_status;
    END IF;


    -- ========================================================
    -- 11. Lock Vehicle
    -- ========================================================

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_visit.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle not found.';
    END IF;


    -- ========================================================
    -- 12. Find Parts Requisition
    --
    -- A vehicle can reach STORE only through a parts
    -- workflow. The Advisor Work RPC creates the requisition.
    -- ========================================================

    SELECT *
    INTO v_part_requisition
    FROM public.part_requisitions pr
    WHERE pr.visit_id = p_visit_id
      AND pr.vehicle_id = v_vehicle.id
      AND pr.status = 'PENDING'
    ORDER BY pr.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No pending Parts Requisition was found for this vehicle.';
    END IF;


    -- ========================================================
    -- 13. Prevent Duplicate Part Order
    -- ========================================================

    IF EXISTS (
        SELECT 1
        FROM public.part_orders po
        WHERE po.part_requisition_id = v_part_requisition.id
          AND po.status <> 'CANCELLED'
    ) THEN

        RAISE EXCEPTION
            'A Part Order has already been created for this requisition.';

    END IF;


    -- ========================================================
    -- 14. Create Part Order
    -- ========================================================

    INSERT INTO public.part_orders (
        visit_id,
        vehicle_id,
        part_requisition_id,
        part_order_no,
        order_type,
        ordered_at,
        ordered_by,
        status,
        remarks,
        created_at
    )
    VALUES (
        p_visit_id,
        v_vehicle.id,
        v_part_requisition.id,
        v_part_order_no,
        v_order_type,
        p_ordered_at,
        v_user_id,
        'ORDERED',
        v_remarks,
        v_now
    )
    RETURNING id
    INTO v_part_order_id;


    -- ========================================================
    -- 15. Update Parts Requisition
    -- ========================================================

    UPDATE public.part_requisitions
    SET
        status = 'ORDERED'
    WHERE id = v_part_requisition.id;


    -- ========================================================
    -- 16. Create Workflow Event
    --
    -- This is an action inside STORE.
    -- The vehicle DOES NOT move to another stage here.
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
        metadata,
        created_at
    )
    VALUES (
        p_visit_id,
        v_vehicle.id,
        'PART_ORDER_CREATED',
        v_visit.current_stage,
        v_visit.current_stage,
        v_visit.current_status,
        v_visit.current_status,
        v_user_id,
        v_now,
        v_remarks,
        jsonb_build_object(
            'part_order_id', v_part_order_id,
            'part_requisition_id', v_part_requisition.id,
            'part_order_no', v_part_order_no,
            'order_type', v_order_type,
            'ordered_at', p_ordered_at
        ),
        v_now
    )
    RETURNING id
    INTO v_event_id;


    -- ========================================================
    -- 17. Return Result
    -- ========================================================

    RETURN jsonb_build_object(
        'success', true,

        'visit_id', p_visit_id,
        'vehicle_id', v_vehicle.id,

        'part_requisition_id', v_part_requisition.id,
        'part_order_id', v_part_order_id,

        'part_order_no', v_part_order_no,
        'order_type', v_order_type,
        'ordered_at', p_ordered_at,

        'previous_stage', v_visit.current_stage,
        'current_stage', v_visit.current_stage,

        'previous_status', v_visit.current_status,
        'current_status', v_visit.current_status,

        'workflow_event_id', v_event_id,

        'processed_at', v_now
    );


EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.new_workflow_receive_parts(p_part_order_id uuid, p_parts_received_at timestamp with time zone, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_role text;

    v_order public.part_orders%ROWTYPE;
    v_visit public.workshop_visits%ROWTYPE;
    v_vehicle public.vehicles%ROWTYPE;

    v_remarks text;
    v_event_id uuid;
BEGIN

    /* ========================================================
       1. AUTHENTICATION
    ======================================================== */

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required';
    END IF;


    /* ========================================================
       2. ACTIVE PROFILE + ROLE
    ======================================================== */

    SELECT p.role
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id
      AND p.is_active = TRUE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Active user profile is required';
    END IF;

    IF v_role NOT IN ('store_team', 'ceo_admin') THEN
        RAISE EXCEPTION
            'Only Store Team or CEO Admin can receive parts';
    END IF;


    /* ========================================================
       3. INPUT VALIDATION
    ======================================================== */

    IF p_part_order_id IS NULL THEN
        RAISE EXCEPTION 'Part order is required';
    END IF;

    IF p_parts_received_at IS NULL THEN
        RAISE EXCEPTION
            'Parts received date and time are required';
    END IF;

    IF p_parts_received_at > NOW() THEN
        RAISE EXCEPTION
            'Parts received date and time cannot be in the future';
    END IF;

    v_remarks :=
        NULLIF(
            BTRIM(COALESCE(p_remarks, '')),
            ''
        );


    /* ========================================================
       4. LOCK PART ORDER
    ======================================================== */

    SELECT *
    INTO v_order
    FROM public.part_orders
    WHERE id = p_part_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Part order not found';
    END IF;


    /* ========================================================
       5. LOCK VISIT
    ======================================================== */

    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = v_order.visit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workshop visit not found';
    END IF;


    PERFORM pagariya_workflow_private.assert_store_actor(v_visit.id);

    /* ========================================================
       6. LOCK VEHICLE
    ======================================================== */

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_order.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle not found';
    END IF;


    /* ========================================================
       7. VERIFY ORDER / VISIT / VEHICLE
    ======================================================== */

    IF v_order.visit_id <> v_visit.id THEN
        RAISE EXCEPTION
            'Part order does not belong to this visit';
    END IF;

    IF v_order.vehicle_id <> v_vehicle.id THEN
        RAISE EXCEPTION
            'Part order does not belong to this vehicle';
    END IF;


    /* ========================================================
       8. VERIFY CURRENT WORKFLOW STAGE
    ======================================================== */

    IF v_visit.current_stage <> 'STORE' THEN
        RAISE EXCEPTION
            'Vehicle is not currently in STORE. Current stage: %',
            v_visit.current_stage;
    END IF;

    IF v_visit.current_status NOT IN (
        'PENDING',
        'IN_PROGRESS'
    ) THEN
        RAISE EXCEPTION
            'Vehicle is not available for Store processing. Current status: %',
            v_visit.current_status;
    END IF;


    /* ========================================================
       9. VERIFY PART ORDER STATUS
    ======================================================== */

    IF v_order.status = 'RECEIVED' THEN
        RAISE EXCEPTION
            'Parts have already been marked as received';
    END IF;

    IF v_order.status = 'HANDED_TO_FLOOR' THEN
        RAISE EXCEPTION
            'Parts have already been handed to Floor';
    END IF;

    IF v_order.status NOT IN (
        'ORDERED',
        'PARTIALLY_RECEIVED'
    ) THEN
        RAISE EXCEPTION
            'Part order cannot be received from its current status: %',
            v_order.status;
    END IF;


    /* ========================================================
       10. VERIFY PART REQUISITION
    ======================================================== */

    IF NOT EXISTS (
        SELECT 1
        FROM public.part_requisitions pr
        WHERE pr.id = v_order.part_requisition_id
          AND pr.visit_id = v_order.visit_id
          AND pr.vehicle_id = v_order.vehicle_id
    ) THEN
        RAISE EXCEPTION
            'The part requisition linked to this order could not be verified';
    END IF;


    /* ========================================================
       11. UPDATE PART ORDER
    ======================================================== */

    UPDATE public.part_orders
    SET
        status = 'RECEIVED',
        parts_received_at = p_parts_received_at,
        parts_received_by = v_user_id,
        remarks = CASE
            WHEN v_remarks IS NOT NULL
                THEN v_remarks
            ELSE remarks
        END
    WHERE id = v_order.id;


    /* ========================================================
       12. WORKFLOW EVENT
       
       IMPORTANT:
       The vehicle remains in STORE.
       No stage-history transition happens here.
    ======================================================== */

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
        metadata,
        created_at
    )
    VALUES (
        v_visit.id,
        v_vehicle.id,
        'PARTS_RECEIVED',
        v_visit.current_stage,
        v_visit.current_stage,
        v_visit.current_status,
        v_visit.current_status,
        v_user_id,
        NOW(),
        v_remarks,
        jsonb_build_object(
            'part_order_id', v_order.id,
            'part_order_no', v_order.part_order_no,
            'order_type', v_order.order_type,
            'previous_order_status', v_order.status,
            'new_order_status', 'RECEIVED',
            'parts_received_at', p_parts_received_at,
            'received_by', v_user_id
        ),
        NOW()
    )
    RETURNING id
    INTO v_event_id;


    /* ========================================================
       13. RETURN RESULT
    ======================================================== */

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Parts received successfully',

        'part_order_id', v_order.id,
        'part_order_no', v_order.part_order_no,

        'visit_id', v_visit.id,
        'vehicle_id', v_vehicle.id,

        'order_status', 'RECEIVED',

        'parts_received_at', p_parts_received_at,
        'parts_received_by', v_user_id,

        'current_stage', v_visit.current_stage,
        'current_status', v_visit.current_status,

        'workflow_event_id', v_event_id
    );

END;
$function$
;

CREATE OR REPLACE FUNCTION public.new_workflow_hand_over_parts_to_floor_core(p_part_order_id uuid, p_floor_incharge_id uuid, p_handed_over_at timestamp with time zone, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_role text;

    v_order public.part_orders%ROWTYPE;
    v_visit public.workshop_visits%ROWTYPE;
    v_vehicle public.vehicles%ROWTYPE;
    v_job public.vehicle_jobs%ROWTYPE;
    v_supplementary public.supplementary_cycles%ROWTYPE;
    v_return_floor_cycle_id uuid;

    v_floor_profile public.profiles%ROWTYPE;

    v_store_history public.workflow_stage_history%ROWTYPE;

    v_assignment_id uuid;
    v_handover_id uuid;
    v_floor_history_id uuid;
    v_event_id uuid;

    v_remarks text;
    v_status_before text;
BEGIN

    /* ========================================================
       1. AUTHENTICATION
    ======================================================== */

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required';
    END IF;


    /* ========================================================
       2. ACTIVE USER + ROLE
    ======================================================== */

    SELECT p.role
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id
      AND p.is_active = TRUE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Active user profile is required';
    END IF;

    IF v_role NOT IN ('store_team', 'ceo_admin') THEN
        RAISE EXCEPTION
            'Only Store Team or CEO Admin can hand over parts to Floor';
    END IF;


    /* ========================================================
       3. INPUT VALIDATION
    ======================================================== */

    IF p_part_order_id IS NULL THEN
        RAISE EXCEPTION 'Part order is required';
    END IF;

    IF p_floor_incharge_id IS NULL THEN
        RAISE EXCEPTION 'Floor Incharge is required';
    END IF;

    IF p_handed_over_at IS NULL THEN
        RAISE EXCEPTION
            'Parts handover date and time are required';
    END IF;

    IF p_handed_over_at > NOW() THEN
        RAISE EXCEPTION
            'Parts handover date and time cannot be in the future';
    END IF;

    v_remarks :=
        NULLIF(
            BTRIM(COALESCE(p_remarks, '')),
            ''
        );


    /* ========================================================
       4. VERIFY FLOOR INCHARGE
    ======================================================== */

    SELECT *
    INTO v_floor_profile
    FROM public.profiles p
    WHERE p.id = p_floor_incharge_id
      AND p.role = 'floor_incharge'
      AND p.is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Selected Floor Incharge is not an active Floor Incharge';
    END IF;


    /* ========================================================
       5. LOCK PART ORDER
    ======================================================== */

    SELECT *
    INTO v_order
    FROM public.part_orders
    WHERE id = p_part_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Part order not found';
    END IF;


    /* ========================================================
       6. LOCK VISIT
    ======================================================== */

    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = v_order.visit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workshop visit not found';
    END IF;


    PERFORM pagariya_workflow_private.assert_store_actor(v_visit.id);

    /* ========================================================
       7. LOCK VEHICLE
    ======================================================== */

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_order.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle not found';
    END IF;


    /* ========================================================
       8. VERIFY ORDER / VISIT / VEHICLE
    ======================================================== */

    IF v_order.visit_id <> v_visit.id THEN
        RAISE EXCEPTION
            'Part order does not belong to this visit';
    END IF;

    IF v_order.vehicle_id <> v_vehicle.id THEN
        RAISE EXCEPTION
            'Part order does not belong to this vehicle';
    END IF;


    /* ========================================================
       9. VERIFY CURRENT STAGE
    ======================================================== */

    IF v_visit.current_stage <> 'STORE' THEN
        RAISE EXCEPTION
            'Vehicle is not currently in STORE. Current stage: %',
            v_visit.current_stage;
    END IF;

    IF v_visit.current_status NOT IN (
        'PENDING',
        'IN_PROGRESS'
    ) THEN
        RAISE EXCEPTION
            'Vehicle is not available for Store processing. Current status: %',
            v_visit.current_status;
    END IF;


    /* ========================================================
       10. VERIFY PART ORDER STATUS
    ======================================================== */

    SELECT * INTO v_job FROM public.vehicle_jobs WHERE vehicle_id=v_vehicle.id AND current_job_stage<>'CLOSED' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active vehicle job not found for this vehicle.'; END IF;
    IF v_job.approval_status <> 'APPROVED' OR NOT EXISTS (SELECT 1 FROM public.approval_cycles WHERE visit_id=v_visit.id AND vehicle_id=v_job.vehicle_id AND cycle_type='INITIAL' AND decision='APPROVED') THEN RAISE EXCEPTION 'Initial approval and active job approval must agree before continuing. Ask CEO Admin to reconcile this record.'; END IF;
    SELECT s.* INTO v_supplementary FROM public.supplementary_cycles s JOIN public.part_requisitions r ON r.supplementary_cycle_id=s.id WHERE r.id=v_order.part_requisition_id AND s.visit_id=v_visit.id AND s.vehicle_id=v_vehicle.id FOR UPDATE OF s;
    IF v_supplementary.id IS NOT NULL AND v_supplementary.status<>'APPROVED' THEN RAISE EXCEPTION 'Supplementary parts are not approved for handover.'; END IF;

    IF v_order.status = 'HANDED_TO_FLOOR' THEN
        RAISE EXCEPTION
            'Parts have already been handed to Floor';
    END IF;

    IF v_order.status <> 'RECEIVED' THEN
        RAISE EXCEPTION
            'Parts must be received before handover. Current order status: %',
            v_order.status;
    END IF;


    /* ========================================================
       11. FIND CURRENT OPEN STORE STAGE
    ======================================================== */

    SELECT *
    INTO v_store_history
    FROM public.workflow_stage_history h
    WHERE h.visit_id = v_visit.id
      AND h.stage = 'STORE'
      AND h.status = 'OPEN'
    ORDER BY h.entered_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Open STORE workflow stage was not found';
    END IF;


    /* ========================================================
       12. SAVE CURRENT STATUS
    ======================================================== */

    v_status_before := v_visit.current_status;


    /* ========================================================
       13. CLOSE STORE STAGE
    ======================================================== */

    UPDATE public.workflow_stage_history
    SET
        exited_at = p_handed_over_at,
        exited_by = v_user_id,
        status = 'COMPLETED',
        remarks = CASE
            WHEN v_remarks IS NOT NULL
                THEN v_remarks
            ELSE remarks
        END
    WHERE id = v_store_history.id;


    /* ========================================================
       14. CREATE FLOOR STAGE
    ======================================================== */

    INSERT INTO public.workflow_stage_history (
        visit_id,
        vehicle_id,
        stage,
        entered_at,
        exited_at,
        entered_by,
        exited_by,
        status,
        remarks,
        created_at
    )
    VALUES (
        v_visit.id,
        v_vehicle.id,
        'FLOOR',
        p_handed_over_at,
        NULL,
        v_user_id,
        NULL,
        'OPEN',
        v_remarks,
        NOW()
    )
    RETURNING id
    INTO v_floor_history_id;


    /* ========================================================
       15. UPDATE PART ORDER
    ======================================================== */

    UPDATE public.part_orders
    SET
        status = 'HANDED_TO_FLOOR',
        remarks = CASE
            WHEN v_remarks IS NOT NULL
                THEN v_remarks
            ELSE remarks
        END
    WHERE id = v_order.id;


    /* ========================================================
       16. CREATE FLOOR ASSIGNMENT
       
       If an open Floor assignment already exists for this visit,
       close it before creating the new one.
    ======================================================== */

    UPDATE public.vehicle_assignments
    SET
        unassigned_at = p_handed_over_at
    WHERE visit_id = v_visit.id
      AND assignment_role = 'FLOOR_INCHARGE'
      AND unassigned_at IS NULL;


    INSERT INTO public.vehicle_assignments (
        visit_id,
        vehicle_id,
        assigned_to,
        assigned_by,
        assignment_role,
        assigned_at,
        unassigned_at,
        remarks,
        created_at
    )
    VALUES (
        v_visit.id,
        v_vehicle.id,
        p_floor_incharge_id,
        v_user_id,
        'FLOOR_INCHARGE',
        p_handed_over_at,
        NULL,
        v_remarks,
        NOW()
    )
    RETURNING id
    INTO v_assignment_id;


    /* ========================================================
       17. CREATE PART HANDOVER
    ======================================================== */

    INSERT INTO public.part_handovers (
        visit_id,
        vehicle_id,
        part_order_id,
        handed_to,
        handed_by,
        handed_over_at,
        remarks,
        created_at
    )
    VALUES (
        v_visit.id,
        v_vehicle.id,
        v_order.id,
        p_floor_incharge_id,
        v_user_id,
        p_handed_over_at,
        v_remarks,
        NOW()
    )
    RETURNING id
    INTO v_handover_id;


    /* ========================================================
       18. UPDATE WORKSHOP VISIT
    ======================================================== */

    UPDATE public.workshop_visits
    SET
        current_stage = 'FLOOR',
        current_status = 'PENDING',
        stage_started_at = p_handed_over_at
    WHERE id = v_visit.id;


    /* ========================================================
       19. UPDATE VEHICLE
    ======================================================== */

    UPDATE public.vehicles
    SET
        current_stage = 'FLOOR',
        current_status = 'PENDING',
        current_assigned_to = p_floor_incharge_id,
        stage_started_at = p_handed_over_at
    WHERE id = v_vehicle.id;


    /* ========================================================
       20. WORKFLOW EVENT
    ======================================================== */

    UPDATE public.vehicle_jobs SET current_job_stage='FLOOR',floor_incharge_id=p_floor_incharge_id,floor_assigned_by=v_user_id,floor_assigned_at=p_handed_over_at,updated_at=now() WHERE id=v_job.id;
    IF v_supplementary.id IS NOT NULL THEN
        INSERT INTO public.floor_work_cycles(visit_id,vehicle_id,cycle_no,floor_incharge_id,vehicle_in_at,status,remarks)
        SELECT v_visit.id,v_vehicle.id,coalesce(max(cycle_no),0)+1,p_floor_incharge_id,p_handed_over_at,'ACTIVE','Returned after supplementary parts handover.' FROM public.floor_work_cycles WHERE visit_id=v_visit.id RETURNING id INTO v_return_floor_cycle_id;
        INSERT INTO public.floor_work_items(floor_work_cycle_id,work_type_id,status,remarks)
        SELECT v_return_floor_cycle_id,work_type_id,'PENDING','Resumed after supplementary parts handover.' FROM public.floor_work_items WHERE floor_work_cycle_id=v_supplementary.source_floor_cycle_id AND status<>'COMPLETED';
        UPDATE public.supplementary_cycles SET status='RETURNED_TO_FLOOR',return_floor_cycle_id=v_return_floor_cycle_id,returned_to_floor_at=p_handed_over_at WHERE id=v_supplementary.id;
    END IF;

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
        metadata,
        created_at
    )
    VALUES (
        v_visit.id,
        v_vehicle.id,
        'PARTS_HANDED_TO_FLOOR',
        'STORE',
        'FLOOR',
        v_status_before,
        'PENDING',
        v_user_id,
        NOW(),
        v_remarks,
        jsonb_build_object(
            'supplementary_cycle_id', v_supplementary.id,
            'return_floor_cycle_id', v_return_floor_cycle_id,
            'part_order_id', v_order.id,
            'part_order_no', v_order.part_order_no,
            'floor_incharge_id', p_floor_incharge_id,
            'floor_incharge_name', v_floor_profile.name,
            'handed_over_at', p_handed_over_at,
            'part_handover_id', v_handover_id,
            'floor_assignment_id', v_assignment_id,
            'floor_stage_history_id', v_floor_history_id
        ),
        NOW()
    )
    RETURNING id
    INTO v_event_id;


    /* ========================================================
       21. RETURN RESULT
    ======================================================== */

    UPDATE public.vehicle_assignments SET unassigned_at=now()
    WHERE visit_id=v_visit.id AND assignment_role='STORE_TEAM' AND unassigned_at IS NULL;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Parts handed over to Floor successfully',

        'visit_id', v_visit.id,
        'vehicle_id', v_vehicle.id,

        'part_order_id', v_order.id,
        'part_order_no', v_order.part_order_no,
        'order_status', 'HANDED_TO_FLOOR',

        'floor_incharge_id', p_floor_incharge_id,
        'floor_incharge_name', v_floor_profile.name,

        'handed_over_at', p_handed_over_at,

        'part_handover_id', v_handover_id,
        'floor_assignment_id', v_assignment_id,
        'floor_stage_history_id', v_floor_history_id,
        'workflow_event_id', v_event_id,

        'current_stage', 'FLOOR',
        'current_status', 'PENDING'
    );

END;
$function$
;

CREATE OR REPLACE FUNCTION public.new_workflow_supplementary_requisition_context(p_requisition_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r text; result jsonb;
BEGIN
 SELECT role INTO r FROM public.profiles WHERE id=auth.uid() AND is_active;
 IF r IS NULL OR r NOT IN ('advisor','ceo_admin','store_team') THEN RAISE EXCEPTION 'This account cannot view Store requirements.'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('requisition_id',q.id,'work_path',s.work_path,'cycle_no',s.cycle_no)),'[]'::jsonb) INTO result
 FROM public.part_requisitions q JOIN public.supplementary_cycles s ON s.id=q.supplementary_cycle_id AND s.visit_id=q.visit_id AND s.vehicle_id=q.vehicle_id
 WHERE q.id=ANY(p_requisition_ids) AND (r='ceo_admin' OR (r='store_team' AND pagariya_workflow_private.store_vehicle_visible(q.vehicle_id)) OR (r='advisor' AND pagariya_workflow_private.can_read_visit(q.visit_id)));
 RETURN result;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.new_workflow_create_part_order(uuid,text,text,timestamptz,text) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.new_workflow_receive_parts(uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_create_part_order(uuid,text,text,timestamptz,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.new_workflow_receive_parts(uuid,timestamptz,text) TO authenticated,service_role;

