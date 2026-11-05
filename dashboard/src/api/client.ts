import axios from "axios";
import type { ApiError } from "../types/auth";
export const TOKEN_KEY = "cloud-beacon-token";
export const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 15000,
});
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("auth-expired"));
      if (!["/login", "/register"].includes(window.location.pathname))
        window.location.replace("/login");
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiError>(error)) {
    const message = error.response?.data?.error?.message;
    return typeof message === "string"
      ? message
      : error.response
        ? "Unable to complete the request. Please try again."
        : "Unable to reach Cloud Beacon. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
