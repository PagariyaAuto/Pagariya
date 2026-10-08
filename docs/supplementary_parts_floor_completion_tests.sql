-- Fresh synthetic vehicles only. Every fixture and action is rolled back.
BEGIN;
CREATE TEMP TABLE store_test_people AS
SELECT
 (SELECT id FROM public.profiles WHERE role='advisor' AND is_active ORDER BY id LIMIT 1) advisor,
 (SELECT id FROM public.profiles WHERE role='ceo_admin' AND is_active ORDER BY id LIMIT 1) admin,
 (SELECT id FROM public.profiles WHERE role='store_team' AND is_active ORDER BY id LIMIT 1) store1,
 (SELECT id FROM public.profiles WHERE role='store_team' AND is_active ORDER BY id OFFSET 1 LIMIT 1) store2,
 (SELECT id FROM public.profiles WHERE role='floor_incharge' AND is_active ORDER BY id LIMIT 1) floor;
CREATE TEMP TABLE store_test_visits(n integer,v uuid,w uuid,j uuid,cycle uuid,ord uuid);
GRANT SELECT ON store_test_people,store_test_visits TO authenticated;
DO $$
DECLARE p record; v uuid; w uuid; j uuid; ac uuid; wt uuid; i integer;
BEGIN
 SELECT * INTO p FROM store_test_people;
 IF p.advisor IS NULL OR p.admin IS NULL OR p.store1 IS NULL OR p.store2 IS NULL OR p.floor IS NULL THEN RAISE EXCEPTION 'Test roles missing'; END IF;
 SELECT id INTO wt FROM public.work_type_master WHERE is_active ORDER BY id LIMIT 1;
 FOR i IN 1..4 LOOP
   INSERT INTO public.vehicles(vehicle_no,current_stage,current_status,current_assigned_to)
   VALUES('TESTSTORE'||left(replace(gen_random_uuid()::text,'-',''),10),'ADVISOR_WORK','PENDING',p.advisor) RETURNING id INTO v;
   INSERT INTO public.workshop_visits(vehicle_id,current_stage,current_status,current_assigned_to)
   VALUES(v,'ADVISOR_WORK','PENDING',p.advisor) RETURNING id INTO w;
   INSERT INTO public.vehicle_jobs(vehicle_id,job_type,approval_status,current_job_stage,advisor_id)
   VALUES(v,CASE WHEN i=2 THEN 'INSURANCE' ELSE 'PAID' END,'APPROVED','ADVISOR',p.advisor) RETURNING id INTO j;
   INSERT INTO public.vehicle_assignments(visit_id,vehicle_id,assigned_to,assigned_by,assignment_role)
   VALUES(w,v,p.advisor,p.admin,'ADVISOR');
   INSERT INTO public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,status,entered_by)
   VALUES(w,v,'ADVISOR_WORK',now()-interval '1 hour','OPEN',p.advisor);
   INSERT INTO public.approval_cycles(visit_id,vehicle_id,cycle_no,cycle_type,decision)
   VALUES(w,v,1,'INITIAL','APPROVED') RETURNING id INTO ac;
   INSERT INTO public.approval_work_scope(approval_cycle_id,visit_id,vehicle_id,work_type_id,created_by) VALUES(ac,w,v,wt,p.advisor);
   INSERT INTO store_test_visits VALUES(i,v,w,j,NULL,NULL);
 END LOOP;
END; $$;
CREATE FUNCTION pg_temp.store_test_error(p_sql text,p_message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN
   IF position(p_message in SQLERRM)>0 THEN RETURN; END IF;
   RAISE EXCEPTION 'Wrong failure: expected %, got %',p_message,SQLERRM;
 END;
 RAISE EXCEPTION 'Expected action to fail: %',p_message;
END; $$;
DO $$
DECLARE p record; f record; r jsonb; s uuid; original_work uuid;
BEGIN
 SELECT * INTO p FROM store_test_people;
 PERFORM set_config('request.jwt.claim.sub',p.advisor::text,true);
 SELECT * INTO f FROM store_test_visits WHERE n=1;
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_process_advisor_work_v3(%L,''PARTS_REQUIRED'',''T-REQ'',now(),NULL,NULL,NULL)',f.w),'Select an active Store Incharge');
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_process_advisor_work_v3(%L,''PARTS_REQUIRED'',''T-REQ'',now(),NULL,NULL,%L)',f.w,p.advisor),'Select an active Store Incharge');
 r:=public.new_workflow_process_advisor_work_v3(f.w,'PARTS_REQUIRED','T-REQ',now(),NULL,NULL,p.store1);
 IF r->>'success'<>'true' THEN RAISE EXCEPTION 'Regular handover failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=f.w AND current_stage='STORE' AND current_assigned_to=p.store1) OR
    NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=f.v AND current_stage='STORE' AND current_assigned_to=p.store1) THEN RAISE EXCEPTION 'Store assignment state mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=f.w AND assigned_to=p.advisor AND assignment_role='ADVISOR' AND unassigned_at IS NULL) OR
    NOT EXISTS(SELECT 1 FROM public.vehicle_jobs WHERE id=f.j AND advisor_id=p.advisor) THEN RAISE EXCEPTION 'Advisor ownership changed'; END IF;
 IF (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=f.w AND status='OPEN')<>1 THEN RAISE EXCEPTION 'Incorrect open stage count'; END IF;
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_assign_store(%L,%L,%L)',f.w,p.store2,p.store1),'Only CEO Admin');
 PERFORM set_config('request.jwt.claim.sub',p.store2::text,true);
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_create_part_order(%L,''T-ORDER'',''REGULAR'',now(),NULL)',f.w),'not assigned');
 PERFORM set_config('request.jwt.claim.sub',p.store1::text,true);
 r:=public.new_workflow_create_part_order(f.w,'T-ORDER','REGULAR',now(),NULL);
 UPDATE store_test_visits SET ord=(r->>'part_order_id')::uuid WHERE n=1;
 PERFORM set_config('request.jwt.claim.sub',p.store2::text,true);
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_receive_parts(%L,now(),NULL)',r->>'part_order_id'),'not assigned');
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_hand_over_parts_to_floor(%L,%L,now(),NULL)',r->>'part_order_id',p.floor),'not assigned');
 PERFORM set_config('request.jwt.claim.sub',p.admin::text,true);
 PERFORM public.new_workflow_assign_store(f.w,p.store2,p.store1,'Test reassignment');
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_assign_store(%L,%L,%L)',f.w,p.store1,p.store1),'assignment has changed');
 IF (SELECT count(*) FROM public.vehicle_assignments WHERE visit_id=f.w AND assignment_role='STORE_TEAM' AND unassigned_at IS NULL)<>1 THEN RAISE EXCEPTION 'Duplicate open Store assignment'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=f.w AND assignment_role='STORE_TEAM' AND assigned_to=p.store1 AND unassigned_at IS NOT NULL) THEN RAISE EXCEPTION 'Reassignment history missing'; END IF;
 IF (SELECT count(*) FROM public.workflow_events WHERE visit_id=f.w AND event_type='STORE_INCHARGE_ASSIGNED')<>2 THEN RAISE EXCEPTION 'Assignment audit missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',p.store1::text,true);
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_receive_parts(%L,now(),NULL)',r->>'part_order_id'),'not assigned');
 PERFORM set_config('request.jwt.claim.sub',p.store2::text,true);
 PERFORM public.new_workflow_receive_parts((r->>'part_order_id')::uuid,now(),NULL);

 -- Insurance and legacy bypass checks.
 PERFORM set_config('request.jwt.claim.sub',p.advisor::text,true);
 SELECT * INTO f FROM store_test_visits WHERE n=2;
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_process_advisor_work(%L,''PARTS_REQUIRED'',''T-REQ2'',now(),NULL)',f.w),'Select a Store Incharge');
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_process_advisor_work_v2(%L,''PARTS_REQUIRED'',''T-REQ2'',now(),NULL,NULL)',f.w),'Select a Store Incharge');
 PERFORM public.new_workflow_process_advisor_work_v3(f.w,'PARTS_REQUIRED','T-REQ2',now(),NULL,NULL,p.store1);

 -- Supplementary parts retain the original Advisor Work.
 SELECT * INTO f FROM store_test_visits WHERE n=3;
 INSERT INTO public.advisor_work(visit_id,vehicle_id,work_path,parts_required,assigned_by)
 VALUES(f.w,f.v,'NO_PARTS_REQUIRED',false,p.advisor) RETURNING id INTO original_work;
 INSERT INTO public.supplementary_cycles(visit_id,vehicle_id,cycle_no,requested_at,requested_by,reason,status)
 VALUES(f.w,f.v,1,now()-interval '30 minutes',p.advisor,'Rollback-only test','APPROVED') RETURNING id INTO s;
 UPDATE store_test_visits SET cycle=s WHERE n=3;
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_supplementary_parts(%L,''ONLY_PARTS'',''T-SUPP'',now(),NULL)',s),'Select a Store Incharge');
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_supplementary_parts_assigned(%L,''ONLY_PARTS'',''T-SUPP'',now(),NULL,NULL)',s),'Select an active Store Incharge');
 PERFORM public.new_workflow_supplementary_parts_assigned(s,'ONLY_PARTS','T-SUPP',now(),NULL,p.store1);
 IF NOT EXISTS(SELECT 1 FROM public.part_requisitions WHERE visit_id=f.w AND supplementary_cycle_id=s AND advisor_work_id=original_work) OR
    NOT EXISTS(SELECT 1 FROM public.advisor_work WHERE id=original_work AND NOT parts_required) THEN RAISE EXCEPTION 'Supplementary changed original work'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=f.w AND current_stage='STORE' AND current_assigned_to=p.store1) THEN RAISE EXCEPTION 'Supplementary Store assignment missing'; END IF;

 -- No-parts route still prepares Floor directly.
 SELECT * INTO f FROM store_test_visits WHERE n=4;
 PERFORM public.new_workflow_process_advisor_work_v3(f.w,'NO_PARTS_REQUIRED',NULL,NULL,NULL,p.floor,NULL);
 IF NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=f.w AND current_stage='FLOOR' AND current_assigned_to=p.floor) THEN RAISE EXCEPTION 'No-parts Floor route changed'; END IF;
END; $$;

-- Verify real RLS as the authenticated role, not the database owner.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT store1::text FROM store_test_people),true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.vehicles WHERE id IN (SELECT v FROM store_test_visits))<>2 THEN RAISE EXCEPTION 'Store1 must see only its 2 vehicles'; END IF;
 IF EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=(SELECT w FROM store_test_visits WHERE n=1)) THEN RAISE EXCEPTION 'Reassigned visit visible to old Incharge'; END IF;
 IF EXISTS(SELECT 1 FROM public.part_orders WHERE visit_id=(SELECT w FROM store_test_visits WHERE n=1)) THEN RAISE EXCEPTION 'Reassigned order visible to old Incharge'; END IF;
 IF EXISTS(SELECT 1 FROM public.part_requisitions WHERE visit_id=(SELECT w FROM store_test_visits WHERE n=1)) THEN RAISE EXCEPTION 'Reassigned requisition visible'; END IF;
 IF EXISTS(SELECT 1 FROM public.advisor_work WHERE visit_id=(SELECT w FROM store_test_visits WHERE n=1)) THEN RAISE EXCEPTION 'Reassigned work visible'; END IF;
END; $$;
SELECT set_config('request.jwt.claim.sub',(SELECT store2::text FROM store_test_people),true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.vehicles WHERE id IN (SELECT v FROM store_test_visits))<>1 THEN RAISE EXCEPTION 'Store2 must see exactly the reassigned vehicle'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.part_orders WHERE id=(SELECT ord FROM store_test_visits WHERE n=1) AND status='RECEIVED') THEN RAISE EXCEPTION 'Assigned received order not visible'; END IF;
END; $$;
SELECT set_config('request.jwt.claim.sub',(SELECT admin::text FROM store_test_people),true);
DO $$
BEGIN IF (SELECT count(*) FROM public.vehicles WHERE id IN (SELECT v FROM store_test_visits))<>4 THEN RAISE EXCEPTION 'CEO Admin scope changed'; END IF; END; $$;
SELECT set_config('request.jwt.claim.sub',(SELECT advisor::text FROM store_test_people),true);
DO $$
BEGIN IF (SELECT count(*) FROM public.vehicles WHERE id IN (SELECT v FROM store_test_visits))<>4 THEN RAISE EXCEPTION 'Advisor monitoring scope changed'; END IF; END; $$;

-- Assigned Incharge can hand over received parts; then loses Store access.
SELECT set_config('request.jwt.claim.sub',(SELECT store2::text FROM store_test_people),true);
SELECT public.new_workflow_hand_over_parts_to_floor((SELECT ord FROM store_test_visits WHERE n=1),(SELECT floor FROM store_test_people),now(),NULL);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.vehicles WHERE id=(SELECT v FROM store_test_visits WHERE n=1)) THEN RAISE EXCEPTION 'Floor vehicle remains visible to Store'; END IF;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.vehicle_assignments WHERE visit_id=(SELECT w FROM store_test_visits WHERE n=1) AND assignment_role='STORE_TEAM' AND unassigned_at IS NULL) THEN RAISE EXCEPTION 'Store assignment not closed at Floor handover'; END IF;
 IF (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=(SELECT w FROM store_test_visits WHERE n=1) AND status='OPEN')<>1 THEN RAISE EXCEPTION 'Floor history inconsistent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=(SELECT w FROM store_test_visits WHERE n=1) AND current_stage='FLOOR' AND current_assigned_to=(SELECT floor FROM store_test_people)) THEN RAISE EXCEPTION 'Floor assignee mismatch'; END IF;
END; $$;
DO $$
DECLARE p record; f record; other_floor uuid; other_advisor uuid; inspector uuid; source uuid; s uuid; ac uuid; survey uuid; path text; r jsonb; i integer; owner_id uuid; v uuid; w uuid;
BEGIN
 SELECT * INTO p FROM store_test_people;
 SELECT id INTO other_floor FROM public.profiles WHERE role='floor_incharge' AND is_active AND id<>p.floor LIMIT 1;
 SELECT id INTO other_advisor FROM public.profiles WHERE role='advisor' AND is_active AND id<>p.advisor LIMIT 1;
 SELECT id INTO inspector FROM public.profiles WHERE role='final_inspector' AND is_active LIMIT 1;
 IF other_floor IS NULL OR other_advisor IS NULL OR inspector IS NULL THEN RAISE EXCEPTION 'Additional test roles required'; END IF;
 SELECT * INTO f FROM store_test_visits WHERE n=4;
 PERFORM set_config('request.jwt.claim.sub',other_advisor::text,true);
 PERFORM pg_temp.store_test_error(format('select public.assign_floor_incharge(%L,%L)',f.v,other_floor),'not assigned');
 PERFORM set_config('request.jwt.claim.sub',p.store1::text,true);
 PERFORM pg_temp.store_test_error(format('select public.assign_floor_incharge(%L,%L)',f.v,other_floor),'Only an active Advisor');
 PERFORM set_config('request.jwt.claim.sub',p.advisor::text,true);
 PERFORM pg_temp.store_test_error(format('select public.assign_floor_incharge(%L,%L)',f.v,p.store1),'Select an active Floor');
 r:=public.assign_floor_incharge(f.v,other_floor,'Rollback assignment test')::jsonb;
 IF r->>'success'<>'true' OR NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=f.w AND current_assigned_to=other_floor) OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=f.v AND current_assigned_to=other_floor) OR NOT EXISTS(SELECT 1 FROM public.vehicle_jobs WHERE id=f.j AND floor_incharge_id=other_floor AND advisor_id=p.advisor) OR NOT EXISTS(SELECT 1 FROM public.floor_work_cycles WHERE visit_id=f.w AND status='ACTIVE' AND floor_incharge_id=other_floor) THEN RAISE EXCEPTION 'Floor reassignment not synchronized'; END IF;
 IF (SELECT count(*) FROM public.vehicle_assignments WHERE visit_id=f.w AND assignment_role='FLOOR_INCHARGE' AND unassigned_at IS NULL)<>1 THEN RAISE EXCEPTION 'Duplicate Floor assignment'; END IF;
 PERFORM set_config('request.jwt.claim.sub',p.floor::text,true);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.new_workflow_supplementary_queue(true)->'items') x WHERE x->>'visit_id'=f.w::text) THEN RAISE EXCEPTION 'Previous Floor Incharge still sees vehicle'; END IF;
 PERFORM set_config('request.jwt.claim.sub',other_floor::text,true);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.new_workflow_supplementary_queue(true)->'items') x WHERE x->>'visit_id'=f.w::text) THEN RAISE EXCEPTION 'New Floor Incharge cannot see vehicle'; END IF;
 PERFORM set_config('request.jwt.claim.sub',p.admin::text,true);
 PERFORM public.assign_floor_incharge(f.v,p.floor,'Admin changes Floor Incharge');

 -- Two actual public supplementary decisions, with rollback-only evidence metadata.
 FOR i IN 1..2 LOOP
  SELECT id INTO source FROM public.floor_work_cycles WHERE visit_id=f.w AND status='ACTIVE';
  UPDATE public.floor_work_cycles SET status='SUPPLEMENTARY' WHERE id=source;
  UPDATE public.floor_work_items SET status='COMPLETED',started_at=now()-interval '10 minutes',started_by=p.floor,completed_at=now()-interval '5 minutes',completed_by=p.floor WHERE floor_work_cycle_id=source;
  UPDATE public.workshop_visits SET current_stage='SUPPLEMENTARY_APPROVAL',current_status='PENDING',current_assigned_to=p.advisor WHERE id=f.w;
  UPDATE public.vehicles SET current_stage='SUPPLEMENTARY_APPROVAL',current_status='PENDING',current_assigned_to=p.advisor WHERE id=f.v;
  UPDATE public.workflow_stage_history SET exited_at=now(),exited_by=p.floor,status='COMPLETED' WHERE visit_id=f.w AND status='OPEN';
  INSERT INTO public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,entered_by,status) VALUES(f.w,f.v,'SUPPLEMENTARY_APPROVAL',now(),p.advisor,'OPEN');
  INSERT INTO public.surveys(visit_id,vehicle_id,survey_no,survey_type,completed_at,completed_by) VALUES(f.w,f.v,i,'SUPPLEMENTARY',now()-interval '1 minute',p.advisor) RETURNING id INTO survey;
  INSERT INTO public.approval_cycles(visit_id,vehicle_id,cycle_no,cycle_type,decision) VALUES(f.w,f.v,i+1,'SUPPLEMENTARY','PENDING') RETURNING id INTO ac;
  INSERT INTO public.supplementary_cycles(visit_id,vehicle_id,cycle_no,requested_at,requested_by,reason,status,source_floor_cycle_id,survey_id,approval_cycle_id) VALUES(f.w,f.v,i,now()-interval '15 minutes',p.floor,'Rollback test','APPROVAL',source,survey,ac) RETURNING id INTO s;
  PERFORM set_config('request.jwt.claim.sub',p.advisor::text,true);
  IF i=1 THEN
   path:='vehicles/'||f.v||'/SUPPLEMENTARY/'||f.w||'/rollback-test.jpg';
   INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('vehicle-photos',path,p.advisor::text);
   PERFORM public.new_workflow_decide_supplementary(s,'APPROVED',now(),NULL,path,false);
  ELSE
   PERFORM public.new_workflow_decide_supplementary(s,'CLAIM_REJECTED',now(),'Continue original approved repairs',NULL,false);
   PERFORM public.new_workflow_continue_without_supplementary(s);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=f.w AND current_stage='FLOOR' AND current_assigned_to=p.floor) OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=f.v AND current_stage='FLOOR' AND current_assigned_to=p.floor) THEN RAISE EXCEPTION 'Supplementary Floor return assignee mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.floor_work_items wi JOIN public.floor_work_cycles fc ON fc.id=wi.floor_work_cycle_id WHERE fc.visit_id=f.w AND fc.status='ACTIVE' AND wi.status='COMPLETED' AND wi.completed_by=p.floor) THEN RAISE EXCEPTION 'Completed work lost on supplementary return'; END IF;
  IF (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=f.w AND status='OPEN')<>1 THEN RAISE EXCEPTION 'Supplementary open stage mismatch'; END IF;
 END LOOP;

 -- Floor completion and a failed inspection return to the last assigned Floor Incharge.
 UPDATE public.workshop_visits SET current_status='COMPLETED' WHERE id=f.w;
 UPDATE public.vehicles SET current_status='COMPLETED' WHERE id=f.v;
 PERFORM set_config('request.jwt.claim.sub',p.floor::text,true);
 PERFORM public.new_workflow_complete_floor_cycle(f.w);
 PERFORM set_config('request.jwt.claim.sub',p.advisor::text,true);
 PERFORM public.new_workflow_assign_final_inspector(f.w,inspector,NULL);
 PERFORM set_config('request.jwt.claim.sub',inspector::text,true);
 r:=public.new_workflow_complete_final_inspection(f.w,'FAILED','Rollback paint inspection',NULL);
 IF r->>'success'<>'true' OR NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=f.w AND current_stage='FLOOR' AND current_assigned_to=p.floor) OR NOT EXISTS(SELECT 1 FROM public.floor_work_cycles WHERE visit_id=f.w AND status='ACTIVE' AND floor_incharge_id=p.floor) THEN RAISE EXCEPTION 'Inspection rework assignment failed'; END IF;
 IF (SELECT count(*) FROM public.vehicle_assignments WHERE visit_id=f.w AND assignment_role='FLOOR_INCHARGE' AND unassigned_at IS NULL)<>1 THEN RAISE EXCEPTION 'Rework Floor assignment mismatch'; END IF;

 -- Insurance no-parts route: reuse a fresh separate fixture, never a real vehicle.
 INSERT INTO public.vehicles(vehicle_no,current_stage,current_status,current_assigned_to) VALUES('TESTROUTE'||left(replace(gen_random_uuid()::text,'-',''),10),'ADVISOR_WORK','PENDING',p.advisor) RETURNING id INTO v;
 INSERT INTO public.workshop_visits(vehicle_id,current_stage,current_status,current_assigned_to) VALUES(v,'ADVISOR_WORK','PENDING',p.advisor) RETURNING id INTO w;
 INSERT INTO public.vehicle_jobs(vehicle_id,job_type,approval_status,current_job_stage,advisor_id) VALUES(v,'INSURANCE','APPROVED','ADVISOR',p.advisor);
 INSERT INTO public.vehicle_assignments(visit_id,vehicle_id,assigned_to,assigned_by,assignment_role) VALUES(w,v,p.advisor,p.admin,'ADVISOR');
 INSERT INTO public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,status,entered_by) VALUES(w,v,'ADVISOR_WORK',now()-interval '1 hour','OPEN',p.advisor);
 INSERT INTO public.approval_cycles(visit_id,vehicle_id,cycle_no,cycle_type,decision) VALUES(w,v,1,'INITIAL','APPROVED') RETURNING id INTO ac;
 INSERT INTO public.approval_work_scope(approval_cycle_id,visit_id,vehicle_id,work_type_id,created_by) SELECT ac,w,v,id,p.advisor FROM public.work_type_master WHERE code='STRIPPING' AND is_active;
 PERFORM set_config('request.jwt.claim.sub',p.advisor::text,true);
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_process_advisor_work_v3(%L,''NO_PARTS_REQUIRED'',NULL,NULL,NULL,NULL,NULL)',w),'Floor Incharge');
 r:=public.new_workflow_process_advisor_work_v3(w,'NO_PARTS_REQUIRED',NULL,NULL,NULL,p.floor,NULL);
 IF r->>'success'<>'true' OR NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=w AND current_assigned_to=p.floor AND current_stage='FLOOR') OR EXISTS(SELECT 1 FROM public.part_requisitions WHERE visit_id=w) THEN RAISE EXCEPTION 'Insurance direct Floor route failed'; END IF;
END; $$;


DO $$
DECLARE p record; watchman uuid; other_advisor uuid; v uuid; w uuid; r jsonb;
BEGIN
 SELECT * INTO p FROM store_test_people;
 SELECT id INTO watchman FROM public.profiles WHERE role='watchman' AND is_active LIMIT 1;
 SELECT id INTO other_advisor FROM public.profiles WHERE role='advisor' AND is_active AND id<>p.advisor LIMIT 1;
 INSERT INTO public.vehicles(vehicle_no,current_stage,current_status) VALUES('TESTASSIGN'||left(replace(gen_random_uuid()::text,'-',''),10),'PENDING_ADVISOR','PENDING') RETURNING id INTO v;
 INSERT INTO public.workshop_visits(vehicle_id,current_stage,current_status) VALUES(v,'PENDING_ADVISOR','PENDING') RETURNING id INTO w;
 INSERT INTO public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,status,entered_by) VALUES(w,v,'PENDING_ADVISOR',now(),'OPEN',watchman);
 PERFORM set_config('request.jwt.claim.sub',p.store1::text,true);
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_assign_advisor(%L,%L)',w,p.advisor),'not authorized');
 PERFORM set_config('request.jwt.claim.sub',p.advisor::text,true);
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_assign_advisor(%L,%L)',w,other_advisor),'themselves');
 PERFORM set_config('request.jwt.claim.sub',watchman::text,true);
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_assign_advisor(%L,%L)',w,p.store1),'not active');
 r:=public.new_workflow_assign_advisor(w,p.advisor,'Rollback test');
 IF r->>'success'<>'true' OR NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=w AND current_stage='ADVISOR_ASSIGNED' AND current_status='IN_PROGRESS' AND current_assigned_to=p.advisor) OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=v AND current_stage='ADVISOR_ASSIGNED' AND current_status='IN_PROGRESS' AND current_assigned_to=p.advisor) THEN RAISE EXCEPTION 'Advisor assignment state mismatch'; END IF;
 PERFORM pg_temp.store_test_error(format('select public.new_workflow_assign_advisor(%L,%L)',w,other_advisor),'vehicle has moved');
 IF (SELECT count(*) FROM public.vehicle_assignments WHERE visit_id=w AND assignment_role='ADVISOR' AND unassigned_at IS NULL)<>1 OR (SELECT count(*) FROM public.workflow_stage_history WHERE visit_id=w AND status='OPEN')<>1 THEN RAISE EXCEPTION 'Duplicate Advisor assignment or history'; END IF;
END; $$;


DO $$
DECLARE p record; f record; case_no integer; source uuid; supp uuid; req uuid; order_id uuid; dest uuid; stripping uuid; painting uuid; strip_type uuid; paint_type uuid; r jsonb;
BEGIN
 SELECT * INTO p FROM store_test_people;
 SELECT id INTO strip_type FROM public.work_type_master WHERE code='STRIPPING' AND is_active;
 SELECT id INTO paint_type FROM public.work_type_master WHERE code='PAINTING' AND is_active;
 IF strip_type IS NULL OR paint_type IS NULL THEN RAISE EXCEPTION 'Work types missing'; END IF;
 FOR case_no IN 2..3 LOOP
  SELECT * INTO f FROM store_test_visits t WHERE t.n=case_no;
  UPDATE public.vehicle_jobs SET job_type='INSURANCE',floor_incharge_id=p.floor WHERE id=f.j;
  INSERT INTO public.floor_work_cycles(visit_id,vehicle_id,cycle_no,floor_incharge_id,vehicle_in_at,status)
  VALUES(f.w,f.v,1,p.floor,now()-interval '1 hour','RETURNED_TO_ADVISOR') RETURNING id INTO source;
  INSERT INTO public.floor_work_items(floor_work_cycle_id,work_type_id,status,started_at,started_by,completed_at,completed_by,remarks)
  VALUES(source,strip_type,CASE WHEN case_no=3 THEN 'COMPLETED' ELSE 'STOPPED_FOR_SUPPLEMENTARY' END,now()-interval '50 minutes',p.floor,
   CASE WHEN case_no=3 THEN now()-interval '40 minutes' ELSE NULL END,CASE WHEN case_no=3 THEN p.floor ELSE NULL END,'Existing Stripping note');
  INSERT INTO public.floor_work_items(floor_work_cycle_id,work_type_id,status) VALUES(source,paint_type,'PENDING');
  IF case_no=3 THEN
   supp:=f.cycle;
   UPDATE public.supplementary_cycles SET source_floor_cycle_id=source WHERE id=supp;
  ELSE
   INSERT INTO public.supplementary_cycles(visit_id,vehicle_id,cycle_no,requested_at,requested_by,reason,status,source_floor_cycle_id)
   VALUES(f.w,f.v,1,now()-interval '30 minutes',p.floor,'Test return with unfinished Stripping','APPROVED',source) RETURNING id INTO supp;
   UPDATE public.part_requisitions SET supplementary_cycle_id=supp WHERE visit_id=f.w;
  END IF;
  SELECT id INTO req FROM public.part_requisitions WHERE visit_id=f.w;
  PERFORM set_config('request.jwt.claim.sub',p.store1::text,true);
  r:=public.new_workflow_create_part_order(f.w,'T-SUPP-RETURN-'||case_no,'REGULAR',now(),NULL);
  order_id:=(r->>'part_order_id')::uuid;
  PERFORM public.new_workflow_receive_parts(order_id,now(),NULL);
  PERFORM public.new_workflow_hand_over_parts_to_floor(order_id,p.floor,now(),NULL);
  SELECT return_floor_cycle_id INTO dest FROM public.supplementary_cycles WHERE id=supp;
  IF (SELECT count(*) FROM public.floor_work_items WHERE floor_work_cycle_id=dest)<>2 THEN RAISE EXCEPTION 'Return dropped a source item'; END IF;
  SELECT id INTO stripping FROM public.floor_work_items WHERE floor_work_cycle_id=dest AND work_type_id=strip_type;
  SELECT id INTO painting FROM public.floor_work_items WHERE floor_work_cycle_id=dest AND work_type_id=paint_type;
  IF case_no=3 AND NOT EXISTS(
   SELECT 1 FROM public.floor_work_items d JOIN public.floor_work_items old ON old.floor_work_cycle_id=source AND old.work_type_id=d.work_type_id
   WHERE d.id=stripping AND d.status='COMPLETED' AND d.started_at=old.started_at AND d.started_by=old.started_by AND d.completed_at=old.completed_at AND d.completed_by=old.completed_by
  ) THEN RAISE EXCEPTION 'Completed Stripping evidence was not preserved'; END IF;
  IF case_no=2 AND NOT EXISTS(SELECT 1 FROM public.floor_work_items WHERE id=stripping AND status='PENDING' AND started_at IS NULL AND completed_at IS NULL) THEN RAISE EXCEPTION 'Unfinished Stripping not restartable'; END IF;
  PERFORM pg_temp.store_test_error(format('select public.new_workflow_start_floor_item(%L)',painting),'not authorized');
  PERFORM set_config('request.jwt.claim.sub',p.floor::text,true);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.new_workflow_supplementary_queue(true)->'items') x CROSS JOIN LATERAL jsonb_array_elements(x->'floor_items') wi WHERE x->>'visit_id'=f.w::text AND wi->>'id'=stripping::text) THEN RAISE EXCEPTION 'Carried Stripping absent from Floor queue'; END IF;
  IF case_no=2 THEN
   PERFORM pg_temp.store_test_error(format('select public.new_workflow_start_floor_item(%L)',painting),'Complete Stripping');
   PERFORM public.new_workflow_start_stripping(f.w);
   PERFORM public.new_workflow_complete_floor_item(stripping,NULL);
  END IF;
  PERFORM public.new_workflow_start_floor_item(painting);
  PERFORM public.new_workflow_complete_floor_item(painting,NULL);
  PERFORM public.new_workflow_complete_floor_cycle(f.w);
  IF NOT EXISTS(SELECT 1 FROM public.workshop_visits WHERE id=f.w AND current_stage='FINAL_INSPECTION') THEN RAISE EXCEPTION 'Returned Floor work could not proceed to inspection'; END IF;
 END LOOP;
END; $$;

ROLLBACK;
SELECT 'PASS: fresh Paid/Insurance/Supplementary assignments, legacy bypass rejection, Admin reassignment/stale guard/history, unauthorized actions, authenticated RLS, Advisor ownership, no-parts Floor and Store-to-Floor handover; including Floor reassignment, approved/rejected supplementary returns, inspection rework and Insurance direct Floor; also completed/unfinished Stripping through supplementary parts return, assigned Floor start/complete and mandatory Final Inspection; fixtures rolled back.' AS result;




