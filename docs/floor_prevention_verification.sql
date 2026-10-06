-- Run with the complete replacement definitions inside the same BEGIN/ROLLBACK.
BEGIN;
DO $test$
DECLARE advisor uuid; store_user uuid; floor_user uuid; model uuid; insurer uuid; mi uuid; v uuid; w uuid; j uuid; res jsonb; order_id uuid; mode text; paid boolean; denied boolean; photo text; old_count integer;
BEGIN
 SELECT id INTO advisor FROM public.profiles WHERE role='advisor' AND is_active LIMIT 1;
 SELECT id INTO store_user FROM public.profiles WHERE role='store_team' AND is_active LIMIT 1;
 SELECT id INTO floor_user FROM public.profiles WHERE role='floor_incharge' AND is_active LIMIT 1;
 SELECT vehicle_model_id INTO model FROM public.vehicle_intake WHERE insurance_type='PAID' LIMIT 1;
 SELECT insurance_company_id,mi_type_id INTO insurer,mi FROM public.vehicle_intake WHERE insurance_type='INSURANCE' AND insurance_company_id IS NOT NULL AND mi_type_id IS NOT NULL LIMIT 1;
 FOREACH mode IN ARRAY ARRAY['PAID_RECEIVED','INSURANCE_RECEIVED','INSURANCE_PENDING'] LOOP
  paid:=mode='PAID_RECEIVED'; v:=gen_random_uuid(); w:=gen_random_uuid(); j:=gen_random_uuid();
  INSERT INTO public.vehicles(id,vehicle_no,current_stage,current_status,current_assigned_to,stage_started_at) VALUES(v,'FLOORFIX-'||left(v::text,8),'PENDING_SURVEY','PENDING',advisor,now()-interval '3 minutes');
  INSERT INTO public.workshop_visits(id,vehicle_id,visit_no,current_stage,current_status,current_assigned_to,stage_started_at) VALUES(w,v,1,'PENDING_SURVEY','PENDING',advisor,now()-interval '3 minutes');
  INSERT INTO public.vehicle_assignments(visit_id,vehicle_id,assigned_to,assigned_by,assignment_role) VALUES(w,v,advisor,advisor,'ADVISOR');
  INSERT INTO public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,entered_by,status) VALUES(w,v,'PENDING_SURVEY',now()-interval '3 minutes',advisor,'OPEN');
  INSERT INTO public.vehicle_intake(visit_id,vehicle_id,customer_name,customer_mobile,vehicle_type,vehicle_model_id,arena_nexa,insurance_type,worker_group,job_card_no,completed_by,insurance_company_id,mi_type_id)
   VALUES(w,v,'Rollback fixture','0000000000','PRIVATE',model,'NEXA',CASE WHEN paid THEN 'PAID' ELSE 'INSURANCE' END,'PNPL','TEST-'||left(v::text,8),advisor,CASE WHEN paid THEN NULL ELSE insurer END,CASE WHEN paid THEN NULL ELSE mi END);
  INSERT INTO public.vehicle_jobs(id,vehicle_id,advisor_id,job_type,current_job_stage) VALUES(j,v,advisor,CASE WHEN paid THEN 'PAID' ELSE 'INSURANCE' END,'ADVISOR');
  photo:='vehicles/'||v||'/APPROVAL_ASSESSMENT/rollback-test.jpg';
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('vehicle-photos',photo,advisor::text);
  PERFORM set_config('request.jwt.claim.sub',store_user::text,true);
  denied:=false; BEGIN PERFORM public.new_workflow_complete_survey(w,NULL,NULL,NULL,now()-interval '2 minutes','PENDING',NULL,NULL); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Store user completed initial Survey'; END IF;
  PERFORM set_config('request.jwt.claim.sub',advisor::text,true);
  IF mode='INSURANCE_PENDING' THEN
    UPDATE public.vehicle_jobs SET current_job_stage='CLOSED' WHERE id=j;
    denied:=false; BEGIN PERFORM public.new_workflow_complete_survey(w,NULL,NULL,NULL,now()-interval '2 minutes','PENDING',NULL,NULL); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%Active vehicle job not found%'; END;
    IF NOT denied OR EXISTS(SELECT 1 FROM public.surveys WHERE visit_id=w) THEN RAISE EXCEPTION 'Missing-job guard failed'; END IF;
    UPDATE public.vehicle_jobs SET current_job_stage='ADVISOR' WHERE id=j;
  END IF;
  res:=public.new_workflow_complete_survey(w,CASE WHEN paid THEN 100 ELSE NULL END,CASE WHEN paid THEN 'TEST-RECEIPT' ELSE NULL END,'Regression',now()-interval '2 minutes',CASE WHEN mode='INSURANCE_PENDING' THEN 'PENDING' ELSE 'RECEIVED' END,CASE WHEN mode='INSURANCE_PENDING' THEN NULL ELSE now()-interval '1 minute' END,CASE WHEN mode='INSURANCE_PENDING' THEN NULL ELSE photo END);
  IF mode='INSURANCE_PENDING' THEN
    IF (SELECT approval_status FROM public.vehicle_jobs WHERE id=j)<>'PENDING' OR (SELECT approval_at FROM public.vehicle_jobs WHERE id=j) IS NOT NULL OR (SELECT current_stage FROM public.workshop_visits WHERE id=w)<>'PENDING_APPROVAL' THEN RAISE EXCEPTION 'Pending branch changed'; END IF;
  ELSE
    IF (SELECT approval_status FROM public.vehicle_jobs WHERE id=j)<>'APPROVED' OR (SELECT approval_at FROM public.vehicle_jobs WHERE id=j) IS DISTINCT FROM now()-interval '1 minute' OR (SELECT current_stage FROM public.workshop_visits WHERE id=w)<>'ADVISOR_WORK' THEN RAISE EXCEPTION 'Direct approval job mismatch'; END IF;
    UPDATE public.vehicle_jobs SET approval_status='PENDING' WHERE id=j;
    denied:=false; BEGIN PERFORM public.new_workflow_process_advisor_work(w,'ONLY_DENTING_PAINTING'); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%approval must agree%'; END;
    IF NOT denied OR EXISTS(SELECT 1 FROM public.advisor_work WHERE visit_id=w) THEN RAISE EXCEPTION 'Inconsistent Advisor Work passed'; END IF;
    UPDATE public.vehicle_jobs SET approval_status='APPROVED' WHERE id=j;
    IF paid THEN
      PERFORM public.new_workflow_process_advisor_work(w,'ONLY_DENTING_PAINTING');
    ELSE
      PERFORM public.new_workflow_process_advisor_work(w,'DENTING_PAINTING_PARTS','TEST-REQ',now());
      PERFORM set_config('request.jwt.claim.sub',store_user::text,true);
      order_id:=(public.new_workflow_create_part_order(w,'TEST-ORDER','REGULAR',now())->>'part_order_id')::uuid;
      PERFORM public.new_workflow_receive_parts(order_id,now());
      UPDATE public.vehicle_jobs SET approval_status='PENDING' WHERE id=j;
      denied:=false; BEGIN PERFORM public.new_workflow_hand_over_parts_to_floor(order_id,floor_user,now()); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%approval must agree%'; END;
      IF NOT denied OR EXISTS(SELECT 1 FROM public.part_handovers WHERE visit_id=w) THEN RAISE EXCEPTION 'Inconsistent Store handover passed'; END IF;
      UPDATE public.vehicle_jobs SET approval_status='APPROVED' WHERE id=j;
      PERFORM public.new_workflow_hand_over_parts_to_floor(order_id,floor_user,now());
    END IF;
    IF (SELECT current_stage FROM public.workshop_visits WHERE id=w)<>'FLOOR' OR (SELECT current_job_stage FROM public.vehicle_jobs WHERE id=j)<>'FLOOR' OR (SELECT current_status FROM public.vehicles WHERE id=v)<>'PENDING' THEN RAISE EXCEPTION 'Floor transition mismatch'; END IF;
  END IF;
  IF (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=w AND status='OPEN')<>1 THEN RAISE EXCEPTION 'Open stage count mismatch'; END IF;
  SELECT count(*) INTO old_count FROM public.workflow_events WHERE visit_id=w;
  PERFORM set_config('request.jwt.claim.sub',advisor::text,true);
  denied:=false; BEGIN PERFORM public.new_workflow_complete_survey(w,NULL,NULL,NULL,now(),'PENDING',NULL,NULL); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied OR (SELECT count(*) FROM public.workflow_events WHERE visit_id=w)<>old_count THEN RAISE EXCEPTION 'Repeat Survey added events'; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 denied:=false; BEGIN PERFORM public.new_workflow_complete_survey(w,NULL,NULL,NULL,now(),'PENDING',NULL,NULL); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Missing session accepted'; END IF;
END;
$test$;
ROLLBACK;
