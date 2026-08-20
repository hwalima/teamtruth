<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IctTicket extends Model
{
    protected $fillable = [
        'ticket_number', 'title', 'description', 'steps_to_reproduce',
        'status', 'priority', 'category', 'subsidiary', 'department', 'location',
        'reported_by', 'assigned_to', 'workspace_id', 'resolution_notes',
        'due_date', 'first_response_at', 'resolved_at', 'closed_at',
    ];

    protected $casts = [
        'due_date'          => 'datetime',
        'first_response_at' => 'datetime',
        'resolved_at'       => 'datetime',
        'closed_at'         => 'datetime',
    ];

    // ── Constants ─────────────────────────────────────────────────────────────

    public const SUBSIDIARIES = [
        'Trukumb Holdings Head Office',
        'Trukumb Mining Division',
        'Trukumb Logistics',
        'Trukumb Agriculture',
        'Trukumb Finance',
        'Trukumb Real Estate',
        'Trukumb Energy',
        'Other',
    ];

    public const DEPARTMENTS = [
        'IT Department',
        'Finance',
        'Human Resources',
        'Operations',
        'Management / Executive',
        'Sales & Marketing',
        'Engineering',
        'Administration',
        'Legal & Compliance',
        'Procurement',
        'Other',
    ];

    public const CATEGORIES = [
        'hardware'            => 'Hardware',
        'software'            => 'Software',
        'network'             => 'Network & Connectivity',
        'access_security'     => 'Access & Security',
        'email_communication' => 'Email & Communication',
        'server_infrastructure' => 'Server & Infrastructure',
        'mobile_devices'      => 'Mobile Devices',
        'av_conferencing'     => 'AV & Conferencing',
        'other'               => 'Other',
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
