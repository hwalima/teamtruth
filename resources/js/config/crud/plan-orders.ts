import { CrudConfig } from '@/types/crud';
import { columnRenderers } from '@/utils/columnRenderers';
import { t } from '@/utils/i18n';

export const planOrdersConfig: CrudConfig = {
  entity: {
    name: 'plan-orders',
    endpoint: route('plan-orders.index'),
    permissions: {
      view: 'view-plan-orders',
      create: 'create-plan-orders',
      edit: 'edit-plan-orders',
      delete: 'delete-plan-orders'
    }
  },
  modalSize: '4xl',
  description: t('Manage plan orders and subscription requests'),
  table: {
    columns: [
      { key: 'order_number', label: t('Order Number'), sortable: true },
      { 
        key: 'ordered_at', 
        label: t('Order Date'), 
        sortable: true, 
        render: columnRenderers.date() 
      },
      { 
        key: 'user.name', 
        label: t('User'), 
        sortable: true 
      },
      { 
        key: 'plan.name', 
        label: t('Plan'), 
        sortable: true,
        render: columnRenderers.status({}, 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20')
      },
      { 
        key: 'original_price', 
        label: t('Original Price'), 
        render: (value) => {
          if (typeof window !== "undefined" && window.appSettings?.formatCurrency) {
            return window.appSettings.formatCurrency(parseFloat(value));
          }
          return `${parseFloat(value).toFixed(2)}`;
        }
      },
      { 
        key: 'coupon_code', 
        label: t('Coupon Code'), 
        render: (value) => value || '-'
      },
      { 
        key: 'discount_amount', 
        label: t('Discount'), 
        render: (value) => {
          if (value > 0) {
            if (typeof window !== "undefined" && window.appSettings?.formatCurrency) {
              return `-${window.appSettings.formatCurrency(parseFloat(value))}`;
            }
            return `-${parseFloat(value).toFixed(2)}`;
          }
          return '-';
        }
      },
      { 
        key: 'final_price', 
        label: t('Final Price'), 
        render: (value) => {
          if (typeof window !== "undefined" && window.appSettings?.formatCurrency) {
            return window.appSettings.formatCurrency(parseFloat(value));
          }
          return `${parseFloat(value).toFixed(2)}`;
        }
      },
      { 
        key: 'status', 
        label: t('Status'), 
        render: columnRenderers.status({
          pending:   'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
          approved:  'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
          rejected:  'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
        })
      }
    ],
    actions: [
      { 
        label: t('Approve'), 
        icon: 'Check', 
        action: 'approve', 
        className: 'text-green-600',
        condition: (row: any) => row.status === 'pending'
      },
      { 
        label: t('Reject'), 
        icon: 'X', 
        action: 'reject', 
        className: 'text-red-600',
        condition: (row: any) => row.status === 'pending'
      },
      {
        label: t('View Details'),
        icon: 'Eye',
        action: 'view',
        className: 'text-blue-600',
        condition: (row: any) => row.status === 'pending'
      }
    ]
  },
  search: {
    enabled: true,
    placeholder: t('Search orders...'),
    fields: ['order_number', 'user.name', 'plan.name', 'coupon_code']
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
        { value: 'rejected', label: t('Rejected') }
      ]
    }
  ],
  form: {
    fields: []
  }
};