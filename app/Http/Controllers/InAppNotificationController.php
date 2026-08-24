<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InAppNotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = auth()->user();
        $notifications = $user->notifications()
            ->orderByDesc('created_at')
            ->paginate(20);

        return Inertia::render('notifications/index', [
            'notifications' => $notifications,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function recent(): JsonResponse
    {
        $user = auth()->user();
        $notifications = $user->notifications()
            ->take(15)
            ->get()
            ->map(fn($n) => [
                'id' => $n->id,
                'type' => $n->data['type'] ?? 'general',
                'title' => $n->data['title'] ?? '',
                'content' => $n->data['content'] ?? '',
                'link' => $n->data['link'] ?? null,
                'sender_name' => $n->data['sender_name'] ?? null,
                'is_read' => $n->read_at !== null,
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'notifications' => $notifications,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $notification = auth()->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['success' => true]);
    }

    public function markAllAsRead(): JsonResponse
    {
        auth()->user()->unreadNotifications->markAsRead();

        return response()->json(['success' => true]);
    }

    public function destroy(string $id): JsonResponse
    {
        auth()->user()->notifications()->findOrFail($id)->delete();

        return response()->json(['success' => true]);
    }

    public function destroyAll(): JsonResponse
    {
        auth()->user()->notifications()->delete();

        return response()->json(['success' => true]);
    }
}
