// pages/companies/index.tsx
import { useState, useEffect } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog } from '@/components/ui/dialog';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Plus, Edit, Trash2, KeyRound, Lock, Unlock, LayoutGrid, List, Calendar, ExternalLink, Info, ArrowUpRight, CreditCard, Download, Upload, History } from 'lucide-react';
import { CrudTable } from '@/components/CrudTable';
import { toast } from '@/components/custom-toast';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '@/components/ui/date-picker';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { UpgradePlanModal } from '@/components/UpgradePlanModal';
import { ImportModal } from '@/components/ImportModal';
import ViewPopup from './view';

export default function Companies() {
  const { t } = useTranslation();
  const { auth, companies, plans, filters: pageFilters = {}, isSaasMode = true, flash } = usePage().props as any;
  const permissions = auth?.permissions || [];
  const getInitials = useInitials();
  
  // State
  const [activeView, setActiveView] = useState(pageFilters.view || 'list');
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [startDate, setStartDate] = useState<Date | undefined>(pageFilters.start_date ? new Date(pageFilters.start_date) : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(pageFilters.end_date ? new Date(pageFilters.end_date) : undefined);
  const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
  const [showFilters, setShowFilters] = useState(false);
  const [pageInitialState, setPageInitialState] = useState(true);

  useEffect(() => {
    if (!pageInitialState) applyFilters();
    setPageInitialState(false);
  }, [selectedStatus, startDate, endDate]);
  
  // Sync activeView with URL parameter when pageFilters change
  useEffect(() => {
    if (pageFilters.view && pageFilters.view !== activeView) {
      setActiveView(pageFilters.view);
    }
  }, [pageFilters.view]);
  
  // Modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isUpgradePlanModalOpen, setIsUpgradePlanModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  
  // Handle flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success);
    }
    if (flash?.error) {
      toast.error(flash.error);
    }
  }, [flash]);
  
  // Check if any filters are active
  const hasActiveFilters = () => {
    return selectedStatus !== 'all' || searchTerm !== '' || startDate !== undefined || endDate !== undefined;
  };
  
  // Count active filters
  const activeFilterCount = () => {
    return (selectedStatus !== 'all' ? 1 : 0) + 
           (searchTerm ? 1 : 0) + 
           (startDate ? 1 : 0) + 
           (endDate ? 1 : 0);
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };
  
  const applyFilters = () => {
    const params: any = { page: 1, view: activeView };
    
    if (searchTerm) {
      params.search = searchTerm;
    }
    
    if (selectedStatus !== 'all') {
      params.status = selectedStatus;
    }
    
    if (startDate) {
      params.start_date = startDate.toISOString().split('T')[0];
    }
    
    if (endDate) {
      params.end_date = endDate.toISOString().split('T')[0];
    }
    
    // Add per_page if it exists
    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page;
    }
    
    router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true });
  };
  
  const handleDateFilter = (type: 'start' | 'end', date: Date | undefined) => {
    if (type === 'start') {
      setStartDate(date);
    } else {
      setEndDate(date);
    }
    
    const params: any = { page: 1, view: activeView };
    
    if (searchTerm) {
      params.search = searchTerm;
    }
    
    if (selectedStatus !== 'all') {
      params.status = selectedStatus;
    }
    
    if (type === 'start' && date) {
      params.start_date = date.toISOString().split('T')[0];
    } else if (type === 'start' && !date) {
      // Remove start_date if date is cleared
    } else if (startDate) {
      params.start_date = startDate.toISOString().split('T')[0];
    }
    
    if (type === 'end' && date) {
      params.end_date = date.toISOString().split('T')[0];
    } else if (type === 'end' && !date) {
      // Remove end_date if date is cleared
    } else if (endDate) {
      params.end_date = endDate.toISOString().split('T')[0];
    }
    
    // Add per_page if it exists
    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page;
    }
    
    router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true });
  };
  
  const handleStatusFilter = (value: string) => {
    setSelectedStatus(value);
    
    const params: any = { page: 1, view: activeView };
    
    if (searchTerm) {
      params.search = searchTerm;
    }
    
    if (value !== 'all') {
      params.status = value;
    }
    
    if (startDate) {
      params.start_date = startDate.toISOString().split('T')[0];
    }
    
    if (endDate) {
      params.end_date = endDate.toISOString().split('T')[0];
    }
    
    // Add per_page if it exists
    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page;
    }
    
    router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true });
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
  
  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
    
    const params: any = { 
      sort_field: field, 
      sort_direction: direction, 
      page: 1,
      view: activeView
    };
    
    // Add search and filters
    if (searchTerm) {
      params.search = searchTerm;
    }
    
    if (selectedStatus !== 'all') {
      params.status = selectedStatus;
    }
    
    if (startDate) {
      params.start_date = startDate.toISOString().split('T')[0];
    }
    
    if (endDate) {
      params.end_date = endDate.toISOString().split('T')[0];
    }
    
    // Add per_page if it exists
    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page;
    }
    
    router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true });
  };
  
  const handleAction = (action: string, company: any) => {
    setCurrentCompany(company);
    
    switch (action) {
      case 'login-as':
        router.get(route("impersonate.start", company.id));
        break;
      case 'company-info':
        setIsViewModalOpen(true);
        break;
      case 'upgrade-plan':
        handleUpgradePlan(company);
        break;
      case 'plan-requests':
        if (permissions.includes('view-plan-requests')) {
          router.get(route('companies.plan-requests', company.id));
        }
        break;
      case 'plan-orders':
        if (permissions.includes('view-plan-orders')) {
          router.get(route('companies.plan-orders', company.id));
        }
        break;
      case 'reset-password':
        setIsResetPasswordModalOpen(true);
        break;
      case 'toggle-status':
        handleToggleStatus(company);
        break;
      case 'edit':
        setFormMode('edit');
        setIsFormModalOpen(true);
        break;
      case 'delete':
        setIsDeleteModalOpen(true);
        break;
      default:
        break;
    }
  };
  
  const handleAddNew = () => {
    setCurrentCompany(null);
    setFormMode('create');
    setIsFormModalOpen(true);
  };
  
  const handleFormSubmit = (formData: any) => {
    if (formMode === 'create') {
      toast.loading(t('Creating company...'));
      
      router.post(route('companies.store'), formData, {
        onSuccess: () => {
          setIsFormModalOpen(false);
          toast.dismiss();
          // if (flash?.success) {
          //   toast.success(flash.success);
          // }
        },
        onError: (errors) => {
          toast.dismiss();
          if (flash?.error) {
            toast.error(flash.error);
          } else {
            toast.error(t('Failed to create company') + `: ${Object.values(errors).join(', ')}`);
          }
        }
      });
    } else if (formMode === 'edit') {
      toast.loading(t('Updating company...'));
      
      router.put(route('companies.update', currentCompany.id), formData, {
        onSuccess: () => {
          setIsFormModalOpen(false);
          toast.dismiss();
          if (flash?.success) {
            toast.success(flash.success);
          }
        },
        onError: (errors) => {
          toast.dismiss();
          if (flash?.error) {
            toast.error(flash.error);
          } else {
            toast.error(t('Failed to update company') + `: ${Object.values(errors).join(', ')}`);
          }
        }
      });
    }
  };
  
  const handleDeleteConfirm = () => {
    toast.loading(t('Deleting company...'));
    
    router.delete(route("companies.destroy", currentCompany.id), {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
        if (flash?.success) {
          toast.success(flash.success);
        }
      },
      onError: (errors) => {
        toast.dismiss();
        if (flash?.error) {
          toast.error(flash.error);
        } else {
          toast.error(t('Failed to delete company') + `: ${Object.values(errors).join(', ')}`);
        }
      }
    });
  };
  
  const handleResetPasswordConfirm = (data: { password: string }) => {
    toast.loading(t('Resetting password...'));
    
    router.put(route('companies.reset-password', currentCompany.id), data, {
      onSuccess: () => {
        setIsResetPasswordModalOpen(false);
        toast.dismiss();
        if (flash?.success) {
          toast.success(flash.success);
        }
      },
      onError: (errors) => {
        toast.dismiss();
        if (flash?.error) {
          toast.error(flash.error);
        } else {
          toast.error(t('Failed to reset password') + `: ${Object.values(errors).join(', ')}`);
        }
      }
    });
  };
  
  const handleToggleStatus = (company: any) => {
    toast.loading(t('Updating status...'));
    
    router.put(route('companies.toggle-status', company.id), {}, {
      onSuccess: () => {
        toast.dismiss();
        if (flash?.success) {
          toast.success(flash.success);
        }
      },
      onError: (errors) => {
        toast.dismiss();
        if (flash?.error) {
          toast.error(flash.error);
        } else {
          toast.error(t('Failed to update status') + `: ${Object.values(errors).join(', ')}`);
        }
      }
    });
  };
  
  const handleResetFilters = () => {
    setSelectedStatus('all');
    setSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);
    
    router.get(route('companies.index'), { 
      page: 1, 
      per_page: pageFilters.per_page,
      view: activeView
    }, { preserveState: true, preserveScroll: true });
  };
  
  const handleUpgradePlan = (company: any) => {
    setCurrentCompany(company);
    
    // Fetch available plans
    toast.loading(t('Loading plans...'));
    
    fetch(route('companies.plans', company.id))
      .then(res => res.json())
      .then(data => {
        setAvailablePlans(data.plans);
        // Merge company details (including current_plan_duration) into currentCompany
        setCurrentCompany((prev: any) => ({ ...prev, ...data.company }));
        setIsUpgradePlanModalOpen(true);
        toast.dismiss();
      })
      .catch(err => {
        toast.dismiss();
        toast.error(t('Failed to load plans'));
      });
  };
  
  const handleUpgradePlanConfirm = (planId: number, duration: string) => {
    toast.loading(t('Upgrading plan...'));
    
    // Use Inertia router to handle the request
    router.put(route('companies.upgrade-plan', currentCompany.id), { 
      plan_id: planId,
      duration: duration
    }, {
      onSuccess: () => {
        setIsUpgradePlanModalOpen(false);
        toast.dismiss();
        if (flash?.success) {
          toast.success(flash.success);
        }
        router.reload();
      },
      onError: () => {
        toast.dismiss();
        if (flash?.error) {
          toast.error(flash.error);
        } else {
          toast.error(t('Failed to upgrade plan'));
        }
      }
    });
  };

  const handleUserLogsHistory = () => {
    // Navigate to user logs history page
    router.get(route('users.all-logs'));
  };

  // Define page actions
  const pageActions = [
    {
      icon: <History className="h-4 w-4" />,
      variant: 'outline',
      size: 'icon',
      tooltip: t('Login History'),
      onClick: () => handleUserLogsHistory()
    },
    {
      label: t('Export'),
      icon: <Download className="h-4 w-4 mr-2" />,
      variant: 'outline',
      onClick: async () => {
        try {
          const params = new URLSearchParams();
          if (searchTerm) params.append('search', searchTerm);
          if (selectedStatus !== 'all') params.append('status', selectedStatus);
          if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
          if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
          
          const response = await fetch(route('companies.export', 'companies') + '?' + params.toString());
          if (!response.ok) throw new Error('Export failed');
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `companies_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast.success(t('Export completed successfully'));
        } catch (error) {
          toast.error(t('Export failed'));
        }
      }
    },
    {
      label: t('Import'),
      icon: <Upload className="h-4 w-4 mr-2" />,
      variant: 'outline',
      onClick: () => setIsImportModalOpen(true)
    },
    {
      label: t('Add Company'),
      icon: <Plus className="h-4 w-4 mr-2" />,
      variant: 'default',
      onClick: () => handleAddNew()
    }
    
  ];

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Companies') }
  ];

  // Define table columns for list view
  const columns = [
    { 
      key: 'name', 
      label: t('Name'), 
      sortable: true,
      render: (value: any, row: any) => {
        return (
          <div className="flex items-center gap-3">
            {row.avatar ? (
              <img
                src={row.avatar}
                alt={row.name}
                className="h-10 w-10 rounded-full object-cover shadow-sm"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = (window as any).baseUrl + '/images/avatar/avatar.png';
                }}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                {getInitials(row.name)}
              </div>
            )}
            <div>
              <div className="font-medium">{row.name}</div>
              <div className="text-sm text-muted-foreground">{row.email}</div>
            </div>
          </div>
        );
      }
    },
    ...(isSaasMode ? [{ 
      key: 'plan_name', 
      label: t('Plan'),
      render: (value: string) => (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 capitalize">
          {value}
        </span>
      )
    }] : []),
    { 
      key: 'created_at', 
      label: t('Created At'), 
      sortable: true,
      
      render: (value: string) => (
        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span className="text-sm">{window.appSettings?.formatDateTime(value, false) || new Date(value).toLocaleDateString()}</span>
      </div>
      )
    }
  ];

  return (
    <PageTemplate 
      title={t("Companies")} 
      description={t("Manage your companies and their settings.")}
      url="/companies"
      actions={pageActions}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      {/* Search and filters section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          searchPlaceholder={t('Search companies...')}
          filters={[
            {
              name: 'status',
              label: t('Status'),
              type: 'select',
              value: selectedStatus,
              onChange: handleStatusFilter,
              options: [
                { value: 'all', label: t('All Status') },
                { value: 'active', label: t('Active') },
                { value: 'inactive', label: t('Inactive') }
              ]
            },
            {
              name: 'start_date',
              label: t('Start Date'),
              type: 'date',
              value: startDate,
              onChange: (date) => handleDateFilter('start', date)
            },
            {
              name: 'end_date',
              label: t('End Date'),
              type: 'date',
              value: endDate,
              onChange: (date) => handleDateFilter('end', date)
            }
          ]}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          showViewToggle={true}
          activeView={activeView}
          onViewChange={(view) => {
            setActiveView(view);
            const params: any = { view, page: 1 };
            if (searchTerm) params.search = searchTerm;
            if (selectedStatus !== 'all') params.status = selectedStatus;
            if (startDate) params.start_date = startDate.toISOString().split('T')[0];
            if (endDate) params.end_date = endDate.toISOString().split('T')[0];
            if (pageFilters.per_page) params.per_page = pageFilters.per_page;
            if (pageFilters.sort_field) params.sort_field = pageFilters.sort_field;
            if (pageFilters.sort_direction) params.sort_direction = pageFilters.sort_direction;
            router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true });
          }}
        />
      </div>

      {/* Content section */}
      {activeView === 'list' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <CrudTable
            columns={columns}
            actions={[
              { label: t('Login as Company'), icon: 'ArrowUpRight', action: 'login-as', className: 'text-gray-500' },
              { label: t('Company Info'), icon: 'Info', action: 'company-info', className: 'text-gray-500' },
              ...(isSaasMode ? [{ label: t('Upgrade Plan'), icon: 'CreditCard', action: 'upgrade-plan', className: 'text-gray-500' }] : []),
              { label: t('Reset Password'), icon: 'KeyRound', action: 'reset-password', className: 'text-gray-500' },
              { label: t('Toggle Status'), icon: 'Lock', action: 'toggle-status', className: 'text-gray-500' },
              { label: t('Edit'), icon: 'Edit', action: 'edit', className: 'text-gray-500' },
              { label: t('Delete'), icon: 'Trash2', action: 'delete', className: 'text-gray-500' },
            ]}
            data={companies?.data || []}
            from={companies?.from || 1}
            onAction={handleAction}
            sortField={pageFilters.sort_field}
            sortDirection={pageFilters.sort_direction}
            onSort={handleSort}
            permissions={permissions}
            entityPermissions={{
              view: 'company_view_any',
              edit: 'company_update',
              delete: 'company_delete'
            }}
          />

          {/* Pagination section */}
          <Pagination
            from={companies?.from || 0}
            to={companies?.to || 0}
            total={companies?.total || 0}
            links={companies?.links}
            entityName={t('companies')}
            currentPerPage={pageFilters.per_page?.toString() || '10'}
            onPerPageChange={(value) => {
              const params: any = { page: 1, per_page: parseInt(value), view: activeView };
              if (searchTerm) params.search = searchTerm;
              if (selectedStatus !== 'all') params.status = selectedStatus;
              if (startDate) params.start_date = startDate.toISOString().split('T')[0];
              if (endDate) params.end_date = endDate.toISOString().split('T')[0];
              router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true });
            }}
            onPageChange={(url) => {
              const pageUrl = new URL(url, window.location.origin);
              pageUrl.searchParams.set('view', activeView);
              router.get(pageUrl.pathname + pageUrl.search, {}, { preserveState: true, preserveScroll: true });
            }}
          />
        </div>
      ) : (
        <div>
          {/* Grid View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {companies?.data?.map((company: any) => (
              <Card key={company.id} className="group relative overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                {/* Status Badge */}
                <div className="absolute top-4 right-4 z-10">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    company.status === 'active'
                      ? 'bg-green-50 text-green-700 ring-green-600/20'
                      : 'bg-red-50 text-red-700 ring-red-600/20'
                  }`}>
                    {company.status === 'active' ? t('Active') : t('Inactive')}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-6">
                  {/* Company Header */}
                  <div className="flex items-start space-x-4 mb-6">
                    <div className="relative">
                      {company.avatar ? (
                        <img
                          src={company.avatar}
                          alt={company.name}
                          className="h-14 w-14 rounded-full object-cover shadow-sm"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = (window as any).baseUrl + '/images/avatar/avatar.png';
                          }}
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shadow-sm">
                          {getInitials(company.name)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">
                        {company.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {company.email}
                      </p>
                    </div>
                  </div>

                  {/* Plan Information */}
                  {isSaasMode && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <CreditCard className="h-4 w-4 text-primary mr-2" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {company.plan_name}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction('upgrade-plan', company)}
                          className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                        >
                          {t("Upgrade")}
                        </Button>
                      </div>
                      {company.plan_expiry_date && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("Expires")}: {window.appSettings?.formatDateTime(company.plan_expiry_date, false) || new Date(company.plan_expiry_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleAction('login-as', company)}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/20"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("Login as Company")}</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleAction('company-info', company)}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("Company Info")}</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleAction('edit', company)}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/20"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("Edit")}</TooltipContent>
                      </Tooltip>
                    </div>
                    
                    {/* More Actions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 z-50" sideOffset={5}>
                        {isSaasMode && permissions.includes('view-plan-requests') && (
                          <DropdownMenuItem onClick={() => handleAction('plan-requests', company)}>
                            <CreditCard className="h-4 w-4 mr-2" />
                            <span>{t("My Plan Requests")}</span>
                          </DropdownMenuItem>
                        )}
                        {isSaasMode && permissions.includes('view-plan-orders') && (
                          <DropdownMenuItem onClick={() => handleAction('plan-orders', company)}>
                            <CreditCard className="h-4 w-4 mr-2" />
                            <span>{t("My Plan Orders")}</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleAction('reset-password', company)}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          <span>{t("Reset Password")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction('toggle-status', company)}>
                          {company.status === 'active' ? 
                            <Lock className="h-4 w-4 mr-2" /> : 
                            <Unlock className="h-4 w-4 mr-2" />
                          }
                          <span>{company.status === 'active' ? t("Disable Login") : t("Enable Login")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleAction('delete', company)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          <span>{t("Delete")}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))}
            
            {(!companies?.data || companies.data.length === 0) && (
              <div className="col-span-full">
                <div className="text-center py-12">
                  <div className="mx-auto h-24 w-24 text-gray-300 dark:text-gray-600 mb-4">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t("No companies found")}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">{t("Get started by creating your first company")}</p>
                  <Button onClick={handleAddNew} className="inline-flex items-center">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("Add Company")}
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {/* Pagination for grid view */}
          <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
            <Pagination
              from={companies?.from || 0}
              to={companies?.to || 0}
              total={companies?.total || 0}
              links={companies?.links}
              entityName={t('companies')}
              currentPerPage={pageFilters.per_page?.toString() || '10'}
              onPerPageChange={(value) => {
                const params: any = { page: 1, per_page: parseInt(value), view: activeView };
                if (searchTerm) params.search = searchTerm;
                if (selectedStatus !== 'all') params.status = selectedStatus;
                if (startDate) params.start_date = startDate.toISOString().split('T')[0];
                if (endDate) params.end_date = endDate.toISOString().split('T')[0];
                router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true });
              }}
              onPageChange={(url) => {
                const pageUrl = new URL(url, window.location.origin);
                pageUrl.searchParams.set('view', activeView);
                router.get(pageUrl.pathname + pageUrl.search, {}, { preserveState: true, preserveScroll: true });
              }}
            />
          </div>
        </div>
      )}

      {/* Form Modal */}
      <CrudFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={(data) => {
          // If login_enabled is false, remove password field
          if (data.login_enabled === false) {
            delete data.password;
          }
          // Set status based on login_enabled
          data.status = data.login_enabled ? 'active' : 'inactive';
          
          // Remove login_enabled field as it's not needed in the backend
          delete data.login_enabled;
          handleFormSubmit(data);
        }}
        submitButtonText={formMode === 'create' ? t('Create') : t('Update')}
        formConfig={{
          fields: [
            { name: 'name', label: t('Company Name'), type: 'text', required: formMode !== 'view', placeholder: t('Enter company name') },
            { name: 'email', label: t('Email'), type: 'email', required: formMode !== 'view', placeholder: t('Enter company email') },
            { 
              name: 'login_enabled', 
              label: t('Enable Login'), 
              type: 'switch', 
              defaultValue: true,
              conditional: (mode: string) => mode === 'create'
            },
            { 
              name: 'password', 
              label: t('Password'), 
              type: 'password', 
              placeholder: t('Enter password'),
              required: true,
              conditional: (mode: string, formData: any) => {
                return mode === 'create' && formData.login_enabled;
              }
            },
          ],
          modalSize: 'lg'
        }}
        initialData={{
          ...currentCompany,
          login_enabled: currentCompany?.status === 'active'
        }}
        title={
          formMode === 'create' 
            ? t('Add Company') 
            : formMode === 'edit' 
              ? t('Edit Company') 
              : t('View Company')
        }
        mode={formMode}
      />

      {/* Delete Modal */}
      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={currentCompany?.name || ''}
        entityName="company"
      />

      {/* Reset Password Modal */}
      <CrudFormModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        onSubmit={handleResetPasswordConfirm}
        submitButtonText={t('Reset Password')}
        formConfig={{
          fields: [
            { name: 'password', label: t('New Password'), type: 'password', required: true, placeholder: t('Enter new password') },
          ],
          modalSize: 'sm'
        }}
        initialData={{}}
        title={t('Reset Password for') + ` ${currentCompany?.name || t('Company')}`}
        mode="edit"
      />
      
      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={isUpgradePlanModalOpen}
        onClose={() => setIsUpgradePlanModalOpen(false)}
        onConfirm={handleUpgradePlanConfirm}
        plans={availablePlans}
        currentPlanId={currentCompany?.plan_id}
        currentPlanDuration={currentCompany?.current_plan_duration}
        companyName={currentCompany?.name || ''}
      />
      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        type="companies"
        title="Companies"
      />

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        {currentCompany && <ViewPopup record={currentCompany} isSaasMode={isSaasMode} />}
      </Dialog>
    </PageTemplate>
  );
}