export function PageContainer({
  children,
  narrow = false,
}: {
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={`mx-auto w-full px-4 py-10 sm:px-6 ${narrow ? "max-w-3xl" : "max-w-6xl"}`}>
      {children}
    </div>
  );
}