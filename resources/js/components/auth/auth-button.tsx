import { LoaderCircle } from 'lucide-react';
import { ButtonHTMLAttributes } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { THEME_COLORS } from '@/hooks/use-appearance';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    processing?: boolean;
    tabIndex?: number;
    children: React.ReactNode;
}

export default function AuthButton({ 
    processing = false, 
    tabIndex, 
    children, 
    className = '', 
    disabled, 
    ...props 
}: AuthButtonProps) {
    const { themeColor, customColor } = useBrand();
    const primaryColor = themeColor === 'custom' ? customColor : THEME_COLORS[themeColor as keyof typeof THEME_COLORS];
    return (
        <button 
            {...props}
            type={props.type || 'submit'} 
            className={`w-full font-semibold py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 ${className}`}
            tabIndex={tabIndex} 
            disabled={processing || disabled}
            style={{ backgroundColor: '#E3B448', color: '#001a4d' }}
        >
            {processing && <LoaderCircle className="h-4 w-4 animate-spin mr-2 inline" />}
            {children}
        </button>
    );
}