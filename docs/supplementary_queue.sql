CREATE OR REPLACE FUNCTION public.new_workflow_supplementary_queue(p_floor boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r text; result jsonb;
BEGIN
  SELECT role INTO r FROM public.profiles WHERE id=auth.uid() AND is_active;
  IF r IS NULL OR r NOT IN ('advisor','ceo_admin','floor_incharge') OR (r='floor_incharge' AND NOT p_floor) THEN RAISE EXCEPTION 'Your account cannot access this queue.'; END IF;
  SELECT coalesce(jsonb_agg(q ORDER BY q.opened_at),'[]'::jsonb) INTO result FROM (
    SELECT w.id AS visit_id,w.vehicle_id,w.current_stage,w.current_status,w.opened_at,v.vehicle_no,v.model,j.id AS job_id,j.job_type,j.floor_incharge_id,
      (SELECT to_jsonb(s)||jsonb_build_object('approval',(SELECT to_jsonb(a) FROM public.approval_cycles a WHERE a.id=s.approval_cycle_id)) FROM public.supplementary_cycles s WHERE s.visit_id=w.id ORDER BY s.cycle_no DESC LIMIT 1) AS supplementary,
      (SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('approval',(SELECT to_jsonb(a) FROM public.approval_cycles a WHERE a.id=s.approval_cycle_id),'survey',(SELECT to_jsonb(t) FROM public.surveys t WHERE t.id=s.survey_id)) ORDER BY s.cycle_no DESC) FROM public.supplementary_cycles s WHERE s.visit_id=w.id) AS cycle_history,
      (SELECT jsonb_agg(jsonb_build_object('id',p.id,'storage_path',p.storage_path,'photo_type',p.photo_type)) FROM public.vehicle_photos p WHERE p.vehicle_id=w.vehicle_id AND p.deleted_at IS NULL AND EXISTS(SELECT 1 FROM public.supplementary_cycles s WHERE s.visit_id=w.id AND (s.discovery_photo_id=p.id OR EXISTS(SELECT 1 FROM public.workflow_events e WHERE e.visit_id=w.id AND e.metadata->>'supplementary_cycle_id'=s.id::text AND (e.metadata->>'photo_id'=p.id::text OR e.metadata->>'photo_reference'=p.storage_path))))) AS evidence,
      (SELECT jsonb_agg(jsonb_build_object('event_type',e.event_type,'performed_at',e.performed_at,'remarks',e.remarks,'metadata',e.metadata) ORDER BY e.performed_at) FROM public.workflow_events e WHERE e.visit_id=w.id AND (e.metadata ? 'supplementary_cycle_id' OR e.event_type='APPROVAL_HOLD_RESOLVED' AND EXISTS(SELECT 1 FROM public.supplementary_cycles s WHERE s.visit_id=w.id AND s.approval_cycle_id::text=e.metadata->>'approval_cycle_id'))) AS events,
      (SELECT to_jsonb(f) FROM public.floor_work_cycles f WHERE f.visit_id=w.id AND f.status='ACTIVE') AS floor_cycle,
      (SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('work_name',m.name,'work_code',m.code)) FROM public.floor_work_items i JOIN public.floor_work_cycles f ON f.id=i.floor_work_cycle_id JOIN public.work_type_master m ON m.id=i.work_type_id WHERE f.visit_id=w.id AND f.status='ACTIVE') AS floor_items
    FROM public.workshop_visits w JOIN public.vehicles v ON v.id=w.vehicle_id LEFT JOIN public.vehicle_jobs j ON j.vehicle_id=w.vehicle_id AND j.current_job_stage<>'CLOSED'
    WHERE w.closed_at IS NULL AND pagariya_workflow_private.can_read_visit(w.id) AND
      CASE WHEN p_floor THEN w.current_stage='FLOOR' ELSE EXISTS(SELECT 1 FROM public.supplementary_cycles s WHERE s.visit_id=w.id) END
  ) q;
  RETURN jsonb_build_object('role',r,'items',result);
END;
$function$
;
