// app/_disabled_dashboard/page.tsx
export const dynamic = "force-static";

export default function DisabledDashboardPage() {
  return (
    <main className="min-h-screen bg-[#111111] text-slate-100 flex justify-center">
      <div className="w-full max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold mb-2">Dashboard (disabled)</h1>
        <p className="text-sm text-slate-300">
          This page is temporarily disabled to pass the production build for Stripe onboarding.
        </p>
      </div>
    </main>
  );
}
