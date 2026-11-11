<?php

namespace Tests\Feature;

use App\Models\PaymentSetting;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Plan;
use App\Models\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RazorpaySettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create required permission
        Permission::firstOrCreate(['name' => 'settings_payment', 'guard_name' => 'web', 'module' => 'settings']);
    }

    public function test_razorpay_settings_are_saved_correctly()
    {
        // Create a plan
        $plan = Plan::create([
            'name' => 'Test Plan',
            'price' => 10,
            'duration' => 'monthly',
            'is_default' => true,
            'is_plan_enable' => true,
        ]);

        // Create superadmin user with plan
        $user = User::factory()->create([
            'type' => 'superadmin',
            'plan_id' => $plan->id,
            'plan_is_active' => 1,
        ]);

        // Create workspace for the user
        $workspace = Workspace::create([
            'name' => 'Test Workspace',
            'slug' => 'test-workspace',
            'owner_id' => $user->id,
        ]);

        $user->update(['current_workspace_id' => $workspace->id]);

        // Give the user the required permission
        $user->givePermissionTo('settings_payment');

        // Login as the user
        $this->actingAs($user);

        // Test data - include all required fields for validation
        $data = [
            'is_razorpay_enabled' => true,
            'razorpay_key' => 'rzp_test_123456789',
            'razorpay_secret' => 'test_secret_key',
            'bank_detail' => '',
            'stripe_key' => '',
            'stripe_secret' => '',
            'paypal_client_id' => '',
            'paypal_secret_key' => '',
            'paypal_mode' => 'sandbox',
            'mercadopago_access_token' => '',
            'paystack_public_key' => '',
            'paystack_secret_key' => '',
            'flutterwave_public_key' => '',
            'flutterwave_secret_key' => '',
            'paytabs_profile_id' => '',
            'paytabs_server_key' => '',
            'paytabs_region' => '',
            'paytabs_mode' => 'sandbox',
            'skrill_merchant_id' => '',
            'skrill_secret_word' => '',
            'coingate_api_token' => '',
            'coingate_mode' => 'sandbox',
            'payfast_merchant_id' => '',
            'payfast_merchant_key' => '',
            'payfast_passphrase' => '',
            'payfast_mode' => 'sandbox',
            'tap_secret_key' => '',
            'xendit_api_key' => '',
            'paytr_merchant_id' => '',
            'paytr_merchant_key' => '',
            'paytr_merchant_salt' => '',
            'mollie_api_key' => '',
            'toyyibpay_category_code' => '',
            'toyyibpay_secret_key' => '',
            'benefit_mode' => 'sandbox',
            'benefit_secret_key' => '',
            'benefit_public_key' => '',
            'iyzipay_mode' => 'sandbox',
            'iyzipay_secret_key' => '',
            'iyzipay_public_key' => '',
            'aamarpay_store_id' => '',
            'aamarpay_signature' => '',
            'midtrans_mode' => 'sandbox',
            'midtrans_secret_key' => '',
            'yookassa_shop_id' => '',
            'yookassa_secret_key' => '',
            'nepalste_mode' => 'sandbox',
            'nepalste_secret_key' => '',
            'nepalste_public_key' => '',
            'paiement_merchant_id' => '',
            'cinetpay_site_id' => '',
            'cinetpay_api_key' => '',
            'cinetpay_secret_key' => '',
            'payhere_mode' => 'sandbox',
            'payhere_merchant_id' => '',
            'payhere_merchant_secret' => '',
            'payhere_app_id' => '',
            'payhere_app_secret' => '',
            'fedapay_mode' => 'sandbox',
            'fedapay_secret_key' => '',
            'fedapay_public_key' => '',
            'authorizenet_mode' => 'sandbox',
            'authorizenet_merchant_id' => '',
            'authorizenet_transaction_key' => '',
            'khalti_secret_key' => '',
            'khalti_public_key' => '',
            'easebuzz_merchant_key' => '',
            'easebuzz_salt_key' => '',
            'easebuzz_environment' => '',
            'ozow_mode' => 'sandbox',
            'ozow_site_key' => '',
            'ozow_private_key' => '',
            'ozow_api_key' => '',
            'cashfree_mode' => 'sandbox',
            'cashfree_secret_key' => '',
            'cashfree_public_key' => '',
        ];

        // Submit the form
        $response = $this->post(route('payment.settings'), $data);

        // Assert the response
        $response->assertRedirect();
        $response->assertSessionHas('success');

        // Check if the settings were saved correctly
        $settings = PaymentSetting::where('user_id', $user->id)->get();

        $this->assertTrue($settings->where('key', 'is_razorpay_enabled')->first()->value == '1');
        $this->assertEquals('rzp_test_123456789', $settings->where('key', 'razorpay_key')->first()->value);
        $this->assertEquals('test_secret_key', $settings->where('key', 'razorpay_secret')->first()->value);
    }
}