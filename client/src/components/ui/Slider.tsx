import React from "react";

interface SliderProps {
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    className?: string;
    unit?: string;
    infoText?: string;
}

import { Info } from "lucide-react";
import Tooltip from "./Tooltip";

const Slider: React.FC<SliderProps> = ({ label, min = 0, max = 100, step = 1, value, onChange, className = "", unit = "", infoText }) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className={`w-full ${className}`}>
            {label && (
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
                        {infoText && (
                            <Tooltip content={infoText}>
                                <Info className="size-4 text-slate-400 hover:text-emerald-500 cursor-help transition-colors" />
                            </Tooltip>
                        )}
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {value} {unit}
                    </span>
                </div>
            )}
            <div className="relative w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer">
                {/* Track fill */}
                <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />

                {/* Thumb input */}
                <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer z-10" />

                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-500 rounded-full shadow-md pointer-events-none transition-transform duration-75 ease-out" style={{ left: `calc(${percentage}% - 8px)` }} />
            </div>
        </div>
    );
};

export default Slider;
