<?php

namespace App\Http\Controllers;

use App\Models\IctTicket;
use App\Models\IctTicketComment;
use App\Models\IctTicketAttachment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class IctTicketController extends Controller
{
    public function index(Request $request): Response
    {
        $user        = auth()->user();
        $workspaceId = $user->current_workspace_id;
        $isOwner     = $user->currentWorkspace?->getMemberRole($user) === 'owner';

        $query = IctTicket::with(['reportedBy:id,name,email', 'assignedTo:id,name,email'])
            ->forWorkspace($workspaceId);

        // Non-owners see only their own tickets
        if (!$isOwner && $user->type !== 'superadmin') {
            $query->where(function ($q) use ($user) {
                $q->where('reported_by', $user->id)
                  ->orWhere('assigned_to', $user->id);
            });
        }

        if ($request->filled('status'))     $query->where('status', $request->status);
        if ($request->filled('priority'))   $query->where('priority', $request->priority);
        if ($request->filled('category'))   $query->where('category', $request->category);
        if ($request->filled('subsidiary')) $query->where('subsidiary', $request->subsidiary);
        if ($request->filled('assigned_to')) $query->where('assigned_to', $request->assigned_to);
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn($q) =>
                $q->where('title', 'like', "%{$s}%")
                  ->orWhere('ticket_number', 'like', "%{$s}%")
                  ->orWhere('description', 'like', "%{$s}%")
            );
        }

        $tickets = $query->orderByRaw("FIELD(status,'open','in_progress','pending','resolved','closed')")
            ->orderByRaw("FIELD(priority,'critical','high','medium','low')")
            ->orderByDesc('created_at')
            ->paginate(25)
            ->withQueryString();

        // Stats
        $statsQuery = IctTicket::forWorkspace($workspaceId);
        if (!$isOwner && $user->type !== 'superadmin') {
            $statsQuery->where(fn($q) => $q->where('reported_by', $user->id)->orWhere('assigned_to', $user->id));
        }
        $stats = [
            'open'        => (clone $statsQuery)->where('status', 'open')->count(),
            'in_progress' => (clone $statsQuery)->where('status', 'in_progress')->count(),
            'pending'     => (clone $statsQuery)->where('status', 'pending')->count(),
            'resolved'    => (clone $statsQuery)->where('status', 'resolved')->count(),
            'total'       => (clone $statsQuery)->count(),
            'overdue'     => (clone $statsQuery)
                ->whereNotIn('status', ['resolved', 'closed'])
                ->whereNotNull('due_date')
                ->where('due_date', '<', now())
                ->count(),
        ];

        $members = User::whereHas('workspaces', fn($q) => $q->where('workspaces.id', $workspaceId))
            ->select('id', 'name', 'email')
            ->get();

        return Inertia::render('ict-tickets/Index', [
            'tickets'       => $tickets,
            'stats'         => $stats,
            'members'       => $members,
            'subsidiaries'  => IctTicket::getSubsidiaries(),
            'departments'   => IctTicket::getDepartments(),
            'categories'    => IctTicket::getCategories(),
            'statuses'      => IctTicket::STATUSES,
            'priorities'    => IctTicket::PRIORITIES,
            'filters'       => $request->only(['status', 'priority', 'category', 'subsidiary', 'assigned_to', 'search']),
            'can'           => [
                'create' => true,
                'assign' => $isOwner || $user->type === 'superadmin',
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'               => 'required|string|max:255',
            'description'         => 'nullable|string|max:5000',
            'steps_to_reproduce'  => 'nullable|string|max:3000',
            'priority'            => 'required|in:low,medium,high,critical',
            'category'            => 'required|in:hardware,software,network,access_security,email_communication,server_infrastructure,mobile_devices,av_conferencing,other',
            'subsidiary'          => 'nullable|string|max:255',
            'department'          => 'nullable|string|max:255',
            'location'            => 'nullable|string|max:255',
            'due_date'            => 'nullable|date',
        ]);

        $user = auth()->user();

        $ticket = IctTicket::create([
            ...$validated,
            'ticket_number' => IctTicket::generateTicketNumber(),
            'status'        => 'open',
            'reported_by'   => $user->id,
            'workspace_id'  => $user->current_workspace_id,
            // Auto-set SLA deadline unless the user provided one explicitly
            'due_date'      => empty($validated['due_date'])
                ? IctTicket::calcDueDate($validated['priority'])
                : $validated['due_date'],
        ]);

        // Handle file attachments
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $path = $file->store("ict-tickets/{$ticket->id}", 'public');
                IctTicketAttachment::create([
                    'ticket_id'   => $ticket->id,
                    'file_name'   => $file->getClientOriginalName(),
                    'file_path'   => $path,
                    'file_size'   => $file->getSize(),
                    'mime_type'   => $file->getMimeType(),
                    'uploaded_by' => $user->id,
                ]);
            }
        }

        return back()->with('success', "Ticket {$ticket->ticket_number} created successfully.");
    }

    public function show(IctTicket $ictTicket): Response
    {
        $this->authorizeTicketAccess($ictTicket);

        $ictTicket->load([
            'reportedBy:id,name,email',
            'assignedTo:id,name,email',
            'comments.user:id,name,email',
            'attachments.uploader:id,name',
        ]);

        $workspaceId = auth()->user()->current_workspace_id;
        $members = User::whereHas('workspaces', fn($q) => $q->where('workspaces.id', $workspaceId))
            ->select('id', 'name', 'email')
            ->get();

        return Inertia::render('ict-tickets/Show', [
            'ticket'        => $ictTicket,
            'members'       => $members,
            'subsidiaries'  => IctTicket::getSubsidiaries(),
            'departments'   => IctTicket::getDepartments(),
            'categories'    => IctTicket::getCategories(),
            'statuses'      => IctTicket::STATUSES,
            'priorities'    => IctTicket::PRIORITIES,
            'can'           => $this->ticketPermissions($ictTicket),
        ]);
    }

    public function update(Request $request, IctTicket $ictTicket)
    {
        $this->authorizeTicketAccess($ictTicket, 'update');

        $validated = $request->validate([
            'title'               => 'sometimes|required|string|max:255',
            'description'         => 'nullable|string|max:5000',
            'steps_to_reproduce'  => 'nullable|string|max:3000',
            'priority'            => 'sometimes|required|in:low,medium,high,critical',
            'category'            => 'sometimes|required|in:hardware,software,network,access_security,email_communication,server_infrastructure,mobile_devices,av_conferencing,other',
            'subsidiary'          => 'nullable|string|max:255',
            'department'          => 'nullable|string|max:255',
            'location'            => 'nullable|string|max:255',
            'due_date'            => 'nullable|date',
            'resolution_notes'    => 'nullable|string|max:3000',
        ]);

        $ictTicket->update($validated);

        return back()->with('success', 'Ticket updated.');
    }

    public function changeStatus(Request $request, IctTicket $ictTicket)
    {
        $request->validate(['status' => 'required|in:open,in_progress,pending,resolved,closed']);

        $this->authorizeTicketAccess($ictTicket, 'update');

        $now = now();
        $data = ['status' => $request->status];

        if ($request->status === 'resolved' && !$ictTicket->resolved_at) {
            $data['resolved_at'] = $now;
        }
        if ($request->status === 'closed' && !$ictTicket->closed_at) {
            $data['closed_at'] = $now;
        }
        if ($request->status === 'in_progress' && !$ictTicket->first_response_at) {
            $data['first_response_at'] = $now;
        }

        $ictTicket->update($data);

        return back()->with('success', 'Ticket status updated.');
    }

    public function assign(Request $request, IctTicket $ictTicket)
    {
        $request->validate(['assigned_to' => 'nullable|exists:users,id']);

        $user = auth()->user();
        $isOwner = $user->currentWorkspace?->getMemberRole($user) === 'owner';

        if (!$isOwner && $user->type !== 'superadmin') {
            abort(403, 'Only owners can assign tickets.');
        }

        $ictTicket->update([
            'assigned_to'       => $request->assigned_to,
            'first_response_at' => $ictTicket->first_response_at ?? now(),
        ]);

        return back()->with('success', 'Ticket assigned.');
    }

    public function destroy(IctTicket $ictTicket)
    {
        $this->authorizeTicketAccess($ictTicket, 'delete');
        $ictTicket->delete();
        return redirect()->route('ict-tickets.index')->with('success', 'Ticket deleted.');
    }

    // ── Comments ──────────────────────────────────────────────────────────────

    public function storeComment(Request $request, IctTicket $ictTicket)
    {
        $this->authorizeTicketAccess($ictTicket);

        $request->validate([
            'comment'     => 'required|string|max:3000',
            'is_internal' => 'boolean',
        ]);

        $user = auth()->user();
        $isOwner = $user->currentWorkspace?->getMemberRole($user) === 'owner';

        $comment = IctTicketComment::create([
            'ticket_id'   => $ictTicket->id,
            'user_id'     => $user->id,
            'comment'     => $request->comment,
            'is_internal' => $isOwner && $request->boolean('is_internal'),
        ]);

        // Set first_response_at if this is IT staff responding
        if ($isOwner && !$ictTicket->first_response_at) {
            $ictTicket->update(['first_response_at' => now()]);
        }

        return back()->with('success', 'Comment added.');
    }

    public function destroyComment(IctTicketComment $comment)
    {
        if ($comment->user_id !== auth()->id()) {
            abort(403);
        }
        $comment->delete();
        return back()->with('success', 'Comment deleted.');
    }

    // ── Attachments ───────────────────────────────────────────────────────────

    public function storeAttachment(Request $request, IctTicket $ictTicket)
    {
        $this->authorizeTicketAccess($ictTicket);
        $request->validate(['file' => 'required|file|max:10240']);

        $file = $request->file('file');
        $path = $file->store("ict-tickets/{$ictTicket->id}", 'public');

        IctTicketAttachment::create([
            'ticket_id'   => $ictTicket->id,
            'file_name'   => $file->getClientOriginalName(),
            'file_path'   => $path,
            'file_size'   => $file->getSize(),
            'mime_type'   => $file->getMimeType(),
            'uploaded_by' => auth()->id(),
        ]);

        return back()->with('success', 'File attached.');
    }

    public function downloadAttachment(IctTicketAttachment $attachment)
    {
        $this->authorizeTicketAccess($attachment->ticket);
        return Storage::disk('public')->download($attachment->file_path, $attachment->file_name);
    }

    public function destroyAttachment(IctTicketAttachment $attachment)
    {
        if ($attachment->uploaded_by !== auth()->id()) abort(403);
        Storage::disk('public')->delete($attachment->file_path);
        $attachment->delete();
        return back()->with('success', 'Attachment removed.');
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function authorizeTicketAccess(IctTicket $ticket, string $action = 'view'): void
    {
        $user    = auth()->user();
        $isOwner = $user->type === 'superadmin' ||
                   $user->currentWorkspace?->getMemberRole($user) === 'owner';

        if ($ticket->workspace_id !== $user->current_workspace_id && $user->type !== 'superadmin') {
            abort(403);
        }

        if ($action !== 'view' && !$isOwner &&
            $ticket->reported_by !== $user->id &&
            $ticket->assigned_to !== $user->id) {
            abort(403);
        }
    }

    private function ticketPermissions(IctTicket $ticket): array
    {
        $user    = auth()->user();
        $isOwner = $user->type === 'superadmin' ||
                   $user->currentWorkspace?->getMemberRole($user) === 'owner';
        $isInvolved = $ticket->reported_by === $user->id || $ticket->assigned_to === $user->id;

        return [
            'update'  => $isOwner || $isInvolved,
            'delete'  => $isOwner,
            'assign'  => $isOwner,
            'comment' => true,
        ];
    }
}
