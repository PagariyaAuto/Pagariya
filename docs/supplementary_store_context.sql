CREATE OR REPLACE FUNCTION public.new_workflow_supplementary_requisition_context(p_requisition_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text; result jsonb;
BEGIN
 SELECT role INTO r FROM public.profiles WHERE id=auth.uid() AND is_active;
 IF r IS NULL OR r NOT IN ('advisor','ceo_admin','store_team') THEN RAISE EXCEPTION 'This account cannot view Store requirements.'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('requisition_id',q.id,'work_path',s.work_path,'cycle_no',s.cycle_no)),'[]'::jsonb) INTO result
 FROM public.part_requisitions q JOIN public.supplementary_cycles s ON s.id=q.supplementary_cycle_id AND s.visit_id=q.visit_id AND s.vehicle_id=q.vehicle_id
 WHERE q.id=ANY(p_requisition_ids) AND (r IN ('ceo_admin','store_team') OR pagariya_workflow_private.can_read_visit(q.visit_id));
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.new_workflow_supplementary_requisition_context(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.new_workflow_supplementary_requisition_context(uuid[]) TO authenticated;
