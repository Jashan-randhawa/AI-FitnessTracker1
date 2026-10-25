import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveWorkoutTrackerModal } from '../components/animations/LiveWorkoutTrackerModal';

vi.mock('../Context/AppContext', () => ({
  useappcontext: () => ({
    setAllActivityLogs: vi.fn(),
  }),
}));

vi.mock('../services/aiAssistantClient', () => ({
  fetchWorkoutRecommendations: vi.fn().mockResolvedValue({
    recommendation: 'Target 65kg for 8 reps with 90s rest',
    suggestedSets: 3,
    suggestedWeight: 65,
    suggestedReps: 8,
  }),
}));

vi.mock('../configs/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { id: 'log-1' } }),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('LiveWorkoutTrackerModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with default exercise name and title', () => {
    const onClose = vi.fn();
    render(<LiveWorkoutTrackerModal onClose={onClose} defaultExercise="Incline Dumbbell Press" />);

    expect(screen.getByDisplayValue('Incline Dumbbell Press')).toBeInTheDocument();
    expect(screen.getByText('Live Workout Tracker')).toBeInTheDocument();
  });

  it('allows adding a new set', () => {
    const onClose = vi.fn();
    render(<LiveWorkoutTrackerModal onClose={onClose} />);

    const addSetBtn = screen.getByRole('button', { name: /\+ Add Next Set/i });
    fireEvent.click(addSetBtn);

    // Initial 3 sets + 1 added set = 4 sets
    expect(screen.getByText('0 / 4')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<LiveWorkoutTrackerModal onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
