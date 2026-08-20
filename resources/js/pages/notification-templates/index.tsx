import { useEffect, useRef, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { PageTemplate } from '@/components/page-template'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Eye, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CrudTable } from '@/components/CrudTable'
import { Pagination } from '@/components/ui/pagination'

interface NotificationTemplate {
  id: number
  name: string
  type: string
  created_at: string
  notification_template_langs: Array<{
    id: number
    lang: string
    title: string
  }>
}

interface Props {
  templates: {
    data: NotificationTemplate[]
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

export default function NotificationTemplatesIndex({ templates, filters: pageFilters = {} }: Props) {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '')
  const [activeType, setActiveType] = useState(pageFilters.type || 'slack')

  const notificationTypes = [
    { id: 'slack', label: 'Slack' },
    { id: 'telegram', label: 'Telegram' },
  ]
  const handleAction = (action: string, item: NotificationTemplate) => {
    if (action === 'view') {
      router.get(route('notification-templates.show', item.id))
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

    params.type = activeType

    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page
    }

    router.get(route('notification-templates.index'), params, { preserveState: true, preserveScroll: true })
  }

  const handleTypeChange = (type: string) => {
    setActiveType(type)
    const params: any = { page: 1 }

    if (searchTerm) {
      params.search = searchTerm
    }

    params.type = type

    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page
    }

    router.get(route('notification-templates.index'), params, { preserveState: true, preserveScroll: true })
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

    params.type = activeType

    if (pageFilters.per_page) {
      params.per_page = pageFilters.per_page
    }

    router.get(route('notification-templates.index'), params, { preserveState: true, preserveScroll: true })
  }

  const breadcrumbs = [
    { title: t("Dashboard"), href: route('dashboard') },
    { title: t("Notification Templates") }
  ]

  const columns = [
    {
      key: 'name',
      label: t("Name"),
      sortable: true
    }
  ]
const isInitialMount = useRef(true);

useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const timer = setTimeout(() => {
        router.get(route('notification-templates.index'), {
            page: 1,
            search: searchTerm || undefined,
            type: activeType,
            ...(pageFilters.per_page && { per_page: pageFilters.per_page }),
            ...(pageFilters.sort_field && { sort_field: pageFilters.sort_field, sort_direction: pageFilters.sort_direction }),
        }, { preserveState: true, preserveScroll: true });
    }, 400);
    return () => clearTimeout(timer);
}, [searchTerm]);

  return (
    <PageTemplate
      title={t("Notification Templates")}
      description={t("Manage system notification templates for automated messages.")}
      url={route('notification-templates.index')}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      <Head title={t("Notification Templates")} />

      <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
        <div className="w-full p-3">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <form onSubmit={handleSearch} className="flex gap-2">
                          <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t("Search templates...")}
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full pl-9"
                            />
                            {searchTerm && <X className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setSearchTerm('')} />}

                          </div>
                        </form>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="border rounded-md p-0.5 mr-2">
                          <Tabs value={activeType} onValueChange={handleTypeChange}>
                            <TabsList className="grid w-fit grid-cols-2">
                              <TabsTrigger value="slack" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t('Slack')}</TabsTrigger>
                              <TabsTrigger value="telegram" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t('Telegram')}</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>
                      </div>
                    </div>
                  </div>
            </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={columns}
          actions={[{
            label: t('View'),
            icon: 'Eye',
            action: 'view',
            className: 'text-gray-500 hover:text-gray-700'
          }]}
          data={templates?.data || []}
          from={templates?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={[]}
        />

        <Pagination
          from={templates?.from || 0}
          to={templates?.to || 0}
          total={templates?.total || 0}
          links={templates?.links}
          entityName={t('templates')}
          currentPerPage={pageFilters.per_page?.toString() || '10'}
          onPerPageChange={(value) => {
            const params: any = { page: 1, per_page: parseInt(value), type: activeType };
            if (searchTerm) params.search = searchTerm;
            router.get(route('notification-templates.index'), params, { preserveState: true, preserveScroll: true });
          }}
          onPageChange={(url) => {
            const pageUrl = new URL(url, window.location.origin);
            pageUrl.searchParams.set('type', activeType);
            if (searchTerm) pageUrl.searchParams.set('search', searchTerm);
            router.get(pageUrl.pathname + pageUrl.search);
          }}
        />
      </div>
    </PageTemplate>
  )
}