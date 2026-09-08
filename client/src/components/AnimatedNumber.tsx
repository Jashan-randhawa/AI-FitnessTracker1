import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue } from "framer-motion";

type AnimatedNumberProps = {
  /** Target numeric value to count up (or down) to */
  value: number;
  /** Decimal places to show (default 0 = whole numbers) */
  decimals?: number;
  /** Tween duration in seconds */
  duration?: number;
  /** Add thousands separators (1,850 instead of 1850) */
  formatThousands?: boolean;
  className?: string;
};

/**
 * Counts up (or down) from its previous value to `value` on every change,
 * using an ease-out curve. On first mount it counts up from 0, matching the
 * "rolling number counter" pattern for dashboard stats (calories, steps,
 * grams, etc.) instead of the number snapping into place.
 */
const AnimatedNumber = ({
  value,
  decimals = 0,
  duration = 0.7,
  formatThousands = true,
  className,
}: AnimatedNumberProps) => {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  const hasMounted = useRef(false);

  useEffect(() => {
    const from = hasMounted.current ? motionValue.get() : 0;
    hasMounted.current = true;

    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1], // cubic-bezier ease-out
      onUpdate: (latest) => {
        motionValue.set(latest);
        setDisplay(latest);
      },
    });

    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const rounded = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
  const formatted = formatThousands
    ? Number(rounded).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : rounded;

  return <span className={className}>{formatted}</span>;
};

export default AnimatedNumber;
