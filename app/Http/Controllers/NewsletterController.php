<?php

namespace App\Http\Controllers;

use App\Models\Newsletter;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NewsletterController extends Controller
{
    public function index(Request $request)
    {
        $query = Newsletter::query();
            
        // Apply search filter
        if ($request->has('search') && !empty($request->search)) {
            $query->where('email', 'like', "%{$request->search}%");
        }
       
        // Apply date filters
        if ($request->has('start_date') && !empty($request->start_date)) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        
        if ($request->has('end_date') && !empty($request->end_date)) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
        
        // Apply sorting with field validation
        $allowedSortFields = ['email', 'source', 'created_at'];
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
        $newsletters = $query->paginate($perPage)->withQueryString();
        
        return Inertia::render('newsletters/index', [
            'newsletters' => $newsletters,
            'filters' => $request->only(['search', 'start_date', 'end_date', 'sort_field', 'sort_direction', 'per_page'])
        ]);
    }
    
    public function store(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email|max:255|unique:newsletters',
        ]);
        
        $newsletter = Newsletter::create([
            'email' => $validated['email'],
            'source' => 'admin',
        ]);
        
        return redirect()->back()->with('success', __('Newsletter subscription created successfully'));
    }
    
    public function update(Request $request, Newsletter $newsletter)
    {
        $validated = $request->validate([
            'email' => 'required|string|email|max:255|unique:newsletters,email,' . $newsletter->id,
        ]);
        
        $newsletter->update([
            'email' => $validated['email'],
        ]);
        
        return redirect()->back()->with('success', __('Newsletter subscription updated successfully'));
    }
    
    public function destroy(Newsletter $newsletter)
    {
        $newsletter->delete();
        
        return redirect()->back()->with('success', __('Newsletter subscription deleted successfully'));
    }
    
    
    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:newsletters,id'
        ]);
        
        Newsletter::whereIn('id', $validated['ids'])->delete();
        
        return redirect()->back()->with('success', __('Selected newsletter subscriptions deleted successfully'));
    }
    
    public function export(Request $request)
    {
        $query = Newsletter::query();
        
        // Apply same filters as index
        if ($request->has('search') && !empty($request->search)) {
            $query->where('email', 'like', "%{$request->search}%");
        }
        
        
        if ($request->has('start_date') && !empty($request->start_date)) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        
        if ($request->has('end_date') && !empty($request->end_date)) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
        
        $newsletters = $query->orderBy('created_at', 'desc')->get();
        
        $filename = 'newsletters_' . now()->format('Y-m-d_H-i-s') . '.csv';
        
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];
        
        $callback = function() use ($newsletters) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['Email', 'Source', 'Created At']);
            
            foreach ($newsletters as $newsletter) {
                fputcsv($file, [
                    $newsletter->email,
                    $newsletter->source,
                    $newsletter->created_at->format('Y-m-d H:i:s'),
                ]);
            }
            
            fclose($file);
        };
        
        return response()->stream($callback, 200, $headers);
    }
}