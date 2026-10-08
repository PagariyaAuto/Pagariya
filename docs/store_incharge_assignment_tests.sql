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
ROLLBACK;
SELECT 'PASS: fresh Paid/Insurance/Supplementary assignments, legacy bypass rejection, Admin reassignment/stale guard/history, unauthorized actions, authenticated RLS, Advisor ownership, no-parts Floor and Store-to-Floor handover; fixtures rolled back.' AS result;
