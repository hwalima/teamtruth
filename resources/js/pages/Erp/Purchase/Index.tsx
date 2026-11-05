import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
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
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
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
};
type RfqInputLine = { product_id: string; quantity: string };
const blankRfqLine = (productId = ''): RfqInputLine => ({ product_id: productId, quantity: '1' });

export default function PurchaseIndex(props: Props) {
    const vendorForm = useForm({
        code: '',
        name: '',
        tax_no: '',
        email: '',
        phone: '',
        address: '',
        payment_terms_days: '0',
        currency_code: '',
    });
    const rfqForm = useForm({
        currency_code: props.company.default_currency,
        reference: '',
        lines: [blankRfqLine(props.products[0]?.id.toString() ?? '')],
    });
    const vendorErrors = vendorForm.errors as Record<string, string>;
    const rfqErrors = rfqForm.errors as Record<string, string>;

    return (
        <main className="mx-auto max-w-6xl space-y-8 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} purchasing</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Create vendor RFQs, compare submitted quotations, route selected orders for approval, and receive approved goods into stock.
                </p>
                <nav className="mt-3 flex flex-wrap gap-4 text-sm">
                    <a href={route('erp.approvals.workflows.index')} className="text-primary underline">
                        Configure approval workflows
                    </a>
                    <a href={route('erp.approvals.index')} className="text-primary underline">
                        Open approval inbox
                    </a>
                </nav>
            </header>

            <section className="grid gap-6 lg:grid-cols-2">
                <Panel title="Vendor directory">
                    <form
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                            event.preventDefault();
                            vendorForm.post(route('erp.purchase.vendors.store'), { onSuccess: () => vendorForm.reset() });
                        }}
                        className="grid gap-3 sm:grid-cols-2"
                    >
                        <TextField
                            label="Vendor code"
                            value={vendorForm.data.code}
                            onChange={(value) => vendorForm.setData('code', value)}
                            error={vendorErrors.code}
                            required
                        />
                        <TextField
                            label="Vendor name"
                            value={vendorForm.data.name}
                            onChange={(value) => vendorForm.setData('name', value)}
                            error={vendorErrors.name}
                            required
                        />
                        <TextField
                            label="Email"
                            type="email"
                            value={vendorForm.data.email}
                            onChange={(value) => vendorForm.setData('email', value)}
                            error={vendorErrors.email}
                        />
                        <TextField
                            label="Phone"
                            value={vendorForm.data.phone}
                            onChange={(value) => vendorForm.setData('phone', value)}
                            error={vendorErrors.phone}
                        />
                        <TextField
                            label="Tax number"
                            value={vendorForm.data.tax_no}
                            onChange={(value) => vendorForm.setData('tax_no', value)}
                            error={vendorErrors.tax_no}
                        />
                        <TextField
                            label="Payment terms (days)"
                            type="number"
                            value={vendorForm.data.payment_terms_days}
                            onChange={(value) => vendorForm.setData('payment_terms_days', value)}
                            error={vendorErrors.payment_terms_days}
                        />
                        <TextField
                            label="Address"
                            value={vendorForm.data.address}
                            onChange={(value) => vendorForm.setData('address', value)}
                            error={vendorErrors.address}
                        />
                        <SelectField
                            label="Default currency"
                            value={vendorForm.data.currency_code}
                            options={[
                                { value: '', label: 'Use RFQ currency' },
                                ...props.currencies.map((currency) => ({ value: currency.code, label: `${currency.code} — ${currency.name}` })),
                            ]}
                            onChange={(value) => vendorForm.setData('currency_code', value)}
                            error={vendorErrors.currency_code}
                        />
                        <SubmitButton processing={vendorForm.processing}>Add vendor</SubmitButton>
                    </form>
                    <ul className="mt-4 divide-y">
                        {props.vendors.map((vendor) => (
                            <li key={vendor.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                                <span>
                                    <strong>
                                        {vendor.code} — {vendor.name}
                                    </strong>
                                    {vendor.email ? ` · ${vendor.email}` : ''}
                                </span>
                                <span className="text-muted-foreground">{vendor.payment_terms_days} days</span>
                            </li>
                        ))}
                        {props.vendors.length === 0 && <Empty>Add vendors before recording quotations.</Empty>}
                    </ul>
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
                            <h3 className="font-medium">Requested items</h3>
                            {rfqForm.data.lines.map((line, index) => (
                                <div key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_150px_auto]">
                                    <SelectField
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
                                        className="text-destructive pb-2 text-sm underline disabled:opacity-40"
                                    >
                                        Remove
                                    </button>
                                    {rfqErrors[`lines.${index}.product_id`] && <ErrorText>{rfqErrors[`lines.${index}.product_id`]}</ErrorText>}
                                </div>
                            ))}
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    disabled={rfqForm.data.lines.length >= 50}
                                    onClick={() =>
                                        rfqForm.setData('lines', [...rfqForm.data.lines, blankRfqLine(props.products[0]?.id.toString() ?? '')])
                                    }
                                    className="text-primary text-sm underline disabled:opacity-50"
                                >
                                    Add item
                                </button>
                                <SubmitButton processing={rfqForm.processing}>Create RFQ</SubmitButton>
                            </div>
                        </form>
                    )}
                </Panel>
            </section>

            <section className="space-y-4">
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

            <section className="space-y-4">
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

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">RFQs and quotation comparison</h2>
                {props.rfqs.map((rfq) => (
                    <RfqCard key={rfq.id} rfq={rfq} vendors={props.vendors} orders={props.orders} />
                ))}
                {props.rfqs.length === 0 && <Empty>No requests for quotation yet.</Empty>}
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Purchase orders and receipts</h2>
                {props.orders.map((order) => (
                    <article key={order.id} className="space-y-4 rounded-md border p-4">
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
                                <div key={line.id} className="rounded border p-3 text-sm">
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
                    </article>
                ))}
                {props.orders.length === 0 && <Empty>No purchase orders have been created.</Empty>}
            </section>

            <div className="flex flex-wrap gap-4">
                <a href={route('erp.inventory.stock.index')} className="text-primary text-sm underline">
                    Stock on hand
                </a>
                <a href={route('erp.dashboard')} className="text-primary text-sm underline">
                    ERP dashboard
                </a>
            </div>
        </main>
    );
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
        <article className="space-y-4 rounded-md border p-4">
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
                        <div key={line.id} className="grid gap-3 rounded border p-3 sm:grid-cols-2">
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
        <article className="space-y-4 rounded-md border p-4">
            <header className="flex flex-wrap justify-between gap-2">
                <div>
                    <h3 className="font-semibold">{requisition.document_number}</h3>
                    <p className="text-muted-foreground text-sm">
                        Approved · {requisition.department ?? 'No department'} · Estimated {requisition.currency_code} {requisition.estimated_total}
                    </p>
                </div>
                <a className="text-primary text-sm underline" href={route('erp.requisitions.show', requisition.id)}>
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
                        <div key={line.id} className="grid gap-3 sm:grid-cols-[1fr_1fr]">
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
        <article className="space-y-4 rounded-md border p-4">
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
                        <div key={quotation.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm">
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
                                        <button type="submit" disabled={orderForm.processing} className="text-primary underline disabled:opacity-50">
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
                <details className="rounded border p-3">
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
                            <div key={line.id} className="grid gap-3 sm:grid-cols-[1fr_200px]">
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
        <section className="space-y-3 rounded-md border p-4">
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
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    required?: boolean;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <input
                required={required}
                min={type === 'number' ? '0' : undefined}
                step={type === 'number' ? '0.0001' : undefined}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="bg-background rounded-md border px-3 py-2"
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
}: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-background rounded-md border px-3 py-2">
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
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
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
