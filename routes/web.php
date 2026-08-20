<?php

use App\Http\Controllers\CookieConsentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InvoicePreviewController;
use App\Http\Controllers\NotificationTemplateController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\PlanOrderController;
use App\Http\Controllers\PlanRequestController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SlackSettingsController;

use App\Http\Controllers\ReferralController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\WorkspaceController;
use App\Http\Controllers\WorkspaceInvitationController;




use App\Http\Controllers\CouponController;

use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\ImpersonateController;
use App\Http\Controllers\TranslationController;
use App\Http\Controllers\LandingPageController;

use App\Http\Controllers\LandingPage\CustomPageController;
use App\Http\Controllers\LanguageController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\MediaFolderController;
use App\Http\Controllers\RazorpayController;
use App\Http\Controllers\MercadoPagoController;
use App\Http\Controllers\StripePaymentController;
use App\Http\Controllers\PayPalPaymentController;
use App\Http\Controllers\BankPaymentController;
use App\Http\Controllers\PaystackPaymentController;
use App\Http\Controllers\FlutterwavePaymentController;
use App\Http\Controllers\PayTabsPaymentController;
use App\Http\Controllers\SkrillPaymentController;
use App\Http\Controllers\CoinGatePaymentController;
use App\Http\Controllers\PayfastPaymentController;
use App\Http\Controllers\TapPaymentController;
use App\Http\Controllers\XenditPaymentController;
use App\Http\Controllers\PayTRPaymentController;
use App\Http\Controllers\MolliePaymentController;
use App\Http\Controllers\ToyyibPayPaymentController;
use App\Http\Controllers\CashfreeController;
use App\Http\Controllers\IyzipayPaymentController;
use App\Http\Controllers\BenefitPaymentController;
use App\Http\Controllers\OzowPaymentController;
use App\Http\Controllers\EasebuzzPaymentController;
use App\Http\Controllers\KhaltiPaymentController;
use App\Http\Controllers\AuthorizeNetPaymentController;
use App\Http\Controllers\FedaPayPaymentController;
use App\Http\Controllers\PayHerePaymentController;
use App\Http\Controllers\CinetPayPaymentController;
use App\Http\Controllers\PaiementPaymentController;
use App\Http\Controllers\NepalstePaymentController;
use App\Http\Controllers\YooKassaPaymentController;
use App\Http\Controllers\AamarpayPaymentController;
use App\Http\Controllers\MidtransPaymentController;
use App\Http\Controllers\InvoicePaymentController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\GoogleMeetingController;



use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Critical payment callback routes (must be first, no middleware)
Route::withoutMiddleware(['web', \App\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        // Easebuzz payment callback routes
        Route::match(['GET', 'POST'], 'payments/easebuzz/invoice-success', [EasebuzzPaymentController::class, 'invoiceSuccess'])->name('easebuzz.invoice.success');

        // Iyzipay invoice payment routes
        Route::match(['GET', 'POST'], 'iyzipay/invoice/success', [IyzipayPaymentController::class, 'invoiceSuccess'])->name('iyzipay.invoice.success');
        Route::match(['GET', 'POST'], 'iyzipay/invoice/callback', [IyzipayPaymentController::class, 'invoiceCallback'])->name('iyzipay.invoice.callback');
        Route::match(['GET', 'POST'], 'iyzipay/invoice/success/{token}', [IyzipayPaymentController::class, 'invoiceSuccessFromLink'])->name('iyzipay.invoice.success.link');

        // Invitation routes (public access for accepting invitations)
        Route::get('invitations/{token}', [WorkspaceInvitationController::class, 'show'])
            ->name('invitations.show');
        Route::post('invitations/{token}/accept', [WorkspaceInvitationController::class, 'accept'])
            ->name('invitations.accept');
    });

// Language layout direction update (public route)
Route::post('update-layout-direction', [LanguageController::class, 'updateLayoutDirection'])->name('update-layout-direction');
Route::post('user/update-layout-direction', [UserController::class, 'updateLayoutDirection'])->name('user.update-layout-direction');
Route::post('user/update-language', [UserController::class, 'updateLanguage'])->name('user.update-language');
Route::post('languages/change', [LanguageController::class, 'changeLanguage'])->name('languages.change');

Route::get('/', [LandingPageController::class, 'show'])->name('home');

// Template download route (temporary - outside middleware for testing)
Route::get('/getTemplate/{type}', [App\Http\Controllers\ExportImportController::class, 'getTemplate'])
    ->name('getTemplate.test');

// Public project view routes
Route::get('project/{encryptedId}', [\App\Http\Controllers\ProjectController::class, 'publicView'])
    ->name('projects.public-view');
Route::post('project/{encryptedId}', [\App\Http\Controllers\ProjectController::class, 'publicView'])
    ->name('projects.public-view.password');

// Public invoice payment routes
Route::get('invoices/payment/{token}', [InvoicePaymentController::class, 'show'])
    ->name('invoices.payment');
Route::get('invoices/payment/{token}/preview', [InvoicePaymentController::class, 'preview'])
    ->name('invoices.payment.preview');
Route::post('invoices/payment/{token}', [InvoicePaymentController::class, 'processPayment'])
    ->name('invoices.payment.process');

// AuthorizeNet payment processing route (public, no middleware)
Route::withoutMiddleware(['web', \App\Http\Middleware\VerifyCsrfToken::class])->group(function () {
    Route::post('authorizenet/process-invoice-payment-link', [AuthorizeNetPaymentController::class, 'processInvoicePaymentFromLink'])
        ->name('authorizenet.process-invoice-payment-link');
});

// Public form submission routes


// Route::post('/api/public/verify-password', [PublicVCardController::class, 'verifyPassword'])->name('public.vcard.verify-password');


// Cashfree webhook (public route)
Route::post('cashfree/webhook', [CashfreeController::class, 'webhook'])->name('cashfree.webhook');

// Benefit webhook (public route)
Route::post('benefit/webhook', [BenefitPaymentController::class, 'webhook'])->name('benefit.webhook');
Route::get('payments/benefit/success', [BenefitPaymentController::class, 'success'])->name('benefit.success');
Route::post('payments/benefit/callback', [BenefitPaymentController::class, 'callback'])->name('benefit.callback');
Route::get('payments/benefit/invoice-success', [BenefitPaymentController::class, 'invoiceSuccess'])->name('benefit.invoice.success');
Route::post('payments/benefit/invoice-callback', [BenefitPaymentController::class, 'invoiceCallback'])->name('benefit.invoice.callback');
Route::post('benefit/process-invoice-payment', [BenefitPaymentController::class, 'processInvoicePayment'])->name('benefit.process-invoice-payment');
Route::post('benefit/invoice-payment/{token}', [BenefitPaymentController::class, 'processInvoicePaymentFromLink'])->name('benefit.invoice.payment.link');
Route::match(['GET', 'POST'], 'benefit/invoice/success/{token}', [BenefitPaymentController::class, 'invoiceSuccessFromLink'])->name('benefit.invoice.success.link');


// Payment gateway invoice routes (public - no CSRF)
// Aamarpay route moved to CSRF-excluded section below
Route::post('mollie/create-invoice-payment', [MolliePaymentController::class, 'createInvoicePayment'])
    ->name('mollie.create-invoice-payment');

Route::post('tap/create-invoice-payment', [TapPaymentController::class, 'createInvoicePayment'])
    ->name('tap.create-invoice-payment');
Route::post('payhere/create-invoice-payment', [PayHerePaymentController::class, 'createInvoicePayment'])
    ->name('payhere.create-invoice-payment');
Route::post('cinetpay/create-invoice-payment', [CinetPayPaymentController::class, 'createInvoicePayment'])
    ->name('cinetpay.create-invoice-payment');
Route::post('fedapay/create-invoice-payment', [FedaPayPaymentController::class, 'createInvoicePayment'])
    ->name('fedapay.create-invoice-payment');
Route::post('fedapay/create-invoice-payment-link', [FedaPayPaymentController::class, 'createInvoicePaymentFromLink'])
    ->name('fedapay.create-invoice-payment-link');
Route::post('paytabs/create-invoice-payment', [PayTabsPaymentController::class, 'createInvoicePayment'])
    ->name('paytabs.create-invoice-payment');
Route::post('khalti/create-invoice-payment', [KhaltiPaymentController::class, 'createInvoicePayment'])
    ->name('khalti.create-invoice-payment');
Route::post('khalti/process-invoice-payment', [KhaltiPaymentController::class, 'processInvoicePayment'])
    ->name('khalti.process-invoice-payment');
Route::post('easebuzz/create-invoice-payment', [EasebuzzPaymentController::class, 'createInvoicePayment'])
    ->name('easebuzz.create-invoice-payment');
Route::post('ozow/create-invoice-payment', [OzowPaymentController::class, 'createInvoicePayment'])
    ->name('ozow.create-invoice-payment');
Route::post('cashfree/create-invoice-payment', [CashfreeController::class, 'createInvoicePayment'])
    ->name('cashfree.create-invoice-payment');
Route::post('cashfree/verify-invoice-payment', [CashfreeController::class, 'verifyInvoicePayment'])
    ->name('cashfree.verify-invoice-payment');
Route::post('paytabs/create-invoice-payment', [PayTabsPaymentController::class, 'createInvoicePayment'])
    ->name('paytabs.create-invoice-payment');
Route::post('toyyibpay/create-invoice-payment', [ToyyibPayPaymentController::class, 'createInvoicePayment'])
    ->name('toyyibpay.create-invoice-payment');
Route::post('stripe/invoice-payment', [StripePaymentController::class, 'processInvoicePayment'])
    ->name('stripe.invoice.payment');
Route::post('stripe/invoice-payment/{token}', [StripePaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('stripe.invoice.payment.link');
Route::post('bank/invoice-payment', [BankPaymentController::class, 'processInvoicePayment'])
    ->name('bank.invoice.payment');
Route::post('bank/invoice-payment/{token}', [BankPaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('bank.invoice.payment.link');
Route::post('paypal/invoice-payment', [PayPalPaymentController::class, 'processInvoicePayment'])
    ->name('paypal.invoice.payment');
Route::post('paypal/invoice-payment/{token}', [PayPalPaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('paypal.invoice.payment.link');
Route::post('xendit/invoice-payment', [XenditPaymentController::class, 'processInvoicePayment'])
    ->name('xendit.invoice.payment');
Route::post('paytr/invoice-payment', [PayTRPaymentController::class, 'processInvoicePayment'])
    ->name('paytr.invoice.payment');
Route::post('mollie/invoice-payment', [MolliePaymentController::class, 'processInvoicePayment'])
    ->name('mollie.invoice.payment');
Route::post('toyyibpay/invoice-payment', [ToyyibPayPaymentController::class, 'processInvoicePayment'])
    ->name('toyyibpay.invoice.payment');
Route::post('midtrans/invoice-payment', [MidtransPaymentController::class, 'processInvoicePayment'])
    ->name('midtrans.invoice.payment');
Route::post('paystack/invoice-payment/{token}', [PaystackPaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('paystack.invoice.payment.link');
Route::post('flutterwave/invoice-payment/{token}', [FlutterwavePaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('flutterwave.invoice.payment.link');
Route::post('tap/invoice-payment/{token}', [TapPaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('tap.invoice.payment.link');
Route::match(['GET', 'POST'], 'tap/invoice/success/{token}', [TapPaymentController::class, 'invoiceSuccessFromLink'])
    ->name('tap.invoice.success.link');
Route::post('xendit/invoice-payment/{token}', [XenditPaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('xendit.invoice.payment.link');
Route::match(['GET', 'POST'], 'xendit/invoice/success/{token}', [XenditPaymentController::class, 'invoiceSuccessFromLink'])
    ->name('xendit.invoice.success.link');
Route::post('paytr/invoice-payment/{token}', [PayTRPaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('paytr.invoice.payment.link');
Route::match(['GET', 'POST'], 'paytr/invoice/success/{token}', [PayTRPaymentController::class, 'invoiceSuccessFromLink'])
    ->name('paytr.invoice.success.link');
Route::post('mollie/invoice-payment/{token}', [MolliePaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('mollie.invoice.payment.link');
Route::match(['GET', 'POST'], 'mollie/invoice/success/{token}', [MolliePaymentController::class, 'invoiceSuccessFromLink'])
    ->name('mollie.invoice.success.link');
Route::post('toyyibpay/invoice-payment/{token}', [ToyyibPayPaymentController::class, 'processInvoicePaymentFromLink'])
    ->name('toyyibpay.invoice.payment.link');
Route::match(['GET', 'POST'], 'toyyibpay/invoice/success/{token}', [ToyyibPayPaymentController::class, 'invoiceSuccessFromLink'])
    ->name('toyyibpay.invoice.success.link');

Route::withoutMiddleware([\App\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        // Aamarpay invoice payment routes
        Route::post('aamarpay/create-invoice-payment', [AamarpayPaymentController::class, 'createInvoicePayment'])->name('aamarpay.create-invoice-payment');
        Route::post('aamarpay/invoice-payment', [AamarpayPaymentController::class, 'processInvoicePayment'])->name('aamarpay.invoice.payment');
        Route::match(['GET', 'POST'], 'aamarpay/invoice/success', [AamarpayPaymentController::class, 'invoiceSuccess'])->name('aamarpay.invoice.success');
        Route::match(['GET', 'POST'], 'aamarpay/invoice/callback', [AamarpayPaymentController::class, 'invoiceCallback'])->name('aamarpay.invoice.callback');

        Route::post('skrill/invoice-payment', [SkrillPaymentController::class, 'processInvoicePayment'])->name('skrill.invoice.payment');
        Route::match(['GET', 'POST'], '/skrill/invoice/success', [SkrillPaymentController::class, 'invoiceSuccess'])->name('skrill.invoice.success');
        Route::match(['GET', 'POST'], '/skrill/invoice/callback', [SkrillPaymentController::class, 'invoiceCallback'])->name('skrill.invoice.callback');
        Route::match(['GET', 'POST'], '/payfast/invoice/success', [PayfastPaymentController::class, 'invoiceSuccess'])->name('payfast.invoice.success');
        Route::match(['GET', 'POST'], '/payfast/invoice/callback', [PayfastPaymentController::class, 'invoiceCallback'])->name('payfast.invoice.callback');
        Route::post('payfast/invoice-payment', [PayfastPaymentController::class, 'processInvoicePayment'])->name('payfast.invoice.payment');
        Route::post('payfast/invoice-payment/{token}', [PayfastPaymentController::class, 'createInvoicePaymentFromLink'])->name('payfast.create-invoice-payment-from-link');
        Route::match(['GET', 'POST'], 'payfast/invoice/success/{token}', [PayfastPaymentController::class, 'invoiceSuccessFromLink'])->name('payfast.invoice.success.from-link');

        // Iyzipay invoice payment processing
        Route::post('iyzipay/create-invoice-payment', [IyzipayPaymentController::class, 'createInvoicePayment'])->name('iyzipay.create-invoice-payment');
        Route::post('iyzipay/invoice-payment', [IyzipayPaymentController::class, 'processInvoicePayment'])->name('iyzipay.invoice.payment');
        Route::post('iyzipay/invoice-payment/{token}', [IyzipayPaymentController::class, 'processInvoicePaymentFromLink'])->name('iyzipay.invoice.payment.link');

        Route::post('aamarpay/invoice-payment/{token}', [AamarpayPaymentController::class, 'processInvoicePaymentFromLink'])->name('aamarpay.invoice.payment.link');
        Route::match(['GET', 'POST'], 'aamarpay/invoice/success/{token}', [AamarpayPaymentController::class, 'invoiceSuccessFromLink'])->name('aamarpay.invoice.success.link');
        Route::post('midtrans/invoice-payment/{token}', [MidtransPaymentController::class, 'processInvoicePaymentFromLink'])->name('midtrans.invoice.payment.link');
        Route::match(['GET', 'POST'], 'midtrans/invoice/success/{token}', [MidtransPaymentController::class, 'invoiceSuccessFromLink'])->name('midtrans.invoice.success.link');
        Route::post('yookassa/invoice-payment/{token}', [YooKassaPaymentController::class, 'processInvoicePaymentFromLink'])->name('yookassa.invoice.payment.link');
        Route::match(['GET', 'POST'], 'yookassa/invoice/success/{token}', [YooKassaPaymentController::class, 'invoiceSuccessFromLink'])->name('yookassa.invoice.success.link');
        Route::post('paiement/invoice-payment/{token}', [PaiementPaymentController::class, 'processInvoicePaymentFromLink'])->name('paiement.invoice.payment.link');
        Route::match(['GET', 'POST'], 'paiement/invoice/success/{token}', [PaiementPaymentController::class, 'invoiceSuccessFromLink'])->name('paiement.invoice.success.link');
        Route::match(['GET', 'POST'], 'paiement/invoice/callback-link', [PaiementPaymentController::class, 'invoiceCallback'])->name('paiement.invoice.callback.link');
        Route::post('cinetpay/invoice-payment/{token}', [CinetPayPaymentController::class, 'processInvoicePaymentFromLink'])->name('cinetpay.invoice.payment.link');
        Route::match(['GET', 'POST'], 'cinetpay/invoice/success/{token}', [CinetPayPaymentController::class, 'invoiceSuccessFromLink'])->name('cinetpay.invoice.success.link');
        Route::match(['GET', 'POST'], 'cinetpay/invoice/callback-link', [CinetPayPaymentController::class, 'invoiceCallback'])->name('cinetpay.invoice.callback.link');
        Route::post('payhere/invoice-payment/{token}', [PayHerePaymentController::class, 'processInvoicePaymentFromLink'])->name('payhere.invoice.payment.link');
        Route::match(['GET', 'POST'], 'payhere/invoice/success/{token}', [PayHerePaymentController::class, 'invoiceSuccessFromLink'])->name('payhere.invoice.success.link');
        Route::match(['GET', 'POST'], 'payhere/invoice/callback-link', [PayHerePaymentController::class, 'invoiceCallback'])->name('payhere.invoice.callback.link');
        Route::post('xendit/create-invoice-payment', [XenditPaymentController::class, 'createInvoicePayment'])->name('xendit.create-invoice-payment');
        Route::post('paytr/create-invoice-payment', [PayTRPaymentController::class, 'createInvoicePayment'])->name('paytr.create-invoice-payment');
        Route::post('midtrans/create-invoice-payment', [MidtransPaymentController::class, 'createInvoicePayment'])->name('midtrans.create-invoice-payment');
        Route::match(['GET', 'POST'], '/midtrans/invoice/success', [MidtransPaymentController::class, 'invoiceSuccess'])->name('midtrans.invoice.success');
        Route::match(['GET', 'POST'], '/midtrans/invoice/callback', [MidtransPaymentController::class, 'invoiceCallback'])->name('midtrans.invoice.callback');
        Route::post('khalti/invoice-payment/{token}', [KhaltiPaymentController::class, 'processInvoicePaymentFromLink'])->name('khalti.process-invoice-payment-from-link');
        Route::match(['GET', 'POST'], 'khalti/invoice/success/{token}', [KhaltiPaymentController::class, 'invoiceSuccessFromLink'])->name('khalti.invoice-success-from-link');
        Route::post('easebuzz/invoice-payment/{token}', [EasebuzzPaymentController::class, 'createInvoicePaymentFromLink'])->name('easebuzz.create-invoice-payment-from-link');
        Route::match(['GET', 'POST'], 'easebuzz/invoice/success/{token}', [EasebuzzPaymentController::class, 'invoiceSuccessFromLink'])->name('easebuzz.invoice.success.from-link');
        Route::post('ozow/invoice-payment/{token}', [OzowPaymentController::class, 'createInvoicePaymentFromLink'])->name('ozow.create-invoice-payment-from-link');
        Route::match(['GET', 'POST'], 'ozow/invoice/success/{token}', [OzowPaymentController::class, 'invoiceSuccessFromLink'])->name('ozow.invoice.success.from-link');
        Route::post('cashfree/invoice-payment/{token}', [CashfreeController::class, 'createInvoicePaymentFromLink'])->name('cashfree.create-invoice-payment-from-link');
        Route::post('cashfree/verify-invoice-payment-from-link/{token}', [CashfreeController::class, 'verifyInvoicePaymentFromLink'])->name('cashfree.verify-invoice-payment-from-link');
        Route::match(['GET', 'POST'], 'cashfree/invoice/success/{token}', [CashfreeController::class, 'invoiceSuccessFromLink'])->name('cashfree.invoice.success.from-link');
        Route::post('cashfree/invoice/callback-from-link', [CashfreeController::class, 'invoiceCallbackFromLink'])->name('cashfree.invoice.callback.from-link');
        Route::post('paytabs/invoice-payment/{token}', [PayTabsPaymentController::class, 'createInvoicePaymentFromLink'])->name('paytabs.create-invoice-payment-from-link');
        Route::match(['GET', 'POST'], 'paytabs/invoice/success/{token}', [PayTabsPaymentController::class, 'invoiceSuccessFromLink'])->name('paytabs.invoice.success.from-link');
        Route::post('paytabs/invoice/callback-from-link', [PayTabsPaymentController::class, 'invoiceCallbackFromLink'])->name('paytabs.invoice.callback.from-link');
        Route::post('skrill/invoice-payment/{token}', [SkrillPaymentController::class, 'createInvoicePaymentFromLink'])->name('skrill.create-invoice-payment-from-link');
        Route::match(['GET', 'POST'], 'skrill/invoice/success/{token}', [SkrillPaymentController::class, 'invoiceSuccessFromLink'])->name('skrill.invoice.success.from-link');
        Route::post('skrill/invoice/callback-from-link', [SkrillPaymentController::class, 'invoiceCallbackFromLink'])->name('skrill.invoice.callback.from-link');
        Route::post('coingate/invoice-payment', [CoinGatePaymentController::class, 'createInvoicePaymentFromLink'])->name('coingate.invoice.callback.from-link');
        Route::post('paiement/create-invoice-payment', [PaiementPaymentController::class, 'createInvoicePayment'])->name('paiement.create-invoice-payment');
        Route::post('paiement/invoice-payment', [PaiementPaymentController::class, 'processInvoicePayment'])->name('paiement.invoice.payment');
        Route::post('authorizenet/create-invoice-payment', [AuthorizeNetPaymentController::class, 'createInvoicePayment'])->name('authorizenet.create-invoice-payment');
        Route::post('authorizenet/process-invoice-payment', [AuthorizeNetPaymentController::class, 'processInvoicePayment'])->name('authorizenet.process-invoice-payment');

        Route::get('payments/authorizenet/invoice-success', [AuthorizeNetPaymentController::class, 'invoiceSuccess'])->name('authorizenet.invoice.success');
        Route::post('easebuzz/process-invoice-payment', [EasebuzzPaymentController::class, 'processInvoicePayment'])->name('easebuzz.process-invoice-payment');
        Route::post('ozow/process-invoice-payment', [OzowPaymentController::class, 'processInvoicePayment'])->name('ozow.process-invoice-payment');
        Route::match(['GET', 'POST'], 'payments/ozow/invoice-success', [OzowPaymentController::class, 'invoiceSuccess'])->name('ozow.invoice.success');
    });


// FedaPay callback (public route)
Route::match(['GET', 'POST'], 'payments/fedapay/callback', [FedaPayPaymentController::class, 'callback'])->name('fedapay.callback');
Route::match(['GET', 'POST'], 'payments/fedapay/invoice-callback', [FedaPayPaymentController::class, 'invoiceCallback'])->name('fedapay.invoice.callback');
Route::match(['GET', 'POST'], 'payments/fedapay/invoice-link-callback', [FedaPayPaymentController::class, 'invoiceLinkCallback'])->name('fedapay.invoice.link.callback');

// YooKassa success/callback (public routes)
Route::get('payments/yookassa/success', [YooKassaPaymentController::class, 'success'])->name('yookassa.success');
Route::post('payments/yookassa/callback', [YooKassaPaymentController::class, 'callback'])->name('yookassa.callback');
Route::get('payments/yookassa/invoice-success', [YooKassaPaymentController::class, 'invoiceSuccess'])->name('yookassa.invoice.success');
Route::post('payments/yookassa/invoice-callback', [YooKassaPaymentController::class, 'invoiceCallback'])->name('yookassa.invoice.callback');

// Nepalste success/callback (public routes)
Route::get('payments/nepalste/success', [NepalstePaymentController::class, 'success'])->name('nepalste.success');
Route::post('payments/nepalste/callback', [NepalstePaymentController::class, 'callback'])->name('nepalste.callback');



// PayTR callback (public route)
Route::post('payments/paytr/callback', [PayTRPaymentController::class, 'callback'])->name('paytr.callback');
Route::get('payments/paytr/invoice-success', [PayTRPaymentController::class, 'invoiceSuccess'])->name('paytr.invoice.success');
Route::get('payments/mollie/invoice-success', [MolliePaymentController::class, 'invoiceSuccess'])->name('mollie.invoice.success');
Route::post('payments/mollie/invoice-callback', [MolliePaymentController::class, 'invoiceCallback'])->name('mollie.invoice.callback');
Route::get('payments/toyyibpay/invoice-success', [ToyyibPayPaymentController::class, 'invoiceSuccess'])->name('toyyibpay.invoice.success');
Route::post('payments/toyyibpay/invoice-callback', [ToyyibPayPaymentController::class, 'invoiceCallback'])->name('toyyibpay.invoice.callback');

// PayTabs callback (public route)
Route::match(['GET', 'POST'], 'payments/paytabs/callback', [PayTabsPaymentController::class, 'callback'])->name('paytabs.callback');
Route::get('payments/paytabs/success', [PayTabsPaymentController::class, 'success'])->name('paytabs.success');
Route::get('payments/paytabs/invoice-success', [PayTabsPaymentController::class, 'invoiceSuccess'])->name('paytabs.invoice.success');
Route::post('payments/paytabs/invoice-callback', [PayTabsPaymentController::class, 'invoiceCallback'])->name('paytabs.invoice.callback');

// Tap payment routes (public routes)
Route::get('payments/tap/success', [TapPaymentController::class, 'success'])->name('tap.success');
Route::post('payments/tap/callback', [TapPaymentController::class, 'callback'])->name('tap.callback');
Route::get('payments/tap/invoice-success', [TapPaymentController::class, 'invoiceSuccess'])->name('tap.invoice.success');
Route::post('payments/tap/invoice-callback', [TapPaymentController::class, 'invoiceCallback'])->name('tap.invoice.callback');

// Aamarpay payment routes (public routes)
Route::match(['GET', 'POST'], 'payments/aamarpay/success', [AamarpayPaymentController::class, 'success'])->name('aamarpay.success');
Route::post('payments/aamarpay/callback', [AamarpayPaymentController::class, 'callback'])->name('aamarpay.callback');

// PayFast payment routes (public routes)
Route::get('payments/payfast/success', [PayfastPaymentController::class, 'success'])->name('payfast.success');
Route::post('payments/payfast/callback', [PayfastPaymentController::class, 'callback'])->name('payfast.callback');

// CoinGate callback (public route)
Route::match(['GET', 'POST'], 'payments/coingate/callback', [CoinGatePaymentController::class, 'callback'])->name('coingate.callback');

// CinetPay invoice payment routes (public routes)
Route::get('payments/cinetpay/invoice-success', [CinetPayPaymentController::class, 'invoiceSuccess'])->name('cinetpay.invoice.success');
Route::post('payments/cinetpay/invoice-callback', [CinetPayPaymentController::class, 'invoiceCallback'])->name('cinetpay.invoice.callback');

// PayHere invoice payment routes (public routes)
Route::get('payments/payhere/invoice-success', [PayHerePaymentController::class, 'invoiceSuccess'])->name('payhere.invoice.success');
Route::post('payments/payhere/invoice-callback', [PayHerePaymentController::class, 'invoiceCallback'])->name('payhere.invoice.callback');

// Xendit payment routes (public routes)
Route::get('payments/xendit/success', [XenditPaymentController::class, 'success'])->name('xendit.success');
Route::post('payments/xendit/callback', [XenditPaymentController::class, 'callback'])->name('xendit.callback');
Route::get('payments/xendit/invoice-success', [XenditPaymentController::class, 'invoiceSuccess'])->name('xendit.invoice.success');






Route::post('/landing-page/subscribe', [LandingPageController::class, 'subscribe'])->name('landing-page.subscribe');
Route::post('/landing-page/contact', [LandingPageController::class, 'submitContact'])->name('landing-page.contact');
Route::get('/page/{slug}', [CustomPageController::class, 'show'])->name('custom-page.show');

Route::get('/translations/{locale}', [TranslationController::class, 'getTranslations'])->name('translations');
Route::get('/initial-locale', [TranslationController::class, 'getInitialLocale'])->name('initial-locale');


// Invoice preview route (public, no auth required)
Route::get('invoice-preview', [InvoicePreviewController::class, 'preview'])->name('invoice.preview');

Route::middleware(['auth', 'verified'])->group(function () {
    // API route for getting invoice payment methods (accessible to authenticated users)
    Route::get('api/invoices/{invoice}/payment-methods', [InvoicePaymentController::class, 'getPaymentMethods'])->name('api.invoices.payment-methods');
    Route::post('benefit/create-invoice-payment', [BenefitPaymentController::class, 'createInvoicePayment'])->name('benefit.create-invoice-payment');
    Route::get('/landing-page', [LandingPageController::class, 'settings'])->middleware('permission:landing_page_manage')->name('landing-page');

    // Email Templates routes
    Route::get('email-templates', [\App\Http\Controllers\EmailTemplateController::class, 'index'])->middleware('permission:email_template_view_any')->name('email-templates.index');
    Route::get('email-templates/{emailTemplate}', [\App\Http\Controllers\EmailTemplateController::class, 'show'])->middleware('permission:email_template_view')->name('email-templates.show');
    Route::put('email-templates/{emailTemplate}/settings', [\App\Http\Controllers\EmailTemplateController::class, 'updateSettings'])->middleware('permission:email_template_update')->name('email-templates.update-settings');
    Route::put('email-templates/{emailTemplate}/content', [\App\Http\Controllers\EmailTemplateController::class, 'updateContent'])->middleware('permission:email_template_update')->name('email-templates.update-content');

    // Notification Templates routes
    Route::get('notification-templates', [NotificationTemplateController::class, 'index'])->middleware('permission:notification_template_view_any')->name('notification-templates.index');
    Route::get('notification-templates/{notificationTemplate}', [NotificationTemplateController::class, 'show'])->middleware('permission:notification_template_view')->name('notification-templates.show');
    Route::put('notification-templates/{notificationTemplate}/settings', [NotificationTemplateController::class, 'updateSettings'])->middleware('permission:notification_template_update')->name('notification-templates.update-settings');
    Route::put('notification-templates/{notificationTemplate}/content', [NotificationTemplateController::class, 'updateContent'])->middleware('permission:notification_template_update')->name('notification-templates.update-content');

    // SaaS-only routes
    Route::middleware('saas.only')->group(function () {
        // Plans routes - accessible without plan check
        Route::get('plans', [PlanController::class, 'index'])->middleware('permission:plan_view_any')->name('plans.index');
        Route::post('plans/request', [PlanController::class, 'requestPlan'])->middleware('permission:plan_request')->name('plans.request');
        Route::post('plans/cancel-request', [PlanController::class, 'cancelRequest'])->middleware('permission:plan_request')->name('plans.cancel-request');
        Route::post('plans/trial', [PlanController::class, 'startTrial'])->middleware('permission:plan_trial')->name('plans.trial');
        Route::post('plans/subscribe', [PlanController::class, 'subscribe'])->middleware('permission:plan_subscribe')->name('plans.subscribe');
        Route::post('plans/coupons/validate', [CouponController::class, 'validate'])->name('coupons.validate');

        // My Plan routes - for company users to view their own data
        Route::get('my-plan-requests', [PlanRequestController::class, 'myRequests'])->name('my-plan-requests.index');
        Route::delete('my-plan-requests/{planRequest}', [PlanRequestController::class, 'cancelMyRequest'])->name('my-plan-requests.cancel');
        Route::get('my-plan-orders', [PlanOrderController::class, 'myOrders'])->name('my-plan-orders.index');

        // Payment routes - accessible without plan check
        Route::post('payments/stripe', [StripePaymentController::class, 'processPayment'])->name('stripe.payment');
        Route::post('payments/paypal', [PayPalPaymentController::class, 'processPayment'])->name('paypal.payment');
        Route::post('payments/bank', [BankPaymentController::class, 'processPayment'])->name('bank.payment');
        Route::post('payments/paystack', [PaystackPaymentController::class, 'processPayment'])->name('paystack.payment');
        Route::post('payments/flutterwave', [FlutterwavePaymentController::class, 'processPayment'])->name('flutterwave.payment');
        Route::post('payments/paytabs', [PayTabsPaymentController::class, 'processPayment'])->name('paytabs.payment');
        Route::post('payments/skrill', [SkrillPaymentController::class, 'processPayment'])->name('skrill.payment');
        Route::post('payments/coingate', [CoinGatePaymentController::class, 'processPayment'])->name('coingate.payment');
        Route::post('payments/payfast', [PayfastPaymentController::class, 'processPayment'])->name('payfast.payment');
        Route::post('payments/mollie', [MolliePaymentController::class, 'processPayment'])->name('mollie.payment');
        Route::post('payments/toyyibpay', [ToyyibPayPaymentController::class, 'processPayment'])->name('toyyibpay.payment');
        Route::post('payments/iyzipay', [IyzipayPaymentController::class, 'processPayment'])->name('iyzipay.payment');
        Route::post('payments/benefit', [BenefitPaymentController::class, 'processPayment'])->name('benefit.payment');
        Route::post('payments/ozow', [OzowPaymentController::class, 'processPayment'])->name('ozow.payment');
        Route::post('payments/easebuzz', [EasebuzzPaymentController::class, 'processPayment'])->name('easebuzz.payment');
        Route::post('payments/khalti', [KhaltiPaymentController::class, 'processPayment'])->name('khalti.payment');
        Route::post('payments/authorizenet', [AuthorizeNetPaymentController::class, 'processPayment'])->name('authorizenet.payment');
        Route::post('payments/fedapay', [FedaPayPaymentController::class, 'processPayment'])->name('fedapay.payment');
        Route::post('payments/payhere', [PayHerePaymentController::class, 'processPayment'])->name('payhere.payment');
        Route::post('payments/cinetpay', [CinetPayPaymentController::class, 'processPayment'])->name('cinetpay.payment');
        Route::post('payments/paiement', [PaiementPaymentController::class, 'processPayment'])->name('paiement.payment');
        Route::post('payments/nepalste', [NepalstePaymentController::class, 'processPayment'])->name('nepalste.payment');
        Route::post('payments/yookassa', [YooKassaPaymentController::class, 'processPayment'])->name('yookassa.payment');
        Route::post('payments/aamarpay', [AamarpayPaymentController::class, 'processPayment'])->name('aamarpay.payment');
        Route::post('payments/midtrans', [MidtransPaymentController::class, 'processPayment'])->name('midtrans.payment');



        // Other payment creation routes
        Route::post('tap/create-payment', [TapPaymentController::class, 'createPayment'])->name('tap.create-payment');
        Route::post('xendit/create-payment', [XenditPaymentController::class, 'createPayment'])->name('xendit.create-payment');
        Route::post('payments/paytr/create-token', [PayTRPaymentController::class, 'createPaymentToken'])->name('paytr.create-token');

        Route::post('iyzipay/create-form', [IyzipayPaymentController::class, 'createPaymentForm'])->name('iyzipay.create-form');
        Route::post('benefit/create-session', [BenefitPaymentController::class, 'createPaymentSession'])->name('benefit.create-session');
        Route::post('ozow/create-payment', [OzowPaymentController::class, 'createPayment'])->name('ozow.create-payment');
        Route::post('easebuzz/create-payment', [EasebuzzPaymentController::class, 'createPayment'])->name('easebuzz.create-payment');
        Route::post('khalti/create-payment', [KhaltiPaymentController::class, 'createPayment'])->name('khalti.create-payment');
        Route::post('authorizenet/create-form', [AuthorizeNetPaymentController::class, 'createPaymentForm'])->name('authorizenet.create-form');
        Route::post('fedapay/create-payment', [FedaPayPaymentController::class, 'createPayment'])->name('fedapay.create-payment');
        Route::post('payhere/create-payment', [PayHerePaymentController::class, 'createPayment'])->name('payhere.create-payment');
        Route::post('cinetpay/create-payment', [CinetPayPaymentController::class, 'createPayment'])->name('cinetpay.create-payment');
        Route::post('paiement/create-payment', [PaiementPaymentController::class, 'createPayment'])->name('paiement.create-payment');
        Route::post('nepalste/create-payment', [NepalstePaymentController::class, 'createPayment'])->name('nepalste.create-payment');
        Route::post('yookassa/create-payment', [YooKassaPaymentController::class, 'createPayment'])->name('yookassa.create-payment');
        Route::post('yookassa/create-invoice-payment', [YooKassaPaymentController::class, 'createInvoicePayment'])->name('yookassa.create-invoice-payment');
        Route::post('aamarpay/create-payment', [AamarpayPaymentController::class, 'createPayment'])->name('aamarpay.create-payment');
        Route::post('midtrans/create-payment', [MidtransPaymentController::class, 'createPayment'])->name('midtrans.create-payment');

        // Route moved to CSRF-excluded section above

        // Payment success/callback routes
        Route::post('payments/skrill/callback', [SkrillPaymentController::class, 'callback'])->name('skrill.callback');
        Route::post('skrill/create-invoice-payment', [SkrillPaymentController::class, 'processInvoicePayment'])->name('skrill.create-invoice-payment');
        Route::post('coingate/create-invoice-payment', [CoinGatePaymentController::class, 'processInvoicePayment'])->name('coingate.create-invoice-payment');
        Route::post('payfast/create-invoice-payment', [PayfastPaymentController::class, 'processInvoicePayment'])->name('payfast.create-invoice-payment');
        Route::get('payments/paytr/success', [PayTRPaymentController::class, 'success'])->name('paytr.success');
        Route::get('payments/paytr/failure', [PayTRPaymentController::class, 'failure'])->name('paytr.failure');
        Route::get('payments/mollie/success', [MolliePaymentController::class, 'success'])->name('mollie.success');
        Route::post('payments/mollie/callback', [MolliePaymentController::class, 'callback'])->name('mollie.callback');
        Route::match(['GET', 'POST'], 'payments/toyyibpay/success', [ToyyibPayPaymentController::class, 'success'])->name('toyyibpay.success');
        Route::post('payments/toyyibpay/callback', [ToyyibPayPaymentController::class, 'callback'])->name('toyyibpay.callback');
        Route::get('payments/ozow/success', [OzowPaymentController::class, 'success'])->name('ozow.success');
        Route::post('payments/ozow/callback', [OzowPaymentController::class, 'callback'])->name('ozow.callback');
        Route::get('payments/payhere/success', [PayHerePaymentController::class, 'success'])->name('payhere.success');
        Route::post('payments/payhere/callback', [PayHerePaymentController::class, 'callback'])->name('payhere.callback');
        Route::get('payments/cinetpay/success', [CinetPayPaymentController::class, 'success'])->name('cinetpay.success');
        Route::post('payments/cinetpay/callback', [CinetPayPaymentController::class, 'callback'])->name('cinetpay.callback');
        Route::get('payments/paiement/success', [PaiementPaymentController::class, 'success'])->name('paiement.success');
        Route::post('payments/paiement/callback', [PaiementPaymentController::class, 'callback'])->name('paiement.callback');
        Route::get('payments/paiement/invoice-success', [PaiementPaymentController::class, 'invoiceSuccess'])->name('paiement.invoice.success');
        Route::post('payments/paiement/invoice-callback', [PaiementPaymentController::class, 'invoiceCallback'])->name('paiement.invoice.callback');
        Route::post('payments/midtrans/callback', [MidtransPaymentController::class, 'callback'])->name('midtrans.callback');
        Route::get('mercadopago/success', [MercadoPagoController::class, 'success'])->name('mercadopago.success');
        Route::get('mercadopago/failure', [MercadoPagoController::class, 'failure'])->name('mercadopago.failure');
        Route::get('mercadopago/pending', [MercadoPagoController::class, 'pending'])->name('mercadopago.pending');
        Route::post('mercadopago/webhook', [MercadoPagoController::class, 'webhook'])->name('mercadopago.webhook');
        Route::post('authorizenet/test-connection', [AuthorizeNetPaymentController::class, 'testConnection'])->name('authorizenet.test-connection');
    }); // End SaaS-only routes

    // All other routes require plan access check and plan limits monitoring
    Route::middleware(['plan.access', 'plan.limits'])->group(function () {
        // Workspace routes
        Route::get('workspaces', [WorkspaceController::class, 'index'])->middleware('permission:workspace_view_any')->name('workspaces.index');
        Route::get('workspaces/create', [WorkspaceController::class, 'create'])->middleware('permission:workspace_create')->name('workspaces.create');
        Route::post('workspaces', [WorkspaceController::class, 'store'])->middleware('permission:workspace_create')->name('workspaces.store');
        Route::get('workspaces/{workspace}', [WorkspaceController::class, 'show'])->middleware('permission:workspace_view')->name('workspaces.show');
        Route::get('workspaces/{workspace}/edit', [WorkspaceController::class, 'edit'])->middleware('permission:workspace_update')->name('workspaces.edit');
        Route::put('workspaces/{workspace}', [WorkspaceController::class, 'update'])->middleware('permission:workspace_update')->name('workspaces.update');
        Route::patch('workspaces/{workspace}', [WorkspaceController::class, 'update'])->middleware('permission:workspace_update');
        Route::delete('workspaces/{workspace}', [WorkspaceController::class, 'destroy'])->middleware('permission:workspace_delete')->name('workspaces.destroy');

        Route::get('workspaces/check-limits', [WorkspaceController::class, 'checkLimits'])->middleware('permission:workspace_view_any')->name('workspaces.check-limits');
        Route::post('workspaces/{workspace}/switch', [WorkspaceController::class, 'switch'])->middleware('permission:workspace_switch')->name('workspaces.switch');
        Route::post('workspaces/{workspace}/invitations', [WorkspaceInvitationController::class, 'store'])->middleware('permission:workspace_invite_members')->name('workspace.invitations.store');
        Route::delete('workspaces/{workspace}/members/{user}', [WorkspaceController::class, 'removeMember'])->middleware('permission:workspace_manage_members')->name('workspace.remove-member');
        Route::post('workspaces/{workspace}/leave', [WorkspaceController::class, 'leaveWorkspace'])->middleware('permission:workspace_leave')->name('workspaces.leave');
        Route::get('workspaces/user-workspace-count', [WorkspaceController::class, 'getUserWorkspaceCount'])->name('workspaces.user-workspace-count');
        Route::post('invitations/{invitation}/resend', [WorkspaceInvitationController::class, 'resend'])->middleware('permission:workspace_invite_members')->name('invitations.resend');
        Route::delete('invitations/{invitation}', [WorkspaceInvitationController::class, 'destroy'])->middleware('permission:workspace_invite_members')->name('invitations.destroy');
        Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
        Route::get('dashboard/redirect', [DashboardController::class, 'redirectToFirstAvailablePage'])->name('dashboard.redirect');

        Route::get('media-library', function () {
            return Inertia::render('media-library');
        })->name('media-library');

        Route::get('chatgpt', function () {
            return Inertia::render('examples/chatgpt-demo');
        })->name('chatgpt');

        // Mzitshwa AI routes
        Route::post('api/mzitshwa/chat',     [\App\Http\Controllers\MzitshwaController::class, 'chat'])->name('mzitshwa.chat');
        Route::post('api/mzitshwa/complete', [\App\Http\Controllers\MzitshwaController::class, 'complete'])->name('mzitshwa.complete');
        Route::post('api/mzitshwa/analyze',  [\App\Http\Controllers\MzitshwaController::class, 'analyze'])->name('mzitshwa.analyze');

        // Media Library API routes
        Route::get('api/media', [MediaController::class, 'index'])->middleware('permission:media_view_any')->name('api.media.index');
        Route::post('api/media/batch', [MediaController::class, 'batchStore'])->middleware('permission:media_upload')->name('api.media.batch');
        Route::get('api/media/{id}/download', [MediaController::class, 'download'])->middleware('permission:media_download')->name('api.media.download');
        Route::delete('api/media/{id}', [MediaController::class, 'destroy'])->middleware('permission:media_delete')->name('api.media.destroy');
        Route::post('api/media/{id}/lock', [MediaController::class, 'toggleLock'])->middleware('permission:media_upload')->name('api.media.toggleLock');
        Route::get('api/media/{id}/accesses', [MediaController::class, 'accesses'])->middleware('permission:media_upload')->name('api.media.accesses');
        Route::post('api/media/{id}/access', [MediaController::class, 'storeAccess'])->middleware('permission:media_upload')->name('api.media.storeAccess');
        Route::delete('api/media/{id}/access', [MediaController::class, 'destroyAccess'])->middleware('permission:media_upload')->name('api.media.destroyAccess');
        Route::put('api/media/{id}/move', [MediaController::class, 'moveTo'])->middleware('permission:media_upload')->name('api.media.moveTo');

        // Media Folders API routes
        Route::get('api/media/folders', [MediaFolderController::class, 'index'])->middleware('permission:media_view_any')->name('api.media.folders.index');
        Route::post('api/media/folders', [MediaFolderController::class, 'store'])->middleware('permission:media_upload')->name('api.media.folders.store');
        Route::put('api/media/folders/{id}', [MediaFolderController::class, 'update'])->middleware('permission:media_upload')->name('api.media.folders.update');
        Route::delete('api/media/folders/{id}', [MediaFolderController::class, 'destroy'])->middleware('permission:media_upload')->name('api.media.folders.destroy');
        Route::post('api/media/folders/{id}/lock', [MediaFolderController::class, 'toggleLock'])->middleware('permission:media_upload')->name('api.media.folders.toggleLock');
        Route::get('api/media/folders/{id}/accesses', [MediaFolderController::class, 'accesses'])->middleware('permission:media_upload')->name('api.media.folders.accesses');
        Route::post('api/media/folders/{id}/access', [MediaFolderController::class, 'storeAccess'])->middleware('permission:media_upload')->name('api.media.folders.storeAccess');
        Route::delete('api/media/folders/{id}/access', [MediaFolderController::class, 'destroyAccess'])->middleware('permission:media_upload')->name('api.media.folders.destroyAccess');

        // Bug API routes
        Route::get('api/bugs/project-data', [\App\Http\Controllers\BugController::class, 'getProjectData'])->middleware('permission:bug_view_any')->name('api.bugs.project-data');

        // Roles routes
        Route::get('roles', [RoleController::class, 'index'])->middleware('permission:role_view_any')->name('roles.index');
        Route::post('roles', [RoleController::class, 'store'])->middleware('permission:role_create')->name('roles.store');
        Route::put('roles/{role}', [RoleController::class, 'update'])->middleware('permission:role_update')->name('roles.update');
        Route::delete('roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:role_delete')->name('roles.destroy');

        // Permissions routes with granular permissions
        Route::get('permissions', [PermissionController::class, 'index'])->middleware('permission:permission_view_any')->name('permissions.index');
        Route::post('permissions/assign', [PermissionController::class, 'assign'])->middleware('permission:permission_assign')->name('permissions.assign');
        Route::post('permissions/manage', [PermissionController::class, 'manage'])->middleware('permission:permission_manage')->name('permissions.manage');


        // SaaS-only admin routes
        Route::middleware('saas.only')->group(function () {
            // Plans management routes (admin only)
            Route::get('plans/create', [PlanController::class, 'create'])->middleware('permission:plan_create')->name('plans.create');
            Route::post('plans', [PlanController::class, 'store'])->middleware('permission:plan_create')->name('plans.store');
            Route::get('plans/{plan}/edit', [PlanController::class, 'edit'])->middleware('permission:plan_update')->name('plans.edit');
            Route::put('plans/{plan}', [PlanController::class, 'update'])->middleware('permission:plan_update')->name('plans.update');
            Route::delete('plans/{plan}', [PlanController::class, 'destroy'])->middleware('permission:plan_delete')->name('plans.destroy');
            Route::post('plans/{plan}/toggle-status', [PlanController::class, 'toggleStatus'])->middleware('permission:plan_update')->name('plans.toggle-status');

            // Plan Orders routes
            Route::get('plan-orders', [PlanOrderController::class, 'index'])->middleware('permission:plan_manage_orders')->name('plan-orders.index');
            Route::post('plan-orders/{planOrder}/approve', [PlanOrderController::class, 'approve'])->middleware('permission:plan_approve_orders')->name('plan-orders.approve');
            Route::post('plan-orders/{planOrder}/reject', [PlanOrderController::class, 'reject'])->middleware('permission:plan_reject_orders')->name('plan-orders.reject');

            // Plan Requests routes
            Route::get('plan-requests', [PlanRequestController::class, 'index'])->middleware('permission:plan_manage_requests')->name('plan-requests.index');
            Route::post('plan-requests/{planRequest}/approve', [PlanRequestController::class, 'approve'])->middleware('permission:plan_manage_requests')->name('plan-requests.approve');
            Route::post('plan-requests/{planRequest}/reject', [PlanRequestController::class, 'reject'])->middleware('permission:plan_manage_requests')->name('plan-requests.reject');
            Route::delete('plan-requests/{planRequest}', [PlanRequestController::class, 'destroy'])->middleware('permission:plan_manage_requests')->name('plan-requests.destroy');

            // Coupons routes
            Route::get('coupons', [CouponController::class, 'index'])->middleware('permission:coupon_view_any')->name('coupons.index');
            Route::get('coupons/{coupon}', [CouponController::class, 'show'])->middleware('permission:coupon_view')->name('coupons.show');
            Route::post('coupons', [CouponController::class, 'store'])->middleware('permission:coupon_create')->name('coupons.store');
            Route::put('coupons/{coupon}', [CouponController::class, 'update'])->middleware('permission:coupon_update')->name('coupons.update');
            Route::put('coupons/{coupon}/toggle-status', [CouponController::class, 'toggleStatus'])->middleware('permission:coupon_toggle_status')->name('coupons.toggle-status');
            Route::delete('coupons/{coupon}', [CouponController::class, 'destroy'])->middleware('permission:coupon_delete')->name('coupons.destroy');

            // Companies routes
            Route::get('companies', [CompanyController::class, 'index'])->middleware('permission:company_view_any')->name('companies.index');
            Route::post('companies', [CompanyController::class, 'store'])->middleware('permission:company_create')->name('companies.store');
            Route::put('companies/{company}', [CompanyController::class, 'update'])->middleware('permission:company_update')->name('companies.update');
            Route::delete('companies/{company}', [CompanyController::class, 'destroy'])->middleware('permission:company_delete')->name('companies.destroy');
            Route::put('companies/{company}/reset-password', [CompanyController::class, 'resetPassword'])->middleware('permission:company_reset_password')->name('companies.reset-password');
            Route::put('companies/{company}/toggle-status', [CompanyController::class, 'toggleStatus'])->middleware('permission:company_toggle_status')->name('companies.toggle-status');
            Route::get('companies/{company}/plans', [CompanyController::class, 'getPlans'])->middleware('permission:company_manage_plans')->name('companies.plans');
            Route::put('companies/{company}/upgrade-plan', [CompanyController::class, 'upgradePlan'])->middleware('permission:company_upgrade_plan')->name('companies.upgrade-plan');

            // Companies import/export routes
            Route::get('/companies/export', [App\Http\Controllers\ExportImportController::class, 'export'])
                ->name('companies.export')
                ->middleware('permission:company_view_any');
            Route::post('/companies/import', [App\Http\Controllers\ExportImportController::class, 'import'])
                ->name('companies.import')
                ->middleware('permission:company_create');
            Route::get('/companies/template', [App\Http\Controllers\ExportImportController::class, 'getTemplate'])
                ->name('companies.template')
                ->middleware('permission:company_view_any');
            Route::post('/companies/import/data', [App\Http\Controllers\ExportImportController::class, 'importData'])
                ->name('companies.import.data')
                ->middleware('permission:company_create');
        });

        // Projects export/import routes
        Route::get('/projects/export', [App\Http\Controllers\ExportImportController::class, 'export'])
            ->name('projects.export')
            ->middleware('permission:project_view_any');
        Route::post('/projects/import', [App\Http\Controllers\ExportImportController::class, 'import'])
            ->name('projects.import')
            ->middleware('permission:project_create');
        Route::get('/projects/template', [App\Http\Controllers\ExportImportController::class, 'getTemplate'])
            ->name('projects.template')
            ->middleware('permission:project_view_any');
        Route::post('/projects/import/data', [App\Http\Controllers\ExportImportController::class, 'importData'])
            ->name('projects.import.data')
            ->middleware('permission:project_create');

        // Invoices export/import routes
        Route::get('/invoices/export', [App\Http\Controllers\ExportImportController::class, 'export'])
            ->name('invoices.export')
            ->middleware('permission:invoice_view_any');
        Route::post('/invoices/import', [App\Http\Controllers\ExportImportController::class, 'import'])
            ->name('invoices.import')
            ->middleware('permission:invoice_create');
        Route::get('/invoices/template', [App\Http\Controllers\ExportImportController::class, 'getTemplate'])
            ->name('invoices.template')
            ->middleware('permission:invoice_view_any');
        Route::post('/invoices/import/data', [App\Http\Controllers\ExportImportController::class, 'importData'])
            ->name('invoices.import.data')
            ->middleware('permission:invoice_create');

        // Two-step import routes (for React frontend)
        Route::post('/csv/import', [App\Http\Controllers\ExportImportController::class, 'fileImport'])
            ->name('csv.import');
        Route::get('/import/csv/modal/', [App\Http\Controllers\ExportImportController::class, 'fileImportModal'])
            ->name('csv.import.modal');

        // Newsletter routes
        Route::get('newsletters', [\App\Http\Controllers\NewsletterController::class, 'index'])->middleware('permission:newsletter_view_any')->name('newsletters.index');
        Route::post('newsletters', [\App\Http\Controllers\NewsletterController::class, 'store'])->middleware('permission:newsletter_create')->name('newsletters.store');
        Route::put('newsletters/{newsletter}', [\App\Http\Controllers\NewsletterController::class, 'update'])->middleware('permission:newsletter_update')->name('newsletters.update');
        Route::delete('newsletters/{newsletter}', [\App\Http\Controllers\NewsletterController::class, 'destroy'])->middleware('permission:newsletter_delete')->name('newsletters.destroy');
        Route::put('newsletters/{newsletter}/toggle-status', [\App\Http\Controllers\NewsletterController::class, 'toggleStatus'])->middleware('permission:newsletter_toggle_status')->name('newsletters.toggle-status');
        Route::delete('newsletters/bulk-delete', [\App\Http\Controllers\NewsletterController::class, 'bulkDelete'])->middleware('permission:newsletter_bulk_operations')->name('newsletters.bulk-delete');
        Route::get('newsletters/export', [\App\Http\Controllers\NewsletterController::class, 'export'])->middleware('permission:newsletter_export')->name('newsletters.export');

        // Contact routes
        Route::get('contacts', [\App\Http\Controllers\ContactController::class, 'index'])->middleware('permission:contact_view_any')->name('contacts.index');
        Route::post('contacts', [\App\Http\Controllers\ContactController::class, 'store'])->middleware('permission:contact_create')->name('contacts.store');
        Route::put('contacts/{contact}', [\App\Http\Controllers\ContactController::class, 'update'])->middleware('permission:contact_update')->name('contacts.update');
        Route::delete('contacts/{contact}', [\App\Http\Controllers\ContactController::class, 'destroy'])->middleware('permission:contact_delete')->name('contacts.destroy');
        Route::delete('contacts/bulk-delete', [\App\Http\Controllers\ContactController::class, 'bulkDelete'])->middleware('permission:contact_bulk_operations')->name('contacts.bulk-delete');
        Route::get('contacts/export', [\App\Http\Controllers\ContactController::class, 'export'])->middleware('permission:contact_export')->name('contacts.export');


        // Referral routes
        Route::middleware('permission:referral_view_any')->group(function () {
            Route::get('referral', [ReferralController::class, 'index'])->middleware('permission:referral_view_any')->name('referral.index');
            Route::get('referral/referred-users', [ReferralController::class, 'getReferredUsers'])->middleware('permission:referral_view_any')->name('referral.referred-users');
            Route::post('referral/settings', [ReferralController::class, 'updateSettings'])->middleware('permission:referral_manage')->name('referral.settings.update');
            Route::post('referral/payout-request', [ReferralController::class, 'createPayoutRequest'])->middleware('permission:referral_payout')->name('referral.payout-request.create');
            Route::post('referral/payout-request/{payoutRequest}/approve', [ReferralController::class, 'approvePayoutRequest'])->middleware('permission:referral_approve_payout')->name('referral.payout-request.approve');
            Route::post('referral/payout-request/{payoutRequest}/reject', [ReferralController::class, 'rejectPayoutRequest'])->middleware('permission:referral_reject_payout')->name('referral.payout-request.reject');
        });



        // Currencies routes
        Route::get('currencies', [CurrencyController::class, 'index'])->middleware('permission:currency_view_any')->name('currencies.index');
        Route::post('currencies', [CurrencyController::class, 'store'])->middleware('permission:currency_create')->name('currencies.store');
        Route::put('currencies/{currency}', [CurrencyController::class, 'update'])->middleware('permission:currency_update')->name('currencies.update');
        Route::delete('currencies/{currency}', [CurrencyController::class, 'destroy'])->middleware('permission:currency_delete')->name('currencies.destroy');

        // ChatGPT routes
        Route::post('api/chatgpt/generate', [\App\Http\Controllers\ChatGptController::class, 'generate'])->name('chatgpt.generate');

        // Language management
        Route::get('manage-language/{lang?}', [LanguageController::class, 'managePage'])->middleware('permission:language_manage')->name('manage-language');
        Route::get('language/load', [LanguageController::class, 'load'])->middleware('permission:language_view')->name('language.load');
        Route::match(['POST', 'PATCH'], 'language/save', [LanguageController::class, 'save'])->middleware('permission:language_update')->name('language.save');
        Route::post('/languages/create', [LanguageController::class, 'createLanguage'])->middleware('permission:language_create')->name('languages.create');
        Route::delete('/languages/{languageCode}', [LanguageController::class, 'deleteLanguage'])->middleware('permission:language_delete')->name('languages.delete');
        Route::patch('/languages/{languageCode}/toggle', [LanguageController::class, 'toggleLanguageStatus'])->middleware('permission:language_update')->name('languages.toggle');
        Route::post('user/update-layout-direction', [UserController::class, 'updateLayoutDirection'])->name('user.update-layout-direction.auth');
        Route::post('user/update-language', [UserController::class, 'updateLanguage'])->name('user.update-language.auth');

        // User logs
        Route::get('companies/all-logs', [UserController::class, 'allUserLogs'])->name('users.all-logs');
        Route::get('login-histories/{loginHistory}', [UserController::class, 'showLoginHistory'])->name('login-histories.show');
        Route::delete('users/login-histories/{id}', [UserController::class, 'destroyLoginHistory'])->name('users.destroyLoginHistory');

        // Landing Page content management
        Route::get('landing-page/settings', [LandingPageController::class, 'settings'])->middleware('permission:landing_page_manage')->name('landing-page.settings');
        Route::post('landing-page/settings', [LandingPageController::class, 'updateSettings'])->middleware('permission:landing_page_update')->name('landing-page.settings.update');

        Route::get('custom-pages', [CustomPageController::class, 'index'])->middleware('permission:custom_page_view_any')->name('landing-page.custom-pages.index');
        Route::get('custom-pages/create', [CustomPageController::class, 'create'])->middleware('permission:custom_page_create')->name('landing-page.custom-pages.create');
        Route::post('landing-page/custom-pages', [CustomPageController::class, 'store'])->middleware('permission:custom_page_create')->name('landing-page.custom-pages.store');
        Route::get('custom-pages/{customPage}/edit', [CustomPageController::class, 'edit'])->middleware('permission:custom_page_update')->name('landing-page.custom-pages.edit');
        Route::put('landing-page/custom-pages/{customPage}', [CustomPageController::class, 'update'])->middleware('permission:custom_page_update')->name('landing-page.custom-pages.update');
        Route::delete('landing-page/custom-pages/{customPage}', [CustomPageController::class, 'destroy'])->middleware('permission:custom_page_delete')->name('landing-page.custom-pages.destroy');

        // Project routes
        Route::get('projects', [\App\Http\Controllers\ProjectController::class, 'index'])->middleware('permission:project_view_any')->name('projects.index');
        Route::get('projects/create', [\App\Http\Controllers\ProjectController::class, 'create'])->middleware('permission:project_create')->name('projects.create');
        Route::post('projects', [\App\Http\Controllers\ProjectController::class, 'store'])->middleware('permission:project_create')->name('projects.store');
        Route::get('projects/{project}', [\App\Http\Controllers\ProjectController::class, 'show'])->middleware('permission:project_view')->name('projects.show');
        Route::get('projects/{project}/edit', [\App\Http\Controllers\ProjectController::class, 'edit'])->middleware('permission:project_update')->name('projects.edit');
        Route::put('projects/{project}', [\App\Http\Controllers\ProjectController::class, 'update'])->middleware('permission:project_update')->name('projects.update');
        Route::patch('projects/{project}', [\App\Http\Controllers\ProjectController::class, 'update'])->middleware('permission:project_update');
        Route::delete('projects/{project}', [\App\Http\Controllers\ProjectController::class, 'destroy'])->middleware('permission:project_delete')->name('projects.destroy');

        Route::post('projects/{project}/members', [\App\Http\Controllers\ProjectController::class, 'assignMember'])->middleware('permission:project_assign_members')->name('projects.assign-member');
        Route::delete('projects/{project}/members/{user}', [\App\Http\Controllers\ProjectController::class, 'removeMember'])->middleware('permission:project_assign_members')->name('projects.remove-member');
        Route::post('projects/{project}/clients', [\App\Http\Controllers\ProjectController::class, 'assignClient'])->middleware('permission:project_assign_clients')->name('projects.assign-client');
        Route::post('projects/{project}/assign-clients', [\App\Http\Controllers\ProjectController::class, 'assignClients'])->middleware('permission:project_assign_clients')->name('projects.assign-clients');
        Route::delete('projects/{project}/clients/{user}', [\App\Http\Controllers\ProjectController::class, 'removeClient'])->middleware('permission:project_assign_clients')->name('projects.remove-client');
        Route::post('projects/{project}/assign-members', [\App\Http\Controllers\ProjectController::class, 'assignMembers'])->middleware('permission:project_assign_members')->name('projects.assign-members');
        Route::post('projects/{project}/assign-managers', [\App\Http\Controllers\ProjectController::class, 'assignManagers'])->middleware('permission:project_assign_members')->name('projects.assign-managers');
        Route::put('projects/{project}/progress', [\App\Http\Controllers\ProjectController::class, 'updateProgress'])->middleware('permission:project_track_progress')->name('projects.update-progress');
        Route::post('projects/{project}/recalculate-progress', [\App\Http\Controllers\ProjectController::class, 'recalculateProgress'])->middleware('permission:project_track_progress')->name('projects.recalculate-progress');
        Route::post('projects/{project}/budget', [\App\Http\Controllers\ProjectController::class, 'createBudget'])->middleware('permission:project_manage_budget')->name('projects.create-budget');
        Route::put('projects/{project}/shared-settings', [\App\Http\Controllers\ProjectController::class, 'updateSharedSettings'])->middleware('permission:project_manage_shared_settings')->name('projects.update-shared-settings');
        Route::post('projects/{project}/generate-share-link', [\App\Http\Controllers\ProjectController::class, 'generateShareLink'])->middleware('permission:project_manage_shared_settings')->name('projects.generate-share-link');


        // Gantt Chart Routes
        Route::get('projects/{project}/gantt/{duration?}', [\App\Http\Controllers\ProjectController::class, 'gantt'])
            ->name('projects.gantt')
            ->where('duration', 'Quarter Day|Half Day|Day|Week|Month');
        Route::post('projects/{project}/gantt/update', [\App\Http\Controllers\ProjectController::class, 'ganttUpdate'])
            ->name('projects.gantt.update');


        // Project milestones
        Route::post('projects/{project}/milestones', [\App\Http\Controllers\ProjectMilestoneController::class, 'store'])->middleware('permission:project_manage_milestones')->name('project-milestones.store');
        Route::put('projects/{project}/milestones/{milestone}', [\App\Http\Controllers\ProjectMilestoneController::class, 'update'])->middleware('permission:project_manage_milestones')->name('project-milestones.update');
        Route::delete('projects/{project}/milestones/{milestone}', [\App\Http\Controllers\ProjectMilestoneController::class, 'destroy'])->middleware('permission:project_manage_milestones')->name('project-milestones.destroy');
        Route::put('projects/{project}/milestones/{milestone}/status', [\App\Http\Controllers\ProjectMilestoneController::class, 'updateStatus'])->middleware('permission:project_manage_milestones')->name('project-milestones.update-status');
        Route::post('projects/{project}/milestones/reorder', [\App\Http\Controllers\ProjectMilestoneController::class, 'reorder'])->middleware('permission:project_manage_milestones')->name('project-milestones.reorder');

        // Project notes
        Route::post('projects/{project}/notes', [\App\Http\Controllers\ProjectNoteController::class, 'store'])->middleware('permission:project_manage_notes')->name('project-notes.store');
        Route::put('projects/{project}/notes/{note}', [\App\Http\Controllers\ProjectNoteController::class, 'update'])->middleware('permission:project_manage_notes')->name('project-notes.update');
        Route::delete('projects/{project}/notes/{note}', [\App\Http\Controllers\ProjectNoteController::class, 'destroy'])->middleware('permission:project_manage_notes')->name('project-notes.destroy');
        Route::put('projects/{project}/notes/{note}/pin', [\App\Http\Controllers\ProjectNoteController::class, 'togglePin'])->middleware('permission:project_manage_notes')->name('project-notes.toggle-pin');

        // Project invitations
        Route::post('projects/{project}/invite-client', [\App\Http\Controllers\ProjectInvitationController::class, 'inviteClient'])->middleware('permission:project_assign_clients')->name('projects.invite-client');
        Route::post('projects/{project}/invite-member', [\App\Http\Controllers\ProjectInvitationController::class, 'inviteMember'])->middleware('permission:project_assign_members')->name('projects.invite-member');

        // Project attachments
        Route::post('projects/{project}/attachments', [\App\Http\Controllers\ProjectAttachmentController::class, 'store'])->middleware('permission:project_manage_attachments')->name('project-attachments.store');
        Route::delete('project-attachments/{projectAttachment}', [\App\Http\Controllers\ProjectAttachmentController::class, 'destroy'])->middleware('permission:project_manage_attachments')->name('project-attachments.destroy');
        Route::get('project-attachments/{projectAttachment}/download', [\App\Http\Controllers\ProjectAttachmentController::class, 'download'])->middleware('permission:project_manage_attachments')->name('project-attachments.download');

        // Task routes
        Route::get('tasks', [\App\Http\Controllers\TaskController::class, 'index'])->middleware('permission:task_view_any')->name('tasks.index');
        Route::get('tasks/create', [\App\Http\Controllers\TaskController::class, 'create'])->middleware('permission:task_create')->name('tasks.create');
        Route::post('tasks', [\App\Http\Controllers\TaskController::class, 'store'])->middleware('permission:task_create')->name('tasks.store');
        Route::get('tasks/{task}', [\App\Http\Controllers\TaskController::class, 'show'])->middleware('permission:task_view')->name('tasks.show');
        Route::get('tasks/{task}/edit', [\App\Http\Controllers\TaskController::class, 'edit'])->middleware('permission:task_update')->name('tasks.edit');
        Route::put('tasks/{task}', [\App\Http\Controllers\TaskController::class, 'update'])->middleware('permission:task_update')->name('tasks.update');
        Route::patch('tasks/{task}', [\App\Http\Controllers\TaskController::class, 'update'])->middleware('permission:task_update');
        Route::delete('tasks/{task}', [\App\Http\Controllers\TaskController::class, 'destroy'])->middleware('permission:task_delete')->name('tasks.destroy');

        Route::post('tasks/{task}/duplicate', [\App\Http\Controllers\TaskController::class, 'duplicate'])->middleware('permission:task_duplicate')->name('tasks.duplicate');
        Route::put('tasks/{task}/stage', [\App\Http\Controllers\TaskController::class, 'changeStage'])->middleware('permission:task_change_status')->name('tasks.change-stage');
        Route::get('api/tasks/calendar', [\App\Http\Controllers\TaskController::class, 'getCalendarTasks'])->middleware('permission:task_view_any')->name('api.tasks.calendar');

        // Task stages
        Route::get('task-stages', [\App\Http\Controllers\TaskStageController::class, 'index'])->middleware('permission:task_manage_stages')->name('task-stages.index');
        Route::post('task-stages', [\App\Http\Controllers\TaskStageController::class, 'store'])->middleware('permission:task_manage_stages')->name('task-stages.store');
        Route::put('task-stages/reorder', [\App\Http\Controllers\TaskStageController::class, 'reorder'])->middleware('permission:task_manage_stages')->name('task-stages.reorder');
        Route::put('task-stages/{taskStage}', [\App\Http\Controllers\TaskStageController::class, 'update'])->middleware('permission:task_manage_stages')->name('task-stages.update');
        Route::patch('task-stages/{taskStage}', [\App\Http\Controllers\TaskStageController::class, 'update'])->middleware('permission:task_manage_stages');
        Route::delete('task-stages/{taskStage}', [\App\Http\Controllers\TaskStageController::class, 'destroy'])->middleware('permission:task_manage_stages')->name('task-stages.destroy');
        Route::put('task-stages/{taskStage}/set-default', [\App\Http\Controllers\TaskStageController::class, 'setDefault'])->middleware('permission:task_manage_stages')->name('task-stages.set-default');

        // Task comments
        Route::post('tasks/{task}/comments', [\App\Http\Controllers\TaskCommentController::class, 'store'])->middleware('permission:task_add_comments')->name('task-comments.store');
        Route::put('task-comments/{taskComment}', [\App\Http\Controllers\TaskCommentController::class, 'update'])->middleware('permission:task_add_comments')->name('task-comments.update');
        Route::delete('task-comments/{taskComment}', [\App\Http\Controllers\TaskCommentController::class, 'destroy'])->middleware('permission:task_add_comments')->name('task-comments.destroy');

        // Task checklists
        Route::post('tasks/{task}/checklists', [\App\Http\Controllers\TaskChecklistController::class, 'store'])->middleware('permission:task_manage_checklists')->name('task-checklists.store');
        Route::put('task-checklists/{taskChecklist}', [\App\Http\Controllers\TaskChecklistController::class, 'update'])->middleware('permission:task_manage_checklists')->name('task-checklists.update');
        Route::delete('task-checklists/{taskChecklist}', [\App\Http\Controllers\TaskChecklistController::class, 'destroy'])->middleware('permission:task_manage_checklists')->name('task-checklists.destroy');
        Route::post('task-checklists/{taskChecklist}/toggle', [\App\Http\Controllers\TaskChecklistController::class, 'toggle'])->middleware('permission:task_manage_checklists')->name('task-checklists.toggle');

        // Task attachments
        Route::post('tasks/{task}/attachments', [\App\Http\Controllers\TaskAttachmentController::class, 'store'])->middleware('permission:task_add_attachments')->name('task-attachments.store');
        Route::delete('task-attachments/{taskAttachment}', [\App\Http\Controllers\TaskAttachmentController::class, 'destroy'])->middleware('permission:task_add_attachments')->name('task-attachments.destroy');
        Route::get('task-attachments/{taskAttachment}/download', [\App\Http\Controllers\TaskAttachmentController::class, 'download'])->middleware('permission:task_add_attachments')->name('task-attachments.download');

        // ICT Ticketing System routes
        Route::get('ict-tickets', [\App\Http\Controllers\IctTicketController::class, 'index'])->name('ict-tickets.index');
        Route::post('ict-tickets', [\App\Http\Controllers\IctTicketController::class, 'store'])->name('ict-tickets.store');
        Route::get('ict-tickets/{ictTicket}', [\App\Http\Controllers\IctTicketController::class, 'show'])->name('ict-tickets.show');
        Route::put('ict-tickets/{ictTicket}', [\App\Http\Controllers\IctTicketController::class, 'update'])->name('ict-tickets.update');
        Route::delete('ict-tickets/{ictTicket}', [\App\Http\Controllers\IctTicketController::class, 'destroy'])->name('ict-tickets.destroy');
        Route::put('ict-tickets/{ictTicket}/status', [\App\Http\Controllers\IctTicketController::class, 'changeStatus'])->name('ict-tickets.change-status');
        Route::put('ict-tickets/{ictTicket}/assign', [\App\Http\Controllers\IctTicketController::class, 'assign'])->name('ict-tickets.assign');
        Route::post('ict-tickets/{ictTicket}/comments', [\App\Http\Controllers\IctTicketController::class, 'storeComment'])->name('ict-ticket-comments.store');
        Route::delete('ict-ticket-comments/{comment}', [\App\Http\Controllers\IctTicketController::class, 'destroyComment'])->name('ict-ticket-comments.destroy');
        Route::post('ict-tickets/{ictTicket}/attachments', [\App\Http\Controllers\IctTicketController::class, 'storeAttachment'])->name('ict-ticket-attachments.store');
        Route::get('ict-ticket-attachments/{attachment}/download', [\App\Http\Controllers\IctTicketController::class, 'downloadAttachment'])->name('ict-ticket-attachments.download');
        Route::delete('ict-ticket-attachments/{attachment}', [\App\Http\Controllers\IctTicketController::class, 'destroyAttachment'])->name('ict-ticket-attachments.destroy');

        // Bug routes (kept for data integrity — hidden from UI)
        Route::get('bugs', [\App\Http\Controllers\BugController::class, 'index'])->middleware('permission:bug_view_any')->name('bugs.index');
        Route::get('bugs/create', [\App\Http\Controllers\BugController::class, 'create'])->middleware('permission:bug_create')->name('bugs.create');
        Route::post('bugs', [\App\Http\Controllers\BugController::class, 'store'])->middleware('permission:bug_create')->name('bugs.store');
        Route::get('bugs/{bug}', [\App\Http\Controllers\BugController::class, 'show'])->middleware('permission:bug_view')->name('bugs.show');
        Route::get('bugs/{bug}/edit', [\App\Http\Controllers\BugController::class, 'edit'])->middleware('permission:bug_update')->name('bugs.edit');
        Route::put('bugs/{bug}', [\App\Http\Controllers\BugController::class, 'update'])->middleware('permission:bug_update')->name('bugs.update');
        Route::patch('bugs/{bug}', [\App\Http\Controllers\BugController::class, 'update'])->middleware('permission:bug_update');
        Route::delete('bugs/{bug}', [\App\Http\Controllers\BugController::class, 'destroy'])->middleware('permission:bug_delete')->name('bugs.destroy');

        Route::put('bugs/{bug}/status', [\App\Http\Controllers\BugController::class, 'changeStatus'])->middleware('permission:bug_change_status')->name('bugs.change-status');

        // Bug statuses
        Route::get('bug-statuses', [\App\Http\Controllers\BugStatusController::class, 'index'])->middleware('permission:bug_manage_statuses')->name('bug-statuses.index');
        Route::post('bug-statuses', [\App\Http\Controllers\BugStatusController::class, 'store'])->middleware('permission:bug_manage_statuses')->name('bug-statuses.store');
        Route::put('bug-statuses/{bugStatus}', [\App\Http\Controllers\BugStatusController::class, 'update'])->middleware('permission:bug_manage_statuses')->name('bug-statuses.update');
        Route::patch('bug-statuses/{bugStatus}', [\App\Http\Controllers\BugStatusController::class, 'update'])->middleware('permission:bug_manage_statuses');
        Route::delete('bug-statuses/{bugStatus}', [\App\Http\Controllers\BugStatusController::class, 'destroy'])->middleware('permission:bug_manage_statuses')->name('bug-statuses.destroy');
        Route::put('bug-statuses/reorder', [\App\Http\Controllers\BugStatusController::class, 'reorder'])->middleware('permission:bug_manage_statuses')->name('bug-statuses.reorder');
        Route::put('bug-statuses/{bugStatus}/set-default', [\App\Http\Controllers\BugStatusController::class, 'setDefault'])->middleware('permission:bug_manage_statuses')->name('bug-statuses.set-default');

        // Bug comments
        Route::post('bugs/{bug}/comments', [\App\Http\Controllers\BugCommentController::class, 'store'])->middleware('permission:bug_add_comments')->name('bug-comments.store');
        Route::put('bug-comments/{bugComment}', [\App\Http\Controllers\BugCommentController::class, 'update'])->middleware('permission:bug_add_comments')->name('bug-comments.update');
        Route::delete('bug-comments/{bugComment}', [\App\Http\Controllers\BugCommentController::class, 'destroy'])->middleware('permission:bug_add_comments')->name('bug-comments.destroy');

        // Bug attachments
        Route::post('bugs/{bug}/attachments', [\App\Http\Controllers\BugAttachmentController::class, 'store'])->middleware('permission:bug_add_attachments')->name('bug-attachments.store');
        Route::delete('bug-attachments/{bugAttachment}', [\App\Http\Controllers\BugAttachmentController::class, 'destroy'])->middleware('permission:bug_add_attachments')->name('bug-attachments.destroy');
        Route::get('bug-attachments/{bugAttachment}/download', [\App\Http\Controllers\BugAttachmentController::class, 'download'])->middleware('permission:bug_add_attachments')->name('bug-attachments.download');

        // Timesheet routes
        Route::get('timesheets-daily-view', [\App\Http\Controllers\TimesheetController::class, 'dailyView'])->middleware('permission:timesheet_view_any')->name('timesheets.daily-view');
        Route::get('timesheets-weekly-view', [\App\Http\Controllers\TimesheetController::class, 'weeklyView'])->middleware('permission:timesheet_view_any')->name('timesheets.weekly-view');
        Route::get('timesheets-monthly-view', [\App\Http\Controllers\TimesheetController::class, 'monthlyView'])->middleware('permission:timesheet_view_any')->name('timesheets.monthly-view');
        Route::get('timesheets-calendar-view', [\App\Http\Controllers\TimesheetController::class, 'calendarView'])->middleware('permission:timesheet_view_any')->name('timesheets.calendar-view');
        Route::get('timesheets-approvals', [\App\Http\Controllers\TimesheetController::class, 'approvals'])->middleware('permission:timesheet_approve')->name('timesheets.approvals');
        Route::get('timesheets-reports', [\App\Http\Controllers\TimesheetController::class, 'reports'])->middleware('permission:report_timesheet')->name('timesheets.reports');

        Route::get('timesheets', [\App\Http\Controllers\TimesheetController::class, 'index'])->middleware('permission:timesheet_view_any')->name('timesheets.index');
        Route::get('timesheets/create', [\App\Http\Controllers\TimesheetController::class, 'create'])->middleware('permission:timesheet_create')->name('timesheets.create');
        Route::post('timesheets', [\App\Http\Controllers\TimesheetController::class, 'store'])->middleware('permission:timesheet_create')->name('timesheets.store');
        Route::get('timesheets/{timesheet}', [\App\Http\Controllers\TimesheetController::class, 'show'])->middleware('permission:timesheet_view')->name('timesheets.show');
        Route::get('timesheets/{timesheet}/edit', [\App\Http\Controllers\TimesheetController::class, 'edit'])->middleware('permission:timesheet_update')->name('timesheets.edit');
        Route::put('timesheets/{timesheet}', [\App\Http\Controllers\TimesheetController::class, 'update'])->middleware('permission:timesheet_update')->name('timesheets.update');
        Route::patch('timesheets/{timesheet}', [\App\Http\Controllers\TimesheetController::class, 'update'])->middleware('permission:timesheet_update');
        Route::delete('timesheets/{timesheet}', [\App\Http\Controllers\TimesheetController::class, 'destroy'])->middleware('permission:timesheet_delete')->name('timesheets.destroy');

        Route::put('timesheets/{timesheet}/submit', [\App\Http\Controllers\TimesheetController::class, 'submit'])->middleware('permission:timesheet_submit')->name('timesheets.submit');
        Route::post('timesheets/{timesheet}/approve', [\App\Http\Controllers\TimesheetController::class, 'approve'])->middleware('permission:timesheet_approve')->name('timesheets.approve');
        Route::post('timesheets/{timesheet}/reject', [\App\Http\Controllers\TimesheetController::class, 'reject'])->middleware('permission:timesheet_approve')->name('timesheets.reject');

        // Timesheet entries
        Route::get('timesheet-entries', [\App\Http\Controllers\TimesheetEntryController::class, 'index'])->middleware('permission:timesheet_view_any')->name('timesheet-entries.index');
        Route::post('timesheet-entries', [\App\Http\Controllers\TimesheetEntryController::class, 'store'])->middleware('permission:timesheet_create')->name('timesheet-entries.store');
        Route::put('timesheet-entries/{timesheetEntry}', [\App\Http\Controllers\TimesheetEntryController::class, 'update'])->middleware('permission:timesheet_update')->name('timesheet-entries.update');
        Route::patch('timesheet-entries/{timesheetEntry}', [\App\Http\Controllers\TimesheetEntryController::class, 'update'])->middleware('permission:timesheet_update');
        Route::delete('timesheet-entries/{timesheetEntry}', [\App\Http\Controllers\TimesheetEntryController::class, 'destroy'])->middleware('permission:timesheet_delete')->name('timesheet-entries.destroy');
        Route::post('timesheet-entries/bulk-update', [\App\Http\Controllers\TimesheetEntryController::class, 'bulkUpdate'])->middleware('permission:timesheet_bulk_operations')->name('timesheet-entries.bulk-update');
        Route::delete('timesheet-entries/bulk-delete', [\App\Http\Controllers\TimesheetEntryController::class, 'bulkDelete'])->middleware('permission:timesheet_bulk_operations')->name('timesheet-entries.bulk-delete');

        // Timer functionality
        Route::post('timer/start', [\App\Http\Controllers\TimerController::class, 'start'])->middleware('permission:timesheet_use_timer')->name('timer.start');
        Route::post('timer/stop', [\App\Http\Controllers\TimerController::class, 'stop'])->middleware('permission:timesheet_use_timer')->name('timer.stop');
        Route::post('timer/pause', [\App\Http\Controllers\TimerController::class, 'pause'])->middleware('permission:timesheet_use_timer')->name('timer.pause');
        Route::post('timer/resume', [\App\Http\Controllers\TimerController::class, 'resume'])->middleware('permission:timesheet_use_timer')->name('timer.resume');
        Route::get('timer/status', [\App\Http\Controllers\TimerController::class, 'status'])->middleware('permission:timesheet_use_timer')->name('timer.status');

        // Timesheet approvals
        Route::get('timesheet-approvals', [\App\Http\Controllers\TimesheetApprovalController::class, 'index'])->middleware('permission:timesheet_approve')->name('timesheet-approvals.index');
        Route::get('timesheet-approvals/{approval}', [\App\Http\Controllers\TimesheetApprovalController::class, 'show'])->middleware('permission:timesheet_approve')->name('timesheet-approvals.show');
        Route::post('timesheet-approvals/{approval}/approve', [\App\Http\Controllers\TimesheetApprovalController::class, 'approve'])->middleware('permission:timesheet_approve')->name('timesheet-approvals.approve');
        Route::post('timesheet-approvals/{approval}/reject', [\App\Http\Controllers\TimesheetApprovalController::class, 'reject'])->middleware('permission:timesheet_approve')->name('timesheet-approvals.reject');
        Route::post('timesheet-approvals/bulk-approve', [\App\Http\Controllers\TimesheetApprovalController::class, 'bulkApprove'])->middleware('permission:timesheet_approve')->name('timesheet-approvals.bulk-approve');
        Route::post('timesheet-approvals/bulk-reject', [\App\Http\Controllers\TimesheetApprovalController::class, 'bulkReject'])->middleware('permission:timesheet_approve')->name('timesheet-approvals.bulk-reject');

        // Timesheet reports
        Route::get('timesheet-reports', [\App\Http\Controllers\TimesheetReportController::class, 'index'])->middleware('permission:report_timesheet')->name('timesheet-reports.index');
        Route::post('timesheet-reports/generate', [\App\Http\Controllers\TimesheetReportController::class, 'generate'])->middleware('permission:report_timesheet')->name('timesheet-reports.generate');
        Route::get('timesheet-reports/dashboard-widgets', [\App\Http\Controllers\TimesheetReportController::class, 'dashboardWidgets'])->middleware('permission:report_dashboard_widgets')->name('timesheet-reports.dashboard-widgets');

        // Customer reports
        Route::get('customer-reports', [\App\Http\Controllers\CustomerReportController::class, 'index'])->middleware('permission:report_customer')->name('customer-reports.index');
        Route::post('customer-reports/generate', [\App\Http\Controllers\CustomerReportController::class, 'generate'])->middleware('permission:report_customer')->name('customer-reports.generate');

        // Budget & Expense routes
        Route::get('budgets-dashboard', [\App\Http\Controllers\BudgetDashboardController::class, 'index'])->middleware('permission:budget_dashboard_view')->name('budgets.dashboard');
        Route::get('budgets', [\App\Http\Controllers\ProjectBudgetController::class, 'index'])->middleware('permission:budget_view_any')->name('budgets.index');
        Route::get('budgets/create', [\App\Http\Controllers\ProjectBudgetController::class, 'create'])->middleware('permission:budget_create')->name('budgets.create');
        Route::post('budgets', [\App\Http\Controllers\ProjectBudgetController::class, 'store'])->middleware('permission:budget_create')->name('budgets.store');
        Route::get('budgets/{budget}/edit', [\App\Http\Controllers\ProjectBudgetController::class, 'edit'])->middleware('permission:budget_update')->name('budgets.edit');
        Route::get('budgets/{budget}', [\App\Http\Controllers\ProjectBudgetController::class, 'show'])->middleware('permission:budget_view')->name('budgets.show');
        Route::put('budgets/{budget}', [\App\Http\Controllers\ProjectBudgetController::class, 'update'])->middleware('permission:budget_update')->name('budgets.update');
        Route::patch('budgets/{budget}', [\App\Http\Controllers\ProjectBudgetController::class, 'update'])->middleware('permission:budget_update');
        Route::delete('budgets/{budget}', [\App\Http\Controllers\ProjectBudgetController::class, 'destroy'])->middleware('permission:budget_delete')->name('budgets.destroy');
        Route::get('budgets/default-categories', [\App\Http\Controllers\ProjectBudgetController::class, 'getDefaultCategories'])->middleware('permission:budget_manage_categories')->name('budgets.default-categories');

        // Budget categories
        Route::get('budgets/{budget}/categories', [\App\Http\Controllers\BudgetCategoryController::class, 'index'])->middleware('permission:budget_manage_categories')->name('budget-categories.index');
        Route::post('budgets/{budget}/categories', [\App\Http\Controllers\BudgetCategoryController::class, 'store'])->middleware('permission:budget_manage_categories')->name('budget-categories.store');
        Route::put('budget-categories/{category}', [\App\Http\Controllers\BudgetCategoryController::class, 'update'])->middleware('permission:budget_manage_categories')->name('budget-categories.update');
        Route::delete('budget-categories/{category}', [\App\Http\Controllers\BudgetCategoryController::class, 'destroy'])->middleware('permission:budget_manage_categories')->name('budget-categories.destroy');
        Route::post('budgets/{budget}/categories/reorder', [\App\Http\Controllers\BudgetCategoryController::class, 'reorder'])->middleware('permission:budget_manage_categories')->name('budget-categories.reorder');

        // Budget revisions
        Route::post('budgets/{budget}/revisions', [\App\Http\Controllers\BudgetRevisionController::class, 'store'])->middleware('permission:budget_manage_workflows')->name('budget-revisions.store');
        Route::post('budget-revisions/{revision}/approve', [\App\Http\Controllers\BudgetRevisionController::class, 'approve'])->middleware('permission:budget_approve')->name('budget-revisions.approve');
        Route::post('budget-revisions/{revision}/reject', [\App\Http\Controllers\BudgetRevisionController::class, 'reject'])->middleware('permission:budget_approve')->name('budget-revisions.reject');

        // Expense routes
        Route::get('expenses', [\App\Http\Controllers\ProjectExpenseController::class, 'index'])->middleware('permission:expense_view_any')->name('expenses.index');
        Route::get('expenses/create', [\App\Http\Controllers\ProjectExpenseController::class, 'create'])->middleware('permission:expense_create')->name('expenses.create');
        Route::post('expenses', [\App\Http\Controllers\ProjectExpenseController::class, 'store'])->middleware('permission:expense_create')->name('expenses.store');
        Route::get('expenses/{expense}', [\App\Http\Controllers\ProjectExpenseController::class, 'show'])->middleware('permission:expense_view')->name('expenses.show');
        Route::get('expenses/{expense}/edit', [\App\Http\Controllers\ProjectExpenseController::class, 'edit'])->middleware('permission:expense_update')->name('expenses.edit');
        Route::put('expenses/{expense}', [\App\Http\Controllers\ProjectExpenseController::class, 'update'])->middleware('permission:expense_update')->name('expenses.update');
        Route::patch('expenses/{expense}', [\App\Http\Controllers\ProjectExpenseController::class, 'update'])->middleware('permission:expense_update');
        Route::delete('expenses/{expense}', [\App\Http\Controllers\ProjectExpenseController::class, 'destroy'])->middleware('permission:expense_delete')->name('expenses.destroy');

        Route::post('expenses/{expense}/duplicate', [\App\Http\Controllers\ProjectExpenseController::class, 'duplicate'])->middleware('permission:expense_create')->name('expenses.duplicate');
        Route::get('api/projects/{project}/tasks', [\App\Http\Controllers\ProjectExpenseController::class, 'getProjectTasks'])->middleware('permission:expense_view_any')->name('api.projects.tasks');

        // Expense approvals
        Route::get('expense-approvals', [\App\Http\Controllers\ExpenseApprovalController::class, 'index'])->middleware('permission:expense_approval_view_any')->name('expense-approvals.index');
        // Route::match(['GET', 'POST'], 'payments/toyyibpay/success', [ToyyibPayPaymentController::class, 'success'])->name('toyyibpay.success');
        Route::match(['PUT','POST'],'expenses/{expense}/approve', [\App\Http\Controllers\ExpenseApprovalController::class, 'approve'])->middleware('permission:expense_approval_approve')->name('expense-approvals.approve');
        // Route::post('expenses/{expense}/approve', [\App\Http\Controllers\ExpenseApprovalController::class, 'approve'])->middleware('permission:expense_approval_approve')->name('expense-approvals.approve');
        Route::match(['PUT','POST'],'expenses/{expense}/reject', [\App\Http\Controllers\ExpenseApprovalController::class, 'reject'])->middleware('permission:expense_approval_reject')->name('expense-approvals.reject');
        // Route::post('expenses/{expense}/reject', [\App\Http\Controllers\ExpenseApprovalController::class, 'reject'])->middleware('permission:expense_approval_reject')->name('expense-approvals.reject');
        Route::match(['PUT','POST'],'expenses/{expense}/request-info', [\App\Http\Controllers\ExpenseApprovalController::class, 'requestInfo'])->middleware('permission:expense_approval_request_info')->name('expense-approvals.request-info');
        // Route::post('expenses/{expense}/request-info', [\App\Http\Controllers\ExpenseApprovalController::class, 'requestInfo'])->middleware('permission:expense_approval_request_info')->name('expense-approvals.request-info');
        Route::post('expenses/bulk-approve', [\App\Http\Controllers\ExpenseApprovalController::class, 'bulkApprove'])->middleware('permission:expense_approval_bulk_approve')->name('expense-approvals.bulk-approve');
        Route::get('expenses/pending-approvals', [\App\Http\Controllers\ExpenseApprovalController::class, 'pendingApprovals'])->middleware('permission:expense_approval_view_any')->name('expense-approvals.pending');
        Route::get('expense-approvals/stats', [\App\Http\Controllers\ExpenseApprovalController::class, 'getApprovalStats'])->middleware('permission:expense_approval_view_stats')->name('expense-approvals.stats');
        Route::get('expense-approvals/budget-summary', [\App\Http\Controllers\ExpenseApprovalController::class, 'getBudgetSummary'])->middleware('permission:expense_approval_budget_summary')->name('expense-approvals.budget-summary');

        // Enhanced expense management
        Route::get('expenses/management', [\App\Http\Controllers\ExpenseManagementController::class, 'submittedExpenses'])->middleware('permission:expense_manage_workflows')->name('expenses.management');
        Route::post('expenses/{expense}/process-approval', [\App\Http\Controllers\ExpenseManagementController::class, 'processApproval'])->middleware('permission:expense_manage_workflows')->name('expenses.process-approval');
        Route::post('expenses/bulk-process', [\App\Http\Controllers\ExpenseManagementController::class, 'bulkProcess'])->middleware('permission:expense_manage_workflows')->name('expenses.bulk-process');
        Route::get('expenses/export', [\App\Http\Controllers\ExpenseManagementController::class, 'export'])->middleware('permission:expense_generate_reports')->name('expenses.export');

        // Expense dashboard analytics
        Route::get('api/expense-dashboard/overview', [\App\Http\Controllers\ExpenseDashboardController::class, 'overview'])->middleware('permission:expense_generate_reports')->name('expense-dashboard.overview');
        Route::get('api/expense-dashboard/budget-utilization', [\App\Http\Controllers\ExpenseDashboardController::class, 'budgetUtilization'])->middleware('permission:expense_generate_reports')->name('expense-dashboard.budget-utilization');
        Route::get('api/expense-dashboard/trends', [\App\Http\Controllers\ExpenseDashboardController::class, 'trends'])->middleware('permission:expense_generate_reports')->name('expense-dashboard.trends');
        Route::get('api/expense-dashboard/alerts', [\App\Http\Controllers\ExpenseDashboardController::class, 'alerts'])->middleware('permission:expense_generate_reports')->name('expense-dashboard.alerts');

        // Expense workflows
        Route::post('expense-workflows/{workflow}/process', [\App\Http\Controllers\ExpenseWorkflowController::class, 'processStep'])->middleware('permission:expense_manage_workflows')->name('expense-workflows.process');
        Route::post('expense-workflows/bulk-process', [\App\Http\Controllers\ExpenseWorkflowController::class, 'bulkProcess'])->middleware('permission:expense_manage_workflows')->name('expense-workflows.bulk-process');
        Route::get('my-approvals', function () {
            return \Inertia\Inertia::render('expenses/MyApprovals');
        })->middleware('permission:expense_approval_view_any')->name('expense-workflows.my-approvals');
        Route::get('api/my-approvals', [\App\Http\Controllers\ExpenseWorkflowController::class, 'myApprovals'])->middleware('permission:expense_approval_view_any')->name('api.expense-workflows.my-approvals');

        // Receipt management
        Route::post('expenses/{expense}/receipts', [\App\Http\Controllers\ExpenseReceiptController::class, 'upload'])->middleware('permission:expense_add_attachments')->name('expense-receipts.upload');
        Route::delete('expense-attachments/{attachment}', [\App\Http\Controllers\ExpenseReceiptController::class, 'destroy'])->middleware('permission:expense_add_attachments')->name('expense-receipts.destroy');
        Route::get('expense-attachments/{attachment}/download', [\App\Http\Controllers\ExpenseReceiptController::class, 'download'])->middleware('permission:expense_add_attachments')->name('expense-receipts.download');

        // Budget Reports & Dashboard
        Route::get('reports/budget-vs-actual', [\App\Http\Controllers\ExpenseReportController::class, 'budgetVsActual'])->middleware('permission:report_budget_vs_actual')->name('reports.budget-vs-actual');
        Route::get('reports/category-report', [\App\Http\Controllers\ExpenseReportController::class, 'categoryReport'])->middleware('permission:report_category')->name('reports.category');
        Route::get('reports/team-report', [\App\Http\Controllers\ExpenseReportController::class, 'teamReport'])->middleware('permission:report_team')->name('reports.team');
        Route::post('reports/export', [\App\Http\Controllers\ExpenseReportController::class, 'export'])->middleware('permission:report_export')->name('reports.export');

        Route::get('api/budget-dashboard/overview', [\App\Http\Controllers\BudgetDashboardController::class, 'overview'])->middleware('permission:budget_generate_reports')->name('budget-dashboard.overview');
        Route::get('budget-dashboard/alerts', [\App\Http\Controllers\BudgetDashboardController::class, 'alerts'])->middleware('permission:budget_manage_alerts')->name('budget-dashboard.alerts');
        Route::get('budget-dashboard/trends', [\App\Http\Controllers\BudgetDashboardController::class, 'trends'])->middleware('permission:budget_generate_reports')->name('budget-dashboard.trends');

        // Invoice routes
        Route::get('invoices', [InvoiceController::class, 'index'])->middleware('permission:invoice_view_any')->name('invoices.index');
        Route::get('invoices/create', [InvoiceController::class, 'create'])->middleware('permission:invoice_create')->name('invoices.create');
        Route::post('invoices', [InvoiceController::class, 'store'])->middleware('permission:invoice_create')->name('invoices.store');
        Route::get('invoices/{invoice}', [InvoiceController::class, 'show'])->middleware('permission:invoice_view')->name('invoices.show');
        Route::get('invoices/{invoice}/preview', [InvoiceController::class, 'preview'])->middleware('permission:invoice_view')->name('invoices.preview');
        Route::get('invoices/{invoice}/edit', [InvoiceController::class, 'edit'])->middleware('permission:invoice_update')->name('invoices.edit');
        Route::put('invoices/{invoice}', [InvoiceController::class, 'update'])->middleware('permission:invoice_update')->name('invoices.update');
        Route::patch('invoices/{invoice}', [InvoiceController::class, 'update'])->middleware('permission:invoice_update');
        Route::delete('invoices/{invoice}', [InvoiceController::class, 'destroy'])->middleware('permission:invoice_delete')->name('invoices.destroy');

        Route::post('invoices/{invoice}/mark-paid', [InvoiceController::class, 'markAsPaid'])->middleware('permission:invoice_manage_payments')->name('invoices.mark-paid');
        Route::post('invoices/{invoice}/send', [InvoiceController::class, 'send'])->middleware('permission:invoice_send')->name('invoices.send');
        Route::post('invoices/{invoice}/payments/{payment}/approve', [InvoiceController::class, 'approvePayment'])->middleware('permission:invoice_manage_payments')->name('invoices.payments.approve');
        Route::post('invoices/{invoice}/payments/{payment}/reject', [InvoiceController::class, 'rejectPayment'])->middleware('permission:invoice_manage_payments')->name('invoices.payments.reject');
        Route::get('api/projects/{project}/invoice-data', [InvoiceController::class, 'getProjectInvoiceData'])->middleware('permission:invoice_view_any')->name('api.projects.invoice-data');

        // Payment gateway specific routes
        Route::post('razorpay/create-order', [RazorpayController::class, 'createOrder'])->name('razorpay.create-order');
        Route::post('razorpay/verify-payment', [RazorpayController::class, 'verifyPayment'])->name('razorpay.verify-payment');
        Route::post('razorpay/create-invoice-order', [RazorpayController::class, 'createInvoiceOrder'])->name('razorpay.create-invoice-order');
        Route::post('razorpay/invoice-payment/{token}', [RazorpayController::class, 'processInvoicePaymentFromLink'])->name('razorpay.invoice.payment.link');
        Route::post('cashfree/create-session', [CashfreeController::class, 'createPaymentSession'])->name('cashfree.create-session');
        Route::post('cashfree/verify-payment', [CashfreeController::class, 'verifyPayment'])->name('cashfree.verify-payment');
        Route::post('mercadopago/create-preference', [MercadoPagoController::class, 'createPreference'])->name('mercadopago.create-preference');
        Route::post('mercadopago/process-payment', [MercadoPagoController::class, 'processPayment'])->name('mercadopago.process-payment');
        Route::post('mercadopago/invoice-payment/{token}', [MercadoPagoController::class, 'processInvoicePaymentFromLink'])->name('mercadopago.invoice.payment.link');

        // Invoice payment routes
        // Route::post('invoices/{invoice}/process-payment', [\App\Http\Controllers\InvoiceController::class, 'processPayment'])->middleware('permission:invoice_manage_payments')->name('invoices.process-payment');

        // Invoice payment routes moved to public section for SaaS/non-SaaS compatibility

        // Payment settings API routes
        Route::get('api/payment-settings/enabled', [\App\Http\Controllers\Settings\PaymentSettingController::class, 'getEnabledMethods'])->name('api.payment-settings.enabled');

        Route::middleware('auth')->group(function () {
            Route::get('impersonate/{userId}', [ImpersonateController::class, 'start'])->name('impersonate.start');
        });


        // Zoom Meeting routes
        Route::get('zoom-meetings', [\App\Http\Controllers\ZoomMeetingController::class, 'index'])->middleware('permission:zoom_meeting_view_any')->name('zoom-meetings.index');
        Route::post('zoom-meetings', [\App\Http\Controllers\ZoomMeetingController::class, 'store'])->middleware('permission:zoom_meeting_create')->name('zoom-meetings.store');
        Route::get('zoom-meetings/{zoomMeeting}', [\App\Http\Controllers\ZoomMeetingController::class, 'show'])->middleware('permission:zoom_meeting_view')->name('zoom-meetings.show');
        Route::put('zoom-meetings/{zoomMeeting}', [\App\Http\Controllers\ZoomMeetingController::class, 'update'])->middleware('permission:zoom_meeting_update')->name('zoom-meetings.update');
        Route::patch('zoom-meetings/{zoomMeeting}', [\App\Http\Controllers\ZoomMeetingController::class, 'update'])->middleware('permission:zoom_meeting_update');
        Route::delete('zoom-meetings/{zoomMeeting}', [\App\Http\Controllers\ZoomMeetingController::class, 'destroy'])->middleware('permission:zoom_meeting_delete')->name('zoom-meetings.destroy');

        Route::post('zoom-meetings/{zoomMeeting}/join', [\App\Http\Controllers\ZoomMeetingController::class, 'join'])->name('zoom-meetings.join');
        Route::post('zoom-meetings/{zoomMeeting}/start', [\App\Http\Controllers\ZoomMeetingController::class, 'start'])->name('zoom-meetings.start');
        Route::get('api/zoom-meetings/calendar', [\App\Http\Controllers\ZoomMeetingController::class, 'calendar'])->name('api.zoom-meetings.calendar');

        // Zoom Settings routes
        Route::post('zoom/settings', [\App\Http\Controllers\Settings\ZoomSettingsController::class, 'update'])->middleware('permission:settings_manage')->name('zoom.settings.update');
        Route::post('zoom/test-connection', [\App\Http\Controllers\Settings\ZoomSettingsController::class, 'testConnection'])->middleware('permission:settings_manage')->name('zoom.test-connection');

        // Google Meeting routes
        Route::get('google-meetings', [GoogleMeetingController::class, 'index'])->middleware('permission:google_meeting_view_any')->name('google-meetings.index');
        Route::get('google-meetings/create', [GoogleMeetingController::class, 'create'])->middleware('permission:google_meeting_create')->name('google-meetings.create');
        Route::post('google-meetings', [GoogleMeetingController::class, 'store'])->middleware('permission:google_meeting_create')->name('google-meetings.store');
        Route::get('google-meetings/{googleMeeting}', [GoogleMeetingController::class, 'show'])->middleware('permission:google_meeting_view')->name('google-meetings.show');
        Route::put('google-meetings/{googleMeeting}', [GoogleMeetingController::class, 'update'])->middleware('permission:google_meeting_update')->name('google-meetings.update');
        Route::patch('google-meetings/{googleMeeting}', [GoogleMeetingController::class, 'update'])->middleware('permission:google_meeting_update');
        Route::delete('google-meetings/{googleMeeting}', [GoogleMeetingController::class, 'destroy'])->middleware('permission:google_meeting_delete')->name('google-meetings.destroy');

        Route::post('google-meetings/{googleMeeting}/join', [GoogleMeetingController::class, 'join'])->name('google-meetings.join');
        Route::get('api/google-meetings/calendar', [GoogleMeetingController::class, 'calendar'])->name('api.google-meetings.calendar');

        // Google Meet Settings routes
        Route::post('google-meet/settings', [\App\Http\Controllers\Settings\GoogleMeetSettingsController::class, 'update'])->middleware('permission:settings_manage')->name('google-meet.settings.update');
        Route::post('google-meet/test-connection', [\App\Http\Controllers\Settings\GoogleMeetSettingsController::class, 'testConnection'])->middleware('permission:settings_manage')->name('google-meet.test-connection');

        // Tax routes
        Route::get('taxes', [\App\Http\Controllers\TaxController::class, 'index'])->middleware('permission:tax_view_any')->name('taxes.index');
        Route::post('taxes', [\App\Http\Controllers\TaxController::class, 'store'])->middleware('permission:tax_create')->name('taxes.store');
        Route::put('taxes/{tax}', [\App\Http\Controllers\TaxController::class, 'update'])->middleware('permission:tax_update')->name('taxes.update');
        Route::delete('taxes/{tax}', [\App\Http\Controllers\TaxController::class, 'destroy'])->middleware('permission:tax_delete')->name('taxes.destroy');

        // Notes routes
        Route::get('notes', [\App\Http\Controllers\NoteController::class, 'index'])->middleware('permission:note_view_any')->name('notes.index');
        Route::post('notes', [\App\Http\Controllers\NoteController::class, 'store'])->middleware('permission:note_create')->name('notes.store');
        Route::put('notes/{note}', [\App\Http\Controllers\NoteController::class, 'update'])->middleware('permission:note_update')->name('notes.update');
        Route::delete('notes/{note}', [\App\Http\Controllers\NoteController::class, 'destroy'])->middleware('permission:note_delete')->name('notes.destroy');

        //Calendar routes
        Route::get('task-calendar', [\App\Http\Controllers\CalendarController::class, 'index'])->middleware('permission:task_calendar_view')->name('task-calendar.index');
        Route::get('api/task-calendar/task/{task}', [\App\Http\Controllers\CalendarController::class, 'getTask'])->middleware('permission:task_view')->name('api.task-calendar.task');

        // Contract Types routes
        Route::get('contract-types', [\App\Http\Controllers\ContractTypeController::class, 'index'])->middleware('permission:contract_type_view_any')->name('contract-types.index');
        Route::post('contract-types', [\App\Http\Controllers\ContractTypeController::class, 'store'])->middleware('permission:contract_type_create')->name('contract-types.store');
        Route::put('contract-types/{contractType}', [\App\Http\Controllers\ContractTypeController::class, 'update'])->middleware('permission:contract_type_update')->name('contract-types.update');
        Route::delete('contract-types/{contractType}', [\App\Http\Controllers\ContractTypeController::class, 'destroy'])->middleware('permission:contract_type_delete')->name('contract-types.destroy');
        Route::post('contract-types/reorder', [\App\Http\Controllers\ContractTypeController::class, 'reorder'])->middleware('permission:contract_type_update')->name('contract-types.reorder');
        Route::put('contract-types/{contractType}/toggle-status', [\App\Http\Controllers\ContractTypeController::class, 'toggleStatus'])->middleware('permission:contract_type_update')->name('contract-types.toggle-status');

        // Contracts routes
        Route::get('contracts', [\App\Http\Controllers\ContractController::class, 'index'])->middleware('permission:contract_view_any')->name('contracts.index');
        Route::get('contracts/create', [\App\Http\Controllers\ContractController::class, 'create'])->middleware('permission:contract_create')->name('contracts.create');
        Route::post('contracts', [\App\Http\Controllers\ContractController::class, 'store'])->middleware('permission:contract_create')->name('contracts.store');
        Route::get('contracts/{contract}', [\App\Http\Controllers\ContractController::class, 'show'])->middleware('permission:contract_view')->name('contracts.show');
        Route::get('contracts/{contract}/edit', [\App\Http\Controllers\ContractController::class, 'edit'])->middleware('permission:contract_update')->name('contracts.edit');
        Route::put('contracts/{contract}', [\App\Http\Controllers\ContractController::class, 'update'])->middleware('permission:contract_update')->name('contracts.update');
        Route::delete('contracts/{contract}', [\App\Http\Controllers\ContractController::class, 'destroy'])->middleware('permission:contract_delete')->name('contracts.destroy');
        Route::post('contracts/{contract}/duplicate', [\App\Http\Controllers\ContractController::class, 'duplicate'])->middleware('permission:contract_create')->name('contracts.duplicate');
        Route::put('contracts/{contract}/status', [\App\Http\Controllers\ContractController::class, 'changeStatus'])->middleware('permission:contract_change_status')->name('contracts.change-status');
        Route::get('contracts/{contract}/download', [\App\Http\Controllers\ContractController::class, 'download'])->middleware('permission:contract_download')->name('contracts.download');
        Route::get('contracts/{contract}/preview', [\App\Http\Controllers\ContractController::class, 'preview'])->middleware('permission:contract_preview')->name('contracts.preview');

        // Contract Notes routes
        Route::post('contracts/{contract}/notes', [\App\Http\Controllers\ContractController::class, 'noteStore'])->middleware('permission:contract_note_create')->name('contract-notes.store');
        Route::put('contracts/{contract}/notes/{note}', [\App\Http\Controllers\ContractController::class, 'noteUpdate'])->middleware('permission:contract_note_update')->name('contract-notes.update');
        Route::delete('contracts/{contract}/notes/{note}', [\App\Http\Controllers\ContractController::class, 'noteDestroy'])->middleware('permission:contract_note_delete')->name('contract-notes.destroy');

        // Contract Comments routes
        Route::post('contracts/{contract}/comments', [\App\Http\Controllers\ContractController::class, 'commentStore'])->middleware('permission:contract_comment_create')->name('contract-comments.store');
        Route::put('contract-comments/{comment}', [\App\Http\Controllers\ContractController::class, 'commentUpdate'])->middleware('permission:contract_comment_update')->name('contract-comments.update');
        Route::delete('contract-comments/{comment}', [\App\Http\Controllers\ContractController::class, 'commentDestroy'])->middleware('permission:contract_comment_delete')->name('contract-comments.destroy');

        // Contract Attachments routes
        Route::post('contracts/{contract}/attachments', [\App\Http\Controllers\ContractController::class, 'fileUpload'])->middleware('permission:contract_attachment_create')->name('contract-attachments.store');
        Route::delete('contract-attachments/{attachment}', [\App\Http\Controllers\ContractController::class, 'fileDelete'])->middleware('permission:contract_attachment_delete')->name('contract-attachments.destroy');
        Route::get('contract-attachments/{attachment}/download', [\App\Http\Controllers\ContractController::class, 'fileDownload'])->middleware('permission:contract_attachment_download')->name('contract-attachments.download');

        // Contract Signature routes
        Route::post('contracts/{contract}/signature', [\App\Http\Controllers\ContractController::class, 'signatureStore'])->middleware('permission:contract_signature')->name('contracts.signature.store');

        // Project API routes
        Route::get('api/projects/{project}/members', [\App\Http\Controllers\ZoomMeetingController::class, 'getProjectMembers'])->name('api.projects.members');

        // Google Calendar API routes
        Route::get('api/google-calendar/events', [\App\Http\Controllers\GoogleCalendarController::class, 'getEvents'])->name('api.google-calendar.events');
        Route::post('api/google-calendar/sync', [\App\Http\Controllers\GoogleCalendarController::class, 'syncEvents'])->name('api.google-calendar.sync');
        Route::post('google-calendar/sync', [\App\Http\Controllers\GoogleCalendarController::class, 'syncEvents'])->name('google-calendar.sync');

        // Project Report routes
        Route::get('project-reports', [\App\Http\Controllers\ProjectReportController::class, 'index'])->middleware('permission:project_report_view_any')->name('project-reports.index');
        Route::get('project-reports/{project}', [\App\Http\Controllers\ProjectReportController::class, 'show'])->middleware('permission:project_report_view')->name('project-reports.show');
        Route::post('project-reports/{project}/tasks', [\App\Http\Controllers\ProjectReportController::class, 'getTasksData'])->middleware('permission:project_report_view')->name('project-reports.tasks');
        Route::get('project-reports/{project}/export', [\App\Http\Controllers\ProjectReportController::class, 'export'])->middleware('permission:project_report_export')->name('project-reports.export');

        // ToDo routes
        Route::get('todos', [\App\Http\Controllers\TodoController::class, 'index'])->middleware('permission:todo_view_any')->name('todos.index');
        Route::post('todos', [\App\Http\Controllers\TodoController::class, 'store'])->middleware('permission:todo_create')->name('todos.store');
        Route::get('todos/{todo}', [\App\Http\Controllers\TodoController::class, 'show'])->middleware('permission:todo_view')->name('todos.show');
        Route::get('todos/{todo}/edit', [\App\Http\Controllers\TodoController::class, 'edit'])->middleware('permission:todo_update')->name('todos.edit');
        Route::put('todos/{todo}', [\App\Http\Controllers\TodoController::class, 'update'])->middleware('permission:todo_update')->name('todos.update');
        Route::delete('todos/{todo}', [\App\Http\Controllers\TodoController::class, 'destroy'])->middleware('permission:todo_delete')->name('todos.destroy');
        Route::patch('todos/{todo}/status', [\App\Http\Controllers\TodoController::class, 'updateStatus'])->middleware('permission:todo_status_update')->name('todos.update-status');
        Route::post('todos/{todo}/members', [\App\Http\Controllers\TodoController::class, 'updateMembers'])->middleware('permission:todo_manage_members')->name('todos.update-members');

        // ToDo Comments routes
        Route::post('todos/{todo}/comments', [\App\Http\Controllers\TodoCommentController::class, 'store'])->middleware('permission:todo_comment_create')->name('todo-comments.store');
        Route::put('todo-comments/{todoComment}', [\App\Http\Controllers\TodoCommentController::class, 'update'])->middleware('permission:todo_comment_update')->name('todo-comments.update');
        Route::delete('todo-comments/{todoComment}', [\App\Http\Controllers\TodoCommentController::class, 'destroy'])->middleware('permission:todo_comment_delete')->name('todo-comments.destroy');

        // Todo Attachments
        Route::post('todos/{todo}/attachments', [\App\Http\Controllers\TodoAttachmentController::class, 'store'])->middleware('permission:todo_attachment_create')->name('todo-attachments.store');
        Route::delete('todo-attachments/{todoAttachment}', [\App\Http\Controllers\TodoAttachmentController::class, 'destroy'])->middleware('permission:todo_attachment_delete')->name('todo-attachments.destroy');
        Route::get('todo-attachments/{todoAttachment}/download', [\App\Http\Controllers\TodoAttachmentController::class, 'download'])->middleware('permission:todo_attachment_download')->name('todo-attachments.download');
    }); // End plan.access middleware group
        Route::post('impersonate/leave', [ImpersonateController::class, 'leave'])->name('impersonate.leave');
});


require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';

Route::match(['GET', 'POST'], 'payments/easebuzz/success', [EasebuzzPaymentController::class, 'success'])->name('easebuzz.success');
Route::post('payments/easebuzz/callback', [EasebuzzPaymentController::class, 'callback'])->name('easebuzz.callback');





// Cookie consent routes
Route::post('/cookie-consent/store', [CookieConsentController::class, 'store'])->name('cookie.consent.store');
Route::get('/cookie-consent/download', [CookieConsentController::class, 'download'])->name('cookie.consent.download');

// Invoice preview route
