import { CrudConfig } from '@/types/crud';
import { columnRenderers } from '@/utils/columnRenderers';
import { t } from '@/utils/i18n';

export const planRequestsConfig: CrudConfig = {
  entity: {
    name: 'planRequests',
    endpoint: route('plan-requests.index'),
    permissions: {
      view: 'view-plan-requests',
      create: 'create-plan-requests',
      edit: 'edit-plan-requests',
      delete: 'delete-plan-requests'
    }
  },
  modalSize: '4xl',
  description: t('Manage plan upgrade requests from users'),
  table: {
    columns: [
      { key: 'user.name', label: t('Name'), sortable: true },
      { 
        key: 'plan.name', 
        label: t('Plan'), 
        sortable: true,
        render: columnRenderers.status({}, 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20')
      },
      { 
        key: 'duration', 
        label: t('Duration'), 
        render: (value) => value === 'yearly' ? t('Yearly') : t('Monthly')
      },
      { 
        key: 'status', 
        label: t('Status'), 
        render: columnRenderers.status({
          pending:   'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
          approved:  'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
          rejected:  'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
          cancelled: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
        })
      },
      { 
        key: 'created_at', 
        label: t('Request Date'), 
        sortable: true, 
        render: columnRenderers.date() 
      }
    ],
    actions: [
      { 
        label: t('Approve'), 
        icon: 'Check', 
        action: 'approve', 
        className: 'text-green-600',
        condition: (item: any) => item.status === 'pending'
      },
      { 
        label: t('Reject'), 
        icon: 'X', 
        action: 'reject', 
        className: 'text-red-600',
        condition: (item: any) => item.status === 'pending'
      }
    ]
  },
  search: {
    enabled: true,
    placeholder: t('Search plan requests...'),
    fields: ['user.name', 'user.email', 'plan.name']
  },
  filters: [
    {
      key: 'status',
      label: t('Status'),
      type: 'select',
      options: [
        { value: 'all', label: t('All Status') },
        { value: 'pending', label: t('Pending') },
        { value: 'approved', label: t('Approved') },
        { value: 'rejected', label: t('Rejected') },
      ]
    }
  ],
  form: {
    fields: []
  }
};