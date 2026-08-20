<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IctTicket extends Model
{
    protected $fillable = [
        'ticket_number', 'title', 'description', 'steps_to_reproduce',
        'status', 'priority', 'issue_type', 'category', 'subsidiary', 'department', 'location',
        'reported_by', 'assigned_to', 'workspace_id', 'resolution_notes',
        'due_date', 'first_response_at', 'resolved_at', 'closed_at',
    ];

    protected $casts = [
        'due_date'          => 'datetime',
        'first_response_at' => 'datetime',
        'resolved_at'       => 'datetime',
        'closed_at'         => 'datetime',
    ];

    // ── Constants — Trukumb Holdings Group ────────────────────────────────────

    public const SUBSIDIARIES = [
        'Trukumb Holdings Head Office',
        'Epoch Mines & Resources',
        'Talen Vision Enterprises',
        'Talen Vision Engineering',
        'Talen Vision Construction',
        'Talen Vision Brick Moulding',
        'Talen Vision Food Court',
        'Trukumb Health Center',
        'Ivinar Park Academy',
        'Travelite PVT LTD',
        'Talen Vision FC',
        'Trukumb Microfinance',
        'Other',
    ];

    public const DEPARTMENTS = [
        'Executive / Management',
        'Information Technology',
        'Human Resources',
        'Finance & Accounts',
        'Operations',
        'Engineering',
        'Construction & Infrastructure',
        'Mining Operations',
        'Sales & Marketing',
        'Administration',
        'Transport & Logistics',
        'Education & Training',
        'Healthcare Services',
        'Food Services',
        'Legal & Compliance',
        'Procurement & Supply Chain',
        'Safety, Health & Environment',
        'Sports & Recreation',
        'Other',
    ];

    /** Broad issue type (the department/function the issue belongs to) */
    public const ISSUE_TYPES = [
        'it_systems'   => 'IT & Systems',
        'hr_payroll'   => 'HR & Payroll',
        'finance'      => 'Finance & Accounts',
        'facilities'   => 'Facilities & Maintenance',
        'operations'   => 'Operations',
        'transport'    => 'Transport & Logistics',
        'mining'       => 'Mining Operations',
        'education'    => 'Education & Training',
        'healthcare'   => 'Healthcare',
        'safety'       => 'Safety, Health & Environment',
        'legal'        => 'Legal & Compliance',
        'management'   => 'Management / Executive',
        'other'        => 'Other',
    ];

    /** Specific categories per issue type */
    public const CATEGORIES_BY_TYPE = [
        'it_systems' => ['hardware' => 'Hardware', 'software' => 'Software / Applications', 'network' => 'Network & Connectivity', 'access_security' => 'Access & Security', 'email_communication' => 'Email & Communication', 'server_infrastructure' => 'Server & Infrastructure', 'mobile_devices' => 'Mobile Devices', 'av_conferencing' => 'AV & Conferencing', 'other' => 'Other IT'],
        'hr_payroll' => ['recruitment' => 'Recruitment', 'leave' => 'Leave & Absence', 'payroll' => 'Payroll', 'employee_relations' => 'Employee Relations', 'training' => 'Training & Development', 'disciplinary' => 'Disciplinary / Grievance', 'other' => 'Other HR'],
        'finance'    => ['expense_claim' => 'Expense Claim', 'invoice' => 'Invoice Processing', 'budget' => 'Budget Query', 'petty_cash' => 'Petty Cash', 'audit' => 'Audit / Compliance', 'other' => 'Other Finance'],
        'facilities' => ['building' => 'Building Maintenance', 'equipment' => 'Equipment Repair', 'vehicle' => 'Vehicle / Fleet Issue', 'cleaning' => 'Cleaning & Hygiene', 'security' => 'Security', 'utilities' => 'Utilities (Water/Power)', 'other' => 'Other Facilities'],
        'operations' => ['process' => 'Process Issue', 'supply_chain' => 'Supply Chain', 'quality' => 'Quality Control', 'production' => 'Production', 'safety_incident' => 'Safety Incident', 'other' => 'Other Operations'],
        'transport'  => ['breakdown' => 'Vehicle Breakdown', 'route' => 'Route Issues', 'booking' => 'Booking Problem', 'driver' => 'Driver Issue', 'fuel' => 'Fuel & Maintenance', 'other' => 'Other Transport'],
        'mining'     => ['equipment_failure' => 'Equipment Failure', 'safety_mining' => 'Safety Incident', 'environmental' => 'Environmental Issue', 'production_mining' => 'Production Issue', 'blasting' => 'Blasting & Explosives', 'other' => 'Other Mining'],
        'education'  => ['student_affairs' => 'Student Affairs', 'curriculum' => 'Curriculum / Academic', 'staff_edu' => 'Staff Issue', 'infrastructure_edu' => 'Infrastructure', 'parent_query' => 'Parent / Guardian Query', 'fees' => 'Fees & Finance', 'other' => 'Other Education'],
        'healthcare' => ['medical_equipment' => 'Medical Equipment', 'patient' => 'Patient Complaint / Query', 'staff_health' => 'Staff Issue', 'supplies' => 'Medical Supplies', 'other' => 'Other Healthcare'],
        'safety'     => ['incident' => 'Safety Incident', 'near_miss' => 'Near Miss', 'hazard' => 'Hazard Report', 'ppe' => 'PPE Issue', 'compliance' => 'Compliance Breach', 'other' => 'Other Safety'],
        'legal'      => ['contract' => 'Contract Query', 'regulatory' => 'Regulatory Issue', 'dispute' => 'Dispute / Litigation', 'other' => 'Other Legal'],
        'management' => ['strategic' => 'Strategic Issue', 'board' => 'Board Communication', 'inter_company' => 'Inter-Company Issue', 'other' => 'Other Management'],
        'other'      => ['general' => 'General Enquiry', 'suggestion' => 'Suggestion / Improvement', 'other' => 'Other'],
    ];

    /** Flat categories map (all combined for backward compat) */
    public const CATEGORIES = [
        'hardware' => 'Hardware', 'software' => 'Software / Applications',
        'network' => 'Network & Connectivity', 'access_security' => 'Access & Security',
        'email_communication' => 'Email & Communication', 'server_infrastructure' => 'Server & Infrastructure',
        'mobile_devices' => 'Mobile Devices', 'av_conferencing' => 'AV & Conferencing',
        'recruitment' => 'Recruitment', 'leave' => 'Leave & Absence', 'payroll' => 'Payroll',
        'expense_claim' => 'Expense Claim', 'building' => 'Building Maintenance',
        'equipment' => 'Equipment Repair', 'vehicle' => 'Vehicle / Fleet Issue',
        'safety_incident' => 'Safety Incident', 'breakdown' => 'Vehicle Breakdown',
        'booking' => 'Booking Problem', 'equipment_failure' => 'Equipment Failure',
        'student_affairs' => 'Student Affairs', 'medical_equipment' => 'Medical Equipment',
        'incident' => 'Safety Incident Report', 'contract' => 'Contract Query',
        'general' => 'General Enquiry', 'other' => 'Other',
    ];

    public const STATUSES = [
        'open'        => ['label' => 'Open',        'color' => '#3B82F6'],
        'in_progress' => ['label' => 'In Progress',  'color' => '#F59E0B'],
        'pending'     => ['label' => 'Pending',      'color' => '#8B5CF6'],
        'resolved'    => ['label' => 'Resolved',     'color' => '#10B981'],
        'closed'      => ['label' => 'Closed',       'color' => '#6B7280'],
    ];

    public const PRIORITIES = [
        'low'      => ['label' => 'Low',      'color' => '#6B7280'],
        'medium'   => ['label' => 'Medium',   'color' => '#3B82F6'],
        'high'     => ['label' => 'High',     'color' => '#F59E0B'],
        'critical' => ['label' => 'Critical', 'color' => '#EF4444'],
    ];

    // ── Relations ─────────────────────────────────────────────────────────────

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(IctTicketComment::class, 'ticket_id')->orderBy('created_at');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(IctTicketAttachment::class, 'ticket_id');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public static function generateTicketNumber(): string
    {
        $last = static::orderByDesc('id')->value('ticket_number');
        $next = $last ? (int) substr($last, 4) + 1 : 1;
        return 'TKT-' . str_pad($next, 5, '0', STR_PAD_LEFT);
    }

    /** Return subsidiaries — from DB settings if saved, otherwise hardcoded defaults */
    public static function getSubsidiaries(): array
    {
        try {
            $stored = getSetting('ict_subsidiaries');
            if ($stored) { $d = json_decode($stored, true); if (is_array($d) && $d) return $d; }
        } catch (\Exception) {}
        return static::SUBSIDIARIES;
    }

    /** Return departments — from DB settings if saved, otherwise hardcoded defaults */
    public static function getDepartments(): array
    {
        try {
            $stored = getSetting('ict_departments');
            if ($stored) { $d = json_decode($stored, true); if (is_array($d) && $d) return $d; }
        } catch (\Exception) {}
        return static::DEPARTMENTS;
    }

    /** Return categories — from DB settings if saved, otherwise hardcoded defaults */
    public static function getCategories(): array
    {
        try {
            $stored = getSetting('ict_categories');
            if ($stored) { $d = json_decode($stored, true); if (is_array($d) && $d) return $d; }
        } catch (\Exception) {}
        return static::CATEGORIES;
    }

    /**
     * Priority-based multiplier applied to the base SLA hours.
     * Critical = 25 % of resolution time, Low = 200 %.
     */
    public static function slaMultiplier(string $priority): float
    {
        return match ($priority) {
            'critical' => 0.25,
            'high'     => 0.5,
            'medium'   => 1.0,
            'low'      => 2.0,
            default    => 1.0,
        };
    }

    /** Calculate the due_date for a new ticket based on priority + SLA settings. */
    public static function calcDueDate(string $priority): \Carbon\Carbon
    {
        $baseHours = (int) getSetting('ict_sla_resolution_hours', 24);
        $hours     = (int) ceil($baseHours * static::slaMultiplier($priority));

        return now()->addHours(max(1, $hours));
    }

    public function isOverdue(): bool
    {
        return $this->due_date && $this->due_date->isPast()
            && !in_array($this->status, ['resolved', 'closed']);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeForWorkspace($query, $workspaceId)
    {
        return $query->where('workspace_id', $workspaceId);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByPriority($query, $priority)
    {
        return $query->where('priority', $priority);
    }
}
