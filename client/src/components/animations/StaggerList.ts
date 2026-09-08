import type { Variants } from "framer-motion";

/**
 * Container variant for staggered list reveals (50ms per item).
 */
export const StaggerContainer: Variants = {
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
 * Faster container variant (30ms stagger) for dense lists.
 */
export const StaggerContainerFast: Variants = {
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
export const StaggerItem: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.18,
      ease: "easeOut",
    },
  },
};

/**
 * Slide-in from left variant.
 */
export const StaggerItemSlideLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 22,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

/**
 * Slide-in from right variant.
 */
export const StaggerItemSlideRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 22,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

/**
 * Scale-up entrance variant for cards/tiles.
 */
export const StaggerItemScaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 26,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: "easeOut" },
  },
};
