import { Suspense } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { AdminSidebar } from "@/components/AdminSidebar";
import { LoadingState } from "@/components/LoadingState";
import { requireUser } from "@/lib/auth/guard";

async function PanelShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // reads the session cookie: request-time only
  return (
    <div className="flex flex-1">
      <AdminSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader user={user} />
        <main id="admin-main" className="flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <LoadingState cards={3} />
        </div>
      }
    >
      <PanelShell>{children}</PanelShell>
    </Suspense>
  );
}