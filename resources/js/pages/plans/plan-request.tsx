import { PageTemplate } from '@/components/page-template';
import { CrudTable } from '@/components/CrudTable';
import { planRequestsConfig } from '@/config/crud/plan-requests';
import { useEffect, useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getImagePath } from '@/utils/helpers';

export default function PlanRequestsPage() {
  const { t } = useTranslation();
  const { flash, planRequests, filters: pageFilters = {}, auth, isMyRequests = false } = usePage().props as any;
  const permissions = auth?.permissions || [];
  const userRole = auth.user?.type || auth.user?.role;
  
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [filterValues, setFilterValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    planRequestsConfig.filters?.forEach(filter => {
      initial[filter.key] = pageFilters[filter.key] || 'all';
    });
    return initial;
  });
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    const isDemo = (window as any).isDemo || false;
    if (flash?.success && !isDemo) {
      toast.success(flash.success);
    }
    if (flash?.error) {
      toast.error(flash.error);
    }
  }, [flash]);

  useEffect(() => {
    const initialFilters: Record<string, any> = {};
    planRequestsConfig.filters?.forEach(filter => {
      initialFilters[filter.key] = pageFilters[filter.key] || 'all';
    });
    setFilterValues(initialFilters);
  }, []);

  const handleAction = (action: string, item: any) => {
    const isDemo = (window as any).isDemo || false;
    if (action === 'approve') {
      router.post(route("plan-requests.approve", item.id), {}, {
        onError: () => {
          toast.error(t('Failed to approve plan request'));
        }
      });
    } else if (action === 'reject') {
      router.post(route("plan-requests.reject", item.id), {}, {
        onError: () => {
          toast.error(t('Failed to reject plan request'));
        }
      });
    } else if (action === 'cancel') {
      router.delete(route("my-plan-requests.cancel", item.id), {
        onError: () => {
          toast.error(t('Failed to cancel plan request'));
        }
      });
    } else if (action === 'delete') {
      router.delete(route("plan-requests.destroy", item.id), {
        onError: () => {
          toast.error(t('Failed to delete plan request'));
        }
      });
    }
  };

  const routeName = isMyRequests ? 'my-plan-requests.index' : 'plan-requests.index';

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

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
    router.get(route(routeName), buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: false, preserveScroll: false });
  };

  const handleResetFilters = () => {
    const resetFilters: Record<string, any> = {};
    planRequestsConfig.filters?.forEach(filter => {
      resetFilters[filter.key] = 'all';
    });
    setFilterValues(resetFilters);
    setSearchTerm('');
    const params: any = { page: 1 };
    if (pageFilters.per_page) params.per_page = pageFilters.per_page;
    router.get(route(routeName), params, { preserveState: false, preserveScroll: false });
  };

  // Render sort icon function like in CrudTable
  const renderSortIcon = (column: any) => {
    if (!column.sortable) return null;

    if (pageFilters.sort_field === column.key) {
      return pageFilters.sort_direction === 'asc' ?
        <ChevronUp className="ml-1 h-4 w-4" /> :
        <ChevronDown className="ml-1 h-4 w-4" />;
    }

    // Always show the double arrow for sortable columns when not sorted
    return <ChevronsUpDown className="ml-1 h-4 w-4 opacity-50" />;
  };

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Plans'), href: route('plans.index')},
    { title: t('Plan Requests') }
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

  const getTableActions = () => {
    if (isMyRequests || userRole !== 'superadmin') {
      return [];
    } else {
      return [
        {
          label: t('Approve'),
          icon: 'Check',
          action: 'approve',
          className: 'text-gray-500',
          condition: (item: any) => item.status === 'pending'
        },
        {
          label: t('Reject'),
          icon: 'X',
          action: 'reject',
          className: 'text-gray-500',
          condition: (item: any) => item.status === 'pending'
        },
        {
          label: t('Delete'),
          icon: 'Trash2',
          action: 'delete',
          className: 'text-gray-500',
          condition: (item: any) => item.status === 'cancelled'
        }
      ];
    }
  };

  const filteredActions = getTableActions();

  const customColumns = planRequestsConfig.table.columns.map(col => {
    if (col.key === 'user.name') {
      return {
        ...col,
        label: t('Company'),
        render: (_, row) => {
          const avatarUrl = row.user.avatar;
          return (
            <div className="flex items-center gap-3">
              <img
                src={avatarUrl}
                alt={row.user?.name || 'User'}
                className="h-10 w-10 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = getImagePath('users/avatar.png');
                }}
              />
              <div>
                <div className="font-medium">{row.user?.name || '-'}</div>
                <div className="text-xs text-gray-500">{row.user?.email || ''}</div>
              </div>
            </div>
          );
        }
      };
    } else if (col.key === 'plan.name') {
      return {
        ...col,
        label: t(col.label),
        render: (_, row) => {
          const planName = row.plan?.name;
          if (!planName) return '-';

          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 capitalize">
                {planName}
            </span>
          );
        }
      };
    } else if (col.key === 'status') {
      return {
        ...col,
        label: t(col.label),
        render: (value) => {
          const statusColors: Record<string, string> = {
            pending:  'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
            approved: 'bg-green-50 text-green-700 ring-green-600/20',
            rejected: 'bg-red-50 text-red-700 ring-red-600/20'
          };
          return (
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset capitalize ${statusColors[value] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
              {t(value)}
            </span>
          );
        }
      };
    } else {
      return {
        ...col,
        label: t(col.label)
      };
    }
  });

  return (
    <PageTemplate 
      title={t('Plan Requests')} 
      description={isMyRequests ? t('View your plan requests.') : t('View and manage all plan requests from companies.')}
      url="/plan-requests"
      breadcrumbs={breadcrumbs}
      noPadding
    >
      <div className="bg-white rounded-lg border shadow mb-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          searchPlaceholder={t('Search plan requests...')}
          filters={planRequestsConfig.filters?.map(filter => ({
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
          columns={customColumns}
          actions={filteredActions}
          data={planRequests?.data || []}
          from={planRequests?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          entityPermissions={planRequestsConfig.entity.permissions}
        />

        <Pagination
          from={planRequests?.from || 0}
          to={planRequests?.to || 0}
          total={planRequests?.total || 0}
          links={planRequests?.links}
          entityName={t('plan requests')}
          currentPerPage={pageFilters.per_page?.toString() || '10'}
          onPerPageChange={(value) => router.get(route(routeName), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false })}
          onPageChange={(url) => {
            const pageNum = new URL(url).searchParams.get('page');
            router.get(route(routeName), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
          }}
        />
      </div>
    </PageTemplate>
  );
}
