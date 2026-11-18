<?php

namespace App\Policies;

use App\Models\ElectronicDocument;
use App\Models\User;
use App\Policies\Concerns\ChecksCompanyPermission;

/**
 * Comprobantes electrónicos: ver/descargar, emitir y anular con NC.
 */
class ElectronicDocumentPolicy
{
    use ChecksCompanyPermission;

    protected function module(): string
    {
        return 'documents';
    }

    /** Emitir, consultar estado, verificar, reintentar, reenviar o descartar. */
    public function operate(User $user, ElectronicDocument $document): bool
    {
        return $user->can('documents.issue') && $this->sameCompany($document);
    }

    public function creditNote(User $user, ElectronicDocument $document): bool
    {
        return $user->can('documents.credit_note') && $this->sameCompany($document);
    }
}
