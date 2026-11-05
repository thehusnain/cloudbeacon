import { Card, EmptyState } from "../components/ui";
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <p className="mb-3 text-xs tracking-widest text-teal-300">CLOUD BEACON</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 mb-8 text-slate-400">
        Your server security, in one place.
      </p>
      <Card>
        <EmptyState
          title="Coming soon"
          description={`Your ${title.toLowerCase()} workspace will be available here.`}
        />
      </Card>
    </>
  );
}
