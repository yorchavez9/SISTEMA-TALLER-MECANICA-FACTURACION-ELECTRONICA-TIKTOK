<?php

namespace Database\Factories;

use App\Models\Service;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Service>
 */
class ServiceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Cambio de aceite '.fake()->unique()->numberBetween(1, 9999),
            'price' => 120,
            'igv_affectation' => '10',
            'subject_to_detraction' => true,
            'is_active' => true,
        ];
    }
}
