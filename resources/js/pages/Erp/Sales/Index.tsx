import { Link, useForm } from '@inertiajs/react';
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

export default function SalesIndex({ leads, opportunities, quotations, orders, canManage }: Props) {
    const lead = useForm({ name: '', contact_person: '', email: '', phone: '', source: '' });
    const createLead = (event: FormEvent) => { event.preventDefault(); lead.post(route('erp.sales.leads.store'), { onSuccess: () => lead.reset() }); };

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
            <section className={`${card} space-y-3`}><h2 className="font-semibold">Quotations</h2><p className="text-sm text-muted-foreground">Build a quotation with as many lines as you need, send it for approval, then email the PDF to the customer.</p><div className="flex flex-wrap gap-2"><Link href={route('erp.sales.quotations.create')} className={button}>New quotation</Link><Link href={route('erp.sales.quotations.index')} className="min-h-10 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-primary/10">All quotations</Link></div></section>
        </div>}
        <section className={card}><h2 className="mb-3 font-semibold">Leads</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Name</th><th className="p-2">Contact</th><th className="p-2">Status</th><th className="p-2">Assigned to</th>{canManage && <th className="p-2">Action</th>}</tr></thead><tbody>{leads.data.map(item => <tr key={item.id} className="border-b"><td className="p-2 font-medium">{item.name}</td><td className="p-2">{item.contact_person ?? item.email ?? '—'}</td><td className="p-2 capitalize">{item.status.replace('_', ' ')}</td><td className="p-2">{item.assigned_to?.name ?? '—'}</td>{canManage && <td className="p-2">{item.status !== 'converted' && <form method="post" action={route('erp.sales.leads.convert', item.id)}><input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? ''} /><input type="hidden" name="title" value={`${item.name} opportunity`} /><button className="text-primary underline">Convert</button></form>}</td>}</tr>)}</tbody></table>{leads.data.length === 0 && <p className="p-4 text-sm text-muted-foreground">No leads yet.</p>}</div><div className="mt-3 flex gap-3 text-sm">{leads.links.map((link, index) => link.url ? <a key={index} className={link.active ? 'font-semibold text-primary' : 'text-muted-foreground'} href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} /> : null)}</div></section>
        <div className="grid gap-6 lg:grid-cols-2"><section className={card}><h2 className="mb-3 font-semibold">Opportunities</h2><Rows items={opportunities.map(x => ({ id: x.id, number: x.title, customer: x.customer?.name ?? '—', status: x.status, currency: '', total: x.expected_value }))} /></section>
        <section className={card}><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">Recent quotations</h2><Link href={route('erp.sales.quotations.index')} className="text-sm text-primary hover:underline">View all</Link></div><Rows items={quotations.map(x => ({ id: x.id, number: x.document_number, customer: x.customer?.name ?? '—', status: x.status, currency: x.currency_code, total: x.total, href: route('erp.sales.quotations.show', x.id) }))} /></section>
        <section className={`${card} lg:col-span-2`}><h2 className="mb-3 font-semibold">Sales orders</h2><Rows items={orders.map(x => ({ id: x.id, number: x.document_number, customer: x.customer?.name ?? '—', status: x.status, currency: x.currency_code, total: x.total }))} />{canManage && orders.filter(x => x.status === 'approved' && !x.invoice_id).map(x => <form key={x.id} className="mt-2 inline-block pr-3" method="post" action={route('erp.sales.orders.invoice', x.id)}><input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? ''} /><button className="text-primary underline">Create invoice for {x.document_number}</button></form>)}</section></div>
    </main>;
}

function Rows({ items }: { items: { id: number; number: string; customer: string; status: string; currency: string; total: string; href?: string }[] }) {
    return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Reference</th><th className="p-2">Customer</th><th className="p-2">Status</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-b"><td className="p-2">{item.href ? <Link href={item.href} className="font-medium hover:underline">{item.number}</Link> : item.number}</td><td className="p-2">{item.customer}</td><td className="p-2 capitalize">{item.status.replace('_', ' ')}</td><td className="p-2 text-right">{item.currency} {item.total}</td></tr>)}</tbody></table>{items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing to show yet.</p>}</div>;
}
