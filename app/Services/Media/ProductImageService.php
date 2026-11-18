<?php

namespace App\Services\Media;

use App\Models\Product;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Imagen opcional de productos.
 *
 * - Se decodifica como imagen real: un archivo manipulado (p. ej. PHP con
 *   extensión .jpg) no se puede decodificar y se rechaza.
 * - Se re-codifica a WebP (máx. 1200 px) sin metadatos EXIF y se genera una
 *   miniatura de 320 px.
 * - Nombre aleatorio en companies/{id}/products/ del disco "public".
 * - En la base de datos solo se guarda la ruta relativa.
 * - El archivo anterior se borra después de confirmar la transacción.
 */
class ProductImageService
{
    private const DISK = 'public';

    private const MAX_SIZE = 1200;

    private const THUMB_SIZE = 320;

    public function replace(Product $product, UploadedFile $file): void
    {
        $path = $this->store($product->company_id, $file);
        $previous = $product->image;

        try {
            DB::transaction(function () use ($product, $path, $previous): void {
                $product->forceFill(['image' => $path])->save();

                if ($previous) {
                    DB::afterCommit(fn () => $this->deleteFiles($previous));
                }
            });
        } catch (Throwable $e) {
            $this->deleteFiles($path);

            throw $e;
        }
    }

    public function remove(Product $product): void
    {
        $previous = $product->image;

        if ($previous === null) {
            return;
        }

        DB::transaction(function () use ($product, $previous): void {
            $product->forceFill(['image' => null])->save();
            DB::afterCommit(fn () => $this->deleteFiles($previous));
        });
    }

    public function deleteFiles(string $path): void
    {
        Storage::disk(self::DISK)->delete([$path, Product::thumbPath($path)]);
    }

    private function store(int $companyId, UploadedFile $file): string
    {
        $manager = new ImageManager(new Driver);

        try {
            $image = $manager->read($file->getRealPath());
        } catch (Throwable) {
            throw ValidationException::withMessages(['image' => 'El archivo no es una imagen válida.']);
        }

        $base = 'companies/'.$companyId.'/products/'.Str::uuid();
        $path = $base.'.webp';

        $main = (clone $image)->scaleDown(self::MAX_SIZE, self::MAX_SIZE)->toWebp(80);
        $thumb = $image->cover(self::THUMB_SIZE, self::THUMB_SIZE)->toWebp(75);

        Storage::disk(self::DISK)->put($path, (string) $main);
        Storage::disk(self::DISK)->put(Product::thumbPath($path), (string) $thumb);

        return $path;
    }
}
