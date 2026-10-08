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
declare f record; r jsonb; d jsonb; pay numeric;
begin
 for f in select * from billing_date_fixture order by n loop
  perform set_config('request.jwt.claim.sub',f.advisor::text,true);
  if f.n=3 then
   perform public.new_workflow_save_advisor_billing(f.w,null,null,true);
  else
   perform public.new_workflow_save_advisor_billing(f.w,now()-interval '1 day',now()-interval '2 days',false);
  end if;
  perform public.new_workflow_transfer_to_billing(f.w,f.executive,null);
 end loop;
end $$;
reset role;
-- Preserve an existing legacy value while the current client omits it.
update public.billing_records b set bill_no='LEGACY-KEEP' from billing_date_fixture f where b.visit_id=f.w and f.n=2;
-- Paid advance remains deducted independently of the removed number.
update public.billing_records b set advance_amount=20 from billing_date_fixture f where b.visit_id=f.w and f.n=3;
set local role authenticated;
do $$
declare f record; r jsonb; d jsonb; pay numeric;
begin
 for f in select * from billing_date_fixture order by n loop
  perform set_config('request.jwt.claim.sub',f.outsider::text,true);
  perform pg_temp.expect_billing_error(format('select public.new_workflow_save_billing_invoice(%L,%L::jsonb)',f.w,'{}'),'Only the assigned Billing Executive');
  perform set_config('request.jwt.claim.sub',f.executive::text,true);
  d:=jsonb_build_object('tax_invoice_no','INV-'||f.n,'invoice_amount',100,'liability_amount',case when f.n<3 then 60 else null end);
  perform public.new_workflow_save_billing_invoice(f.w,d);
  perform pg_temp.expect_billing_error(format('select public.new_workflow_complete_billing(%L)',f.w),'Complete invoice generation');
  perform pg_temp.expect_billing_error(format('select public.new_workflow_save_billing_invoice(%L,%L::jsonb)',f.w,(d-'tax_invoice_no')||jsonb_build_object('generated_at',now())),'Tax invoice number is required');
  d:=d||jsonb_build_object('generated_at',now());
  r:=public.new_workflow_save_billing_invoice(f.w,d);
  if r->>'success'<>'true' then raise exception 'Invoice generation without Internal Bill No failed'; end if;
  -- Retry unchanged generated details, while legacy bill value stays untouched.
  perform public.new_workflow_save_billing_invoice(f.w,d);
  perform pg_temp.expect_billing_error(format('select public.new_workflow_save_billing_invoice(%L,%L::jsonb)',f.w,d||jsonb_build_object('tax_invoice_no','OVERWRITE')),'cannot be overwritten');
  if f.n<3 then
   perform pg_temp.expect_billing_error(format('select public.new_workflow_complete_billing(%L)',f.w),'tax invoice sent');
   d:=d||jsonb_build_object('sent_at',now());
   perform public.new_workflow_save_billing_invoice(f.w,d);
  end if;
  perform pg_temp.expect_billing_error(format('select public.new_workflow_complete_billing(%L)',f.w),'full customer balance');
  pay:=case when f.n<3 then 40 else 80 end;
  perform public.new_workflow_record_billing_payment(f.w,gen_random_uuid(),'CASH',pay,now(),null,null);
  r:=public.new_workflow_complete_billing(f.w);
  if r->>'stage'<>'READY_FOR_DELIVERY' then raise exception 'Billing completion without Internal Bill No failed'; end if;
  perform set_config('request.jwt.claim.sub',f.advisor::text,true);
  r:=public.new_workflow_mark_ready_for_delivery(f.w,true,null);
  if r->>'stage'<>'PENDING_GATE_OUT' then raise exception 'Delivery clearance without Internal Bill No failed'; end if;
 end loop;
end $$;
reset role;
do $$
declare f record; b record;
begin
 for f in select * from billing_date_fixture loop
  select * into b from public.billing_records where visit_id=f.w;
  if f.n=2 and b.bill_no is distinct from 'LEGACY-KEEP' then raise exception 'Historical Bill No changed'; end if;
  if f.n<>2 and b.bill_no is not null then raise exception 'Unexpected fabricated Bill No'; end if;
  if f.n=3 and b.advance_amount<>20 then raise exception 'Advance changed'; end if;
  if not exists(select 1 from public.workshop_visits where id=f.w and current_stage='PENDING_GATE_OUT' and current_assigned_to is null)
   or not exists(select 1 from public.vehicles where id=f.v and current_stage='PENDING_GATE_OUT' and current_assigned_to is null)
   or not exists(select 1 from public.vehicle_jobs where id=f.j and current_job_stage='PENDING_GATE_OUT')
   then raise exception 'Delivery state mismatch'; end if;
  if (select count(*) from public.workflow_stage_history where visit_id=f.w and status='OPEN')<>1 then raise exception 'Stage history mismatch'; end if;
 end loop;
end $$;
select 'Paid/Insurance invoice, mandatory tax invoice, immutable history, preserved legacy bill number, advance/difference payment, completion and delivery clearance passed' as result;
rollback;
