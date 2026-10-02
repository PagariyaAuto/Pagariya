# AGENTS.md — Pagariya Auto

## Context and authority

- This repository is the Pagariya Auto workshop/body-shop workflow application: React Native + Expo + TypeScript + Expo Router, with Supabase Auth/PostgreSQL/RPC/RLS/Storage and EAS Build. Do not import unrelated CRM assumptions.
- Read `PROJECT_CONTEXT.md` (or `docs/PROJECT_CONTEXT.md` if installed there) before making changes. The live repo and live Supabase definitions override stale handoff implementation details. Investigate conflicts with explicit business requirements; do not silently weaken those requirements.
- Latest owner status: Gate In, Gate Out, Vehicle Intake, Claim Intimation, Survey, Approval, Advisor Work, Store for Advisor/CEO Admin and Store Team are COMPLETE. Approval Hold, Supplementary, Floor, Floor Incharge, Final Inspection, Final Inspector, Billing and Ready for Delivery are REMAINING. Earlier Hold backend repairs do not establish end-to-end completion.
- Mark missing or conflicting details **NEEDS VERIFICATION**. Verify actual remote/branch, versions, routes and role identifiers; do not invent schema or rename roles from a business label.

## Working rules

1. Inspect current files, dependencies and callers before editing. For data behavior, inspect live tables, constraints, indexes, RLS, triggers and exact RPC definitions/signatures, including overloads and grants. If live access is unavailable, state the limitation and do not claim verification.
2. Preserve completed modules and make targeted changes. Avoid dependency upgrades, broad rewrites, duplicate tables/functions and speculative migrations. Trace callers before deleting/renaming legacy functions.
3. Keep sensitive workflow mutations in dedicated atomic PostgreSQL RPCs with authentication, active-profile and role checks, advisor ownership, state validation, row locks where needed and audit writes. Do not use direct client updates or generic `new_workflow_move_stage` shortcuts where dedicated RPCs exist.
4. Preserve RLS and server authorization. Advisors may act only on their assigned vehicles after acceptance; CEO Admin exceptions apply only where explicitly supported. Save-and-accept Intake must be atomic, with no assignment on opening a form or failed save. Do not use legacy `take_vehicle_as_advisor` to bypass ownership.
5. Preserve authoritative visit stage/status and corresponding vehicle state. Intake creates `vehicle_jobs`; Survey updates that active job. Never weaken the missing-job guard. Preserve active-job selection until live uniqueness and historical-job behavior are understood.
6. Approval Hold remains a branch of Approval. Resolve returns to `PENDING_APPROVAL`, makes the same cycle `PENDING`, preserves hold timestamps/remarks and assignment, and does not approve automatically. Hold → Resolve → Approve must not create an unnecessary second cycle.
7. Preserve actors, timestamps, module records, workflow events and stage history. Close/open stages consistently; retain completed history and audit records. Display business time in IST while preserving database `timestamptz` semantics. Do not patch historical test data to hide defects.
8. Store Team is operational; Advisor/CEO Admin Store Monitoring is shared and read-only. Advisor monitoring sees assigned vehicles; CEO Admin sees relevant vehicles broadly. Keep Store Team Home/Profile tabs and internal Store routes. Preserve manual Part Order No., segmented Order Type and current RPC argument names.
9. Preserve database-driven master data, document checklists and historical references; deactivate where appropriate. Inspect existing Document Master/document status architecture before adding another system.
10. Preserve Expo Router navigation, role-aware Home, Android back behavior and safe areas, including photo viewers. Use existing custom Modal/dialog patterns instead of native `Alert`/`alert()`. Keep readable, polished workshop UI and existing free UI solutions.
11. Verify current versions and platform compatibility before changing dependencies, routes or build configuration. Preserve EAS/Android identity unless an explicit migration is requested. Do not assume the source-reported Expo/Router versions or installed eas-cli version are current.
12. Never expose or commit secrets, `.env` values, credentials, tokens or service-role keys. Required known variable names are `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`; use secure configuration. Verify local and EAS profile configuration without printing values.
13. Use complete function definitions for PL/pgSQL changes, never standalone internal fragments. Preserve compatible parameter names; a drop/recreate requires dependency and grant review. Do not execute the historical schema inventory as a migration.
14. Do not perform destructive test-data resets, history deletion, bucket recreation or unrelated cleanup without explicit scope and authorization. Preserve user changes.

## Validation and reporting

- Run the relevant repository TypeScript/lint/build checks using actual project scripts. Test affected UI loading, success, error, navigation and ownership cases on supported platforms, especially Android.
- For workflow changes, use fresh test vehicles; verify stage/status, assignment, active job, module rows, approval/supplementary cycles, events, timestamps and open/closed history. Include concurrency and unauthorized-user checks where the changed operation requires them.
- Preserve regression coverage of completed modules. For Approval Hold specifically verify mandatory remark/photo, Hold/Resolve state, same-cycle reuse and authorization.
- Report what changed, what was actually checked and what remains **NEEDS VERIFICATION**. Update project context when decisions/status change. Provide complete replacement frontend files when requested, while keeping actual edits focused.
- Unless the user sets a different priority, complete/verify Approval Hold first, then Supplementary, Floor/Floor Incharge, Final Inspection/Final Inspector, Billing and Ready for Delivery, followed by full Gate Out regression. Do not start implementation merely because this handoff was installed.
