import { useState, useEffect, useRef } from 'react';
import { usePage, Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Share2, Printer, Package, Calendar, DollarSign, Link2, User, Download } from 'lucide-react';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import { toast } from '@/components/custom-toast';
import { InvoicePaymentCopylinkModal } from '@/components/invoice-payment-copylink-modal';
import { useTranslation } from 'react-i18next';
import { NewYork, Toronto, Rio, London, Istanbul, Mumbai, HongKong, Tokyo, Sydney, Paris } from '../settings/components/invoice-templates';
import { useBrand } from '@/contexts/BrandContext';
import { THEME_COLORS } from '@/hooks/use-appearance';
import { usePdfDownload } from '@/hooks/usePdfDownload';

export default function InvoicePayment() {
    const { t } = useTranslation();
    const { invoice, enabledGateways, remainingAmount, company, favicon, appName, flash, invoiceSettings, paypalClientId, paystackPublicKey, flutterwavePublicKey, tapPublicKey } = usePage().props as any;
    const { themeColor, customColor, logoDark } = useBrand();
    const pdfTemplateRef = useRef<HTMLDivElement>(null);

    const [showGatewayModal, setShowGatewayModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState(remainingAmount || invoice.total_amount || 0);

    const primaryColor = themeColor === 'custom' ? customColor : THEME_COLORS[themeColor as keyof typeof THEME_COLORS];
    const showQr = invoiceSettings?.invoice_qr_display === 'true' || invoiceSettings?.invoice_qr_display === true;
    const footerTitle = invoiceSettings?.invoice_footer_title || '';
    const footerNotes = invoiceSettings?.invoice_footer_notes || '';
    const templateName = invoiceSettings?.invoice_template || 'default';

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment_success') === 'true') {
            toast.success('Payment processed successfully.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (flash?.success) {
                toast.success(flash.success);
            }
            if (flash?.error) {
                toast.error(flash.error);
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [flash]);

    const getPaymentMethodIcon = (gatewayId: string) => {
        const iconMap = {
            bank: <CreditCard className="h-5 w-5" />,
            stripe: <CreditCard className="h-5 w-5" />,
            paypal: <CreditCard className="h-5 w-5" />,
        };
        return iconMap[gatewayId] || <CreditCard className="h-5 w-5" />;
    };

    const gatewaysWithIcons = enabledGateways?.map(gateway => ({
        ...gateway,
        icon: getPaymentMethodIcon(gateway.id)
    })) || [];

    const formatAmount = (amount) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        const symbol = invoiceSettings?.currencySymbol || '$';
        const position = invoiceSettings?.currencySymbolPosition || 'before';
        const space = invoiceSettings?.currencySymbolSpace === '1' ? ' ' : '';
        const decimalPlaces = parseInt(invoiceSettings?.decimalFormat || '2');
        const decimalSep = invoiceSettings?.decimalSeparator || '.';
        const thousandSep = invoiceSettings?.thousandsSeparator || ',';
        const floatNumber = invoiceSettings?.floatNumber !== '0';

        const num = floatNumber ? numAmount : Math.floor(numAmount);
        const parts = num.toFixed(decimalPlaces).split('.');
        if (thousandSep !== 'none') {
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
        }
        const formatted = parts.join(decimalSep);
        return position === 'after' ? `${formatted}${space}${symbol}` : `${symbol}${space}${formatted}`;
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: t('Invoice {{number}}', { number: invoice.invoice_number }),
                    text: t('Invoice from {{company}}', { company: company.name }),
                    url: window.location.href
                });
            } catch (err) {
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success(t('Invoice link copied to clipboard!'));
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const getStatusColor = (status: string) => {
        const colors = {
            draft: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20',
            sent: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            viewed: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            paid: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            partial_paid: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            overdue: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            cancelled: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const renderCopyLinkView = () => {
        return (
            <div className="space-y-6">
                {/* Invoice Details Card */}
                <Card>
                    <CardContent className="p-4 md:p-12">
                        <div className="flex justify-between items-start mb-5">
                            <div className="text-xl tracking-tight">#{invoice.invoice_number}</div>
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-medium ${getStatusColor(invoice.status)}`}>
                                {invoice.status.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Col 1: From */}
                            <div className="space-y-3">
                                {invoice.project && (
                                    <div className="mb-5">
                                        <p className="text-sm font-medium mb-1">{t('Project')}</p>
                                        <p className="text-sm text-muted-foreground mb-1">{invoice.project.title}</p>
                                    </div>
                                )}
                                <p className="font-medium mb-3">{t('From')}</p>
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="font-bold text-sm leading-snug">{company?.name || '-'}</p>
                                        {company?.email && <p className="text-sm text-muted-foreground">{company.email}</p>}
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <div className="inline-flex items-center gap-1.5 text-sm">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                        <span className="font-medium">{t('Invoice Date')} :</span>
                                        <span className="text-muted-foreground">{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Col 2: Bill To */}
                            <div className="space-y-3">
                                {invoice.project && <div className="mb-4 invisible"><p className="text-sm mb-1">-</p><p className="text-sm font-medium">-</p></div>}
                                <p className="font-medium mb-4">{t('Bill To')}</p>
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="font-bold text-sm leading-snug">{invoice.client?.name || '-'}</p>
                                        {invoice.client?.email && <p className="text-sm text-muted-foreground">{invoice.client.email}</p>}
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <div className="inline-flex items-center gap-1.5 text-sm">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                        <span className="font-medium">{t('Due Date')} :</span>
                                        <span className={`text-muted-foreground ${invoice.is_overdue ? 'text-red-600' : ''}`}>
                                            {new Date(invoice.due_date).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Col 3: QR Code */}
                            <div className="flex flex-col items-start md:items-end">
                                {showQr && (
                                    <div className="flex flex-col items-center mt-4">
                                        <div className="p-3 rounded-xl border bg-white shadow-sm inline-block">
                                            <QRCodeGenerator
                                                value={window.location.href}
                                                size={130}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">{t('Scan for invoice details')}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Second row: description / notes / terms */}
                        {(invoice.description || invoice.notes || invoice.terms) && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                                {invoice.title && (
                                                <div>
                                                    <h3 className="text-sm font-medium mb-1">{t('Title')}</h3>
                                                    <div className="text-sm text-muted-foreground">{invoice.title}</div>
                                                </div>
                                            )}
                                    {invoice.description && (
                                        <div>
                                            <h3 className="text-sm font-medium mb-1">{t('Description')}</h3>
                                            <div className="text-sm text-muted-foreground">{invoice.description}</div>
                                        </div>
                                    )}
                                    {invoice.notes && (
                                        <div>
                                            <h3 className="text-sm font-medium mb-1">{t('Notes')}</h3>
                                            <div className="text-sm text-muted-foreground">{invoice.notes}</div>
                                        </div>
                                    )}
                                    {invoice.terms && (
                                        <div>
                                            <h3 className="text-sm font-medium mb-1">{t('Terms & Conditions')}</h3>
                                            <div className="text-sm text-muted-foreground">{invoice.terms}</div>
                                        </div>
                                    )}
                                </div>
                        )}
                    </CardContent>
                </Card>

                {/* Invoice Items */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl font-bold tracking-tight">
                            {t('Invoice Tasks')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr className="bg-[#F0F0F1] dark:bg-gray-900 border-t">
                                        <th className="px-4 py-3 text-left text-sm font-bold tracking-wide">{t('Task')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-bold tracking-wide">{t('Amount')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {invoice.items?.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-4">
                                                {item.task?.title && (
                                                    <div className="font-bold text-sm">{item.task.title}</div>
                                                )}
                                                {!item.task?.title && item.description && (
                                                    <div className="font-bold text-sm">{item.description}</div>
                                                )}
                                                {item.task?.description && (
                                                    <div className="text-sm text-muted-foreground mt-1">{item.task.description}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right font-bold text-base font-mono">
                                                {formatAmount(item.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <div className="w-full max-w-sm space-y-3 bg-muted/50 rounded-lg p-5 shadow-sm border border-muted/50">
                                <div className="flex justify-between text-base">
                                    <span className="font-semibold">{t('Subtotal')}</span>
                                    <span className="font-bold font-mono">{formatAmount(invoice.subtotal || invoice.total_amount)}</span>
                                </div>
                                {invoice.tax_rate && Array.isArray(invoice.tax_rate) && invoice.tax_rate.length > 0 && (
                                    invoice.tax_rate.map((tax: any, index: number) => {
                                        const taxAmount = (invoice.subtotal * tax.rate) / 100;
                                        return (
                                            <div key={index} className="flex justify-between text-base">
                                                <span className="text-muted-foreground font-semibold">{tax.name} ({tax.rate}%)</span>
                                                <span className="font-bold font-mono">{formatAmount(taxAmount)}</span>
                                            </div>
                                        );
                                    })
                                )}
                                <Separator className="my-2" />
                                <div className="flex justify-between">
                                    <span className="font-bold text-base">{t('Total Amount')}</span>
                                    <span className="font-bold text-base tracking-tight font-mono">{formatAmount(invoice.total_amount)}</span>
                                </div>
                                {invoice.paid_amount > 0 && (
                                    <div className="flex justify-between text-base">
                                        <span className="text-muted-foreground font-semibold">{t('Paid Amount')}</span>
                                        <span className="font-bold text-green-600 font-mono">{formatAmount(invoice.total_amount - remainingAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="font-bold text-base">{t('Balance Due')}</span>
                                    <span className={`font-bold text-base tracking-tight font-mono ${
                                                    invoice.balance_due <= 0 ? 'text-green-600' :
                                                    invoice.status === 'partial_paid' ? 'text-orange-500' :
                                                    'text-red-600'
                                                }`}>{formatAmount(remainingAmount)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment History */}
                {invoice.payments && invoice.payments.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl font-bold tracking-tight">
                                {t('Payment History')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead>
                                        <tr className="bg-[#F0F0F1] dark:bg-gray-900 border-t">
                                            <th className="px-4 py-3 text-left text-sm font-bold tracking-wide">{t('Date')}</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold tracking-wide">{t('Method')}</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold tracking-wide">{t('Type')}</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold tracking-wide">{t('Amount')}</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold tracking-wide">{t('Status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {invoice.payments.map((payment: any, index: number) => (
                                            <tr key={index}>
                                                <td className="px-4 py-4 text-sm">
                                                    {new Date(payment.processed_at || payment.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-4 text-sm capitalize">{payment.payment_method}</td>
                                                <td className="px-4 py-4 text-sm">
                                                    {invoice.status?.replace(/_/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-semibold font-mono">
                                                    {formatAmount(payment.amount)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                        payment.status === 'completed' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                                                        payment.status === 'pending' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20' :
                                                        'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                                                    }`}>
                                                        {payment.status?.replace('_', ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    return (
        <>
            <Head title={`Invoice - ${company?.name || 'Team Truth'}`}>
                {favicon && <link rel="icon" type="image/x-icon" href={favicon} />}
                <style>{`
                    @media print {
                        @page { margin: 0.5in; }
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                        a[href]::after { content: none !important; }
                    }
                `}</style>
            </Head>
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center mb-6 print:hidden">
                        <div>
                            <h1 className="text-2xl font-bold">{t('Invoice Details')}</h1>
                            <p className="text-sm text-gray-500">{t('View and manage your invoice')}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handlePrint} style={{ backgroundColor: primaryColor }} className="hover:opacity-90" size="sm">
                                <Printer className="h-4 w-4 mr-2" />
                                {t('Print Invoice')}
                            </Button>
                            <Button 
                                onClick={() => {
                                    window.open(route('invoices.payment.preview', invoice.payment_token), '_blank');
                                }} 
                                style={{ backgroundColor: primaryColor }} 
                                className="hover:opacity-90" 
                                size="sm"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                {t('Download PDF')}
                            </Button>
                            {remainingAmount > 0 && (
                                <Button onClick={() => setShowGatewayModal(true)} style={{ backgroundColor: primaryColor }} className="hover:opacity-90" size="sm">
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    {t('Pay Remaining')} (<span className="font-mono">{formatAmount(remainingAmount)}</span>)
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="print:hidden">
                        {renderCopyLinkView()}
                    </div>

                    <div className="hidden print:block">
                        {(() => {
                            const invoiceColor = invoiceSettings?.invoice_color || '#ffffff';
                            const companyLogo = (invoiceSettings?.invoice_logo && invoiceSettings.invoice_logo.trim() !== '') ? invoiceSettings.invoice_logo : logoDark;
                            const templateProps = {
                                invoice,
                                color: invoiceColor,
                                showQr,
                                invoiceUrl: window.location.href,
                                footerTitle,
                                footerNotes,
                                remainingAmount,
                                formatAmount,
                                t,
                                companyLogo
                            };

                            switch(templateName?.toLowerCase()) {
                                case 'new_york': return <NewYork {...templateProps} />;
                                case 'toronto': return <Toronto {...templateProps} />;
                                case 'rio': return <Rio {...templateProps} />;
                                case 'istanbul': return <Istanbul {...templateProps} />;
                                case 'mumbai': return <Mumbai {...templateProps} />;
                                case 'hong_kong': return <HongKong {...templateProps} />;
                                case 'tokyo': return <Tokyo {...templateProps} />;
                                case 'sydney': return <Sydney {...templateProps} />;
                                case 'paris': return <Paris {...templateProps} />;
                                case 'london':
                                default:
                                    return <London {...templateProps} />;
                            }
                        })()}
                    </div>

                    {/* PDF Generation Container (rendered offscreen so html2canvas can capture it) */}
                    <div ref={pdfTemplateRef} style={{ position: 'absolute', left: '-9999px', top: '0', width: '900px', background: '#ffffff' }}>
                        {(() => {
                            const invoiceColor = invoiceSettings?.invoice_color || '#ffffff';
                            const companyLogo = (invoiceSettings?.invoice_logo && invoiceSettings.invoice_logo.trim() !== '') ? invoiceSettings.invoice_logo : logoDark;
                            const templateProps = {
                                invoice,
                                color: invoiceColor,
                                showQr,
                                invoiceUrl: window.location.href,
                                footerTitle,
                                footerNotes,
                                remainingAmount,
                                formatAmount,
                                t,
                                companyLogo
                            };

                            switch(templateName?.toLowerCase()) {
                                case 'new_york': return <NewYork {...templateProps} />;
                                case 'toronto': return <Toronto {...templateProps} />;
                                case 'rio': return <Rio {...templateProps} />;
                                case 'istanbul': return <Istanbul {...templateProps} />;
                                case 'mumbai': return <Mumbai {...templateProps} />;
                                case 'hong_kong': return <HongKong {...templateProps} />;
                                case 'tokyo': return <Tokyo {...templateProps} />;
                                case 'sydney': return <Sydney {...templateProps} />;
                                case 'paris': return <Paris {...templateProps} />;
                                case 'london':
                                default:
                                    return <London {...templateProps} />;
                            }
                        })()}
                    </div>

                    <InvoicePaymentCopylinkModal
                        isOpen={showGatewayModal}
                        onClose={() => setShowGatewayModal(false)}
                        invoice={invoice}
                        remainingAmount={remainingAmount}
                        paymentAmount={paymentAmount}
                        onPaymentAmountChange={setPaymentAmount}
                        gateways={gatewaysWithIcons}
                        paypalClientId={paypalClientId}
                        paystackPublicKey={paystackPublicKey}
                        flutterwavePublicKey={flutterwavePublicKey}
                    />
                </div>
            </div>
        </>
    );
}
