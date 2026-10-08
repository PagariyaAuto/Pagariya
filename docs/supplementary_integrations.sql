-- Initial Supplementary deployment reference. Advisor Work and Store handover
-- are superseded by the full definitions in floor_entry_consistency.sql.
-- Do not replay this historical file over the later prevention definitions.
CREATE OR REPLACE FUNCTION public.new_workflow_process_approval(p_visit_id uuid, p_decision text, p_decision_at timestamp with time zone, p_remarks text DEFAULT NULL::text, p_hold_remark text DEFAULT NULL::text, p_photo_reference text DEFAULT NULL::text)
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
    v_job public.vehicle_jobs%rowtype;

    v_now timestamptz := now();

    v_decision text;
    v_remarks text;
    v_hold_remark text;
    v_photo_reference text;

    v_cycle_no integer;
    v_cycle_type text;
    v_cycle_id uuid;

    v_existing_cycle_id uuid;
    v_existing_cycle_no integer;
    v_existing_cycle_type text;
    v_existing_cycle_decision text;

    v_stage_before text;
    v_status_before text;

    v_stage_after text;
    v_status_after text;

    v_event_id uuid;

    v_photo_exists boolean := false;

BEGIN

    -- =========================================================
    -- 1. AUTHENTICATION
    -- =========================================================

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;


    -- =========================================================
    -- 2. ACTIVE USER PROFILE / ROLE
    -- =========================================================

    SELECT p.role
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id
      AND p.is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active user profile not found.';
    END IF;


    -- =========================================================
    -- 3. ROLE CHECK
    -- =========================================================

    IF lower(coalesce(v_role, '')) NOT IN (
        'advisor',
        'ceo_admin'
    ) THEN
        RAISE EXCEPTION
            'Only Advisors and CEO Admin users can process approvals.';
    END IF;


    -- =========================================================
    -- 4. NORMALIZE INPUT
    -- =========================================================

    v_decision :=
        upper(trim(coalesce(p_decision, '')));

    v_remarks :=
        nullif(trim(coalesce(p_remarks, '')), '');

    v_hold_remark :=
        nullif(trim(coalesce(p_hold_remark, '')), '');

    v_photo_reference :=
        nullif(trim(coalesce(p_photo_reference, '')), '');


    -- =========================================================
    -- 5. BASIC VALIDATION
    -- =========================================================

    IF p_visit_id IS NULL THEN
        RAISE EXCEPTION 'Visit ID is required.';
    END IF;

    IF v_decision NOT IN (
        'APPROVED',
        'APPROVAL_HOLD',
        'CLAIM_REJECTED',
        'TOTAL_LOSS'
    ) THEN
        RAISE EXCEPTION
            'Invalid approval decision. Allowed values: APPROVED, APPROVAL_HOLD, CLAIM_REJECTED, TOTAL_LOSS.';
    END IF;

    IF p_decision_at IS NULL THEN
        RAISE EXCEPTION 'Decision Date & Time is required.';
    END IF;


    -- =========================================================
    -- 6. DECISION-SPECIFIC VALIDATION
    -- =========================================================

    IF v_decision = 'APPROVED' THEN

        IF v_photo_reference IS NULL THEN
            RAISE EXCEPTION
                'Assessment sheet photo is required when approval is received.';
        END IF;

    ELSIF v_decision = 'APPROVAL_HOLD' THEN

        IF v_hold_remark IS NULL THEN
            RAISE EXCEPTION
                'Approval Hold remark is required.';
        END IF;

        IF v_photo_reference IS NULL THEN
            RAISE EXCEPTION
                'Assignment sheet photo is required for Approval Hold.';
        END IF;

    END IF;


    -- =========================================================
    -- 7. LOCK WORKSHOP VISIT
    -- =========================================================

    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = p_visit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workshop visit not found.';
    END IF;


    -- =========================================================
    -- 8. LOAD VEHICLE
    -- =========================================================

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_visit.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Vehicle associated with this visit was not found.';
    END IF;


    -- =========================================================
    -- 9. CURRENT STAGE CHECK
    -- =========================================================

    IF EXISTS (SELECT 1 FROM public.supplementary_cycles WHERE visit_id=p_visit_id AND status IN ('SURVEY','APPROVAL','APPROVAL_HOLD','APPROVED','CLAIM_REJECTED')) THEN
        RAISE EXCEPTION 'Use the Supplementary workflow for this approval.';
    END IF;

    IF v_visit.current_stage <> 'PENDING_APPROVAL' THEN
        RAISE EXCEPTION
            'This vehicle is not currently in Pending Approval. Current stage: %.',
            v_visit.current_stage;
    END IF;


    -- =========================================================
    -- 10. CURRENT STATUS CHECK
    -- =========================================================

    IF v_visit.current_status NOT IN (
        'PENDING',
        'IN_PROGRESS'
    ) THEN
        RAISE EXCEPTION
            'This vehicle cannot be processed because its current status is %.',
            v_visit.current_status;
    END IF;


    -- =========================================================
    -- 11. ADVISOR OWNERSHIP
    -- =========================================================

    IF lower(v_role) = 'advisor' THEN

        IF v_visit.current_assigned_to IS NULL THEN
            RAISE EXCEPTION
                'This vehicle is not assigned to an Advisor.';
        END IF;

        IF v_visit.current_assigned_to <> v_user_id THEN
            RAISE EXCEPTION
                'You are not the assigned Advisor for this vehicle.';
        END IF;

    END IF;


    -- =========================================================
    -- 12. LOAD EXISTING ACTIVE VEHICLE JOB
    --
    -- The job was created during Vehicle Intake.
    -- Approval must update that same job.
    -- We NEVER create another job here.
    -- =========================================================

    SELECT *
    INTO v_job
    FROM public.vehicle_jobs
    WHERE vehicle_id = v_vehicle.id
      AND current_job_stage <> 'CLOSED'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Active vehicle job not found for this vehicle.';
    END IF;


    -- =========================================================
    -- 13. VERIFY APPROVAL PHOTO
    -- =========================================================

    IF v_photo_reference IS NOT NULL THEN

        SELECT EXISTS (
            SELECT 1
            FROM public.vehicle_photos vp
            WHERE vp.vehicle_id = v_vehicle.id
              AND vp.storage_path = v_photo_reference
        )
        INTO v_photo_exists;

        IF NOT v_photo_exists THEN
            RAISE EXCEPTION
                'The supplied approval photo was not found for this vehicle.';
        END IF;

    END IF;


    -- =========================================================
    -- 14. CAPTURE CURRENT STATE
    -- =========================================================

    v_stage_before :=
        v_visit.current_stage;

    v_status_before :=
        v_visit.current_status;


    -- =========================================================
    -- 15. FIND EXISTING PENDING APPROVAL CYCLE
    --
    -- Vehicle Survey creates the approval cycle first:
    --
    --   INITIAL / PENDING
    --
    -- Approval must complete that cycle instead of
    -- creating another cycle.
    --
    -- The same rule also supports future supplementary
    -- cycles where Supplementary creates:
    --
    --   SUPPLEMENTARY / PENDING
    --
    -- and Approval completes that existing cycle.
    -- =========================================================

    SELECT
        ac.id,
        ac.cycle_no,
        ac.cycle_type,
        ac.decision
    INTO
        v_existing_cycle_id,
        v_existing_cycle_no,
        v_existing_cycle_type,
        v_existing_cycle_decision
    FROM public.approval_cycles ac
    WHERE ac.visit_id = v_visit.id
      AND upper(coalesce(ac.decision, '')) = 'PENDING'
    ORDER BY ac.cycle_no DESC, ac.created_at DESC
    LIMIT 1
    FOR UPDATE;


    -- =========================================================
    -- 16. DETERMINE APPROVAL CYCLE
    -- =========================================================

    IF v_existing_cycle_id IS NOT NULL THEN

        -- Complete the already-created pending cycle.
        v_cycle_id := v_existing_cycle_id;
        v_cycle_no := v_existing_cycle_no;
        v_cycle_type := v_existing_cycle_type;

    ELSE

        -- No pending cycle exists.
        -- Create a new cycle only when genuinely required.
        SELECT
            coalesce(max(ac.cycle_no), 0) + 1
        INTO
            v_cycle_no
        FROM public.approval_cycles ac
        WHERE ac.visit_id = v_visit.id;

        IF v_cycle_no = 1 THEN
            v_cycle_type := 'INITIAL';
        ELSE
            v_cycle_type := 'SUPPLEMENTARY';
        END IF;

    END IF;


    -- =========================================================
    -- 17. NEXT WORKFLOW STAGE
    -- =========================================================

    IF v_decision = 'APPROVED' THEN

        v_stage_after := 'ADVISOR_WORK';
        v_status_after := 'PENDING';

    ELSIF v_decision = 'APPROVAL_HOLD' THEN

        v_stage_after := 'APPROVAL_HOLD';
        v_status_after := 'ON_HOLD';

    ELSIF v_decision = 'CLAIM_REJECTED' THEN

        v_stage_after := 'CLAIM_REJECTED';
        v_status_after := 'REJECTED';

    ELSIF v_decision = 'TOTAL_LOSS' THEN

        v_stage_after := 'PENDING_GATE_OUT';
        v_status_after := 'PENDING';

    END IF;


    -- =========================================================
    -- 18. CLOSE PENDING APPROVAL HISTORY
    -- =========================================================

    UPDATE public.workflow_stage_history
    SET
        exited_at = v_now,
        exited_by = v_user_id,
        status = 'COMPLETED'
    WHERE visit_id = v_visit.id
      AND stage = 'PENDING_APPROVAL'
      AND status = 'OPEN';


    -- =========================================================
    -- 19. UPDATE EXISTING CYCLE OR CREATE NEW CYCLE
    -- =========================================================

    IF v_existing_cycle_id IS NOT NULL THEN

        -- -----------------------------------------------------
        -- Existing PENDING cycle:
        -- update it instead of inserting a second cycle.
        -- -----------------------------------------------------

        UPDATE public.approval_cycles
        SET
            decision = v_decision,

            approval_received_at =
                CASE
                    WHEN v_decision = 'APPROVED'
                    THEN p_decision_at
                    ELSE NULL
                END,

            approval_hold_at =
                CASE
                    WHEN v_decision = 'APPROVAL_HOLD'
                    THEN p_decision_at
                    ELSE approval_hold_at
                END,

            approval_hold_remark =
                CASE
                    WHEN v_decision = 'APPROVAL_HOLD'
                    THEN v_hold_remark
                    ELSE approval_hold_remark
                END,

            claim_rejected_at =
                CASE
                    WHEN v_decision = 'CLAIM_REJECTED'
                    THEN p_decision_at
                    ELSE NULL
                END,

            total_loss_at =
                CASE
                    WHEN v_decision = 'TOTAL_LOSS'
                    THEN p_decision_at
                    ELSE NULL
                END,

            decided_by = v_user_id,
            remarks = v_remarks

        WHERE id = v_existing_cycle_id;

    ELSE

        -- -----------------------------------------------------
        -- No pending cycle:
        -- create a genuinely new approval cycle.
        -- -----------------------------------------------------

        INSERT INTO public.approval_cycles (
            visit_id,
            vehicle_id,
            cycle_no,
            cycle_type,
            decision,
            approval_received_at,
            approval_hold_at,
            approval_hold_remark,
            claim_rejected_at,
            total_loss_at,
            decided_by,
            remarks
        )
        VALUES (
            v_visit.id,
            v_vehicle.id,
            v_cycle_no,
            v_cycle_type,
            v_decision,

            CASE
                WHEN v_decision = 'APPROVED'
                THEN p_decision_at
                ELSE NULL
            END,

            CASE
                WHEN v_decision = 'APPROVAL_HOLD'
                THEN p_decision_at
                ELSE NULL
            END,

            CASE
                WHEN v_decision = 'APPROVAL_HOLD'
                THEN v_hold_remark
                ELSE NULL
            END,

            CASE
                WHEN v_decision = 'CLAIM_REJECTED'
                THEN p_decision_at
                ELSE NULL
            END,

            CASE
                WHEN v_decision = 'TOTAL_LOSS'
                THEN p_decision_at
                ELSE NULL
            END,

            v_user_id,
            v_remarks
        )
        RETURNING id
        INTO v_cycle_id;

    END IF;


    -- =========================================================
    -- 20. SYNCHRONIZE VEHICLE JOB
    -- =========================================================

    IF v_decision = 'APPROVED' THEN

        UPDATE public.vehicle_jobs
        SET
            approval_status = 'APPROVED',
            approval_at = p_decision_at,
            approval_remarks = v_remarks,
            updated_at = v_now
        WHERE id = v_job.id;

    ELSIF v_decision = 'APPROVAL_HOLD' THEN

        UPDATE public.vehicle_jobs
        SET
            approval_status = 'PENDING',
            updated_at = v_now
        WHERE id = v_job.id;

    ELSIF v_decision = 'CLAIM_REJECTED' THEN

        UPDATE public.vehicle_jobs
        SET
            approval_status = 'REJECTED',
            approval_at = p_decision_at,
            approval_remarks = v_remarks,
            partial_approval_choice = NULL,
            updated_at = v_now
        WHERE id = v_job.id;

    ELSIF v_decision = 'TOTAL_LOSS' THEN

        UPDATE public.vehicle_jobs
        SET
            approval_at = p_decision_at,
            approval_remarks = v_remarks,
            current_job_stage = 'PENDING_GATE_OUT',
            updated_at = v_now
        WHERE id = v_job.id;

    END IF;


    -- =========================================================
    -- 21. LINK APPROVAL PHOTO TO THE EXISTING JOB
    -- =========================================================

    IF v_photo_reference IS NOT NULL THEN

        UPDATE public.vehicle_photos
        SET
            job_id = v_job.id
        WHERE vehicle_id = v_vehicle.id
          AND storage_path = v_photo_reference
          AND job_id IS NULL;

    END IF;


    -- =========================================================
    -- 22. WORKFLOW EVENT
    -- =========================================================

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
        v_vehicle.id,

        CASE
            WHEN v_decision = 'APPROVED'
                THEN 'APPROVAL_RECEIVED'
            WHEN v_decision = 'APPROVAL_HOLD'
                THEN 'APPROVAL_HOLD'
            WHEN v_decision = 'CLAIM_REJECTED'
                THEN 'CLAIM_REJECTED'
            WHEN v_decision = 'TOTAL_LOSS'
                THEN 'TOTAL_LOSS'
        END,

        v_stage_before,
        v_stage_after,
        v_status_before,
        v_status_after,
        v_user_id,
        v_now,
        v_remarks,

        jsonb_build_object(
            'approval_cycle_id', v_cycle_id,
            'vehicle_job_id', v_job.id,
            'cycle_no', v_cycle_no,
            'cycle_type', v_cycle_type,
            'decision', v_decision,
            'decision_at', p_decision_at,
            'hold_remark', v_hold_remark,
            'photo_reference', v_photo_reference
        )
    )
    RETURNING id
    INTO v_event_id;


    -- =========================================================
    -- 23. NEXT STAGE HISTORY
    -- =========================================================

    IF v_decision = 'TOTAL_LOSS' THEN

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
            v_visit.id,
            v_vehicle.id,
            'TOTAL_LOSS',
            v_now,
            v_user_id,
            'COMPLETED',
            v_remarks
        );

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
            v_visit.id,
            v_vehicle.id,
            'PENDING_GATE_OUT',
            v_now,
            v_user_id,
            'OPEN',
            'Vehicle moved to Pending Gate Out after Total Loss.'
        );

    ELSE

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
            v_visit.id,
            v_vehicle.id,
            v_stage_after,
            v_now,
            v_user_id,
            'OPEN',
            CASE
                WHEN v_decision = 'APPROVAL_HOLD'
                THEN v_hold_remark
                ELSE v_remarks
            END
        );

    END IF;


    -- =========================================================
    -- 24. UPDATE WORKSHOP VISIT
    -- =========================================================

    UPDATE public.workshop_visits
    SET
        current_stage = v_stage_after,
        current_status = v_status_after,
        stage_started_at = v_now,

        current_assigned_to =
            CASE
                WHEN v_decision = 'TOTAL_LOSS'
                THEN NULL
                ELSE v_visit.current_assigned_to
            END

    WHERE id = v_visit.id;


    -- =========================================================
    -- 25. UPDATE VEHICLE
    -- =========================================================

    UPDATE public.vehicles
    SET
        current_stage = v_stage_after,
        current_status = v_status_after,
        stage_started_at = v_now,

        current_assigned_to =
            CASE
                WHEN v_decision = 'TOTAL_LOSS'
                THEN NULL
                ELSE v_vehicle.current_assigned_to
            END

    WHERE id = v_vehicle.id;


    -- =========================================================
    -- 26. RETURN
    -- =========================================================

    RETURN jsonb_build_object(
        'success', true,
        'visit_id', v_visit.id,
        'vehicle_id', v_vehicle.id,
        'vehicle_job_id', v_job.id,
        'approval_cycle_id', v_cycle_id,
        'cycle_no', v_cycle_no,
        'cycle_type', v_cycle_type,
        'decision', v_decision,
        'decision_at', p_decision_at,
        'recorded_at', v_now,
        'stage_before', v_stage_before,
        'stage_after', v_stage_after,
        'status_before', v_status_before,
        'status_after', v_status_after,
        'workflow_event_id', v_event_id,
        'photo_reference', v_photo_reference
    );

END;
$function$
;
CREATE OR REPLACE FUNCTION public.new_workflow_resolve_approval_hold(p_visit_id uuid, p_remarks text DEFAULT NULL::text)
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

    v_now timestamptz := now();

    v_remarks text;

    v_stage_before text;
    v_status_before text;

    v_stage_after text := 'PENDING_APPROVAL';
    v_status_after text := 'PENDING';

    v_event_id uuid;
    v_stage_history_id uuid;

    v_hold_cycle_id uuid;
    v_hold_cycle_no integer;

BEGIN
    -- ---------------------------------------------------------
    -- AUTHENTICATION
    -- ---------------------------------------------------------
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;


    -- ---------------------------------------------------------
    -- ACTIVE USER / ROLE
    -- ---------------------------------------------------------
    SELECT p.role
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id
      AND p.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active user profile not found.';
    END IF;


    -- ---------------------------------------------------------
    -- ROLE CHECK
    -- ---------------------------------------------------------
    IF lower(coalesce(v_role, '')) NOT IN ('advisor', 'ceo_admin') THEN
        RAISE EXCEPTION
            'Only Advisors and CEO Admin users can resolve Approval Hold.';
    END IF;


    -- ---------------------------------------------------------
    -- INPUT VALIDATION
    -- ---------------------------------------------------------
    IF p_visit_id IS NULL THEN
        RAISE EXCEPTION 'Visit ID is required.';
    END IF;

    v_remarks := nullif(trim(coalesce(p_remarks, '')), '');


    -- ---------------------------------------------------------
    -- LOCK WORKSHOP VISIT
    -- ---------------------------------------------------------
    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = p_visit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workshop visit not found.';
    END IF;


    -- ---------------------------------------------------------
    -- LOCK VEHICLE
    -- ---------------------------------------------------------
    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_visit.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Vehicle associated with this visit was not found.';
    END IF;


    -- ---------------------------------------------------------
    -- CURRENT STAGE VALIDATION
    -- ---------------------------------------------------------
    IF v_visit.current_stage <> 'APPROVAL_HOLD' THEN
        RAISE EXCEPTION
            'This vehicle is not currently on Approval Hold. Current stage: %.',
            v_visit.current_stage;
    END IF;


    -- ---------------------------------------------------------
    -- CURRENT STATUS VALIDATION
    -- ---------------------------------------------------------
    IF v_visit.current_status <> 'ON_HOLD' THEN
        RAISE EXCEPTION
            'This vehicle is not currently ON_HOLD. Current status: %.',
            v_visit.current_status;
    END IF;


    -- ---------------------------------------------------------
    -- ADVISOR OWNERSHIP CHECK
    -- CEO ADMIN CAN ACCESS ANY VEHICLE
    -- ---------------------------------------------------------
    IF lower(v_role) = 'advisor' THEN

        IF v_visit.current_assigned_to IS NULL THEN
            RAISE EXCEPTION
                'This vehicle is not assigned to an Advisor.';
        END IF;

        IF v_visit.current_assigned_to <> v_user_id THEN
            RAISE EXCEPTION
                'You are not the Advisor assigned to this vehicle.';
        END IF;

    END IF;


    -- ---------------------------------------------------------
    -- CAPTURE CURRENT STATE
    -- ---------------------------------------------------------
    v_stage_before := v_visit.current_stage;
    v_status_before := v_visit.current_status;


    -- ---------------------------------------------------------
    -- FIND AND LOCK LATEST APPROVAL HOLD CYCLE
    -- ---------------------------------------------------------
    SELECT
        ac.id,
        ac.cycle_no
    INTO
        v_hold_cycle_id,
        v_hold_cycle_no
    FROM public.approval_cycles ac
    WHERE ac.visit_id = v_visit.id
      AND upper(coalesce(ac.decision, '')) = 'APPROVAL_HOLD'
      AND ac.approval_hold_at IS NOT NULL
    ORDER BY ac.cycle_no DESC
    LIMIT 1
    FOR UPDATE;

    IF v_hold_cycle_id IS NULL THEN
        RAISE EXCEPTION
            'Approval Hold record was not found for this vehicle.';
    END IF;


    -- ---------------------------------------------------------
    -- IMPORTANT:
    -- RESOLVE THE HOLD INSIDE THE SAME APPROVAL CYCLE
    --
    -- APPROVAL_HOLD -> PENDING
    --
    -- We deliberately preserve:
    --   cycle_no
    --   cycle_type
    --   approval_hold_at
    --   approval_hold_remark
    --
    -- This allows the existing Approval RPC to reuse this
    -- cycle instead of creating a new SUPPLEMENTARY cycle.
    -- ---------------------------------------------------------
    UPDATE public.approval_cycles
    SET
        decision = 'PENDING'
    WHERE id = v_hold_cycle_id;
    UPDATE public.supplementary_cycles SET status='APPROVAL' WHERE visit_id=p_visit_id AND approval_cycle_id=v_hold_cycle_id AND status='APPROVAL_HOLD';



    -- ---------------------------------------------------------
    -- CLOSE APPROVAL HOLD STAGE HISTORY
    -- ---------------------------------------------------------
    UPDATE public.workflow_stage_history
    SET
        exited_at = v_now,
        exited_by = v_user_id,
        status = 'COMPLETED'
    WHERE visit_id = v_visit.id
      AND stage = 'APPROVAL_HOLD'
      AND status = 'OPEN';


    -- ---------------------------------------------------------
    -- CREATE AUDIT EVENT
    -- ---------------------------------------------------------
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
        v_vehicle.id,
        'APPROVAL_HOLD_RESOLVED',
        v_stage_before,
        v_stage_after,
        v_status_before,
        v_status_after,
        v_user_id,
        v_now,
        v_remarks,
        jsonb_build_object(
            'approval_cycle_id', v_hold_cycle_id,
            'cycle_no', v_hold_cycle_no,
            'resolved_at', v_now,
            'resolved_by', v_user_id
        )
    )
    RETURNING id INTO v_event_id;


    -- ---------------------------------------------------------
    -- OPEN PENDING APPROVAL HISTORY
    -- ---------------------------------------------------------
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
        v_visit.id,
        v_vehicle.id,
        v_stage_after,
        v_now,
        v_user_id,
        'OPEN',
        COALESCE(
            v_remarks,
            'Approval Hold resolved. Vehicle returned to Pending Approval.'
        )
    )
    RETURNING id INTO v_stage_history_id;


    -- ---------------------------------------------------------
    -- UPDATE WORKSHOP VISIT
    -- ---------------------------------------------------------
    UPDATE public.workshop_visits
    SET
        current_stage = v_stage_after,
        current_status = v_status_after,
        stage_started_at = v_now,
        current_assigned_to = v_visit.current_assigned_to,
        updated_at = v_now
    WHERE id = v_visit.id;


    -- ---------------------------------------------------------
    -- UPDATE VEHICLE
    -- ---------------------------------------------------------
    UPDATE public.vehicles
    SET
        current_stage = v_stage_after,
        current_status = v_status_after,
        stage_started_at = v_now,
        current_assigned_to = v_vehicle.current_assigned_to,
        updated_at = v_now
    WHERE id = v_vehicle.id;


    -- ---------------------------------------------------------
    -- RETURN RESULT
    -- ---------------------------------------------------------
    RETURN jsonb_build_object(
        'success', true,
        'visit_id', v_visit.id,
        'vehicle_id', v_vehicle.id,
        'approval_cycle_id', v_hold_cycle_id,
        'cycle_no', v_hold_cycle_no,
        'resolved_by', v_user_id,
        'resolved_at', v_now,
        'stage_before', v_stage_before,
        'stage_after', v_stage_after,
        'status_before', v_status_before,
        'status_after', v_status_after,
        'workflow_event_id', v_event_id,
        'stage_history_id', v_stage_history_id,
        'remarks', v_remarks
    );

END;
$function$
;
CREATE OR REPLACE FUNCTION public.new_workflow_process_advisor_work(p_visit_id uuid, p_work_path text, p_requisition_no text DEFAULT NULL::text, p_requisition_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_remarks text DEFAULT NULL::text)
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
    v_job public.vehicle_jobs%rowtype;

    v_advisor_work_id uuid;
    v_part_requisition_id uuid;
    v_event_id uuid;

    v_now timestamptz := now();

    v_work_path text;
    v_requisition_no text;
    v_remarks text;

    v_parts_required boolean := false;
    v_denting_required boolean := false;
    v_painting_required boolean := false;

    v_next_stage text;
    v_next_status text := 'PENDING';

    v_from_stage text;
    v_from_status text;

    v_stage_history_id uuid;

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

    IF v_role NOT IN ('advisor', 'ceo_admin') THEN
        RAISE EXCEPTION
            'Only Advisors or CEO Admin can process Advisor Work.';
    END IF;


    -- ========================================================
    -- 3. Validate visit ID
    -- ========================================================

    IF p_visit_id IS NULL THEN
        RAISE EXCEPTION 'Visit ID is required.';
    END IF;


    -- ========================================================
    -- 4. Normalize inputs
    -- ========================================================

    v_work_path :=
        upper(trim(coalesce(p_work_path, '')));

    v_requisition_no :=
        nullif(trim(coalesce(p_requisition_no, '')), '');

    v_remarks :=
        nullif(trim(coalesce(p_remarks, '')), '');


    -- ========================================================
    -- 5. Validate work path
    -- ========================================================

    IF v_work_path NOT IN (
        'ONLY_PARTS',
        'DENTING_PAINTING_PARTS',
        'ONLY_DENTING_PAINTING'
    ) THEN

        RAISE EXCEPTION
            'Invalid work path. Allowed values are ONLY_PARTS, DENTING_PAINTING_PARTS, ONLY_DENTING_PAINTING.';

    END IF;


    -- ========================================================
    -- 6. Determine work requirements
    -- ========================================================

    CASE v_work_path

        WHEN 'ONLY_PARTS' THEN

            v_parts_required := true;
            v_denting_required := false;
            v_painting_required := false;

            v_next_stage := 'STORE';


        WHEN 'DENTING_PAINTING_PARTS' THEN

            v_parts_required := true;
            v_denting_required := true;
            v_painting_required := true;

            -- Canonical stage is STORE.
            -- Floor will follow after the parts workflow.

            v_next_stage := 'STORE';


        WHEN 'ONLY_DENTING_PAINTING' THEN

            v_parts_required := false;
            v_denting_required := true;
            v_painting_required := true;

            v_next_stage := 'FLOOR';

    END CASE;


    -- ========================================================
    -- 7. Lock visit
    -- ========================================================

    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = p_visit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workshop visit not found.';
    END IF;


    -- ========================================================
    -- 8. Validate current workflow stage
    -- ========================================================

    IF v_visit.current_stage <> 'ADVISOR_WORK' THEN

        RAISE EXCEPTION
            'Vehicle is not currently in Advisor Work. Current stage: %',
            v_visit.current_stage;

    END IF;


    IF v_visit.current_status NOT IN (
        'PENDING',
        'IN_PROGRESS'
    ) THEN

        RAISE EXCEPTION
            'Vehicle cannot be processed from its current status: %',
            v_visit.current_status;

    END IF;


    -- ========================================================
    -- 9. Authorization by assignment
    --
    -- Advisor:
    -- must be the assigned advisor.
    --
    -- CEO Admin:
    -- may process any vehicle.
    -- ========================================================

    IF v_role = 'advisor' THEN

        IF v_visit.current_assigned_to IS NULL THEN
            RAISE EXCEPTION
                'This vehicle is not assigned to an Advisor.';
        END IF;

        IF v_visit.current_assigned_to <> v_user_id THEN
            RAISE EXCEPTION
                'You are not the Advisor assigned to this vehicle.';
        END IF;

    END IF;


    -- ========================================================
    -- 10. Lock vehicle
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
    -- 11. Prevent duplicate Advisor Work
    -- ========================================================

    SELECT * INTO v_job FROM public.vehicle_jobs WHERE vehicle_id=v_visit.vehicle_id AND current_job_stage<>'CLOSED' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active vehicle job not found for this vehicle.'; END IF;
    IF EXISTS (SELECT 1 FROM public.supplementary_cycles WHERE visit_id=p_visit_id AND status='APPROVED') THEN RAISE EXCEPTION 'Use Supplementary Advisor Work for this requirement.'; END IF;

    IF EXISTS (
        SELECT 1
        FROM public.advisor_work aw
        WHERE aw.visit_id = p_visit_id
    ) THEN

        RAISE EXCEPTION
            'Advisor Work has already been recorded for this vehicle.';

    END IF;


    -- ========================================================
    -- 12. Requisition validation
    --
    -- Parts paths require:
    --   Requisition No.
    --   Requisition Date & Time
    --
    -- Denting/Painting only does not require requisition.
    -- ========================================================

    IF v_parts_required THEN

        IF v_requisition_no IS NULL THEN
            RAISE EXCEPTION
                'Requisition No. is required for this work path.';
        END IF;

        IF p_requisition_at IS NULL THEN
            RAISE EXCEPTION
                'Requisition Date & Time is required for this work path.';
        END IF;

    ELSE

        v_requisition_no := NULL;

    END IF;


    -- ========================================================
    -- 13. Close current ADVISOR_WORK stage history
    -- ========================================================

    UPDATE public.workflow_stage_history
    SET
        exited_at = v_now,
        exited_by = v_user_id,
        status = 'COMPLETED'
    WHERE visit_id = p_visit_id
      AND stage = 'ADVISOR_WORK'
      AND status = 'OPEN';


    -- ========================================================
    -- 14. Insert Advisor Work
    -- ========================================================

    INSERT INTO public.advisor_work (
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
    VALUES (
        p_visit_id,
        v_vehicle.id,
        v_work_path,
        v_parts_required,
        v_denting_required,
        v_painting_required,
        v_requisition_no,
        CASE
            WHEN v_parts_required
                THEN p_requisition_at
            ELSE NULL
        END,
        v_user_id,
        v_remarks,
        v_now,
        v_now
    )
    RETURNING id
    INTO v_advisor_work_id;


    -- ========================================================
    -- 15. Create Parts Requisition when required
    -- ========================================================

    IF v_parts_required THEN

        INSERT INTO public.part_requisitions (
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
        VALUES (
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
        RETURNING id
        INTO v_part_requisition_id;

    END IF;


    -- ========================================================
    -- 16. Create workflow event
    -- ========================================================

    v_from_stage := v_visit.current_stage;
    v_from_status := v_visit.current_status;

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
        'ADVISOR_WORK_COMPLETED',
        v_from_stage,
        v_next_stage,
        v_from_status,
        v_next_status,
        v_user_id,
        v_now,
        v_remarks,
        jsonb_build_object(
            'advisor_work_id', v_advisor_work_id,
            'part_requisition_id', v_part_requisition_id,
            'work_path', v_work_path,
            'parts_required', v_parts_required,
            'denting_required', v_denting_required,
            'painting_required', v_painting_required,
            'requisition_no', v_requisition_no,
            'requisition_at', p_requisition_at
        ),
        v_now
    )
    RETURNING id
    INTO v_event_id;


    -- ========================================================
    -- 17. Create ONE next-stage history record
    --
    -- IMPORTANT:
    -- We intentionally create only ONE OPEN stage because
    -- ux_stage_history_one_open_stage allows only one OPEN
    -- stage per visit.
    -- ========================================================

    INSERT INTO public.workflow_stage_history (
        visit_id,
        vehicle_id,
        stage,
        entered_at,
        entered_by,
        status,
        remarks,
        created_at
    )
    VALUES (
        p_visit_id,
        v_vehicle.id,
        v_next_stage,
        v_now,
        v_user_id,
        'OPEN',
        v_remarks,
        v_now
    )
    RETURNING id
    INTO v_stage_history_id;


    -- ========================================================
    -- 18. Update workshop visit
    -- ========================================================

    UPDATE public.workshop_visits
    SET
        current_stage = v_next_stage,
        current_status = v_next_status,
        stage_started_at = v_now
    WHERE id = p_visit_id;


    -- ========================================================
    -- 19. Update vehicle
    -- ========================================================

    UPDATE public.vehicles
    SET
        current_stage = v_next_stage,
        current_status = v_next_status,
        stage_started_at = v_now
    WHERE id = v_vehicle.id;


    -- ========================================================
    -- 20. Return result
    -- ========================================================

    UPDATE public.vehicle_jobs SET current_job_stage=v_next_stage,updated_at=v_now WHERE id=v_job.id;

    RETURN jsonb_build_object(
        'success', true,

        'visit_id', p_visit_id,
        'vehicle_id', v_vehicle.id,

        'advisor_work_id', v_advisor_work_id,
        'part_requisition_id', v_part_requisition_id,

        'work_path', v_work_path,

        'parts_required', v_parts_required,
        'denting_required', v_denting_required,
        'painting_required', v_painting_required,

        'requisition_no', v_requisition_no,
        'requisition_at', p_requisition_at,

        'from_stage', v_from_stage,
        'from_status', v_from_status,

        'stage', v_next_stage,
        'status', v_next_status,

        'workflow_event_id', v_event_id,
        'stage_history_id', v_stage_history_id,

        'processed_at', v_now
    );


EXCEPTION
    WHEN OTHERS THEN
        RAISE;

END;
$function$
;
CREATE OR REPLACE FUNCTION public.new_workflow_hand_over_parts_to_floor(p_part_order_id uuid, p_floor_incharge_id uuid, p_handed_over_at timestamp with time zone, p_remarks text DEFAULT NULL::text)
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

