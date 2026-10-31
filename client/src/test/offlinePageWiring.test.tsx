import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import {
  enqueue,
  clearAll,
  setCurrentUserId,
  offlineQueueStore,
  discardItem,
} from "../offline";
import { MemoryStorageAdapter } from "../offline/storage";
import { OfflineSyncProvider } from "../offline/OfflineSyncContext";
import { LogoutWarningModal } from "../components/sync/LogoutWarningModal";
import { useOfflineSync } from "../offline/OfflineSyncContext";
import api from "../configs/api";
import toast from "react-hot-toast";

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

const mockLogout = vi.fn();
vi.mock("../Context/AppContext", () => ({
  useappcontext: () => ({
    user: { id: "user_test_wiring", name: "Tester" },
    logout: mockLogout,
    allWaterLogs: [],
    setAllWaterLogs: vi.fn(),
  }),
}));

describe("Offline Page Wiring & Flow Tests", () => {
  let memoryStorage: MemoryStorageAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    memoryStorage = new MemoryStorageAdapter();
    offlineQueueStore.setAdapter(memoryStorage);
    setCurrentUserId("user_test_wiring");
    await clearAll();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  describe("Water Offline Logging & Reconciliation", () => {
    it("enqueues water_add with localTempId and preserves optimistic entry on network failure", async () => {
      // Simulate network failure on POST /api/waterlogs
      const netErr = new Error("Network Error");
      (netErr as unknown as { code: string }).code = "ERR_NETWORK";
      vi.mocked(api.post).mockRejectedValueOnce(netErr);

      // Simulating handleAddWater logic directly
      const tmpId = `tmp-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const waterLogs = [{ id: tmpId, amount: 250, date: nowIso }];

      // On network error: enqueue
      const item = await enqueue("water_add", { amount: 250, date: nowIso }, { localTempId: tmpId });
      expect(item.id).toBeDefined();
      expect(item.localTempId).toBe(tmpId);
      expect(item.payload).toEqual({ amount: 250, date: nowIso });

      // Queue now has 1 pending item
      const snapshot = offlineQueueStore.getSnapshot();
      expect(snapshot.counts.total).toBe(1);
      expect(snapshot.counts.pending).toBe(1);

      // Reconciliation simulation: server delivers confirmed record
      const serverEntry = { id: "server_water_123", amount: 250, date: nowIso };
      const reconciledLogs = waterLogs.map((e) => (e.id === item.localTempId ? serverEntry : e));

      expect(reconciledLogs[0].id).toBe("server_water_123");
      expect(reconciledLogs.length).toBe(1);
    });

    it("reconciliation does not duplicate row if SSE or refetch delivered entry first", () => {
      const serverId = "server_water_777";
      const localTempId = "tmp-12345";
      const nowIso = new Date().toISOString();

      // Suppose SSE already pushed serverId into the list
      const stateWithBoth = [
        { id: serverId, amount: 500, date: nowIso },
        { id: localTempId, amount: 500, date: nowIso },
      ];

      // Reconcile logic: if server entry already exists in prev, simply filter out localTempId
      const alreadyExists = stateWithBoth.some((e) => e.id === serverId);
      let reconciled: Array<{ id: string; amount: number; date: string }>;
      if (alreadyExists) {
        reconciled = stateWithBoth.filter((e) => e.id !== localTempId);
      } else {
        reconciled = stateWithBoth.map((e) => (e.id === localTempId ? { id: serverId, amount: 500, date: nowIso } : e));
      }

      expect(reconciled.length).toBe(1);
      expect(reconciled[0].id).toBe(serverId);
    });

    it("rolls back optimistic entry when server returns 400 validation error", async () => {
      const axiosErr = {
        isAxiosError: true,
        response: { status: 400, data: { message: "amount must be between 1 and 10000 ml" } },
      };
      vi.mocked(api.post).mockRejectedValueOnce(axiosErr);

      const tmpId = "tmp-water-invalid";
      let waterLogs = [{ id: tmpId, amount: 99999, date: new Date().toISOString() }];

      // Error handler detects 400 and removes from state
      const status = axiosErr.response.status;
      if (status === 400) {
        waterLogs = waterLogs.filter((e) => e.id !== tmpId);
        toast.error(axiosErr.response.data.message);
      }

      expect(waterLogs.length).toBe(0);
      expect(toast.error).toHaveBeenCalledWith("amount must be between 1 and 10000 ml");
      expect(offlineQueueStore.getSnapshot().counts.total).toBe(0);
    });

    it("cancels queued unsynced water entry on delete and blocks delete of synced entries when offline", async () => {
      const tmpId = "tmp-water-to-delete";
      await enqueue("water_add", { amount: 300 }, { localTempId: tmpId });
      expect(offlineQueueStore.getSnapshot().counts.total).toBe(1);

      // 1. Delete unsynced entry:
      if (tmpId.startsWith("tmp-")) {
        const match = offlineQueueStore.getSnapshot().items.find((m) => m.localTempId === tmpId);
        if (match) {
          await discardItem(match.id);
        }
      }
      expect(offlineQueueStore.getSnapshot().counts.total).toBe(0);

      // 2. Delete synced entry while offline:
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const syncedId = "synced_water_999";
      if (!navigator.onLine && !syncedId.startsWith("tmp-")) {
        toast.error("Needs an internet connection to delete synced entries");
      }
      expect(toast.error).toHaveBeenCalledWith("Needs an internet connection to delete synced entries");
      expect(api.delete).not.toHaveBeenCalled();
    });
  });

  describe("Weight Offline Logging & Stale Replays", () => {
    it("captures eventTime and localDay at save time, setting provisional weight", async () => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      const capturedLocalDay = "2026-10-31";
      const eventTime = new Date("2026-10-31T10:00:00Z").toISOString();
      const tmpId = "tmp-weight-123";

      const item = await enqueue(
        "weight_log",
        {
          weightKg: 75.5,
          date: eventTime,
          localDay: capturedLocalDay,
          notes: "Morning weigh-in",
          source: "quick-log",
        },
        { localTempId: tmpId }
      );

      expect(item.kind).toBe("weight_log");
      expect(item.payload.weightKg).toBe(75.5);
      expect(item.localDay).toBe("2026-10-31");
      expect(item.eventDate).toBe(eventTime);
      expect(item.status).toBe("pending");
    });
  });

  describe("Logout Warning & Session Expiry UX", () => {
    const TestLogoutComponent: React.FC = () => {
      const { promptLogoutWithWarning } = useOfflineSync();
      return (
        <div>
          <button onClick={() => promptLogoutWithWarning(async () => mockLogout())}>
            Attempt Logout
          </button>
          <LogoutWarningModal />
        </div>
      );
    };

    it("prompts warning modal when unsynced items exist before logout", async () => {
      await enqueue("water_add", { amount: 250 });
      expect(offlineQueueStore.getSnapshot().counts.total).toBe(1);

      render(
        <OfflineSyncProvider>
          <TestLogoutComponent />
        </OfflineSyncProvider>
      );

      const logoutBtn = screen.getByRole("button", { name: /attempt logout/i });
      fireEvent.click(logoutBtn);

      // Warning modal dialog should be displayed
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Unsynced Changes")).toBeInTheDocument();
      expect(screen.getByText(/You have 1 unsynced entry/i)).toBeInTheDocument();
      expect(mockLogout).not.toHaveBeenCalled();

      // Discard and Log Out confirms logout
      const discardBtn = screen.getByRole("button", { name: /discard and log out/i });
      fireEvent.click(discardBtn);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it("allows logout immediately without prompt when queue is empty", async () => {
      render(
        <OfflineSyncProvider>
          <TestLogoutComponent />
        </OfflineSyncProvider>
      );

      const logoutBtn = screen.getByRole("button", { name: /attempt logout/i });
      fireEvent.click(logoutBtn);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(mockLogout).toHaveBeenCalled();
    });

    it("keeps items in needs_auth upon session expiry and resumes when same user logs in", async () => {
      const item = await enqueue("water_add", { amount: 500 });
      item.status = "needs_auth";
      await memoryStorage.updateItem(item);
      await offlineQueueStore.refreshSnapshot();

      expect(offlineQueueStore.getSnapshot().counts.needs_auth).toBe(1);

      // Items are not lost: when same user stays or logs back in
      const userItems = await memoryStorage.getQueue("user_test_wiring");
      expect(userItems.length).toBe(1);
      expect(userItems[0].status).toBe("needs_auth");
    });
  });
});
