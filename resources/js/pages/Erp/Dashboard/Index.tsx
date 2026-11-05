import { route } from 'ziggy-js';

type Props = {
    company: {
        id: number;
        name: string;
    };
};

export default function Index({ company }: Props) {
    return (
        <main className="p-6">
            <h1 className="text-2xl font-semibold">{company.name} ERP</h1>
            <p className="text-muted-foreground mt-2 text-sm">The ERP foundation is ready for its first module.</p>
            <a className="text-primary mt-4 inline-block text-sm font-medium underline" href={route('erp.companies.index')}>
                Manage companies
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.companies.members.index')}>
                Manage company members
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.settings.branding.edit')}>
                Company details and branding
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.settings.exchange-rates.index')}>
                Manage exchange rates
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.settings.signatories.index')}>
                Manage signatories
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.approvals.workflows.index')}>
                Configure approval workflows
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.approvals.index')}>
                My approvals
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.requisitions.index')}>
                Requisitions
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.inventory.setup')}>
                Inventory setup
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.inventory.stock.index')}>
                Stock on hand and movements
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.purchase.index')}>
                Vendors and purchasing
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.accounting.index')}>
                Accounting ledger
            </a>
            <br />
            <a className="text-primary mt-2 inline-block text-sm font-medium underline" href={route('erp.documents.sample')}>
                Download branded PDF sample
            </a>
        </main>
    );
}
