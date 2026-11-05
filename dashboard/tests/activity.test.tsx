import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { client } from "../src/api/client";
import { EventsPage } from "../src/pages/EventsPage";
import { AlertsPage } from "../src/pages/AlertsPage";
import { ServerActivity } from "../src/components/ServerActivity";
import type { Alert, SecurityEvent } from "../src/types/activity";
const serverId = "665f1c2e9b1e8a0012ab34cd";
const event: SecurityEvent = {
  _id: "event-1",
  serverId,
  eventId: "uuid-1",
  type: "ssh_failed_login",
  severity: "high",
  sourceIp: "198.51.100.7",
  timestamp: "2026-11-05T10:00:00Z",
  receivedAt: "2026-11-05T10:00:01Z",
  details: { user: "root", nested: { port: 22 } },
};
const initialAlert: Alert = {
  _id: "alert-1",
  serverId,
  title: "SSH brute force",
  plainDescription: "Someone tried to guess your password.",
  severity: "high",
  status: "open",
  sourceIp: event.sourceIp,
  eventIds: ["event-1"],
  incidentId: "incident-1",
  createdAt: event.timestamp,
  updatedAt: event.timestamp,
};
let query: QueryClient;
let alert: Alert;
beforeEach(() => {
  vi.restoreAllMocks();
  alert = { ...initialAlert };
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
  vi.spyOn(client, "get").mockImplementation(async (url) => {
    if (url === "/servers")
      return { data: { servers: [{ id: serverId, name: "Production" }] } };
    if (url === "/events")
      return { data: { items: [event], page: 1, limit: 25, total: 60 } };
    if (url === "/alerts")
      return { data: { items: [alert], page: 1, limit: 25, total: 1 } };
    if (url === "/alerts/alert-1") return { data: { alert } };
    throw new Error("Unexpected request: " + url);
  });
});
afterEach(() => {
  cleanup();
  query.clear();
});
function Location() {
  return <output aria-label="Current URL">{useLocation().search}</output>;
}
function mount(children: ReactNode, path = "/events") {
  return render(
    <QueryClientProvider client={query}>
      <MemoryRouter initialEntries={[path]}>
        {children}
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("restores event filters from the URL, changes requests and resets pagination", async () => {
  mount(
    <EventsPage />,
    "/events?serverId=" + serverId + "&page=2&severity=high",
  );
  await screen.findByText("Failed SSH login");
  expect(client.get).toHaveBeenCalledWith("/events", {
    params: { page: 2, limit: 25, serverId, severity: "high" },
  });
  fireEvent.change(screen.getByLabelText("Event type"), {
    target: { value: "port_scan" },
  });
  fireEvent.change(screen.getByLabelText("Source IP"), {
    target: { value: "198.51.100.7" },
  });
  fireEvent.change(screen.getByLabelText("From (local time)"), {
    target: { value: "2026-11-04T10:00" },
  });
  fireEvent.change(screen.getByLabelText("To (local time)"), {
    target: { value: "2026-11-05T10:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() =>
    expect(client.get).toHaveBeenCalledWith("/events", {
      params: {
        page: 1,
        limit: 25,
        serverId,
        severity: "high",
        type: "port_scan",
        sourceIp: "198.51.100.7",
        from: new Date("2026-11-04T10:00").toISOString(),
        to: new Date("2026-11-05T10:00").toISOString(),
      },
    }),
  );
  expect(screen.getByLabelText("Current URL").textContent).toContain(
    "type=port_scan",
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(client.get).toHaveBeenLastCalledWith("/events", {
      params: expect.objectContaining({ page: 2, type: "port_scan" }),
    }),
  );
  fireEvent.change(screen.getByLabelText("Per page"), {
    target: { value: "50" },
  });
  await waitFor(() =>
    expect(client.get).toHaveBeenLastCalledWith("/events", {
      params: expect.objectContaining({ page: 1, limit: 50 }),
    }),
  );
});
it("opens readable event details including nested values", async () => {
  mount(<EventsPage />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Failed SSH login" }),
  );
  const modal = screen.getByRole("dialog");
  expect(within(modal).getByText("root")).toBeTruthy();
  expect(within(modal).getByText("Port")).toBeTruthy();
  expect(within(modal).getByText("22")).toBeTruthy();
  expect(within(modal).getByText("uuid-1")).toBeTruthy();
});
it("applies alert filters and updates acknowledged and resolved status without reloading", async () => {
  vi.spyOn(client, "patch").mockImplementation(async (_url, body) => {
    alert = { ...alert, status: body.status };
    return { data: { alert } };
  });
  mount(<AlertsPage />, "/alerts");
  await screen.findByText("SSH brute force");
  fireEvent.change(screen.getByLabelText("Server"), {
    target: { value: serverId },
  });
  fireEvent.change(screen.getByLabelText("Severity"), {
    target: { value: "high" },
  });
  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "open" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() =>
    expect(client.get).toHaveBeenCalledWith("/alerts", {
      params: {
        page: 1,
        limit: 25,
        serverId,
        severity: "high",
        status: "open",
      },
    }),
  );
  // Return to all statuses so the updated card remains in view.
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
  await waitFor(() =>
    expect(screen.getAllByText("Acknowledged").length).toBe(2),
  );
  expect(client.patch).toHaveBeenCalledWith("/alerts/alert-1", {
    status: "acknowledged",
  });
  fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
  await waitFor(() => expect(screen.getAllByText("Resolved").length).toBe(2));
  expect(client.patch).toHaveBeenCalledWith("/alerts/alert-1", {
    status: "resolved",
  });
});
it("loads alert details, linked event count and incident link", async () => {
  mount(<AlertsPage />, "/alerts");
  fireEvent.click(
    await screen.findByRole("button", { name: "SSH brute force" }),
  );
  const modal = screen.getByRole("dialog");
  expect(await within(modal).findByText(/1 linked event/)).toBeTruthy();
  expect(
    within(modal)
      .getByRole("link", { name: "View incident" })
      .getAttribute("href"),
  ).toBe("/incidents/incident-1");
  expect(client.get).toHaveBeenCalledWith("/alerts/alert-1");
});
it.each(["events", "alerts"])(
  "%s handles loading, empty and retryable errors",
  async (kind) => {
    vi.mocked(client.get).mockImplementation(async (url) => {
      if (url === "/servers") return { data: { servers: [] } };
      return { data: { items: [], page: 1, limit: 25, total: 0 } };
    });
    mount(kind === "events" ? <EventsPage /> : <AlertsPage />, "/" + kind);
    expect(screen.getByText("Loading " + kind)).toBeTruthy();
    expect(await screen.findByText("No " + kind + " found")).toBeTruthy();
    vi.mocked(client.get).mockRejectedValue(new Error("Offline"));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await act(async () => {
      await query.invalidateQueries({ queryKey: [kind] });
    });
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
  },
);
it("shows a failed status change without changing the alert", async () => {
  vi.spyOn(client, "patch").mockRejectedValue(new Error("Offline"));
  mount(<AlertsPage />, "/alerts");
  fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Resolve" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
});
it("requests recent events and open alerts for only the selected server", async () => {
  mount(<ServerActivity id={serverId} name="Production" />);
  await screen.findByRole("button", { name: "SSH brute force" });
  expect(client.get).toHaveBeenCalledWith("/events", {
    params: { serverId, page: 1, limit: 10 },
  });
  expect(client.get).toHaveBeenCalledWith("/alerts", {
    params: { serverId, status: "open", page: 1, limit: 10 },
  });
  expect(
    screen.getByRole("link", { name: "View all events" }).getAttribute("href"),
  ).toBe("/events?serverId=" + serverId);
});
