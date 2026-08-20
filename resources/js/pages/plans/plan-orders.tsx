import { PageTemplate } from '@/components/page-template';
import { CrudTable } from '@/components/CrudTable';
import { planOrdersConfig } from '@/config/crud/plan-orders';
import { useEffect, useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getImagePath } from '@/utils/helpers';
import ViewPopup from './view';

export default function PlanOrdersPage() {
  const { t } = useTranslation();
  const { flash, planOrders, filters: pageFilters = {}, auth, isMyOrders = false } = usePage().props as any;
  const permissions = auth?.permissions || [];
  const userRole = auth.user?.type || auth.user?.role;
  
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [filterValues, setFilterValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    planOrdersConfig.filters?.forEach(filter => {
      initial[filter.key] = pageFilters[filter.key] || 'all';
    });
    return initial;
  });
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingOrder, setRejectingOrder] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success);
    }
    if (flash?.error) {
      toast.error(flash.error);
    }
  }, [flash]);

  const handleAction = (action: string, item: any) => {
    if (action === 'approve') {
      router.post(route("plan-orders.approve", item.id), {}, {
        onError: () => {
          toast.error(t('Failed to approve plan order'));
        }
      });
    } else if (action === 'reject') {
      setRejectingOrder(item);
      setShowRejectModal(true);
    } else if (action === 'view_details') {
      setSelectedOrder(item);
      setShowDetailsModal(true);
    }
  };

  const routeName = isMyOrders ? 'my-plan-orders.index' : 'plan-orders.index';

  const buildParams = (
    overrides: Record<string, any> = {},
    filterOverrides: Record<string, any> = {}
  ) => {
    const params: any = { page: 1 };
    if (searchTerm) params.search = searchTerm;
    const merged = { ...filterValues, ...filterOverrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v && v !== 'all' && v !== '') params[k] = v;
    });
    if (pageFilters.per_page) params.per_page = pageFilters.per_page;
    if (pageFilters.sort_field) params.sort_field = pageFilters.sort_field;
    if (pageFilters.sort_direction) params.sort_direction = pageFilters.sort_direction;
    return { ...params, ...overrides };
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.get(route(routeName), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
  };

  const applyFilters = () => {
    router.get(route(routeName), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
  };

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filterValues, [key]: value };
    setFilterValues(newFilters);
    router.get(route(routeName), buildParams({ page: 1 }, { [key]: value }), { preserveState: false, preserveScroll: false });
  };

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Plans'), href: route('plans.index') },
    { title: t('Plan Orders') }
  ];

  const hasActiveFilters = () => {
    return Object.entries(filterValues).some(([key, value]) => {
      return value && value !== 'all' && value !== '';
    }) || searchTerm !== '';
  };

  const activeFilterCount = () => {
    return Object.entries(filterValues).filter(([key, value]) => {
      return value && value !== 'all' && value !== '';
    }).length + (searchTerm ? 1 : 0);
  };

  const handleResetFilters = () => {
    const resetFilters: Record<string, any> = {};
    planOrdersConfig.filters?.forEach(filter => {
      resetFilters[filter.key] = 'all';
    });
    setFilterValues(resetFilters);
    setSearchTerm('');
    const params: any = { page: 1 };
    if (pageFilters.per_page) params.per_page = pageFilters.per_page;
    router.get(route(routeName), params, { preserveState: false, preserveScroll: false });
  };

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
    router.get(route(routeName), buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: false, preserveScroll: false });
  };

  const viewAction = {
    label: t('View'),
    icon: 'Eye',
    action: 'view_details',
    className: 'text-gray-500',
    requiredPermission: null,
    condition: (row: any) => true, // show view action
  };

  // Remove actions for company users viewing their own orders
  const filteredActions = (isMyOrders || userRole !== 'superadmin')
    ? [] 
    : [
        viewAction,
        ...(planOrdersConfig.table.actions?.map(action => ({
          ...action,
          label: t(action.label)
        })))
      ];

  const columns = [
    {
      key: 'order_number',
      label: t('Order Number'),
      sortable: true,
      render: (value: any) => value || '-',
    },
    {
      key: 'user.name',
      label: t('Name'),
      render: (_: any, row: any) => {
        const avatarUrl = row.user?.avatar ? getImagePath(row.user.avatar) : getImagePath('avatars/avatar.png');
        return (
          <div className="flex items-center gap-3">
            <img src={avatarUrl} className="h-10 w-10 rounded-full object-cover" />
            <div>
              <div className="font-medium">{row.user?.name || '-'}</div>
              <div className="text-xs text-gray-500">{row.user?.email || ''}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'plan.name',
      label: t('Plan'),
      render: (_: any, row: any) => {
        const planName = row.plan?.name;
        if (!planName) return <span>-</span>;
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 capitalize">
            {planName}
          </span>
        );
      },
    },
    {
      key: 'original_price',
      label: t('Original Price'),
      render: (value: any) => (
        <span className="font-mono">
          {window.appSettings?.formatCurrency
            ? window.appSettings.formatCurrency(parseFloat(value))
            : parseFloat(value || 0).toFixed(2)}
        </span>
      ),
    },
    {
  key: 'discount_amount',
  label: t('Discount'),
  render: (value: any) =>
    value > 0 ? (
      <span className="font-mono">
        -{window.appSettings?.formatCurrency
          ? window.appSettings.formatCurrency(parseFloat(value))
          : parseFloat(value).toFixed(2)}
      </span>
    ) : (
      '-'
    ),
},
    {
  key: 'final_price',
  label: t('Final Price'),
  sortable: true,
  render: (value: any) => (
    <span className="font-mono">
      {window.appSettings?.formatCurrency
        ? window.appSettings.formatCurrency(parseFloat(value))
        : parseFloat(value || 0).toFixed(2)}
    </span>
  ),
},
    {
      key: 'status',
      label: t('Status'),
      render: (value: any) => {
        const statusColors: Record<string, string> = {
          pending:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
          approved:  'bg-green-50 text-green-700 ring-green-600/20',
          rejected:  'bg-red-50 text-red-700 ring-red-600/20',
          cancelled: 'bg-orange-50 text-orange-700 ring-orange-600/20',
        };
        return (
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset capitalize ${statusColors[value] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
            {t(value)}
          </span>
        );
      },
    },
    {
      key: 'receipt_url',
      label: t('Receipt'),
      render: (value: any) => {
        if (!value) return '-';
        return (
          <button
            type="button"
            onClick={() => window.open(value, '_blank')}
            className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
            title={t('View receipt')}
          >
            <FileText className="h-4 w-4" />
          </button>
        );
      }
    },
    {
      key: 'ordered_at',
      label: t('Order Date'),
      sortable: true,
      render: (value: any) =>  value ? (
      <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
        <Calendar className="h-3.5 w-3.5" />
        <span className="text-sm">
          {window.appSettings?.formatDateTime
            ? window.appSettings.formatDateTime(value, false)
            : new Date(value).toLocaleDateString()}
        </span>
      </div>
    ) : (
      <span>-</span>
    ),
    },
  ];

  return (
    <PageTemplate 
      title={t('Plan Orders')} 
      description={isMyOrders ? t('View your plan orders.') : t('View and manage all plan orders from companies.')}
      url="/plan-orders"
      breadcrumbs={breadcrumbs}
      noPadding
    >
      <div className="bg-white rounded-lg border shadow mb-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          searchPlaceholder={t('Search plan orders...')}
          filters={planOrdersConfig.filters?.map(filter => ({
            name: filter.key,
            label: t(filter.label),
            type: 'select' as const,
            value: filterValues[filter.key] || 'all',
            onChange: (value: any) => handleFilterChange(filter.key, value),
            options: filter.options?.map(opt => ({ value: opt.value, label: t(opt.label) })) || []
          })) || []}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={columns}
          actions={filteredActions}
          data={planOrders?.data || []}
          from={planOrders?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          entityPermissions={planOrdersConfig.entity.permissions}
        />

        <Pagination
          from={planOrders?.from || 0}
          to={planOrders?.to || 0}
          total={planOrders?.total || 0}
          links={planOrders?.links}
          entityName={t('plan orders')}
          currentPerPage={pageFilters.per_page?.toString() || '10'}
          onPerPageChange={(value) => router.get(route(routeName), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false })}
          onPageChange={(url) => {
            const pageNum = new URL(url).searchParams.get('page');
            router.get(route(routeName), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
          }}
        />
      </div>

      {/* Order Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        {selectedOrder && <ViewPopup record={selectedOrder} />}
      </Dialog>

      {/* Reject Order Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Reject Plan Order')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">{t('Rejection reason (optional):')}</Label>
              <Textarea
                id="rejection-reason"
                placeholder={t('Enter rejection reason...')}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectModal(false);
              setRejectingOrder(null);
              setRejectionReason('');
            }}>
              {t('Cancel')}
            </Button>
            <Button variant="destructive" onClick={() => {
              if (rejectingOrder) {
                router.post(route("plan-orders.reject", rejectingOrder.id), { notes: rejectionReason }, {
                  onSuccess: () => {
                    setShowRejectModal(false);
                    setRejectingOrder(null);
                    setRejectionReason('');
                  },
                  onError: () => {
                    toast.error(t('Failed to reject plan order'));
                  }
                });
              }
            }}>
              {t('Reject Order')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTemplate>
  );
}