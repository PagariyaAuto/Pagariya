# PROJECT_CONTEXT.md — Pagariya Auto

Consolidated 2026-10-02 from `PROJECT_HANDOFF(2).md`, `PROJECT_HANDOFF.md`, and `Pasted text.txt` (titled “Pagariya Auto — Project Handoff”). This document describes the workshop/body-shop workflow application. Do not merge in unrelated CRM context.

## Authority, provenance, and conflict resolution

1. The live repository and live Supabase schema/function/policy definitions override stale handoff implementation details. Inspect both before editing. Live implementation is evidence of current behavior; a discrepancy with an explicit business requirement must be investigated, not silently treated as permission to bypass that requirement.
2. For the handoff status baseline, the explicit latest owner-supplied status in `PROJECT_HANDOFF(2).md` overrides older snapshots. **Approval Hold is REMAINING.** Earlier cycle-reuse repairs remain relevant historical evidence, not proof of current end-to-end completion.
3. Preserve compatible architecture and business rules from all three sources. `PROJECT_HANDOFF.md` and `PROJECT_HANDOFF(2).md` share the detailed schema inventory; the later file adds status, version, and task-frontier updates. `Pasted text.txt` supplies additional routing, Store Monitoring, Document Master, UI, and troubleshooting details consolidated below.
4. **VERIFIED / CURRENT in the retained technical sections means reported verified in the source history.** No live repository or Supabase inspection was performed for this consolidation. Current deployment state is **NEEDS VERIFICATION**. Schema tables, policies, signatures, and triggers are a historical inventory, not an executable migration or complete SQL dump.
5. Unknown or conflicting details are marked **NEEDS VERIFICATION**; do not invent missing definitions or equate differently named roles/stages without checking actual callers and constraints.

### Resolved and unresolved differences

| Topic | Consolidated treatment |
|---|---|
| Approval Hold | REMAINING per latest owner status; retain earlier same-cycle repair and test evidence |
| Next feature | Approval Hold first, then Supplementary and remaining lifecycle modules; older “Supplementary next” and “Document Status next” priorities are superseded |
| Repository spelling | Latest handoffs record `PagariyaAuto/Pagariya.git`; `Pasted text.txt` records `PagariyaAuto/Pagaria.git` and contains a contradictory spelling explanation. Verify the actual Git remote before cloning or changing it; do not silently rewrite the remote |
| Expo / Expo Router | Latest file reports `57.0.22` / `57.0.21`; older files lack those versions. Retain as source-reported versions, confirm package identities and values in `package.json` and lockfile |
| eas-cli | `Pasted text.txt` calls `24.7.0` known, while the detailed handoffs describe an update notice. Installed version is NEEDS VERIFICATION |
| Supabase client path | `lib/supabase` import target versus approximate `src/lib/supabase.*` tree in pasted source. Exact resolved path is NEEDS VERIFICATION |
| Billing role | Business label Billing Executive; detailed handoff uses `billing_executive`, pasted source records `billing_department`. Actual stored role and authorization mapping are NEEDS VERIFICATION; do not rename either speculatively |
| Workflow labels | Conceptual `PENDING_ADVISOR_ASSIGNMENT` / `VEHICLE_INTAKE` versus observed `PENDING_ADVISOR` / `ADVISOR_ASSIGNED` and `INTAKE`. Preserve distinctions; use current RPC/constraint values, not diagram labels as new enum values |
| Master Data / Document Master | Pasted source reports UI completion; detailed handoff confirms backend but asks for frontend verification. Preserve the reported work; current UI completeness is NEEDS VERIFICATION |
| Full schema | Pasted source says a complete dump was unavailable. Detailed handoffs embed a substantial export inventory; retain it in section 6, while acknowledging missing DDL, indexes, Storage/Auth configuration and full function bodies |

## Consolidated technical context

## 0. Executive summary

- **Project:** Pagariya Auto / Pagariya Auto Pvt Ltd workshop-management application, internally referred to as `pagariya` / `pagariya-bodyshop`.
- **Purpose:** Manage the full vehicle workshop lifecycle from Gate In through intake, insurance/paid processing, survey, approval, parts/store/floor work, supplementary loops, inspection, billing, ready-for-delivery, and Gate Out, with timestamps, ownership, audit history, documents, photos, and role-based access.
- **Repository:** `https://github.com/PagariyaAuto/Pagariya.git`
- **Working branch:** `refactor/vehicle-workflow`
- **Current local path (latest known):** `C:\Users\admin\Desktop\android\Pagaria` (note local folder name is `Pagaria`; remote repository is `Pagariya`).
- **EAS account:** `pagariyaauto`; project slug `pagariya-bodyshop`; project ID `7d36a918-57ab-4265-9f90-0e540370d0ee`; Android package `com.pagariya.warehouse`.
- **Architecture:** Expo + React Native + TypeScript + Expo Router frontend, Supabase Auth/Postgres/RLS/RPC/Storage backend, EAS for builds.
- **Latest verified milestone:** Gate In/Gate Out, Vehicle Intake, Claim Intimation, Survey, Approval, Advisor Work, Store for Advisor/CEO Admin, and Store Team are treated as completed in the latest project-status snapshot. Store backend part-order/receive/handover RPCs were also deployed successfully. **Approval Hold is currently marked REMAINING by the latest user status**, even though earlier work had repaired the underlying cycle-reuse logic; do not treat the Hold UI/end-to-end feature as complete without fresh verification.
- **Next major feature:** complete Approval Hold, then Supplementary, Floor, Floor Incharge, Final Inspection, Final Inspector, Billing, and Ready for Delivery.

## 1. Project name and purpose

### Product purpose

Pagariya Auto is a workshop vehicle-management system designed around an auditable workflow. Every important state change should record the responsible user and exact date/time. The system also tracks assignment, stage waiting time, documents, photos, parts/requisition flow, billing/payment, and chronological vehicle history.

### Core design principle

A vehicle is a workflow object. The authoritative workflow state is carried primarily through `workshop_visits.current_stage/current_status` (and mirrored in `vehicles`); detailed business facts belong in module-specific tables; `workflow_events` and `workflow_stage_history` preserve audit/timing history.

## 2. Technology stack and versions

| Component | Known value | Confidence / note |
|---|---|---|
| Frontend | React Native + Expo + TypeScript | VERIFIED from conversation |
| Routing | Expo Router | VERIFIED; `src/app` is the app root |
| Backend | Supabase (Postgres, Auth, RLS, SQL functions/RPCs, Storage) | VERIFIED |
| Build/deploy | EAS Build | VERIFIED |
| Android package | `com.pagariya.warehouse` | VERIFIED |
| EAS account | `pagariyaauto` | VERIFIED |
| EAS project | `@pagariyaauto/pagariya-bodyshop` | VERIFIED from project context |
| EAS project ID | `7d36a918-57ab-4265-9f90-0e540370d0ee` | VERIFIED |
| Expo SDK version | `57.0.22` | VERIFIED from project context |
| React Native version | NEEDS VERIFICATION | Must inspect `package.json`/lockfile |
| TypeScript version | NEEDS VERIFICATION | Must inspect `package.json`/lockfile |
| `expo-router` version | `57.0.21` | VERIFIED from project context |
| `@supabase/supabase-js` version | NEEDS VERIFICATION | Must inspect `package.json`/lockfile |
| Node/npm exact versions | NEEDS VERIFICATION | Exact supported version not captured |
| eas-cli exact installed version | NEEDS VERIFICATION | A notice for `eas-cli@24.7.0` was observed; do not assume it was installed |

### Known dependencies/patterns in source

- `@supabase/supabase-js` client imported from a project `lib/supabase` module.
- `expo-router` (`router`, `useLocalSearchParams`, `useFocusEffect`) is used in workflow screens.
- `react-native-safe-area-context` `SafeAreaView` is used for notch/safe-area handling.
- `Ionicons` from Expo/vector icons is used in UI.
- React Native `Modal` is used for custom dialogs; native `Alert` must not be introduced.

## 3. Application architecture and folder structure

### Known structure

```text
Pagaria/                              # local clone folder (latest known)
├─ src/
│  └─ app/                            # Expo Router root (VERIFIED)
│     └─ ...                           # exact route tree NEEDS VERIFICATION from repo
├─ lib/
│  └─ supabase.*                       # Supabase client module; exact extension/path needs verification
├─ package.json                         # dependencies/scripts (must inspect in repo)
├─ eas.json                             # EAS profiles (known behavior documented below)
├─ .env                                 # local Supabase public env vars; DO NOT commit secrets
└─ ...
```

### Exact route/file paths known from conversation

| File/screen | Known purpose | Exact filesystem path |
|---|---|---|
| `ClaimIntimationFormScreen` | Advisor claim-intimation form; calls `new_workflow_claim_intimation` | NEEDS VERIFICATION; component/file name is known |
| `approval_hold.tsx` | Approval Hold list for advisor/CEO admin | Known filename; exact route path should be rechecked in repo |
| `approval_hold_details` / `ApprovalHoldDetailsScreen` | Approval Hold details + Resolve Hold | Known route/component; exact path should be rechecked in repo |
| Approval list screen | Approval queue/list with filters and registration search | Exact filename/path NEEDS VERIFICATION |
| `lib/supabase` | Supabase client import target | Exact extension NEEDS VERIFICATION |

**Do not infer a full route tree from these names.** The next AI/Codex should inspect the actual repository before changing routes.

## 4. Important files and responsibilities

- **`src/app`** — Expo Router route tree. Workflow screens live here or below it.
- **Supabase client module (`lib/supabase`)** — exposes the configured Supabase client; frontend workflow screens call Postgres RPCs through it.
- **`eas.json`** — EAS build profiles. Known profiles include development/preview Android APK internal builds and production auto-increment.
- **`.env`** — local environment values for Supabase public URL/key names. Actual values are secrets and are intentionally omitted from this document.
- **Workflow screens** — should remain thin UI layers around validated Supabase RPCs and should not duplicate business logic that belongs in the database transaction.

### Files not available in the handoff source

The conversation did not provide a complete repository tree or all source files. **NEEDS VERIFICATION:** exact `package.json`, `app.json/app.config.*`, every screen filename, every component/hook, `eas.json` contents, and lockfile versions.

## 5. Database/backend architecture

### Backend model

- PostgreSQL schema is `public` for application tables/functions.
- Supabase Auth supplies `auth.uid()`; application profile/role data lives in `public.profiles`.
- Business-critical mutations are implemented as PostgreSQL functions/RPCs, typically `SECURITY DEFINER`, with explicit authentication/profile/role checks and row locking.
- RLS is enabled on the application tables represented in the schema export. The exported policies use `authenticated` and frequently verify an active row in `profiles`.
- Storage is used for vehicle photos. A bucket named **`vehicle-photos`** is referenced in testing; exact storage policies/configuration were not included in the schema export and are **NEEDS VERIFICATION**.
- Audit/event layers: `workflow_events`, `workflow_stage_history`, and `vehicle_events`/`vehicle_history` exist; module tables store business data and timestamps.

### Authoritative workflow state

`workshop_visits.current_stage` + `current_status` are the clearest workflow state observed in the verified RPCs. `vehicles.current_stage/current_status` are updated in parallel. Do not introduce a second competing state machine without a strong reason and a migration plan.

## 6. Complete known database schema

Source reported by the handoff: the Supabase schema export `ed9a3de4-b395-419b-8c47-bf37ef78a9f8.txt`, uploaded 2026-10-02. The export contains 39 tables / 419 column records, 116 foreign-key records (duplicated in the export), 68 RLS policies, 43 functions, and 18 triggers.

### 6.1 Tables and columns

#### `advisor_work`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `work_path` | `character varying` | NO | `—` |
| 5 | `parts_required` | `boolean` | NO | `false` |
| 6 | `denting_required` | `boolean` | NO | `false` |
| 7 | `painting_required` | `boolean` | NO | `false` |
| 8 | `advisor_requisition_no` | `character varying` | YES | `—` |
| 9 | `requisition_at` | `timestamp with time zone` | YES | `—` |
| 10 | `assigned_by` | `uuid` | NO | `—` |
| 11 | `remarks` | `text` | YES | `—` |
| 12 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 13 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `approval_cycles`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `cycle_no` | `integer` | NO | `—` |
| 5 | `cycle_type` | `character varying` | NO | `'INITIAL'::character varying` |
| 6 | `decision` | `character varying` | NO | `'PENDING'::character varying` |
| 7 | `approval_received_at` | `timestamp with time zone` | YES | `—` |
| 8 | `approval_hold_at` | `timestamp with time zone` | YES | `—` |
| 9 | `approval_hold_remark` | `text` | YES | `—` |
| 10 | `claim_rejected_at` | `timestamp with time zone` | YES | `—` |
| 11 | `total_loss_at` | `timestamp with time zone` | YES | `—` |
| 12 | `decided_by` | `uuid` | YES | `—` |
| 13 | `remarks` | `text` | YES | `—` |
| 14 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `billing_records`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `billing_type` | `character varying` | NO | `—` |
| 5 | `tax_invoice_no` | `character varying` | YES | `—` |
| 6 | `invoice_amount` | `numeric` | YES | `—` |
| 7 | `liability_amount` | `numeric` | YES | `—` |
| 8 | `customer_difference_amount` | `numeric` | YES | `—` |
| 9 | `created_by` | `uuid` | NO | `—` |
| 10 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 11 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `billing_steps`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `billing_record_id` | `uuid` | NO | `—` |
| 3 | `step_code` | `character varying` | NO | `—` |
| 4 | `completed_at` | `timestamp with time zone` | NO | `now()` |
| 5 | `completed_by` | `uuid` | NO | `—` |
| 6 | `remarks` | `text` | YES | `—` |
| 7 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `business_types`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `code` | `character varying` | NO | `—` |
| 3 | `name` | `character varying` | NO | `—` |
| 4 | `is_active` | `boolean` | NO | `true` |
| 5 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `claim_intimations`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `estimate_id` | `character varying` | NO | `—` |
| 5 | `claim_no` | `character varying` | NO | `—` |
| 6 | `claim_intimated_at` | `timestamp with time zone` | NO | `—` |
| 7 | `recorded_by` | `uuid` | NO | `—` |
| 8 | `remarks` | `text` | YES | `—` |
| 9 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `document_master`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `name` | `character varying` | NO | `—` |
| 3 | `vehicle_type` | `character varying` | NO | `—` |
| 4 | `is_active` | `boolean` | NO | `true` |
| 5 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `updated_at` | `timestamp with time zone` | NO | `now()` |
| 7 | `workflow_stage` | `character varying` | NO | `'VEHICLE_INTAKE'::character varying` |
| 8 | `requirement_type` | `character varying` | NO | `'REQUIRED'::character varying` |

#### `final_inspections`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `inspection_no` | `integer` | NO | `—` |
| 5 | `inspected_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `inspected_by` | `uuid` | NO | `—` |
| 7 | `result` | `character varying` | NO | `—` |
| 8 | `failure_reason` | `text` | YES | `—` |
| 9 | `remarks` | `text` | YES | `—` |
| 10 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `floor_work_cycles`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `cycle_no` | `integer` | NO | `—` |
| 5 | `floor_incharge_id` | `uuid` | NO | `—` |
| 6 | `vehicle_in_at` | `timestamp with time zone` | NO | `now()` |
| 7 | `vehicle_out_at` | `timestamp with time zone` | YES | `—` |
| 8 | `parts_received_at` | `timestamp with time zone` | YES | `—` |
| 9 | `parts_received_by` | `uuid` | YES | `—` |
| 10 | `status` | `character varying` | NO | `'ACTIVE'::character varying` |
| 11 | `remarks` | `text` | YES | `—` |
| 12 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 13 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `floor_work_items`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `floor_work_cycle_id` | `uuid` | NO | `—` |
| 3 | `work_type_id` | `uuid` | NO | `—` |
| 4 | `started_at` | `timestamp with time zone` | YES | `—` |
| 5 | `started_by` | `uuid` | YES | `—` |
| 6 | `completed_at` | `timestamp with time zone` | YES | `—` |
| 7 | `completed_by` | `uuid` | YES | `—` |
| 8 | `status` | `character varying` | NO | `'PENDING'::character varying` |
| 9 | `supplementary_required` | `boolean` | NO | `false` |
| 10 | `supplementary_cycle_id` | `uuid` | YES | `—` |
| 11 | `remarks` | `text` | YES | `—` |
| 12 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 13 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `floor_work_progress`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `job_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `status` | `character varying` | NO | `'NOT_STARTED'::character varying` |
| 5 | `started_at` | `timestamp with time zone` | YES | `—` |
| 6 | `completed_at` | `timestamp with time zone` | YES | `—` |
| 7 | `updated_by` | `uuid` | YES | `—` |
| 8 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `gate_entries`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `vehicle_number` | `character varying` | NO | `—` |
| 5 | `gate_in_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `recorded_by` | `uuid` | NO | `—` |
| 7 | `gate_in_event_id` | `uuid` | YES | `—` |
| 8 | `remarks` | `text` | YES | `—` |
| 9 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `gate_exits`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `vehicle_number` | `character varying` | NO | `—` |
| 5 | `gate_out_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `recorded_by` | `uuid` | NO | `—` |
| 7 | `gate_out_event_id` | `uuid` | YES | `—` |
| 8 | `remarks` | `text` | YES | `—` |
| 9 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `insurance_companies`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `name` | `character varying` | NO | `—` |
| 3 | `is_active` | `boolean` | NO | `true` |
| 4 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 5 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `job_floor_tasks`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `job_id` | `uuid` | NO | `—` |
| 3 | `task_code` | `text` | NO | `—` |
| 4 | `status` | `text` | NO | `'NOT_STARTED'::text` |
| 5 | `updated_by` | `uuid` | YES | `—` |
| 6 | `started_at` | `timestamp with time zone` | YES | `—` |
| 7 | `completed_at` | `timestamp with time zone` | YES | `—` |
| 8 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 9 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `job_type_conversions`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `from_type` | `character varying` | NO | `—` |
| 5 | `to_type` | `character varying` | NO | `—` |
| 6 | `converted_at` | `timestamp with time zone` | NO | `now()` |
| 7 | `converted_by` | `uuid` | NO | `—` |
| 8 | `reason` | `text` | YES | `—` |
| 9 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `mi_types`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `code` | `character varying` | NO | `—` |
| 3 | `name` | `character varying` | NO | `—` |
| 4 | `is_active` | `boolean` | NO | `true` |
| 5 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `part_handovers`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `part_order_id` | `uuid` | NO | `—` |
| 5 | `handed_to` | `uuid` | NO | `—` |
| 6 | `handed_by` | `uuid` | NO | `—` |
| 7 | `handed_over_at` | `timestamp with time zone` | NO | `now()` |
| 8 | `remarks` | `text` | YES | `—` |
| 9 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `part_orders`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `part_requisition_id` | `uuid` | NO | `—` |
| 5 | `part_order_no` | `character varying` | NO | `—` |
| 6 | `order_type` | `character varying` | NO | `—` |
| 7 | `ordered_at` | `timestamp with time zone` | NO | `now()` |
| 8 | `ordered_by` | `uuid` | NO | `—` |
| 9 | `parts_received_at` | `timestamp with time zone` | YES | `—` |
| 10 | `parts_received_by` | `uuid` | YES | `—` |
| 11 | `status` | `character varying` | NO | `'ORDERED'::character varying` |
| 12 | `remarks` | `text` | YES | `—` |
| 13 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `part_requisitions`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `advisor_work_id` | `uuid` | NO | `—` |
| 5 | `requisition_no` | `character varying` | NO | `—` |
| 6 | `requisition_at` | `timestamp with time zone` | NO | `—` |
| 7 | `requested_by` | `uuid` | NO | `—` |
| 8 | `status` | `character varying` | NO | `'PENDING'::character varying` |
| 9 | `remarks` | `text` | YES | `—` |
| 10 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `payments`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `billing_record_id` | `uuid` | NO | `—` |
| 5 | `payment_mode` | `character varying` | NO | `—` |
| 6 | `amount` | `numeric` | NO | `—` |
| 7 | `utr_no` | `character varying` | YES | `—` |
| 8 | `payment_at` | `timestamp with time zone` | NO | `now()` |
| 9 | `payment_proof_photo_id` | `uuid` | YES | `—` |
| 10 | `recorded_by` | `uuid` | NO | `—` |
| 11 | `remarks` | `text` | YES | `—` |
| 12 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `profiles`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `—` |
| 2 | `name` | `character varying` | YES | `—` |
| 3 | `phone` | `character varying` | YES | `—` |
| 4 | `role` | `character varying` | NO | `'user'::character varying` |
| 5 | `is_active` | `boolean` | NO | `true` |
| 6 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 7 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `ready_for_delivery`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `marked_ready_at` | `timestamp with time zone` | NO | `now()` |
| 5 | `marked_by` | `uuid` | NO | `—` |
| 6 | `remarks` | `text` | YES | `—` |
| 7 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `supplementary_cycles`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `cycle_no` | `integer` | NO | `—` |
| 5 | `requested_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `requested_by` | `uuid` | NO | `—` |
| 7 | `reason` | `text` | NO | `—` |
| 8 | `status` | `character varying` | NO | `'PENDING'::character varying` |
| 9 | `survey_id` | `uuid` | YES | `—` |
| 10 | `approval_cycle_id` | `uuid` | YES | `—` |
| 11 | `returned_to_floor_at` | `timestamp with time zone` | YES | `—` |
| 12 | `completed_at` | `timestamp with time zone` | YES | `—` |
| 13 | `completed_by` | `uuid` | YES | `—` |
| 14 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 15 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `surveys`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `survey_no` | `integer` | NO | `1` |
| 5 | `survey_type` | `character varying` | NO | `'INITIAL'::character varying` |
| 6 | `started_at` | `timestamp with time zone` | YES | `—` |
| 7 | `completed_at` | `timestamp with time zone` | YES | `—` |
| 8 | `completed_by` | `uuid` | YES | `—` |
| 9 | `paid_amount` | `numeric` | YES | `—` |
| 10 | `receipt_reference_no` | `character varying` | YES | `—` |
| 11 | `remarks` | `text` | YES | `—` |
| 12 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `vehicle_assignments`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `assigned_to` | `uuid` | NO | `—` |
| 5 | `assigned_by` | `uuid` | NO | `—` |
| 6 | `assignment_role` | `character varying` | NO | `—` |
| 7 | `assigned_at` | `timestamp with time zone` | NO | `now()` |
| 8 | `unassigned_at` | `timestamp with time zone` | YES | `—` |
| 9 | `remarks` | `text` | YES | `—` |
| 10 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `vehicle_documents`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `vehicle_id` | `uuid` | NO | `—` |
| 3 | `document_id` | `uuid` | NO | `—` |
| 4 | `is_submitted` | `boolean` | NO | `false` |
| 5 | `marked_by` | `uuid` | YES | `—` |
| 6 | `marked_at` | `timestamp with time zone` | YES | `—` |
| 7 | `job_id` | `uuid` | YES | `—` |

#### `vehicle_events`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `vehicle_id` | `uuid` | NO | `—` |
| 3 | `event_type` | `character varying` | NO | `—` |
| 4 | `performed_by` | `uuid` | YES | `—` |
| 5 | `remarks` | `text` | YES | `—` |
| 6 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 7 | `job_id` | `uuid` | YES | `—` |

#### `vehicle_history`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `vehicle_id` | `uuid` | NO | `—` |
| 3 | `job_id` | `uuid` | YES | `—` |
| 4 | `changed_by` | `uuid` | YES | `—` |
| 5 | `action` | `character varying` | NO | `—` |
| 6 | `field_name` | `character varying` | YES | `—` |
| 7 | `old_value` | `text` | YES | `—` |
| 8 | `new_value` | `text` | YES | `—` |
| 9 | `reason` | `text` | YES | `—` |
| 10 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `vehicle_intake`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `customer_name` | `character varying` | NO | `—` |
| 5 | `customer_mobile` | `character varying` | NO | `—` |
| 6 | `vehicle_type` | `character varying` | NO | `—` |
| 7 | `vehicle_model_id` | `uuid` | NO | `—` |
| 8 | `arena_nexa` | `character varying` | NO | `—` |
| 9 | `insurance_type` | `character varying` | NO | `—` |
| 10 | `mi_type_id` | `uuid` | YES | `—` |
| 11 | `insurance_company_id` | `uuid` | YES | `—` |
| 12 | `worker_group` | `character varying` | NO | `—` |
| 13 | `job_card_no` | `character varying` | NO | `—` |
| 14 | `advisor_remarks` | `text` | YES | `—` |
| 15 | `completed_by` | `uuid` | NO | `—` |
| 16 | `completed_at` | `timestamp with time zone` | NO | `now()` |
| 17 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 18 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `vehicle_jobs`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `vehicle_id` | `uuid` | NO | `—` |
| 3 | `advisor_id` | `uuid` | YES | `—` |
| 4 | `job_type` | `character varying` | NO | `—` |
| 5 | `job_card_no` | `character varying` | YES | `—` |
| 6 | `vehicle_type` | `character varying` | YES | `—` |
| 7 | `arena_nexa` | `character varying` | YES | `—` |
| 8 | `insurance_company_id` | `uuid` | YES | `—` |
| 9 | `claim_intimation_at` | `timestamp with time zone` | YES | `—` |
| 10 | `survey_at` | `timestamp with time zone` | YES | `—` |
| 11 | `approval_status` | `character varying` | NO | `'PENDING'::character varying` |
| 12 | `approval_by_type` | `character varying` | YES | `—` |
| 13 | `approval_at` | `timestamp with time zone` | YES | `—` |
| 14 | `approval_remarks` | `text` | YES | `—` |
| 15 | `customer_approval_at` | `timestamp with time zone` | YES | `—` |
| 16 | `paid_job_remarks` | `text` | YES | `—` |
| 17 | `advisor_remarks` | `text` | YES | `—` |
| 18 | `current_job_stage` | `character varying` | NO | `'ADVISOR'::character varying` |
| 19 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 20 | `updated_at` | `timestamp with time zone` | NO | `now()` |
| 21 | `estimate_id` | `character varying` | YES | `—` |
| 22 | `claim_no` | `character varying` | YES | `—` |
| 23 | `partial_approval_choice` | `text` | YES | `—` |
| 24 | `floor_incharge_id` | `uuid` | YES | `—` |
| 25 | `floor_assigned_at` | `timestamp with time zone` | YES | `—` |
| 26 | `floor_assigned_by` | `uuid` | YES | `—` |
| 27 | `customer_name_snapshot` | `text` | YES | `—` |
| 28 | `customer_mobile_snapshot` | `text` | YES | `—` |
| 29 | `vehicle_model_id_snapshot` | `uuid` | YES | `—` |
| 30 | `vehicle_model_snapshot` | `text` | YES | `—` |
| 31 | `arena_nexa_snapshot` | `text` | YES | `—` |
| 32 | `vehicle_type_snapshot` | `text` | YES | `—` |
| 33 | `mi_type_id` | `uuid` | YES | `—` |

#### `vehicle_models`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `name` | `character varying` | NO | `—` |
| 3 | `arena_nexa` | `character varying` | NO | `—` |
| 4 | `is_active` | `boolean` | NO | `true` |
| 5 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `vehicle_photos`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `vehicle_id` | `uuid` | NO | `—` |
| 3 | `event_id` | `uuid` | YES | `—` |
| 4 | `photo_type` | `character varying` | NO | `—` |
| 5 | `storage_path` | `text` | NO | `—` |
| 6 | `uploaded_by` | `uuid` | YES | `—` |
| 7 | `uploaded_at` | `timestamp with time zone` | NO | `now()` |
| 8 | `deleted_at` | `timestamp with time zone` | YES | `—` |
| 9 | `deleted_by` | `uuid` | YES | `—` |
| 10 | `job_id` | `uuid` | YES | `—` |

#### `vehicles`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `vehicle_no` | `character varying` | NO | `—` |
| 3 | `jc_no` | `character varying` | YES | `—` |
| 4 | `model` | `character varying` | YES | `—` |
| 5 | `arena_nexa` | `character varying` | YES | `—` |
| 6 | `customer_name` | `character varying` | YES | `—` |
| 7 | `customer_mobile` | `character varying` | YES | `—` |
| 8 | `current_status` | `character varying` | NO | `'PENDING_ADVISOR'::character varying` |
| 9 | `current_stage` | `character varying` | NO | `'PENDING_ADVISOR'::character varying` |
| 10 | `current_assigned_to` | `uuid` | YES | `—` |
| 11 | `remarks` | `text` | YES | `—` |
| 12 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 13 | `updated_at` | `timestamp with time zone` | NO | `now()` |
| 14 | `vehicle_type` | `character varying` | YES | `—` |
| 15 | `vehicle_model_id` | `uuid` | YES | `—` |
| 16 | `stage_started_at` | `timestamp with time zone` | NO | `now()` |

#### `visit_document_checklist`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `document_master_id` | `uuid` | NO | `—` |
| 5 | `document_name` | `character varying` | NO | `—` |
| 6 | `vehicle_type` | `character varying` | NO | `—` |
| 7 | `workflow_stage` | `character varying` | NO | `—` |
| 8 | `requirement_type` | `character varying` | NO | `—` |
| 9 | `status` | `character varying` | NO | `'PENDING'::character varying` |
| 10 | `uploaded_at` | `timestamp with time zone` | YES | `—` |
| 11 | `uploaded_by` | `uuid` | YES | `—` |
| 12 | `photo_reference` | `text` | YES | `—` |
| 13 | `remarks` | `text` | YES | `—` |
| 14 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 15 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `work_type_master`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `code` | `character varying` | NO | `—` |
| 3 | `name` | `character varying` | NO | `—` |
| 4 | `description` | `text` | YES | `—` |
| 5 | `is_active` | `boolean` | NO | `true` |
| 6 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 7 | `updated_at` | `timestamp with time zone` | NO | `now()` |

#### `workflow_events`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `event_type` | `character varying` | NO | `—` |
| 5 | `stage_before` | `character varying` | YES | `—` |
| 6 | `stage_after` | `character varying` | YES | `—` |
| 7 | `status_before` | `character varying` | YES | `—` |
| 8 | `status_after` | `character varying` | YES | `—` |
| 9 | `performed_by` | `uuid` | YES | `—` |
| 10 | `performed_at` | `timestamp with time zone` | NO | `now()` |
| 11 | `remarks` | `text` | YES | `—` |
| 12 | `metadata` | `jsonb` | NO | `'{}'::jsonb` |
| 13 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `workflow_stage_history`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `visit_id` | `uuid` | NO | `—` |
| 3 | `vehicle_id` | `uuid` | NO | `—` |
| 4 | `stage` | `character varying` | NO | `—` |
| 5 | `entered_at` | `timestamp with time zone` | NO | `now()` |
| 6 | `exited_at` | `timestamp with time zone` | YES | `—` |
| 7 | `entered_by` | `uuid` | YES | `—` |
| 8 | `exited_by` | `uuid` | YES | `—` |
| 9 | `status` | `character varying` | NO | `'OPEN'::character varying` |
| 10 | `remarks` | `text` | YES | `—` |
| 11 | `created_at` | `timestamp with time zone` | NO | `now()` |

#### `workshop_visits`

| # | Column | Type | Nullable | Default |
|---:|---|---|:---:|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `vehicle_id` | `uuid` | NO | `—` |
| 3 | `visit_no` | `bigint` | NO | `—` |
| 4 | `current_stage` | `character varying` | NO | `'PENDING_ADVISOR'::character varying` |
| 5 | `current_status` | `character varying` | NO | `'PENDING'::character varying` |
| 6 | `current_assigned_to` | `uuid` | YES | `—` |
| 7 | `stage_started_at` | `timestamp with time zone` | NO | `now()` |
| 8 | `opened_at` | `timestamp with time zone` | NO | `now()` |
| 9 | `closed_at` | `timestamp with time zone` | YES | `—` |
| 10 | `remarks` | `text` | YES | `—` |
| 11 | `created_at` | `timestamp with time zone` | NO | `now()` |
| 12 | `updated_at` | `timestamp with time zone` | NO | `now()` |

### 6.2 Foreign-key relationships

The schema export provides 116 FK rows, appearing as the same 116-row list twice. The unique FK definitions are listed below.
- `advisor_work_assigned_by_fkey`: `advisor_work.assigned_by` → `profiles.id`
- `advisor_work_vehicle_id_fkey`: `advisor_work.vehicle_id` → `vehicles.id`
- `advisor_work_visit_id_fkey`: `advisor_work.visit_id` → `workshop_visits.id`
- `approval_cycles_decided_by_fkey`: `approval_cycles.decided_by` → `profiles.id`
- `approval_cycles_vehicle_id_fkey`: `approval_cycles.vehicle_id` → `vehicles.id`
- `approval_cycles_visit_id_fkey`: `approval_cycles.visit_id` → `workshop_visits.id`
- `billing_records_created_by_fkey`: `billing_records.created_by` → `profiles.id`
- `billing_records_vehicle_id_fkey`: `billing_records.vehicle_id` → `vehicles.id`
- `billing_records_visit_id_fkey`: `billing_records.visit_id` → `workshop_visits.id`
- `billing_steps_billing_record_id_fkey`: `billing_steps.billing_record_id` → `billing_records.id`
- `billing_steps_completed_by_fkey`: `billing_steps.completed_by` → `profiles.id`
- `claim_intimations_recorded_by_fkey`: `claim_intimations.recorded_by` → `profiles.id`
- `claim_intimations_vehicle_id_fkey`: `claim_intimations.vehicle_id` → `vehicles.id`
- `claim_intimations_visit_id_fkey`: `claim_intimations.visit_id` → `workshop_visits.id`
- `final_inspections_inspected_by_fkey`: `final_inspections.inspected_by` → `profiles.id`
- `final_inspections_vehicle_id_fkey`: `final_inspections.vehicle_id` → `vehicles.id`
- `final_inspections_visit_id_fkey`: `final_inspections.visit_id` → `workshop_visits.id`
- `floor_work_cycles_floor_incharge_id_fkey`: `floor_work_cycles.floor_incharge_id` → `profiles.id`
- `floor_work_cycles_parts_received_by_fkey`: `floor_work_cycles.parts_received_by` → `profiles.id`
- `floor_work_cycles_vehicle_id_fkey`: `floor_work_cycles.vehicle_id` → `vehicles.id`
- `floor_work_cycles_visit_id_fkey`: `floor_work_cycles.visit_id` → `workshop_visits.id`
- `floor_work_items_completed_by_fkey`: `floor_work_items.completed_by` → `profiles.id`
- `floor_work_items_floor_work_cycle_id_fkey`: `floor_work_items.floor_work_cycle_id` → `floor_work_cycles.id`
- `floor_work_items_started_by_fkey`: `floor_work_items.started_by` → `profiles.id`
- `floor_work_items_supplementary_fk`: `floor_work_items.supplementary_cycle_id` → `supplementary_cycles.id`
- `floor_work_items_work_type_id_fkey`: `floor_work_items.work_type_id` → `work_type_master.id`
- `floor_work_progress_job_id_fkey`: `floor_work_progress.job_id` → `vehicle_jobs.id`
- `floor_work_progress_updated_by_fkey`: `floor_work_progress.updated_by` → `profiles.id`
- `floor_work_progress_vehicle_id_fkey`: `floor_work_progress.vehicle_id` → `vehicles.id`
- `gate_entries_recorded_by_fkey`: `gate_entries.recorded_by` → `profiles.id`
- `gate_entries_vehicle_id_fkey`: `gate_entries.vehicle_id` → `vehicles.id`
- `gate_entries_visit_id_fkey`: `gate_entries.visit_id` → `workshop_visits.id`
- `gate_exits_recorded_by_fkey`: `gate_exits.recorded_by` → `profiles.id`
- `gate_exits_vehicle_id_fkey`: `gate_exits.vehicle_id` → `vehicles.id`
- `gate_exits_visit_id_fkey`: `gate_exits.visit_id` → `workshop_visits.id`
- `job_floor_tasks_job_id_fkey`: `job_floor_tasks.job_id` → `vehicle_jobs.id`
- `job_floor_tasks_updated_by_fkey`: `job_floor_tasks.updated_by` → `profiles.id`
- `job_type_conversions_converted_by_fkey`: `job_type_conversions.converted_by` → `profiles.id`
- `job_type_conversions_vehicle_id_fkey`: `job_type_conversions.vehicle_id` → `vehicles.id`
- `job_type_conversions_visit_id_fkey`: `job_type_conversions.visit_id` → `workshop_visits.id`
- `part_handovers_handed_by_fkey`: `part_handovers.handed_by` → `profiles.id`
- `part_handovers_handed_to_fkey`: `part_handovers.handed_to` → `profiles.id`
- `part_handovers_part_order_id_fkey`: `part_handovers.part_order_id` → `part_orders.id`
- `part_handovers_vehicle_id_fkey`: `part_handovers.vehicle_id` → `vehicles.id`
- `part_handovers_visit_id_fkey`: `part_handovers.visit_id` → `workshop_visits.id`
- `part_orders_ordered_by_fkey`: `part_orders.ordered_by` → `profiles.id`
- `part_orders_part_requisition_id_fkey`: `part_orders.part_requisition_id` → `part_requisitions.id`
- `part_orders_parts_received_by_fkey`: `part_orders.parts_received_by` → `profiles.id`
- `part_orders_vehicle_id_fkey`: `part_orders.vehicle_id` → `vehicles.id`
- `part_orders_visit_id_fkey`: `part_orders.visit_id` → `workshop_visits.id`
- `part_requisitions_advisor_work_id_fkey`: `part_requisitions.advisor_work_id` → `advisor_work.id`
- `part_requisitions_requested_by_fkey`: `part_requisitions.requested_by` → `profiles.id`
- `part_requisitions_vehicle_id_fkey`: `part_requisitions.vehicle_id` → `vehicles.id`
- `part_requisitions_visit_id_fkey`: `part_requisitions.visit_id` → `workshop_visits.id`
- `payments_billing_record_id_fkey`: `payments.billing_record_id` → `billing_records.id`
- `payments_recorded_by_fkey`: `payments.recorded_by` → `profiles.id`
- `payments_vehicle_id_fkey`: `payments.vehicle_id` → `vehicles.id`
- `payments_visit_id_fkey`: `payments.visit_id` → `workshop_visits.id`
- `ready_for_delivery_marked_by_fkey`: `ready_for_delivery.marked_by` → `profiles.id`
- `ready_for_delivery_vehicle_id_fkey`: `ready_for_delivery.vehicle_id` → `vehicles.id`
- `ready_for_delivery_visit_id_fkey`: `ready_for_delivery.visit_id` → `workshop_visits.id`
- `supplementary_cycles_approval_fk`: `supplementary_cycles.approval_cycle_id` → `approval_cycles.id`
- `supplementary_cycles_completed_by_fkey`: `supplementary_cycles.completed_by` → `profiles.id`
- `supplementary_cycles_requested_by_fkey`: `supplementary_cycles.requested_by` → `profiles.id`
- `supplementary_cycles_survey_fk`: `supplementary_cycles.survey_id` → `surveys.id`
- `supplementary_cycles_vehicle_id_fkey`: `supplementary_cycles.vehicle_id` → `vehicles.id`
- `supplementary_cycles_visit_id_fkey`: `supplementary_cycles.visit_id` → `workshop_visits.id`
- `surveys_completed_by_fkey`: `surveys.completed_by` → `profiles.id`
- `surveys_vehicle_id_fkey`: `surveys.vehicle_id` → `vehicles.id`
- `surveys_visit_id_fkey`: `surveys.visit_id` → `workshop_visits.id`
- `vehicle_assignments_assigned_by_fkey`: `vehicle_assignments.assigned_by` → `profiles.id`
- `vehicle_assignments_assigned_to_fkey`: `vehicle_assignments.assigned_to` → `profiles.id`
- `vehicle_assignments_vehicle_id_fkey`: `vehicle_assignments.vehicle_id` → `vehicles.id`
- `vehicle_assignments_visit_id_fkey`: `vehicle_assignments.visit_id` → `workshop_visits.id`
- `vehicle_documents_document_id_fkey`: `vehicle_documents.document_id` → `document_master.id`
- `vehicle_documents_job_id_fkey`: `vehicle_documents.job_id` → `vehicle_jobs.id`
- `vehicle_documents_marked_by_fkey`: `vehicle_documents.marked_by` → `profiles.id`
- `vehicle_documents_vehicle_id_fkey`: `vehicle_documents.vehicle_id` → `vehicles.id`
- `vehicle_events_job_id_fkey`: `vehicle_events.job_id` → `vehicle_jobs.id`
- `vehicle_events_performed_by_fkey`: `vehicle_events.performed_by` → `profiles.id`
- `vehicle_events_vehicle_id_fkey`: `vehicle_events.vehicle_id` → `vehicles.id`
- `vehicle_history_changed_by_fkey`: `vehicle_history.changed_by` → `profiles.id`
- `vehicle_history_job_id_fkey`: `vehicle_history.job_id` → `vehicle_jobs.id`
- `vehicle_history_vehicle_id_fkey`: `vehicle_history.vehicle_id` → `vehicles.id`
- `vehicle_intake_completed_by_fkey`: `vehicle_intake.completed_by` → `profiles.id`
- `vehicle_intake_insurance_company_id_fkey`: `vehicle_intake.insurance_company_id` → `insurance_companies.id`
- `vehicle_intake_mi_type_id_fkey`: `vehicle_intake.mi_type_id` → `mi_types.id`
- `vehicle_intake_vehicle_id_fkey`: `vehicle_intake.vehicle_id` → `vehicles.id`
- `vehicle_intake_vehicle_model_id_fkey`: `vehicle_intake.vehicle_model_id` → `vehicle_models.id`
- `vehicle_intake_visit_id_fkey`: `vehicle_intake.visit_id` → `workshop_visits.id`
- `vehicle_jobs_advisor_id_fkey`: `vehicle_jobs.advisor_id` → `profiles.id`
- `vehicle_jobs_floor_assigned_by_fkey`: `vehicle_jobs.floor_assigned_by` → `profiles.id`
- `vehicle_jobs_floor_incharge_id_fkey`: `vehicle_jobs.floor_incharge_id` → `profiles.id`
- `vehicle_jobs_insurance_company_id_fkey`: `vehicle_jobs.insurance_company_id` → `insurance_companies.id`
- `vehicle_jobs_mi_type_id_fkey`: `vehicle_jobs.mi_type_id` → `mi_types.id`
- `vehicle_jobs_vehicle_id_fkey`: `vehicle_jobs.vehicle_id` → `vehicles.id`
- `vehicle_photos_deleted_by_fkey`: `vehicle_photos.deleted_by` → `profiles.id`
- `vehicle_photos_event_id_fkey`: `vehicle_photos.event_id` → `vehicle_events.id`
- `vehicle_photos_job_id_fkey`: `vehicle_photos.job_id` → `vehicle_jobs.id`
- `vehicle_photos_uploaded_by_fkey`: `vehicle_photos.uploaded_by` → `profiles.id`
- `vehicle_photos_vehicle_id_fkey`: `vehicle_photos.vehicle_id` → `vehicles.id`
- `vehicles_current_assigned_to_fkey`: `vehicles.current_assigned_to` → `profiles.id`
- `vehicles_vehicle_model_id_fkey`: `vehicles.vehicle_model_id` → `vehicle_models.id`
- `visit_document_checklist_document_master_id_fkey`: `visit_document_checklist.document_master_id` → `document_master.id`
- `visit_document_checklist_uploaded_by_fkey`: `visit_document_checklist.uploaded_by` → `profiles.id`
- `visit_document_checklist_vehicle_id_fkey`: `visit_document_checklist.vehicle_id` → `vehicles.id`
- `visit_document_checklist_visit_id_fkey`: `visit_document_checklist.visit_id` → `workshop_visits.id`
- `workflow_events_performed_by_fkey`: `workflow_events.performed_by` → `profiles.id`
- `workflow_events_vehicle_id_fkey`: `workflow_events.vehicle_id` → `vehicles.id`
- `workflow_events_visit_id_fkey`: `workflow_events.visit_id` → `workshop_visits.id`
- `workflow_stage_history_entered_by_fkey`: `workflow_stage_history.entered_by` → `profiles.id`
- `workflow_stage_history_exited_by_fkey`: `workflow_stage_history.exited_by` → `profiles.id`
- `workflow_stage_history_vehicle_id_fkey`: `workflow_stage_history.vehicle_id` → `vehicles.id`
- `workflow_stage_history_visit_id_fkey`: `workflow_stage_history.visit_id` → `workshop_visits.id`
- `workshop_visits_current_assigned_to_fkey`: `workshop_visits.current_assigned_to` → `profiles.id`
- `workshop_visits_vehicle_id_fkey`: `workshop_visits.vehicle_id` → `vehicles.id`

### 6.3 Constraints and indexes

- **Foreign keys:** listed above from the export.
- **Live constraints specifically inspected for `vehicle_jobs` and `workshop_visits`:** primary keys and foreign keys were observed; check constraints exist for stage/status/job/approval-related fields. The exact complete constraint definitions/names were not captured for every table in the conversation.
- **Indexes:** the schema export provided to the conversation does not contain index metadata. Therefore a complete index inventory is **NEEDS VERIFICATION**. Do not invent indexes.
- **Unique constraints:** the inspected `vehicle_jobs` definition did not show a unique `vehicle_id` constraint; this is significant because multiple/historical jobs may exist and active-job queries therefore use `current_job_stage <> 'CLOSED'` + latest creation time. Verify actual indexes/unique constraints before changing job selection semantics.

### 6.4 RLS policies (inventory captured in source export; live completeness NEEDS VERIFICATION)

#### `advisor_work` policies

- **advisor_work_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `approval_cycles` policies

- **approval_cycles_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `billing_records` policies

- **billing_records_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `billing_steps` policies

- **billing_steps_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `business_types` policies

- **Authenticated users can view business types** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `true`
- **CEO Admin can insert business types** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`
- **CEO Admin can update business types** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`

#### `claim_intimations` policies

- **claim_intimations_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `document_master` policies

- **Authenticated users can view active documents** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `((is_active = true) AND (EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true)))))`
- **CEO Admin can insert documents** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
- **CEO Admin can update documents** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`

#### `final_inspections` policies

- **final_inspections_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `floor_work_cycles` policies

- **floor_work_cycles_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `floor_work_items` policies

- **floor_work_items_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `floor_work_progress` policies

- **Assigned staff can view floor progress** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM ((vehicle_jobs j<br>     JOIN vehicles v ON ((v.id = j.vehicle_id)))<br>     JOIN profiles p ON ((p.id = auth.uid())))<br>  WHERE ((j.id = floor_work_progress.job_id) AND (p.is_active = true) AND ((((p.role)::text = 'floor_incharge'::text) AND (j.floor_incharge_id = auth.uid())) OR (((p.role)::text = 'advisor'::text) AND ((j.advisor_id = auth.uid()) OR (v.current_assigned_to = auth.uid()))) OR ((p.role)::text = 'ceo_admin'::text)))))`

#### `gate_entries` policies

- **gate_entries_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `gate_exits` policies

- **gate_exits_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `insurance_companies` policies

- **Authenticated users can view insurance companies** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `true`
- **CEO Admin can insert insurance companies** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`
- **CEO Admin can update insurance companies** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`

#### `job_floor_tasks` policies

- **job_floor_tasks_insert_operational_users** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true) AND ((p.role)::text = ANY ((ARRAY['floor_incharge'::character varying, 'advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
- **job_floor_tasks_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true) AND ((p.role)::text = ANY ((ARRAY['watchman'::character varying, 'advisor'::character varying, 'floor_incharge'::character varying, 'ceo_admin'::character varying])::text[])))))`
- **job_floor_tasks_update_operational_users** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true) AND ((p.role)::text = ANY ((ARRAY['floor_incharge'::character varying, 'advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true) AND ((p.role)::text = ANY ((ARRAY['floor_incharge'::character varying, 'advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`

#### `job_type_conversions` policies

- **job_type_conversions_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `mi_types` policies

- **Authenticated users can view MI types** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `true`
- **CEO Admin can insert MI types** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`
- **CEO Admin can update MI types** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`

#### `part_handovers` policies

- **part_handovers_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `part_orders` policies

- **part_orders_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `part_requisitions` policies

- **part_requisitions_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `payments` policies

- **payments_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `profiles` policies

- **Authenticated users can insert profiles** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(auth.uid() = id)`
- **Authenticated users can view all profiles** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `true`
- **CEO Admin can update profiles** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles admin_profile<br>  WHERE ((admin_profile.id = auth.uid()) AND ((admin_profile.role)::text = 'ceo_admin'::text) AND (admin_profile.is_active = true))))`
  - WITH CHECK: `(((role)::text = (( SELECT p.role<br>   FROM profiles p<br>  WHERE (p.id = profiles.id)))::text) AND (is_active = ( SELECT p.is_active<br>   FROM profiles p<br>  WHERE (p.id = profiles.id))))`
- **Users can update own profile data** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(auth.uid() = id)`
  - WITH CHECK: `((auth.uid() = id) AND ((role)::text = (( SELECT p.role<br>   FROM profiles p<br>  WHERE (p.id = auth.uid())))::text) AND (is_active = ( SELECT p.is_active<br>   FROM profiles p<br>  WHERE (p.id = auth.uid()))) AND (created_at = ( SELECT p.created_at<br>   FROM profiles p<br>  WHERE (p.id = auth.uid()))))`

#### `ready_for_delivery` policies

- **ready_for_delivery_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `supplementary_cycles` policies

- **supplementary_cycles_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `surveys` policies

- **surveys_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `vehicle_assignments` policies

- **vehicle_assignments_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `vehicle_documents` policies

- **Advisor and CEO Admin can insert vehicle documents** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
- **Advisor and CEO Admin can update vehicle documents** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
- **Authenticated users can view vehicle documents** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true))))`

#### `vehicle_events` policies

- **Authenticated users can view vehicle events** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true))))`
- **CEO Admin can create vehicle events** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
- **CEO Admin can delete vehicle events** — `DELETE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
- **CEO Admin can update vehicle events** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`

#### `vehicle_history` policies

- **Advisor and CEO Admin can create vehicle history** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
- **Authenticated users can view vehicle history** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true))))`

#### `vehicle_intake` policies

- **vehicle_intake_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `vehicle_jobs` policies

- **Advisor and CEO Admin can create vehicle jobs** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
- **Advisor and CEO Admin can update vehicle jobs** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
- **Authenticated users can view vehicle jobs** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true))))`

#### `vehicle_models` policies

- **Authenticated users can view vehicle models** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `true`
- **CEO Admin can insert vehicle models** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`
- **CEO Admin can update vehicle models** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'ceo_admin'::text) AND (profiles.is_active = true))))`

#### `vehicle_photos` policies

- **Authenticated users can view vehicle photos** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true))))`
- **Authorized users can create vehicle photo records** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['watchman'::character varying, 'advisor'::character varying, 'ceo_admin'::character varying])::text[])))))`
- **Only CEO Admin can delete vehicle photo records** — `DELETE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
- **Only CEO Admin can update vehicle photos** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`

#### `vehicles` policies

- **Authenticated users can view vehicles** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true))))`
- **CEO Admin can delete vehicles** — `DELETE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
- **CEO Admin can update vehicles** — `UPDATE` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = 'ceo_admin'::text))))`
- **Watchman and CEO Admin can create vehicles** — `INSERT` / PERMISSIVE / roles `{authenticated}`
  - WITH CHECK: `(EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role)::text = ANY ((ARRAY['watchman'::character varying, 'ceo_admin'::character varying])::text[])))))`

#### `visit_document_checklist` policies

- **visit_document_checklist_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `work_type_master` policies

- **work_type_master_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `workflow_events` policies

- **workflow_events_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `workflow_stage_history` policies

- **workflow_stage_history_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

#### `workshop_visits` policies

- **workshop_visits_select_active_users** — `SELECT` / PERMISSIVE / roles `{authenticated}`
  - USING: `(EXISTS ( SELECT 1<br>   FROM profiles p<br>  WHERE ((p.id = auth.uid()) AND (p.is_active = true))))`

### 6.5 PostgreSQL functions / RPC inventory

| Function | Arguments | Returns |
|---|---|---|
| `advance_vehicle_after_floor` | `p_vehicle_id uuid` | `jsonb` |
| `assign_floor_incharge` | `p_vehicle_id uuid, p_floor_incharge_id uuid, p_remarks text` | `json` |
| `assign_vehicle_to_advisor` | `p_vehicle_id uuid, p_advisor_id uuid` | `json` |
| `assign_vehicle_to_floor_incharge` | `p_vehicle_id uuid, p_floor_incharge_id uuid` | `json` |
| `change_document_master_status` | `p_document_id uuid, p_is_active boolean` | `void` |
| `change_user_role` | `target_user_id uuid, new_role text` | `void` |
| `change_user_status` | `target_user_id uuid, new_status boolean` | `void` |
| `complete_floor_work` | `p_vehicle_id uuid` | `jsonb` |
| `gate_in_vehicle` | `p_vehicle_no text, p_customer_name text, p_customer_mobile text, p_vehicle_model_id uuid, p_vehicle_type text` | `json` |
| `gate_out_vehicle` | `p_vehicle_id uuid, p_remarks text` | `json` |
| `get_admin_document_master` | `` | `TABLE(id uuid, name text, vehicle_type text, workflow_stage text, requirement_type text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)` |
| `get_admin_users` | `` | `TABLE(id uuid, name character varying, email character varying, phone character varying, role character varying, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)` |
| `handle_new_user` | `` | `trigger` |
| `mark_vehicle_total_loss` | `p_vehicle_id uuid, p_remarks text` | `json` |
| `new_workflow_assign_advisor` | `p_visit_id uuid, p_advisor_id uuid, p_remarks text` | `jsonb` |
| `new_workflow_claim_intimation` | `p_visit_id uuid, p_estimate_id text, p_claim_no text, p_remarks text` | `jsonb` |
| `new_workflow_claim_intimation` | `p_visit_id uuid, p_estimate_id text, p_claim_no text, p_claim_intimated_at timestamp with time zone, p_remarks text` | `jsonb` |
| `new_workflow_complete_survey` | `p_visit_id uuid, p_paid_amount numeric, p_receipt_reference_no text, p_remarks text, p_survey_completed_at timestamp with time zone, p_approval_status text, p_approval_received_at timestamp with time zone, p_assessment_sheet_photo_path text` | `jsonb` |
| `new_workflow_complete_survey` | `p_visit_id uuid, p_paid_amount numeric, p_receipt_reference_no text, p_remarks text` | `jsonb` |
| `new_workflow_create_part_order` | `p_visit_id uuid, p_part_order_no text, p_order_type text, p_ordered_at timestamp with time zone, p_remarks text` | `jsonb` |
| `new_workflow_gate_in` | `p_vehicle_no text, p_gate_in_photo_path text, p_remarks text` | `json` |
| `new_workflow_gate_out` | `p_visit_id uuid, p_remarks text` | `jsonb` |
| `new_workflow_hand_over_parts_to_floor` | `p_part_order_id uuid, p_floor_incharge_id uuid, p_handed_over_at timestamp with time zone, p_remarks text` | `jsonb` |
| `new_workflow_move_stage` | `p_visit_id uuid, p_vehicle_id uuid, p_new_stage text, p_new_status text, p_remarks text` | `void` |
| `new_workflow_process_advisor_work` | `p_visit_id uuid, p_work_path text, p_requisition_no text, p_requisition_at timestamp with time zone, p_remarks text` | `jsonb` |
| `new_workflow_process_approval` | `p_visit_id uuid, p_decision text, p_decision_at timestamp with time zone, p_remarks text, p_hold_remark text, p_photo_reference text` | `jsonb` |
| `new_workflow_receive_parts` | `p_part_order_id uuid, p_parts_received_at timestamp with time zone, p_remarks text` | `jsonb` |
| `new_workflow_save_vehicle_intake` | `p_visit_id uuid, p_customer_name text, p_customer_mobile text, p_vehicle_type text, p_vehicle_model_id uuid, p_arena_nexa text, p_insurance_type text, p_mi_type_id uuid, p_insurance_company_id uuid, p_worker_group text, p_job_card_no text, p_advisor_remarks text` | `jsonb` |
| `new_workflow_user_role` | `` | `text` |
| `record_vehicle_approval` | `p_vehicle_id uuid, p_approval_status text, p_approval_by_type text, p_approval_remarks text, p_partial_approval_choice text` | `json` |
| `require_new_workflow_role` | `p_roles text[]` | `text` |
| `resolve_insurance_rejection` | `p_vehicle_id uuid, p_customer_choice text, p_remarks text` | `json` |
| `return_vehicle_at_gate` | `p_vehicle_no text, p_customer_name text, p_customer_mobile text, p_vehicle_model_id uuid, p_vehicle_type text, p_remarks text` | `json` |
| `rls_auto_enable` | `` | `event_trigger` |
| `save_advisor_intake` | `p_vehicle_id uuid, p_customer_name text, p_customer_mobile text, p_vehicle_type text, p_vehicle_model_id uuid, p_assigned_advisor_id uuid` | `jsonb` |
| `save_advisor_intake_with_documents` | `p_vehicle_id uuid, p_customer_name text, p_customer_mobile text, p_vehicle_type text, p_vehicle_model_id uuid, p_assigned_advisor_id uuid, p_documents jsonb` | `jsonb` |
| `save_document_master` | `p_document_id uuid, p_name text, p_vehicle_type text, p_workflow_stage text, p_requirement_type text` | `uuid` |
| `start_floor_work` | `p_vehicle_id uuid` | `jsonb` |
| `start_vehicle_survey` | `p_vehicle_id uuid, p_job_type text, p_job_card_no text, p_insurance_company_id uuid, p_claim_intimation_at timestamp with time zone, p_survey_at timestamp with time zone, p_customer_approval_at timestamp with time zone, p_paid_job_remarks text, p_advisor_remarks text, p_estimate_id text, p_claim_no text, p_mi_type_id uuid` | `json` |
| `sync_gate_in_photo_job_id` | `` | `trigger` |
| `take_vehicle_as_advisor` | `p_vehicle_id uuid` | `json` |
| `update_updated_at` | `` | `trigger` |
| `watchman_gate_in_vehicle` | `p_vehicle_no text` | `json` |

**Function definitions are not fully included in the schema-export file.** The important verified definitions/behaviors are documented in §7. Exact SQL for every remaining function must be read from the live database before modification.

### 6.6 Triggers

| Table | Trigger | Timing | Event | Action |
|---|---|---|---|---|
| `advisor_work` | `advisor_work_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `billing_records` | `billing_records_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `business_types` | `business_types_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `document_master` | `document_master_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `floor_work_cycles` | `floor_work_cycles_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `floor_work_items` | `floor_work_items_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `insurance_companies` | `insurance_companies_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `mi_types` | `mi_types_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `profiles` | `profiles_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `supplementary_cycles` | `supplementary_cycles_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `vehicle_events` | `trg_sync_gate_in_photo_job_id` | AFTER | UPDATE | `EXECUTE FUNCTION sync_gate_in_photo_job_id()` |
| `vehicle_intake` | `vehicle_intake_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `vehicle_jobs` | `vehicle_jobs_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `vehicle_models` | `vehicle_models_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `vehicles` | `vehicles_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `visit_document_checklist` | `visit_document_checklist_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `work_type_master` | `work_type_master_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |
| `workshop_visits` | `workshop_visits_updated_at` | BEFORE | UPDATE | `EXECUTE FUNCTION update_updated_at()` |

### 6.7 Not fully captured by the provided export

- Supabase Storage bucket definitions and Storage RLS policies: **NEEDS VERIFICATION**.
- `auth.users` schema and Auth provider configuration: **NEEDS VERIFICATION**.
- Grants/privileges, database extensions, custom types/enums, sequences, materialized views: **NEEDS VERIFICATION** unless visible in the live DB.
- Complete index inventory: **NEEDS VERIFICATION**.

## 7. Verified key database workflows/functions

### 7.1 `new_workflow_save_vehicle_intake` — CURRENT, VERIFIED

Signature: `new_workflow_save_vehicle_intake(uuid,text,text,text,uuid,text,text,uuid,uuid,text,text,text)` returning `jsonb`.
- Requires authenticated active profile and role `advisor` or `ceo_admin` (only advisor can accept a previously unassigned `PENDING_ADVISOR` vehicle).
- Locks the `workshop_visits` row and vehicle row.
- Accepts stages `PENDING_ADVISOR` or `ADVISOR_ASSIGNED`; advisor ownership is enforced for already-assigned vehicles.
- Validates customer info, `PRIVATE|COMMERCIAL`, active vehicle model, `ARENA|NEXA`, `PAID|INSURANCE`, worker group `CNT|PNPL`, and required job-card number.
- Insurance requires active MI/NON-MI type and active insurance company; Paid requires those insurance fields to be NULL.
- Creates/updates advisor assignment when accepting an unassigned vehicle.
- **Creates `vehicle_intake` and then creates `vehicle_jobs` in the same transaction.** This is now the expected behavior.
- New job fields include advisor, job type, job card, vehicle type, Arena/Nexa, insurance company, approval status `PENDING`, current job stage `ADVISOR`, snapshots, remarks, etc.
- Updates `vehicles` and `workshop_visits` to either `PENDING_SURVEY/IN_PROGRESS` for Paid or `CLAIM_INTIMATION/IN_PROGRESS` for Insurance.
- Creates document checklist rows from active `document_master` records for `VEHICLE_INTAKE`.
- Creates `workflow_stage_history` and `workflow_events` with intake/job/assignment metadata.

### 7.2 `new_workflow_complete_survey` — CURRENT DESIGN, VERIFIED

Two overloads exist:
- `new_workflow_complete_survey(uuid,numeric,text,text,timestamptz,text,timestamptz,text)`
- `new_workflow_complete_survey(uuid,numeric,text,text)`
- Both are advisor-only and require `PENDING_SURVEY`, active assignment, and an existing active `vehicle_jobs` row where `current_job_stage <> 'CLOSED'`.
- The current function explicitly states: **“Intake now creates the vehicle_jobs record. Survey updates that same record.”**
- If an active job is absent, the function raises `Active vehicle job not found for this vehicle.` This guard must not be weakened.
- Survey creates the survey record and updates the existing job’s `survey_at` and `advisor_remarks`.
- Approval status `PENDING` opens `PENDING_APPROVAL`; approval status `RECEIVED` opens `ADVISOR_WORK` and records the assessment-sheet photo.

### 7.3 `new_workflow_process_approval` — CURRENT, REPAIRED, VERIFIED

Signature: `new_workflow_process_approval(uuid,text,timestamptz,text,text,text)` returning `jsonb`.
- Active authenticated profile; role `advisor` or `ceo_admin`; advisor ownership enforced.
- Locks visit/vehicle and requires `PENDING_APPROVAL` with `PENDING|IN_PROGRESS` status.
- Requires an existing active `vehicle_jobs` row and validates/links the approval photo.
- Supports `APPROVED`, `APPROVAL_HOLD`, `CLAIM_REJECTED`, `TOTAL_LOSS` decisions.
- **Approval-cycle repair:** when an existing latest approval cycle has `decision='PENDING'`, the RPC reuses that cycle instead of inserting a new cycle. This prevents an unnecessary cycle increment after Hold → Resolve → Approve.
- `APPROVED` updates job approval fields and transitions to `ADVISOR_WORK/PENDING`.
- `APPROVAL_HOLD` updates job approval state to pending and transitions to `APPROVAL_HOLD/ON_HOLD`.
- `CLAIM_REJECTED` marks job approval rejected and transitions to `CLAIM_REJECTED/REJECTED`.
- `TOTAL_LOSS` transitions to `PENDING_GATE_OUT/PENDING` and clears assignment; workshop history preserves the loss event.

### 7.4 `new_workflow_resolve_approval_hold` — CURRENT, REPAIRED, VERIFIED

- Authenticates active profile; roles `advisor|ceo_admin`; advisor ownership is enforced.
- Locks visit and vehicle; requires `APPROVAL_HOLD/ON_HOLD`.
- Finds and locks the latest hold cycle (`approval_hold_at` non-null, decision `APPROVAL_HOLD`).
- **Critical repair:** updates that same `approval_cycles` row to `decision='PENDING'` while preserving `approval_hold_at` and `approval_hold_remark`.
- Closes the hold stage history, records `APPROVAL_HOLD_RESOLVED`, opens `PENDING_APPROVAL`, and preserves the current assignment.
- Resolve Hold does **not** approve the vehicle; the advisor must return to Approval and explicitly approve or hold again.

### 7.5 Other important function families

- Gate in/out: `new_workflow_gate_in`, `new_workflow_gate_out`, `gate_in_vehicle`, `gate_out_vehicle`, `watchman_gate_in_vehicle`, `return_vehicle_at_gate`.
- Advisor assignment: `new_workflow_assign_advisor`, `assign_vehicle_to_advisor`, `take_vehicle_as_advisor`.
- Advisor work: `new_workflow_process_advisor_work`, `record_vehicle_approval`.
- Parts/store: `new_workflow_create_part_order`, `new_workflow_receive_parts`, `new_workflow_hand_over_parts_to_floor`, plus lower-level `assign_*` functions.
- Floor: `start_floor_work`, `complete_floor_work`, `advance_vehicle_after_floor`, `assign_floor_incharge`, `assign_vehicle_to_floor_incharge`.
- Admin/config: document master, user status/role, business types, etc. See function inventory.
- Role helpers: `new_workflow_user_role`, `require_new_workflow_role`.

## 8. Authentication

- Authentication is through **Supabase Auth**.
- RPCs use `auth.uid()` and then query `public.profiles` for an active profile and role.
- Inactive profiles are blocked from workflow mutations and many RLS reads.
- A public function `handle_new_user()` exists and returns `trigger`; the trigger on `auth.users` that invokes it was not part of the public-trigger export and is **NEEDS VERIFICATION**.
- Do not hard-code role authorization in the frontend alone. Backend RPC checks and RLS are part of the security model.

## 9. Roles and permissions

| Role | Core responsibility | Confirmed permission notes |
|---|---|---|
| `ceo_admin` | Elevated management/oversight across workflow and master data | Can access Approval/Approval Hold broadly; several master-data INSERT/UPDATE policies explicitly check `ceo_admin`; backend RPCs commonly allow `advisor|ceo_admin` |
| `advisor` | Customer intake, claim, survey, approval decisions, advisor work, coordination with Store/Floor | Ownership is strict on advisor-side workflow; can accept unassigned vehicles; approval/hold/resolve requires assigned advisor unless CEO Admin |
| `watchman` | Gate In / Gate Out | Gate RPCs/functions exist; exact UI permissions need repo verification |
| `store_team` | Parts order/receipt/store-to-floor handover | Function set exists; exact UI/RPC role checks need verification |
| `floor_incharge` | Floor assignment/work | Floor-specific schema/functions exist; exact role policy details should be rechecked before changes |
| `final_inspector` | Final inspection pass/fail | Table/function exists; exact implemented frontend flow is pending |
| Billing Executive (`billing_executive` in detailed handoff; `billing_department` in pasted source) | Billing/invoice/payment | Actual stored role/mapping NEEDS VERIFICATION; workflow remains pending |

### Advisor ownership rule (must preserve)

Once a vehicle is assigned to an advisor, other advisors must not open/edit/approve/hold/take over that advisor-side workflow. CEO Admin has elevated access only where the existing RPC explicitly permits it. Source history reports enforcement in key RPCs; verify current enforcement in UI + database. The exported SELECT policies on several workflow tables allow active users broadly, so this inventory alone does not prove assignment-scoped reads. Investigate the actual read/RPC boundary rather than claiming every exported policy enforces ownership.

## 10. Complete application workflow

### End-to-end lifecycle (business diagram; not an exact database enum inventory)

```text
GATE_IN
  ↓
PENDING_ADVISOR_ASSIGNMENT
  ↓
VEHICLE_INTAKE
  ├─ PAID ─────────────→ PENDING_SURVEY
  └─ INSURANCE → CLAIM_INTIMATION → PENDING_SURVEY
  ↓
SURVEY
  ↓
PENDING_APPROVAL
  ├─ APPROVE → ADVISOR_WORK
  ├─ HOLD → APPROVAL_HOLD → RESOLVE → PENDING_APPROVAL
  ├─ CLAIM_REJECTED → rejected handling / paid conversion or gate out (business path)
  └─ TOTAL_LOSS → PENDING_GATE_OUT
  ↓
ADVISOR_WORK
  ├─ PARTS_ONLY → STORE
  ├─ PARTS + DENTING/PAINTING → STORE → FLOOR
  └─ DENTING/PAINTING_ONLY → FLOOR
  ↓
SUPPLEMENTARY LOOP (as required, unlimited cycles)
  ↓
FLOOR / FLOOR_INCHARGE
  ↓
FINAL_INSPECTION
  ├─ PASS → BILLING
  └─ FAIL → FLOOR/WORKSHOP → FINAL_INSPECTION (attempt history retained)
  ↓
BILLING
  ↓
READY_FOR_DELIVERY
  ↓
PENDING_GATE_OUT
  ↓
GATE_OUT → lifecycle complete
```

### Gate In / Watchman

- Vehicle registration/number, gate-in timestamp, responsible watchman, and gate-in photo.
- System timestamp should be India-aware through the Postgres timestamptz model; do not invent client-only timestamps.

### Advisor assignment/intake

- Waiting vehicle opens Intake without prematurely assigning it unless the advisor successfully performs the atomic accept/save operation.
- Intake fields: customer name/mobile, Private/Commercial, active vehicle model, Arena/Nexa, insurance type, MI/non-MI, insurance company, worker group, job card, remarks, documents/photos where applicable.
- Save-and-accept must be atomic: save succeeds before assignment becomes effective.

### Claim intimation

- Insurance workflow requires estimate ID + claim number + claim-intimation date/time + remarks as applicable.

### Survey

- Paid workflow stores paid amount and receipt/reference.
- Insurance workflow can record approval received timestamp and assessment-sheet photo; pending approval opens `PENDING_APPROVAL`.

### Approval / Hold

- Approval has Approve and Put on Hold paths.
- Hold requires mandatory hold remark and approval assignment photo according to current RPC.
- Resolve Hold returns to Approval and does not auto-approve.
- Approval cycles are retained for history; a resolved hold is converted to `PENDING` within the same cycle for subsequent approval.

### Advisor Work

- Work path choices: only parts / parts+denting-painting / only denting-painting.
- Parts path requires requisition number/time. Store receives and hands over parts to floor where applicable.

### Supplementary

- Triggered during stripping when additional work is found.
- Work stops → Floor → Advisor → Survey → Approval → back to Floor.
- Unlimited supplementary cycles; every cycle needs separate history/timestamps.

### Final inspection

- Pass/fail.
- Fail requires reason + remarks and optionally photos; failed vehicles loop back to workshop/floor, then another inspection attempt is stored.

### Billing

- Insurance: pre-invoice sent → liability received → tax invoice generated → tax invoice sent.
- Paid: tax invoice generated and payment recorded; online payments require UTR + proof.

## 11. Features already implemented / verified

| Feature | Status | Verification notes |
|---|---|---|
| Gate In | COMPLETE | Verified through project testing |
| Gate Out | COMPLETE | Verified/marked complete in project tracker |
| Vehicle Intake | COMPLETE | Fresh test created `vehicle_jobs` correctly |
| Claim Intimation | COMPLETE | Existing RPC/UI path used successfully |
| Survey | COMPLETE | Existing RPC path used successfully |
| Approval | COMPLETE | Fresh approval cycle 1 approved successfully |
| Approval Hold | REMAINING | Latest user status explicitly marks this module remaining; underlying cycle-reuse repair exists but end-to-end feature completion is not considered complete |
| Advisor Work | COMPLETE | Marked complete in project status |
| Store for Advisor / Admin CEO | COMPLETE | Marked complete |
| Store Team | COMPLETE | Marked complete |
| Document Master backend | IMPLEMENTED BACKEND / UI NEEDS VERIFICATION | Functions/table/policies exist |

## 12. Partially implemented / needs broader verification

- Full regression test across all completed modules using a **fresh vehicle** after database fixes is still advisable.
- Approval Hold UI has list + details + custom popup behavior, but the exact source paths and latest code should be inspected in the repo before changes.
- Admin master-data screens/functions exist in backend; exact frontend completeness is not fully captured.
- Some lower-level legacy functions coexist with `new_workflow_*` functions. The active app should be traced to the functions actually called before deleting anything.

## 13. Features still planned / remaining

**Approval Hold is REMAINING and is the first current task**, as described in sections 24–26. The following modules follow it:

1. **Supplementary** — remaining at the latest status snapshot.
2. **Floor** — remaining.
3. **Floor Incharge flow** — remaining.
4. **Final Inspection** — remaining.
5. **Final Inspector flow** — remaining.
6. **Billing** — remaining.
7. **Ready for Delivery** — remaining.
8. Later analytics/reporting: throughput, waiting time, work duration, supplementary frequency, inspection failures, billing turnaround, stuck vehicles, and accountability.

## 14. UI/UX requirements and design decisions

- **Safe-area/notch safe:** use `SafeAreaView` / safe-area insets on all screens so content is never hidden under notches/status bars.
- **No native `Alert`:** use a properly styled `Modal`/custom popup dialog for confirmations, errors, success messages, and destructive actions.
- Avoid flat-looking UI.
- Avoid Gluestack default black/white appearance unless explicitly customized.
- Avoid generic Material-looking UI; prefer polished, branded, practical workshop UI.
- User is a React Native/CSS beginner and prefers complete, copy-paste-ready files rather than patch fragments.
- Prefer free UI libraries or generated styling; do not introduce paid UI dependencies without explicit approval.
- Registration search + useful filters are expected on operational queue screens.
- Details screens should expose enough context (vehicle, customer, assignment, current stage, timestamps, history) without forcing the user to navigate excessively.

## 15. API / integration details

### Frontend → Supabase

- Frontend calls Supabase Postgres RPCs using `.rpc(functionName, args)` via the configured client.
- Business rules that need atomicity/concurrency control belong in the RPC, not just the screen.
- Expected API surface includes `new_workflow_*` RPCs listed in §6.5 and §7.

### Storage

- Bucket referenced in project tests: `vehicle-photos`.
- Gate-in photo paths resemble `gate-in-pending/<filename>` in testing.
- Approval assignment photo paths resemble `vehicles/<vehicle_id>/APPROVAL/APPROVAL_ASSIGNMENT/<filename>`.
- Exact Storage policies/configuration: **NEEDS VERIFICATION**.

### External integrations

- No external third-party API integration was definitively documented beyond Supabase/EAS/GitHub. Do not invent any.

## 16. Environment variables

Required local names currently known:
```text
EXPO_PUBLIC_SUPABASE_URL=<secret/instance URL>
EXPO_PUBLIC_SUPABASE_KEY=<publishable/anon key>
```
- **Never copy actual values into this handoff or commit them to Git.**
- A previous EAS preview build issue was traced to preview environment values not being synced. After moving to another machine/account/project, verify EAS environment variables for every build profile used.
- Do not assume `.env` is transferred by Git; local `.env` is normally machine-specific and should be recreated securely.

## 17. Build/deployment configuration

- EAS account: `pagariyaauto`
- EAS project: `@pagariyaauto/pagariya-bodyshop`
- EAS project ID: `7d36a918-57ab-4265-9f90-0e540370d0ee`
- Android application ID/package: `com.pagariya.warehouse`
- `eas.json` known behavior: development/preview Android APK internal builds; production auto-increment.
- Earlier EAS project/account: `@pagariya/pagaria2` / project ID `7c7bac72-cd07-45fa-9a04-103a12d0ee` — **OBSOLETE**; do not reconnect the project to the old account unless explicitly migrating back.
- GitHub remote currently intended: `https://github.com/PagariyaAuto/Pagariya.git`.

## 18. Important bugs encountered and fixes

### 18.1 EAS/environment mismatch — fixed operationally

- Symptom: preview build crashed because `.env` values were not present in EAS preview environment after project/account changes.
- Fix: add the same required environment variables to the EAS preview environment; on a new machine recreate local `.env` securely.

### 18.2 Intake-created job missing on an old test vehicle — diagnosed

- Vehicle: `MH12KL5464` (`843b58b3-856c-4de4-8b15-584b84f247e9`).
- It had `vehicle_intake` and reached `PENDING_APPROVAL`, but `vehicle_jobs` was absent.
- Its historical `VEHICLE_INTAKE` event had `intake_id` but no `job_id`/`vehicle_job_id` metadata, showing it used an older Intake implementation.
- Current Intake implementation now creates `vehicle_jobs` and records job IDs in event metadata.
- **Decision:** do not weaken Survey/Approval to tolerate missing jobs and do not manually insert a job for this historical test vehicle merely to hide the problem.

### 18.3 Approval Hold created Cycle 2 after Resolve — fixed

- Old behavior: Hold created cycle 1 with `decision=APPROVAL_HOLD`; Resolve returned the visit to Approval but left cycle 1 as `APPROVAL_HOLD`; Approve therefore inserted cycle 2.
- Fix: Resolve Hold now changes the same approval cycle `decision` to `PENDING` while preserving hold timestamps/remark. Approval then reuses that pending cycle.
- Fresh approval testing now yields a single `INITIAL` cycle approved successfully.

### 18.4 SQL editor errors during investigation — not application bugs

- A PL/pgSQL fragment referencing `v_visit` was pasted as standalone SQL, producing `42P01 missing FROM-clause entry for table v_visit`.
- `IF NOT FOUND THEN` was pasted outside a PL/pgSQL function, producing `42601 syntax error at or near IF`.
- **Rule:** run complete `CREATE OR REPLACE FUNCTION ...` blocks for PL/pgSQL; do not run isolated internal fragments in the SQL editor.

## 19. Current unresolved problems / verification items

- **Historical test data:** `MH12KL5464` has no `vehicle_jobs` row. Leave it alone unless a deliberate test-data repair/reset is requested.
- **Full repo version inventory:** latest handoff reports Expo 57.0.22 and Expo Router 57.0.21; confirm these and obtain React/React Native/TypeScript/Supabase/Node/npm versions from the repo and runtime. Current versions are NEEDS VERIFICATION.
- **Exact route tree:** needs repo inspection.
- **Database index inventory:** needs live query/inspection.
- **Full constraint inventory:** only partial live constraint data was captured for key tables; needs verification before structural changes.
- **Storage policies:** needs verification.
- **Potential multiple active/historical jobs:** there is no confirmed unique constraint on `vehicle_jobs.vehicle_id`. Verify whether business logic guarantees one open job; preserve the existing active-job selection until this is understood.
- **Timestamp consistency:** one old test showed a user-entered decision timestamp earlier than the RPC/event creation timestamp. This may be intentional because the UI accepts a decision time; verify product intent before changing timestamp semantics.
- **Remaining workflow modules:** Approval Hold, Supplementary, Floor, Floor Incharge, Final Inspection, Final Inspector, Billing, Ready for Delivery remain to be completed/verified.

## 20. Technical decisions and rationale

- **Module-specific normalized tables:** avoid a giant `vehicles` table for every workflow fact; keep intake, claims, surveys, approvals, work, store, floor, inspection, billing, etc. in dedicated tables.
- **Event/history is append-oriented:** retain completed events and stage history instead of overwriting the past.
- **Atomic workflow mutations:** important transitions are RPC transactions with row locks so two advisors cannot concurrently accept/process the same vehicle.
- **Advisor ownership:** assignment stays attached to the workflow unless a terminal condition explicitly clears it (e.g. Total Loss).
- **Approval Hold is a branch of Approval, not a separate approval universe.** Resolve returns to approval and the same cycle becomes pending.
- **Dynamic master data:** vehicle models, documents, work types, insurance companies, MI types, etc. should be admin-maintainable and deactivated rather than hard-deleted when history matters.
- **v1 parts tracking:** track requisition/order/receipt/handover events, not individual part quantities/costs. That was explicitly deferred.
- **Supplementary cycles:** unlimited and auditable rather than a single overwriteable supplementary flag.

## 21. Obsolete / abandoned approaches — do not reuse

### OBSOLETE: Intake implementation that did not create `vehicle_jobs`

The historical implementation used by `MH12KL5464` created `vehicle_intake` but left no job row. The current design explicitly creates `vehicle_jobs` at Intake. Do not restore the old behavior.

### OBSOLETE: Approval RPC that always inserted a new cycle

That implementation caused Hold → Resolve → Approve to create an unnecessary Cycle 2. The repaired RPC reuses an existing pending cycle.

### OBSOLETE: Resolve Hold that only changed stage/status

It did not update `approval_cycles.decision`, which caused the duplicate cycle problem. The current Resolve Hold updates the cycle to `PENDING`.

### ABANDONED: Manually inserting a `vehicle_jobs` row for the broken historical test vehicle

Rejected because it would hide an upstream historical-path discrepancy. Only repair test data deliberately as part of a controlled reset/migration.

### ABANDONED: Weakening Survey/Approval to allow missing active jobs

Rejected. The missing-job guard is an intentional invariant: a valid intake path must have an active job.

### OBSOLETE UI approach: native `Alert`

Do not reintroduce native `Alert`. Use custom modal/dialog components.

## 22. Coding conventions and patterns to preserve

- Prefer one complete copy-paste-ready file when a screen is being changed; avoid scattered patch fragments unless the change specifically requires multiple files.
- Use TypeScript types for RPC results and database rows where practical.
- Use `useLocalSearchParams` / Expo Router params consistently with existing screens.
- Use `SafeAreaView` from `react-native-safe-area-context` and preserve notch-safe layout.
- Use styled `Modal`/dialog components instead of `Alert`.
- Keep workflow business rules in Supabase RPCs; keep frontend responsible for presentation, validation for UX, loading, routing, and displaying server errors.
- Preserve audit fields (`*_at`, `*_by`, `created_at`, `updated_at`) and workflow history/event inserts whenever a transition is made.
- Use row locking (`FOR UPDATE`) in transactional RPCs when concurrency matters.
- Do not delete historical rows merely to simplify screens; hide/deactivate master data where appropriate.
- Prefer exact existing RPC signatures and table columns; inspect the live database before writing replacement SQL.

## 23. Things that must NOT be changed or broken

- Do not break existing completed Gate In, Gate Out, Intake, Claim Intimation, Survey, Approval, Advisor Work, Store for Advisor/CEO Admin, and Store Team flows. Approval Hold is currently remaining and must be completed without regressing Approval.
- Do not remove or bypass active-user/role checks, advisor ownership, row locking, or RLS.
- Do not make Approval accept a vehicle without an active `vehicle_jobs` row.
- Do not make Resolve Hold silently approve a vehicle.
- Do not cause Hold → Resolve → Approve to create a duplicate approval cycle when the same cycle can be reused.
- Do not overwrite or delete approval/hold history.
- Do not change the EAS package/project identity without explicit migration planning.
- Do not commit `.env` secrets.
- Do not reintroduce native `Alert` or unsafe under-notch layouts.
- Do not perform large rewrites of completed modules when a targeted fix is sufficient.

## 24. Current development status (2026-10-02) — LATEST USER STATUS

### Workflow status snapshot

| Stage/module | Status |
|---|---|
| Gate In | ✅ Completed |
| Gate Out | ✅ Completed |
| Vehicle Intake | ✅ Completed |
| Claim Intimation | ✅ Completed |
| Survey | ✅ Completed |
| Approval | ✅ Completed and freshly verified |
| Approval Hold | ⏳ Remaining |
| Supplementary | ⏳ Remaining |
| Advisor Work | ✅ Completed |
| Store for Advisor / Admin CEO | ✅ Completed |
| Store Team | ✅ Completed |
| Floor | ⏳ Remaining |
| Floor Incharge | ⏳ Remaining |
| Final Inspection | ⏳ Remaining |
| Final Inspector | ⏳ Remaining |
| Billing | ⏳ Remaining |
| Ready for Delivery | ⏳ Remaining |

### Fresh verification vehicle

- Vehicle ID: `8e06350f-8dc8-4288-b3d9-1e02a45e1454`
- Job ID: `b1bfde6b-178c-4f85-a6f4-85a08d2cf320`
- Job type: `INSURANCE`
- Job card: `36363636`
- `approval_status=PENDING`, `current_job_stage=ADVISOR` immediately after Intake.
- Approval test ended with exactly one `INITIAL` approval cycle, `decision=APPROVED` and `approval_received_at=2026-10-02 11:38:13.46+00`.

### Latest status supplied by the project owner

```text
Gate In — Watchman                     COMPLETE
Gate Out — Watchman                    COMPLETE
Vehicle Intake                         COMPLETE
Claim Intimation                       COMPLETE
Survey                                 COMPLETE
Approval                               COMPLETE
Approval Hold                          REMAINING
Supplementary                          REMAINING
Advisor Work                           COMPLETE
Store — Advisor / CEO Admin            COMPLETE
Store Team                             COMPLETE
Floor — Advisor / CEO Admin            REMAINING
Floor Incharge Flow                    REMAINING
Final Inspection — Advisor / CEO Admin REMAINING
Final Inspector Flow                   REMAINING
Billing                                REMAINING
Ready for Delivery                     REMAINING
```

This latest owner-supplied status overrides older handoff snapshots that marked Approval Hold complete.

## 25. Exact most-recent feature/problem context

The latest development work before this handoff focused on the Store Team backend. `new_workflow_create_part_order`, `new_workflow_receive_parts`, and `new_workflow_hand_over_parts_to_floor` were deployed successfully. The latest user status then explicitly reset the project tracker to: Approval Hold remaining; Supplementary remaining; Floor remaining; Floor Incharge remaining; Final Inspection remaining; Final Inspector remaining; Billing remaining; Ready for Delivery remaining. Earlier Approval Hold cycle-reuse repair remains relevant, but Hold is not to be treated as complete until its current UI/RPC/end-to-end behavior is inspected and verified.

**Current task frontier:** complete **Approval Hold** first, then implement/verify **Supplementary**, followed by Floor, Floor Incharge, Final Inspection, Final Inspector, Billing, and Ready for Delivery.

## 26. Recommended next steps

1. Verify the actual repository remote first because the sources disagree on `Pagariya` versus `Pagaria`. The latest handoffs intend `https://github.com/PagariyaAuto/Pagariya.git`. Once confirmed, clone/open the correct repository and verify `refactor/vehicle-workflow` inside the actual project folder, not its parent; preserve existing local changes.
2. Inspect `package.json`, lockfile, `app.json/app.config.*`, `eas.json`, route tree, and `lib/supabase`; confirm Expo SDK 57.0.22 / expo-router 57.0.21 and record exact React Native/TypeScript/Supabase package versions from the repo.
3. Recreate local `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`; verify EAS environment variables for the build profiles actually used, without exposing secrets.
4. Run a fresh local startup/build and authenticate with an active test profile.
5. Regression-test completed modules with a fresh vehicle before changing them: Gate In → Intake → Claim Intimation → Survey → Approval → Advisor Work → Store.
6. **Complete Approval Hold**: inspect the live current Hold list/details UI and all related RPC definitions; verify mandatory hold remark/photo, correct stage/status, same-cycle Resolve behavior, authorization, and audit history. Do not assume the earlier repair is sufficient.
7. Implement/verify **Supplementary** using the existing `supplementary_cycles`, `floor_work_cycles`, `floor_work_items`, `workflow_events`, and `workflow_stage_history` architecture. Inspect all live constraints/RPCs/RLS first.
8. Implement **Floor** for Advisor/CEO Admin and the **Floor Incharge** execution flow, preserving the single-open-stage rule.
9. Implement **Final Inspection** for Advisor/CEO Admin and the **Final Inspector** operational flow.
10. Implement **Billing** for Insurance and Paid paths, including payment/UTR/proof rules.
11. Implement **Ready for Delivery**, then regression-test the complete path through Watchman Gate Out.
12. After each module, test on a fresh vehicle and verify stage/status, assignments, history, events, timestamps, and relevant module rows before proceeding.

## Repository working instructions

See AGENTS.md for concise Codex operating rules. The architecture, invariants and verification requirements in this context remain applicable.

## Appendix A — Verified database test history

### Old test vehicle with missing job (historical/obsolete path)

- Vehicle: `MH12KL5464` / vehicle ID `843b58b3-856c-4de4-8b15-584b84f247e9`
- Visit: `e22cee0d-9153-468a-a709-0547c82027c2`
- Intake ID: `8d2033a2-10a8-4468-8ac2-d0ad3a9ac2c9`
- Current `vehicle_jobs`: none.
- Historical Intake event had no `job_id` metadata.
- This explains the `Active vehicle job not found for this vehicle.` error on Approval.

### Fresh current-flow vehicle

- Vehicle ID: `8e06350f-8dc8-4288-b3d9-1e02a45e1454`
- Job ID: `b1bfde6b-178c-4f85-a6f4-85a08d2cf320`
- Visit ID: `06fa6f0c-f63e-476f-9c94-08b59b89aa00`
- Approval cycle ID: `1dd0b03a-7330-4106-a739-00a76de516b7`
- Approval cycle final state: `cycle_no=1`, `cycle_type=INITIAL`, `decision=APPROVED`.

## Appendix B — Source / confidence notes

- **VERIFIED:** project repo/account/package/branch details explicitly supplied in conversation.
- **VERIFIED:** current Intake function definition and its job creation behavior, from live function inspection pasted in conversation.
- **VERIFIED:** current Survey function requires an existing active `vehicle_jobs` row.
- **VERIFIED:** Approval cycle reuse repair installed successfully in Supabase.
- **VERIFIED:** Resolve Hold repair installed successfully and fresh approval test ended with one approved initial cycle.
- **SCHEMA SOURCE:** schema export file contains columns/FKs/RLS/function signatures/triggers but not a full DDL/index/Storage/Auth export.
- **NEEDS VERIFICATION:** exact frontend tree, exact package versions, index definitions, all check constraints, Storage policies, Auth provider/trigger attachment, and the exact active caller for every legacy function.

## Appendix C — Additional consolidated routing and operational context

These details come from `Pasted text.txt` unless stated otherwise. They preserve source-reported behavior, not a freshly inspected repository tree. Exact current files, callers, role checks and deployment state are **NEEDS VERIFICATION**.

### C.1 Authentication and role routing

`src/app/index.tsx` reportedly reads the Supabase session and `profiles.role/is_active`, listens for authentication changes, and preserves safe-area handling. No session routes to `/login`; an inactive profile is signed out and routed to `/login`.

| Source-reported role | Initial route |
|---|---|
| `advisor` | `/(tabs)/advisor` |
| `store_team` | `/(tabs)/store` |
| `watchman` | `/(tabs)/watchman/vehicles` |
| `floor_incharge` | `/(tabs)/work/floor-incharge` |
| `supervisor`, `worker_group`, `billing_department`, `ceo_admin` | `/(tabs)` |
| Unknown role | `/(tabs)` in the source snapshot; verify server authorization independently |

Known authentication route directories are `login`, `register`, `forgot-password`, and `reset-password`. Source-reported password-reset deep link: `pagariya://reset-password`; current mobile URL/session handling is NEEDS VERIFICATION.

The business-role baseline is CEO Admin, Watchman, Advisor, Store Team, Floor Incharge, Final Inspector, Billing Executive. The pasted source additionally records application/database identifiers `user`, `supervisor`, `worker_group`, and `billing_department` alongside the other snake-case roles. Its `change_user_role(uuid,text)` snapshot returns `void`, uses `SECURITY DEFINER`, and accepts `user`, `ceo_admin`, `advisor`, `floor_incharge`, `supervisor`, `worker_group`, `billing_department`, `watchman`, `store_team`, `final_inspector`. Check the live function and profile constraints before changing roles; a frontend union is not the complete backend permission matrix.

`src/app/(tabs)/_layout.tsx` reportedly provides:

- Normal workspace: Home, Vehicles, Work, Profile.
- Watchman: Home, Pending Advisor, Gate Out, Profile.
- Store Team: Home, Profile. `store/index` and Store vehicle-action remain internally routable and hidden from bottom navigation.

The Store Team Home route was repaired to return to `/(tabs)/store`; Watchman Home goes to `/(tabs)/watchman`; normal workspace Home goes to `/(tabs)`. Preserve role-aware Home navigation. Dynamic role routes use casts such as `router.replace("/(tabs)/store" as never)` because generated route types did not recognize them; do not remove the workaround without verifying route typing.

### C.2 Source-reported files and responsibilities

| Path | Responsibility |
|---|---|
| `src/app/(tabs)/advisor/index.tsx` | Advisor dashboard |
| `src/app/(tabs)/advisor/intake.tsx` | Vehicle Intake |
| `src/app/(tabs)/advisor/store-monitor/index.tsx` | Shared Advisor/CEO Admin Store Monitoring |
| `src/app/(tabs)/advisor/store-monitor/vehicle-details.tsx` | Store Monitoring details |
| `src/app/(tabs)/store/index.tsx` | Store Team dashboard |
| `src/app/(tabs)/store/vehicle-action.tsx` | Store operations |
| `src/app/(tabs)/master-data/_layout.tsx` | Headerless nested Stack; hidden from bottom tabs |
| `src/app/(tabs)/master-data/vehicle-models.tsx` | Vehicle Models master |
| `src/app/(tabs)/master-data/insurance-companies.tsx` | Insurance Companies master |
| `src/app/(tabs)/master-data/business-types.tsx` | Business Types master |
| `src/app/(tabs)/master-data/mi-types.tsx` | MI Types master |
| `src/app/(tabs)/master-data/users.tsx` | Admin user management |
| `src/app/(tabs)/master-data/document-master.tsx` | Document Master |

These paths supplement section 3; inspect actual files before creating replacements. The Advisor dashboard reportedly contains Vehicle Intake, Claim Intimation, Survey, Approval, Approval Hold, Advisor Work, Store Monitoring, Floor, Final Inspection and other entries. A visible entry does not establish feature completion.

### C.3 Store Team operations versus Store Monitoring

Store Team is operational: Store Dashboard → Store Vehicle Action → Create Part Order → Receive Parts → Hand Over to Floor. The handover reaches `HANDED_TO_FLOOR`. The latest owner marks Store Team COMPLETE and the latest handoff reports successful deployment of `new_workflow_create_part_order`, `new_workflow_receive_parts`, and `new_workflow_hand_over_parts_to_floor`.

Advisor + CEO Admin share **read-only Store Monitoring**. Advisor visibility uses `vehicle.current_assigned_to === logged-in user ID`; an incorrect inverse comparison was fixed. CEO Admin sees all relevant Store vehicles. Preserve server-side authorization as well as UI filtering.

Reported monitoring features: search, status filters, 25 vehicles per page, Previous/Next pagination, details, refresh, requisition/order details, read-only status timeline, custom popup, safe-area support, Android back handling and dashboard navigation. Filters: `ALL`, `REQUESTED`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `HANDED_TO_FLOOR`. Timeline: Parts Requested → Part Order → Parts Received → Handed to Floor.

Monitoring must not create/edit requisitions or orders, receive/handover parts, cancel/reopen orders or change Store workflow state unless a future explicit requirement changes this.

The Create Part Order form retains editable **Part Order No.** and **Order Type**. Part Order Number is manually entered; Order Type uses segmented tabs. Part Order No., Order Type and Order Status were removed from the pre-order monitoring/request summary because no order exists there yet. Do not remove them from the operational form.

Preserve corrected handover argument names `p_part_order_id` and `p_handed_over_at`, using `currentOrder.id`. Handover validates Store/Received state, inserts handover, assigns Floor, closes Store, opens Floor and updates visit/vehicle/event state atomically; inspect the deployed definition for exact checks.

Correct monitoring details route: `/(tabs)/advisor/store-monitor/vehicle-details`, with `vehicleId` and `visitId` parameters. The older `/(tabs)/store-monitor/vehicle-details` caused Unmatched Route / Page could not be found and is obsolete.

### C.4 Document Master and operational Document Status

Document Master is source-reported implemented. The detailed handoff confirms backend table/functions/policies and requests UI verification. Known stages configured for documents: `VEHICLE_INTAKE`, `SURVEY`, `APPROVAL`, `FLOOR`, `FINAL_INSPECTION`, `READY_FOR_DELIVERY`; requirement types: `REQUIRED`, `OPTIONAL`. Preserve duplicate detection by document name + vehicle type + workflow stage. RPCs: `get_admin_document_master`, `save_document_master`, `change_document_master_status`; signatures are retained in section 6.5.

A historical snapshot had 14 active Document Master records associated with `VEHICLE_INTAKE` / `REQUIRED`. These are historical counts, not current assertions. The UI reportedly supports status management, scrolling, custom popup, safe areas, Android back and explicit return to Master Data.

Operational **Document Status** was proposed as a separate extension: document requirements → pending/prepared → verification → completed → ready for final delivery. The pasted handoff proposed `document_master` as requirements and `vehicle_documents` as per-vehicle status. That separation is a conceptual proposal, **NEEDS VERIFICATION** against existing `vehicle_documents`, `visit_document_checklist`, RPCs and callers. Do not recreate Document Master or implement an assumed duplicate document system. This proposal is retained as an unresolved planned item; the latest task order starts with Approval Hold.

### C.5 Additional business and UI requirements

- Intake must not assign on merely opening a waiting vehicle. Save-and-accept is atomic; failure must leave the vehicle unassigned. The pasted source names `save_advisor_intake_with_documents` with document entries `{document_id, is_submitted}`. The detailed handoffs identify the newer verified Intake path as `new_workflow_save_vehicle_intake`, including job creation and checklist rows. Trace current callers; do not assume the older intake helper is the active path.
- Claim Intimation source UI displays date/time as `DD/MM/YYYY HH:MM AM/PM`; fields include estimate ID, claim number, claim datetime and remarks. Preserve active-user/role/ownership/state checks. Both claim RPC overloads are retained in section 6.5.
- Use database-driven master data, including Vehicle Models/Arena-Nexa, Insurance Companies, Business Types, MI/NON-MI and Documents; maintain historical references by deactivation rather than arbitrary deletion.
- Business timestamps display in Indian Standard Time. Preserve PostgreSQL `timestamptz` instants and explicit business decision timestamps; do not rewrite stored UTC offsets as fixed local times.
- Preserve Android back behavior and explicit parent navigation; fullscreen photo/document viewers must remain safe-area aware.
- Prefer readable larger typography, clear vehicle/customer/stage/status/action hierarchy, cards, status pills, subtle depth and segmented controls. Avoid compressed layouts. Maintain existing free UI solutions and minimize styling burden.

### C.6 Additional obsolete approaches and troubleshooting

- **OBSOLETE:** generic `new_workflow_move_stage` as a shortcut where a dedicated secure workflow RPC exists. Its presence in the inventory does not make it the approved transition API.
- **OBSOLETE:** `take_vehicle_as_advisor` as the default Advisor acceptance/takeover path. Preserve assigned-advisor ownership and use secure assignment/reassignment operations.
- **OBSOLETE:** multiple direct client table updates for sensitive transitions instead of atomic workflow RPCs.
- **OBSOLETE:** a visible Store bottom tab for Store Team; current source-reported tabs are Home/Profile.
- **OBSOLETE:** separate Advisor and CEO Admin Store modules; share read-only monitoring with different data scopes.
- PostgreSQL `42P13` occurred when replacing a function while renaming an input parameter. A targeted drop/recreate was used historically. Do not treat this as a blanket drop instruction: inspect exact signature, callers, dependencies, grants and authorization first; prefer preserving compatible argument names.
- A Store function failure came from mismatched frontend RPC argument names; retain the corrected names in C.3.
- `npm install` failed with `ENOENT` when run from the parent directory. Run project commands in the directory containing `package.json`.
- `No Android connected device found` was a device/emulator setup problem, not a workflow defect.
- Inspect RLS with `pg_tables.rowsecurity` and `pg_policies`; the historical query incorrectly requested `forcerowsecurity` from the wrong catalog/view. Use the live catalog appropriate to the database.

### C.7 Historical reset and future monitoring

A deliberate workflow test-data reset preserved Auth users, profiles/roles, master data, schema, functions, triggers and RLS while removing workflow test rows and vehicle test photos. Its reported counts were profiles 4, document_master 14, business_types 2, insurance_companies 2, mi_types 2, vehicle_models 3, workflow rows 0 and `vehicle-photos` objects 0. Later fresh test records exist in section Appendix A; those reset counts do not describe the current database. Do not repeat destructive cleanup without explicit scope and authorization.

The pasted handoff records Supabase project reference `nnbijpmsixebfqeqamdd`; current linked instance is **NEEDS VERIFICATION** against secure configuration. Do not expose credential values during that check.

Operations Monitor / Today, Activity Timeline, Vehicle History monitoring and Analytics remain planned. Build on existing events/history, with throughput, waiting/work duration, supplementary frequency, inspection failures, billing turnaround, stuck vehicles and accountability. Do not duplicate tracking systems.

### C.8 Live verification checklist

Before implementation, inspect actual Git remote/branch/worktree, package and lockfile versions, route tree, Supabase client, app configuration and EAS profiles. For database work inspect `information_schema.tables/columns`, `pg_constraint`, `pg_indexes`, `pg_trigger`, `pg_proc` with `pg_get_functiondef()`, `pg_policies`, table RLS flags, Storage buckets/policies and Auth configuration. Trace legacy and new function callers; check signatures, overloads, grants, security settings, ownership and current schema rather than executing the historical inventory as SQL.

Verify single-open-stage behavior, active job selection, billing role identifiers, complete role permissions, document workflow status, frontend completion and all source conflicts above. Record findings as confirmed facts or **NEEDS VERIFICATION**, and keep this context synchronized with implementation changes.
