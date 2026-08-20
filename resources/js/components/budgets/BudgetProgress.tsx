import React from 'react';
import { Clock, TrendingUp, TrendingDown, AlertTriangle, FileText, Tag } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';

interface BudgetProgressProps {
    budget: {
        total_budget: number;
        total_spent: number;
        remaining_budget: number;
        utilization_percentage: number;
        currency: string;
        categories: Array<{
            id: number;
            name: string;
            allocated_amount: number;
            total_spent: number;
            utilization_percentage: number;
            color: string;
            description?: string;
        }>;
    };
    selectedCategoryId?: number | null;
    onCategoryClick?: (id: number) => void;
    expensesByCategory?: Record<number, { total: number; pending: number }>;
}

export default function BudgetProgress({ budget, selectedCategoryId, onCategoryClick, expensesByCategory = {} }: BudgetProgressProps) {
    const { t } = useTranslation();

    if (!budget.categories?.length) return null;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden lg:sticky lg:top-4">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('Budget Categories')}</p>
                    <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20">
                        {budget.categories.length} {t('categories')}
                    </span>
                </div>
            </div>

            {/* List */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[550px] overflow-auto">
                {budget.categories.map((category) => {
                    const pct = category.utilization_percentage || 0;
                    const isSelected = selectedCategoryId === category.id;
                    const catExpenses = expensesByCategory[category.id] || { total: 0, pending: 0 };

                    return (
                        <button
                            key={category.id}
                            onClick={() => onCategoryClick?.(category.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                                isSelected
                                    ? 'bg-primary/5 dark:bg-primary/10 border-r-2 border-r-primary'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                        >
                            {/* Icon box */}
                             <div
                                className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: category.color + '20', color: category.color }}
                                
                            >
                                <Tag className="h-5 w-5" />
                            </div>

                            {/* Name + amount */}
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate leading-tight ${
                                    isSelected ? 'text-primary' : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                    {category.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
                                        <span className="font-mono">{formatCurrency(category.total_spent || 0)}</span> {t('spent')}
                                    </span>
                                    <span className="text-[10px] text-gray-300 dark:text-gray-600">•</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
                                       <span className="font-mono">{formatCurrency((category.allocated_amount || 0) - (category.total_spent || 0))}</span>  {t('left')}
                                    </span>
                                    {catExpenses.pending > 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                            <Clock className="h-2.5 w-2.5" />
                                            {catExpenses.pending}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Count badge */}
                            <span className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                                isSelected
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            }`}>
                                {catExpenses.total}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
