import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, Activity } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../api/client";
import { Button, Card, Input, ErrorState, Spinner } from "../components/ui";
export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.loading) return <Spinner label="Restoring your session" />;
  if (auth.user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (register && (name.trim().length < 2 || name.trim().length > 60))
      next.name = "Use 2–60 characters for your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (
      password.length < 8 ||
      password.length > 72 ||
      new TextEncoder().encode(password).length > 72 ||
      !/[a-zA-Z]/.test(password) ||
      !/[0-9]/.test(password)
    )
      next.password =
        "Use 8–72 characters (maximum 72 UTF-8 bytes), including a letter and a number.";
    setErrors(next);
    setServerError("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (register) await auth.register(name.trim(), email.trim(), password);
      else await auth.login(email.trim(), password);
      const from = location.state?.from;
      navigate(
        typeof from === "string" &&
          from.startsWith("/") &&
          !from.startsWith("//")
          ? from
          : "/",
        { replace: true },
      );
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-800 p-12 lg:flex">
        <div className="absolute -left-40 top-32 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />
        <Link
          to="/"
          className="relative flex items-center gap-3 text-xl font-semibold"
        >
          <ShieldCheck className="text-teal-300" />
          Cloud Beacon
        </Link>
        <div className="relative max-w-lg">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-900 bg-teal-950/50 px-3 py-1 text-xs tracking-widest text-teal-300">
            <Activity size={14} /> SERVER SECURITY, SIMPLIFIED
          </span>
          <h1 className="text-5xl leading-tight font-semibold tracking-tight">
            A clearer view of
            <br />
            <span className="text-teal-300">your server security.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-400">
            Bring your servers, security events, and incident evidence into one
            place.
          </p>
        </div>
        <p className="relative text-xs tracking-widest text-slate-500">
          CLOUD BEACON / SECURITY OPERATIONS
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 text-teal-300 lg:hidden">
            <ShieldCheck />
            Cloud Beacon
          </div>
          <p className="mb-3 text-xs tracking-widest text-teal-300">
            YOUR SECURITY WORKSPACE
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            {register ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-3 mb-8 text-slate-400">
            {register
              ? "Start building a clearer picture of your servers."
              : "Sign in to your Cloud Beacon workspace."}
          </p>
          <Card>
            <form noValidate onSubmit={submit} className="space-y-5">
              {register && (
                <Input
                  label="Name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.name}
                  disabled={busy}
                />
              )}
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                disabled={busy}
              />
              <Input
                label="Password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                disabled={busy}
              />
              {serverError && <ErrorState message={serverError} />}
              <Button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2"
              >
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
                <ArrowRight size={16} />
              </Button>
            </form>
          </Card>
          <p className="mt-6 text-center text-sm text-slate-400">
            {register ? "Already have an account?" : "New to Cloud Beacon?"}{" "}
            <Link
              className="font-medium text-teal-300 hover:underline"
              to={register ? "/login" : "/register"}
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
