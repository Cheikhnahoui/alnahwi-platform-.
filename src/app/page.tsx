// Phase 1 placeholder. The real home page is built in Phase 2 and reads from the database.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-bold">الموقع الرسمي للشيخ عبد الرحمن النحوي</h1>
      <p className="text-muted-foreground">
        المنصة قيد الإنشاء. هذه الصفحة مؤقتة، وستُبنى الصفحة الرئيسية الفعلية في المرحلة التالية.
      </p>
    </main>
  );
}
