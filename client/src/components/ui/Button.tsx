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
    // Rectilinear is a hard rule in the Luffu source system — buttons are
    // never pilled; 6px radius, no shadow, single-weight label text.
    const baseStyles = 'px-[24px] py-[12px] flex items-center justify-center gap-2 rounded-md font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

    const variants = {
        // Deep Ink fill — this system's one and only filled-action color
        primary: 'bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-[1.02] focus:ring-emerald-500 active:scale-[0.98]',
        // Ghost outline — transparent fill, 1px ink border, no shadow
        secondary: 'bg-transparent border border-ink-deep dark:border-slate-200 text-ink-deep dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-[1.02] focus:ring-slate-400 active:scale-[0.98]',
        // Critical/destructive action — the one disclosed exception to the
        // achromatic rule; still rectilinear, still no shadow
        danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:scale-[1.02] focus:ring-red-400 active:scale-[0.98]',
    };

    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${className}`}>
            {children}
        </button>
    );
}
