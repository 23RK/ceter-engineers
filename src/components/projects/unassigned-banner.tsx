import Link from "next/link";
import { ChevronLeft, FolderInput } from "lucide-react";

/** Shown while existing projects still wait for a department (SPEC §3.1). */
export function UnassignedProjectsBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      href="/projects"
      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition hover:bg-amber-100"
    >
      <FolderInput size={18} className="shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        {count === 1
          ? "פרויקט אחד ממתין לשיוך מחלקה"
          : `${count} פרויקטים ממתינים לשיוך מחלקה`}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 font-semibold">
        לשיוך
        <ChevronLeft size={16} />
      </span>
    </Link>
  );
}
