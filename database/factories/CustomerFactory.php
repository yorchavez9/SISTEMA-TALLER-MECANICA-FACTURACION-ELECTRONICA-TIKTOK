<?php

namespace Database\Factories;

use App\Enums\IdentityDocumentType;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'document_type' => IdentityDocumentType::Dni,
            'document_number' => (string) fake()->unique()->numberBetween(10000000, 99999999),
            'name' => mb_strtoupper(fake()->name()),
            'phone' => '987654321',
        ];
    }
}
