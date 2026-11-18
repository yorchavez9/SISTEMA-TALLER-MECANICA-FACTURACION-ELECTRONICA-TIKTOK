<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'in:10,15,25,50'],
        ]);

        $search = $filters['search'] ?? null;

        $logs = ActivityLog::query()
            ->with('user:id,first_name,last_name,email')
            ->when($search, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('description', 'like', "%{$search}%")
                        ->orWhere('action', 'like', "%{$search}%")
                        ->orWhereHas('user', fn (Builder $q) => $q
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%"));
                });
            })
            ->latest('created_at')
            ->latest('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString()
            ->through(fn (ActivityLog $log): array => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'user' => $log->user ? ['name' => $log->user->name, 'email' => $log->user->email] : null,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at->toIso8601String(),
            ]);

        return Inertia::render('activity-logs/index', [
            'logs' => $logs,
            'filters' => ['search' => $search ?? ''],
        ]);
    }
}
