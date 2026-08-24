<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskDependency;
use App\Notifications\TaskBlockedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskDependencyController extends Controller
{
    public function index(Task $task): JsonResponse
    {
        $dependencies = $task->dependencies()
            ->with('taskStage')
            ->get()
            ->map(fn($dep) => [
                'id' => $dep->id,
                'title' => $dep->title,
                'status' => $dep->taskStage?->name ?? 'Unknown',
                'progress' => $dep->progress,
                'type' => $dep->pivot->type,
                'is_completed' => $dep->progress >= 100,
            ]);

        $dependents = $task->dependents()
            ->with('taskStage')
            ->get()
            ->map(fn($dep) => [
                'id' => $dep->id,
                'title' => $dep->title,
                'status' => $dep->taskStage?->name ?? 'Unknown',
                'progress' => $dep->progress,
                'type' => $dep->pivot->type,
            ]);

        return response()->json([
            'success' => true,
            'dependencies' => $dependencies,
            'dependents' => $dependents,
            'is_blocked' => $task->isBlocked(),
        ]);
    }

    public function store(Request $request, Task $task): JsonResponse
    {
        $request->validate([
            'depends_on_id' => 'required|integer|exists:tasks,id',
            'type' => 'nullable|in:finish_to_start,start_to_start,finish_to_finish,start_to_finish',
        ]);

        $dependsOnId = $request->input('depends_on_id');

        if ($dependsOnId == $task->id) {
            return response()->json(['success' => false, 'message' => 'A task cannot depend on itself.'], 422);
        }

        if ($task->dependencies()->where('depends_on_id', $dependsOnId)->exists()) {
            return response()->json(['success' => false, 'message' => 'This dependency already exists.'], 422);
        }

        if ($this->wouldCreateCircular($task->id, $dependsOnId)) {
            return response()->json(['success' => false, 'message' => 'This would create a circular dependency.'], 422);
        }

        TaskDependency::create([
            'task_id' => $task->id,
            'depends_on_id' => $dependsOnId,
            'type' => $request->input('type', 'finish_to_start'),
        ]);

        $dependsOn = Task::find($dependsOnId);
        if ($task->isBlocked() && $task->assigned_to) {
            $task->assignedTo->notify(new TaskBlockedNotification($task, $dependsOn));
        }

        return response()->json([
            'success' => true,
            'message' => 'Dependency added.',
            'is_blocked' => $task->isBlocked(),
        ]);
    }

    public function destroy(Task $task, int $dependsOnId): JsonResponse
    {
        $task->dependencies()->detach($dependsOnId);

        return response()->json([
            'success' => true,
            'message' => 'Dependency removed.',
            'is_blocked' => $task->isBlocked(),
        ]);
    }

    private function wouldCreateCircular(int $taskId, int $dependsOnId, array $visited = []): bool
    {
        if ($dependsOnId == $taskId) return true;
        if (in_array($dependsOnId, $visited)) return false;

        $visited[] = $dependsOnId;

        $upstream = TaskDependency::where('task_id', $dependsOnId)->pluck('depends_on_id');
        foreach ($upstream as $upId) {
            if ($this->wouldCreateCircular($taskId, $upId, $visited)) return true;
        }

        return false;
    }
}
