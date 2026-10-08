-- Billing Executive workflow. Advisor remains responsible for delivery clearance.
alter table public.billing_records add column if not exists advance_amount numeric;
alter table public.billing_records add column if not exists advance_reference text;
alter table public.billing_records add column if not exists advance_survey_id uuid references public.surveys(id);
alter table public.billing_records add column if not exists completed_at timestamptz;
alter table public.billing_records add column if not exists completed_by uuid references public.profiles(id);
alter table public.payments add column if not exists client_request_id uuid;
create unique index if not exists payments_client_request_id_key on public.payments(client_request_id) where client_request_id is not null;

create or replace function pagariya_workflow_private.billing_context(p_visit_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare u uuid:=auth.uid(); r text; w public.workshop_visits%rowtype; b public.billing_records%rowtype; h public.advisor_billing_handoffs%rowtype; j public.vehicle_jobs%rowtype;
begin
 select role into r from public.profiles where id=u and is_active;
 if u is null or r is null or r not in ('billing_executive','ceo_admin') then raise exception 'Only the assigned Billing Executive or CEO Admin can process Billing.'; end if;
 select * into w from public.workshop_visits where id=p_visit_id for update;
 if not found or w.closed_at is not null or w.current_stage<>'BILLING' or w.current_status not in ('PENDING','IN_PROGRESS') then raise exception 'This vehicle is no longer in the Billing queue.'; end if;
 select * into h from public.advisor_billing_handoffs where visit_id=w.id;
 if not found or h.transferred_at is null then raise exception 'Advisor handoff is missing.'; end if;
 if w.current_assigned_to is distinct from h.billing_executive_id or not exists(select 1 from public.vehicle_assignments where visit_id=w.id and assignment_role='BILLING' and assigned_to=h.billing_executive_id and unassigned_at is null) then raise exception 'Billing assignment conflict.'; end if;
 if r='billing_executive' and w.current_assigned_to is distinct from u then raise exception 'This vehicle is not assigned to you.'; end if;
 select * into j from public.vehicle_jobs where id=h.job_id for update;
 if not found or j.vehicle_id<>w.vehicle_id or j.current_job_stage='CLOSED' then raise exception 'Active job conflict.'; end if;
 if (select result from public.final_inspections where visit_id=w.id order by inspection_no desc limit 1) is distinct from 'PASSED' then raise exception 'Passed Final Inspection is required.'; end if;
 select * into b from public.billing_records where id=h.billing_record_id and visit_id=w.id for update;
 if not found or b.completed_at is not null or b.billing_type<>j.job_type then raise exception 'Billing record conflict.'; end if;
 return jsonb_build_object('visit',to_jsonb(w),'billing',to_jsonb(b),'handoff',to_jsonb(h),'job',to_jsonb(j));
end; $fn$;
revoke all on function pagariya_workflow_private.billing_context(uuid) from public,anon,authenticated;

create or replace function pagariya_workflow_private.can_read_billing(p_visit_id uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.profiles p join public.advisor_billing_handoffs h on h.visit_id=p_visit_id join public.vehicle_jobs j on j.id=h.job_id
 where p.id=auth.uid() and p.is_active and (p.role='ceo_admin' or (p.role='advisor' and j.advisor_id=p.id) or (p.role='billing_executive' and h.billing_executive_id=p.id)));
$fn$;
revoke all on function pagariya_workflow_private.can_read_billing(uuid) from public,anon;
grant execute on function pagariya_workflow_private.can_read_billing(uuid) to authenticated;
-- Preserve previous read compatibility for records predating the Advisor handoff,
-- while limiting new Billing records to their participants.
create policy billing_records_participant_guard on public.billing_records as restrictive for select to authenticated using (
 not exists(select 1 from public.advisor_billing_handoffs h where h.billing_record_id=billing_records.id)
 or pagariya_workflow_private.can_read_billing(visit_id));
create policy billing_steps_participant_guard on public.billing_steps as restrictive for select to authenticated using (
 exists(select 1 from public.billing_records b where b.id=billing_record_id));
create policy payments_participant_guard on public.payments as restrictive for select to authenticated using (
 exists(select 1 from public.billing_records b where b.id=billing_record_id));

create or replace function public.new_workflow_billing_queue()
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare u uuid:=auth.uid(); r text; items jsonb;
begin
 select role into r from public.profiles where id=u and is_active;
 if u is null or r is null or r not in ('billing_executive','ceo_admin') then raise exception 'Only Billing Executive or CEO Admin can view this queue.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'visit_id',w.id,'vehicle_no',v.vehicle_no,'model',coalesce(j.vehicle_model_snapshot,v.model),
  'customer_name',coalesce(nullif(i.customer_name,''),nullif(j.customer_name_snapshot,''),v.customer_name),
  'customer_mobile',coalesce(nullif(i.customer_mobile,''),nullif(j.customer_mobile_snapshot,''),v.customer_mobile),
  'job_card_no',coalesce(i.job_card_no,j.job_card_no),'job_type',b.billing_type,'advisor_name',advisor.name,
  'assigned_at',h.transferred_at,'handoff_remarks',assignment.remarks,'billing',to_jsonb(b),
  'pre_invoice_sent_at',h.pre_invoice_sent_at,'liability_received_at',h.liability_received_at,
  'generated_at',(select min(completed_at) from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED'),
  'sent_at',(select min(completed_at) from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_SENT'),
  'advance_amount',case when b.billing_type='PAID' then coalesce(b.advance_amount,survey.paid_amount,0) else 0 end,'advance_reference',coalesce(b.advance_reference,survey.receipt_reference_no),'paid_amount',coalesce(pay.total,0),'amount_due',case when b.invoice_amount is null then null else greatest(0,(case when b.billing_type='PAID' then b.invoice_amount-coalesce(b.advance_amount,survey.paid_amount,0) else b.customer_difference_amount end)-coalesce(pay.total,0)) end,
  'payments',coalesce(pay.items,'[]'::jsonb)
 ) order by h.transferred_at),'[]'::jsonb) into items
 from public.workshop_visits w join public.vehicles v on v.id=w.vehicle_id
 join public.advisor_billing_handoffs h on h.visit_id=w.id and h.transferred_at is not null
 join public.billing_records b on b.id=h.billing_record_id and b.visit_id=w.id
 join public.vehicle_jobs j on j.id=h.job_id join public.profiles advisor on advisor.id=j.advisor_id
 join lateral(select remarks from public.vehicle_assignments where visit_id=w.id and assignment_role='BILLING' and assigned_to=w.current_assigned_to and unassigned_at is null order by assigned_at desc limit 1) assignment on true
 left join lateral(select * from public.vehicle_intake where visit_id=w.id order by completed_at desc nulls last,created_at desc limit 1) i on true
 left join lateral(select id,paid_amount,receipt_reference_no from public.surveys where visit_id=w.id and survey_type='INITIAL' and completed_at is not null order by survey_no desc limit 1) survey on true
 left join lateral(select sum(p.amount) total,jsonb_agg(to_jsonb(p)||jsonb_build_object('proof_path',photo.storage_path) order by p.payment_at) items from public.payments p left join public.vehicle_photos photo on photo.id=p.payment_proof_photo_id where p.billing_record_id=b.id) pay on true
 where w.closed_at is null and w.current_stage='BILLING' and w.current_status in ('PENDING','IN_PROGRESS') and b.completed_at is null
 and w.current_assigned_to=h.billing_executive_id and (r='ceo_admin' or w.current_assigned_to=u);
 return jsonb_build_object('role',r,'items',items);
end; $fn$;

create or replace function public.new_workflow_save_billing_invoice(p_visit_id uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c jsonb; b public.billing_records%rowtype; u uuid:=auth.uid(); t timestamptz:=now(); bill text; invoice text; amount numeric; liability numeric; difference numeric; generated timestamptz; sent timestamptz; old_generated timestamptz; old_sent timestamptz; advance numeric; survey public.surveys%rowtype;
begin
 c:=pagariya_workflow_private.billing_context(p_visit_id);
 select * into b from public.billing_records where id=(c->'billing'->>'id')::uuid;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invoice details are required.'; end if;
 bill:=nullif(btrim(p_data->>'bill_no'),''); invoice:=nullif(btrim(p_data->>'tax_invoice_no'),'');
 amount:=nullif(p_data->>'invoice_amount','')::numeric;
 liability:=case when b.billing_type='INSURANCE' then nullif(p_data->>'liability_amount','')::numeric else null end;
 if amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<0 or amount>999999999999 or round(amount,2)<>amount then raise exception 'Enter a valid invoice amount with up to two decimal places.'; end if;
 if b.billing_type='INSURANCE' and (liability is null or liability::text in ('NaN','Infinity','-Infinity') or liability<0 or liability>amount or round(liability,2)<>liability) then raise exception 'Liability must be between zero and the invoice amount.'; end if;
 select * into survey from public.surveys where visit_id=p_visit_id and survey_type='INITIAL' and completed_at is not null order by survey_no desc limit 1;
 advance:=case when b.billing_type='PAID' then coalesce(b.advance_amount,survey.paid_amount,0) else 0 end;
 if advance::text in ('NaN','Infinity','-Infinity') or advance<0 or round(advance,2)<>advance or advance>amount then raise exception 'Survey advance must be valid and cannot exceed the invoice amount. Contact the Advisor to resolve the discrepancy.'; end if;
 difference:=case when b.billing_type='INSURANCE' then amount-liability else null end;
 if length(bill)>100 or length(invoice)>100 then raise exception 'Bill and tax invoice numbers must be at most 100 characters.'; end if;
 generated:=nullif(p_data->>'generated_at','')::timestamptz; sent:=nullif(p_data->>'sent_at','')::timestamptz;
 select min(completed_at) into old_generated from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED';
 select min(completed_at) into old_sent from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_SENT';
 if old_generated is not null then
  if bill is distinct from b.bill_no or invoice is distinct from b.tax_invoice_no or amount is distinct from b.invoice_amount or liability is distinct from b.liability_amount then raise exception 'Generated invoice details cannot be overwritten.'; end if;
  if generated is not null and generated<>old_generated then raise exception 'Generated date cannot be overwritten.'; end if;
 end if;
 if old_sent is not null and sent is not null and sent<>old_sent then raise exception 'Sent date cannot be overwritten.'; end if;
 generated:=coalesce(old_generated,generated); sent:=coalesce(old_sent,sent);
 if generated is not null and (bill is null or invoice is null) then raise exception 'Internal Bill No. and tax invoice number are required before generation.'; end if;
 if generated>t or sent>t then raise exception 'Invoice dates cannot be in the future.'; end if;
 if generated is not null and b.billing_type='INSURANCE' and (c->'handoff'->>'liability_received_at' is null or generated<(c->'handoff'->>'liability_received_at')::timestamptz) then raise exception 'Generate the tax invoice after liability is received.'; end if;
 if b.billing_type='PAID' and sent is not null then raise exception 'Invoice-sent tracking is only required for Insurance jobs.'; end if;
 if sent is not null and (generated is null or sent<generated) then raise exception 'Record tax invoice generation before sending it.'; end if;
 update public.billing_records set advance_amount=advance,advance_reference=case when b.billing_type='PAID' then coalesce(b.advance_reference,survey.receipt_reference_no) else null end,advance_survey_id=case when b.billing_type='PAID' then coalesce(b.advance_survey_id,survey.id) else null end,bill_no=bill,tax_invoice_no=invoice,invoice_amount=amount,liability_amount=liability,customer_difference_amount=difference,updated_at=t where id=b.id;
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
end; $fn$;

-- Separate private payment-proof bucket; paths are visit/user/file.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('billing-proofs','billing-proofs',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create or replace function pagariya_workflow_private.can_upload_billing_proof(p_path text)
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.workshop_visits w join public.profiles p on p.id=auth.uid() join public.advisor_billing_handoffs h on h.visit_id=w.id
 where w.id::text=split_part(p_path,'/',1) and split_part(p_path,'/',2)=p.id::text and split_part(p_path,'/',3)<>'' and split_part(p_path,'/',4)=''
 and p.is_active and p.role in ('billing_executive','ceo_admin') and w.current_stage='BILLING' and w.closed_at is null and h.transferred_at is not null
 and w.current_assigned_to=h.billing_executive_id and (p.role='ceo_admin' or w.current_assigned_to=p.id));
$fn$;
create or replace function pagariya_workflow_private.can_read_billing_proof(p_path text)
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.workshop_visits w where w.id::text=split_part(p_path,'/',1) and pagariya_workflow_private.can_read_billing(w.id));
$fn$;
revoke all on function pagariya_workflow_private.can_upload_billing_proof(text),pagariya_workflow_private.can_read_billing_proof(text) from public,anon;
grant execute on function pagariya_workflow_private.can_upload_billing_proof(text),pagariya_workflow_private.can_read_billing_proof(text) to authenticated;
create policy billing_proof_upload on storage.objects for insert to authenticated with check(bucket_id='billing-proofs' and pagariya_workflow_private.can_upload_billing_proof(name));
create policy billing_proof_read on storage.objects for select to authenticated using(bucket_id='billing-proofs' and pagariya_workflow_private.can_read_billing_proof(name));
create policy billing_proof_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'billing-proofs' or pagariya_workflow_private.can_read_billing_proof(name));
create policy billing_proof_write_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'billing-proofs' or pagariya_workflow_private.can_upload_billing_proof(name));
create policy billing_proof_no_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'billing-proofs') with check(bucket_id<>'billing-proofs');
create policy billing_proof_no_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'billing-proofs');

create or replace function public.new_workflow_record_billing_payment(p_visit_id uuid,p_request_id uuid,p_mode text,p_amount numeric,p_payment_at timestamptz,p_utr text default null,p_proof_path text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c jsonb; b public.billing_records%rowtype; old public.payments%rowtype; u uuid:=auth.uid(); t timestamptz:=now(); due numeric; paid numeric; proof uuid; payment uuid; generated timestamptz;
begin
 c:=pagariya_workflow_private.billing_context(p_visit_id);
 select * into b from public.billing_records where id=(c->'billing'->>'id')::uuid;
 if p_request_id is null then raise exception 'A payment request ID is required.'; end if;
 select * into old from public.payments where client_request_id=p_request_id;
 if found then
  if old.visit_id<>p_visit_id or old.recorded_by<>u or old.payment_mode is distinct from p_mode or old.amount is distinct from p_amount or old.payment_at is distinct from p_payment_at or old.utr_no is distinct from nullif(btrim(p_utr),'') then raise exception 'Payment request conflict.'; end if;
  return jsonb_build_object('success',true,'payment_id',old.id,'already_recorded',true);
 end if;
 select min(completed_at) into generated from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED';
 if generated is null then raise exception 'Generate the tax invoice before recording payment.'; end if;
 if p_mode is null or p_mode not in ('CASH','ONLINE') then raise exception 'Select Cash or Online.'; end if;
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or round(p_amount,2)<>p_amount then raise exception 'Enter a positive payment amount with up to two decimal places.'; end if;
 if p_payment_at is null or p_payment_at>t or p_payment_at<generated then raise exception 'Payment date must be after invoice generation and not in the future.'; end if;
 due:=case when b.billing_type='PAID' then b.invoice_amount-coalesce(b.advance_amount,0) else b.customer_difference_amount end;
 select coalesce(sum(amount),0) into paid from public.payments where billing_record_id=b.id;
 if due is null or p_amount>due-paid then raise exception 'Payment exceeds the remaining customer balance.'; end if;
 if p_mode='ONLINE' then
  if nullif(btrim(p_utr),'') is null or length(p_utr)>100 then raise exception 'A valid UTR is required for Online payment.'; end if;
  if p_proof_path is null or split_part(p_proof_path,'/',1)<>p_visit_id::text or split_part(p_proof_path,'/',2)<>u::text then raise exception 'Upload payment proof for this vehicle.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='billing-proofs' and name=p_proof_path and owner_id=u::text) then raise exception 'The uploaded payment proof could not be verified.'; end if;
  if exists(select 1 from public.vehicle_photos where storage_path='billing-proofs/'||p_proof_path) then raise exception 'Payment proof has already been used.'; end if;
  insert into public.vehicle_photos(vehicle_id,job_id,photo_type,storage_path,uploaded_by) values(b.vehicle_id,(c->'job'->>'id')::uuid,'PAYMENT_PROOF','billing-proofs/'||p_proof_path,u) returning id into proof;
 elsif nullif(btrim(p_utr),'') is not null or p_proof_path is not null then raise exception 'UTR and Online proof do not apply to Cash payment.';
 end if;
 insert into public.payments(visit_id,vehicle_id,billing_record_id,payment_mode,amount,utr_no,payment_at,payment_proof_photo_id,recorded_by,client_request_id)
 values(p_visit_id,b.vehicle_id,b.id,p_mode,p_amount,nullif(btrim(p_utr),''),p_payment_at,proof,u,p_request_id) returning id into payment;
 insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,performed_by,performed_at,metadata) values(p_visit_id,b.vehicle_id,'BILLING_PAYMENT_RECORDED','BILLING','BILLING',u,t,jsonb_build_object('payment_id',payment,'amount',p_amount,'mode',p_mode,'occurred_at',p_payment_at));
 return jsonb_build_object('success',true,'payment_id',payment);
end; $fn$;

create or replace function public.new_workflow_complete_billing(p_visit_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c jsonb; b public.billing_records%rowtype; u uuid:=auth.uid(); t timestamptz:=now(); a uuid; due numeric; paid numeric;
begin
 c:=pagariya_workflow_private.billing_context(p_visit_id);
 select * into b from public.billing_records where id=(c->'billing'->>'id')::uuid;
 if nullif(btrim(b.bill_no),'') is null or nullif(btrim(b.tax_invoice_no),'') is null or not exists(select 1 from public.billing_steps where billing_record_id=b.id and step_code='TAX_INVOICE_GENERATED') then raise exception 'Complete invoice generation first.'; end if;
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
end; $fn$;
revoke all on function public.new_workflow_billing_queue(),public.new_workflow_save_billing_invoice(uuid,jsonb),public.new_workflow_record_billing_payment(uuid,uuid,text,numeric,timestamptz,text,text),public.new_workflow_complete_billing(uuid) from public,anon;
grant execute on function public.new_workflow_billing_queue(),public.new_workflow_save_billing_invoice(uuid,jsonb),public.new_workflow_record_billing_payment(uuid,uuid,text,numeric,timestamptz,text,text),public.new_workflow_complete_billing(uuid) to authenticated;

