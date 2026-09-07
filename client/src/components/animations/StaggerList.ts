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
