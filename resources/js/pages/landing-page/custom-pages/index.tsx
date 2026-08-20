import React, { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Plus, Trash2 } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudTable } from '@/components/CrudTable';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { columnRenderers } from '@/utils/columnRenderers';
import { hasPermission } from '@/utils/authorization';

declare const route: any;

interface CustomPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  is_active: boolean;
  sort_order: number;
}

export default function CustomPagesIndex() {
  const { t } = useTranslation();
  const { auth, pages, filters: pageFilters = {} } = usePage<any>().props;
  const permissions = auth?.permissions || [];
  const [deletingPage, setDeletingPage] = useState<CustomPage | null>(null);
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');

  const handleDelete = (page: CustomPage) => {
    setDeletingPage(page);
  };

  const confirmDelete = () => {
    if (deletingPage) {
      router.delete(route('landing-page.custom-pages.destroy', deletingPage.id), {
        onSuccess: () => {
          toast.success(t('Page deleted successfully!'));
          setDeletingPage(null);
        },
        onError: () => {
          toast.error(t('Failed to delete page. Please try again.'));
        }
      });
    }
  };

  const buildParams = (overrides: Record<string, any> = {}) => {
    const params: any = { page: 1 };
    if (searchTerm) params.search = searchTerm;
    if (pageFilters.per_page) params.per_page = pageFilters.per_page;
    if (pageFilters.sort_field) params.sort_field = pageFilters.sort_field;
    if (pageFilters.sort_direction) params.sort_direction = pageFilters.sort_direction;
    return { ...params, ...overrides };
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.get(route('landing-page.custom-pages.index'), buildParams({ page: 1 }), { preserveState: true, preserveScroll: true });
  };

  const handleAction = (action: string, item: CustomPage) => {
    if (action === 'delete') {
      handleDelete(item);
    }
  };

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
    router.get(route('landing-page.custom-pages.index'), buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: true, preserveScroll: true });
  };

  const columns = [
    {
      key: 'title',
      label: t('Title'),
      sortable: true,
      render: (value: string) => (
        <div className="font-medium">{value}</div>
      )
    },
    {
      key: 'content',
      label: t('Content'),
      render: (value: string) => {
        const strippedContent = value.replace(/<[^>]*>/g, '');
        return (
          <div className="max-w-xs truncate" title={strippedContent}>
            {strippedContent.substring(0, 100)}...
          </div>
        );
      }
    },
    {
      key: 'is_active',
      label: t('Status'),
      render: (value: boolean) => {
        const statusValue = value ? 'active' : 'inactive';
        const statusRenderer = columnRenderers.status({
          active: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
          inactive: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        });
        return statusRenderer(statusValue);
      }
    }
  ];

  const actions = [
    {
      label: t('Edit'),
      icon: 'Edit',
      href: (item: CustomPage) => route('landing-page.custom-pages.edit', item.id),
      className: 'text-gray-500 hover:text-gray-700',
      requiredPermission: 'custom_page_update'
    },
    {
      label: t('Delete'),
      icon: 'Trash2',
      action: 'delete',
      className: 'text-gray-500 hover:text-gray-700',
      requiredPermission: 'custom_page_delete'
    }
  ];

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Landing Page'), href: route('landing-page.settings') },
    { title: t('Custom Pages') }
  ];

  return (
    <PageTemplate
      title={t('Custom Pages')}
      description={t('Manage your landing page custom pages')}
      url="/landing-page/custom-pages"
      breadcrumbs={breadcrumbs}
      actions={hasPermission(permissions, 'custom_page_create') ? [
        {
          label: t('Add Page'),
          icon: <Plus className="w-4 h-4 mr-2" />,
          variant: 'default',
          onClick: () => router.get(route('landing-page.custom-pages.create'))
        }
      ] : []}
      noPadding
    >
      {/* Search and filters section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          searchPlaceholder={t('Search pages...')}
          filters={[]}
          hasActiveFilters={() => searchTerm !== ''}
          activeFilterCount={() => searchTerm ? 1 : 0}
          onResetFilters={() => {
            setSearchTerm('');
            router.get(route('landing-page.custom-pages.index'), { page: 1, per_page: pageFilters.per_page }, { preserveState: true, preserveScroll: true });
          }}
        />
      </div>

      {/* Table section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={columns}
          actions={actions}
          data={pages?.data || pages || []}
          from={pages?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          entityPermissions={{
            view: 'custom_page_view',
            edit: 'custom_page_update',
            delete: 'custom_page_delete'
          }}
        />

        {pages?.links && (
          <Pagination
            from={pages?.from || 0}
            to={pages?.to || 0}
            total={pages?.total || 0}
            links={pages?.links}
            entityName={t('pages')}
            currentPerPage={pageFilters.per_page?.toString() || '10'}
            onPerPageChange={(value) => router.get(route('landing-page.custom-pages.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: true, preserveScroll: true })}
            onPageChange={(url) => {
              const pageNum = new URL(url).searchParams.get('page');
              router.get(route('landing-page.custom-pages.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: true, preserveScroll: true });
            }}
          />
        )}
      </div>

      <CrudDeleteModal
        isOpen={!!deletingPage}
        onClose={() => setDeletingPage(null)}
        onConfirm={confirmDelete}
        itemName={deletingPage?.title || ''}
        entityName={t('Page')}
      />
    </PageTemplate>
  );
}