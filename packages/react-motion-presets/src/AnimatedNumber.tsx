import React, { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue } from 'framer-motion';
import { AnimatedNumberProps } from './types';
import { prefersReducedMotion } from './variants';

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  duration = 0.7,
  formatThousands = true,
  className,
}) => {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(value);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      motionValue.set(value);
      return;
    }

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
  }, [value, duration, motionValue]);

  const rounded =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
  const formatted = formatThousands
    ? Number(rounded).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : rounded;

  return <span className={className}>{formatted}</span>;
};

export default AnimatedNumber;
