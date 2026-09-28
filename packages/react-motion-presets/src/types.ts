import React from 'react';
import type { Variants } from 'framer-motion';

export interface AnimatedNumberProps {
  /** Target numeric value to count up (or down) to */
  value: number;
  /** Decimal places to show (default 0) */
  decimals?: number;
  /** Tween duration in seconds (default 0.7) */
  duration?: number;
  /** Add thousands separators (e.g. 1,850 instead of 1850) */
  formatThousands?: boolean;
  className?: string;
}

export interface StreamingWordRevealProps {
  /** Markdown/plain text string to reveal word by word */
  text: string;
  className?: string;
  /** Stagger delay between words in seconds (default: 0.025) */
  staggerDelay?: number;
}

export interface CollapsibleCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export interface StaggerContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variants?: Variants;
  className?: string;
}

export interface StaggerItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variants?: Variants;
  className?: string;
}
