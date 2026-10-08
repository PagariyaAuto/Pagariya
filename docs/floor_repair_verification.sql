-- Pre-repair, rollback-only checks for the explicitly approved vehicles.
BEGIN;
DO $test$
DECLARE rec record; outcome jsonb; denied boolean; advisor uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','',true);
 FOR rec IN SELECT v.vehicle_no,w.id visit_id,a.id approval_id,e.id event_id,j.id job_id
  FROM public.vehicles v JOIN public.workshop_visits w ON w.vehicle_id=v.id AND w.closed_at IS NULL
  JOIN public.approval_cycles a ON a.visit_id=w.id AND a.decision='APPROVED'
  JOIN public.workflow_events e ON e.visit_id=w.id AND e.metadata->>'approval_cycle_id'=a.id::text AND e.stage_after='ADVISOR_WORK'
  LEFT JOIN public.vehicle_jobs j ON j.vehicle_id=v.id AND j.current_job_stage<>'CLOSED'
  WHERE v.vehicle_no IN ('GJ25LP6363','MH33JK3030')
 LOOP
  outcome:=pagariya_workflow_private.reconcile_floor_record(rec.visit_id,rec.approval_id,rec.event_id,rec.job_id,rec.vehicle_no='MH33JK3030','Rollback-only owner-approved repair verification');
  IF (SELECT approval_status FROM public.vehicle_jobs WHERE id=(outcome->>'job_id')::uuid)<>'APPROVED' THEN RAISE EXCEPTION 'Repair status mismatch'; END IF;
  IF (SELECT count(*) FROM public.floor_work_cycles WHERE visit_id=rec.visit_id)<>0 THEN RAISE EXCEPTION 'Repair invented Floor work'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.workflow_events WHERE id=(outcome->>'audit_event_id')::uuid AND performed_by IS NULL AND metadata->>'actor_type'='OWNER_APPROVED_DATABASE_MAINTENANCE') THEN RAISE EXCEPTION 'Maintenance actor not explicit'; END IF;
  denied:=false; BEGIN PERFORM pagariya_workflow_private.reconcile_floor_record(rec.visit_id,rec.approval_id,rec.event_id,rec.job_id,rec.vehicle_no='MH33JK3030','Duplicate'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Repeated repair accepted'; END IF;
  SELECT id INTO advisor FROM public.profiles WHERE role='advisor' AND is_active LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',advisor::text,true);
  denied:=false; BEGIN PERFORM pagariya_workflow_private.reconcile_floor_record(rec.visit_id,rec.approval_id,rec.event_id,rec.job_id,false,'Unauthorized'); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%Only an active CEO%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Advisor repair accepted'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
 END LOOP;
END;
$test$;
ROLLBACK;
