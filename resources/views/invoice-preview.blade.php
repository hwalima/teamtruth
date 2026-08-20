<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice Preview</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .invoice-header {
            border-bottom: 3px solid {{ $color }};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .invoice-title {
            font-size: 28px;
            font-weight: bold;
            color: {{ $color }};
        }
        .invoice-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .detail-section h3 {
            color: {{ $color }};
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        .detail-section p {
            font-size: 14px;
            line-height: 1.6;
            color: #666;
        }
        .invoice-items {
            margin-bottom: 30px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
        }
        .items-table thead {
            background: {{ $color }};
            color: white;
        }
        .items-table th {
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }
        .items-table td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        .items-table tbody tr:hover {
            background: #f9f9f9;
        }
        .invoice-footer {
            border-top: 2px solid {{ $color }};
            padding-top: 20px;
            text-align: right;
        }
        .total-amount {
            font-size: 24px;
            font-weight: bold;
            color: {{ $color }};
        }
        .qr-code {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .qr-code img {
            max-width: 150px;
        }
        .template-info {
            background: #f0f0f0;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="template-info">
            Template: <strong>{{ ucfirst($template) }}</strong> | QR Code: <strong>{{ $showQr ? 'Enabled' : 'Disabled' }}</strong> | Color: <strong>{{ $color }}</strong>
        </div>

        <div class="invoice-header">
            <div class="invoice-title">INVOICE</div>
        </div>

        <div class="invoice-details">
            <div class="detail-section">
                <h3>From</h3>
                <p>
                    <strong>Your Company Name</strong><br>
                    123 Business Street<br>
                    City, State 12345<br>
                    contact@company.com
                </p>
            </div>
            <div class="detail-section">
                <h3>Bill To</h3>
                <p>
                    <strong>Client Name</strong><br>
                    client@example.com
                </p>
            </div>
        </div>

        <div class="invoice-details">
            <div class="detail-section">
                <h3>Invoice Number</h3>
                <p>#INV-2024-001</p>
            </div>
            <div class="detail-section">
                <h3>Invoice Date</h3>
                <p>{{ now()->format('M d, Y') }}</p>
            </div>
        </div>

        <div class="invoice-items">
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Professional Services</td>
                        <td>10</td>
                        <td>$100.00</td>
                        <td>$1,000.00</td>
                    </tr>
                    <tr>
                        <td>Software License</td>
                        <td>1</td>
                        <td>$500.00</td>
                        <td>$500.00</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="invoice-footer">
            <div style="margin-bottom: 10px;">
                <span style="color: #666;">Subtotal:</span> <span style="font-weight: bold;">$1,500.00</span>
            </div>
            <div style="margin-bottom: 10px;">
                <span style="color: #666;">Tax (10%):</span> <span style="font-weight: bold;">$150.00</span>
            </div>
            <div class="total-amount">
                Total: $1,650.00
            </div>
        </div>

        @if($showQr)
        <div class="qr-code">
            <p style="margin-bottom: 10px; color: #666; font-size: 12px;">Payment QR Code</p>
            <svg width="150" height="150" viewBox="0 0 150 150" style="border: 1px solid #ddd; padding: 5px;">
                <rect width="150" height="150" fill="white"/>
                <rect x="10" y="10" width="30" height="30" fill="black"/>
                <rect x="110" y="10" width="30" height="30" fill="black"/>
                <rect x="10" y="110" width="30" height="30" fill="black"/>
                <circle cx="75" cy="75" r="20" fill="black"/>
            </svg>
        </div>
        @endif
    </div>
</body>
</html>
