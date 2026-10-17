import type { Metadata } from "next";
import { AUDIT_LABELS } from "@/lib/admin/audit";
import { getAdminStats } from "@/lib/admin/stats";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "لوحة المعلومات" };

const dateTime = new Intl.DateTimeFormat("ar-u-nu-latn", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function AdminHome() {
  const user = await requireUser(); // every protected page checks for itself
  const stats = await getAdminStats(getDb());
  const cards = [
    { label: "المواد المنشورة", value: stats.published },
    { label: "المسودات", value: stats.drafts },
    { label: "قيد المراجعة", value: stats.inReview },
    { label: "التصنيفات", value: stats.categories },
    { label: "الوسوم", value: stats.tags },
    { label: "المستخدمون الإداريون", value: stats.adminUsers },
  ];
  return (
    <>
      <h1 className="text-2xl font-bold">مرحبًا، {user.name}</h1>
      <p className="mt-1 text-muted-foreground">الأرقام التالية محسوبة مباشرة من قاعدة البيانات.</p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.label} className="rounded-md border border-border p-5">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-3xl font-bold">{c.value}</p>
          </li>
        ))}
      </ul>

      <section className="mt-10" aria-labelledby="h-recent">
        <h2 id="h-recent" className="mb-3 text-xl font-bold">
          أحدث العمليات
        </h2>
        {stats.recent.length === 0 ? (
          <EmptyState title="لا توجد عمليات مسجلة بعد" />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {stats.recent.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
              >
                <span>
                  <span className="font-semibold">{AUDIT_LABELS[r.action] ?? r.action}</span>
                  {r.actorName && <span className="text-muted-foreground"> — {r.actorName}</span>}
                </span>
                <span className="text-sm text-muted-foreground">
                  {dateTime.format(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}