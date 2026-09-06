import React from 'react';

interface ButtonProps {
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    variant?: 'primary' | 'secondary' | 'danger';
    className?: string;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
}

export default function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }: ButtonProps) {
    // Pill shape is a hard rule in the source system — buttons are never squared.
    const baseStyles = 'px-[30px] py-[14px] flex items-center justify-center gap-2 rounded-full font-bold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

    const variants = {
        // button-buy-cta: cobalt pill — this app's primary in-product action color
        primary: 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500 active:scale-[0.98]',
        // button-secondary: transparent, 2px ink outline — no fill
        secondary: 'bg-transparent border-2 border-ink-deep dark:border-slate-200 text-ink-deep dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-slate-400',
        // Critical/destructive action, still pill-shaped
        danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 focus:ring-red-400',
    };

    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${className}`}>
            {children}
        </button>
    );
}
