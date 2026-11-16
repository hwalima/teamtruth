import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Customer = { id: number; name: string; currency_code: string };
type Product = { id: number; name: string; sku: string };
type Lead = { id: number; name: string; contact_person: string | null; email: string | null; status: string; assigned_to: { name: string } | null };
type Opportunity = { id: number; title: string; status: string; expected_value: string; customer: Customer | null; assigned_to: { name: string } | null };
type Quote = { id: number; document_number: string; status: string; currency_code: string; total: string; customer: Customer };
type Order = { id: number; document_number: string; status: string; currency_code: string; total: string; invoice_id: number | null; customer: Customer };
type Props = { leads: { data: Lead[]; links: { url: string | null; label: string; active: boolean }[] }; opportunities: Opportunity[]; quotations: Quote[]; orders: Order[]; customers: Customer[]; products: Product[]; currencies: { code: string; name: string }[]; canManage: boolean };

const card = 'rounded-xl border bg-card p-4';
const field = 'min-h-10 rounded-lg border bg-background px-3 py-2 text-sm';
const button = 'min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50';

export default function SalesIndex({ leads, opportunities, quotations, orders, customers, products, currencies, canManage }: Props) {
    const lead = useForm({ name: '', contact_person: '', email: '', phone: '', source: '' });
    const quote = useForm({ customer_id: '', currency_code: '', valid_until: '', lines: [{ product_id: '', description: '', quantity: '1', unit_price: '0', discount: '0', tax_rate: '0' }] });
    const createLead = (event: FormEvent) => { event.preventDefault(); lead.post(route('erp.sales.leads.store'), { onSuccess: () => lead.reset() }); };
    const createQuote = (event: FormEvent) => { event.preventDefault(); quote.post(route('erp.sales.quotations.store'), { onSuccess: () => quote.reset() }); };

    return <main className="mx-auto max-w-7xl space-y-6 p-6">
        <header><p className="text-sm text-muted-foreground">ERP / Modules</p><h1 className="text-2xl font-semibold">Sales</h1><p className="mt-1 text-sm text-muted-foreground">Manage your leads, opportunities, quotations, and sales orders.</p></header>
        {canManage && <div className="grid gap-6 lg:grid-cols-2">
            <form className={`${card} space-y-3`} onSubmit={createLead}><h2 className="font-semibold">New lead</h2><div className="grid gap-3 sm:grid-cols-2">
                <input className={field} placeholder="Organisation / lead name" value={lead.data.name} onChange={e => lead.setData('name', e.target.value)} required />
                <input className={field} placeholder="Contact person" value={lead.data.contact_person} onChange={e => lead.setData('contact_person', e.target.value)} />
                <input className={field} type="email" placeholder="Email" value={lead.data.email} onChange={e => lead.setData('email', e.target.value)} />
                <input className={field} placeholder="Phone" value={lead.data.phone} onChange={e => lead.setData('phone', e.target.value)} />
                <input className={field} placeholder="Source" value={lead.data.source} onChange={e => lead.setData('source', e.target.value)} />
            </div><button className={button} disabled={lead.processing}>Create lead</button></form>
            <form className={`${card} space-y-3`} onSubmit={createQuote}><h2 className="font-semibold">New quotation</h2><div className="grid gap-3 sm:grid-cols-2">
                <select className={field} value={quote.data.customer_id} onChange={e => quote.setData('customer_id', e.target.value)} required><option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select className={field} value={quote.data.currency_code} onChange={e => quote.setData('currency_code', e.target.value)} required><option value="">Currency</option>{currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select>
                <select className={field} value={quote.data.lines[0].product_id} onChange={e => { const p = products.find(item => String(item.id) === e.target.value); quote.setData('lines', [{ ...quote.data.lines[0], product_id: e.target.value, description: p?.name ?? quote.data.lines[0].description }]); }}><option value="">No linked product</option>{products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select>
                <input className={field} placeholder="Line description" value={quote.data.lines[0].description} onChange={e => quote.setData('lines', [{ ...quote.data.lines[0], description: e.target.value }])} required />
                <input className={field} type="number" min="0.0001" step="0.0001" aria-label="Quantity" placeholder="Quantity" value={quote.data.lines[0].quantity} onChange={e => quote.setData('lines', [{ ...quote.data.lines[0], quantity: e.target.value }])} required />
                <input className={field} type="number" min="0" step="0.0001" aria-label="Unit price" placeholder="Unit price" value={quote.data.lines[0].unit_price} onChange={e => quote.setData('lines', [{ ...quote.data.lines[0], unit_price: e.target.value }])} required />
                <input className={field} type="number" min="0" max="100" step="0.01" aria-label="Discount percent" placeholder="Discount %" value={quote.data.lines[0].discount} onChange={e => quote.setData('lines', [{ ...quote.data.lines[0], discount: e.target.value }])} />
                <input className={field} type="number" min="0" max="100" step="0.01" aria-label="Tax rate" placeholder="Tax %" value={quote.data.lines[0].tax_rate} onChange={e => quote.setData('lines', [{ ...quote.data.lines[0], tax_rate: e.target.value }])} />
            </div><button className={button} disabled={quote.processing}>Save draft quotation</button></form>
        </div>}
        <section className={card}><h2 className="mb-3 font-semibold">Leads</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Name</th><th className="p-2">Contact</th><th className="p-2">Status</th><th className="p-2">Assigned to</th>{canManage && <th className="p-2">Action</th>}</tr></thead><tbody>{leads.data.map(item => <tr key={item.id} className="border-b"><td className="p-2 font-medium">{item.name}</td><td className="p-2">{item.contact_person ?? item.email ?? '—'}</td><td className="p-2 capitalize">{item.status.replace('_', ' ')}</td><td className="p-2">{item.assigned_to?.name ?? '—'}</td>{canManage && <td className="p-2">{item.status !== 'converted' && <form method="post" action={route('erp.sales.leads.convert', item.id)}><input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? ''} /><input type="hidden" name="title" value={`${item.name} opportunity`} /><button className="text-primary underline">Convert</button></form>}</td>}</tr>)}</tbody></table>{leads.data.length === 0 && <p className="p-4 text-sm text-muted-foreground">No leads yet.</p>}</div><div className="mt-3 flex gap-3 text-sm">{leads.links.map((link, index) => link.url ? <a key={index} className={link.active ? 'font-semibold text-primary' : 'text-muted-foreground'} href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} /> : null)}</div></section>
        <div className="grid gap-6 lg:grid-cols-2"><section className={card}><h2 className="mb-3 font-semibold">Opportunities</h2><Rows items={opportunities.map(x => ({ id: x.id, number: x.title, customer: x.customer?.name ?? '—', status: x.status, currency: '', total: x.expected_value }))} /></section>
        <section className={card}><h2 className="mb-3 font-semibold">Quotations</h2><Rows items={quotations.map(x => ({ id: x.id, number: x.document_number, customer: x.customer?.name ?? '—', status: x.status, currency: x.currency_code, total: x.total }))} />{canManage && quotations.filter(x => x.status === 'draft').map(x => <form key={x.id} className="mt-2 inline-block pr-3" method="post" action={route('erp.sales.quotations.submit', x.id)}><input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? ''} /><button className="text-primary underline">Submit {x.document_number}</button></form>)}{canManage && quotations.filter(x => x.status === 'approved').map(x => <form key={x.id} className="mt-2 inline-block pr-3" method="post" action={route('erp.sales.quotations.orders.store', x.id)}><input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? ''} /><button className="text-primary underline">Convert {x.document_number} to order</button></form>)}</section>
        <section className={`${card} lg:col-span-2`}><h2 className="mb-3 font-semibold">Sales orders</h2><Rows items={orders.map(x => ({ id: x.id, number: x.document_number, customer: x.customer?.name ?? '—', status: x.status, currency: x.currency_code, total: x.total }))} />{canManage && orders.filter(x => x.status === 'approved' && !x.invoice_id).map(x => <form key={x.id} className="mt-2 inline-block pr-3" method="post" action={route('erp.sales.orders.invoice', x.id)}><input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? ''} /><button className="text-primary underline">Create invoice for {x.document_number}</button></form>)}</section></div>
    </main>;
}

function Rows({ items }: { items: { id: number; number: string; customer: string; status: string; currency: string; total: string }[] }) {
    return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Reference</th><th className="p-2">Customer</th><th className="p-2">Status</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-b"><td className="p-2">{item.number}</td><td className="p-2">{item.customer}</td><td className="p-2 capitalize">{item.status.replace('_', ' ')}</td><td className="p-2 text-right">{item.currency} {item.total}</td></tr>)}</tbody></table>{items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing to show yet.</p>}</div>;
}
