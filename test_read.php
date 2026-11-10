<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
use Maatwebsite\Excel\Facades\Excel;
$data = Excel::toArray([], 'storage/app/test_odoo_products.xlsx');
if (!empty($data)) {
    $headers = $data[0][0] ?? [];
    print_r($headers);
    echo 'Total rows: ' . (count($data[0]) - 1) . PHP_EOL;
}
