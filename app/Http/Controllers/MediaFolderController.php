<?php

namespace App\Http\Controllers;

use App\Models\MediaAccess;
use App\Models\MediaFolder;
use App\Models\MediaItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MediaFolderController extends Controller
{
    public function index(): JsonResponse
    {
        $user = auth()->user();

        $folders = MediaFolder::where('workspace_id', $user->current_workspace_id)
            ->orderBy('name')
            ->get()
            ->map(fn($f) => $this->formatFolder($f));

        return response()->json($folders);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'      => 'required|string|max:255',
            'color'     => 'nullable|string|max:20',
            'parent_id' => 'nullable|integer|exists:media_folders,id',
        ]);

        $user = auth()->user();

        $folder = MediaFolder::create([
            'name'         => $request->name,
            'color'        => $request->color ?? '#3B82F6',
            'parent_id'    => $request->parent_id,
            'workspace_id' => $user->current_workspace_id,
            'user_id'      => $user->id,
        ]);

        return response()->json([
            'message' => __('Folder created'),
            'folder'  => $this->formatFolder($folder),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name'  => 'required|string|max:255',
            'color' => 'nullable|string|max:20',
        ]);

        $folder = $this->resolveFolder($id);
        $folder->update([
            'name'  => $request->name,
            'color' => $request->color ?? $folder->color,
        ]);

        return response()->json(['message' => __('Folder updated'), 'folder' => $this->formatFolder($folder->fresh())]);
    }

    public function destroy(int $id): JsonResponse
    {
        $folder = $this->resolveFolder($id);
        $this->deleteRecursive($folder);

        return response()->json(['message' => __('Folder deleted')]);
    }

    public function toggleLock(int $id): JsonResponse
    {
        $folder = $this->resolveFolder($id);
        $folder->is_locked = !$folder->is_locked;
        $folder->save();

        return response()->json([
            'message'   => $folder->is_locked ? __('Folder locked') : __('Folder unlocked'),
            'is_locked' => $folder->is_locked,
        ]);
    }

    public function accesses(int $id): JsonResponse
    {
        $folder = $this->resolveFolder($id);

        $list = MediaAccess::where('resource_type', 'folder')
            ->where('resource_id', $folder->id)
            ->select('id', 'email', 'created_at')
            ->get();

        return response()->json($list);
    }

    public function storeAccess(Request $request, int $id): JsonResponse
    {
        $request->validate(['email' => 'required|email|max:255']);

        $folder = $this->resolveFolder($id);

        MediaAccess::firstOrCreate(
            [
                'resource_type' => 'folder',
                'resource_id'   => $folder->id,
                'email'         => strtolower($request->email),
            ],
            ['granted_by' => auth()->id()]
        );

        return response()->json(['message' => __('Access granted')]);
    }

    public function destroyAccess(Request $request, int $id): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        $folder = $this->resolveFolder($id);

        MediaAccess::where([
            'resource_type' => 'folder',
            'resource_id'   => $folder->id,
            'email'         => strtolower($request->email),
        ])->delete();

        return response()->json(['message' => __('Access revoked')]);
    }

    private function resolveFolder(int $id): MediaFolder
    {
        return MediaFolder::where('id', $id)
            ->where('workspace_id', auth()->user()->current_workspace_id)
            ->firstOrFail();
    }

    private function formatFolder(MediaFolder $folder): array
    {
        $accesses = MediaAccess::where('resource_type', 'folder')
            ->where('resource_id', $folder->id)
            ->pluck('email')
            ->toArray();

        return [
            'id'          => $folder->id,
            'name'        => $folder->name,
            'color'       => $folder->color,
            'parent_id'   => $folder->parent_id,
            'is_locked'   => $folder->is_locked,
            'user_id'     => $folder->user_id,
            'accesses'    => $accesses,
            'items_count' => $folder->items()->count() + $folder->children()->count(),
            'created_at'  => $folder->created_at,
        ];
    }

    private function deleteRecursive(MediaFolder $folder): void
    {
        foreach ($folder->children()->get() as $child) {
            $this->deleteRecursive($child);
        }
        // Unassign files instead of deleting them
        MediaItem::where('folder_id', $folder->id)->update(['folder_id' => null]);
        MediaAccess::where('resource_type', 'folder')->where('resource_id', $folder->id)->delete();
        $folder->delete();
    }
}
