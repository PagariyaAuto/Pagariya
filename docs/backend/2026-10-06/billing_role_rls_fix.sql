-- Evaluate legacy/new record classification with trusted lookup, so another
-- user's handoff cannot disappear under RLS and look like a legacy record.
create or replace function pagariya_workflow_private.can_read_billing_record(p_record_id uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.billing_records b where b.id=p_record_id
 and exists(select 1 from public.profiles where id=auth.uid() and is_active)
 and (not exists(select 1 from public.advisor_billing_handoffs h where h.billing_record_id=b.id)
 or pagariya_workflow_private.can_read_billing(b.visit_id)));
$fn$;
revoke all on function pagariya_workflow_private.can_read_billing_record(uuid) from public,anon;
grant execute on function pagariya_workflow_private.can_read_billing_record(uuid) to authenticated;
drop policy billing_records_participant_guard on public.billing_records;
create policy billing_records_participant_guard on public.billing_records as restrictive for select to authenticated using(pagariya_workflow_private.can_read_billing_record(id));
