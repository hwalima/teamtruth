<?php
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make("Illuminate\Contracts\Console\Kernel")->bootstrap();
use Maatwebsite\Excel\Facades\Excel;
$data = Excel::toArray([], "storage/app/test_odoo_products.xlsx");
echo "Headers: ";
print_r($data[0][0]);
echo "Row 1: ";
print_r($data[0][1]);
echo "Row 2: ";
print_r($data[0][2]);
echo "Total rows: " . count($data[0]) . PHP_EOL;
