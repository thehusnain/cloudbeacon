import { Routes, Route, Navigate } from "react-router-dom";
import { AuthPage } from "./pages/AuthPage";
import { ComingSoon } from "./pages/ComingSoon";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage key="login" />} />
      <Route path="/register" element={<AuthPage key="register" register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {[
            "Overview",
            "Servers",
            "Events",
            "Alerts",
            "Incidents",
            "Settings",
          ].map((title) => (
            <Route
              key={title}
              path={title === "Overview" ? "/" : `/${title.toLowerCase()}`}
              element={<ComingSoon title={title} />}
            />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
