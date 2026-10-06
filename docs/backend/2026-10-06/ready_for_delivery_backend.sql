-- Advisor delivery clearance after completed Billing.
alter table public.ready_for_delivery enable row level security;
revoke insert,update,delete on public.ready_for_delivery from anon,authenticated;
grant select on public.ready_for_delivery to authenticated;
create policy delivery_clearance_read on public.ready_for_delivery for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and
 (p.role in ('ceo_admin','watchman') or (p.role='advisor' and exists(select 1 from public.advisor_billing_handoffs h join public.vehicle_jobs j on j.id=h.job_id where h.visit_id=ready_for_delivery.visit_id and j.advisor_id=p.id))))
);

create or replace function public.new_workflow_ready_for_delivery_queue()
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare u uuid:=auth.uid(); r text; items jsonb;
begin
 select role into r from public.profiles where id=u and is_active;
 if u is null or r is null or r not in ('advisor','ceo_admin') then raise exception 'Only an active Advisor or CEO Admin can review delivery clearance.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'visit_id',w.id,'vehicle_no',v.vehicle_no,'model',coalesce(j.vehicle_model_snapshot,v.model),'stage',w.current_stage,
  'customer_name',coalesce(nullif(i.customer_name,''),nullif(j.customer_name_snapshot,''),v.customer_name),
  'customer_mobile',coalesce(nullif(i.customer_mobile,''),nullif(j.customer_mobile_snapshot,''),v.customer_mobile),
  'job_type',j.job_type,'job_card_no',coalesce(i.job_card_no,j.job_card_no),'advisor_name',advisor.name,
  'bill_no',b.bill_no,'tax_invoice_no',b.tax_invoice_no,'invoice_amount',b.invoice_amount,'liability_amount',b.liability_amount,
  'customer_difference_amount',b.customer_difference_amount,'advance_amount',coalesce(b.advance_amount,0),
  'billing_collected',coalesce(pay.total,0),'customer_balance',case when b.invoice_amount is null then null else (case when j.job_type='PAID' then b.invoice_amount-coalesce(b.advance_amount,0) else b.customer_difference_amount end)-coalesce(pay.total,0) end,
  'billing_completed_at',b.completed_at,'billing_completed_by',executive.name,
  'inspection_result',fi.result,'inspection_at',fi.inspected_at,'inspection_remarks',fi.remarks,
  'generated_at',(select min(completed_at) from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED'),
  'sent_at',(select min(completed_at) from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_SENT'),
  'cleared_at',ready.marked_ready_at,'cleared_by',cleared.name,'clearance_remarks',ready.remarks
 ) order by coalesce(ready.marked_ready_at,b.completed_at,w.stage_started_at)),'[]'::jsonb) into items
 from public.workshop_visits w join public.vehicles v on v.id=w.vehicle_id
 join public.advisor_billing_handoffs h on h.visit_id=w.id
 join public.vehicle_jobs j on j.id=h.job_id
 join public.profiles advisor on advisor.id=j.advisor_id
 left join public.billing_records b on b.id=h.billing_record_id and b.visit_id=w.id
 left join public.profiles executive on executive.id=b.completed_by
 left join public.ready_for_delivery ready on ready.visit_id=w.id
 left join public.profiles cleared on cleared.id=ready.marked_by
 left join lateral(select * from public.vehicle_intake where visit_id=w.id order by completed_at desc nulls last,created_at desc limit 1) i on true
 left join lateral(select result,inspected_at,remarks from public.final_inspections where visit_id=w.id order by inspection_no desc limit 1) fi on true
 left join lateral(select sum(amount) total from public.payments where billing_record_id=b.id) pay on true
 where w.closed_at is null and w.current_stage in ('READY_FOR_DELIVERY','PENDING_GATE_OUT') and w.current_status in ('PENDING','IN_PROGRESS')
 and (r='ceo_admin' or j.advisor_id=u);
 return jsonb_build_object('role',r,'items',items);
end; $fn$;

create or replace function public.new_workflow_mark_ready_for_delivery(p_visit_id uuid,p_review_confirmed boolean,p_remarks text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare u uuid:=auth.uid(); r text; w public.workshop_visits%rowtype; h public.advisor_billing_handoffs%rowtype; j public.vehicle_jobs%rowtype; b public.billing_records%rowtype; due numeric; paid numeric; t timestamptz:=now(); ready_id uuid;
begin
 select role into r from public.profiles where id=u and is_active;
 if u is null or r is null or r not in ('advisor','ceo_admin') then raise exception 'Only the assigned Advisor or CEO Admin can clear delivery.'; end if;
 if p_review_confirmed is distinct from true then raise exception 'Confirm that you reviewed the vehicle, inspection, invoice and payment details.'; end if;
 if length(coalesce(p_remarks,''))>1000 then raise exception 'Delivery remarks must be at most 1000 characters.'; end if;
 select * into w from public.workshop_visits where id=p_visit_id for update;
 if not found or w.closed_at is not null or w.current_stage<>'READY_FOR_DELIVERY' or w.current_status not in ('PENDING','IN_PROGRESS') then raise exception 'This vehicle is no longer awaiting Advisor delivery clearance.'; end if;
 select * into h from public.advisor_billing_handoffs where visit_id=w.id;
 if not found or h.transferred_at is null then raise exception 'Advisor Billing handoff is missing.'; end if;
 select * into j from public.vehicle_jobs where id=h.job_id for update;
 if not found or j.vehicle_id<>w.vehicle_id or j.current_job_stage='CLOSED' then raise exception 'Active job conflict.'; end if;
 if r='advisor' and j.advisor_id is distinct from u then raise exception 'This vehicle is not assigned to you.'; end if;
 if w.current_assigned_to is distinct from j.advisor_id or not exists(select 1 from public.vehicle_assignments where visit_id=w.id and assignment_role='ADVISOR' and assigned_to=j.advisor_id and unassigned_at is null) then raise exception 'Advisor delivery assignment conflict.'; end if;
 select * into b from public.billing_records where id=h.billing_record_id and visit_id=w.id for update;
 if not found or b.completed_at is null or b.completed_by is null or b.billing_type<>j.job_type then raise exception 'Complete Billing before delivery clearance.'; end if;
 if nullif(btrim(b.bill_no),'') is null or nullif(btrim(b.tax_invoice_no),'') is null or not exists(select 1 from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED') then raise exception 'Generated invoice details are incomplete.'; end if;
 if b.billing_type='INSURANCE' and not exists(select 1 from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_SENT') then raise exception 'Insurance tax invoice sent must be recorded.'; end if;
 due:=case when b.billing_type='PAID' then b.invoice_amount-coalesce(b.advance_amount,0) else b.customer_difference_amount end;
 select coalesce(sum(amount),0) into paid from public.payments where billing_record_id=b.id;
 if due is null or due::text in ('NaN','Infinity','-Infinity') or due<0 or paid<>due then raise exception 'The full customer balance must be settled before delivery clearance.'; end if;
 if (select result from public.final_inspections where visit_id=w.id order by inspection_no desc limit 1) is distinct from 'PASSED' then raise exception 'Passed Final Inspection is required before delivery clearance.'; end if;
 if exists(select 1 from public.ready_for_delivery where visit_id=w.id) or exists(select 1 from public.gate_exits where visit_id=w.id) then raise exception 'Delivery clearance has already been recorded for this visit.'; end if;
 insert into public.ready_for_delivery(visit_id,vehicle_id,marked_ready_at,marked_by,remarks) values(w.id,w.vehicle_id,t,u,nullif(btrim(p_remarks),'')) returning id into ready_id;
 update public.vehicle_assignments set unassigned_at=t where visit_id=w.id and assignment_role='ADVISOR' and unassigned_at is null;
 update public.workflow_stage_history set exited_at=t,exited_by=u,status='COMPLETED' where visit_id=w.id and stage='READY_FOR_DELIVERY' and status='OPEN';
 insert into public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,entered_by,status,remarks) values(w.id,w.vehicle_id,'PENDING_GATE_OUT',t,u,'OPEN','Advisor delivery clearance completed. Awaiting Watchman Gate Out.');
 update public.workshop_visits set current_stage='PENDING_GATE_OUT',current_status='PENDING',current_assigned_to=null,stage_started_at=t,updated_at=t where id=w.id;
 update public.vehicles set current_stage='PENDING_GATE_OUT',current_status='PENDING',current_assigned_to=null,stage_started_at=t,updated_at=t where id=w.vehicle_id;
 update public.vehicle_jobs set current_job_stage='PENDING_GATE_OUT',updated_at=t where id=j.id;
 insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,remarks,metadata)
 values(w.id,w.vehicle_id,'READY_FOR_DELIVERY_MARKED','READY_FOR_DELIVERY','PENDING_GATE_OUT',w.current_status,'PENDING',u,t,nullif(btrim(p_remarks),''),jsonb_build_object('ready_for_delivery_id',ready_id,'job_id',j.id,'billing_record_id',b.id,'review_confirmed',true,'performed_role',r));
 return jsonb_build_object('success',true,'visit_id',w.id,'stage','PENDING_GATE_OUT','marked_ready_at',t);
end; $fn$;
revoke all on function public.new_workflow_ready_for_delivery_queue(),public.new_workflow_mark_ready_for_delivery(uuid,boolean,text) from public,anon;
grant execute on function public.new_workflow_ready_for_delivery_queue(),public.new_workflow_mark_ready_for_delivery(uuid,boolean,text) to authenticated;
