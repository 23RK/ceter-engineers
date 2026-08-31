export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${className ?? "bg-slate-100 text-slate-700"}`}
    >
      {children}
    </span>
  );
}
