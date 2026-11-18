<?php

namespace Database\Factories;

use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicle>
 */
class VehicleFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'plate' => strtoupper(fake()->unique()->bothify('???###')),
            'brand' => 'TOYOTA',
            'model' => 'YARIS',
            'year' => 2018,
            'current_mileage' => 45000,
        ];
    }
}
