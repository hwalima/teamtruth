<?php

namespace App\Modules\Banking\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A bank (or banking agency) that holds accounts for group companies. */
class Bank extends Model
{
    protected $table = 'banking_banks';

    protected $fillable = ['name', 'code'];

    public function accounts(): HasMany
    {
        return $this->hasMany(BankAccount::class, 'bank_id');
    }
}
