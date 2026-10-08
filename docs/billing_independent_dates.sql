alter table public.advisor_billing_handoffs drop constraint handoff_liability_sequence;

CREATE OR REPLACE FUNCTION public.new_workflow_save_advisor_billing(p_visit_id uuid, p_pre_invoice_sent_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_liability_received_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_details_verified boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c jsonb; h public.advisor_billing_handoffs%rowtype; u uuid:=auth.uid(); t timestamptz:=now(); pre timestamptz; liability timestamptz; gate_in timestamptz; e text;
begin
 c:=pagariya_workflow_private.advisor_billing_context(p_visit_id);
 insert into public.advisor_billing_handoffs(visit_id,vehicle_id,job_id) values(p_visit_id,(c->'visit'->>'vehicle_id')::uuid,(c->'job'->>'id')::uuid) on conflict(visit_id) do nothing;
 select * into h from public.advisor_billing_handoffs where visit_id=p_visit_id for update;
 if h.job_id is distinct from (c->'job'->>'id')::uuid then raise exception 'Billing job conflict.'; end if;
 if c->'job'->>'job_type'='INSURANCE' then
  pre:=coalesce(h.pre_invoice_sent_at,p_pre_invoice_sent_at); liability:=coalesce(h.liability_received_at,p_liability_received_at);
  if h.pre_invoice_sent_at is not null and p_pre_invoice_sent_at is not null and h.pre_invoice_sent_at<>p_pre_invoice_sent_at then raise exception 'The recorded pre-invoice date cannot be overwritten.'; end if;
  if h.liability_received_at is not null and p_liability_received_at is not null and h.liability_received_at<>p_liability_received_at then raise exception 'The recorded liability date cannot be overwritten.'; end if;
  if pre>t or liability>t then raise exception 'Billing dates cannot be in the future.'; end if;
  -- Each new action is bounded independently by this visit's Gate In.
  select g.gate_in_at into gate_in from public.gate_entries g
   where g.visit_id=p_visit_id and g.vehicle_id=(c->'visit'->>'vehicle_id')::uuid;
  if (h.pre_invoice_sent_at is null and pre is not null)
     or (h.liability_received_at is null and liability is not null) then
   if gate_in is null or gate_in>t then raise exception 'A valid Gate In time is required. Refresh or contact CEO Admin.'; end if;
   if (h.pre_invoice_sent_at is null and pre<gate_in)
      or (h.liability_received_at is null and liability<gate_in) then
    raise exception 'Choose a date and time on or after this vehicle''s Gate In.';
   end if;
  end if;
  update public.advisor_billing_handoffs set pre_invoice_sent_at=pre,pre_invoice_recorded_by=case when h.pre_invoice_sent_at is null and pre is not null then u else h.pre_invoice_recorded_by end,
   liability_received_at=liability,liability_recorded_by=case when h.liability_received_at is null and liability is not null then u else h.liability_recorded_by end,updated_at=t where visit_id=p_visit_id;
  if h.pre_invoice_sent_at is null and pre is not null then
   insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,performed_by,performed_at,metadata)
   values(p_visit_id,h.vehicle_id,'PRE_INVOICE_SENT',c->'visit'->>'current_stage',c->'visit'->>'current_stage',u,t,jsonb_build_object('occurred_at',pre,'job_id',h.job_id));
  end if;
  if h.liability_received_at is null and liability is not null then
   insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,performed_by,performed_at,metadata)
   values(p_visit_id,h.vehicle_id,'LIABILITY_RECEIVED',c->'visit'->>'current_stage',c->'visit'->>'current_stage',u,t,jsonb_build_object('occurred_at',liability,'job_id',h.job_id));
  end if;
 else
  if p_pre_invoice_sent_at is not null or p_liability_received_at is not null then raise exception 'Insurance steps do not apply to a Paid job.'; end if;
  if p_details_verified=true and h.details_verified_at is null then
   update public.advisor_billing_handoffs set details_verified_at=t,details_verified_by=u,updated_at=t where visit_id=p_visit_id;
   insert into public.workflow_events(visit_id,vehicle_id,event_type,stage_before,stage_after,performed_by,performed_at,metadata)
   values(p_visit_id,h.vehicle_id,'PAID_BILLING_DETAILS_VERIFIED',c->'visit'->>'current_stage',c->'visit'->>'current_stage',u,t,jsonb_build_object('job_id',h.job_id));
  end if;
 end if;
 return jsonb_build_object('success',true,'visit_id',p_visit_id);
end;
$function$;
