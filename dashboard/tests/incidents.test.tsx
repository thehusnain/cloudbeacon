import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IncidentTimeline } from "../src/components/IncidentTimeline";
import { IncidentDetailPage } from "../src/pages/IncidentDetailPage";
import { IncidentsPage } from "../src/pages/IncidentsPage";
import { client } from "../src/api/client";
const id = "665f1c2e9b1e8a0012ab34cd";
let query: QueryClient;
let incident: {
  _id: string;
  title: string;
  status: string;
  severity: string;
  sourceIps: string[];
  eventIds: string[];
  alertIds: string[];
};
beforeEach(() => {
  vi.restoreAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  incident = {
    _id: id,
    title: "SSH incident",
    status: "open",
    severity: "high",
    sourceIps: [],
    eventIds: [],
    alertIds: [],
  };
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function () {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function () {
      this.removeAttribute("open");
    },
  });
  vi.spyOn(client, "get").mockImplementation(async (url) => ({
    data: url.endsWith("/timeline")
      ? { steps: [] }
      : url === "/servers"
        ? { servers: [] }
        : url === "/incidents"
          ? { items: [], total: 0, page: 1, limit: 25 }
          : { incident },
  }));
});
afterEach(() => {
  cleanup();
  query.clear();
});
function detail() {
  render(
    <QueryClientProvider client={query}>
      <MemoryRouter initialEntries={["/incidents/" + id]}>
        <Routes>
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("orders steps, expands collapsed evidence, and handles missing fields", () => {
  render(
    <MemoryRouter>
      <IncidentTimeline
        steps={[
          {
            timestamp: "2026-11-06T12:00:00Z",
            kind: "alert",
            description: "Later alert",
            evidence: { alertId: "a" },
          },
          {
            timestamp: "2026-11-06T10:00:00Z",
            description: "Repeated login",
            count: 15,
            firstAt: "2026-11-06T10:00:00Z",
            lastAt: "2026-11-06T10:01:00Z",
            evidence: [{ eventId: "one", details: { user: "root" } }, null],
          },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole("listitem")[0].textContent).toContain(
    "Repeated login",
  );
  expect(screen.getByText(/15 events/)).toBeTruthy();
  const toggle = screen.getAllByText("Evidence")[0];
  fireEvent.click(toggle);
  expect(toggle.parentElement?.hasAttribute("open")).toBe(true);
  expect(screen.getByText("root")).toBeTruthy();
  fireEvent.click(toggle);
  expect(toggle.parentElement?.hasAttribute("open")).toBe(false);
  expect(
    screen.getByRole("link", { name: "View alert" }).getAttribute("href"),
  ).toBe("/alerts?alert=a");
});
it("confirms closing and reopening without losing the summary", async () => {
  vi.spyOn(client, "patch").mockImplementation(async (_url, body) => {
    incident = { ...incident, status: body.status };
    return { data: { incident } };
  });
  detail();
  fireEvent.click(
    await screen.findByRole("button", { name: "Close incident" }),
  );
  expect(client.patch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await screen.findByRole("button", { name: "Reopen incident" });
  fireEvent.click(screen.getByRole("button", { name: "Reopen incident" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await screen.findByRole("button", { name: "Close incident" });
  expect(client.patch).toHaveBeenLastCalledWith("/incidents/" + id, {
    status: "open",
  });
});
it("shows empty and failed timeline states", async () => {
  detail();
  await screen.findByText("No timeline steps yet");
  vi.mocked(client.get).mockRejectedValue(new Error("offline"));
  await query.invalidateQueries({ queryKey: ["incident", id, "timeline"] });
  expect(await screen.findByRole("alert")).toBeTruthy();
});
it("list omits empty filters and resets page when status changes", async () => {
  render(
    <QueryClientProvider client={query}>
      <MemoryRouter initialEntries={["/incidents?page=3&severity="]}>
        <IncidentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText("No incidents found");
  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "closed" },
  });
  await waitFor(() =>
    expect(client.get).toHaveBeenCalledWith("/incidents", {
      params: { page: 1, limit: 25, status: "closed" },
    }),
  );
});
it("missing evidence fields do not crash", () => {
  render(
    <MemoryRouter>
      <IncidentTimeline steps={[{}]} />
    </MemoryRouter>,
  );
  expect(screen.getByText("Security activity recorded")).toBeTruthy();
  expect(screen.getByText("No evidence provided.")).toBeTruthy();
});
it("finishes a successful close even when background refresh cannot finish", async () => {
  detail();
  await screen.findByRole("button", { name: "Close incident" });
  vi.spyOn(client, "patch").mockResolvedValue({
    data: { incident: { ...incident, status: "closed" } },
  });
  vi.mocked(client.get).mockImplementation(() => new Promise(() => {}));
  fireEvent.click(screen.getByRole("button", { name: "Close incident" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("button", { name: "Reopen incident" })).toBeTruthy();
});
it("shows loading and an API error without changing the status", async () => {
  let rejectRequest: (reason: unknown) => void = () => {};
  vi.spyOn(client, "patch").mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
  );
  detail();
  fireEvent.click(
    await screen.findByRole("button", { name: "Close incident" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("button", { name: "Saving…" })
        .every((button) => button.hasAttribute("disabled")),
    ).toBe(true),
  );
  rejectRequest({
    isAxiosError: true,
    response: {
      data: {
        error: { code: "ERROR", message: "Unable to close this incident" },
      },
    },
  });
  expect(await screen.findByText("Unable to close this incident")).toBeTruthy();
  expect(screen.getByText("Open")).toBeTruthy();
  expect(client.patch).toHaveBeenCalledWith("/incidents/" + id, {
    status: "closed",
  });
});
it("updates cached list status after closing", async () => {
  query.setQueryData(["incidents", { page: 1 }], {
    items: [incident],
    page: 1,
    limit: 25,
    total: 1,
  });
  vi.spyOn(client, "patch").mockResolvedValue({
    data: { incident: { ...incident, status: "closed" } },
  });
  detail();
  fireEvent.click(
    await screen.findByRole("button", { name: "Close incident" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(await screen.findByText("Closed")).toBeTruthy();
  await waitFor(() =>
    expect(
      query.getQueryData<{ items: { status: string }[] }>([
        "incidents",
        { page: 1 },
      ])?.items[0].status,
    ).toBe("closed"),
  );
});
