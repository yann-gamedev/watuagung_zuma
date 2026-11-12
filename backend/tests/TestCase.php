<?php

namespace Tests;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use PDOException;

abstract class TestCase extends BaseTestCase
{
    /** @var array<string, true> */
    private array $failingInsertTables = [];

    private bool $failInsertHooked = false;

    protected function usesMysql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }

    /**
     * Make INSERTs into $table fail inside the application's transaction.
     *
     * MySQL/MariaDB implicitly commit on DDL (DROP TABLE, CREATE TRIGGER), which would end
     * RefreshDatabase's wrapping transaction and make rollback assertions meaningless. The
     * failure is therefore thrown just before the INSERT runs, as a QueryException.
     */
    protected function failInsertsInto(string $table): void
    {
        $this->failingInsertTables[$table] = true;
        if ($this->failInsertHooked) {
            return;
        }
        $this->failInsertHooked = true;
        DB::connection()->beforeExecuting(function (string $query, array $bindings, $connection): void {
            foreach (array_keys($this->failingInsertTables) as $table) {
                if (preg_match('/^insert into [`"]'.preg_quote($table, '/').'[`"]/i', $query)) {
                    throw new QueryException($connection->getName(), $query, $bindings, new PDOException('Test failure'));
                }
            }
        });
    }

    protected function restoreInsertsInto(string $table): void
    {
        unset($this->failingInsertTables[$table]);
    }

    /** Compare captured SQL across grammars: MySQL quotes identifiers with backticks. */
    protected static function normalizeSql(string $sql): string
    {
        return str_replace('`', '"', $sql);
    }
}
