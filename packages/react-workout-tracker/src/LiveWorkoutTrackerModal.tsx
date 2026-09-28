import React from 'react';
import { motion } from 'framer-motion';
import { LiveWorkoutTrackerModalProps } from './types';
import { WorkoutTracker } from './WorkoutTracker';

export const LiveWorkoutTrackerModal: React.FC<LiveWorkoutTrackerModalProps> = ({
  onClose,
  defaultExercise = 'Barbell Bench Press',
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative z-10 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <WorkoutTracker
          defaultExercise={defaultExercise}
          onClose={onClose}
          celebrate={true}
        />
      </motion.div>
    </div>
  );
};

export default LiveWorkoutTrackerModal;
