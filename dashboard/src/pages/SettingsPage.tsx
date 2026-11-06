import { useAuth } from "../hooks/useAuth";
import { client } from "../api/client";
import { Card, Button } from "../components/ui";
import { version } from "../../package.json";
export function SettingsPage() {
  const { user, logout } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Account</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-slate-400">Name</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Email</dt>
            <dd className="break-all">{user?.email}</dd>
          </div>
        </dl>
        <Button className="mt-5" onClick={logout}>
          Logout
        </Button>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Notifications</h2>
        <p className="text-slate-300">
          Push alerts are delivered to the Cloud Beacon mobile app. Sign in to
          the mobile app to receive notifications about high and critical
          alerts.
        </p>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">About</h2>
        <p>Cloud Beacon {version}</p>
        <p className="mt-3 break-all text-sm text-slate-400">
          API URL: {client.defaults.baseURL}
        </p>
      </Card>
    </div>
  );
}
