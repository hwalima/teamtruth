import { useState, useEffect } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Plus, Edit, Trash2, Download, Eye, Calendar } from 'lucide-react';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudTable } from '@/components/CrudTable';
import { type PageAction } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import ViewPopup from './view';

declare const route: any;

export default function Contacts() {
  const { t } = useTranslation();
  const { auth, contacts, filters: pageFilters = {}, flash } = usePage().props as any;

  // State
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [startDate, setStartDate] = useState<Date | undefined>(pageFilters.start_date ? new Date(pageFilters.start_date) : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(pageFilters.end_date ? new Date(pageFilters.end_date) : undefined);

  // Modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

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

    router.get(route('contacts.index'), params, { preserveState: true, preserveScroll: true });
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

    router.get(route('contacts.index'), params, { preserveState: true, preserveScroll: true });
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

    router.get(route('contacts.index'), params, { preserveState: true, preserveScroll: true });
  };

  const handleAddNew = () => {
    setCurrentContact(null);
    setFormMode('create');
    setIsFormModalOpen(true);
  };

  const handleEdit = (contact: any) => {
    setCurrentContact(contact);
    setFormMode('edit');
    setIsFormModalOpen(true);
  };

  const handleView = (contact: any) => {
    setCurrentContact(contact);
    setIsViewModalOpen(true);
  };

  const handleDelete = (contact: any) => {
    setCurrentContact(contact);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = (formData: any) => {
    if (formMode === 'create') {
      toast.loading(t('Creating contact...'));

      router.post(route('contacts.store'), formData, {
        onSuccess: () => {
          setIsFormModalOpen(false);
          toast.dismiss();
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t('Failed to create contact'));
        }
      });
    } else if (formMode === 'edit') {
      toast.loading(t('Updating contact...'));

      router.put(route('contacts.update', currentContact.id), formData, {
        onSuccess: () => {
          setIsFormModalOpen(false);
          toast.dismiss();
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t('Failed to update contact'));
        }
      });
    }
  };

  const handleDeleteConfirm = () => {
    toast.loading(t('Deleting contact...'));

    router.delete(route('contacts.destroy', currentContact.id), {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
      },
      onError: () => {
        toast.dismiss();
        toast.error(t('Failed to delete contact'));
      }
    });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);

    router.get(route('contacts.index'), {
      page: 1,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  const handleAction = (action: string, item: any) => {
    if (action === 'view') {
      handleView(item);
    } else if (action === 'edit') {
      handleEdit(item);
    } else if (action === 'delete') {
      handleDelete(item);
    }
  };

  const actions = [
    {
      label: t('View'),
      icon: 'Eye',
      action: 'view',
      className: 'text-gray-500 hover:text-gray-700'
    },
    {
      label: t('Delete'),
      icon: 'Trash2',
      action: 'delete',
      className: 'text-gray-500 hover:text-gray-700'
    }
  ];

  const handleExport = () => {
    const params = new URLSearchParams();

    if (searchTerm) params.append('search', searchTerm);
    if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);

    window.open(route('contacts.export') + '?' + params.toString());
  };



  const pageActions: PageAction[] = [
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
    { title: t('Contact Inquiries') }
  ];

  const columns = [
    {
      key: 'name',
      label: t('Name'),
      sortable: true,
      render: (value: string, row: any) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-muted-foreground">{row.email}</div>
        </div>
      )
    },
    {
      key: 'subject',
      label: t('Subject'),
      sortable: true,
      render: (value: string) => (
        <div className="max-w-xs truncate" title={value}>
          {value}
        </div>
      )
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
      title={t("Contact Inquiries")}
      description={t("Manage your incoming contact inquiries")}
      url="/contacts"
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
          searchPlaceholder={t('Search contacts...')}
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
          data={contacts?.data || []}
          from={contacts?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={[]}
        />

        {contacts?.links && (
          <Pagination
            from={contacts?.from || 0}
            to={contacts?.to || 0}
            total={contacts?.total || 0}
            links={contacts?.links}
            entityName={t('contacts')}
            currentPerPage={pageFilters.per_page?.toString() || '10'}
            onPerPageChange={(value) => {
              const params: any = { page: 1, per_page: parseInt(value) };
              if (searchTerm) params.search = searchTerm;
              if (startDate) params.start_date = startDate.toISOString().split('T')[0];
              if (endDate) params.end_date = endDate.toISOString().split('T')[0];
              router.get(route('contacts.index'), params, { preserveState: true, preserveScroll: true });
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
        submitButtonText={formMode === 'create' ? t('Create Contact') : t('Update Contact')}
        formConfig={{
          fields: [
            { name: 'name', label: t('Name'), type: 'text', required: true },
            { name: 'email', label: t('Email'), type: 'email', required: true },
            { name: 'subject', label: t('Subject'), type: 'text', required: true },
            { name: 'message', label: t('Message'), type: 'textarea', required: true }
          ],
          modalSize: 'lg'
        }}
        initialData={currentContact}
        title={formMode === 'create' ? t('Add Contact Inquiry') : t('Edit Contact Inquiry')}
        mode={formMode}
      />

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        {currentContact && <ViewPopup record={currentContact} />}
      </Dialog>

      {/* Delete Modal */}
      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={currentContact?.name || ''}
        entityName="contact"
      />
    </PageTemplate>
  );
}
