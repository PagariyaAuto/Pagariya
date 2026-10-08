begin;
create temp table billing_date_fixture (n int, v uuid, w uuid, j uuid, advisor uuid, executive uuid, outsider uuid);
grant select on billing_date_fixture to authenticated;
do $$
declare a uuid; b uuid; o uuid; fi uuid; v uuid; w uuid; j uuid; n int; reg text;
begin
 select id into a from public.profiles where role='advisor' and is_active order by id limit 1;
 select id into b from public.profiles where role='billing_executive' and is_active order by id limit 1;
 select id into o from public.profiles where role='store_team' and is_active order by id limit 1;
 select id into fi from public.profiles where role='final_inspector' and is_active order by id limit 1;
 if a is null or b is null or o is null or fi is null then raise exception 'Test roles missing'; end if;
 for n in 1..3 loop
  reg:='TESTBDATE'||left(replace(gen_random_uuid()::text,'-',''),10);
  insert into public.vehicles(vehicle_no,current_stage,current_status,current_assigned_to) values(reg,'ADVISOR_BILLING','PENDING',a) returning id into v;
  insert into public.workshop_visits(vehicle_id,current_stage,current_status,current_assigned_to) values(v,'ADVISOR_BILLING','PENDING',a) returning id into w;
  insert into public.vehicle_jobs(vehicle_id,job_type,approval_status,current_job_stage,advisor_id) values(v,case when n=3 then 'PAID' else 'INSURANCE' end,'APPROVED','ADVISOR_BILLING',a) returning id into j;
  insert into public.gate_entries(visit_id,vehicle_id,vehicle_number,gate_in_at,recorded_by) values(w,v,reg,now()-interval '3 days',o);
  insert into public.final_inspections(visit_id,vehicle_id,inspection_no,inspected_at,inspected_by,result) values(w,v,1,now()-interval '2 days',fi,'PASSED');
  insert into public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,entered_by,status) values(w,v,'ADVISOR_BILLING',now()-interval '2 days',a,'OPEN');
  insert into billing_date_fixture values(n,v,w,j,a,b,o);
 end loop;
end $$;
create function pg_temp.expect_billing_error(sql text, expected text) returns void language plpgsql as $$
begin
 begin execute sql; exception when others then
  if position(expected in sqlerrm)>0 then return; end if;
  raise exception 'Expected %, got %',expected,sqlerrm;
 end;
 raise exception 'Expected failure: %',expected;
end $$;
set local role authenticated;
do $$
declare f record; r jsonb;
begin
 for f in select * from billing_date_fixture order by n loop
  perform set_config('request.jwt.claim.sub',f.outsider::text,true);
  perform pg_temp.expect_billing_error(format('select public.new_workflow_save_advisor_billing(%L,now(),null,false)',f.w),'Only the assigned Advisor');
  perform set_config('request.jwt.claim.sub',f.advisor::text,true);
  if f.n=3 then
   r:=public.new_workflow_save_advisor_billing(f.w,null,null,true);
   if r->>'success'<>'true' then raise exception 'Paid verification failed'; end if;
  else
   perform pg_temp.expect_billing_error(format('select public.new_workflow_save_advisor_billing(%L,now()-interval ''4 days'',null,false)',f.w),'Gate In');
   perform pg_temp.expect_billing_error(format('select public.new_workflow_save_advisor_billing(%L,null,now()-interval ''4 days'',false)',f.w),'Gate In');
   perform pg_temp.expect_billing_error(format('select public.new_workflow_save_advisor_billing(%L,null,now()+interval ''1 hour'',false)',f.w),'future');
   if f.n=1 then
    -- Liability can be recorded first and have an earlier date.
    r:=public.new_workflow_save_advisor_billing(f.w,null,now()-interval '1 day',false);
    perform pg_temp.expect_billing_error(format('select public.new_workflow_transfer_to_billing(%L,%L,null)',f.w,f.executive),'mandatory');
    r:=public.new_workflow_save_advisor_billing(f.w,now(),now()-interval '1 day',false);
    perform pg_temp.expect_billing_error(format('select public.new_workflow_save_advisor_billing(%L,now()-interval ''1 hour'',null,false)',f.w),'cannot be overwritten');
   else
    r:=public.new_workflow_save_advisor_billing(f.w,now()-interval '1 day',null,false);
    perform pg_temp.expect_billing_error(format('select public.new_workflow_transfer_to_billing(%L,%L,null)',f.w,f.executive),'mandatory');
    r:=public.new_workflow_save_advisor_billing(f.w,now()-interval '1 day',now(),false);
   end if;
   if r->>'success'<>'true' then raise exception 'Independent date save failed'; end if;
  end if;
  r:=public.new_workflow_transfer_to_billing(f.w,f.executive,null);
  if r->>'success'<>'true' then raise exception 'Transfer failed'; end if;
  perform pg_temp.expect_billing_error(format('select public.new_workflow_save_advisor_billing(%L,null,null,false)',f.w),'already been transferred');
 end loop;
end $$;
reset role;
do $$
declare f record; h record;
begin
 for f in select * from billing_date_fixture loop
  select * into h from public.advisor_billing_handoffs where visit_id=f.w;
  if h.transferred_at is null then raise exception 'Missing transfer'; end if;
  if f.n=1 and h.liability_received_at>=h.pre_invoice_sent_at then raise exception 'Liability-first date not preserved'; end if;
  if f.n=2 and h.pre_invoice_sent_at>=h.liability_received_at then raise exception 'Pre-invoice-first date not preserved'; end if;
  if f.n<3 and (select count(*) from public.workflow_events where visit_id=f.w and event_type in ('PRE_INVOICE_SENT','LIABILITY_RECEIVED'))<>2 then raise exception 'Audit events missing/duplicated'; end if;
  if not exists(select 1 from public.workshop_visits where id=f.w and current_stage='BILLING' and current_assigned_to=f.executive)
   or not exists(select 1 from public.vehicles where id=f.v and current_stage='BILLING' and current_assigned_to=f.executive) then raise exception 'Transfer assignment mismatch'; end if;
 end loop;
end $$;
select 'Independent Billing dates, Gate In/future rejection, authorization, immutable history, mandatory steps and onward transfer passed' as result;
rollback;
