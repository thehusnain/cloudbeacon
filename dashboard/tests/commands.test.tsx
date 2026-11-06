import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BlockIpModal } from "../src/components/BlockIpModal";
import { ServerCommands } from "../src/components/ServerCommands";
import { client } from "../src/api/client";
import { isIp } from "../src/utils/ip";
let query: QueryClient;
beforeEach(() => {
  vi.restoreAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
});
afterEach(() => {
  cleanup();
  query.clear();
});
it.each(["127.0.0.1", "::1", "2001:db8::1", "::ffff:192.0.2.1"])(
  "accepts IP %s",
  (ip) => expect(isIp(ip)).toBe(true),
);
it.each([
  "999.1.1.1",
  "01.2.3.4",
  "1:2:3",
  "host.example",
  "1::2::3",
  "1.2.3.4/24",
])("rejects IP %s", (ip) => expect(isIp(ip)).toBe(false));
it("validates input and sends the chosen duration", async () => {
  const post = vi
    .spyOn(client, "post")
    .mockResolvedValue({ data: { command: {} } });
  const close = vi.fn();
  render(
    <QueryClientProvider client={query}>
      <BlockIpModal serverId="server" onClose={close} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("IP address"), {
    target: { value: "bad" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm block" }));
  expect(screen.getByText("Enter a valid IPv4 or IPv6 address.")).toBeTruthy();
  expect(post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("IP address"), {
    target: { value: "2001:db8::1" },
  });
  fireEvent.change(screen.getByLabelText("Block duration"), {
    target: { value: "604800" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm block" }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(post).toHaveBeenCalledWith("/servers/server/block-ip", {
    ip: "2001:db8::1",
    durationSeconds: 604800,
  });
});
it("shows backend errors and retains the prefilled IP", async () => {
  vi.spyOn(client, "post").mockRejectedValue({
    isAxiosError: true,
    response: {
      status: 400,
      data: {
        error: { code: "IP_ALLOWLISTED", message: "IP is on the allowlist" },
      },
    },
  });
  render(
    <QueryClientProvider client={query}>
      <BlockIpModal
        serverId="server"
        initialIp="203.0.113.1"
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm block" }));
  expect(await screen.findByText("IP is on the allowlist")).toBeTruthy();
  expect((screen.getByLabelText("IP address") as HTMLInputElement).value).toBe(
    "203.0.113.1",
  );
});
it("shows command statuses and sends unblock only for a completed block", async () => {
  vi.spyOn(client, "get").mockResolvedValue({
    data: {
      items: ["pending", "delivered", "done", "failed"].map((status) => ({
        _id: status,
        type: "block_ip",
        payload: { ip: "203.0.113.1" },
        status,
        createdAt: new Date().toISOString(),
        source: "manual",
        resultMessage: "Result",
      })),
      page: 1,
      limit: 25,
      total: 4,
    },
  });
  const post = vi
    .spyOn(client, "post")
    .mockResolvedValue({ data: { command: {} } });
  render(
    <QueryClientProvider client={query}>
      <ServerCommands serverId="server" />
    </QueryClientProvider>,
  );
  for (const status of ["pending", "delivered", "done", "failed"])
    expect(await screen.findByText(status)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Unblock" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Unblock" }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("/servers/server/unblock-ip", {
      ip: "203.0.113.1",
    }),
  );
  expect(
    await screen.findByText("Unblock command queued for the next heartbeat."),
  ).toBeTruthy();
});
