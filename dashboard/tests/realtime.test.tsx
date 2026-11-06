import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "../src/context/AuthContext";
import { SocketProvider } from "../src/context/SocketProvider";
import { useSocket } from "../src/hooks/useSocket";
import { useAuth } from "../src/hooks/useAuth";
import { ServersPage } from "../src/pages/ServersPage";
import { AlertsPage } from "../src/pages/AlertsPage";
import { client } from "../src/api/client";
import { OverviewPage } from "../src/pages/OverviewPage";
const mock = vi.hoisted(() => ({
  handlers: new Map<string, (value?: unknown) => void>(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    active: true,
    on: (name: string, fn: (value?: unknown) => void) =>
      mock.handlers.set(name, fn),
    connect: mock.connect,
    disconnect: mock.disconnect,
    removeAllListeners: mock.clear,
  })),
}));
let query: QueryClient;
let items: object[];
const server = {
  id: "665f1c2e9b1e8a0012ab34cd",
  name: "Production",
  status: "online",
  lastHeartbeat: null,
};
const alert = {
  _id: "alert1",
  serverId: server.id,
  title: "Brute force",
  plainDescription: "Someone tried to guess a password.",
  severity: "high",
  status: "open",
  eventIds: [],
  createdAt: new Date().toISOString(),
};
beforeEach(() => {
  vi.restoreAllMocks();
  mock.handlers.clear();
  mock.disconnect.mockClear();
  items = [];
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(client, "get").mockImplementation(async (url) => ({
    data:
      url === "/servers"
        ? { servers: [server] }
        : { items, page: 1, limit: 25, total: items.length },
  }));
});
afterEach(() => {
  cleanup();
  query.clear();
  vi.useRealTimers();
});
function Harness({ alerts = false }: { alerts?: boolean }) {
  const [logged, setLogged] = useState(true);
  return (
    <AuthContext.Provider
      value={{
        user: logged ? { id: "u", name: "User", email: "u@example.com" } : null,
        token: logged ? "jwt" : null,
        loading: false,
        logout: () => setLogged(false),
        login: async () => {},
        register: async () => {},
      }}
    >
      <SocketProvider>
        <Controls />
        {alerts ? <AlertsPage /> : <ServersPage />}
      </SocketProvider>
    </AuthContext.Provider>
  );
}
function Controls() {
  const { unread, status } = useSocket();
  const { logout } = useAuth();
  return (
    <>
      <span>Unread: {unread}</span>
      <span>{status}</span>
      <Link to="/alerts">Open alerts</Link>
      <button onClick={logout}>Logout</button>
    </>
  );
}
function mount(alerts = false) {
  render(
    <QueryClientProvider client={query}>
      <MemoryRouter initialEntries={["/servers"]}>
        <Harness alerts={alerts} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("new alert shows a toast, refreshes lists, and unread resets on opening alerts", async () => {
  mount(true);
  await screen.findByText("No alerts found");
  items = [alert];
  act(() => mock.handlers.get("alert:new")?.({ ...alert, id: alert._id }));
  expect(screen.getByText("Unread: 1")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Brute force");
  await screen.findByRole("button", { name: "Brute force" });
  fireEvent.click(screen.getByRole("link", { name: "Open alerts" }));
  expect(screen.getByText("Unread: 0")).toBeTruthy();
});
it("server status updates its badge immediately and disconnects on logout", async () => {
  mount();
  await screen.findByText("online");
  act(() =>
    mock.handlers.get("server:status")?.({
      serverId: server.id,
      status: "offline",
      lastHeartbeat: null,
    }),
  );
  expect(await screen.findByText("offline")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  expect(mock.disconnect).toHaveBeenCalledOnce();
  expect(mock.clear).toHaveBeenCalled();
});
it("batches event invalidations and limits toasts to four for six seconds", async () => {
  mount();
  await screen.findByText("online");
  const invalidate = vi.spyOn(query, "invalidateQueries");
  vi.useFakeTimers();
  act(() => {
    for (let i = 0; i < 10; i++) mock.handlers.get("event:new")?.({});
    for (let i = 0; i < 5; i++)
      mock.handlers.get("alert:new")?.({ ...alert, id: String(i) });
  });
  expect(screen.getAllByRole("status")).toHaveLength(4);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(
    invalidate.mock.calls.filter(([arg]) => arg?.queryKey?.[0] === "events"),
  ).toHaveLength(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(screen.queryAllByRole("status")).toHaveLength(0);
});
it("loads overview counts, hourly endpoint and empty latest alerts", async () => {
  vi.mocked(client.get).mockImplementation(async (url) => ({
    data:
      url === "/stats/overview"
        ? {
            servers: { total: 2, online: 1, offline: 1, pending: 0 },
            alerts: {
              open: 0,
              bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
            },
            incidents: { open: 0 },
            events: { last24h: 0 },
          }
        : url === "/stats/events-over-time"
          ? { buckets: [] }
          : { items: [], page: 1, limit: 5, total: 0 },
  }));
  render(
    <QueryClientProvider client={query}>
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Servers online")).toBeTruthy();
  expect(await screen.findByText("No alerts yet")).toBeTruthy();
  expect(screen.getByText("No events in this period")).toBeTruthy();
  expect(client.get).toHaveBeenCalledWith("/stats/events-over-time", {
    params: { hours: 24 },
  });
});
it("shows connection and reconnection state", async () => {
  mount();
  await screen.findByText("online");
  act(() => mock.handlers.get("connect")?.());
  await waitFor(() => expect(screen.getByText("connected")).toBeTruthy());
  act(() => mock.handlers.get("disconnect")?.());
  expect(screen.getByText("reconnecting")).toBeTruthy();
});
