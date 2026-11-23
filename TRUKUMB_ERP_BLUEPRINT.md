# Trukumb Holdings ERP: Master Blueprint & Copilot Prompt Guide

> Place this file in the project root (and copy section 2 into `.github/copilot-instructions.md`).
> It has two jobs: (1) a reference for you, (2) context you can point Copilot at with `#file:TRUKUMB_ERP_BLUEPRINT.md`.

---

## 0. How to use this file with Copilot

1. Copy **Section 2 (Standing Rules)** into `.github/copilot-instructions.md`. Copilot then reads it on every request.
2. Open **Copilot Chat → Agent mode** (not Ask mode) so it can create and edit files and run terminal commands.
3. Work **one phase and one module at a time**. Never paste the whole ERP into one prompt.
4. Start each session with: `Read #file:TRUKUMB_ERP_BLUEPRINT.md and the existing codebase. We are working on Phase X, Module Y.`
5. After each module: run tests, commit, and tick the checklist in Section 14.
6. Review every migration before running it. Back up the database first.

---

## 1. Vision & Scope

Expand the existing Laravel + MySQL planning system into a **multi-subsidiary ERP** for Trukumb Holdings.

| # | Module | Odoo reference |
|---|--------|----------------|
| 1 | HRM: leave, payroll, employee files, time & attendance (biometrics), performance, disciplinary, ATS, e-learning (SCORM) | Employees, Time Off, Payroll, Recruitment, eLearning |
| 2 | Finance: Accounting, Invoicing, Sales | Accounting, Invoicing, Sales |
| 3 | Fleet management | Fleet |
| 4 | Point of Sale (Talen Vision food court) | PoS Restaurant |
| 5 | Inventory + Purchase | Inventory, Purchase |
| 6 | Company-wide Requisition & Approval | Approvals |
| 0 | **Core/Foundation**: companies (subsidiaries), branding, users, roles, approvals engine, documents | n/a |
| ✓ | **Existing**: Project / Planning system (keep working, integrate) | Project |

**Non-negotiable cross-cutting requirements**

- One system, many subsidiaries. Every record belongs to a **Company** (subsidiary).
- Every printed or PDF document (invoice, payslip, PO, requisition, letter, contract, quotation, receipt) uses the **subsidiary's logo, colors, letterhead, signatories**.
- Group-level users can see and consolidate across subsidiaries; subsidiary users only see their own.
- Full audit trail on every financial, HR and approval action.
- Currency-aware (USD and ZWG at minimum) with stored exchange rates.

---

## 2. Standing Rules for Copilot (copy to `.github/copilot-instructions.md`)

```markdown
# Project: Trukumb Holdings ERP (Laravel + MySQL)

## Always
- FIRST inspect the existing codebase (composer.json, routes, models, migrations, auth, layouts, UI stack) and follow the conventions already in use. Do not assume; look.
- Never break or rewrite the existing Project/Planning module. Integrate with it, do not replace it.
- Use a modular monolith. Each ERP module lives in its own folder/namespace with its own routes, models, migrations, policies, services, views, tests.
- All business logic goes in Service/Action classes, not controllers. Controllers stay thin. Validation goes in Form Requests.
- Every business table has `company_id` (FK to `companies`). Models use the `BelongsToCompany` trait with a global scope. Group-level users may bypass the scope via an explicit, audited method.
- Money: store as integer minor units (cents) OR DECIMAL(18,4), never float. Every money record stores `currency_code`. Use one approach consistently.
- Use database transactions for anything that touches more than one table (posting a journal, stock move, payroll run, approval step).
- Posted accounting entries and closed payroll runs are IMMUTABLE. Corrections happen through reversal entries.
- Use Policies + spatie/laravel-permission for authorization. Never rely on hiding UI buttons alone.
- Use queues for slow work (PDF generation, payroll runs, imports, emails, device sync).
- Every state change on important records is logged with spatie/laravel-activitylog.
- Write Pest (or PHPUnit, whichever exists) tests for every service and every policy. Add factories and seeders.
- All migrations must be reversible and safe on a database that already contains data. Never drop existing tables or columns without an explicit instruction.
- Use enums (PHP 8.1+ backed enums) for statuses. Use Eloquent API Resources for any JSON.
- Documents are rendered through ONE shared branded layout component that reads the active company's branding. Never hardcode a logo, color or signatory in a template.
- Follow PSR-12, strict types, type hints and return types everywhere.

## Never
- No raw SQL string concatenation. No business logic in Blade. No hardcoded tax rates, levies or payroll rates (they live in configurable tables with effective dates).
- No secrets in code. Use `.env` and `config()`.
- Do not install a package without stating why and checking it is maintained and compatible with the installed Laravel version.

## Workflow
- Before coding a module: output a short plan (tables, models, services, routes, screens, tests) and wait for confirmation.
- After coding: list the files created/changed, the commands to run, and how to test manually.
```

---

## 3. Recommended Architecture

### 3.1 Style: Modular Monolith

```
app/
  Core/                  # companies, branding, approvals engine, documents, audit, settings, currencies
  Modules/
    Hrm/
    Payroll/
    Recruitment/
    Learning/
    Accounting/
    Invoicing/
    Sales/
    Purchase/
    Inventory/
    Fleet/
    Pos/
    Requisitions/
    Projects/            # existing planning system, moved or wrapped gradually
```

- Option A: `nwidart/laravel-modules`. Option B: plain namespaces under `app/Modules`. **Pick whichever matches the existing project with the least disruption**, and tell Copilot which.
- Modules talk through **Service classes and domain Events**, never by reaching into each other's tables. Example: `GoodsReceived` event → Accounting listener posts the journal.

### 3.2 Multi-subsidiary strategy

**Single database, `company_id` on every row** (not database-per-tenant). Reason: subsidiaries belong to one group and the board needs consolidated reporting.

- `companies` table = subsidiaries (plus the holding company as the parent, using `parent_id`).
- `company_user` pivot: a user can belong to several companies, with a role per company.
- Active company stored in session; switcher in the top bar.
- `BelongsToCompany` trait: global scope + auto-fill `company_id` on create.
- Sequences (invoice numbers, PO numbers, requisition numbers) are **per company, per document type, per year** with company prefix (e.g. `TVF/INV/2026/00001`). Use a locking `document_sequences` table.

### 3.3 Branding for documents

`companies` (or `company_branding`) holds:
`name, legal_name, registration_no, tax_no (TIN/BP no.), vat_no, address, phone, email, website, logo_path, logo_dark_path, favicon_path, primary_color, secondary_color, accent_color, letterhead_footer_text, bank_details (JSON), default_currency, timezone, fiscal_year_start`

`company_signatories`:
`company_id, name, title, signature_image_path, stamp_image_path, applies_to_document_type (nullable = all), approval_level (nullable), is_active, sort_order`

Implementation:
- A Blade component `<x-document-layout :company="$company">` that outputs header (logo + address), accent colors via CSS variables, footer, and a signature block.
- A `DocumentRenderer` service: `render(Model $document, string $template): PdfResponse` that resolves the company from the document, never from the logged-in user.
- Signatories can be **dynamic** (the person who actually approved, with their stored signature) or **fixed** (e.g. Finance Director on all cheques). Support both.
- Use `barryvdh/laravel-dompdf` or `spatie/laravel-pdf` (Browsershot) for PDFs. Browsershot gives better CSS support if Node/Chrome is available on the server.

### 3.4 Suggested package stack (verify versions against installed Laravel)

| Need | Package |
|------|---------|
| Roles/permissions | `spatie/laravel-permission` |
| Audit trail | `spatie/laravel-activitylog` |
| Files/media | `spatie/laravel-medialibrary` |
| PDFs | `barryvdh/laravel-dompdf` or `spatie/laravel-pdf` |
| Excel import/export | `maatwebsite/excel` |
| Queues & monitoring | Redis + `laravel/horizon` (or database queue if Redis not available) |
| Scheduled alerts | Laravel scheduler (cron) |
| Realtime (KDS, notifications) | Laravel Reverb or Pusher |
| API auth (devices, POS, mobile) | `laravel/sanctum` |
| Tables/UI | Match existing stack (Blade + Livewire, Inertia, etc.) |
| Money | `brick/money` or `moneyphp/money` |
| Charts | Chart.js / ApexCharts |
| Tests | Pest |

---

## 4. Phase Plan (build in this order)

| Phase | Focus | Why first |
|-------|-------|-----------|
| **0** | Audit existing app, set up modular structure, tooling, CI | Safe foundation |
| **1** | Core: companies, branding, signatories, users/roles, currencies, sequences, audit, **approval engine**, document renderer | Everything depends on it |
| **2** | Requisitions & approvals (module 6) | Validates the approval engine early, immediate business value |
| **3** | Inventory + Purchase (module 5) | Requisitions feed purchasing |
| **4** | Accounting + Invoicing + Sales (module 2) | Purchase/Inventory/Sales post into the ledger |
| **5** | HRM core: employee files, leave, job descriptions, disciplinary | Prerequisite for payroll and attendance |
| **6** | Time & attendance with biometrics, then Payroll | Payroll consumes attendance and leave |
| **7** | Performance, ATS, E-learning (SCORM) | Lower dependency, high value |
| **8** | Fleet | Links to purchase, inventory, accounting |
| **9** | POS for Talen Vision food court | Needs inventory, accounting and tax in place |
| **10** | Group reporting, dashboards, hardening, data migration, go-live | |

---

## 5. Phase 0 & 1: Foundation

### Phase 0 prompt (paste into Copilot Agent mode)

```
Read #file:TRUKUMB_ERP_BLUEPRINT.md. Do NOT write code yet.
Audit this Laravel project and report:
1. Laravel/PHP versions, installed packages, frontend stack (Blade/Livewire/Inertia/Vue/React), CSS framework.
2. Existing auth setup, user model, roles/permissions approach.
3. Existing tables/models/migrations and what the planning/project module does.
4. Existing folder structure and coding conventions.
5. Gaps or risks for turning this into a multi-company modular ERP.
Then propose: (a) the module structure that fits this project with least disruption, (b) the package list with reasons, (c) a migration strategy for adding company_id to existing tables safely with existing data (default everything to a "Trukumb Holdings" company).
Wait for my approval before changing anything.
```

### Phase 1 deliverables

1. `companies`, `company_user`, `company_branding`, `company_signatories`
2. `BelongsToCompany` trait, `CompanyScope`, company switcher UI, middleware that resolves the active company
3. Roles & permissions seeded per module (`module.resource.action`, e.g. `inventory.stock-move.approve`)
4. `currencies`, `exchange_rates`
5. `document_sequences` + `SequenceService`
6. `activity log` wired up
7. **Approval engine** (see Section 6)
8. `DocumentRenderer` + branded layout + sample PDF
9. Attachments (polymorphic) with media library
10. Notifications (mail + database, optional WhatsApp/SMS later)

### Phase 1 prompt

```
Using #file:TRUKUMB_ERP_BLUEPRINT.md sections 3 and 5, implement Phase 1 Core in the module structure we agreed.
First give me the plan (tables with columns, models, services, policies, routes, screens, tests). After I confirm, implement in this order:
1) companies + branding + signatories + company switching + BelongsToCompany global scope
2) migration that backfills company_id on existing tables with a default company
3) roles/permissions seeder
4) currencies + exchange rates
5) document sequences
6) DocumentRenderer with <x-document-layout> and one sample branded PDF per company
Include factories, seeders for 3 sample subsidiaries (different logos/colors/signatories), and Pest tests proving: a user from Company A cannot read or write Company B data; sequences never collide under concurrency; the PDF picks the correct branding.
```

---

## 6. Generic Approval Engine (Core)

Used by requisitions, purchase orders, leave, expense claims, payroll runs, journal entries, stock adjustments, disciplinary actions, etc.

**Tables**
- `approval_workflows`: `company_id, name, approvable_type, is_active`
- `approval_workflow_steps`: `workflow_id, step_order, approver_type (user|role|position|line_manager|department_head), approver_id, min_amount, max_amount, condition_json, require_all (bool), sla_hours`
- `approval_requests`: `company_id, approvable_type, approvable_id, workflow_id, status (pending|approved|rejected|cancelled|returned), current_step, requested_by, submitted_at, completed_at`
- `approval_actions`: `request_id, step_id, actor_id, action (approve|reject|return|delegate|comment), comment, acted_at, signature_snapshot`
- `approval_delegations`: `from_user_id, to_user_id, starts_at, ends_at`

**Behaviour**
- Rules by **amount thresholds**, **department**, **document type**, and **company**.
- Parallel and sequential steps. Escalation when SLA is breached (scheduled command).
- Approver can approve, reject (comment required), return for correction, or delegate.
- Approver's stored signature is stamped on the PDF at approval time.
- Dashboard "My approvals" with counts, plus email/in-app notifications.
- An approvable model uses a `HasApprovals` trait; the document becomes read-only while pending.

---

## 7. Module Specifications

### 7.1 Requisitions & Approvals (Module 6)

Requisition types: **Purchase**, **Stock/Store issue**, **Petty cash / Cash advance**, **Travel**, **Leave of absence** (links to HRM), **Maintenance / Fleet job**, **IT/Service request**, **Payment requisition**.

- Fields: requisition no. (per company), requester, department, project (link to existing Projects), cost center, required-by date, priority, justification, lines (item/description, qty, unit, estimated price, GL account, budget line), attachments.
- Budget check: warn or block when the department/project budget would be exceeded.
- Status: Draft → Submitted → In Approval → Approved → (Converted to PO / Issued / Paid) → Closed; plus Rejected, Returned, Cancelled.
- **Conversion**: approved purchase requisition → RFQ/PO in Purchase; approved store requisition → stock issue in Inventory; payment requisition → vendor bill/payment in Accounting.
- Branded PDF with signatory block showing every approver and timestamp.
- Reports: pending by approver, ageing, spend by department, turnaround time.

### 7.2 Inventory (Module 5a, like Odoo Inventory)

- Products: type (storable, consumable, service), SKU/barcode, categories, UoM + conversions, variants (optional), costing method (Average / FIFO), tracking (none/lot/serial), reorder rules, preferred suppliers.
- Warehouses → locations (hierarchical), including virtual locations (supplier, customer, production, scrap, adjustment).
- **Stock moves are the single source of truth**: `stock_moves` (+ lines) between locations. On-hand is derived, with cached `stock_quants`.
- Operations: Receipts (from PO), Deliveries (from sales), Internal transfers (inter-warehouse and **inter-subsidiary**, which generates intercompany entries), Adjustments / stocktake, Scrap, Store issues (from requisitions).
- Valuation: every move creates a valuation layer; posts to Accounting (stock valuation, COGS, GRNI).
- Reordering rules and min/max with suggested RFQs; batch/expiry tracking (needed for the food court).
- Barcode scanning (camera or USB scanner) in receipts and stocktake.
- Reports: stock on hand, valuation, movement history, ageing, slow movers, reorder list.

### 7.3 Purchase (Module 5b, like Odoo Purchase)

- Vendors (with company-specific payment terms, tax, bank details), vendor price lists.
- Flow: **RFQ → compare quotations → Purchase Order → Receipt → Vendor Bill → Payment**.
- PO approval via the approval engine (amount-based).
- **Three-way match**: PO vs Goods Receipt vs Vendor Bill with tolerance rules.
- Blanket/agreement orders, multi-currency, landed costs, returns/debit notes.
- Vendor evaluation (on-time %, price variance, rejection rate).
- Branded PO PDF + email to vendor.

### 7.4 Accounting (Module 2a, like Odoo Accounting)

- **Double-entry ledger**: `accounts` (chart of accounts per company, with a group template), `journals` (sales, purchase, bank, cash, general, stock, payroll), `journal_entries`, `journal_entry_lines`, `fiscal_years/periods` with lock dates.
- Partners (customers/vendors) with receivable/payable accounts, **reconciliation** of payments against invoices, partial payments.
- Bank & cash: statements import (CSV/OFX/MT940), reconciliation screen, rules for auto-matching.
- Taxes: configurable tax table (VAT, withholding, etc.) with effective dates, tax reports. Zimbabwe-specific items (ZIMRA VAT returns, fiscal devices/FDMS, multi-currency USD/ZWG revaluation) **must be verified against current ZIMRA rules before implementation**.
- Fixed assets with depreciation schedules (and link vehicles from Fleet).
- Budgets by account/cost center/project; analytic accounts (project, department, subsidiary, vehicle, outlet).
- Reports: Trial balance, General ledger, P&L, Balance sheet, Cash flow, Aged receivables/payables, Tax report, **Consolidated group statements** with intercompany eliminations.
- Intercompany: transactions between subsidiaries create mirrored entries in both companies.
- Rules: posted entries immutable; reverse to correct; period locking; every posting through `PostingService`.

### 7.5 Invoicing (Module 2b, like Odoo Invoicing)

- Customer invoices, credit notes, proforma, recurring invoices, payment terms, early-payment discounts, multi-currency.
- Online/PDF delivery by email with payment links (add provider adapters later, e.g. EcoCash/OneMoney/bank links via a `PaymentProvider` interface).
- Payment reminders (automatic follow-up levels), statements of account.
- Numbering per company; branded PDF with bank details and signatory.
- Fiscalisation hook (`FiscalDeviceInterface`) so ZIMRA-required fiscal data can be added without changing core invoicing.

### 7.6 Sales (Module 2c, like Odoo Sales)

- CRM-lite: leads/opportunities pipeline (optional but recommended), customers/contacts.
- Quotation → Sales Order → Delivery → Invoice. Quotation templates, discounts, optional products, e-sign/approval of quotation.
- Price lists, margins, salesperson targets and commissions, sales teams.
- Quotation approval for discounts beyond a threshold (approval engine).
- Link to Projects (sales order → project creation) since you already have a planning system.
- Reports: pipeline, sales by product/customer/salesperson/subsidiary, quotation conversion.

### 7.7 HRM: Employee files & Core (Module 1)

- Employee master: personal details, national ID, next of kin, contacts, bank details, tax/NSSA numbers, photo, documents (contracts, certificates, ID copies, medicals) with **expiry alerts**, employment history, positions, department, line manager, grade, cost center, assigned subsidiary (and transfers between subsidiaries with history).
- Contracts: type, start/end, probation, renewal alerts, generated **branded contract/letter templates** (offer, confirmation, warning, termination, reference) with merge fields.
- Org chart, positions/headcount planning.
- Sensitive fields encrypted (`encrypted` cast) and access restricted by permission; every view of a sensitive file logged.
- Self-service portal: employee sees profile, payslips, leave balance, requests.

### 7.8 HRM: Leave & Leave Calendar

- Leave types (annual, sick, maternity/paternity, compassionate, study, unpaid), accrual rules, carry-over, balances ledger (`leave_ledger` entries, not just a counter), public holidays per country/company, half days.
- Request → approval engine → balance deduction → feeds attendance and payroll.
- **Leave calendar**: month/week team views, department filter, conflict and minimum-staffing warnings, public holiday overlay (FullCalendar).

### 7.9 HRM: Time & Attendance with Biometrics

- Devices table: `company_id, name, brand/model, serial, ip, port, location, protocol, last_sync_at, status`.
- **Adapter pattern**: `BiometricDriverInterface` with implementations. Popular devices (ZKTeco and similar) either push data to a server (ADMS/push protocol) or are polled over TCP. Keep the integration behind the interface so brands can be swapped. Verify the exact model and protocol before choosing the approach. A small on-site sync agent (Python/Node) that posts to a secured API endpoint is often the most reliable option for devices on a local network.
- `attendance_raw_logs` (immutable device punches) → processed into `attendance_records` (daily clock-in/out) by a rules engine.
- Shifts & rosters (including night/rotating shifts for the food court and security), grace periods, late/early/overtime rules, break rules, public-holiday multipliers.
- Employee ↔ device user ID mapping, enrolment workflow, duplicate-punch filtering.
- Exceptions inbox: missed punches, manual corrections (require reason + approval, fully audited).
- Time off integration: approved leave auto-fills attendance.
- Timesheets by project (link to the existing planning module) for billable/project costing.
- Outputs to payroll: days worked, overtime hours, absences, lateness deductions.
- Privacy: biometric templates stay on the device; store only punch logs and the device user ID unless there is a clear need. Check Zimbabwe data protection obligations.

### 7.10 HRM: Payroll

- Payroll configuration (all **effective-dated and editable**, never hardcoded): salary structures, earnings, allowances, deductions, benefits-in-kind, statutory contributions, tax tables, currency split (USD/ZWG).
- Zimbabwe statutory items to configure and verify against current legislation: PAYE and AIDS levy, NSSA, ZIMDEF, NEC levies, pension/medical aid, bonus/13th-cheque treatment, leave pay-out, loans/advances. **Do not trust remembered rates. Have your accountant supply the current tables.**
- Run workflow: create run → compute (queued) → review exceptions → approval → lock → post journal to Accounting → generate payslips → bank payment file.
- Payslips as branded PDFs per subsidiary, emailed securely or available in the portal (password-protected PDFs optional).
- Loans, salary advances, garnishees, overtime, back-pay, final-pay/termination calculations.
- Statutory reports: PAYE return, NSSA schedule, ZIMDEF, payroll summary, cost by department, year-end tax certificates (ITF16 equivalent) per current ZIMRA format.
- Payroll data: strictest permissions, encrypted amounts at rest where practical, approval before release.

### 7.11 HRM: Performance Management

- **Job descriptions** per position: purpose, duties, KPIs, qualifications, reporting line, versioned; employees acknowledge them digitally.
- Appraisal cycles per company: templates with weighted sections, competencies, goals/KPIs (can link to projects/tasks in the existing system), self → manager → HOD → HR review, calibration, rating scales, development plans, probation and annual appraisals, 360 option.
- Appraisal outcome feeds promotion/increment recommendations (to Payroll through approval).
- Dashboards: completion rate, rating distribution, by department/subsidiary.

### 7.12 HRM: Disciplinary Records

- Case lifecycle: incident report → investigation → notice of hearing → hearing record → outcome (verbal/written/final warning, suspension, dismissal) → appeal.
- Templates for notices and warnings (branded, with signatories), witness statements, evidence attachments, timelines.
- **Warnings expire** (validity period) and are tracked per employee; strict confidentiality permissions; full audit.
- Align templates with the applicable Zimbabwe labour regulations and your company code of conduct. Confirm with HR/legal.

### 7.13 ATS: Recruitment

- Job requisition (approval engine) → job posting → applications → screening → interviews → offer → hire (creates employee record + onboarding checklist).
- Per-subsidiary careers pages. **Multiple source websites** apply through:
  - A public, rate-limited **Applications API** (`POST /api/public/applications`) with per-site API keys, CORS allow-list, honeypot/captcha, file validation and virus scanning of CV uploads.
  - Embeddable apply form/JS widget and a hosted careers page.
  - Optional email-to-application parser and CSV/LinkedIn-style import.
- Pipeline stages (Kanban), scorecards, interview scheduling with calendar invites, email templates, talent pool, duplicate detection, rejection reasons, source analytics, GDPR/data-retention purge.
- Offer letter generation (branded) and e-acceptance.

### 7.14 E-Learning with SCORM (like Odoo eLearning)

- Courses → sections → content (video, PDF, slides, quiz, **SCORM package**), prerequisites, certificates (branded per subsidiary), enrolment (manual, by department/role/position, auto on hire), due dates, reminders, completion tracking.
- **Compliance training**: mandatory courses per role, recurrence (annual refresher), expiry and overdue dashboards, manager visibility, attestation sign-off, HR export for audits.
- **SCORM support (1.2 and 2004)**:
  - Upload ZIP → validate and parse `imsmanifest.xml` → extract to storage → serve content from a same-origin route (SCORM requires same-origin API discovery; do not serve from a different domain).
  - Player page with iframe + JS runtime implementing the SCORM API (`API` for 1.2, `API_1484_11` for 2004). Use an existing open-source runtime such as **scorm-again** rather than writing one.
  - Persist CMI data (`lesson_status`, `score`, `suspend_data`, `session_time`) per attempt via a commit endpoint; resume support.
  - Guard against zip-slip, oversized and malicious archives.
- Quizzes (question bank, randomisation, pass mark, attempts), gamification (points, badges, leaderboards; fits Hwalima's gamification strength), certificates auto-issued as PDF.
- Optional later: xAPI/cmi5.

### 7.15 Fleet Management (Module 3)

- Vehicles: registration, VIN, make/model, type (bus, truck, LDV, equipment), acquisition cost, ownership company (subsidiary), status, odometer/hour-meter, assigned driver, location/department, **linked fixed asset**.
- Documents with **expiry alerts**: licence/ZINARA, insurance, fitness, route authority/operator licence, road permits, driver licences, defensive-driving certificates.
- Drivers (link to employee), assignments history, vehicle checks/inspections (digital checklists with photos), incident/accident reports.
- Fuel logs (fuel card, bowser, receipts) with consumption analytics and anomaly flags; odometer logs.
- Maintenance: schedules (km/time/hours), service history, work orders, parts (from Inventory), external vendors (Purchase), cost per vehicle; downtime tracking.
- Trips/bookings: pool vehicle requests (requisition type), trip sheets, passenger/route logs for buses.
- Costs & reporting: TCO, cost per km, fuel efficiency, utilisation, renewals due, depreciation (Accounting).
- Optional telematics/GPS integration via adapter interface later.

### 7.16 Point of Sale: Talen Vision Food Court (Module 4)

- **Offline-first PWA** (IndexedDB queue + background sync). Power and connectivity can fail; sales must never be blocked.
- Menu: categories, items, modifiers/variants (size, extras), combos, price lists/happy hour, **recipes (BOM)** so each sale deducts ingredients from Inventory, allergens, availability toggles.
- Restaurant features: floor/table plan, open tabs, split/merge bills, course firing, notes, **Kitchen Display / printed kitchen tickets** per station, order types (dine-in, takeaway, delivery), tips.
- Payments: cash, card/swipe, mobile money (EcoCash/OneMoney via provider adapters), split payments, multi-currency tender with change in a chosen currency, refunds/voids requiring manager PIN.
- Sessions: open/close shifts per cashier with cash counts, X and Z reports, cash-in/out, discrepancies.
- Receipts: thermal printing (ESC/POS), branded receipt for **Talen Vision**, QR/e-receipt. Fiscal device hook for ZIMRA compliance (verify requirements).
- Back-office: sales by item/hour/cashier, wastage, theoretical vs actual stock usage, daily sales auto-posting to Accounting (summary journal per session).
- Roles: cashier, waiter, kitchen, supervisor, manager with PIN login; hardware: receipt printer, cash drawer, barcode scanner, customer display.
- Employee meals/discounts linked to HR, staff tabs deductible via payroll (optional).

---

## 8. Data Conventions

- Table naming: `module_entity` snake_case plural, e.g. `inv_stock_moves`, `acc_journal_entries`, `hr_employees`, `pos_orders`. (Prefix per module avoids collisions with the existing schema.)
- Every table: `id`, `company_id`, timestamps, `created_by`, `updated_by`, soft deletes where deletion is allowed. Financial and stock records are never hard-deleted.
- Foreign keys with explicit `onDelete` behaviour; indexes on `company_id` + the common filter columns.
- Status columns as backed enums with a transition map (`canTransitionTo()`), enforced in the service layer.
- Polymorphic `attachments`, `notes/comments`, `approvals`, `activity` shared across modules.
- Decimal/money rules per Section 2. Quantities `DECIMAL(18,4)`.
- MySQL: InnoDB, `utf8mb4`, use transactions and `lockForUpdate()` for sequences and stock/ledger postings.

---

## 9. Cross-Module Integration Map

| Event | Producer | Consumer / Result |
|-------|----------|-------------------|
| Requisition approved | Requisitions | Creates RFQ/PO, stock issue, or payment bill |
| Goods received | Inventory | Valuation layer → Accounting journal (stock vs GRNI) |
| Vendor bill posted | Purchase/Invoicing | Accounting payable entry, three-way match |
| Sales delivery validated | Inventory | COGS journal |
| Invoice posted / paid | Invoicing | Receivable entry, reconciliation |
| POS session closed | POS | Sales/tax/payment journal, ingredient stock deduction |
| Payroll run approved | Payroll | Payroll journal, bank file, payslips |
| Leave approved | HRM Leave | Attendance + payroll adjustments |
| Hire completed | ATS | Employee record, onboarding checklist, e-learning enrolment |
| Employee exit | HRM | Disable access, final pay, asset/fleet return tasks |
| Vehicle service done | Fleet | Parts issued from Inventory, cost to Accounting |
| Sales order confirmed | Sales | Optional project creation in Projects module |

Implement these with Laravel **Events + Listeners (queued)** so modules stay decoupled.

---

## 10. Security, Compliance & Audit

- Role-based access per company; separate permissions for view/create/edit/approve/post/export on each resource. Segregation of duties (creator cannot approve own document, payroll preparer ≠ approver).
- 2FA for finance, payroll and admin roles. Password policy, session timeout, login audit, IP restrictions for sensitive modules if needed.
- Encrypt sensitive HR/payroll fields; protect file downloads with signed, authorised URLs; never expose files via public storage paths.
- Full activity log with who/what/when/old/new values; immutable accounting and payroll history.
- Backups: nightly DB + files offsite, tested restore. Staging environment that mirrors production.
- Data protection: retention policies for applicant data, consent capture, access logs on HR records. Check the Zimbabwe Cyber and Data Protection Act requirements.
- Rate limiting and validation on all public endpoints (careers API, biometric endpoints, POS API).

---

## 11. Quality Gates (per module)

- [ ] Plan approved before coding
- [ ] Migrations reversible and tested on a copy of production data
- [ ] Factories + seeders + realistic demo data for 3 subsidiaries
- [ ] Policies and permission tests (cross-company isolation proven)
- [ ] Service-level unit tests and feature tests for key flows
- [ ] Branded PDF verified for each subsidiary
- [ ] Audit log verified
- [ ] N+1 queries checked (Debugbar/Telescope), indexes added
- [ ] User guide page (short) added to `/docs`
- [ ] Code formatted (Pint) and static analysis clean (Larastan)

---

## 12. Prompt Library (reusable templates)

### 12.1 Start a module

```
Read #file:TRUKUMB_ERP_BLUEPRINT.md, section [X.Y] and sections 2, 3, 8, 9.
We are building the [MODULE NAME] module inside app/Modules/[Name].
Before coding, give me: tables (columns, types, indexes, FKs), models + relationships, enums, services/actions, events emitted/consumed, policies + permissions, routes, screens (list/create/edit/show/print), and the test plan.
Do not write code until I say "go".
```

### 12.2 Implement after approval

```
Go. Implement the approved plan for [MODULE] in small steps:
1) migrations + models + factories + seeders
2) services/actions with transactions
3) policies/permissions
4) controllers + form requests + resources
5) views matching the existing UI conventions
6) branded PDF templates using <x-document-layout>
7) Pest tests
After each step, list files changed and the command to verify it. Stop after step 3 and wait for my review.
```

### 12.3 Review / harden

```
Review the [MODULE] code against #file:TRUKUMB_ERP_BLUEPRINT.md sections 2, 8, 10, 11.
Check: company_id scoping on every query and relationship, missing policies, missing transactions, float money, hardcoded branding or rates, N+1 queries, missing indexes, untested edge cases, race conditions on sequences and stock.
Produce a prioritised list of problems with file/line references, then fix the critical ones.
```

### 12.4 Add a feature to an existing module

```
In the [MODULE] module, add [FEATURE]. First read the existing models/services/tests in this module and follow the same patterns. Show the plan and any migration impact, then implement with tests. Do not change unrelated files.
```

### 12.5 Data import / go-live

```
Create an import tool (queued, with validation report and dry-run mode) for [employees | products | opening stock | chart of accounts | opening balances | customers | vendors] from Excel/CSV per subsidiary. Provide downloadable templates, row-level error reporting, idempotent re-runs, and an audit record of each import batch.
```

---

## 13. Subsidiary Onboarding Checklist

For each subsidiary, collect before go-live:

- [ ] Legal name, trading name, registration no., TIN/BP no., VAT no.
- [ ] Logo (SVG/PNG, light and dark), brand colors (hex), letterhead footer, addresses, contacts
- [ ] Signatories: name, title, signature image, which documents/approval levels they sign
- [ ] Bank accounts, currencies, fiscal year start, tax settings
- [ ] Chart of accounts (use group template + adjustments), opening balances
- [ ] Departments, positions, cost centers, employees, leave policies, shifts, public holidays
- [ ] Warehouses/stores, products, vendors, customers
- [ ] Approval matrices (who approves what, up to what amount)
- [ ] Vehicles and drivers (where relevant)
- [ ] Biometric devices and network access (where relevant)

---

## 14. Progress Tracker

_Last reviewed: 23 November 2026. 263 automated tests pass._

Legend: `[x]` done and in use · `[~]` partly built (see the note) · `[ ]` not started

- [x] **Phase 0: Audit and structure.** Modular monolith under `app/Modules/*`, Laravel 12 + Inertia React + Pest.
- [x] **Phase 1: Core**
  - [x] Companies (subsidiaries), company switcher, `BelongsToCompany` scope, company members and ERP roles
  - [x] Branding and signatories. Every PDF uses the company's logo, colours and details (uploaded letterheads retired)
  - [x] Currencies and exchange rates
  - [x] Per-company document sequences
  - [x] Audit log of financial, HR and approval actions
  - [x] Approval engine: workflows, steps, amount rules, delegation, "My approvals"
  - [x] `DocumentRenderer` and shared branded report and document layouts
  - [~] SLA escalation of overdue approvals (no scheduled job yet)
- [x] **Phase 2: Requisitions & approvals.** Requisitions, budget checks, project link, PDF, reports, conversion to RFQ and store issue
- [x] **Phase 3: Inventory + Purchase**
  - [x] Units, categories, products (CRUD, import and export), warehouses, locations
  - [x] Stock moves (receipts, issues, transfers), on-hand quantities, stock reports (CSV and PDF)
  - [x] RFQ → quotations → purchase orders → receipts → vendor bills (three-way match) → payments
  - [x] Blanket orders, landed costs, purchase returns, vendor evaluations, vendor price lists
  - [x] Vendor directory: search as you type, add, edit, deactivate, delete if unused, vendor page, PDF list
  - [ ] Stock valuation and costing (average or FIFO), with journals for stock, GRNI and COGS
  - [ ] Reorder rules (min/max) and suggested RFQs; lot and expiry tracking
  - [x] Branded purchase order PDF, emailed to the vendor
- [~] **Phase 4: Accounting + Invoicing + Sales**
  - [x] Chart of accounts, journals, fiscal years and periods with locking
  - [x] Journal posting (balanced, immutable, reversal), trial balance, general ledger, profit & loss, CSV and PDF exports
  - [x] Invoicing: invoices, credit notes, payments, recurring invoices, payment terms, customer statements, payment reminders, branded PDFs, fiscal-device hook
  - [x] Invoices, credit notes and payments post to the ledger; vendor bills and payments post to the ledger
  - [x] Banking: bank accounts, statement import (with undo), statements, inter-company transfers, fund requests with approval, dashboard
  - [x] Sales: leads, opportunities, quotations with approval, sales orders, delivery from stock, invoice from what was delivered
    - [x] Quotations: list with search and status tabs, multi-line quotation form with live totals, quotation page, branded PDF, email to the customer
    - [x] Quotation actions: edit a draft, duplicate, cancel (withdraws a pending approval), delete (only quotations with no approval or order history), with buttons on the list and the quotation page
    - [x] Sales orders: list with search, status tabs and delivered/invoiced progress; order page with lines, deliveries and invoices; cancel and delete untouched orders
    - [x] Delivery from stock: deliver all or part of each goods line from a chosen store (and lot), stock is issued to the Customers location, the order shows part delivered or delivered
    - [x] Invoice from the order: bills goods up to what was delivered plus service lines, minus what is already invoiced; several invoices per order are linked to it
    - [x] Leads and opportunities pages: search, status tabs, add and edit in a dialog, qualify / lost / reopen, make an opportunity from a lead, won / lost with pipeline totals, quote from an opportunity
    - [ ] Cancelling an invoice does not yet give its quantities back to the order (so they could be invoiced again)
  - [x] Balance sheet, aged receivables and aged payables (Financial Reports page, CSV and branded PDF)
  - [ ] Cash flow statement
  - [x] Bank reconciliation (match statement lines to customer receipts and vendor payments, explain bank charges, auto-match)
  - [ ] Tax table with effective dates, and a VAT report (confirm ZIMRA rules first)
  - [ ] Fixed assets and depreciation
  - [ ] Group consolidation with inter-company eliminations
- [x] **Data import (go-live tooling).** Odoo imports with dry run, row report and undo: products, product variants, contacts (customers and vendors), employees, customer invoices
- [~] **Phase 5: HRM core**
  - [x] Employees (import, export to Excel/CSV/PDF), departments, positions, grades, cost centres, transfers
  - [x] Contracts and contract templates, disciplinary cases with documents and appeals
  - [x] Leave types, balances ledger, requests with approval, public holidays, self-service requests
  - [ ] Job descriptions screen (the table exists, no screen yet)
  - [ ] Leave calendar (team month/week view)
  - [ ] Document expiry and contract renewal alerts
- [ ] **Phase 6: Attendance (biometrics) + Payroll.** Needs the device model and the signed-off payroll rules first
- [ ] **Phase 7: Performance + ATS + E-learning (SCORM)**
- [ ] **Phase 8: Fleet**
- [ ] **Phase 9: POS (Talen Vision food court)**
- [ ] **Phase 10: Group reporting, hardening, migration, go-live**

---

## 15. What's next (recommended order)

These are ordered so each step builds on the one before it and finishes work that is already half there.

1. ~~**Close Phase 4 accounting reports.**~~ Balance sheet, aged receivables and aged payables are done (22 Nov 2026). Cash flow is still to do.
2. ~~**Bank reconciliation.**~~ Done (22 Nov 2026): Banking → Reconcile suggests the recorded payment for each statement line, matches several payments to one line, explains bank charges and interest, and auto-matches the certain ones. Next step for it: link each bank account to its ledger account so the books balance can be compared with the statement balance.
3. **Sales screen rebuild.** Bring Sales up to the standard of Invoicing and Purchase: list pages with search, multi-line quotations, a quotation PDF, send to customer, and order → delivery → invoice.
   - ~~Part 1: quotations.~~ Done (22 Nov 2026): Sales → Quotations lists every quotation with search and status tabs; New quotation takes any number of lines (product, description, quantity, price, discount, tax) with live totals, notes and terms; each quotation has its own page with Submit for approval, Create sales order, View PDF and Email to customer.
   - ~~Quotation actions.~~ Done (22 Nov 2026): Edit (drafts only), Duplicate (a new draft with the same lines), Cancel (also withdraws an approval that is still waiting) and Delete (only quotations with no approval or order history; the rest are cancelled and kept). Buttons on every list row and on the quotation page.
   - ~~Part 2: orders, delivery, invoicing, leads and opportunities.~~ Done (23 Nov 2026): Sales → Sales Orders lists every order with what has been delivered and invoiced; each order has its own page with Submit for approval, Deliver (all or part, from a chosen store, stock taken out), Create invoice (goods up to what was delivered, plus services) and Cancel / Delete for untouched orders. Sales → Leads and Sales → Opportunities are list pages with search, status tabs and actions; the Sales overview shows what needs attention at each step.
   - Still open: cancelling an invoice should give its quantities back to the order; a delivery note PDF; returns from the customer.
4. ~~**Purchase order PDF and email to the vendor.**~~ Done (22 Nov 2026): each approved order has View PDF and Email to vendor on the Purchase page. The email goes to the vendor's address (it can be changed before sending), carries the PDF, and replies go to the buyer who sent it.
5. **Stock valuation.** Average cost on receipts, with journals for stock, goods received not invoiced and cost of sales. Needed before POS and before the balance sheet shows stock correctly.
6. **Finish HRM core.** Job descriptions screen, leave calendar, and expiry alerts for documents and contracts (a daily scheduled job).
7. **Phase 6 preparation (needs you).** Confirm the biometric device brand and model, and get the payroll rules (PAYE, AIDS levy, NSSA, ZIMDEF, NEC) signed off by Finance. Build starts once these are in hand.

---

## 16. Improvements to the existing system

Found while reviewing the code on 22 November 2026, most valuable first.

**Reliability and operations**
- **Background jobs.** PDFs, imports and emails run while the user waits. Move them to a queue with a cron-driven worker (the database queue works on cPanel).
- **Scheduler.** Add one cron entry (`php artisan schedule:run`) and use it for recurring invoices, payment reminders, approval escalation and expiry alerts. Today these only run when triggered by hand.
- **Automatic backups.** Nightly database and uploaded-files backup kept off the server, with a restore that has been tested once.
- **Error monitoring.** Send production errors somewhere they are seen (email digest or a monitoring service) instead of only the log file.

**Security**
- **Two-factor sign-in** for owners, finance and HR roles (the user model already supports it; it needs switching on and enforcing for those roles).
- **Separation of duties.** Block a user from approving a document they created (requisitions, bills, payments, journals).
- **Protected file downloads.** Serve HR and finance attachments only through authorised, expiring links.

**Usability**
- **Consistent list pages.** Search as you type is now on every list. Next, give every list the same pieces the vendor list has: tabs for status, icon actions, a PDF and Excel export, and readable dates.
- **Accounting screens.** A long single page of forms. Split it into list, view and edit pages like Invoicing. (Sales was done on 23 Nov 2026.)
- **Dashboard.** One landing page per company: cash in the bank, owed by customers, owed to vendors, pending approvals, low stock.
- **Clean-up of imported data.** A merge tool for duplicate vendors and customers, and a review list of records with odd names or shared emails.

**Code health**
- **TypeScript errors.** About 2,175 old type errors (mostly in the older project pages) hide new mistakes. Fix them a folder at a time, starting with the ERP pages.
- **Remove leftovers**, for example `InventoryProductImportExportController.php.bak`.
- **Flaky test fixed.** The banking duplicate-import test rebuilt its spreadsheet and sometimes got a different file; it now builds it once.

---

## 17. Open questions (decide early)

1. ~~Frontend stack~~ **Decided:** Inertia + React + TypeScript, Tailwind.
2. ~~Hosting~~ **Decided:** cPanel shared hosting with LiteSpeed and MySQL; deploy by `git pull` with the built assets committed. Still to confirm: can a cron job and a queue worker run?
3. **Biometric device brand/model** and network layout between sites and the server.
4. **Currency policy**: USD and ZWG are in use. Still to confirm: the reporting currency and where exchange rates come from.
5. **ZIMRA fiscalisation** requirements for invoicing and POS (devices/FDMS), confirmed with your accountant.
6. **Payroll rules** supplied and signed off by Finance/HR (do not infer them).
7. **Existing planning data**: which tables map to which company; are there users who span subsidiaries?
8. **Offline requirements** per site (POS definitely; others?).
9. **Mobile**: responsive web + PWA first; native apps later if needed.
10. **Build vs integrate**: Odoo is being replaced; imports exist for products, contacts, employees and invoices. Still to bring across: opening balances, chart of accounts, open vendor bills.

---

## 18. Change log

- **23 Nov 2026:** Roles audit. Every company now gets five ready-made job roles beside Owner, Admin, Finance, Manager and Member: **HR Manager** (all of HR), **HR Officer** (employee records and documents, leave, contracts and org structure to view; no pay, terminations or leave approval), **Stores Manager** (requisition approval, purchasing, inventory and stock), **Procurement Officer** (RFQs, purchase orders and receipts, inventory to view) and **Finance Clerk** (vendor bills and payments, invoices and bank entries; no ledger, approvals or settings). All five can raise requisitions and act on their approval steps, and every role can be edited under Members and Roles. Two permissions were split out so junior roles can have buying or HR admin without the sensitive part: *Record and post vendor bills and payments* (`erp.purchase.bills`) and *Terminate, rehire and delete employees* (`erp.hrm.employee.terminate`); a migration gives them to every role that had the broader permission, so nobody loses access. Data Import is now only open to people who can import at least one kind of record. Workspace side: invited members no longer bypass their role in screens that check permissions (the old rule let any account of type "company" through); the workspace owner and super admins keep full access, everyone else gets what their member role grants. The expense approval and timesheet screens now check permissions that exist (they checked five names that were never seeded, so no role could be given them).
- **23 Nov 2026:** Banking date filters default to the current date: a bank statement with no dates chosen runs up to today (or later, only when lines are dated in the future) instead of stopping at the last line, and the dashboard's One month picker shows the current month instead of being blank.
- **23 Nov 2026:** Workspace invitations that were accepted no longer stay pending. The invitation pages ran without the web session, so accepting did not keep the person signed in and errors were never shown; accepting also failed for anyone who already had a (possibly inactive) membership row, matched emails case-sensitively and stopped when the invited role was missing. Accepting now updates the existing membership, closes every open invitation for that person, and the workspace page closes invitations for people who are already active members.
- **23 Nov 2026:** Mzitshwa AI rebuilt. It now runs on a free OpenAI-compatible provider chosen in `.env` (`MZITSHWA_PROVIDER`: NVIDIA by default; Gemini, Groq and OpenRouter also supported; `config/mzitshwa.php`). It answers from live data across the workspace and the whole ERP (profit and loss, balance sheet, trial balance, aged receivables and payables, invoices, customers, bank balances, stock on hand, purchases, requisitions, the sales pipeline, HR and leave, and the user's pending approvals), limited to what the user's ERP role and workspace permissions allow, in the active company only. The ERP is read-only; workspace changes (create, update and assign tasks, report bugs) are only proposed and happen after the user presses Confirm, with permissions checked again. It opens from a sparkle icon in the top bar or Ctrl+/ as a side panel with history; the sidebar entry and floating button are gone. The old routes had no sign-in, so the old assistant never worked; the Groq service was removed and conversations no longer need a workspace (migration). Time logging by chat was dropped.
- **23 Nov 2026:** Notes, Google Meetings (view and join) and the Media Library (browse, upload, download) are open to every signed-in user, whatever their role (`App\Support\GlobalPermissions`); creating meetings and deleting media stay role-based. The Contracts / Contract Types and Website & Marketing (Landing Page) menus are removed from every sidebar; their pages and data are untouched. HRM employee contracts are unaffected.

- **23 Nov 2026:** The ERP sidebar now also shows the workspace tools: Communications & Content (Notes, meetings, Contracts, Media Library, Mzitshwa AI), ICT Support, Website & Marketing and System Control (Currency, Email and Notification Templates, Settings), each under the same permissions as outside the ERP.

- **23 Nov 2026:** Sales orders get a list and their own page. Goods are delivered from stock in parts (stock goes out to the Customers location), and invoices bill what was delivered plus services, with several invoices per order. Leads and opportunities get list pages with search, status tabs, edit, qualify / won / lost and delete; the Sales page becomes an overview. New tables: sal_deliveries, sal_delivery_lines, sal_sales_order_invoices; sales orders gain customer reference and notes.

- **22 Nov 2026:** Quotations get full actions: edit a draft, duplicate, cancel (withdraws a pending approval) and delete, from the list and the quotation page. Each is recorded in the audit log.
- **22 Nov 2026:** Sales quotations rebuilt: list with search and status tabs, multi-line quotation form, quotation page, branded quotation PDF emailed to the customer. Saving leads, opportunities and quotations now checks the ERP sales role (it was refused before), and a missing approval workflow shows a clear message.
- **22 Nov 2026:** Purchase order PDF on company branding, emailed to the vendor from the Purchase page; Purchase page layout reworked for phones.
- **22 Nov 2026:** Bank reconciliation: statement lines matched to customer receipts and vendor payments, with suggestions, split matches, explanations, auto-match and undo.
- **22 Nov 2026:** Financial Reports page: balance sheet, aged receivables and aged payables, with CSV and branded PDF exports.
- **22 Nov 2026:** Vendor directory (list, page, add, edit, deactivate, delete if unused, PDF list); Odoo contacts import handles list exports; search as you type across the app.
- **Nov 2026:** Banking module (statements, import with undo, inter-company transfers, fund requests, dashboard); invoice and credit note PDFs on company branding; Odoo invoice, employee and product imports; HRM module repaired and extended; employee exports.
- **Earlier:** Phases 0 to 3, accounting ledger and reports, invoicing, sales workflows, universal sidebar navigation (shared `use-navigation` hook across sidebar and header layouts).

---

### Closing tip

Keep prompts small, demand a plan first, review migrations and anything touching money, stock, tax or payroll line by line, and commit after every verified step.
