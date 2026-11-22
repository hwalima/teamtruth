import { VendorFormDialog } from '@/components/erp/vendor-form-dialog';
import { dangerButton, inputClass, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Product = { id: number; sku: string; name: string; type: string; tracking: string; unit: { abbreviation: string } };
type Vendor = { id: number; code: string; name: string; email: string | null; payment_terms_days: number };
type Location = { id: number; code: string; name: string; warehouse: { code: string; name: string } | null };
type RfqLine = {
    id: number;
    quantity: string;
    product: { id: number; sku: string; name: string; unit: { abbreviation: string } };
};
type Quotation = {
    id: number;
    vendor_id: number;
    vendor_reference: string | null;
    total: string;
    status: string;
    vendor: { id: number; code: string; name: string };
};
type SourceRequisition = { id: number; document_number: string };
type ApprovedRequisition = {
    id: number;
    document_number: string;
    department: string | null;
    currency_code: string;
    estimated_total: string;
    lines: Array<{ id: number; item: string; description: string | null; quantity: string; unit: string }>;
};
type ApprovedStoreIssueRequisition = {
    id: number;
    document_number: string;
    department: string | null;
    lines: Array<{ id: number; item: string; description: string | null; quantity: string; unit: string }>;
};
type RFQ = {
    id: number;
    document_number: string;
    status: string;
    currency_code: string;
    reference: string | null;
    source_requisition: SourceRequisition | null;
    lines: RfqLine[];
    quotations: Quotation[];
};
type OrderLine = {
    id: number;
    product_id: number;
    quantity: string;
    received_quantity: string;
    unit_price: string;
    line_total: string;
    product: { sku: string; name: string; tracking: string; unit: { abbreviation: string } };
};
type ReceiptLine = {
    id: number;
    purchase_order_line_id: number;
    quantity: string;
    purchaseOrderLine: OrderLine;
};
type Receipt = {
    id: number;
    document_number: string;
    received_at: string;
    lines: ReceiptLine[];
};
type Order = {
    id: number;
    document_number: string;
    quotation_id: number | null;
    status: string;
    currency_code: string;
    total: string;
    vendor: { code: string; name: string };
    source_requisition: SourceRequisition | null;
    lines: OrderLine[];
    receipts: Receipt[];
};
type BillLine = {
    id: number;
    name: string;
    quantity: string;
    unit_price: string;
    tax_rate: string;
    tax_amount: string;
    line_total: string;
};
type Bill = {
    id: number;
    document_number: string;
    status: string;
    currency_code: string;
    total_amount: string;
    amount_paid: string;
    amount_residual: string;
    bill_date: string;
    due_date: string | null;
    posted_at: string | null;
    vendor: { id: number; code: string; name: string };
    purchaseOrder: { id: number; document_number: string } | null;
    lines: BillLine[];
};
type Payment = {
    id: number;
    document_number: string;
    status: string;
    currency_code: string;
    amount: string;
    payment_date: string;
    vendor: { id: number; code: string; name: string };
    allocations: Array<{ amount: string; purchaseBill: { id: number; document_number: string } }>;
};
type BlanketOrderLine = { id: number; product_id: number; quantity: string; unit_price: string; product: { sku: string; name: string; unit: { abbreviation: string } } };
type BlanketOrder = {
    id: number;
    document_number: string;
    status: string;
    currency_code: string;
    max_amount: string;
    amount_used: string;
    starts_on: string;
    ends_on: string;
    vendor: { id: number; code: string; name: string };
    lines: BlanketOrderLine[];
};
type LandedCost = {
    id: number;
    document_number: string;
    status: string;
    currency_code: string;
    total_amount: string;
    vendor: { code: string; name: string };
    purchaseReceipt: { document_number: string };
    lines: Array<{ id: number; name: string; amount: string; split_method: string }>;
};
type PurchaseReturn = {
    id: number;
    document_number: string;
    status: string;
    return_date: string;
    reason: string;
    purchaseReceipt: { document_number: string };
    lines: Array<{ id: number; quantity: string; purchaseReceiptLine: ReceiptLine }>;
};
type VendorEvaluation = {
    id: number;
    period_year: number;
    period_month: number;
    on_time_delivery_rate: string;
    price_variance: string;
    rejection_rate: string;
    total_orders: number;
    vendor: { id: number; code: string; name: string };
};
type VendorPriceList = {
    id: number;
    min_quantity: string;
    price: string;
    currency_code: string;
    valid_from: string;
    valid_to: string | null;
    vendor: { code: string; name: string };
    product: { sku: string; name: string; unit: { abbreviation: string } };
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    nextVendorCode: string;
    vendors: Vendor[];
    products: Product[];
    currencies: Array<{ code: string; name: string }>;
    supplierLocations: Location[];
    internalLocations: Location[];
    departmentLocations: Location[];
    approvedRequisitions: ApprovedRequisition[];
    approvedStoreIssueRequisitions: ApprovedStoreIssueRequisition[];
    rfqs: RFQ[];
    orders: Order[];
    bills: Bill[];
    payments: Payment[];
    blanketOrders: BlanketOrder[];
    landedCosts: LandedCost[];
    returns: PurchaseReturn[];
    vendorEvaluations: VendorEvaluation[];
    vendorPriceLists: VendorPriceList[];
    receipts: Receipt[];
    locations: Location[];
};
const SECTIONS = [
    { id: 'requisitions', label: 'Requisitions' },
    { id: 'store-issues', label: 'Store issues' },
    { id: 'rfqs', label: 'RFQs' },
    { id: 'orders', label: 'Orders & receipts' },
    { id: 'contracts', label: 'Contracts, costs & returns' },
    { id: 'bills', label: 'Bills' },
    { id: 'payments', label: 'Payments' },
];
type RfqInputLine = { product_id: string; quantity: string };
const blankRfqLine = (productId = ''): RfqInputLine => ({ product_id: productId, quantity: '1' });

export default function PurchaseIndex(props: Props) {
    const [addingVendor, setAddingVendor] = useState(false);
    const rfqForm = useForm({
        currency_code: props.company.default_currency,
        reference: '',
        lines: [blankRfqLine(props.products[0]?.id.toString() ?? '')],
    });
    const rfqErrors = rfqForm.errors as Record<string, string>;

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">{props.company.code}</p>
                    <h1 className="text-2xl font-semibold">{props.company.name} purchasing</h1>
                    <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
                        Create vendor RFQs, compare submitted quotations, route selected orders for approval, and receive approved goods into stock.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a href={route('erp.approvals.index')} className={secondaryButton}>
                        Approval inbox
                    </a>
                    <a href={route('erp.approvals.workflows.index')} className={secondaryButton}>
                        Approval workflows
                    </a>
                </div>
            </header>

            <nav aria-label="Purchasing sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <ul className="flex gap-2 text-sm whitespace-nowrap">
                    {SECTIONS.map((section) => (
                        <li key={section.id}>
                            <a
                                href={`#${section.id}`}
                                className="border-border/70 hover:bg-primary/10 hover:border-primary/30 inline-flex rounded-full border px-3 py-1.5 transition-colors"
                            >
                                {section.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Panel title="Vendors">
                    <p className="text-muted-foreground text-sm">
                        {props.vendors.length === 0
                            ? 'Add vendors before recording quotations, or import them from Odoo.'
                            : `${props.vendors.length} active vendor${props.vendors.length === 1 ? '' : 's'}. Search, edit and see what you owe each one in the vendor directory.`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <a href={route('erp.purchase.vendors.index')} className={primaryButton}>
                            Open vendor directory
                        </a>
                        <button type="button" onClick={() => setAddingVendor(true)} className={secondaryButton}>
                            Add vendor
                        </button>
                        <a href={route('erp.purchase.payments.create')} className={secondaryButton}>
                            Pay a vendor
                        </a>
                    </div>
                    <VendorFormDialog
                        open={addingVendor}
                        onClose={() => setAddingVendor(false)}
                        currencies={props.currencies}
                        defaultCurrency={props.company.default_currency}
                        nextCode={props.nextVendorCode}
                    />
                </Panel>

                <Panel title="Create request for quotation">
                    {props.products.length === 0 ? (
                        <Empty>Create inventory products first.</Empty>
                    ) : (
                        <form
                            onSubmit={(event: FormEvent<HTMLFormElement>) => {
                                event.preventDefault();
                                rfqForm.post(route('erp.purchase.rfqs.store'), { onSuccess: () => rfqForm.reset('reference') });
                            }}
                            className="space-y-3"
                        >
                            <div className="grid gap-3 sm:grid-cols-2">
                                <SelectField
                                    label="Currency"
                                    value={rfqForm.data.currency_code}
                                    options={props.currencies.map((currency) => ({
                                        value: currency.code,
                                        label: `${currency.code} — ${currency.name}`,
                                    }))}
                                    onChange={(value) => rfqForm.setData('currency_code', value)}
                                    error={rfqErrors.currency_code}
                                />
                                <TextField
                                    label="Internal reference (optional)"
                                    value={rfqForm.data.reference}
                                    onChange={(value) => rfqForm.setData('reference', value)}
                                    error={rfqErrors.reference}
                                />
                            </div>
                            <h3 className="text-sm font-medium">Requested items</h3>
                            {rfqForm.data.lines.map((line, index) => (
                                <div
                                    key={index}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]"
                                >
                                    <SelectField
                                        className="col-span-2 sm:col-span-1"
                                        label="Product"
                                        value={line.product_id}
                                        options={props.products.map((product) => ({
                                            value: product.id.toString(),
                                            label: `${product.sku} — ${product.name} (${product.unit.abbreviation})`,
                                        }))}
                                        onChange={(value) =>
                                            updateLine(rfqForm.data.lines, index, 'product_id', value, (lines) => rfqForm.setData('lines', lines))
                                        }
                                    />
                                    <TextField
                                        label="Quantity"
                                        type="number"
                                        value={line.quantity}
                                        onChange={(value) =>
                                            updateLine(rfqForm.data.lines, index, 'quantity', value, (lines) => rfqForm.setData('lines', lines))
                                        }
                                        error={rfqErrors[`lines.${index}.quantity`]}
                                        required
                                    />
                                    <button
                                        type="button"
                                        disabled={rfqForm.data.lines.length <= 1}
                                        onClick={() =>
                                            rfqForm.setData(
                                                'lines',
                                                rfqForm.data.lines.filter((_, lineIndex) => lineIndex !== index),
                                            )
                                        }
                                        className={dangerButton}
                                        aria-label={`Remove item ${index + 1}`}
                                    >
                                        Remove
                                    </button>
                                    {rfqErrors[`lines.${index}.product_id`] && (
                                        <span className="col-span-full">
                                            <ErrorText>{rfqErrors[`lines.${index}.product_id`]}</ErrorText>
                                        </span>
                                    )}
                                </div>
                            ))}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={rfqForm.data.lines.length >= 50}
                                    onClick={() =>
                                        rfqForm.setData('lines', [...rfqForm.data.lines, blankRfqLine(props.products[0]?.id.toString() ?? '')])
                                    }
                                    className={secondaryButton}
                                >
                                    Add item
                                </button>
                                <SubmitButton processing={rfqForm.processing}>Create RFQ</SubmitButton>
                            </div>
                        </form>
                    )}
                </Panel>
            </section>

            <section id="requisitions" className="scroll-mt-20 space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">Approved purchase requisitions</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Map each requested item to an inventory product with the same unit before creating its RFQ.
                    </p>
                </div>
                {props.approvedRequisitions.map((requisition) => (
                    <RequisitionConversionCard key={requisition.id} requisition={requisition} products={props.products} />
                ))}
                {props.approvedRequisitions.length === 0 && <Empty>No approved purchase requisitions are waiting for conversion.</Empty>}
            </section>

            <section id="store-issues" className="scroll-mt-20 space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">Approved store-issue requisitions</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Map requested items to catalog products and post the issue from an internal location to a department location.
                    </p>
                </div>
                {props.approvedStoreIssueRequisitions.map((requisition) => (
                    <StoreIssueRequisitionCard
                        key={requisition.id}
                        requisition={requisition}
                        products={props.products}
                        internalLocations={props.internalLocations}
                        departmentLocations={props.departmentLocations}
                    />
                ))}
                {props.approvedStoreIssueRequisitions.length === 0 && <Empty>No approved store-issue requisitions are waiting to be issued.</Empty>}
            </section>

            <section id="rfqs" className="scroll-mt-20 space-y-4">
                <h2 className="text-xl font-semibold">RFQs and quotation comparison</h2>
                {props.rfqs.map((rfq) => (
                    <RfqCard key={rfq.id} rfq={rfq} vendors={props.vendors} orders={props.orders} />
                ))}
                {props.rfqs.length === 0 && <Empty>No requests for quotation yet.</Empty>}
            </section>

            <section id="orders" className="scroll-mt-20 space-y-4">
                <h2 className="text-xl font-semibold">Purchase orders and receipts</h2>
                {props.orders.map((order) => (
                    <article key={order.id} className="bg-card/70 min-w-0 space-y-4 rounded-xl border p-4 sm:p-5">
                        <header className="flex flex-wrap justify-between gap-2">
                            <div>
                                <h3 className="font-semibold">
                                    {order.document_number} — {order.vendor.name}
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    Status: {order.status.replaceAll('_', ' ')} · Total: {order.currency_code} {order.total}
                                    {order.source_requisition && ` · From ${order.source_requisition.document_number}`}
                                </p>
                            </div>
                            <span className="text-muted-foreground text-sm">{order.lines.length} line(s)</span>
                        </header>
                        <div className="grid gap-3 lg:grid-cols-2">
                            {order.lines.map((line) => (
                                <div key={line.id} className="rounded-lg border p-3 text-sm">
                                    <p className="font-medium">
                                        {line.product.sku} — {line.product.name}
                                    </p>
                                    <p className="text-muted-foreground mt-1">
                                        Ordered {line.quantity} {line.product.unit.abbreviation}; received {line.received_quantity}; unit price{' '}
                                        {order.currency_code} {line.unit_price}
                                    </p>
                                    {['approved', 'partially_received'].includes(order.status) &&
                                    decimalCompare(line.received_quantity, line.quantity) < 0 ? (
                                        <ReceiveLineForm
                                            order={order}
                                            line={line}
                                            supplierLocations={props.supplierLocations}
                                            internalLocations={props.internalLocations}
                                        />
                                    ) : ['approved', 'partially_received', 'received'].includes(order.status) ? (
                                        <p className="text-muted-foreground mt-2 text-xs">This line is fully received.</p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                        {order.receipts.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <h4 className="font-medium text-sm">Receipts</h4>
                                {order.receipts.map((receipt) => (
                                    <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                        <span>
                                            <strong>{receipt.document_number}</strong> — Received {new Date(receipt.received_at).toLocaleDateString()}
                                            ({receipt.lines.length} line(s))
                                        </span>
                                        {['approved', 'partially_received', 'received'].includes(order.status) && (
                                            <a
                                                href={route('erp.purchase.orders.bills.create', [order.id, receipt.id])}
                                                className={secondaryButton}
                                            >
                                                Create vendor bill
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>
                ))}
                {props.orders.length === 0 && <Empty>No purchase orders have been created.</Empty>}
            </section>

            <section id="contracts" className="scroll-mt-20 grid gap-6 lg:grid-cols-2">
                <BlanketOrdersPanel blanketOrders={props.blanketOrders} vendors={props.vendors} products={props.products} currencies={props.currencies} />
                <LandedCostsPanel landedCosts={props.landedCosts} receipts={props.receipts} vendors={props.vendors} products={props.products} currencies={props.currencies} />
                <PurchaseReturnsPanel returns={props.returns} receipts={props.receipts} locations={props.locations} />
                <VendorEvaluationsPanel evaluations={props.vendorEvaluations} vendors={props.vendors} />
                <VendorPriceListsPanel priceLists={props.vendorPriceLists} vendors={props.vendors} products={props.products} currencies={props.currencies} />
            </section>

            <section id="bills" className="scroll-mt-20 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Vendor bills</h2>
                    <a href={route('erp.purchase.payments.create')} className={secondaryButton}>
                        Create payment
                    </a>
                </div>
                {props.bills.map((bill) => (
                    <article key={bill.id} className="bg-card/70 min-w-0 space-y-3 rounded-xl border p-4 sm:p-5">
                        <header className="flex flex-wrap justify-between gap-2">
                            <div>
                                <h3 className="font-semibold">{bill.document_number}</h3>
                                <p className="text-muted-foreground text-sm">
                                    {bill.vendor.code} — {bill.vendor.name}
                                    {bill.purchaseOrder && ` · PO: ${bill.purchaseOrder.document_number}`}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(bill.status)}`}>
                                    {bill.status.replaceAll('_', ' ')}
                                </span>
                                <span>{bill.currency_code} {bill.total_amount}</span>
                                <span className="text-muted-foreground">Residual: {bill.currency_code} {bill.amount_residual}</span>
                            </div>
                        </header>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-muted-foreground border-b">
                                        <th className="py-2">Description</th>
                                        <th className="py-2">Qty</th>
                                        <th className="py-2">Unit price</th>
                                        <th className="py-2">Tax %</th>
                                        <th className="py-2">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bill.lines.map((line) => (
                                        <tr key={line.id} className="border-b">
                                            <td className="py-2">{line.name}</td>
                                            <td className="py-2">{line.quantity}</td>
                                            <td className="py-2">{bill.currency_code} {line.unit_price}</td>
                                            <td className="py-2">{line.tax_rate}%</td>
                                            <td className="py-2 font-medium">{bill.currency_code} {line.line_total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {bill.status === 'draft' && (
                            <div className="flex gap-2">
                                <form action={route('erp.purchase.bills.submit', bill.id)} method="POST">
                                    <button type="submit" className={secondaryButton}>Submit for approval</button>
                                </form>
                            </div>
                        )}
                        {bill.status === 'approved' && bill.posted_at === null && (
                            <div className="flex gap-2">
                                <form action={route('erp.purchase.bills.post', bill.id)} method="POST">
                                    <button type="submit" className={secondaryButton}>Post to accounting</button>
                                </form>
                            </div>
                        )}
                    </article>
                ))}
                {props.bills.length === 0 && <Empty>No vendor bills yet.</Empty>}
            </section>

            <section id="payments" className="scroll-mt-20 space-y-4">
                <h2 className="text-xl font-semibold">Vendor payments</h2>
                {props.payments.map((payment) => (
                    <article key={payment.id} className="bg-card/70 min-w-0 space-y-3 rounded-xl border p-4 sm:p-5">
                        <header className="flex flex-wrap justify-between gap-2">
                            <div>
                                <h3 className="font-semibold">{payment.document_number}</h3>
                                <p className="text-muted-foreground text-sm">
                                    {payment.vendor.code} — {payment.vendor.name}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(payment.status)}`}>
                                    {payment.status}
                                </span>
                                <span>{payment.currency_code} {payment.amount}</span>
                                <span className="text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()}</span>
                            </div>
                        </header>
                        {payment.allocations.length > 0 && (
                            <div className="text-sm">
                                <p className="font-medium">Allocated to:</p>
                                <ul className="list-disc list-inside text-muted-foreground mt-1">
                                    {payment.allocations.map((alloc) => (
                                        <li key={alloc.purchaseBill.id}>
                                            {alloc.purchaseBill.document_number} — {payment.currency_code} {alloc.amount}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {payment.status === 'draft' && (
                            <form action={route('erp.purchase.payments.post', payment.id)} method="POST">
                                <button type="submit" className={secondaryButton}>Post to accounting</button>
                            </form>
                        )}
                    </article>
                ))}
                {props.payments.length === 0 && <Empty>No vendor payments yet.</Empty>}
            </section>

            <div className="flex flex-wrap gap-2 border-t pt-6">
                <a href={route('erp.inventory.stock.index')} className={secondaryButton}>
                    Stock on hand
                </a>
                <a href={route('erp.dashboard')} className={secondaryButton}>
                    ERP dashboard
                </a>
            </div>
        </main>
    );
}

function BlanketOrdersPanel({
    blanketOrders,
    vendors,
    products,
    currencies,
}: {
    blanketOrders: BlanketOrder[];
    vendors: Vendor[];
    products: Product[];
    currencies: Array<{ code: string; name: string }>;
}) {
    const form = useForm({
        vendor_id: vendors[0]?.id.toString() ?? '',
        currency_code: currencies[0]?.code ?? '',
        max_amount: '',
        starts_on: new Date().toISOString().slice(0, 10),
        ends_on: '',
        lines: [{ product_id: products[0]?.id.toString() ?? '', quantity: '1', unit_price: '0' }],
    });
    const errors = form.errors as Record<string, string>;
    return (
        <Panel title="Blanket orders">
            {vendors.length === 0 || products.length === 0 ? <Empty>Add vendors and products before creating a blanket order.</Empty> : (
                <form onSubmit={(event) => { event.preventDefault(); form.post(route('erp.purchase.blanket-orders.store')); }} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <SelectField label="Vendor" value={form.data.vendor_id} options={vendors.map((v) => ({ value: v.id.toString(), label: `${v.code} — ${v.name}` }))} onChange={(value) => form.setData('vendor_id', value)} error={errors.vendor_id} />
                        <SelectField label="Currency" value={form.data.currency_code} options={currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} onChange={(value) => form.setData('currency_code', value)} error={errors.currency_code} />
                        <TextField label="Maximum amount" type="number" value={form.data.max_amount} onChange={(value) => form.setData('max_amount', value)} error={errors.max_amount} required />
                        <TextField label="Starts on" type="date" value={form.data.starts_on} onChange={(value) => form.setData('starts_on', value)} error={errors.starts_on} required />
                        <TextField label="Ends on" type="date" value={form.data.ends_on} onChange={(value) => form.setData('ends_on', value)} error={errors.ends_on} required />
                    </div>
                    <h3 className="text-sm font-medium">Contract lines</h3>
                    {form.data.lines.map((line, index) => (
                        <div key={index} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_auto]">
                            <SelectField className="col-span-2 sm:col-span-1" label="Product" value={line.product_id} options={products.map((p) => ({ value: p.id.toString(), label: `${p.sku} — ${p.name}` }))} onChange={(value) => updateLine(form.data.lines, index, 'product_id', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.product_id`]} />
                            <TextField label="Quantity" type="number" value={line.quantity} onChange={(value) => updateLine(form.data.lines, index, 'quantity', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.quantity`]} required />
                            <TextField label="Unit price" type="number" value={line.unit_price} onChange={(value) => updateLine(form.data.lines, index, 'unit_price', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.unit_price`]} required />
                            <button type="button" disabled={form.data.lines.length <= 1} onClick={() => form.setData('lines', form.data.lines.filter((_, i) => i !== index))} className={`${dangerButton} col-span-2 sm:col-span-1`}>Remove</button>
                        </div>
                    ))}
                    {errors.lines && <ErrorText>{errors.lines}</ErrorText>}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={form.data.lines.length >= 50} onClick={() => form.setData('lines', [...form.data.lines, { product_id: products[0]?.id.toString() ?? '', quantity: '1', unit_price: '0' }])} className={secondaryButton}>Add line</button>
                        <SubmitButton processing={form.processing}>Create blanket order</SubmitButton>
                    </div>
                </form>
            )}
            <div className="space-y-3 border-t pt-3">
                {blanketOrders.map((order) => <BlanketOrderCard key={order.id} blanketOrder={order} />)}
                {blanketOrders.length === 0 && <Empty>No blanket orders yet.</Empty>}
            </div>
        </Panel>
    );
}

function BlanketOrderCard({ blanketOrder }: { blanketOrder: BlanketOrder }) {
    const form = useForm({ lines: blanketOrder.lines.map((line) => ({ blanket_order_line_id: line.id.toString(), quantity: '1' })) });
    const errors = form.errors as Record<string, string>;
    return (
        <article className="rounded-lg border p-3 text-sm">
            <h3 className="font-medium">{blanketOrder.document_number} — {blanketOrder.vendor.name}</h3>
            <p className="text-muted-foreground mt-1">{blanketOrder.status} · {blanketOrder.currency_code} {blanketOrder.amount_used} / {blanketOrder.max_amount} · {blanketOrder.starts_on} to {blanketOrder.ends_on}</p>
            <ul className="my-2 space-y-1">{blanketOrder.lines.map((line) => <li key={line.id}>{line.product.sku} — {line.product.name}: {line.quantity} {line.product.unit.abbreviation} at {blanketOrder.currency_code} {line.unit_price}</li>)}</ul>
            {blanketOrder.status === 'active' && <form onSubmit={(event) => { event.preventDefault(); form.post(route('erp.purchase.blanket-orders.orders.store', blanketOrder.id)); }} className="space-y-2 border-t pt-2">
                <p className="font-medium">Create purchase order from this blanket order</p>
                {form.data.lines.map((line, index) => <div key={line.blanket_order_line_id} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_8.75rem]">
                    <span>{blanketOrder.lines[index]?.product.name}</span>
                    <TextField label="Order quantity" type="number" value={line.quantity} onChange={(value) => updateLine(form.data.lines, index, 'quantity', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.quantity`]} required />
                </div>)}
                <SubmitButton processing={form.processing}>Create order</SubmitButton>
            </form>}
        </article>
    );
}

function LandedCostsPanel({ landedCosts, receipts, vendors, products, currencies }: { landedCosts: LandedCost[]; receipts: Receipt[]; vendors: Vendor[]; products: Product[]; currencies: Array<{ code: string; name: string }> }) {
    const form = useForm({ purchase_receipt_id: receipts[0]?.id.toString() ?? '', vendor_id: vendors[0]?.id.toString() ?? '', currency_code: currencies[0]?.code ?? '', lines: [{ product_id: products[0]?.id.toString() ?? '', account_id: '', name: '', amount: '', split_method: 'by_quantity' }] });
    const errors = form.errors as Record<string, string>;
    return <Panel title="Landed costs">
        {receipts.length === 0 ? <Empty>Receive a purchase order before allocating landed costs.</Empty> : <form onSubmit={(event) => { event.preventDefault(); form.post(route('erp.purchase.landed-costs.store')); }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Receipt" value={form.data.purchase_receipt_id} options={receipts.map((r) => ({ value: r.id.toString(), label: `${r.document_number} · ${new Date(r.received_at).toLocaleDateString()}` }))} onChange={(value) => form.setData('purchase_receipt_id', value)} error={errors.purchase_receipt_id} />
                <SelectField label="Vendor" value={form.data.vendor_id} options={vendors.map((v) => ({ value: v.id.toString(), label: `${v.code} — ${v.name}` }))} onChange={(value) => form.setData('vendor_id', value)} error={errors.vendor_id} />
                <SelectField label="Currency" value={form.data.currency_code} options={currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} onChange={(value) => form.setData('currency_code', value)} error={errors.currency_code} />
            </div>
            <h3 className="text-sm font-medium">Cost allocations</h3>
            {form.data.lines.map((line, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <SelectField label="Product (optional)" value={line.product_id} options={[{ value: '', label: 'No product' }, ...products.map((p) => ({ value: p.id.toString(), label: `${p.sku} — ${p.name}` }))]} onChange={(value) => updateLine(form.data.lines, index, 'product_id', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.product_id`]} />
                <TextField label="Accounting account ID" type="number" value={line.account_id} onChange={(value) => updateLine(form.data.lines, index, 'account_id', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.account_id`]} required />
                <TextField label="Cost name" value={line.name} onChange={(value) => updateLine(form.data.lines, index, 'name', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.name`]} required />
                <TextField label="Amount" type="number" value={line.amount} onChange={(value) => updateLine(form.data.lines, index, 'amount', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.amount`]} required />
                <SelectField label="Split method" value={line.split_method} options={[{ value: 'by_quantity', label: 'By quantity' }, { value: 'by_value', label: 'By value' }, { value: 'equally', label: 'Equally' }]} onChange={(value) => updateLine(form.data.lines, index, 'split_method', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.split_method`]} />
                <button type="button" disabled={form.data.lines.length <= 1} onClick={() => form.setData('lines', form.data.lines.filter((_, i) => i !== index))} className={`${dangerButton} self-end`}>Remove line</button>
            </div>)}
            {errors.lines && <ErrorText>{errors.lines}</ErrorText>}
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => form.setData('lines', [...form.data.lines, { product_id: '', account_id: '', name: '', amount: '', split_method: 'by_quantity' }])} className={secondaryButton}>Add cost</button><SubmitButton processing={form.processing}>Create landed cost</SubmitButton></div>
        </form>}
        <div className="space-y-2 border-t pt-3">{landedCosts.map((cost) => <article key={cost.id} className="rounded-lg border p-3 text-sm"><strong>{cost.document_number} — {cost.vendor.name}</strong><p className="text-muted-foreground">Receipt {cost.purchaseReceipt.document_number} · {cost.status} · {cost.currency_code} {cost.total_amount}</p></article>)}{landedCosts.length === 0 && <Empty>No landed costs recorded.</Empty>}</div>
    </Panel>;
}

function PurchaseReturnsPanel({ returns, receipts, locations }: { returns: PurchaseReturn[]; receipts: Receipt[]; locations: Location[] }) {
    const initialReceipt = receipts[0];
    const form = useForm({ purchase_receipt_id: initialReceipt?.id.toString() ?? '', source_location_id: locations[0]?.id.toString() ?? '', destination_location_id: locations[1]?.id.toString() ?? locations[0]?.id.toString() ?? '', return_date: new Date().toISOString().slice(0, 10), reason: '', lines: initialReceipt?.lines.map((line) => ({ purchase_receipt_line_id: line.id.toString(), quantity: '' })) ?? [] });
    const errors = form.errors as Record<string, string>;
    const selectedReceipt = receipts.find((receipt) => receipt.id.toString() === form.data.purchase_receipt_id);
    return <Panel title="Purchase returns">
        {receipts.length === 0 || locations.length === 0 ? <Empty>Receipts and stock locations are required to record a purchase return.</Empty> : <form onSubmit={(event) => { event.preventDefault(); form.post(route('erp.purchase.returns.store')); }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Receipt" value={form.data.purchase_receipt_id} options={receipts.map((r) => ({ value: r.id.toString(), label: r.document_number }))} onChange={(value) => { form.setData('purchase_receipt_id', value); const receipt = receipts.find((r) => r.id.toString() === value); form.setData('lines', receipt?.lines.map((line) => ({ purchase_receipt_line_id: line.id.toString(), quantity: '' })) ?? []); }} error={errors.purchase_receipt_id} />
                <SelectField label="Return from location" value={form.data.source_location_id} options={locations.map(locationOption)} onChange={(value) => form.setData('source_location_id', value)} error={errors.source_location_id} />
                <SelectField label="Vendor destination location" value={form.data.destination_location_id} options={locations.map(locationOption)} onChange={(value) => form.setData('destination_location_id', value)} error={errors.destination_location_id} />
                <TextField label="Return date" type="date" value={form.data.return_date} onChange={(value) => form.setData('return_date', value)} error={errors.return_date} required />
                <TextField label="Reason" value={form.data.reason} onChange={(value) => form.setData('reason', value)} error={errors.reason} required />
            </div>
            <h3 className="text-sm font-medium">Receipt quantities to return</h3>
            {selectedReceipt?.lines.map((line, index) => <div key={line.id} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_9.375rem]"><p className="text-sm">{line.purchaseOrderLine.product.sku} — {line.purchaseOrderLine.product.name}<span className="text-muted-foreground block">Received {line.quantity} {line.purchaseOrderLine.product.unit.abbreviation}</span></p><TextField label="Return quantity" type="number" value={form.data.lines[index]?.quantity ?? ''} onChange={(value) => updateLine(form.data.lines, index, 'quantity', value, (lines) => form.setData('lines', lines))} error={errors[`lines.${index}.quantity`]} required /></div>)}
            {errors.lines && <ErrorText>{errors.lines}</ErrorText>}
            <SubmitButton processing={form.processing}>Create purchase return</SubmitButton>
        </form>}
        <div className="space-y-2 border-t pt-3">{returns.map((item) => <article key={item.id} className="rounded-lg border p-3 text-sm"><strong>{item.document_number}</strong><p className="text-muted-foreground">Receipt {item.purchaseReceipt.document_number} · {item.return_date} · {item.status} · {item.reason}</p></article>)}{returns.length === 0 && <Empty>No purchase returns recorded.</Empty>}</div>
    </Panel>;
}

function VendorEvaluationsPanel({ evaluations, vendors }: { evaluations: VendorEvaluation[]; vendors: Vendor[] }) {
    const now = new Date();
    const form = useForm({ vendor_id: vendors[0]?.id.toString() ?? '', year: now.getFullYear().toString(), month: (now.getMonth() + 1).toString() });
    const errors = form.errors as Record<string, string>;
    return <Panel title="Vendor evaluations">
        <form onSubmit={(event) => { event.preventDefault(); form.post(route('erp.purchase.vendors.evaluations.refresh')); }} className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Vendor" value={form.data.vendor_id} options={vendors.map((v) => ({ value: v.id.toString(), label: `${v.code} — ${v.name}` }))} onChange={(value) => form.setData('vendor_id', value)} error={errors.vendor_id} />
            <TextField label="Year" type="number" value={form.data.year} onChange={(value) => form.setData('year', value)} error={errors.year} required />
            <SelectField label="Month" value={form.data.month} options={Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: new Date(2000, i).toLocaleString(undefined, { month: 'long' }) }))} onChange={(value) => form.setData('month', value)} error={errors.month} />
            <SubmitButton processing={form.processing}>Refresh evaluation</SubmitButton>
        </form>
        <div className="overflow-x-auto border-t pt-3"><table className="w-full text-left text-sm"><thead><tr className="text-muted-foreground border-b"><th className="py-2">Vendor / period</th><th className="py-2">On time</th><th className="py-2">Price variance</th><th className="py-2">Rejection</th><th className="py-2">Orders</th></tr></thead><tbody>{evaluations.map((evaluation) => <tr key={evaluation.id} className="border-b"><td className="py-2">{evaluation.vendor.code} — {evaluation.vendor.name}<span className="text-muted-foreground block">{evaluation.period_year}-{String(evaluation.period_month).padStart(2, '0')}</span></td><td className="py-2">{evaluation.on_time_delivery_rate}%</td><td className="py-2">{evaluation.price_variance}%</td><td className="py-2">{evaluation.rejection_rate}%</td><td className="py-2">{evaluation.total_orders}</td></tr>)}</tbody></table>{evaluations.length === 0 && <Empty>No vendor evaluations yet.</Empty>}</div>
    </Panel>;
}

function VendorPriceListsPanel({ priceLists, vendors, products, currencies }: { priceLists: VendorPriceList[]; vendors: Vendor[]; products: Product[]; currencies: Array<{ code: string; name: string }> }) {
    const form = useForm({ vendor_id: vendors[0]?.id.toString() ?? '', product_id: products[0]?.id.toString() ?? '', min_quantity: '1', price: '', currency_code: currencies[0]?.code ?? '', valid_from: new Date().toISOString().slice(0, 10), valid_to: '' });
    const errors = form.errors as Record<string, string>;
    return <Panel title="Vendor price lists">
        {vendors.length === 0 || products.length === 0 ? <Empty>Add vendors and products before setting vendor prices.</Empty> : <form onSubmit={(event) => { event.preventDefault(); form.post(route('erp.purchase.vendors.price-lists.store')); }} className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Vendor" value={form.data.vendor_id} options={vendors.map((v) => ({ value: v.id.toString(), label: `${v.code} — ${v.name}` }))} onChange={(value) => form.setData('vendor_id', value)} error={errors.vendor_id} />
            <SelectField label="Product" value={form.data.product_id} options={products.map((p) => ({ value: p.id.toString(), label: `${p.sku} — ${p.name}` }))} onChange={(value) => form.setData('product_id', value)} error={errors.product_id} />
            <TextField label="Minimum quantity" type="number" value={form.data.min_quantity} onChange={(value) => form.setData('min_quantity', value)} error={errors.min_quantity} required />
            <TextField label="Unit price" type="number" value={form.data.price} onChange={(value) => form.setData('price', value)} error={errors.price} required />
            <SelectField label="Currency" value={form.data.currency_code} options={currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} onChange={(value) => form.setData('currency_code', value)} error={errors.currency_code} />
            <TextField label="Valid from" type="date" value={form.data.valid_from} onChange={(value) => form.setData('valid_from', value)} error={errors.valid_from} required />
            <TextField label="Valid to (optional)" type="date" value={form.data.valid_to} onChange={(value) => form.setData('valid_to', value)} error={errors.valid_to} />
            <SubmitButton processing={form.processing}>Add vendor price</SubmitButton>
        </form>}
        <div className="overflow-x-auto border-t pt-3"><table className="w-full text-left text-sm"><thead><tr className="text-muted-foreground border-b"><th className="py-2">Product</th><th className="py-2">Vendor</th><th className="py-2">Minimum</th><th className="py-2">Price</th><th className="py-2">Valid</th></tr></thead><tbody>{priceLists.map((item) => <tr key={item.id} className="border-b"><td className="py-2">{item.product.sku} — {item.product.name}</td><td className="py-2">{item.vendor.code} — {item.vendor.name}</td><td className="py-2">{item.min_quantity} {item.product.unit.abbreviation}</td><td className="py-2">{item.currency_code} {item.price}</td><td className="py-2">{item.valid_from} – {item.valid_to ?? 'open'}</td></tr>)}</tbody></table>{priceLists.length === 0 && <Empty>No vendor price lists yet.</Empty>}</div>
    </Panel>;
}

function StoreIssueRequisitionCard({
    requisition,
    products,
    internalLocations,
    departmentLocations,
}: {
    requisition: ApprovedStoreIssueRequisition;
    products: Product[];
    internalLocations: Location[];
    departmentLocations: Location[];
}) {
    const form = useForm({
        source_location_id: internalLocations[0]?.id.toString() ?? '',
        destination_location_id: departmentLocations[0]?.id.toString() ?? '',
        lines: requisition.lines.map((line) => ({
            requisition_line_id: line.id.toString(),
            product_id: '',
            lot_code: '',
            serial_codes: '',
        })),
    });
    const errors = form.errors as Record<string, string>;
    const hasUnmappedUnits = requisition.lines.some((line) => !products.some((product) => sameUnit(line.unit, product.unit.abbreviation)));
    const missingLocations = internalLocations.length === 0 || departmentLocations.length === 0;

    return (
        <article className="bg-card/70 min-w-0 space-y-4 rounded-xl border p-4 sm:p-5">
            <header>
                <h3 className="font-semibold">{requisition.document_number}</h3>
                <p className="text-muted-foreground text-sm">Approved · {requisition.department ?? 'No department'}</p>
            </header>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(route('erp.purchase.requisitions.issue-stock', requisition.id));
                }}
                className="space-y-3"
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                        label="Issue from internal location"
                        value={form.data.source_location_id}
                        options={internalLocations.map(locationOption)}
                        onChange={(value) => form.setData('source_location_id', value)}
                        error={errors.source_location_id}
                    />
                    <SelectField
                        label="Issue to department location"
                        value={form.data.destination_location_id}
                        options={departmentLocations.map(locationOption)}
                        onChange={(value) => form.setData('destination_location_id', value)}
                        error={errors.destination_location_id}
                    />
                </div>
                {requisition.lines.map((line, index) => {
                    const matchingProducts = products.filter((product) => sameUnit(line.unit, product.unit.abbreviation));
                    const selectedProduct = products.find((product) => product.id.toString() === form.data.lines[index].product_id);
                    return (
                        <div key={line.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                            <div>
                                <p className="text-sm font-medium">{line.item}</p>
                                {line.description && <p className="text-muted-foreground text-sm">{line.description}</p>}
                                <p className="text-muted-foreground text-sm">
                                    {line.quantity} {line.unit}
                                </p>
                                {errors[`lines.${index}.quantity`] && <ErrorText>{errors[`lines.${index}.quantity`]}</ErrorText>}
                            </div>
                            <SelectField
                                label="Matching inventory product"
                                value={form.data.lines[index].product_id}
                                options={[
                                    { value: '', label: 'Select a product' },
                                    ...matchingProducts.map((product) => ({
                                        value: product.id.toString(),
                                        label: `${product.sku} — ${product.name} (${product.unit.abbreviation})`,
                                    })),
                                ]}
                                onChange={(value) =>
                                    form.setData(
                                        'lines',
                                        form.data.lines.map((current, lineIndex) =>
                                            lineIndex === index ? { ...current, product_id: value, lot_code: '', serial_codes: '' } : current,
                                        ),
                                    )
                                }
                                error={errors[`lines.${index}.product_id`]}
                            />
                            {selectedProduct?.tracking === 'lot' && (
                                <TextField
                                    label="Lot number"
                                    value={form.data.lines[index].lot_code}
                                    onChange={(value) =>
                                        updateLine(form.data.lines, index, 'lot_code', value, (lines) => form.setData('lines', lines))
                                    }
                                    error={errors[`lines.${index}.lot_code`]}
                                    required
                                />
                            )}
                            {selectedProduct?.tracking === 'serial' && (
                                <TextField
                                    label={`Serial numbers (${line.quantity} comma-separated values, one per unit)`}
                                    value={form.data.lines[index].serial_codes}
                                    onChange={(value) =>
                                        updateLine(form.data.lines, index, 'serial_codes', value, (lines) => form.setData('lines', lines))
                                    }
                                    error={errors[`lines.${index}.serial_codes`]}
                                    required
                                />
                            )}
                        </div>
                    );
                })}
                {errors.lines && <ErrorText>{errors.lines}</ErrorText>}
                {hasUnmappedUnits && (
                    <p className="text-destructive text-sm">
                        Some lines have no catalog product with a matching unit. Add a suitable inventory product before issuing this requisition.
                    </p>
                )}
                {missingLocations && (
                    <p className="text-destructive text-sm">
                        Configure at least one internal stock location and one department location before issuing stock.
                    </p>
                )}
                <SubmitButton processing={form.processing || hasUnmappedUnits || missingLocations}>Issue approved requisition</SubmitButton>
            </form>
        </article>
    );
}

function RequisitionConversionCard({ requisition, products }: { requisition: ApprovedRequisition; products: Product[] }) {
    const form = useForm({
        lines: requisition.lines.map((line) => ({ requisition_line_id: line.id.toString(), product_id: '' })),
    });
    const errors = form.errors as Record<string, string>;
    const hasUnmappedUnits = requisition.lines.some((line) => !products.some((product) => sameUnit(line.unit, product.unit.abbreviation)));

    return (
        <article className="bg-card/70 min-w-0 space-y-4 rounded-xl border p-4 sm:p-5">
            <header className="flex flex-wrap justify-between gap-2">
                <div>
                    <h3 className="font-semibold">{requisition.document_number}</h3>
                    <p className="text-muted-foreground text-sm">
                        Approved · {requisition.department ?? 'No department'} · Estimated {requisition.currency_code} {requisition.estimated_total}
                    </p>
                </div>
                <a className={secondaryButton} href={route('erp.requisitions.show', requisition.id)}>
                    View requisition
                </a>
            </header>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(route('erp.purchase.requisitions.rfqs.store', requisition.id));
                }}
                className="space-y-3"
            >
                {requisition.lines.map((line, index) => {
                    const matchingProducts = products.filter((product) => sameUnit(line.unit, product.unit.abbreviation));
                    return (
                        <div key={line.id} className="grid gap-3 sm:grid-cols-2">
                            <p className="self-center text-sm">
                                <strong>{line.item}</strong>
                                {line.description && <span className="text-muted-foreground"> · {line.description}</span>}
                                <span className="text-muted-foreground block">
                                    {line.quantity} {line.unit}
                                </span>
                            </p>
                            <SelectField
                                label="Matching inventory product"
                                value={form.data.lines[index].product_id}
                                options={[
                                    { value: '', label: 'Select a product' },
                                    ...matchingProducts.map((product) => ({
                                        value: product.id.toString(),
                                        label: `${product.sku} — ${product.name} (${product.unit.abbreviation})`,
                                    })),
                                ]}
                                onChange={(value) => updateLine(form.data.lines, index, 'product_id', value, (lines) => form.setData('lines', lines))}
                                error={errors[`lines.${index}.product_id`]}
                            />
                        </div>
                    );
                })}
                {errors.lines && <ErrorText>{errors.lines}</ErrorText>}
                {hasUnmappedUnits && (
                    <p className="text-destructive text-sm">
                        Some lines have no catalog product with a matching unit. Add a suitable inventory product before converting this requisition.
                    </p>
                )}
                <SubmitButton processing={form.processing || hasUnmappedUnits}>Create RFQ from requisition</SubmitButton>
            </form>
        </article>
    );
}

function RfqCard({ rfq, vendors, orders }: { rfq: RFQ; vendors: Vendor[]; orders: Order[] }) {
    const quoteForm = useForm({
        vendor_id: vendors[0]?.id.toString() ?? '',
        vendor_reference: '',
        lines: rfq.lines.map((line) => ({ rfq_line_id: line.id.toString(), unit_price: '0' })),
    });
    const orderForm = useForm({});
    const errors = quoteForm.errors as Record<string, string>;
    const orderErrors = orderForm.errors as Record<string, string>;
    const quoteOrderIds = new Set(orders.map((order) => order.quotation_id).filter((id): id is number => id !== null));

    return (
        <article className="bg-card/70 min-w-0 space-y-4 rounded-xl border p-4 sm:p-5">
            <header className="flex flex-wrap justify-between gap-2">
                <div>
                    <h3 className="font-semibold">{rfq.document_number}</h3>
                    <p className="text-muted-foreground text-sm">
                        Status: {rfq.status} · Currency: {rfq.currency_code}
                        {rfq.reference ? ` · ${rfq.reference}` : ''}
                        {rfq.source_requisition && ` · From ${rfq.source_requisition.document_number}`}
                    </p>
                </div>
            </header>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="text-muted-foreground border-b">
                            <th className="py-2">Product</th>
                            <th className="py-2">Quantity</th>
                            <th className="py-2">Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rfq.lines.map((line) => (
                            <tr key={line.id} className="border-b">
                                <td className="py-2">
                                    {line.product.sku} — {line.product.name}
                                </td>
                                <td className="py-2">{line.quantity}</td>
                                <td className="py-2">{line.product.unit.abbreviation}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {rfq.quotations.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-medium">Submitted quotations (lowest total first)</h4>
                    {rfq.quotations.map((quotation) => (
                        <div key={quotation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                            <span>
                                {quotation.vendor.code} — {quotation.vendor.name}
                                {quotation.vendor_reference ? ` · Ref ${quotation.vendor_reference}` : ''}
                            </span>
                            <strong>
                                {rfq.currency_code} {quotation.total}
                            </strong>
                            <span className="text-muted-foreground">{quotation.status.replaceAll('_', ' ')}</span>
                            {quoteOrderIds.has(quotation.id) ? (
                                <span className="text-muted-foreground">Order created</span>
                            ) : (
                                rfq.status === 'open' && (
                                    <form
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            if (
                                                window.confirm(
                                                    `Select ${quotation.vendor.name}'s quotation and submit a purchase order for approval?`,
                                                )
                                            ) {
                                                orderForm.post(route('erp.purchase.quotations.orders.store', quotation.id));
                                            }
                                        }}
                                    >
                                        <button type="submit" disabled={orderForm.processing} className={primaryButton}>
                                            Select and create PO
                                        </button>
                                    </form>
                                )
                            )}
                        </div>
                    ))}
                    {Object.values(orderErrors).map((error, index) => (
                        <ErrorText key={index}>{error}</ErrorText>
                    ))}
                </div>
            )}

            {rfq.status === 'open' && vendors.length > 0 && (
                <details className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Record a vendor quotation</summary>
                    <form
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                            event.preventDefault();
                            quoteForm.post(route('erp.purchase.rfqs.quotations.store', rfq.id), {
                                onSuccess: () => quoteForm.reset('vendor_reference'),
                            });
                        }}
                        className="mt-4 space-y-3"
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            <SelectField
                                label="Vendor"
                                value={quoteForm.data.vendor_id}
                                options={vendors.map((vendor) => ({ value: vendor.id.toString(), label: `${vendor.code} — ${vendor.name}` }))}
                                onChange={(value) => quoteForm.setData('vendor_id', value)}
                                error={errors.vendor_id}
                            />
                            <TextField
                                label="Vendor quotation reference"
                                value={quoteForm.data.vendor_reference}
                                onChange={(value) => quoteForm.setData('vendor_reference', value)}
                                error={errors.vendor_reference}
                            />
                        </div>
                        {rfq.lines.map((line, index) => (
                            <div key={line.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12.5rem]">
                                <p className="self-center text-sm">
                                    {line.product.sku} — {line.product.name} · {line.quantity} {line.product.unit.abbreviation}
                                </p>
                                <TextField
                                    label={`Unit price (${rfq.currency_code})`}
                                    type="number"
                                    value={quoteForm.data.lines[index].unit_price}
                                    onChange={(value) =>
                                        updateLine(quoteForm.data.lines, index, 'unit_price', value, (lines) => quoteForm.setData('lines', lines))
                                    }
                                    error={errors[`lines.${index}.unit_price`]}
                                    required
                                />
                            </div>
                        ))}
                        {errors.lines && <ErrorText>{errors.lines}</ErrorText>}
                        <SubmitButton processing={quoteForm.processing}>Save quotation</SubmitButton>
                    </form>
                </details>
            )}
        </article>
    );
}

function ReceiveLineForm({
    order,
    line,
    supplierLocations,
    internalLocations,
}: {
    order: Order;
    line: OrderLine;
    supplierLocations: Location[];
    internalLocations: Location[];
}) {
    const form = useForm({
        quantity: '',
        source_location_id: supplierLocations[0]?.id.toString() ?? '',
        destination_location_id: internalLocations[0]?.id.toString() ?? '',
        lot_code: '',
    });
    const errors = form.errors as Record<string, string>;
    if (supplierLocations.length === 0 || internalLocations.length === 0) {
        return (
            <p className="text-destructive mt-3 text-xs">Configure a supplier location and an internal stock location before receiving this order.</p>
        );
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(route('erp.purchase.orders.receive', [order.id, line.id]), {
                    onSuccess: () => form.reset('quantity', 'lot_code'),
                });
            }}
            className="mt-3 grid gap-2 sm:grid-cols-2"
        >
            <TextField
                label={`Receive quantity (${line.product.unit.abbreviation})`}
                type="number"
                value={form.data.quantity}
                onChange={(value) => form.setData('quantity', value)}
                error={errors.quantity}
                required
            />
            <SelectField
                label="Supplier source location"
                value={form.data.source_location_id}
                options={supplierLocations.map(locationOption)}
                onChange={(value) => form.setData('source_location_id', value)}
                error={errors.source_location_id}
            />
            <SelectField
                label="Put away at"
                value={form.data.destination_location_id}
                options={internalLocations.map(locationOption)}
                onChange={(value) => form.setData('destination_location_id', value)}
                error={errors.destination_location_id}
            />
            {line.product.tracking !== 'none' && (
                <TextField
                    label={line.product.tracking === 'serial' ? 'Serial number' : 'Lot number'}
                    value={form.data.lot_code}
                    onChange={(value) => form.setData('lot_code', value)}
                    error={errors.lot_code}
                    required
                />
            )}
            <SubmitButton processing={form.processing}>Receive into stock</SubmitButton>
        </form>
    );
}

function updateLine<T extends object>(lines: T[], index: number, key: keyof T, value: string, update: (lines: T[]) => void) {
    update(lines.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line)));
}

function decimalCompare(left: string, right: string): number {
    const [leftWhole, leftFraction = ''] = left.split('.');
    const [rightWhole, rightFraction = ''] = right.split('.');
    const normalizedLeft = leftWhole.replace(/^0+/, '') || '0';
    const normalizedRight = rightWhole.replace(/^0+/, '') || '0';
    if (normalizedLeft.length !== normalizedRight.length) {
        return normalizedLeft.length < normalizedRight.length ? -1 : 1;
    }
    if (normalizedLeft !== normalizedRight) {
        return normalizedLeft < normalizedRight ? -1 : 1;
    }
    const fractionLength = Math.max(leftFraction.length, rightFraction.length);
    const paddedLeft = leftFraction.padEnd(fractionLength, '0');
    const paddedRight = rightFraction.padEnd(fractionLength, '0');
    return paddedLeft === paddedRight ? 0 : paddedLeft < paddedRight ? -1 : 1;
}

function locationOption(location: Location) {
    return { value: location.id.toString(), label: `${location.warehouse?.code ?? ''} / ${location.code} — ${location.name}` };
}

function sameUnit(left: string, right: string) {
    return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="bg-card/70 min-w-0 space-y-3 rounded-xl border p-4 sm:p-5">
            <h2 className="text-lg font-medium">{title}</h2>
            {children}
        </section>
    );
}

function TextField({
    label,
    value,
    onChange,
    error,
    type = 'text',
    required = false,
    className = '',
}: {
    className?: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    required?: boolean;
}) {
    return (
        <label className={`grid min-w-0 gap-1.5 text-sm ${className}`}>
            {label}
            <input
                required={required}
                min={type === 'number' ? '0' : undefined}
                step={type === 'number' ? '0.0001' : undefined}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={inputClass}
            />
            {error && <ErrorText>{error}</ErrorText>}
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
    error,
    className = '',
}: {
    className?: string;
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <label className={`grid min-w-0 gap-1.5 text-sm ${className}`}>
            {label}
            <select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} truncate`}>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {error && <ErrorText>{error}</ErrorText>}
        </label>
    );
}

function SubmitButton({ processing, children }: { processing: boolean; children: React.ReactNode }) {
    return (
        <button
            type="submit"
            disabled={processing}
            className={`${primaryButton} self-end justify-self-start`}
        >
            {children}
        </button>
    );
}

function ErrorText({ children }: { children: React.ReactNode }) {
    return <span className="text-destructive text-sm">{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="text-muted-foreground py-2 text-sm">{children}</p>;
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'draft':
        case 'pending_approval':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'approved':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'rejected':
        case 'returned':
        case 'cancelled':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'posted':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
}
