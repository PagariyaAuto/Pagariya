CREATE OR REPLACE FUNCTION public.new_workflow_save_billing_invoice(p_visit_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c jsonb; b public.billing_records%rowtype; u uuid:=auth.uid(); t timestamptz:=now(); invoice text; amount numeric; liability numeric; difference numeric; generated timestamptz; sent timestamptz; old_generated timestamptz; old_sent timestamptz; advance numeric; survey public.surveys%rowtype;
begin
 c:=pagariya_workflow_private.billing_context(p_visit_id);
 select * into b from public.billing_records where id=(c->'billing'->>'id')::uuid;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invoice details are required.'; end if;
 invoice:=nullif(btrim(p_data->>'tax_invoice_no'),'');
 amount:=nullif(p_data->>'invoice_amount','')::numeric;
 liability:=case when b.billing_type='INSURANCE' then nullif(p_data->>'liability_amount','')::numeric else null end;
 if amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<0 or amount>999999999999 or round(amount,2)<>amount then raise exception 'Enter a valid invoice amount with up to two decimal places.'; end if;
 if b.billing_type='INSURANCE' and (liability is null or liability::text in ('NaN','Infinity','-Infinity') or liability<0 or liability>amount or round(liability,2)<>liability) then raise exception 'Liability must be between zero and the invoice amount.'; end if;
 select * into survey from public.surveys where visit_id=p_visit_id and survey_type='INITIAL' and completed_at is not null order by survey_no desc limit 1;
 advance:=case when b.billing_type='PAID' then coalesce(b.advance_amount,survey.paid_amount,0) else 0 end;
 if advance::text in ('NaN','Infinity','-Infinity') or advance<0 or round(advance,2)<>advance or advance>amount then raise exception 'Survey advance must be valid and cannot exceed the invoice amount. Contact the Advisor to resolve the discrepancy.'; end if;
 difference:=case when b.billing_type='INSURANCE' then amount-liability else null end;
 if length(invoice)>100 then raise exception 'Tax invoice number must be at most 100 characters.'; end if;
 generated:=nullif(p_data->>'generated_at','')::timestamptz; sent:=nullif(p_data->>'sent_at','')::timestamptz;
 select min(completed_at) into old_generated from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED';
 select min(completed_at) into old_sent from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_SENT';
 if old_generated is not null then
  if invoice is distinct from b.tax_invoice_no or amount is distinct from b.invoice_amount or liability is distinct from b.liability_amount then raise exception 'Generated invoice details cannot be overwritten.'; end if;
  if generated is not null and generated<>old_generated then raise exception 'Generated date cannot be overwritten.'; end if;
 end if;
 if old_sent is not null and sent is not null and sent<>old_sent then raise exception 'Sent date cannot be overwritten.'; end if;
 generated:=coalesce(old_generated,generated); sent:=coalesce(old_sent,sent);
 if generated is not null and invoice is null then raise exception 'Tax invoice number is required before generation.'; end if;
 if generated>t or sent>t then raise exception 'Invoice dates cannot be in the future.'; end if;
 if generated is not null and b.billing_type='INSURANCE' and (c->'handoff'->>'liability_received_at' is null or generated<(c->'handoff'->>'liability_received_at')::timestamptz) then raise exception 'Generate the tax invoice after liability is received.'; end if;
 if b.billing_type='PAID' and sent is not null then raise exception 'Invoice-sent tracking is only required for Insurance jobs.'; end if;
 if sent is not null and (generated is null or sent<generated) then raise exception 'Record tax invoice generation before sending it.'; end if;
 update public.billing_records set advance_amount=advance,advance_reference=case when b.billing_type='PAID' then coalesce(b.advance_reference,survey.receipt_reference_no) else null end,advance_survey_id=case when b.billing_type='PAID' then coalesce(b.advance_survey_id,survey.id) else null end,tax_invoice_no=invoice,invoice_amount=amount,liability_amount=liability,customer_difference_amount=difference,updated_at=t where id=b.id;
 if old_generated is null and generated is not null then
  insert into public.billing_steps(billing_record_id,step_code,completed_at,completed_by) values(b.id,'TAX_INVOICE_GENERATED',generated,u);
  insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,performed_by,performed_at,metadata) values(p_visit_id,b.vehicle_id,'TAX_INVOICE_GENERATED','BILLING','BILLING',u,t,jsonb_build_object('occurred_at',generated,'billing_record_id',b.id));
 end if;
 if old_sent is null and sent is not null then
  insert into public.billing_steps(billing_record_id,step_code,completed_at,completed_by) values(b.id,'TAX_INVOICE_SENT',sent,u);
  insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,performed_by,performed_at,metadata) values(p_visit_id,b.vehicle_id,'TAX_INVOICE_SENT','BILLING','BILLING',u,t,jsonb_build_object('occurred_at',sent,'billing_record_id',b.id));
 end if;
 insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,performed_by,performed_at,metadata) values(p_visit_id,b.vehicle_id,'BILLING_INVOICE_SAVED','BILLING','BILLING',u,t,jsonb_build_object('billing_record_id',b.id,'before',to_jsonb(b),'after',p_data));
 update public.workshop_visits set current_status='IN_PROGRESS',updated_at=t where id=p_visit_id;
 update public.vehicles set current_status='IN_PROGRESS',updated_at=t where id=b.vehicle_id;
 return jsonb_build_object('success',true);
end; $function$;

CREATE OR REPLACE FUNCTION public.new_workflow_complete_billing(p_visit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c jsonb; b public.billing_records%rowtype; u uuid:=auth.uid(); t timestamptz:=now(); a uuid; due numeric; paid numeric;
begin
 c:=pagariya_workflow_private.billing_context(p_visit_id);
 select * into b from public.billing_records where id=(c->'billing'->>'id')::uuid;
 if nullif(btrim(b.tax_invoice_no),'') is null or not exists(select 1 from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED') then raise exception 'Complete invoice generation first.'; end if;
 if b.billing_type='INSURANCE' and not exists(select 1 from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_SENT') then raise exception 'Record tax invoice sent before completing Insurance Billing.'; end if;
 due:=case when b.billing_type='PAID' then b.invoice_amount-coalesce(b.advance_amount,0) else b.customer_difference_amount end;
 select coalesce(sum(amount),0) into paid from public.payments where billing_record_id=b.id;
 if due is null or paid<>due then raise exception 'Collect the full customer balance before returning to the Advisor.'; end if;
 a:=(c->'job'->>'advisor_id')::uuid;
 if not exists(select 1 from public.profiles where id=a and is_active and role='advisor') then raise exception 'The assigned Advisor is inactive. Contact CEO Admin.'; end if;
 update public.billing_records set completed_at=t,completed_by=u,updated_at=t where id=b.id;
 update public.vehicle_assignments set unassigned_at=t where visit_id=p_visit_id and assignment_role='BILLING' and unassigned_at is null;
 insert into public.vehicle_assignments(visit_id,vehicle_id,assigned_to,assigned_by,assignment_role,assigned_at,remarks) values(p_visit_id,b.vehicle_id,a,u,'ADVISOR',t,'Billing completed; awaiting Advisor delivery clearance.');
 update public.workflow_stage_history set exited_at=t,exited_by=u,status='COMPLETED' where visit_id=p_visit_id and stage='BILLING' and status='OPEN';
 insert into public.workflow_stage_history(visit_id,vehicle_id,stage,entered_at,entered_by,status,remarks) values(p_visit_id,b.vehicle_id,'READY_FOR_DELIVERY',t,u,'OPEN','Awaiting Advisor delivery clearance.');
 update public.workshop_visits set current_stage='READY_FOR_DELIVERY',current_status='PENDING',current_assigned_to=a,stage_started_at=t,updated_at=t where id=p_visit_id;
 update public.vehicles set current_stage='READY_FOR_DELIVERY',current_status='PENDING',current_assigned_to=a,stage_started_at=t,updated_at=t where id=b.vehicle_id;
 update public.vehicle_jobs set current_job_stage='READY_FOR_DELIVERY',updated_at=t where id=(c->'job'->>'id')::uuid;
 insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,status_before,status_after,performed_by,performed_at,metadata) values(p_visit_id,b.vehicle_id,'BILLING_COMPLETED','BILLING','READY_FOR_DELIVERY',c->'visit'->>'current_status','PENDING',u,t,jsonb_build_object('billing_record_id',b.id,'assigned_to',a,'awaiting_advisor_clearance',true));
 return jsonb_build_object('success',true,'stage','READY_FOR_DELIVERY','assigned_to',a);
end; $function$;

CREATE OR REPLACE FUNCTION public.new_workflow_mark_ready_for_delivery(p_visit_id uuid, p_review_confirmed boolean, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if nullif(btrim(b.tax_invoice_no),'') is null or not exists(select 1 from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED') then raise exception 'Generated invoice details are incomplete.'; end if;
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
end; $function$;
