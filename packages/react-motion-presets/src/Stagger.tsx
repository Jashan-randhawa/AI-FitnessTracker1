import React from 'react';
import { motion } from 'framer-motion';
import { StaggerContainerProps, StaggerItemProps } from './types';
import { staggerContainer, staggerItem } from './variants';

export const MotionStaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  variants = staggerContainer,
  className = '',
  ...props
}) => {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="show"
      className={className}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
};

export const MotionStaggerItem: React.FC<StaggerItemProps> = ({
  children,
  variants = staggerItem,
  className = '',
  ...props
}) => {
  return (
    <motion.div variants={variants} className={className} {...(props as any)}>
      {children}
    </motion.div>
  );
};
