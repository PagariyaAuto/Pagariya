CREATE OR REPLACE FUNCTION public.advance_vehicle_after_floor(p_vehicle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_job public.vehicle_jobs%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_progress public.floor_work_progress%ROWTYPE;
  v_authorized boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND is_active = true;

  IF v_role NOT IN ('advisor', 'floor_incharge', 'ceo_admin') THEN
    RAISE EXCEPTION 'You are not authorized to advance this vehicle.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.workshop_visits WHERE vehicle_id = p_vehicle_id AND closed_at IS NULL) THEN
    RAISE EXCEPTION 'Use the visit-based Floor workflow for this vehicle.';
  END IF;

  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found.';
  END IF;

  SELECT * INTO v_job
  FROM public.vehicle_jobs
  WHERE vehicle_id = p_vehicle_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.';
  END IF;

  IF v_role = 'ceo_admin' THEN
    v_authorized := true;
  ELSIF v_role = 'advisor' THEN
    v_authorized :=
      v_job.advisor_id = v_user_id
      OR v_vehicle.current_assigned_to = v_user_id;
  ELSIF v_role = 'floor_incharge' THEN
    v_authorized := v_job.floor_incharge_id = v_user_id;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'You are not assigned to this vehicle.';
  END IF;

  IF v_vehicle.current_stage <> 'FLOOR'
     OR v_job.current_job_stage <> 'FLOOR' THEN
    RAISE EXCEPTION 'Vehicle and job must both be at FLOOR.';
  END IF;

  SELECT * INTO v_progress
  FROM public.floor_work_progress
  WHERE job_id = v_job.id
  FOR UPDATE;

  IF NOT FOUND OR v_progress.status <> 'DONE' THEN
    RAISE EXCEPTION 'Mark floor work as done before advancing the vehicle.';
  END IF;

  UPDATE public.vehicles
  SET current_stage = 'WORKSHOP',
      current_status = 'WORKSHOP',
      stage_started_at = now(),
      updated_at = now()
  WHERE id = p_vehicle_id;

  UPDATE public.vehicle_jobs
  SET current_job_stage = 'WORKSHOP',
      updated_at = now()
  WHERE id = v_job.id;

  INSERT INTO public.vehicle_history (
    vehicle_id, job_id, changed_by, action,
    field_name, old_value, new_value, reason
  )
  VALUES
    (
      p_vehicle_id, v_job.id, v_user_id, 'VEHICLE_STAGE_CHANGED',
      'current_stage', 'FLOOR', 'WORKSHOP',
      'Floor work completed; vehicle advanced to WORKSHOP.'
    ),
    (
      p_vehicle_id, v_job.id, v_user_id, 'JOB_STAGE_CHANGED',
      'current_job_stage', 'FLOOR', 'WORKSHOP',
      'Floor work completed; job advanced to WORKSHOP.'
    );

  RETURN jsonb_build_object(
    'success', true,
    'current_stage', 'WORKSHOP',
    'current_job_stage', 'WORKSHOP',
    'vehicle_id', p_vehicle_id,
    'job_id', v_job.id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_floor_work(p_vehicle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_job public.vehicle_jobs%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_progress public.floor_work_progress%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND is_active = true;

  IF v_role IS DISTINCT FROM 'floor_incharge' THEN
    RAISE EXCEPTION 'Only an active Floor Incharge can mark floor work done.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.workshop_visits WHERE vehicle_id = p_vehicle_id AND closed_at IS NULL) THEN
    RAISE EXCEPTION 'Use the visit-based Floor workflow for this vehicle.';
  END IF;

  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found.';
  END IF;

  SELECT * INTO v_job
  FROM public.vehicle_jobs
  WHERE vehicle_id = p_vehicle_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.';
  END IF;

  IF v_job.floor_incharge_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'This vehicle is not assigned to you.';
  END IF;

  IF v_vehicle.current_stage <> 'FLOOR'
     OR v_job.current_job_stage <> 'FLOOR' THEN
    RAISE EXCEPTION 'Vehicle and job must both be at FLOOR.';
  END IF;

  SELECT * INTO v_progress
  FROM public.floor_work_progress
  WHERE job_id = v_job.id
  FOR UPDATE;

  IF NOT FOUND OR v_progress.status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Work must be started before it can be marked done.';
  END IF;

  UPDATE public.floor_work_progress
  SET status = 'DONE',
      completed_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  WHERE job_id = v_job.id;

  INSERT INTO public.vehicle_history (
    vehicle_id, job_id, changed_by, action,
    field_name, old_value, new_value, reason
  )
  VALUES (
    p_vehicle_id, v_job.id, v_user_id, 'FLOOR_WORK_COMPLETED',
    'floor_work_status', 'IN_PROGRESS', 'DONE',
    'Floor Incharge marked floor work as done.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'DONE',
    'vehicle_id', p_vehicle_id,
    'job_id', v_job.id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.start_floor_work(p_vehicle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_job public.vehicle_jobs%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_progress public.floor_work_progress%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND is_active = true;

  IF v_role IS DISTINCT FROM 'floor_incharge' THEN
    RAISE EXCEPTION 'Only an active Floor Incharge can start floor work.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.workshop_visits WHERE vehicle_id = p_vehicle_id AND closed_at IS NULL) THEN
    RAISE EXCEPTION 'Use the visit-based Floor workflow for this vehicle.';
  END IF;

  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found.';
  END IF;

  SELECT * INTO v_job
  FROM public.vehicle_jobs
  WHERE vehicle_id = p_vehicle_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.';
  END IF;

  IF v_job.floor_incharge_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'This vehicle is not assigned to you.';
  END IF;

  IF v_vehicle.current_stage <> 'FLOOR'
     OR v_job.current_job_stage <> 'FLOOR' THEN
    RAISE EXCEPTION 'Vehicle and job must both be at FLOOR.';
  END IF;

  SELECT * INTO v_progress
  FROM public.floor_work_progress
  WHERE job_id = v_job.id
  FOR UPDATE;

  IF FOUND AND v_progress.status <> 'NOT_STARTED' THEN
    RAISE EXCEPTION 'Floor work has already been started or completed.';
  END IF;

  INSERT INTO public.floor_work_progress (
    job_id, vehicle_id, status, started_at, updated_by, updated_at
  )
  VALUES (
    v_job.id, p_vehicle_id, 'IN_PROGRESS', now(), v_user_id, now()
  )
  ON CONFLICT (job_id) DO UPDATE
    SET status = 'IN_PROGRESS',
        started_at = now(),
        updated_by = v_user_id,
        updated_at = now()
    WHERE public.floor_work_progress.status = 'NOT_STARTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not start floor work.';
  END IF;

  INSERT INTO public.vehicle_history (
    vehicle_id, job_id, changed_by, action,
    field_name, old_value, new_value, reason
  )
  VALUES (
    p_vehicle_id, v_job.id, v_user_id, 'FLOOR_WORK_STARTED',
    'floor_work_status', 'NOT_STARTED', 'IN_PROGRESS',
    'Floor Incharge marked work as started.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'IN_PROGRESS',
    'vehicle_id', p_vehicle_id,
    'job_id', v_job.id
  );
END;
$function$
;

