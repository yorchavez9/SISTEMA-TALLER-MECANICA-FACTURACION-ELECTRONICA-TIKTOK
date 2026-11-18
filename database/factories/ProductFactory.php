<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => 'REP-'.fake()->unique()->numberBetween(1000, 99999),
            'name' => 'Filtro de aceite',
            'cost' => 15,
            'sale_price' => 30,
            'unit' => 'NIU',
            'igv_affectation' => '10',
            'is_active' => true,
        ];
    }
}
