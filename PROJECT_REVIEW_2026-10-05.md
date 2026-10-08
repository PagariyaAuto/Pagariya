# Pagariya Auto — repository and live Supabase review

Reviewed 5 October 2026 (IST). This is a read-only database and source review, not end-to-end certification. The owner confirmed that PagariaDemo is used for real workshop operations and Advisors should see only assigned vehicles. No database records, functions, policies, grants or deployments were changed. No workflow mutation or destructive test was executed.

## Verified scope and identity

- Repository: https://github.com/PagariyaAuto/Pagariya.git; branch `refactor/vehicle-workflow`. Initial working tree was clean.
- Supabase project `nnbijpmsixebfqeqamdd` (PagariaDemo), ACTIVE_HEALTHY, PostgreSQL 17.6.1.166. Local configured URL matches; configured frontend key is publishable. Credential values were not printed. `.env` is ignored and not tracked.
- Installed: Expo 57.0.26, Expo Router 57.0.24, React Native 0.86.3, TypeScript 6.0.3, supabase-js 2.116.0; Node 24.21.0 and npm 11.19.0. Package versions in older context are historical. Platform compatibility/EAS remote environment remains NEEDS VERIFICATION.
- Inspected live public tables/RLS flags, policies, constraints, indexes, triggers, function definitions/signatures/overloads and grants; Storage bucket/policies; security and performance advisors; source routes, RPC callers, auth, photos, document handling and build configuration. Live inventory has 39 public tables and 44 functions (including overloads). All 39 tables have RLS enabled; vehicle-photos is private.
- The Android identity remains `com.pagariya.warehouse`, scheme `pagariya`, EAS project `7d36a918-57ab-4265-9f90-0e540370d0ee`.

## Findings, in priority order

### 1. Critical: unrestricted privileged stage transition

`public.new_workflow_move_stage(uuid,uuid,text,text,text)` is SECURITY DEFINER, executable by anon and authenticated. Its complete body checks only that the visit/vehicle pair exists, locks the visit, changes stage/status, changes stage history and creates an event. It contains no authentication, active-profile, role, ownership, allowed-transition or module prerequisite checks. It also does not synchronize `vehicles`.

Consequently its database authorization permits callers to bypass dedicated workflow operations for known identifiers, subject to table constraints. No exploit request was made. No source caller was found, but other RPC/external dependencies must be traced before removing it. Immediately prioritize restricting its execution and reviewing all privileged APIs. The other 31 anonymous SECURITY DEFINER warnings do not all establish the same vulnerability: many bodies explicitly reject unauthorized users, and trigger functions have different invocation semantics.

Reference: [Supabase function execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

### 2. High: server permissions violate assigned-only Advisor access

Policies for vehicles, workshop_visits, vehicle_jobs, vehicle_photos, part_orders and part_requisitions permit SELECT to any active profile, without Advisor assignment predicates. Storage objects SELECT checks only the vehicle-photos bucket and authenticated role, without active-profile or ownership checks. Advisors can therefore access another Advisor's data via the API even where UI queries filter it.

More seriously, vehicle_jobs INSERT/UPDATE checks only active Advisor/CEO Admin role, with no vehicle ownership predicate. An Advisor has database permission to modify another Advisor's job and workflow fields directly. Photo INSERT/upload also has role checks without ownership validation. This undercuts dedicated RPC enforcement. Preserve required CEO Admin/Store/Watchman/Floor access while implementing an explicit per-role matrix.

NEEDS VERIFICATION: the intended exception for unassigned Intake queue visibility, which currently supports atomic save-and-accept, and visibility of historical visits after reassignment.

### 3. High: resolved Hold metadata is erased on approval

`new_workflow_resolve_approval_hold` correctly checks authentication, active Advisor/CEO Admin, ownership, HOLD state; locks visit/vehicle/cycle; resets the same cycle to PENDING; preserves hold details and assignment; returns to PENDING_APPROVAL/PENDING with audit/history.

However `new_workflow_process_approval` reuses that pending cycle and assigns `approval_hold_at` and `approval_hold_remark` to NULL for any decision other than APPROVAL_HOLD. Hold → Resolve → Approve therefore erases those original cycle fields. Aggregate live query found one APPROVED cycle with an APPROVAL_HOLD_RESOLVED event and missing hold timestamp. Event metadata may still preserve evidence, but the cycle record does not meet the preservation requirement.

Preserve the original cycle hold fields during subsequent decisions. The frontend and approval RPC enforce a mandatory hold remark and photo reference; the RPC verifies a matching vehicle photo row. Same-cycle reuse and missing-active-job guards exist. Fresh workflow/concurrency/unauthorized tests remain NEEDS VERIFICATION; Approval Hold stays REMAINING.

### 4. High: Store and Floor workflows use disconnected records

`new_workflow_hand_over_parts_to_floor` updates visit/vehicle state, creates a Floor assignment and audit/history, but never updates `vehicle_jobs.current_job_stage` or `floor_incharge_id`. Only updated_at triggers exist on vehicle_jobs; no inspected trigger bridges this gap.

`src/app/(tabs)/work/floor-incharge.tsx` loads jobs by `floor_incharge_id` and `current_job_stage = FLOOR`. Its start/complete RPCs require those job fields. A fresh Store handover can therefore leave a Floor vehicle invisible or ineligible in this workspace. The current single Floor record already has matching job stage/assignee; that does not establish that handover populates them.

`advance_vehicle_after_floor` updates vehicles/jobs to WORKSHOP but never updates workshop_visits, workflow_events or workflow_stage_history. WORKSHOP is absent from the live visit stage constraint. Floor start/complete write legacy vehicle_history, not the visit event system. This is an incomplete legacy/new workflow integration, not an end-to-end completed Floor module.

### 5. High: legacy mutation screens are still reachable

`src/app/(tabs)/vehicles.tsx` links to `vehicle-detail.tsx`, where an Advisor can press Take Vehicle. It calls `take_vehicle_as_advisor`, which changes only vehicles and vehicle_history, leaving visit assignment/state untouched and accepting before the atomic Intake save.

The same detail screen renders `components/workflow/ApprovalStage.tsx`, calling legacy `record_vehicle_approval` and `resolve_insurance_rejection`. These use vehicle/job state and omit visit/cycle synchronization. Trace and retire/redirect these paths carefully; their UI presence is confirmed even if all modern vehicles do not meet their legacy stage checks.

### 6. High: Intake document confirmations are not saved

IntakeDocumentSection offers per-document checkboxes. `intake.validation.ts` blocks saving until required documents are ticked. But intake-form sends no document selections to `new_workflow_save_vehicle_intake`, and performs no subsequent document save. The RPC snapshots Document Master into visit_document_checklist with every status PENDING. `intake.data.ts` initializes all selections to false and does not reload submission status.

The form's confirmed documents are therefore lost; required-document confirmation is only a client-side check. Define submission/verification semantics using the existing document architecture and make required checks authoritative and atomic. Do not create a second document system.

### 7. Medium: active visit/vehicle state discrepancies

Aggregate checks found 23 vehicles, 13 visits, all 13 visits open. Four open visits differ from their vehicle mirror: three ADVISOR_ASSIGNED visits have IN_PROGRESS while vehicles have ADVISOR_ASSIGNED status; one FLOOR visit has a different current assignee than its vehicle. The assignment RPC explicitly writes those different status values, so the first three are reproducible implementation behavior, not proven manual corruption. Store can intentionally retain the Advisor on vehicle while assigning Floor on visit; this conflicts with a literal mirrored-assignee interpretation and needs an explicit ownership model.

All 13 open visits currently have exactly one OPEN history row, with stage matching the visit. A unique partial index enforces one OPEN history per visit. Another unique partial index enforces one non-CLOSED job per vehicle.

### 8. Medium: Gate Out leaves the active job open

The modern `new_workflow_gate_out` closes the visit and sets vehicle GATE_OUT/COMPLETED but never closes vehicle_jobs. No inspected job trigger handles this. Intake creates a job and the live partial unique index disallows another non-CLOSED job for the vehicle. A subsequent visit can therefore be blocked by the previous job. Fresh Gate Out → revisit → Intake regression is NEEDS VERIFICATION; existing records were not altered.

### 9. Medium: dashboard links and role routing are incomplete

Advisor dashboard links Supplementary to missing `/advisor/approval`, Floor to missing `/advisor/floor`, Final Inspection to missing `/advisor/final-inspection`, Ready for Delivery to missing `/advisor/ready-for-delivery`. `openModule` pushes any supplied route, so these links do not use the placeholder dialog. Billing and Operations Monitor explicitly use placeholders.

No dedicated final-inspector or billing workspace exists in the inspected tree. Live role constraint accepts `billing_department` and `final_inspector`; do not rename to billing_executive. `final_inspector` is absent from normal-workspace role checks in the tabs layout. Helpers/components under src/app also become potential routes; layout explicitly registers several missing legacy route names such as gate-in, PreviousJobCards and survey_form.styles. Verify warnings and Android navigation before reorganizing.

### 10. Medium: Advisor photo failure cleanup is forbidden by policies

Approval uploads Storage file and vehicle_photos row before its workflow RPC. On failure `cleanupUploadedPhoto` attempts to delete both, but live DELETE policies allow only CEO Admin. Supabase error results are ignored. Advisor failures can leave orphan uploads/records; a row-insert failure also attempts a forbidden Storage delete. Use ownership-scoped cleanup or a dedicated safe server operation without weakening historical-photo protections. React Native Blob upload behavior requires real Android verification.

### 11. Additional hardening and scale concerns

- Supabase reports mutable search_path for update_updated_at: [remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- Broad table privileges include TRUNCATE for anon/authenticated on inspected tables. RLS does not authorize TRUNCATE; foreign keys and exposed API availability affect exploitability. Review grants without destructive testing.
- profiles INSERT policy checks only own id, without restricting role/is_active. Automatic signup trigger normally pre-creates the row; assess every creation path before treating this as an exploitable escalation. No attempt was made.
- Hold details selects vehicle_jobs with vehicle_id + maybeSingle and no active-job filter; historical closed jobs can cause load errors. Keep the active job strategy consistent with the live partial unique index.
- Several business timestamp formatters use device timezone, including Floor work; en-IN locale alone does not select IST.
- Private-bucket Intake photo code falls back to getPublicUrl after signed-URL failure, which cannot make private content accessible.
- Performance advisor: 61 unindexed foreign keys, 63 auth RLS evaluation notices, 31 unused-index notices, one multiple-permissive-policy notice. Prioritize measured hot queries; do not remove audit indexes based only on unused counts. [Index advice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS evaluation advice](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan).

## Validation and limitations

- `node node_modules/typescript/bin/tsc --noEmit`: PASS, exit 0.
- `npm run lint`: NOT COMPLETED. No ESLint configuration/dependencies existed; Expo tried automatic setup. Network-restricted attempt failed. Authorized retry started installing; stopped it to preserve review scope, removed the two package entries it added. Tracked application/dependency file content has no remaining diff. Local node_modules may contain partial lint installation artifacts.
- No Android device/emulator/browser functional testing, EAS build, authenticated role impersonation, mutation/concurrency test, or fresh vehicle workflow run was performed. These remain NEEDS VERIFICATION, not passing checks.
- Remote Auth redirect/password/session settings and EAS secrets were not available through the inspected tools; source reset link handling is present but operational reset is unverified.
- Findings were obtained from static code/full live definitions and aggregate existing-record queries. No customer identifiers or secrets are included here. Historic data was not repaired or hidden.

## Recommended work sequence

First restrict the unrestricted mutation API and close assigned-only authorization gaps because the database is operational. Then complete Approval Hold with preservation, photo failure behavior, historical-job loading and fresh role/concurrency tests. Continue Supplementary, integrate Store → Floor and Floor Incharge into the authoritative visit workflow, then Final Inspection/Final Inspector, Billing, Ready for Delivery and full Gate Out/revisit regression. Completed-module status is preserved as the owner's baseline, with the concrete regression risks above requiring verification.
