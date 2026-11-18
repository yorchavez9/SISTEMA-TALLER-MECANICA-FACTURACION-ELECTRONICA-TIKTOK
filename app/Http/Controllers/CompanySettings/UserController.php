<?php

namespace App\Http\Controllers\CompanySettings;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\CompanySettings\CompanyUserRequest;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Usuarios del taller. Un usuario nunca puede ver ni modificar usuarios de
 * otro taller, ni desactivarse a sí mismo, ni dejar el taller sin administrador.
 */
class UserController extends Controller
{
    public function __construct(
        private readonly CurrentCompany $current,
        private readonly ActivityLogger $activity,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate(['search' => ['nullable', 'string', 'max:100']]);
        $search = $filters['search'] ?? null;

        $users = User::query()
            ->where('company_id', $this->current->id())
            ->with('roles:id,name')
            ->when($search, fn (Builder $q, string $s) => $q->where(fn (Builder $q) => $q
                ->where('first_name', 'like', "%{$s}%")
                ->orWhere('last_name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")))
            ->orderBy('first_name')
            ->paginate(15)
            ->withQueryString()
            ->through(function (User $u): array {
                $role = $u->roles->first()?->name;

                return [
                    'id' => $u->id,
                    'first_name' => $u->first_name,
                    'last_name' => $u->last_name,
                    'name' => $u->name,
                    'email' => $u->email,
                    'role' => $role,
                    'role_label' => $role ? UserRole::from($role)->label() : '—',
                    'is_active' => $u->is_active,
                    'last_login_at' => $u->last_login_at?->toIso8601String(),
                ];
            });

        return Inertia::render('company-settings/users', [
            'users' => $users,
            'filters' => ['search' => $search ?? ''],
            'roles' => array_map(fn (string $r) => ['value' => $r, 'label' => UserRole::from($r)->label()], CompanyUserRequest::assignableRoles()),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(CompanyUserRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $user = DB::transaction(function () use ($data): User {
            $user = new User([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'],
                'password' => $data['password'],
            ]);
            $user->company_id = $this->current->id();
            $user->is_active = true;
            $user->email_verified_at = now();
            $user->save();
            $user->assignRole($data['role']);

            return $user;
        });

        $this->activity->log('user.created', "Se creó el usuario {$user->name} ({$data['role']}).", $user);
        $this->toastSuccess('Usuario creado.');

        return back();
    }

    public function update(CompanyUserRequest $request, User $user): RedirectResponse
    {
        $this->ensureOwned($user);
        $data = $request->validated();

        if ($user->is($request->user()) && $data['role'] !== UserRole::CompanyAdmin->value && $user->hasRole(UserRole::CompanyAdmin->value)) {
            return back()->withErrors(['role' => 'No puede quitarse a sí mismo el rol de administrador.']);
        }

        if ($data['role'] !== UserRole::CompanyAdmin->value && $this->isLastActiveAdmin($user)) {
            return back()->withErrors(['role' => 'El taller debe tener al menos un administrador activo.']);
        }

        DB::transaction(function () use ($user, $data): void {
            $user->fill([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'],
            ]);

            if (! empty($data['password'])) {
                $user->password = $data['password'];
            }

            $user->save();
            $user->syncRoles([$data['role']]);
        });

        $this->activity->log('user.updated', "Se actualizó el usuario {$user->name}.", $user);
        $this->toastSuccess('Usuario actualizado.');

        return back();
    }

    public function toggle(Request $request, User $user): RedirectResponse
    {
        $this->ensureOwned($user);

        if ($user->is($request->user())) {
            return back()->withErrors(['api' => 'No puede desactivar su propia cuenta.']);
        }

        if ($user->is_active && $this->isLastActiveAdmin($user)) {
            return back()->withErrors(['api' => 'El taller debe tener al menos un administrador activo.']);
        }

        $user->forceFill(['is_active' => ! $user->is_active])->save();

        $this->activity->log($user->is_active ? 'user.activated' : 'user.deactivated', ($user->is_active ? 'Se activó' : 'Se desactivó')." el usuario {$user->name}.", $user);
        $this->toastSuccess($user->is_active ? 'Usuario activado.' : 'Usuario desactivado: ya no podrá ingresar.');

        return back();
    }

    private function ensureOwned(User $user): void
    {
        abort_unless($user->company_id !== null && $user->company_id === $this->current->id(), 404);
    }

    private function isLastActiveAdmin(User $user): bool
    {
        if (! $user->hasRole(UserRole::CompanyAdmin->value)) {
            return false;
        }

        return User::query()
            ->where('company_id', $user->company_id)
            ->where('is_active', true)
            ->whereKeyNot($user->id)
            ->whereHas('roles', fn (Builder $q) => $q->where('name', UserRole::CompanyAdmin->value))
            ->doesntExist();
    }
}
