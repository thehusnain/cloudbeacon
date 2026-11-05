import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { client } from "../src/api/client";
import { serverKeys } from "../src/api/servers";
import { ServersPage } from "../src/pages/ServersPage";
import { ServerDetailPage } from "../src/pages/ServerDetailPage";
import type { Server } from "../src/types/server";

const server: Server = {
  id: "665f1c2e9b1e8a0012ab34cd",
  owner: "owner",
  name: "Production",
  status: "pending",
  lastHeartbeat: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
let query: QueryClient;
beforeEach(() => {
  vi.restoreAllMocks();
  query = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  cleanup();
  query.clear();
  vi.useRealTimers();
});
function mount(children: ReactNode, path = "/servers") {
  return render(
    <QueryClientProvider client={query}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}
function enrollment(expiresAt = new Date(Date.now() + 900000).toISOString()) {
  let created = false;
  vi.spyOn(client, "get").mockImplementation(async (url) => ({
    data:
      url === "/servers" ? { servers: created ? [server] : [] } : { server },
  }));
  vi.spyOn(client, "post").mockImplementation(async () => {
    created = true;
    return { data: { server, enrollmentKey: "one-time-key", expiresAt } };
  });
  vi.spyOn(client, "delete").mockResolvedValue({});
}
async function create() {
  fireEvent.click(screen.getByRole("button", { name: "Add Server" }));
  fireEvent.change(screen.getByLabelText("Server name"), {
    target: { value: "Production" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create server" }));
}
it("shows the one-time key and countdown; closing keeps the pending server but forgets the key", async () => {
  enrollment();
  mount(<ServersPage />);
  await create();
  expect(await screen.findByText("one-time-key")).toBeTruthy();
  expect(
    screen.getByText("sudo cloudbeacon-agent install --key one-time-key"),
  ).toBeTruthy();
  expect(screen.getByText(/shown only once/)).toBeTruthy();
  expect(screen.getByText(/15:00|14:59/)).toBeTruthy();
  expect(client.post).toHaveBeenCalledWith("/servers", { name: "Production" });
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(await screen.findByText("pending")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Add Server" }));
  expect(screen.getByLabelText("Server name")).toBeTruthy();
  expect(screen.queryByText("one-time-key")).toBeNull();
  expect(client.delete).not.toHaveBeenCalled();
});
it("polls enrollment and switches to success when the server comes online", async () => {
  enrollment();
  mount(<ServersPage />);
  await create();
  await screen.findByText("one-time-key");
  await waitFor(() =>
    expect(client.get).toHaveBeenCalledWith("/servers/" + server.id),
  );
  vi.mocked(client.get).mockResolvedValue({
    data: {
      server: { ...server, status: "online" },
      servers: [{ ...server, status: "online" }],
    },
  });
  expect(
    await screen.findByRole(
      "heading",
      { name: "Connection Successful" },
      { timeout: 4500 },
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "View server" }).getAttribute("href"),
  ).toBe("/servers/" + server.id);
  expect(screen.queryByText("one-time-key")).toBeNull();
});
it("expires the key and deletes only the pending server before starting again", async () => {
  enrollment(new Date(Date.now() - 1000).toISOString());
  mount(<ServersPage />);
  await create();
  await screen.findByText("Key expired");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Delete pending server and start again",
    }),
  );
  await screen.findByLabelText("Server name");
  expect(client.delete).toHaveBeenCalledWith("/servers/" + server.id);
});
it("shows all status badges, host details and relative heartbeats", async () => {
  vi.spyOn(client, "get").mockResolvedValue({
    data: {
      servers: [
        {
          ...server,
          status: "online",
          hostname: "web-01",
          os: "Ubuntu 24.04",
          lastHeartbeat: new Date(Date.now() - 120000).toISOString(),
        },
        { ...server, id: "2", name: "Offline server", status: "offline" },
        { ...server, id: "3", name: "Pending server" },
      ],
    },
  });
  mount(<ServersPage />);
  expect(await screen.findByText("online")).toBeTruthy();
  expect(screen.getByText("offline")).toBeTruthy();
  expect(screen.getByText("pending")).toBeTruthy();
  expect(screen.getByText("web-01")).toBeTruthy();
  expect(screen.getByText("Ubuntu 24.04")).toBeTruthy();
  expect(screen.getByText("2 minutes ago")).toBeTruthy();
});
it("requires confirmation before deleting and returns to the list", async () => {
  vi.spyOn(client, "get").mockImplementation(async (url) => ({
    data:
      url === "/events" || url === "/alerts"
        ? { items: [], total: 0, page: 1, limit: 10 }
        : { server },
  }));
  const remove = vi.spyOn(client, "delete").mockResolvedValue({});
  mount(
    <Routes>
      <Route path="/servers/:id" element={<ServerDetailPage />} />
      <Route path="/servers" element={<h1>Server list</h1>} />
    </Routes>,
    "/servers/" + server.id,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Delete server" }));
  expect(
    screen.getByRole("dialog", { name: "Delete this server?" }),
  ).toBeTruthy();
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Delete server" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await screen.findByRole("heading", { name: "Server list" });
  expect(remove).toHaveBeenCalledWith("/servers/" + server.id);
  expect(query.getQueryData(serverKeys.detail(server.id))).toBeUndefined();
});
it("shows loading, empty and retryable error states", async () => {
  const get = vi
    .spyOn(client, "get")
    .mockResolvedValue({ data: { servers: [] } });
  mount(<ServersPage />);
  expect(screen.getByRole("status")).toBeTruthy();
  expect(
    await screen.findByRole("button", { name: "Add your first server" }),
  ).toBeTruthy();
  get.mockRejectedValue(new Error("Network failed"));
  await act(async () => {
    await query.invalidateQueries({ queryKey: serverKeys.all });
  });
  expect(await screen.findByRole("alert")).toBeTruthy();
  get.mockResolvedValue({ data: { servers: [server] } });
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Production")).toBeTruthy();
});
