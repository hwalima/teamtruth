<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Project;
use App\Models\Task;
use App\Models\ProjectExpense;
use App\Models\TimesheetEntry;
use App\Events\InvoiceCreated;
use Illuminate\Http\Request;
use Inertia\Inertia;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        $workspace = $user->currentWorkspace;
        $userWorkspaceRole = $workspace->getMemberRole($user);
       
        $query = Invoice::with(['project:id,title', 'client:id,name,avatar,email', 'creator:id,name', 'payments'])
            ->where('workspace_id', $workspace->id);

        // Apply role-based filtering
        if (in_array($userWorkspaceRole, ['manager', 'member'])) {
            $query->where(function ($q) use ($user, $userWorkspaceRole) {
                // Show sent invoices to all members
                $q->where('status', '!=', 'draft')
                    ->whereHas('project', function ($projQ) use ($user) {
                        $projQ->where(function ($projectQuery) use ($user) {
                            $projectQuery->whereHas('members', function ($memberQuery) use ($user) {
                                $memberQuery->where('user_id', $user->id);
                            })->orWhere('created_by', $user->id);
                        });
                    });

                // Show draft invoices only to managers
                if ($userWorkspaceRole === 'manager') {
                    $q->orWhere('status', 'draft')
                        ->whereHas('project', function ($projQ) use ($user) {
                            $projQ->where(function ($projectQuery) use ($user) {
                                $projectQuery->whereHas('members', function ($memberQuery) use ($user) {
                                    $memberQuery->where('user_id', $user->id);
                                })->orWhere('created_by', $user->id);
                            });
                        });
                }
            });
        } elseif ($userWorkspaceRole === 'client') {
            // Clients see all invoices assigned to them (including drafts)
            $query->where('client_id', $user->id);
        }

         if ($request->project_id) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->client_id) {
            $query->where('client_id', $request->client_id);
        }
        // Owners see all invoices (no additional filtering needed)
        // Base query for stat cards
        $statsQuery = clone $query;

        // Apply filters
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('invoice_number', 'like', '%' . $request->search . '%')
                    ->orWhere('title', 'like', '%' . $request->search . '%')
                    ->orWhereHas('project', function ($projQ) use ($request) {
                        $projQ->where('title', 'like', '%' . $request->search . '%');
                    })
                    ->orWhereHas('client', function($clientQ) use ($request) {
                        $clientQ->where('name', 'like', '%' . $request->search . '%');
                    });
            });
        }

        //overdue filter logic
        if ($request->status) {
            if ($request->status === 'overdue') {
                $query->where(function ($q) {
                    $q->where('status', 'overdue')
                    ->orWhere(function ($q2) {
                        $q2->where('due_date', '<', now())
                            ->whereNotIn('status', ['paid', 'cancelled']);
                    });
                });
            }

            elseif ($request->status === 'partial_paid') {
                $query->where('status', 'partial_paid');
            }

            else {
                $query->where('status', $request->status);
            }
        }

        // Add sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        
        // Validate sort fields
        $allowedSortFields = ['invoice_number', 'title', 'total_amount', 'status', 'invoice_date', 'due_date', 'created_at'];
        if (!in_array($sortBy, $allowedSortFields)) {
            $sortBy = 'created_at';
        }
        
        if (!in_array($sortOrder, ['asc', 'desc'])) {
            $sortOrder = 'desc';
        }

        $perPage = $request->get('per_page', 10);
        $invoices = $query->orderBy($sortBy, $sortOrder)->paginate($perPage)->withQueryString();

        // Calculate totals across all invoices - Eloquent approach
        $overdueCondition = function ($q) {
            $q->where('status', 'overdue')
              ->orWhere(function ($q) {
                  $q->where('due_date', '<', now())
                    ->whereNotIn('status', ['paid', 'cancelled']);
              });
        };

        $totalAmount     = (clone $statsQuery)->sum('total_amount');
        $paidAmount      = (clone $statsQuery)->where('status', 'paid')->sum('total_amount');
        $outstandingAmount = (clone $statsQuery)->whereNotIn('status', ['paid', 'cancelled'])->selectRaw('SUM(total_amount - paid_amount) as outstanding')->value('outstanding') ?? 0;
        $outstandingCount  = (clone $statsQuery)->whereNotIn('status', ['paid', 'cancelled'])->count();
        $overdueCount      = (clone $statsQuery)->where($overdueCondition)->count();

        // Status counts for tabs - Eloquent approach
        $statusCounts = [
            'all'          => (clone $statsQuery)->count(),
            'draft'        => (clone $statsQuery)->where('status', 'draft')->count(),
            'sent'         => (clone $statsQuery)->where('status', 'sent')->count(),
            'paid'         => (clone $statsQuery)->where('status', 'paid')->count(),
            'partial_paid' => (clone $statsQuery)->where('status', 'partial_paid')->count(),
            'overdue'      => (clone $statsQuery)->where($overdueCondition)->count(),
        ];

        $invoices->getCollection()->transform(function ($invoice) {
            if ($invoice->client) {
                $invoice->client->avatar = check_file($invoice->client->avatar)
                    ? get_file($invoice->client->avatar)
                    : get_file('avatars/avatar.png');
            }
            return $invoice;
        });

        // Debug: Log invoices without projects
        $invoicesWithoutProject = $invoices->getCollection()->filter(function ($invoice) {
            return is_null($invoice->project);
        });

        if ($invoicesWithoutProject->count() > 0) {
            \Log::warning('Found invoices without projects:', [
                'count' => $invoicesWithoutProject->count(),
                'invoice_ids' => $invoicesWithoutProject->pluck('id')->toArray()
            ]);
        }

        // Get projects for filter dropdown
        $projectsQuery = Project::forWorkspace($workspace->id);
        if (in_array($userWorkspaceRole, ['manager', 'member'])) {
            $projectsQuery->where(function ($q) use ($user) {
                $q->whereHas('members', function ($memberQuery) use ($user) {
                    $memberQuery->where('user_id', $user->id);
                })->orWhere('created_by', $user->id);
            });
        } elseif ($userWorkspaceRole === 'client') {
            $projectsQuery->whereHas('clients', function ($clientQuery) use ($user) {
                $clientQuery->where('user_id', $user->id);
            });
        }
        $projects = $projectsQuery->get(['id', 'title']);

        // Get clients for filter dropdown
        $clients = $workspace->users()
            ->whereHas('roles', function ($q) {
                $q->where('name', 'client');
            })
            ->get(['users.id', 'users.name']);

        return Inertia::render('invoices/Index', [
            'invoices' => $invoices,
            'projects' => $projects,
            'clients' => $clients,
            'filters' => $request->only(['search', 'status', 'project_id', 'client_id', 'per_page', 'sort_by', 'sort_order', 'view']),
            'userWorkspaceRole' => $userWorkspaceRole,
            'emailNotificationsEnabled' => emailNotificationEnabled(),
            'totalAmount' => $totalAmount,
            'outstandingAmount' => $outstandingAmount,
            'paidAmount' => $paidAmount,
            'outstandingCount' => $outstandingCount,
            'overdueCount' => $overdueCount,
            'statusCounts' => [
                'all' => $statusCounts['all'],
                'draft' => $statusCounts['draft'],
                'sent' => $statusCounts['sent'],
                'paid' => $statusCounts['paid'],
                'partial_paid' => $statusCounts['partial_paid'],
                'overdue' => $statusCounts['overdue'],
            ],
        ]);
    }

    public function show(Invoice $invoice)
    {
        $invoice->load(['project', 'client', 'creator', 'items.task', 'items.expense', 'items.timesheetEntry', 'payments']);
        $user = auth()->user();
        $workspace = $user->currentWorkspace;
        $userWorkspaceRole = $workspace->getMemberRole($user);

        // Check access permissions
        if ($userWorkspaceRole === 'client') {
            // Clients can only view invoices assigned to them
            if ($invoice->client_id !== $user->id) {
                abort(403, 'Access denied.');
            }
        } elseif ($invoice->status === 'draft' && !in_array($userWorkspaceRole, ['owner', 'manager'])) {
            // Only managers, owners, and assigned clients can view draft invoices
            abort(403, 'Access denied.');
        }

        // Ensure tax_rate is properly formatted
        $invoiceData = $invoice->toArray();
        $taxRate = $invoice->tax_rate;
        if (is_string($taxRate)) {
            $taxRate = json_decode($taxRate, true) ?: [];
        }
        $invoiceData['tax_rate'] = $taxRate;
        // Check if email notifications are enabled
        $emailNotificationsEnabled = emailNotificationEnabled();
        
        // Get invoice settings
        $invoiceSettings = \App\Models\Setting::where('user_id', $invoice->created_by)
            ->whereIn('key', ['invoice_template', 'invoice_qr_display', 'invoice_color', 'invoice_footer_title', 'invoice_footer_notes', 'invoice_logo'])
            ->pluck('value', 'key')
            ->toArray();

        return Inertia::render('invoices/Show', [
            'invoice' => $invoiceData,
            'userWorkspaceRole' => $userWorkspaceRole,
            'emailNotificationsEnabled' => $emailNotificationsEnabled,
            'invoiceSettings' => $invoiceSettings,
            'pendingPayments' => $invoice->payments()->where('status', 'pending')->with('creator:id,name')->get()->map(function ($payment) {
                $payment->receipt_url = $payment->receipt_path ? get_file($payment->receipt_path) : null;
                return $payment;
            }),
        ]);
    }

    public function preview(Invoice $invoice)
    {
        $invoice->load(['project', 'client', 'creator', 'items.task', 'items.expense', 'items.timesheetEntry', 'payments']);
        $user = auth()->user();
        $workspace = $user->currentWorkspace;
        $userWorkspaceRole = $workspace->getMemberRole($user);

        // Check access permissions
        if ($userWorkspaceRole === 'client') {
            if ($invoice->client_id !== $user->id) {
                abort(403, 'Access denied.');
            }
        } elseif ($invoice->status === 'draft' && !in_array($userWorkspaceRole, ['owner', 'manager'])) {
            abort(403, 'Access denied.');
        }

        $invoiceData = $invoice->toArray();
        $taxRate = $invoice->tax_rate;
        if (is_string($taxRate)) {
            $taxRate = json_decode($taxRate, true) ?: [];
        }
        $invoiceData['tax_rate'] = $taxRate;
        
        $invoiceSettings = \App\Models\Setting::where('user_id', $invoice->created_by)
            ->whereIn('key', ['invoice_template', 'invoice_qr_display', 'invoice_color', 'invoice_footer_title', 'invoice_footer_notes', 'invoice_logo'])
            ->pluck('value', 'key')
            ->toArray();
        
        return Inertia::render('invoices/Preview', [
            'invoice' => $invoiceData,
            'invoiceSettings' => $invoiceSettings,
        ]);
    }

    public function store(Request $request)
    {
        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'client_id' => 'required|exists:users,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:invoice_date',
            'selected_taxes' => 'nullable|array',
            'selected_taxes.*' => 'exists:taxes,id',
            'notes' => 'nullable|string',
            'terms' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.type' => 'required|in:task',
            'items.*.amount' => 'required|numeric|min:0',
            'items.*.task_id' => 'required|exists:tasks,id',
        ]);

        $project = Project::findOrFail($validated['project_id']);

        // Calculate totals
        $subtotal = collect($validated['items'])->sum('amount');
        $taxAmount = 0;
        $taxData = [];
        
        if (!empty($validated['selected_taxes'])) {
            $taxes = \App\Models\Tax::whereIn('id', $validated['selected_taxes'])->get();
            foreach ($taxes as $tax) {
                $amount = ($subtotal * $tax->rate) / 100;
                $taxAmount += $amount;
                $taxData[] = ['id' => $tax->id, 'name' => $tax->name, 'rate' => $tax->rate];
            }
        }
        
        $totalAmount = $subtotal + $taxAmount;
        


        $invoice = Invoice::create([
            'project_id' => $validated['project_id'],
            'workspace_id' => $project->workspace_id,
            'client_id' => $validated['client_id'],
            'created_by' => $user->id,
            'title' => $validated['title'],
            'description' => $validated['description'],
            'invoice_date' => $validated['invoice_date'],
            'due_date' => $validated['due_date'],
            'tax_rate' => json_encode($taxData),
            'notes' => $validated['notes'],
            'terms' => $validated['terms'],
            'subtotal' => $subtotal,
            'tax_amount' => $taxAmount,
            'total_amount' => $totalAmount,
        ]);


        // Create invoice items
        foreach ($validated['items'] as $index => $item) {
            $task = Task::find($item['task_id']);
            InvoiceItem::create([
                'invoice_id' => $invoice->id,
                'type' => 'task',
                'description' => $task ? $task->title : 'Task',
                'rate' => $item['amount'],
                'amount' => $item['amount'],
                'task_id' => $item['task_id'],
                'sort_order' => $index + 1,
            ]);
        }

        // Fire event for Slack notification
        if (!config('app.is_demo', true)) {
            event(new InvoiceCreated($invoice));
        }

        return redirect()->route('invoices.show', $invoice)->with('success', __('Invoice created successfully!'));
    }

    public function update(Request $request, Invoice $invoice)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'client_id' => 'required|exists:users,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:invoice_date',
            'selected_taxes' => 'nullable|array',
            'selected_taxes.*' => 'exists:taxes,id',
            'notes' => 'nullable|string',
            'terms' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.type' => 'required|in:task',
            'items.*.amount' => 'required|numeric|min:0',
            'items.*.task_id' => 'required|exists:tasks,id',
            'items.*.description' => 'nullable|string',
        ]);

        // Prepare tax data
        $taxData = [];
        if (!empty($validated['selected_taxes'])) {
            $taxes = \App\Models\Tax::whereIn('id', $validated['selected_taxes'])->get();
            foreach ($taxes as $tax) {
                $taxData[] = ['id' => $tax->id, 'name' => $tax->name, 'rate' => $tax->rate];
            }
        }
        
        $invoice->update([
            'project_id' => $validated['project_id'],
            'client_id' => $validated['client_id'],
            'title' => $validated['title'],
            'description' => $validated['description'],
            'invoice_date' => $validated['invoice_date'],
            'due_date' => $validated['due_date'],
            'tax_rate' => json_encode($taxData),
            'notes' => $validated['notes'],
            'terms' => $validated['terms'],
        ]);

        // Update items
        $invoice->items()->delete();
        foreach ($validated['items'] as $index => $item) {
            $task = Task::find($item['task_id']);
            InvoiceItem::create([
                'invoice_id' => $invoice->id,
                'type' => 'task',
                'description' => !empty($item['description']) ? $item['description'] : ($task ? $task->title : 'Task'),
                'rate' => $item['amount'],
                'amount' => $item['amount'],
                'task_id' => $item['task_id'],
                'sort_order' => $index + 1,
            ]);
        }

        // Recalculate totals using the model method
        $invoice->calculateTotals();

        return redirect()->route('invoices.show', $invoice)->with('success', __('Invoice updated successfully!'));
    }

    public function create()
    {
        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        $projects = Project::forWorkspace($workspace->id)->get(['id', 'title']);
        $clients = $workspace->users()->whereHas('roles', function ($q) {
            $q->where('name', 'client');
        })->get(['users.id', 'users.name']);
        
        $taxes = \App\Models\Tax::where('workspace_id', $workspace->id)
            ->orderBy('name')
            ->get(['id', 'name', 'rate']);

        return Inertia::render('invoices/Form', [
            'projects' => $projects,
            'clients' => $clients,
            'taxes' => $taxes
        ]);
    }

    public function getProjectInvoiceData($projectId)
    {
        try {
            $project = Project::findOrFail($projectId);

            // Get project tasks
            $tasks = $project->tasks()->get(['id', 'title']);

            // Get project clients using the clients relationship
            $clients = $project->clients()->get(['users.id', 'users.name']);

            return response()->json([
                'tasks' => $tasks,
                'clients' => $clients
            ]);
        } catch (\Exception $e) {
            \Log::error('Error loading project invoice data: ' . $e->getMessage());
            return response()->json([
                'tasks' => [],
                'clients' => [],
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function edit(Invoice $invoice)
    {
        $invoice->load(['items']);

        $user = auth()->user();
        $workspace = $user->currentWorkspace;
        $userWorkspaceRole = $workspace->getMemberRole($user);

        // Only managers and owners can edit invoices
        if (!in_array($userWorkspaceRole, ['owner', 'manager'])) {
            abort(403, 'Access denied. Only managers and owners can edit invoices.');
        }

        $projects = Project::forWorkspace($workspace->id)->get(['id', 'title']);
        $clients = $workspace->users()->whereHas('roles', function ($q) {
            $q->where('name', 'client');
        })->get(['users.id', 'users.name']);
        
        $taxes = \App\Models\Tax::where('workspace_id', $workspace->id)
            ->orderBy('name')
            ->get(['id', 'name', 'rate']);

        $invoiceData = $invoice->toArray();
        
        // Parse tax_rate properly - handle double encoding
        $taxRate = $invoice->getRawOriginal('tax_rate');
        $selectedTaxIds = [];
        if ($taxRate) {
            $firstDecode = json_decode($taxRate, true);
            // If first decode returns a string, decode again
            if (is_string($firstDecode)) {
                $parsedTaxRate = json_decode($firstDecode, true);
            } else {
                $parsedTaxRate = $firstDecode;
            }
            
            if (is_array($parsedTaxRate)) {
                $selectedTaxIds = collect($parsedTaxRate)->pluck('id')->filter()->toArray();
            }
        }
        $invoiceData['selected_taxes'] = $selectedTaxIds;

        return Inertia::render('invoices/Form', [
            'invoice' => $invoiceData,
            'projects' => $projects,
            'clients' => $clients,
            'taxes' => $taxes
        ]);
    }

    public function destroy(Invoice $invoice)
    {
        $invoice->delete();
        return back()->with('success', __('Invoice deleted successfully!'));
    }



    public function markAsPaid(Request $request, Invoice $invoice)
    {
        $validated = $request->validate([
            'paid_amount' => 'nullable|numeric|min:0|max:' . $invoice->total_amount,
            'payment_method' => 'nullable|string',
            'payment_reference' => 'nullable|string',
            'payment_details' => 'nullable|array',
        ]);

        $oldStatus = $invoice->status;
        $invoice->markAsPaid(
            $validated['paid_amount'] ?? null,
            $validated['payment_method'] ?? null,
            $validated['payment_reference'] ?? null,
            $validated['payment_details'] ?? null
        );

        // Fire event for Slack notification
        if (!config('app.is_demo', true)) {
            event(new \App\Events\InvoiceStatusUpdated($invoice, $oldStatus, 'paid'));
        }

        return back()->with('success', __('Invoice marked as paid successfully!'));
    }

    public function approvePayment(Request $request, Invoice $invoice, \App\Models\Payment $payment)
    {
        if ($payment->invoice_id !== $invoice->id || $payment->status !== 'pending') {
            abort(422, 'Invalid payment.');
        }

        $payment->update(['status' => 'completed']);
        $invoice->updatePaymentStatus();

        return back()->with('success', __('Payment approved successfully!'));
    }

    public function rejectPayment(Request $request, Invoice $invoice, \App\Models\Payment $payment)
    {
        if ($payment->invoice_id !== $invoice->id || $payment->status !== 'pending') {
            abort(422, 'Invalid payment.');
        }

        $payment->delete();

        return back()->with('success', __('Payment rejected and removed.'));
    }

    public function send(Invoice $invoice)
    {
        $oldStatus = $invoice->status;
        $invoice->update([
            'status' => 'sent',
            'sent_at' => now()
        ]);

        // Fire events
        if (!config('app.is_demo', true)) {
            event(new \App\Events\InvoiceStatusUpdated($invoice, $oldStatus, 'sent'));
            event(new InvoiceCreated($invoice));
        }

        return back()->with('success', __('Invoice sent successfully!'));
    }

    public function getProjectData(Project $project)
    {
        $tasks = $project->tasks()
            ->with('taskStage')
            ->where('status', 'completed')
            ->get(['id', 'title', 'task_stage_id']);

        $expenses = $project->expenses()
            ->with('budgetCategory')
            ->where('status', 'approved')
            ->get(['id', 'title', 'amount', 'currency', 'budget_category_id']);

        $timesheetEntries = TimesheetEntry::whereHas('timesheet', function ($q) use ($project) {
            $q->where('project_id', $project->id);
        })
            ->with(['task', 'user'])
            ->get(['id', 'task_id', 'user_id', 'hours', 'description']);

        return response()->json([
            'tasks' => $tasks,
            'expenses' => $expenses,
            'timesheet_entries' => $timesheetEntries
        ]);
    }
}