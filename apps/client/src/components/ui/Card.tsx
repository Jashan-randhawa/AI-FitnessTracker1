import React from 'react'

const Card = ({ children, className = '', hoverLift = false }: { children: React.ReactNode, className?: string, hoverLift?: boolean }) => {
    // Elevation 0 (flat): Luffu uses zero box-shadows anywhere — depth comes
    // from background-color layering (Parchment → Linen → Pressed Cotton)
    // only, at a restrained 6px rectilinear radius.
    // hoverLift: opt-in subtle lift + shadow on hover for interactive cards.
    const hoverCls = hoverLift ? 'hover:-translate-y-1 hover:shadow-lg cursor-pointer' : '';
    return (
        <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 transition-all duration-200 ${hoverCls} ${className}`}>
            {children}
        </div>
    );
}

export default Card