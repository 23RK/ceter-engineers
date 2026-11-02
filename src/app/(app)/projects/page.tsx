import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  DEPARTMENTS,
  isGenericProjectName,
  suggestDepartment,
} from "@/lib/departments";
import {
  DepartmentAssignRow,
  type AssignRowProject,
} from "@/components/projects/department-assign-row";

// "שיוך מחלקות" (SPEC §3.1): existing projects the migration couldn't assign
// to a department automatically, names that are only the project type, and
// everything already assigned - so the automatic assignment can be checked.
export default async function AssignDepartmentsPage() {
  await requireUser();

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      client: true,
      address: true,
      description: true,
      department: true,
    },
    orderBy: { name: "asc" },
  });

  const rows: AssignRowProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client,
    address: p.address,
    department: p.department,
    suggestion: p.department ? null : suggestDepartment(p),
    genericName: isGenericProjectName(p.name),
  }));

  const unassigned = rows.filter((r) => !r.department);
  const toRename = rows.filter((r) => r.department && r.genericName);
  const assigned = rows.filter((r) => r.department && !r.genericName);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-brand-900">שיוך מחלקות</h1>
        <p className="text-sm text-black/50">
          כל פרויקט שייך למחלקה. סוג הפרויקט הוא שדה, ולא חלק מהשם.
        </p>
      </div>

      {unassigned.length === 0 && toRename.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-8 text-center shadow-sm">
          <CircleCheck size={28} className="text-green-600" />
          <p className="text-sm font-medium text-brand-900">
            כל הפרויקטים משויכים למחלקה.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {DEPARTMENTS.map((d) => (
              <Link
                key={d.value}
                href={`/departments/${d.slug}`}
                className="rounded-lg border border-black/10 px-3.5 py-2 text-sm font-medium text-brand-900 transition hover:bg-black/5"
              >
                {d.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Section
        title="ממתינים לשיוך"
        hint="לא ניתן היה לזהות את המחלקה מהשם. בחרו מחלקה לכל פרויקט."
        rows={unassigned}
        tone="warn"
      />
      <Section
        title="שמות לעדכון"
        hint='השם הוא רק סוג הפרויקט (למשל "פיקוח יזם"). תנו לו שם אמיתי.'
        rows={toRename}
        tone="warn"
      />
      <Section
        title="פרויקטים משויכים"
        hint="שויכו אוטומטית לפי השם או ידנית. אפשר לבדוק ולשנות."
        rows={assigned}
      />
    </div>
  );
}

function Section({
  title,
  hint,
  rows,
  tone,
}: {
  title: string;
  hint: string;
  rows: AssignRowProject[];
  tone?: "warn";
}) {
  if (rows.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div
        className={`border-b border-black/5 px-4 py-3 ${
          tone === "warn" ? "bg-amber-50/70" : ""
        }`}
      >
        <h2 className="text-sm font-bold text-brand-900">
          {title}{" "}
          <span className="font-medium text-black/40">({rows.length})</span>
        </h2>
        <p className="text-xs text-black/50">{hint}</p>
      </div>
      <ul className="divide-y divide-black/5">
        {rows.map((row) => (
          <DepartmentAssignRow key={row.id} project={row} />
        ))}
      </ul>
    </section>
  );
}
