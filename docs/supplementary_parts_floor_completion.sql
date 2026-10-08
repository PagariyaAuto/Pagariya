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
        INSERT INTO public.floor_work_items(floor_work_cycle_id,work_type_id,status,remarks,started_at,started_by,completed_at,completed_by)
        SELECT v_return_floor_cycle_id,work_type_id,
          CASE WHEN status='COMPLETED' THEN 'COMPLETED' ELSE 'PENDING' END,
          concat_ws(E'\n',remarks,'Carried from source Floor cycle after supplementary parts handover.'),
          CASE WHEN status='COMPLETED' THEN started_at ELSE NULL END,
          CASE WHEN status='COMPLETED' THEN started_by ELSE NULL END,
          CASE WHEN status='COMPLETED' THEN completed_at ELSE NULL END,
          CASE WHEN status='COMPLETED' THEN completed_by ELSE NULL END
        FROM public.floor_work_items WHERE floor_work_cycle_id=v_supplementary.source_floor_cycle_id;
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
$function$;

