import { useState, useEffect } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Plus, Edit, Trash2, Download, Calendar } from 'lucide-react';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudTable } from '@/components/CrudTable';


export default function Newsletters() {
  const { t } = useTranslation();
  const { auth, newsletters, filters: pageFilters = {}, flash } = usePage().props as any;

  // State
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [startDate, setStartDate] = useState<Date | undefined>(pageFilters.start_date ? new Date(pageFilters.start_date) : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(pageFilters.end_date ? new Date(pageFilters.end_date) : undefined);

  // Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentNewsletter, setCurrentNewsletter] = useState<any>(null);
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
    return searchTerm !== '' || startDate !== undefined || endDate !== undefined;
  };

  // Count active filters
  const activeFilterCount = () => {
    return (searchTerm ? 1 : 0) +
           (startDate ? 1 : 0) +
           (endDate ? 1 : 0);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  // Apply filters immediately when date changes
  const handleDateFilterChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (type === 'start') {
      setStartDate(date);
    } else {
      setEndDate(date);
    }

    const params: any = { page: 1 };

    if (searchTerm) {
      params.search = searchTerm;
    }

    if (type === 'start') {
      if (date) {
        params.start_date = date.toISOString().split('T')[0];
      }
      if (endDate) {
        params.end_date = endDate.toISOString().split('T')[0];
      }
    } else {
      if (startDate) {
        params.start_date = startDate.toISOString().split('T')[0];
      }
      if (date) {
        params.end_date = date.toISOString().split('T')[0];
      }
    }

    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page;
    }

    router.get(route('newsletters.index'), params, { preserveState: true, preserveScroll: true });
  };


  const applyFilters = () => {
    const params: any = { page: 1 };

    if (searchTerm) {
      params.search = searchTerm;
    }

    if (startDate) {
      params.start_date = startDate.toISOString().split('T')[0];
    }

    if (endDate) {
      params.end_date = endDate.toISOString().split('T')[0];
    }

    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page;
    }

    router.get(route('newsletters.index'), params, { preserveState: true, preserveScroll: true });
  };
  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';

    const params: any = {
      sort_field: field,
      sort_direction: direction,
      page: 1
    };

    if (searchTerm) {
      params.search = searchTerm;
    }

    if (startDate) {
      params.start_date = startDate.toISOString().split('T')[0];
    }

    if (endDate) {
      params.end_date = endDate.toISOString().split('T')[0];
    }

    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page;
    }

    router.get(route('newsletters.index'), params, { preserveState: true, preserveScroll: true });
  };

  const handleAddNew = () => {
    setCurrentNewsletter(null);
    setFormMode('create');
    setIsFormModalOpen(true);
  };

  const handleEdit = (newsletter: any) => {
    setCurrentNewsletter(newsletter);
    setFormMode('edit');
    setIsFormModalOpen(true);
  };

  const handleDelete = (newsletter: any) => {
    setCurrentNewsletter(newsletter);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = (formData: any) => {
    if (formMode === 'create') {
      toast.loading(t('Creating newsletter subscription...'));

      router.post(route('newsletters.store'), formData, {
        onSuccess: () => {
          setIsFormModalOpen(false);
          toast.dismiss();
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t('Failed to create newsletter subscription'));
        }
      });
    } else if (formMode === 'edit') {
      toast.loading(t('Updating newsletter subscription...'));

      router.put(route('newsletters.update', currentNewsletter.id), formData, {
        onSuccess: () => {
          setIsFormModalOpen(false);
          toast.dismiss();
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t('Failed to update newsletter subscription'));
        }
      });
    }
  };

  const handleDeleteConfirm = () => {
    toast.loading(t('Deleting newsletter subscription...'));

    router.delete(route('newsletters.destroy', currentNewsletter.id), {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
      },
      onError: () => {
        toast.dismiss();
        toast.error(t('Failed to delete newsletter subscription'));
      }
    });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);

    router.get(route('newsletters.index'), {
      page: 1,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  const handleExport = () => {
    const params = new URLSearchParams();

    if (searchTerm) params.append('search', searchTerm);
    if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);

    window.open(route('newsletters.export') + '?' + params.toString());
  };

  const handleAction = (action: string, item: any) => {
    if (action === 'edit') {
      handleEdit(item);
    } else if (action === 'delete') {
      handleDelete(item);
    }
  };

  const actions = [
    {
      label: t('Delete'),
      icon: 'Trash2',
      action: 'delete',
      className: 'text-gray-500 hover:text-gray-700'
    }
  ];

  const pageActions = [
    {
      label: t('Export'),
      icon: <Download className="h-4 w-4 mr-2" />,
      variant: 'outline',
      onClick: handleExport
    },
  ];

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Landing Page'), href: route('landing-page.settings') },
    { title: t('Newsletters') }
  ];

  const columns = [
    {
      key: 'email',
      label: t('Email'),
      sortable: true,
      render: (value: string) => <span className="font-medium">{value}</span>
    },
    {
      key: 'created_at',
      label: t('Created At'),
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {window.appSettings?.formatDateTime(value, false) || new Date(value).toLocaleDateString()}
        </div>
      )
    }
  ];

  return (
    <PageTemplate
      title={t("Newsletters")}
      description={t('Manage your newsletter subscriptions.')}
      url="/newsletters"
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
          searchPlaceholder={t('Search by email...')}
          filters={[]}
          hasActiveFilters={() => searchTerm !== ''}
          activeFilterCount={() => searchTerm ? 1 : 0}
          onResetFilters={handleResetFilters}
        />
      </div>

      {/* Content section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={columns}
          actions={actions}
          data={newsletters?.data || []}
          from={newsletters?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={[]}
        />

        {newsletters?.links && (
          <Pagination
            from={newsletters?.from || 0}
            to={newsletters?.to || 0}
            total={newsletters?.total || 0}
            links={newsletters?.links}
            entityName={t('subscriptions')}
            currentPerPage={pageFilters.per_page?.toString() || '10'}
            onPerPageChange={(value) => {
              const params: any = { page: 1, per_page: parseInt(value) };
              if (searchTerm) params.search = searchTerm;
              if (startDate) params.start_date = startDate.toISOString().split('T')[0];
              if (endDate) params.end_date = endDate.toISOString().split('T')[0];
              router.get(route('newsletters.index'), params, { preserveState: true, preserveScroll: true });
            }}
            onPageChange={(url) => router.get(url)}
          />
        )}
      </div>

      {/* Form Modal */}
      <CrudFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        submitButtonText={formMode === 'create' ? t('Create Newsletter') : t('Update Newsletter')}
        formConfig={{
          fields: [
            { name: 'email', label: t('Email'), type: 'email', required: true }
          ],
          modalSize: 'md'
        }}
        initialData={currentNewsletter}
        title={
          formMode === 'create'
            ? t('Add Newsletter Subscription')
            : t('Edit Newsletter Subscription')
        }
        mode={formMode}
      />

      {/* Delete Modal */}
      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={currentNewsletter?.email || ''}
        entityName="newsletter subscription"
      />
    </PageTemplate>
  );
}
