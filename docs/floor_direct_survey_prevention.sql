CREATE OR REPLACE FUNCTION public.new_workflow_complete_survey(p_visit_id uuid, p_paid_amount numeric DEFAULT NULL::numeric, p_receipt_reference_no text DEFAULT NULL::text, p_remarks text DEFAULT NULL::text, p_survey_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_approval_status text DEFAULT 'PENDING'::text, p_approval_received_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_assessment_sheet_photo_path text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();

    v_profile public.profiles%ROWTYPE;
    v_visit public.workshop_visits%ROWTYPE;
    v_vehicle public.vehicles%ROWTYPE;
    v_intake public.vehicle_intake%ROWTYPE;
    v_job public.vehicle_jobs%ROWTYPE;

    v_survey_no integer;
    v_cycle_no integer;

    v_stage_after text;
    v_status_after text;

    v_survey_id uuid;
    v_approval_cycle_id uuid;

    v_open_stage_id uuid;

    v_clean_remarks text :=
        nullif(trim(coalesce(p_remarks, '')), '');

    v_clean_receipt text :=
        nullif(trim(coalesce(p_receipt_reference_no, '')), '');

    v_clean_photo_path text :=
        nullif(trim(coalesce(p_assessment_sheet_photo_path, '')), '');

    v_survey_completed_at timestamptz :=
        coalesce(p_survey_completed_at, v_now);

    v_approval_received_at timestamptz :=
        p_approval_received_at;

BEGIN

    ----------------------------------------------------------------
    -- AUTHENTICATION
    ----------------------------------------------------------------

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be logged in.';
    END IF;


    ----------------------------------------------------------------
    -- ACTIVE PROFILE + ROLE
    ----------------------------------------------------------------

    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id
      AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Your active profile could not be found.';
    END IF;

    IF lower(coalesce(v_profile.role, '')) <> 'advisor' THEN
        RAISE EXCEPTION
            'Only active Advisors can complete surveys.';
    END IF;


    ----------------------------------------------------------------
    -- LOCK VISIT
    ----------------------------------------------------------------

    SELECT *
    INTO v_visit
    FROM public.workshop_visits
    WHERE id = p_visit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workshop visit not found.';
    END IF;


    ----------------------------------------------------------------
    -- LOCK VEHICLE
    ----------------------------------------------------------------

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE id = v_visit.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle not found.';
    END IF;


    ----------------------------------------------------------------
    -- CORRECT STAGE
    ----------------------------------------------------------------

    IF v_visit.current_stage <> 'PENDING_SURVEY' THEN
        RAISE EXCEPTION
            'This vehicle is not currently in Pending Survey. Current stage: %',
            v_visit.current_stage;
    END IF;

    IF v_visit.current_status NOT IN ('PENDING', 'IN_PROGRESS') THEN
        RAISE EXCEPTION
            'This survey cannot be completed because the visit status is %.',
            v_visit.current_status;
    END IF;


    ----------------------------------------------------------------
    -- ASSIGNED ADVISOR SECURITY
    ----------------------------------------------------------------

    IF v_visit.current_assigned_to IS NULL THEN
        RAISE EXCEPTION
            'This vehicle is not assigned to an Advisor.';
    END IF;

    IF v_visit.current_assigned_to <> v_user_id THEN
        RAISE EXCEPTION
            'You are not the Advisor assigned to this vehicle.';
    END IF;


    ----------------------------------------------------------------
    -- VALIDATE SURVEY TIMESTAMP
    ----------------------------------------------------------------

    IF v_survey_completed_at IS NULL THEN
        RAISE EXCEPTION
            'Survey Date & Time is required.';
    END IF;


    ----------------------------------------------------------------
    -- VALIDATE APPROVAL STATUS
    ----------------------------------------------------------------

    IF upper(coalesce(p_approval_status, ''))
       NOT IN ('PENDING', 'RECEIVED') THEN

        RAISE EXCEPTION
            'Approval status must be Pending or Received.';

    END IF;


    ----------------------------------------------------------------
    -- LOAD INTAKE
    ----------------------------------------------------------------

    SELECT *
    INTO v_intake
    FROM public.vehicle_intake
    WHERE visit_id = p_visit_id
      AND vehicle_id = v_visit.vehicle_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Vehicle Intake record was not found.';
    END IF;


    ----------------------------------------------------------------
    -- PAID VALIDATION
    ----------------------------------------------------------------

    IF v_intake.insurance_type = 'PAID' THEN

        IF p_paid_amount IS NULL THEN
            RAISE EXCEPTION
                'Paid Amount is required for a PAID vehicle.';
        END IF;

        IF p_paid_amount < 0 THEN
            RAISE EXCEPTION
                'Paid Amount cannot be negative.';
        END IF;

        IF v_clean_receipt IS NULL THEN
            RAISE EXCEPTION
                'Receipt / Reference No. is required for a PAID vehicle.';
        END IF;

    ELSIF v_intake.insurance_type = 'INSURANCE' THEN

        NULL;

    ELSE
        RAISE EXCEPTION
            'Unsupported insurance type: %',
            v_intake.insurance_type;
    END IF;


    ----------------------------------------------------------------
    -- APPROVAL RECEIVED VALIDATION
    ----------------------------------------------------------------

    IF upper(p_approval_status) = 'RECEIVED' THEN

        IF v_approval_received_at IS NULL THEN
            RAISE EXCEPTION
                'Approval Date & Time is required when approval is Received.';
        END IF;

        IF v_clean_photo_path IS NULL THEN
            RAISE EXCEPTION
                'Assessment Sheet Photo is required when approval is Received.';
        END IF;

    ELSE

        v_approval_received_at := NULL;
        v_clean_photo_path := NULL;

    END IF;


    ----------------------------------------------------------------
    -- LOCK EXISTING VEHICLE JOB
    ----------------------------------------------------------------

    SELECT *
    INTO v_job
    FROM public.vehicle_jobs
    WHERE vehicle_id = v_visit.vehicle_id
      AND current_job_stage <> 'CLOSED'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Active vehicle job not found for this vehicle.';
    END IF;


    IF v_visit.closed_at IS NOT NULL OR v_job.advisor_id IS DISTINCT FROM v_user_id OR NOT EXISTS (SELECT 1 FROM public.vehicle_assignments WHERE visit_id=p_visit_id AND assignment_role='ADVISOR' AND assigned_to=v_user_id AND unassigned_at IS NULL) THEN
      RAISE EXCEPTION 'Active visit and assigned Advisor job are required.';
    END IF;

    ----------------------------------------------------------------
    -- DUPLICATE SURVEY PROTECTION
    ----------------------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM public.surveys
        WHERE visit_id = p_visit_id
          AND completed_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'A completed survey already exists for this visit.';
    END IF;


    ----------------------------------------------------------------
    -- NEXT SURVEY NUMBER
    ----------------------------------------------------------------

    SELECT coalesce(max(survey_no), 0) + 1
    INTO v_survey_no
    FROM public.surveys
    WHERE visit_id = p_visit_id;


    ----------------------------------------------------------------
    -- CREATE SURVEY
    ----------------------------------------------------------------

    INSERT INTO public.surveys (
        visit_id,
        vehicle_id,
        survey_no,
        survey_type,
        started_at,
        completed_at,
        completed_by,
        paid_amount,
        receipt_reference_no,
        remarks,
        created_at
    )
    VALUES (
        p_visit_id,
        v_visit.vehicle_id,
        v_survey_no,
        'INITIAL',
        v_survey_completed_at,
        v_survey_completed_at,
        v_user_id,
        CASE
            WHEN v_intake.insurance_type = 'PAID'
            THEN p_paid_amount
            ELSE NULL
        END,
        CASE
            WHEN v_intake.insurance_type = 'PAID'
            THEN v_clean_receipt
            ELSE NULL
        END,
        v_clean_remarks,
        v_now
    )
    RETURNING id
    INTO v_survey_id;


    ----------------------------------------------------------------
    -- SYNCHRONIZE VEHICLE JOB
    ----------------------------------------------------------------

    UPDATE public.vehicle_jobs
    SET
        survey_at = v_survey_completed_at,
        approval_status = CASE WHEN upper(p_approval_status) = 'RECEIVED' THEN 'APPROVED' ELSE 'PENDING' END,
        approval_at = CASE WHEN upper(p_approval_status) = 'RECEIVED' THEN v_approval_received_at ELSE NULL END,
        approval_remarks = CASE WHEN upper(p_approval_status) = 'RECEIVED' THEN v_clean_remarks ELSE approval_remarks END,
        current_job_stage = 'ADVISOR',
        advisor_remarks = COALESCE(
            v_clean_remarks,
            advisor_remarks
        ),
        updated_at = v_now
    WHERE id = v_job.id;


    ----------------------------------------------------------------
    -- FIND CURRENT OPEN STAGE
    ----------------------------------------------------------------

    SELECT id
    INTO v_open_stage_id
    FROM public.workflow_stage_history
    WHERE visit_id = p_visit_id
      AND status = 'OPEN'
    ORDER BY entered_at DESC
    LIMIT 1
    FOR UPDATE;


    ----------------------------------------------------------------
    -- CLOSE PENDING SURVEY STAGE
    ----------------------------------------------------------------

    IF v_open_stage_id IS NOT NULL THEN

        UPDATE public.workflow_stage_history
        SET
            exited_at = v_now,
            exited_by = v_user_id,
            status = 'COMPLETED',
            remarks = coalesce(
                v_clean_remarks,
                'Survey completed.'
            )
        WHERE id = v_open_stage_id;

    END IF;


    ----------------------------------------------------------------
    -- NEXT APPROVAL CYCLE NUMBER
    ----------------------------------------------------------------

    SELECT coalesce(max(cycle_no), 0) + 1
    INTO v_cycle_no
    FROM public.approval_cycles
    WHERE visit_id = p_visit_id;


    ----------------------------------------------------------------
    -- APPROVAL PENDING
    ----------------------------------------------------------------

    IF upper(p_approval_status) = 'PENDING' THEN

        v_stage_after := 'PENDING_APPROVAL';
        v_status_after := 'PENDING';


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
            p_visit_id,
            v_visit.vehicle_id,
            v_cycle_no,
            'INITIAL',
            'PENDING',
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            v_clean_remarks
        )
        RETURNING id
        INTO v_approval_cycle_id;


        ----------------------------------------------------------------
        -- OPEN PENDING APPROVAL
        ----------------------------------------------------------------

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
            'PENDING_APPROVAL',
            v_now,
            v_user_id,
            'OPEN',
            'Survey completed. Approval pending.'
        );


    ----------------------------------------------------------------
    -- APPROVAL ALREADY RECEIVED
    ----------------------------------------------------------------

    ELSE

        v_stage_after := 'ADVISOR_WORK';
        v_status_after := 'IN_PROGRESS';


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
            p_visit_id,
            v_visit.vehicle_id,
            v_cycle_no,
            'INITIAL',
            'APPROVED',
            v_approval_received_at,
            NULL,
            NULL,
            NULL,
            NULL,
            v_user_id,
            v_clean_remarks
        )
        RETURNING id
        INTO v_approval_cycle_id;


        ----------------------------------------------------------------
        -- ASSESSMENT SHEET PHOTO
        ----------------------------------------------------------------

        INSERT INTO public.vehicle_photos (
            vehicle_id,
            event_id,
            photo_type,
            storage_path,
            uploaded_by,
            uploaded_at,
            job_id
        )
        VALUES (
            v_visit.vehicle_id,
            NULL,
            'APPROVAL_ASSESSMENT',
            v_clean_photo_path,
            v_user_id,
            v_now,
            v_job.id
        );


        ----------------------------------------------------------------
        -- OPEN ADVISOR WORK
        ----------------------------------------------------------------

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
            'ADVISOR_WORK',
            v_now,
            v_user_id,
            'OPEN',
            'Survey completed and approval already received.'
        );

    END IF;


    ----------------------------------------------------------------
    -- WORKFLOW EVENT
    ----------------------------------------------------------------

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
        CASE
            WHEN upper(p_approval_status) = 'RECEIVED'
            THEN 'SURVEY_COMPLETED_APPROVAL_RECEIVED'
            ELSE 'SURVEY_COMPLETED'
        END,
        'PENDING_SURVEY',
        v_stage_after,
        v_visit.current_status,
        v_status_after,
        v_user_id,
        v_now,
        v_clean_remarks,
        jsonb_build_object(
            'survey_id', v_survey_id,
            'vehicle_job_id', v_job.id,
            'survey_no', v_survey_no,
            'survey_completed_at', v_survey_completed_at,
            'approval_status', upper(p_approval_status),
            'approval_received_at', v_approval_received_at,
            'approval_cycle_id', v_approval_cycle_id,
            'assessment_sheet_photo_path',
                CASE
                    WHEN upper(p_approval_status) = 'RECEIVED'
                    THEN v_clean_photo_path
                    ELSE NULL
                END
        )
    );


    ----------------------------------------------------------------
    -- UPDATE VISIT
    ----------------------------------------------------------------

    UPDATE public.workshop_visits
    SET
        current_stage = v_stage_after,
        current_status = v_status_after,
        stage_started_at = v_now
    WHERE id = p_visit_id;


    ----------------------------------------------------------------
    -- UPDATE VEHICLE
    ----------------------------------------------------------------

    UPDATE public.vehicles
    SET
        current_stage = v_stage_after,
        current_status = v_status_after,
        stage_started_at = v_now
    WHERE id = v_visit.vehicle_id;


    ----------------------------------------------------------------
    -- RETURN
    ----------------------------------------------------------------

    RETURN jsonb_build_object(
        'visit_id', p_visit_id,
        'vehicle_id', v_visit.vehicle_id,
        'vehicle_job_id', v_job.id,
        'survey_id', v_survey_id,
        'survey_no', v_survey_no,
        'approval_cycle_id', v_approval_cycle_id,
        'approval_status', upper(p_approval_status),
        'survey_completed_at', v_survey_completed_at,
        'approval_received_at', v_approval_received_at,
        'stage', v_stage_after,
        'status', v_status_after,
        'assessment_sheet_photo_path',
            CASE
                WHEN upper(p_approval_status) = 'RECEIVED'
                THEN v_clean_photo_path
                ELSE NULL
            END
    );

END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.new_workflow_complete_survey(uuid,numeric,text,text,timestamptz,text,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_complete_survey(uuid,numeric,text,text,timestamptz,text,timestamptz,text) TO authenticated;

