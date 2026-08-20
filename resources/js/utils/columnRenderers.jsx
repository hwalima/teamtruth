import React from 'react';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Switch } from '@/components/ui/switch';
import { Calendar } from "lucide-react";

// Simple renderers without TypeScript types
export const columnRenderers = {
  // Status badge renderer
  status: (colorMap = {}, defaultColor = 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20') => {
    return (value) => {
      if (value === null || value === undefined) return <span>-</span>;

      // Handle boolean status values
      if (typeof value === 'boolean') {
        return (
          <span className={cn(
            'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize',
            value
              ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
              : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
          )}>
            {value ? 'Active' : 'Inactive'}
          </span>
        );
      }

      const color = colorMap[value] || defaultColor;
      return (
        <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize', color)}>
          {value}
        </span>
      );
    };
  },
  
  // Image renderer
  image: (className = 'h-16 w-20 rounded-md object-cover shadow-sm', fallbackSrc = 'https://placehold.co/200x150?text=Image+Not+Found') => {
    return (value, row) => {
      if (!value) return <div className="text-center text-gray-400">No image</div>;
      
      const imageSrc = typeof value === 'string' && value.startsWith('http') 
        ? value 
        : `/storage/${value}`;
      
      return (
        <div className="flex justify-center">
          <img 
            src={imageSrc} 
            alt="Image" 
            className={className} 
            onError={(e) => {
              e.currentTarget.src = fallbackSrc;
            }}
          />
        </div>
      );
    };
  },
  
  // Price renderer
  price: (currency = 'USD', locale = 'en-US') => {
    return (value) => {
      if (value === null || value === undefined) return <span>-</span>;
      
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      
      return (
        <span className="text-sm font-medium">
          {numValue.toLocaleString(locale, { style: 'currency', currency })}
        </span>
      );
    };
  },
  
  // Date renderer with settings support
  date: (includeTime = false) => {
  return (value) => {
    if (!value) return <span>-</span>;

    try {
      let formatted;

      if (typeof window !== "undefined" && window.appSettings) {
        formatted = window.appSettings.formatDateTime(value, false);
      } else {
        const date = new Date(value);
        const options = includeTime
          ? { dateStyle: "medium", timeStyle: "short" }
          : { dateStyle: "medium" };

        formatted = date.toLocaleDateString("en-US", options);
      }

      return (
        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
          <Calendar className="h-3.5 w-3.5" />
          <span className="text-sm">
            {formatted}
          </span>
        </div>
      );
    } catch (e) {
      return <span className="text-sm text-gray-500">{value}</span>;
    }
  };
},
  
  // Boolean renderer
  boolean: () => {
    return (value) => <span>{value ? 'Yes' : 'No'}</span>;
  },
  
  // Relation renderer
  relation: (field) => {
    return (value, row) => {
      if (!row) return <span>-</span>;
      return row && row[field] ? <span>{row[field]}</span> : <span>-</span>;
    };
  },
  
  // Link renderer - for making a column value clickable
  link: (getUrl, className = 'text-blue-600 hover:underline', newTab = false) => {
    return (value, row) => {
      if (!value) return <span>-</span>;
      
      const url = typeof getUrl === 'function' ? getUrl(row) : getUrl.replace(':id', row.id);
      
      return (
        <Link 
          href={url} 
          className={className}
          target={newTab ? '_blank' : undefined}
        >
          {value}
        </Link>
      );
    };
  },
  
  // Button renderer - for adding a button in a column
  button: (label, getUrl, className = 'px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600', newTab = false) => {
    return (value, row) => {
      const url = typeof getUrl === 'function' ? getUrl(row) : getUrl.replace(':id', row.id);
      
      return (
        <Link 
          href={url} 
          className={className}
          target={newTab ? '_blank' : undefined}
        >
          {label}
        </Link>
      );
    };
  },
  
  // Switch renderer - for status toggles
  switch: (onToggle, disabled = false) => {
    return (value, row) => {
      const handleToggle = () => {
        if (!disabled && onToggle) {
          onToggle(row.id, !value);
        }
      };
      
      return React.createElement('div', { className: 'flex items-center justify-center' }, [
        React.createElement(Switch, {
          key: 'switch',
          checked: !!value,
          onCheckedChange: handleToggle,
          disabled
        })
      ]);
    };
  }
};