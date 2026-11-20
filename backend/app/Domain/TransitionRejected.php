<?php

namespace App\Domain;

use RuntimeException;

/** Transisi status ditolak aturan; controller mengubahnya menjadi respons HTTP dengan status yang sama. */
final class TransitionRejected extends RuntimeException
{
    /** @param array<string, list<string>> $errors */
    public function __construct(public readonly int $status, string $message, public readonly array $errors = [])
    {
        parent::__construct($message);
    }

    /** @return array{message: string, errors?: array<string, list<string>>} */
    public function body(): array
    {
        return $this->errors === [] ? ['message' => $this->getMessage()] : ['message' => $this->getMessage(), 'errors' => $this->errors];
    }
}
