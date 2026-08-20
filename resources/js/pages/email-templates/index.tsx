import { useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { PageTemplate } from '@/components/page-template'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Search, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Pagination } from '@/components/ui/pagination'
import { CrudTable } from '@/components/CrudTable'
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar'

interface EmailTemplate {
  id: number
  name: string
  from: string
  created_at: string
  email_template_langs: Array<{
    id: number
    lang: string
    subject: string
  }>
}

interface Props {
  templates: {
    data: EmailTemplate[]
    from: number
    to: number
    total: number
    links: Array<{
      url: string | null
      label: string
      active: boolean
    }>
  }
  filters: {
    search?: string
    sort_field?: string
    sort_direction?: string
    per_page?: number
  }
}

export default function EmailTemplatesIndex({ templates, filters: pageFilters = {} }: Props) {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '')
  const [showFilters, setShowFilters] = useState(false)

  const handleAction = (action: string, item: EmailTemplate) => {
    if (action === 'view') {
      router.get(route('email-templates.show', item.id))
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters()
  }

  const applyFilters = () => {
    const params: any = { page: 1 }
    
    if (searchTerm) {
      params.search = searchTerm
    }
    
    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page
    }
    
    router.get(route('email-templates.index'), params, { preserveState: true, preserveScroll: true })
  }

  const handleResetFilters = () => {
  setSearchTerm('')
  setShowFilters(false)

  router.get(
    route('email-templates.index'),
    {},
    {
      preserveState: true,
      preserveScroll: true,
    }
  )
}

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc'
    
    const params: any = { 
      sort_field: field, 
      sort_direction: direction, 
      page: 1 
    }
    
    if (searchTerm) {
      params.search = searchTerm
    }
    
    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page
    }
    
    router.get(route('email-templates.index'), params, { preserveState: true, preserveScroll: true })
  }



  const breadcrumbs = [
    { title: t("Dashboard"), href: route('dashboard') },
    { title: t("Email Templates") }
  ]

  const columns = [
    { 
      key: 'name', 
      label: t("Name"), 
      sortable: true
    }
  ]

  return (
    <PageTemplate 
      title={t("Email Templates")} 
      description={t("Manage email templates for automated messages.")}
      url={route('email-templates.index')}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      <Head title={t("Email Templates")} />
      
      {/* Search section */}
     <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 border">
      <SearchAndFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSearch={handleSearch}
        filters={[]}
        hasActiveFilters={() => searchTerm !== ''}
        activeFilterCount={() => (searchTerm ? 1 : 0)}
        onResetFilters={handleResetFilters}
      />
    </div>

      {/* Content section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <CrudTable
            columns={columns}
            data={templates?.data || []}
            actions={[
              {
                label: t('View'),
                icon: 'Eye',
                action: 'view',
                className: 'text-gray-500',
              },
            ]}
            from={templates?.from || 1}
            onAction={handleAction}
            sortField={pageFilters.sort_field}
            sortDirection={pageFilters.sort_direction}
            onSort={handleSort}
            permissions={[]}
            entityPermissions={{
              view: '',
              create: '',
              edit: '',
              delete: '',
            }}
          />
        </div>

        {/* Pagination section */}
        <Pagination
          from={templates?.from || 0}
          to={templates?.to || 0}
          total={templates?.total || 0}
          links={templates?.links}
          entityName={t('templates')}
          currentPerPage={pageFilters.per_page?.toString() || '10'}
          onPerPageChange={(value) => {
            router.get(
              route('email-templates.index'),
              {
                page: 1,
                search: searchTerm || undefined,
                sort_field: pageFilters.sort_field || undefined,
                sort_direction: pageFilters.sort_direction || undefined,
                ...(parseInt(value) !== 10 && {
                  per_page: parseInt(value),
                }),
              },
              {
                preserveState: true,
                preserveScroll: true,
              }
            )
          }}
          onPageChange={(url) =>
            router.get(url, {}, {
              preserveState: true,
              preserveScroll: true,
            })
          }
        />
      </div>
    </PageTemplate>
  )
}