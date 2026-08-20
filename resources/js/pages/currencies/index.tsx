// pages/currencies/index.tsx
import { useState } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { hasPermission } from '@/utils/authorization';
import { CrudTable } from '@/components/CrudTable';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/dialog';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import ViewPopup from './view';

export default function CurrenciesPage() {
  const { t } = useTranslation();
  const { auth, currencys, filters: pageFilters = {}, flash } = usePage().props as any;
  const permissions = auth?.permissions || [];

  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.get(route('currencies.index'), {
      page: 1,
      search: searchTerm || undefined,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
    router.get(route('currencies.index'), {
      sort_field: field,
      sort_direction: direction,
      page: 1,
      search: searchTerm || undefined,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  const handleAction = (action: string, item: any) => {
    setCurrentItem(item);
    switch (action) {
      case 'view':
        setIsViewModalOpen(true);
        break;
      case 'edit':
        setFormMode('edit');
        setIsFormModalOpen(true);
        break;
      case 'delete':
        setIsDeleteModalOpen(true);
        break;
    }
  };

  const handleAddNew = () => {
    setCurrentItem(null);
    setFormMode('create');
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = (formData: any) => {
    if (formMode === 'create') {
      toast.loading(t('Creating currency...'));
      router.post(route('currencies.store'), formData, {
        onSuccess: () => {
          setIsFormModalOpen(false);
          toast.dismiss();
          if (flash?.success) toast.success(flash.success);
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t('Failed to create currency') + `: ${Object.values(errors).join(', ')}`);
        }
      });
    } else {
      toast.loading(t('Updating currency...'));
      router.put(route('currencies.update', currentItem.id), formData, {
        onSuccess: () => {
          setIsFormModalOpen(false);
          toast.dismiss();
          if (flash?.success) toast.success(flash.success);
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t('Failed to update currency') + `: ${Object.values(errors).join(', ')}`);
        }
      });
    }
  };

  const handleDeleteConfirm = () => {
    toast.loading(t('Deleting currency...'));
    router.delete(route('currencies.destroy', currentItem.id), {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
        if (flash?.success) toast.success(flash.success);
      },
      onError: (errors) => {
        toast.dismiss();
        toast.error(t('Failed to delete currency') + `: ${Object.values(errors).join(', ')}`);
      }
    });
  };

  const pageActions = [];
  if (hasPermission(permissions, 'currency_create')) {
    pageActions.push({
      label: t('Add Currency'),
      icon: <Plus className="h-4 w-4 mr-2" />,
      variant: 'default',
      onClick: () => handleAddNew()
    });
  }

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Currency') }
  ];

  const columns = [
    { key: 'name', label: t('Name'), sortable: true },
    { key: 'code', label: t('Code'), sortable: true },
    { key: 'symbol', label: t('Symbol'), sortable: true },
    {
      key: 'is_default',
      label: t('Default'),
      render: (value: boolean) => (
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
          value
            ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
            : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        }`}>
          {value ? t('Yes') : t('No')}
        </span>
      )
    }
  ];

  const actions = [
    {
      label: t('View'),
      icon: 'Eye',
      action: 'view',
      className: 'text-gray-500 hover:text-gray-700',
      requiredPermission: 'currency_view_any'
    },
    {
      label: t('Edit'),
      icon: 'Edit',
      action: 'edit',
      className: 'text-gray-500 hover:text-gray-700',
      requiredPermission: 'currency_update'
    },
    {
      label: t('Delete'),
      icon: 'Trash2',
      action: 'delete',
      className: 'text-gray-500 hover:text-gray-700',
      requiredPermission: 'currency_delete',
      condition: (row: any) => !row.is_default
    }
  ];

  return (
    <PageTemplate
      title={t('Currency')}
      description={t('Manage your currencies.')}
      url="/currencies"
      actions={pageActions}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      {/* Search section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          searchPlaceholder={t('Search currencies...')}
          filters={[]}
          hasActiveFilters={() => searchTerm !== ''}
          activeFilterCount={() => searchTerm ? 1 : 0}
          onResetFilters={() => {
            setSearchTerm('');
            router.get(route('currencies.index'), { page: 1, per_page: pageFilters.per_page }, { preserveState: true, preserveScroll: true });
          }}
        />
      </div>

      {/* Table section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={columns}
          actions={actions}
          data={currencys?.data || []}
          from={currencys?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          entityPermissions={{
            view: 'currency_view_any',
            create: 'currency_create',
            edit: 'currency_update',
            delete: 'currency_delete'
          }}
        />

        <Pagination
          from={currencys?.from || 0}
          to={currencys?.to || 0}
          total={currencys?.total || 0}
          links={currencys?.links}
          entityName={t('currencies')}
          currentPerPage={pageFilters.per_page?.toString() || '10'}
          onPerPageChange={(value) => router.get(route('currencies.index'), { page: 1, per_page: parseInt(value), search: searchTerm || undefined }, { preserveState: true, preserveScroll: true })}
          onPageChange={(url) => router.get(url)}
        />
      </div>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        {currentItem && <ViewPopup record={currentItem} />}
      </Dialog>

      {/* Form Modal */}
      <CrudFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        formConfig={{
          fields: [
            { name: 'name', label: t('Currency Name'), type: 'text', required: true, placeholder: t('e.g. US Dollar, Euro') },
            { name: 'code', label: t('Currency Code'), type: 'text', required: true, placeholder: t('e.g. USD, EUR, GBP') },
            { name: 'symbol', label: t('Currency Symbol'), type: 'text', required: true, placeholder: t('e.g. $, €, £') },
            { name: 'description', label: t('Description'), type: 'textarea', placeholder: t('Enter currency description') },
            { name: 'is_default', label: '', type: 'checkbox', placeholder: t('Set as Default Currency') }
          ],
          modalSize: 'lg'
        }}
        initialData={currentItem}
        title={formMode === 'create' ? t('Add Currency') : t('Edit Currency')}
        mode={formMode}
      />

      {/* Delete Modal */}
      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={currentItem?.name || ''}
        entityName="currency"
      />
    </PageTemplate>
  );
}
