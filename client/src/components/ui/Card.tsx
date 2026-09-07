import React from 'react'

const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
    // Elevation 0 (flat): Luffu uses zero box-shadows anywhere — depth comes
    // from background-color layering (Parchment → Linen → Pressed Cotton)
    // only, at a restrained 6px rectilinear radius.
    return (
        <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 transition-colors duration-200 ${className}`}>
            {children}
        </div>
    );
}

export default Card