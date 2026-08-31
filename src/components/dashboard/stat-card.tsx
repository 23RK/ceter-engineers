export function StatCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "success";
}) {
  const iconTone = {
    default: "bg-brand-50 text-brand-600",
    danger: "bg-red-50 text-red-600",
    success: "bg-green-50 text-green-600",
  }[tone];

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-brand-900">{value}</p>
        <p className="text-xs text-black/50">{label}</p>
      </div>
    </div>
  );
}
