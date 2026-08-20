<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ContactController extends Controller
{
    public function index(Request $request)
    {
        $query = Contact::query();
            
        // Apply search filter
        if ($request->has('search') && !empty($request->search)) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%")
                  ->orWhere('subject', 'like', "%{$request->search}%");
            });
        }
        
        // Apply date filters
        if ($request->has('start_date') && !empty($request->start_date)) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        
        if ($request->has('end_date') && !empty($request->end_date)) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
        
        // Apply sorting with field validation
        $allowedSortFields = ['name', 'email', 'subject', 'created_at'];
        $sortField = $request->input('sort_field', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        
        // Validate sort field
        if (!in_array($sortField, $allowedSortFields)) {
            $sortField = 'created_at';
        }
        
        // Validate sort direction
        if (!in_array($sortDirection, ['asc', 'desc'])) {
            $sortDirection = 'desc';
        }
        
        $query->orderBy($sortField, $sortDirection);
        
        // Get paginated results
        $perPage = $request->input('per_page', 10);
        $contacts = $query->paginate($perPage)->withQueryString();
        
        return Inertia::render('contacts/index', [
            'contacts' => $contacts,
            'filters' => $request->only(['search', 'start_date', 'end_date', 'sort_field', 'sort_direction', 'per_page'])
        ]);
    }
    
    
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255',
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
        ]);
        
        $contact = Contact::create($validated);
        
        return redirect()->back()->with('success', __('Contact created successfully'));
    }
    
    public function update(Request $request, Contact $contact)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255',
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
        ]);
        
        $contact->update($validated);
        
        return redirect()->back()->with('success', __('Contact updated successfully'));
    }
    
    public function destroy(Contact $contact)
    {
        $contact->delete();
        
        return redirect()->back()->with('success', __('Contact deleted successfully'));
    }
    
    
   
    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:contacts,id'
        ]);
        
        Contact::whereIn('id', $validated['ids'])->delete();
        
        return redirect()->back()->with('success', __('Selected contacts deleted successfully'));
    }
    
    public function export(Request $request)
    {
        $query = Contact::query();
        
        // Apply same filters as index
        if ($request->has('search') && !empty($request->search)) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%")
                  ->orWhere('subject', 'like', "%{$request->search}%");
            });
        }
        
        if ($request->has('start_date') && !empty($request->start_date)) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        
        if ($request->has('end_date') && !empty($request->end_date)) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
        
        $contacts = $query->orderBy('created_at', 'desc')->get();
        
        $filename = 'contacts_' . now()->format('Y-m-d_H-i-s') . '.csv';
        
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];
        
        $callback = function() use ($contacts) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['Name', 'Email', 'Subject', 'Message', 'Created At', 'Read At', 'Replied At']);
            
            foreach ($contacts as $contact) {
                fputcsv($file, [
                    $contact->name,
                    $contact->email,
                    $contact->subject,
                    $contact->message,
                    $contact->created_at->format('Y-m-d H:i:s'),
                    $contact->read_at?->format('Y-m-d H:i:s'),
                    $contact->replied_at?->format('Y-m-d H:i:s'),
                ]);
            }
            
            fclose($file);
        };
        
        return response()->stream($callback, 200, $headers);
    }
}