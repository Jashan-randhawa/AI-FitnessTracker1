import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SyncStatusIndicator } from "../components/sync/SyncStatusIndicator";
import { SyncQueueSheet } from "../components/sync/SyncQueueSheet";
import { OfflineSyncProvider } from "../offline/OfflineSyncContext";
import {
  enqueue,
  clearAll,
  setCurrentUserId,
  offlineQueueStore,
} from "../offline";
import { MemoryStorageAdapter } from "../offline/storage";

vi.mock("../Context/AppContext", () => ({
  useappcontext: () => ({
    user: { id: "user_test", username: "tester", email: "test@example.com" },
    logout: vi.fn(),
  }),
}));

vi.mock("../configs/api", () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SyncStatusIndicator & SyncQueueSheet Component Tests", () => {
  let memoryStorage: MemoryStorageAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    memoryStorage = new MemoryStorageAdapter();
    offlineQueueStore.setAdapter(memoryStorage);
    setCurrentUserId("user_test");
    await clearAll();

    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  it("renders 'Synced' state subtly when online and queue is empty", () => {
    render(
      <OfflineSyncProvider>
        <SyncStatusIndicator variant="pill" />
      </OfflineSyncProvider>
    );

    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("All changes synced");
  });

  it("renders 'will sync later' / 'Offline' state when navigator is offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    render(
      <OfflineSyncProvider>
        <SyncStatusIndicator variant="pill" />
      </OfflineSyncProvider>
    );

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Device is offline. Changes will sync later."
    );
  });

  it("renders 'waiting' state when pending items exist", async () => {
    await enqueue("water_add", { amount: 500 });

    render(
      <OfflineSyncProvider>
        <SyncStatusIndicator variant="pill" />
      </OfflineSyncProvider>
    );

    expect(screen.getByText("1 waiting")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 offline changes waiting to sync"
    );
  });

  it("renders 'Sign in to sync' when items require authentication", async () => {
    const item = await enqueue("water_add", { amount: 250 });
    item.status = "needs_auth";
    await memoryStorage.updateItem(item);
    await offlineQueueStore.refreshSnapshot();

    render(
      <OfflineSyncProvider>
        <SyncStatusIndicator variant="pill" />
      </OfflineSyncProvider>
    );

    expect(screen.getByText("Sign in to sync")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Authentication needed to sync offline entries"
    );
  });

  it("renders 'need attention' when failed or expired items exist", async () => {
    const item = await enqueue("food_add", { name: "Oatmeal", calories: 300 });
    item.status = "failed";
    item.lastErrorMessage = "Invalid caloric boundary";
    await memoryStorage.updateItem(item);
    await offlineQueueStore.refreshSnapshot();

    render(
      <OfflineSyncProvider>
        <SyncStatusIndicator variant="pill" />
      </OfflineSyncProvider>
    );

    expect(screen.getByText("1 need attention")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 offline changes need attention"
    );
  });

  it("opens BottomSheet on indicator tap and displays items with plain explanations", async () => {
    const item1 = await enqueue("weight_log", {
      weightKg: 80,
      date: new Date().toISOString(),
    });
    item1.status = "conflict";
    await memoryStorage.updateItem(item1);

    const item2 = await enqueue("water_add", { amount: 500 });
    item2.status = "expired";
    await memoryStorage.updateItem(item2);
    await offlineQueueStore.refreshSnapshot();

    render(
      <OfflineSyncProvider>
        <SyncStatusIndicator variant="pill" />
        <SyncQueueSheet />
      </OfflineSyncProvider>
    );

    const indicatorBtn = screen.getByRole("button", {
      name: /tap to view offline queue/i,
    });
    fireEvent.click(indicatorBtn);

    // BottomSheet opens
    expect(screen.getByText("Offline Sync Queue")).toBeInTheDocument();
    expect(screen.getByText("Weight Entry")).toBeInTheDocument();
    expect(
      screen.getByText("A newer weigh-in for that day was kept.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Item expired after 14 days offline.")
    ).toBeInTheDocument();
  });

  it("requires confirmation before discarding an entry in the sheet", async () => {
    const item = await enqueue("food_add", { name: "Snack", calories: 150 });
    item.status = "failed";
    await memoryStorage.updateItem(item);
    await offlineQueueStore.refreshSnapshot();

    render(
      <OfflineSyncProvider>
        <SyncStatusIndicator variant="pill" />
        <SyncQueueSheet />
      </OfflineSyncProvider>
    );

    const indicatorBtn = screen.getByRole("button", {
      name: /tap to view offline queue/i,
    });
    fireEvent.click(indicatorBtn);

    const discardBtn = screen.getByRole("button", { name: /discard/i });
    fireEvent.click(discardBtn);

    // Should prompt confirmation
    expect(screen.getByText("Discard entry?")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /^confirm$/i });
    fireEvent.click(confirmBtn);

    // Once discarded, queue is empty
    await waitFor(() => {
      expect(offlineQueueStore.getSnapshot().counts.total).toBe(0);
    });
  });
});
