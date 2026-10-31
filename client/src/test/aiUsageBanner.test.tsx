import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AIAssistant from '../Pages/AIAssistant';

// Mock contexts and external hooks
vi.mock('../Context/AppContext', () => ({
  useappcontext: () => ({
    user: { _id: 'u123', name: 'Test User' },
    setAllFoodLogs: vi.fn(),
    setAllActivityLogs: vi.fn(),
    setAllWaterLogs: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '', state: null }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../data/summaryStore', () => ({
  useDaySummary: () => ({ data: null }),
  invalidateSummaries: vi.fn(),
}));

vi.mock('../data/weatherStore', () => ({
  getWeatherObservation: () => null,
}));

vi.mock('../hooks/fitbot/useActiveWorkoutPlan', () => ({
  useActiveWorkoutPlan: () => ({ activePlan: null, refreshPlan: vi.fn() }),
}));

vi.mock('../hooks/fitbot/usePastSessions', () => ({
  usePastSessions: () => ({ pastSessions: [], refreshSessions: vi.fn() }),
}));

vi.mock('../hooks/fitbot/useChatSessionPersistence', () => ({
  useChatSessionPersistence: () => ({
    sessionId: 'session-123',
    saveSession: vi.fn(),
    startNewSession: vi.fn(),
    loadSessionById: vi.fn(),
  }),
}));

const mockApiGet = vi.fn();
vi.mock('../configs/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
  API_URL: 'http://localhost:5000',
}));

if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn();
}

describe('AIAssistant AI Budget Banner & Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders no budget banner when usage is below 80%', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: {
        percentUsed: 45,
        isExhausted: false,
        remainingTokens: 27500,
        remainingCalls: 55,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
      },
    });

    render(<AIAssistant />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/ai/usage');
    });

    expect(screen.queryByTestId('ai-budget-warning-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-budget-exhausted-banner')).not.toBeInTheDocument();
  });

  it('renders warning banner when usage is at or above 80% but not exhausted', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: {
        percentUsed: 85,
        isExhausted: false,
        remainingTokens: 7500,
        remainingCalls: 15,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
      },
    });

    render(<AIAssistant />);

    await waitFor(() => {
      expect(screen.getByTestId('ai-budget-warning-banner')).toBeInTheDocument();
    });

    expect(screen.getByText(/AI usage today:/i)).toBeInTheDocument();
    expect(screen.getByText(/85% used/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ai-budget-exhausted-banner')).not.toBeInTheDocument();
  });

  it('renders exhausted banner and disables input when budget is exhausted', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: {
        percentUsed: 100,
        isExhausted: true,
        remainingTokens: 0,
        remainingCalls: 0,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
      },
    });

    render(<AIAssistant />);

    await waitFor(() => {
      expect(screen.getByTestId('ai-budget-exhausted-banner')).toBeInTheDocument();
    });

    expect(screen.getByText(/Daily AI budget reached:/i)).toBeInTheDocument();
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();

    const sendBtn = screen.getByTitle('Daily AI budget exceeded');
    expect(sendBtn).toBeDisabled();
  });
});
