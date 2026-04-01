import React from 'react'

const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
    return (
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors duration-200 ${className}`}>
            {children}
        </div>
    );
}

export default Card