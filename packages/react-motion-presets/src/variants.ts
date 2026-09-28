import type { Variants } from 'framer-motion';

/**
 * Checks whether user prefers reduced motion (SSR safe).
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Standard container variant for staggered reveals (50ms per item).
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

/**
 * Fast container variant (30ms per item) for dense item lists.
 */
export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.01,
    },
  },
};

/**
 * Item variant with smooth spring-based rise and opacity fade-in.
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.18,
      ease: 'easeOut',
    },
  },
};

/**
 * Slide-in from left variant.
 */
export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 22,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
};

/**
 * Slide-in from right variant.
 */
export const slideRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 22,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
};

/**
 * Scale-up entrance variant for cards/tiles.
 */
export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 26,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
};

/**
 * Reduced motion fallback variant (pure opacity cross-fade).
 */
export const reducedMotionItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

// Aliases matching original FitTrack AI names
export const StaggerContainer = staggerContainer;
export const StaggerContainerFast = staggerFast;
export const StaggerItem = staggerItem;
export const StaggerItemSlideLeft = slideLeft;
export const StaggerItemSlideRight = slideRight;
export const StaggerItemScaleUp = scaleUp;
