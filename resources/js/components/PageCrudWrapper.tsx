// components/PageCrudWrapper.tsx
import { useState, useEffect, useRef, ReactNode } from 'react';
import { PageTemplate, PageAction } from '@/components/page-template';
import { PlusIcon } from 'lucide-react';
import { router, usePage } from '@inertiajs/react';
import { hasPermission } from '@/utils/authorization';
import { CrudTable } from './CrudTable';
import { CrudFormModal } from './CrudFormModal';
import { CrudDeleteModal } from './CrudDeleteModal';
import { toast } from '@/components/custom-toast';
import { CrudConfig } from '@/types/crud';
import { BreadcrumbItem } from '@/types';
import { useTranslation } from 'react-i18next';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';

export interface CrudButton {
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  onClick?: () => void;
  permission?: string;
  className?: string;
  showAddButton?: boolean;
}

interface PageCrudWrapperProps {
  config: CrudConfig;
  title?: string;
  description?: string;
  url: string;
  buttons?: CrudButton[];
  breadcrumbs?: BreadcrumbItem[];
}

export function PageCrudWrapper({ 
  config, 
  title, 
  description,
  url,
  buttons = [],
  breadcrumbs
}: PageCrudWrapperProps) {
  const { t } = useTranslation();
  const { entity, table, filters = [], form, hooks } = config;
  const { auth, ...pageProps } = usePage().props as any;
  const permissions = auth?.permissions || [];
  
  // Get data from page props using entity name
  const data = pageProps[entity.name] || { data: [], links: [] };
  const pageFilters = pageProps.filters || {};
  
  // State
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [filterValues, setFilterValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    filters.forEach(filter => {
      const filterKey = filter.name || filter.key;
      initial[filterKey] = pageFilters[filterKey] || '';
    });
    return initial;
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pageInitialState, setPageInitialState] = useState(true);

  useEffect(() => {
    if (!pageInitialState) applyFilters();
    setPageInitialState(false);
  }, [filterValues]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');

  // Build params from current state + overrides, always preserving all active params
  const buildParams = (overrides: Record<string, any> = {}, currentSearch = searchTerm, currentFilters = filterValues) => {
    const params: any = { page: 1 };

    if (currentSearch) params.search = currentSearch;

    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value && value !== '') params[key] = value;
    });

    if (pageFilters.per_page) params.per_page = pageFilters.per_page;
    if (pageFilters.sort_field) params.sort_field = pageFilters.sort_field;
    if (pageFilters.sort_direction) params.sort_direction = pageFilters.sort_direction;

    return { ...params, ...overrides };
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return Object.entries(filterValues).some(([, value]) => value && value !== '') || searchTerm !== '';
  };
  
  // Count active filters
  const activeFilterCount = () => {
    return Object.entries(filterValues).filter(([, value]) => value && value !== '').length + (searchTerm ? 1 : 0);
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.get(entity.endpoint, buildParams({ page: 1 }), { preserveState: true, preserveScroll: true });
  };
  
  const applyFilters = () => {
    router.get(entity.endpoint, buildParams({ page: 1 }), { preserveState: true, preserveScroll: true });
  };
  
  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filterValues, [key]: value };
    setFilterValues(newFilters);
    router.get(entity.endpoint, buildParams({ page: 1 }, searchTerm, newFilters), { preserveState: true, preserveScroll: true });
  };
  
  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
    router.get(entity.endpoint, buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: true, preserveScroll: true });
  };
  
  const handleAction = (action: string, item: any) => {
    setCurrentItem(item);
    
    switch (action) {
      case 'view':
        setFormMode('view');
        setIsFormModalOpen(true);
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
    setCurrentItem(null);
    setFormMode('create');
    setIsFormModalOpen(true);
  };
  
  const handleFormSubmit = (formData: any) => {
    // Make a copy of the form data to avoid modifying the original
    const processedFormData = { ...formData };
    
    // For roles, create a simplified object with only the required fields
    if (entity.name === 'roles') {
      // Extract permission names from the permissions array if they're objects
      if (processedFormData.permissions && Array.isArray(processedFormData.permissions)) {
        const permissionNames = processedFormData.permissions.map(p => {
          if (typeof p === 'object' && p !== null && p.name) {
            return p.name;
          }
          return String(p);
        });
        processedFormData.permissions = permissionNames;
      }
      
      // Reset the object with only the fields we need
      const cleanData = {
        label: processedFormData.label,
        description: processedFormData.description || '',
        permissions: processedFormData.permissions || []
      };
      
      // Replace all properties
      Object.keys(processedFormData).forEach(key => {
        delete processedFormData[key];
      });
      
      Object.assign(processedFormData, cleanData);
    }
    // Fix permissions format for other entities
    else if (processedFormData.permissions && Array.isArray(processedFormData.permissions)) {
      const permissionsObj = {};
      processedFormData.permissions.forEach((id, index) => {
        permissionsObj[index] = String(id);
      });
      processedFormData.permissions = permissionsObj;
    }
    
    // Ensure we're not sending the name field for permissions as it's auto-generated
    if (entity.name === 'permissions' && formMode === 'edit') {
      delete processedFormData.name;
    }
    
    // Check if this entity has file uploads
    const hasFileFields = form.fields.some(field => field.type === 'file');
    
    if (hasFileFields) {
      // Get file field names
      const fileFields = form.fields
        .filter(field => field.type === 'file')
        .map(field => field.name);
      
      // Use FormData for file uploads
      const formDataObj = new FormData();
      
      // Add all fields to FormData
      Object.keys(processedFormData).forEach(key => {
        // For file fields in edit mode
        if (fileFields.includes(key) && formMode === 'edit') {
          // Only include the file if a new one was selected
          if (processedFormData[key] && typeof processedFormData[key] === 'object') {
            formDataObj.append(key, processedFormData[key]);
          }
          // Otherwise skip this field - don't send empty file fields
          return;
        }
        formDataObj.append(key, processedFormData[key]);
      });
      
      if (formMode === 'create') {
        // Show loading toast
        toast.loading(t('Creating...'));
        
        router.post(entity.endpoint, formDataObj, {
          onSuccess: (page) => {
            setIsFormModalOpen(false);
            toast.dismiss();
            toast.success(t(`${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)} created successfully`));
            if (hooks?.afterCreate) {
              hooks.afterCreate(formData, page.props[entity.name]);
            }
          },
          onError: (errors) => {
            toast.dismiss();
            toast.error(t(`Failed to create ${entity.name.slice(0, -1)}: ${Object.values(errors).join(', ')}`));
          }
        });
      } else if (formMode === 'edit') {
        // Show loading toast
        toast.loading(t('Updating...'));
        
        router.post(`${entity.endpoint}/${currentItem.id}?_method=PUT`, formDataObj, {
          onSuccess: (page) => {
            setIsFormModalOpen(false);
            toast.dismiss();
            toast.success(t(`${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)} updated successfully`));
            if (hooks?.afterUpdate) {
              hooks.afterUpdate(formData, page.props[entity.name]);
            }
          },
          onError: (errors) => {
            toast.dismiss();
            toast.error(t(`Failed to update ${entity.name.slice(0, -1)}: ${Object.values(errors).join(', ')}`));
          }
        });
      }
      return;
    }
    
    if (formMode === 'create') {
      // Show loading toast
      toast.loading(t('Creating...'));
      
      router.post(entity.endpoint, processedFormData, {
        onSuccess: (page) => {
          setIsFormModalOpen(false);
          toast.dismiss();
          toast.success(t(`${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)} created successfully`));
          if (hooks?.afterCreate) {
            hooks.afterCreate(formData, page.props[entity.name]);
          }
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t(`Failed to create ${entity.name.slice(0, -1)}: ${Object.values(errors).join(', ')}`));
        }
      });
    } else if (formMode === 'edit') {
      // Show loading toast
      toast.loading(t('Updating...'));
      
      router.put(`${entity.endpoint}/${currentItem.id}`, processedFormData, {
        onSuccess: (page) => {
          setIsFormModalOpen(false);
          toast.dismiss();
          toast.success(t(`${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)} updated successfully`));
          if (hooks?.afterUpdate) {
            hooks.afterUpdate(formData, page.props[entity.name]);
          }
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t(`Failed to update ${entity.name.slice(0, -1)}: ${Object.values(errors).join(', ')}`));
        }
      });
    }
  };
  
  const handleDeleteConfirm = () => {
    // Show loading toast
    toast.loading(t('Deleting...'));
    
    router.delete(`${entity.endpoint}/${currentItem.id}`, {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
        toast.success(t(`${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)} deleted successfully`));
        if (hooks?.afterDelete) {
          hooks.afterDelete(currentItem.id);
        }
      },
      onError: (errors) => {
        toast.dismiss();
        toast.error(t(`Failed to delete ${entity.name.slice(0, -1)}: ${Object.values(errors).join(', ')}`));
      }
    });
  };
  
  const handleResetFilters = () => {
    const resetFilters: Record<string, any> = {};
    filters.forEach(filter => {
      const filterKey = filter.name || filter.key;
      resetFilters[filterKey] = '';
    });
    
    setFilterValues(resetFilters);
    setSearchTerm('');

    const params: any = { page: 1 };
    if (pageFilters.per_page) params.per_page = pageFilters.per_page;
    router.get(entity.endpoint, params, { preserveState: true, preserveScroll: true });
  };

  // Check if we should show the add button
  const showAddButton = buttons.every(button => button.showAddButton !== false);

  // Define page actions
  const pageActions: PageAction[] = [];
  
  // Add custom buttons with permission check
  buttons.forEach(button => {
    if (!button.permission || hasPermission(permissions, button.permission)) {
      pageActions.push({
        label: button.label,
        icon: button.icon,
        variant: button.variant,
        onClick: button.onClick
      });
    }
  });

  // Add the default "Add" button if allowed and user has permission
  if (showAddButton && hasPermission(permissions, entity.permissions.create)) {
    pageActions.push({
      label: `Add ${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)}`,
      icon: <PlusIcon className="h-4 w-4" />,
      variant: 'default',
      onClick: () => handleAddNew()
    });
  }

  const pageTitle = title || entity.name.charAt(0).toUpperCase() + entity.name.slice(1);

  // Generate default breadcrumbs if not provided
  const defaultBreadcrumbs: BreadcrumbItem[] = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: pageTitle }
  ];

  const pageBreadcrumbs = breadcrumbs || defaultBreadcrumbs;

  return (
    <PageTemplate 
      title={pageTitle} 
      description={description}
      url={url}
      actions={pageActions}
      breadcrumbs={pageBreadcrumbs}
      noPadding
    >
      {/* Search and filters section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          searchPlaceholder={`Search ${entity.name}...`}
          filters={filters.map(filter => {
            const filterKey = filter.name || filter.key;
            return {
              name: filterKey,
              label: filter.label,
              type: 'select' as const,
              value: filterValues[filterKey] || '',
              onChange: (value: any) => handleFilterChange(filterKey, value),
              options: filter.options || []
            };
          })}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
        />
      </div>

      {/* Table section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={table.columns}
          actions={table.actions}
          data={data.data}
          from={data.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          statusColors={table.statusColors}
          permissions={permissions}
          entityPermissions={entity.permissions}
        />

        <Pagination
          from={data.from || 0}
          to={data.to || 0}
          total={data.total || 0}
          links={data.links}
          entityName={entity.name}
          currentPerPage={pageFilters.per_page?.toString() || '10'}
          onPerPageChange={(value) => {
            router.get(entity.endpoint, buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: true, preserveScroll: true });
          }}
          onPageChange={(url) => {
            const pageNum = new URL(url).searchParams.get('page');
            router.get(entity.endpoint, buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: true, preserveScroll: true });
          }}
        />
      </div>

      <CrudFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        formConfig={{
          ...form,
          modalSize: config.modalSize || form.modalSize
        }}
        initialData={currentItem}
        title={
          formMode === 'create' 
            ? `Add ${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)}` 
            : formMode === 'edit' 
              ? `Edit ${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)}` 
              : `View ${entity.name.slice(0, -1).charAt(0).toUpperCase() + entity.name.slice(0, -1).slice(1)}`
        }
        mode={formMode}
        description={config.description}
      />

      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={currentItem?.name || currentItem?.title || ''}
        entityName={entity.name.slice(0, -1)}
        warningMessage={`This ${entity.name.slice(0, -1)} and all associated data will be permanently deleted.`}
      />
    </PageTemplate>
  );
}