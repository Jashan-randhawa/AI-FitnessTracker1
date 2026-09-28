import { type ReactNode } from "react";

interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
    return (
        <div className="relative group flex items-center">
            {children}
            <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-xs rounded-md shadow-lg z-50 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                {content}
            </div>
        </div>
    );
}
