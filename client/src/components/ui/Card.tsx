import React from 'react'

const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
    // Elevation 0 (flat): no shadow, xxxl rounding + hairline-soft border —
    // the source system reserves shadow for sticky/commerce panels only.
    return (
        <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 transition-colors duration-200 ${className}`}>
            {children}
        </div>
    );
}

export default Card