import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../src/context/AuthContext";
import { App } from "../src/App";
import { client, TOKEN_KEY } from "../src/api/client";
beforeEach(() => vi.restoreAllMocks());
function renderApp(path = "/login") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("shows field errors without submitting invalid credentials", async () => {
  const post = vi.spyOn(client, "post");
  renderApp();
  fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
  expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
  expect(screen.getByText(/Use 8–72 characters/)).toBeTruthy();
  expect(post).not.toHaveBeenCalled();
});
it("stores the token and redirects after login", async () => {
  vi.spyOn(client, "post").mockResolvedValue({
    data: {
      token: "jwt-example",
      user: { id: "1", name: "Test User", email: "test@example.com" },
    },
  });
  renderApp();
  fireEvent.change(await screen.findByLabelText("Email address"), {
    target: { value: "test@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("heading", { name: "Overview" });
  expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-example");
});
it("redirects unauthenticated protected routes to login", async () => {
  renderApp("/servers");
  expect(
    await screen.findByRole("heading", { name: "Welcome back" }),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Servers" })).toBeNull();
});
it("restores a saved session before showing protected content", async () => {
  localStorage.setItem(TOKEN_KEY, "saved");
  vi.spyOn(client, "get").mockResolvedValue({
    data: {
      user: { id: "1", name: "Restored User", email: "test@example.com" },
    },
  });
  renderApp("/settings");
  await screen.findByRole("heading", { name: "Settings" });
  expect(client.get).toHaveBeenCalledWith("/auth/me", expect.anything());
});
it("shows server errors and re-enables submission", async () => {
  vi.spyOn(client, "post").mockRejectedValue(new Error("failure"));
  renderApp();
  fireEvent.change(await screen.findByLabelText("Email address"), {
    target: { value: "test@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
});
