import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  LayoutDashboard,
  Server,
  Activity,
  Bell,
  GitBranch,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
const links = [
  ["Overview", "/", LayoutDashboard],
  ["Servers", "/servers", Server],
  ["Events", "/events", Activity],
  ["Alerts", "/alerts", Bell],
  ["Incidents", "/incidents", GitBranch],
  ["Settings", "/settings", Settings],
] as const;
export function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const title =
    links.find(
      ([, path]) =>
        path === location.pathname ||
        (path !== "/" && location.pathname.startsWith(`${path}/`)),
    )?.[0] ?? "Workspace";
  return (
    <div className="min-h-screen">
      {open && (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-black/70 md:hidden"
        />
      )}
      <aside
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-slate-800 bg-[#0d1420] p-6 md:flex`}
      >
        <div className="mb-12 flex items-center gap-3 text-lg font-semibold">
          <ShieldCheck className="text-teal-300" />
          Cloud Beacon
          <button
            onClick={() => setOpen(false)}
            className="ml-auto md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-[10px] font-semibold tracking-[.2em] text-slate-500">
          WORKSPACE
        </p>
        <nav aria-label="Main navigation" className="space-y-2">
          {links.map(([label, path, Icon]) => (
            <NavLink
              key={path}
              end={path === "/"}
              to={path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${isActive ? "bg-teal-300/10 text-teal-300" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800 pt-6 text-xs text-slate-500">
          Cloud Beacon
          <br />
          <span className="mt-1 block">Your security workspace</span>
        </div>
      </aside>
      <div className="md:ml-64">
        <header className="flex h-20 items-center justify-between border-b border-slate-800 px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              aria-label="Open sidebar"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="md:hidden"
            >
              <Menu />
            </button>
            <span className="text-sm text-slate-400">
              Workspace <span className="mx-3 text-slate-700">/</span>
              <span className="text-white">{title}</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden text-sm text-slate-300 sm:inline">
              {user?.name}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-teal-300"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-6 sm:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
