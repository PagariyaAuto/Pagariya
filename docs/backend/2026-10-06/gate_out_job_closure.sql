-- Permanent visit-scoped Gate Out job closure.
CREATE OR REPLACE FUNCTION public.new_workflow_gate_out(p_visit_id uuid, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE
    v_user_id uuid;
    v_role text;

    v_visit public.workshop_visits%ROWTYPE;
    v_vehicle public.vehicles%ROWTYPE;

    v_now timestamptz := now();

    v_event_id uuid;
    v_gate_exit_id uuid;

    v_remarks text;
    v_job public.vehicle_jobs%ROWTYPE;
    v_job_id uuid;
    v_intake_job_ids uuid[];

BEGIN
    -- ========================================================
    -- CURRENT USER
    -- ========================================================

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;


    -- ========================================================
    -- ROLE CHECK
    -- ========================================================

    SELECT role
    INTO v_role
    FROM public.profiles
    WHERE id = v_user_id
      AND is_active = true;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Active user profile not found';
    END IF;

    IF v_role NOT IN ('watchman', 'ceo_admin') THEN
        RAISE EXCEPTION
            'Only Watchman or CEO Admin can perform Gate Out';
    END IF;


    -- ========================================================
    -- VALIDATE REMARKS
    -- ========================================================

    v_remarks :=
        NULLIF(TRIM(COALESCE(p_remarks, '')), '');


    -- ========================================================
    -- LOCK THE VISIT
    --
    -- This prevents two Watchmen from processing the same
    -- vehicle simultaneously.
    -- ========================================================

    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = p_visit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workshop visit not found';
    END IF;


    -- ========================================================
    -- VALIDATE CURRENT STAGE
    -- ========================================================

    IF v_visit.closed_at IS NOT NULL THEN
        RAISE EXCEPTION 'This workshop visit is already closed';
    END IF;

    IF v_visit.current_stage <> 'PENDING_GATE_OUT' THEN
        RAISE EXCEPTION
            'Vehicle is not pending Gate Out. Current stage: %',
            v_visit.current_stage;
    END IF;


    -- ========================================================
    -- VALIDATE CURRENT STATUS
    -- ========================================================

    IF v_visit.current_status NOT IN (
        'PENDING',
        'IN_PROGRESS'
    ) THEN
        RAISE EXCEPTION
            'Vehicle cannot be gated out in its current status: %',
            v_visit.current_status;
    END IF;


    -- ========================================================
    -- LOCK VEHICLE
    -- ========================================================

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_visit.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle not found';
    END IF;


    -- ========================================================
    -- PREVENT DUPLICATE GATE OUT
    -- ========================================================

    IF EXISTS (
        SELECT 1
        FROM public.gate_exits
        WHERE visit_id = v_visit.id
    ) THEN
        RAISE EXCEPTION
            'Gate Out has already been recorded for this visit';
    END IF;


    -- Resolve the exact visit job; never choose an arbitrary active vehicle job.
    SELECT h.job_id INTO v_job_id
    FROM public.advisor_billing_handoffs h WHERE h.visit_id = v_visit.id;

    SELECT array_agg(DISTINCT (e.metadata->>'job_id')::uuid)
    INTO v_intake_job_ids FROM public.workflow_events e
    WHERE e.visit_id = v_visit.id AND e.event_type = 'VEHICLE_INTAKE'
      AND e.metadata->>'job_id' IS NOT NULL;

    IF coalesce(cardinality(v_intake_job_ids), 0) > 1 THEN
        RAISE EXCEPTION 'Multiple jobs are linked to this visit. Contact CEO Admin.';
    END IF;
    IF v_job_id IS NOT NULL AND cardinality(v_intake_job_ids) = 1
       AND v_job_id <> v_intake_job_ids[1] THEN
        RAISE EXCEPTION 'Visit job linkage conflict. Contact CEO Admin.';
    END IF;
    v_job_id := coalesce(v_job_id, v_intake_job_ids[1]);
    IF v_job_id IS NULL AND EXISTS (
        SELECT 1 FROM public.vehicle_intake WHERE visit_id = v_visit.id
    ) THEN
        RAISE EXCEPTION 'The visit job link is missing. Contact CEO Admin.';
    END IF;
    IF v_job_id IS NOT NULL THEN
        SELECT * INTO v_job FROM public.vehicle_jobs WHERE id = v_job_id FOR UPDATE;
        IF NOT FOUND OR v_job.vehicle_id <> v_visit.vehicle_id THEN
            RAISE EXCEPTION 'Visit job linkage conflict. Contact CEO Admin.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.advisor_billing_handoffs h
            JOIN public.workshop_visits w ON w.id = h.visit_id
            WHERE h.job_id = v_job_id AND w.id <> v_visit.id
        ) OR EXISTS (
            SELECT 1 FROM public.workflow_events e
            WHERE e.visit_id <> v_visit.id AND e.event_type = 'VEHICLE_INTAKE'
              AND e.metadata->>'job_id' = v_job_id::text
        ) THEN
            RAISE EXCEPTION 'This job is linked to another visit. Contact CEO Admin.';
        END IF;
        UPDATE public.vehicle_jobs SET current_job_stage = 'CLOSED', updated_at = v_now
        WHERE id = v_job_id;
    END IF;

    -- Close any remaining assignment for this visit, including non-Billing exits.
    UPDATE public.vehicle_assignments SET unassigned_at = v_now
    WHERE visit_id = v_visit.id AND unassigned_at IS NULL;

    -- ========================================================
    -- CLOSE CURRENT STAGE HISTORY
    -- ========================================================

    UPDATE public.workflow_stage_history
    SET
        exited_at = v_now,
        exited_by = v_user_id,
        status = 'COMPLETED'
    WHERE visit_id = v_visit.id
      AND stage = 'PENDING_GATE_OUT'
      AND exited_at IS NULL;


    -- ========================================================
    -- CREATE GATE OUT EVENT
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
        v_visit.id,
        v_visit.vehicle_id,
        'GATE_OUT',
        'PENDING_GATE_OUT',
        'GATE_OUT',
        v_visit.current_status,
        'COMPLETED',
        v_user_id,
        v_now,
        v_remarks,
        jsonb_build_object(
            'vehicle_number',
            v_vehicle.vehicle_no,
            'visit_no',
            v_visit.visit_no,
            'job_id', v_job_id,
            'job_stage_before', v_job.current_job_stage,
            'job_stage_after', CASE WHEN v_job_id IS NOT NULL THEN 'CLOSED' END
        )
    )
    RETURNING id INTO v_event_id;


    -- ========================================================
    -- CREATE GATE EXIT RECORD
    -- ========================================================

    INSERT INTO public.gate_exits (
        visit_id,
        vehicle_id,
        vehicle_number,
        gate_out_at,
        recorded_by,
        gate_out_event_id,
        remarks,
        created_at
    )
    VALUES (
        v_visit.id,
        v_visit.vehicle_id,
        v_vehicle.vehicle_no,
        v_now,
        v_user_id,
        v_event_id,
        v_remarks,
        v_now
    )
    RETURNING id INTO v_gate_exit_id;


    -- ========================================================
    -- UPDATE WORKSHOP VISIT
    -- ========================================================

    UPDATE public.workshop_visits
    SET
        current_stage = 'GATE_OUT',
        current_status = 'COMPLETED',
        current_assigned_to = NULL,
        stage_started_at = v_now,
        closed_at = v_now,
        updated_at = v_now
    WHERE id = v_visit.id;


    -- ========================================================
    -- UPDATE VEHICLE
    -- ========================================================

    UPDATE public.vehicles
    SET
        current_stage = 'GATE_OUT',
        current_status = 'COMPLETED',
        current_assigned_to = NULL,
        stage_started_at = v_now,
        updated_at = v_now
    WHERE id = v_vehicle.id;


    -- ========================================================
    -- CREATE FINAL GATE OUT STAGE HISTORY
    -- ========================================================

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
        v_visit.vehicle_id,
        'GATE_OUT',
        v_now,
        v_now,
        v_user_id,
        v_user_id,
        'COMPLETED',
        v_remarks,
        v_now
    );


    -- ========================================================
    -- RETURN RESULT
    -- ========================================================

    RETURN jsonb_build_object(
        'success', true,
        'visit_id', v_visit.id,
        'vehicle_id', v_vehicle.id,
        'vehicle_number', v_vehicle.vehicle_no,
        'gate_exit_id', v_gate_exit_id,
        'gate_out_event_id', v_event_id,
        'stage', 'GATE_OUT',
        'status', 'COMPLETED',
        'gate_out_at', v_now,
        'job_id', v_job_id,
        'job_stage', CASE WHEN v_job_id IS NOT NULL THEN 'CLOSED' END
    );

END;
$function$;

REVOKE EXECUTE ON FUNCTION public.new_workflow_gate_out(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_gate_out(uuid,text) TO authenticated;

-- Repair only verified exited visits with one explicitly linked job.
-- Enrich the existing exit event with repair metadata; retain its original actor/time.
DO $repair$
DECLARE rec record; previous_stage text;
BEGIN
 FOR rec IN
  WITH links AS (
    SELECT visit_id,job_id FROM public.advisor_billing_handoffs
    UNION
    SELECT visit_id,(metadata->>'job_id')::uuid FROM public.workflow_events
    WHERE event_type='VEHICLE_INTAKE' AND metadata->>'job_id' IS NOT NULL
  ), unique_links AS (
    SELECT visit_id,(array_agg(job_id))[1] job_id FROM links
    GROUP BY visit_id HAVING count(DISTINCT job_id)=1
  )
  SELECT w.id visit_id,w.vehicle_id,l.job_id,x.gate_out_event_id
  FROM public.workshop_visits w JOIN public.gate_exits x ON x.visit_id=w.id AND x.vehicle_id=w.vehicle_id
  JOIN unique_links l ON l.visit_id=w.id
  JOIN public.vehicle_jobs j ON j.id=l.job_id AND j.vehicle_id=w.vehicle_id
  WHERE w.closed_at IS NOT NULL AND w.current_stage='GATE_OUT' AND w.current_status='COMPLETED'
    AND j.current_job_stage IS DISTINCT FROM 'CLOSED'
    AND NOT EXISTS (SELECT 1 FROM links other WHERE other.job_id=l.job_id AND other.visit_id<>w.id)
 LOOP
  SELECT current_job_stage INTO previous_stage FROM public.vehicle_jobs WHERE id=rec.job_id FOR UPDATE;
  UPDATE public.vehicle_jobs SET current_job_stage='CLOSED',updated_at=now() WHERE id=rec.job_id;
  UPDATE public.workflow_events SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
    'job_id',rec.job_id,'job_stage_after','CLOSED',
    'job_closure_repair',jsonb_build_object('previous_job_stage',previous_stage,'repaired_at',now(),'source','gate_out_job_closure_migration')
  ) WHERE id=rec.gate_out_event_id AND visit_id=rec.visit_id AND event_type='GATE_OUT';
 END LOOP;
END $repair$;

