<?php

namespace App\Modules\Purchase\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Purchase\Mail\PurchaseOrderMail;
use App\Modules\Purchase\Models\PurchaseOrder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

/** The purchase order as a branded PDF, and emailing it to the vendor. */
class PurchaseOrderDocumentController extends Controller
{
    /** Only orders that have been approved can go to the vendor. */
    private const SENDABLE = ['approved', 'partially_received', 'received'];

    public function pdf(Request $request, PurchaseOrder $order, DocumentRenderer $renderer): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.purchase.view');

        return response($this->render($order, $renderer), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$this->filename($order).'"',
        ]);
    }

    public function send(Request $request, PurchaseOrder $order, DocumentRenderer $renderer, AuditLogService $audit): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.purchase.manage');
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);
        if (! in_array($order->status, self::SENDABLE, true)) {
            throw ValidationException::withMessages(['email' => 'Only approved purchase orders can be sent to the vendor.']);
        }

        $pdf = $this->render($order, $renderer);
        try {
            Mail::to($data['email'])->send(new PurchaseOrderMail($order, $company, $request->user(), $pdf, $data['message'] ?? null));
        } catch (Throwable $exception) {
            Log::error('Purchase order email failed', ['order_id' => $order->id, 'error' => $exception->getMessage()]);

            throw ValidationException::withMessages(['email' => 'The email could not be sent. Check the mail settings and try again.']);
        }

        $order->forceFill(['sent_at' => now(), 'sent_to' => $data['email']])->save();
        $audit->record($company, 'purchase.order.sent', $order, [], ['to' => $data['email']], $request->user());

        return back()->with('success', 'Purchase order '.$order->document_number.' sent to '.$data['email'].'.');
    }

    private function render(PurchaseOrder $order, DocumentRenderer $renderer): string
    {
        $order->loadMissing(['vendor', 'quotation', 'sourceRequisition', 'lines.product.unit']);

        return $renderer->render($order, 'pdf.documents.purchase-order');
    }

    private function filename(PurchaseOrder $order): string
    {
        return 'purchase-order-'.preg_replace('/[^A-Za-z0-9_-]+/', '-', $order->document_number).'.pdf';
    }
}
