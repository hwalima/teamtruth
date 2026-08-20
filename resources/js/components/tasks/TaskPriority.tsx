import React from 'react';
import { AlertTriangle, ArrowUp, Minus, ArrowDown } from 'lucide-react';

interface Props {
    priority: 'low' | 'medium' | 'high' | 'critical';
    showIcon?: boolean;
}

export default function TaskPriority({ priority, showIcon = false }: Props) {
    const getPriorityConfig = (priority: string) => {
        switch (priority) {
            case 'critical':
                return {
                    color: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
                    icon: AlertTriangle,
                    label: 'Critical'
                };
            case 'high':
                return {
                    color: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
                    icon: ArrowUp,
                    label: 'High'
                };
            case 'medium':
                return {
                    color: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
                    icon: Minus,
                    label: 'Medium'
                };
            case 'low':
                return {
                    color: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
                    icon: ArrowDown,
                    label: 'Low'
                };
            default:
                return {
                    color: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20',
                    icon: Minus,
                    label: 'Medium'
                };
        }
    };

    const config = getPriorityConfig(priority);
    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${config.color}`}>
            {showIcon && <Icon className="h-3 w-3 mr-1" />}
            {config.label}
        </span>
    );
}