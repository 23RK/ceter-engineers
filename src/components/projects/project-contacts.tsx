"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Plus, UserMinus } from "lucide-react";
import type { ContactRole } from "@prisma/client";
import { Modal } from "@/components/ui/modal";
import {
  ContactCardModal,
  ContactFields,
  ContactLinks,
  type ContactInfo,
} from "@/components/contacts/contact-card";
import { addProjectContact, removeProjectContact } from "@/lib/actions/contacts";
import type { ActionState } from "@/lib/actions/tasks";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/contacts";
import { useActionResult, useUndoToast } from "@/components/ui/toast";

export type ProjectContactInfo = {
  id: string;
  role: ContactRole;
  roleNote: string | null;
  contact: ContactInfo & { projectNames: string[] };
};

/**
 * אנשי קשר (SPEC §3.4): יזם, קבלן מבצע, אדריכל, מהנדס, יועצים - each one a
 * card in the general contacts list, so one person can serve many projects.
 */
export function ProjectContacts({
  projectId,
  links,
  allContacts,
  defaultClientName,
}: {
  projectId: string;
  links: ProjectContactInfo[];
  /** The general contacts list, to pick an existing contact. */
  allContacts: ContactInfo[];
  /** The project's free-text client, offered when creating the client's card. */
  defaultClientName: string | null;
}) {
  const order = (r: ContactRole) => CONTACT_ROLES.findIndex((x) => x.value === r);
  const sorted = [...links].sort(
    (a, b) => order(a.role) - order(b.role) || a.contact.name.localeCompare(b.contact.name, "he")
  );
  const hasClient = links.some((l) => l.role === "CLIENT");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-brand-900">אנשי קשר בפרויקט ({links.length})</h2>
        <Modal
          title="הוספת איש קשר לפרויקט"
          trigger={
            <button className="flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
              <Plus size={15} />
              איש קשר
            </button>
          }
        >
          {(close) => (
            <AddContactForm
              projectId={projectId}
              allContacts={allContacts}
              linkedIds={new Set(links.map((l) => l.contact.id))}
              defaultRole={hasClient ? "CONTRACTOR" : "CLIENT"}
              defaultName={hasClient ? null : defaultClientName}
              onDone={close}
            />
          )}
        </Modal>
      </div>

      {!hasClient && defaultClientName && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          הלקוח &quot;{defaultClientName}&quot; רשום בפרויקט כטקסט בלבד. הוספה שלו כאיש קשר בתפקיד &quot;לקוח&quot; תציג בראש הדף טלפון ווואטסאפ.
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-10 text-center text-sm text-black/40">
          אין עדיין אנשי קשר בפרויקט.
        </p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
          {sorted.map((link) => (
            <ContactRow key={link.id} link={link} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactRow({ link }: { link: ProjectContactInfo }) {
  const onResult = useActionResult();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const c = link.contact;
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${pending ? "opacity-40" : ""}`}>
      <div className="w-24 shrink-0 text-xs">
        <span className="font-semibold text-brand-700">{contactRoleLabel(link.role)}</span>
        {link.roleNote && <span className="block text-black/45">{link.roleNote}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <ContactCardModal
          contact={c}
          projectNames={c.projectNames}
          trigger={
            <button type="button" className="text-right text-sm font-semibold text-brand-900 hover:text-brand-600 hover:underline">
              {c.name}
            </button>
          }
        />
        <p className="truncate text-xs text-black/45">
          {[c.company, c.phone].filter(Boolean).join(" · ")}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <ContactLinks contact={c} size="sm" />
      <button
        type="button"
        onClick={() => {
          if (!confirm(`להסיר את ${c.name} מהפרויקט? כרטיס איש הקשר עצמו נשאר.`)) return;
          start(async () => {
            const res = onResult(await removeProjectContact(link.id));
            if (res.error) setError(res.error);
          });
        }}
        aria-label={`הסרת ${c.name} מהפרויקט`}
        title="הסרה מהפרויקט"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black/25 transition hover:bg-red-50 hover:text-red-600"
      >
        <UserMinus size={15} />
      </button>
    </li>
  );
}

function AddContactForm({
  projectId,
  allContacts,
  linkedIds,
  defaultRole,
  defaultName,
  onDone,
}: {
  projectId: string;
  allContacts: ContactInfo[];
  linkedIds: Set<string>;
  defaultRole: ContactRole;
  defaultName: string | null;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addProjectContact.bind(null, projectId),
    {}
  );
  useUndoToast(state);
  const [mode, setMode] = useState<"existing" | "new">(allContacts.length > 0 && !defaultName ? "existing" : "new");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  const matches = useMemo(() => {
    const q = query.trim();
    return allContacts
      .filter((c) => !q || [c.name, c.company, c.phone].some((v) => v?.includes(q)))
      .slice(0, 30);
  }, [allContacts, query]);

  const input =
    "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          תפקיד בפרויקט
          <select name="role" defaultValue={defaultRole} className={input}>
            {CONTACT_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          פירוט (לא חובה)
          <input name="roleNote" placeholder="לדוגמה: יועץ חשמל" className={input} />
        </label>
      </div>

      <div role="tablist" className="flex rounded-lg bg-black/5 p-0.5 text-sm">
        {(["existing", "new"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-9 flex-1 rounded-md font-medium transition ${mode === m ? "bg-white text-brand-700 shadow-sm" : "text-black/50"}`}
          >
            {m === "existing" ? "מהמאגר" : "איש קשר חדש"}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <div className="flex flex-col gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, חברה או טלפון"
            aria-label="חיפוש איש קשר"
            className={input}
          />
          <input type="hidden" name="contactId" value={picked} />
          {allContacts.length === 0 ? (
            <p className="text-sm text-black/45">המאגר ריק. הוסיפו איש קשר חדש.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto rounded-lg border border-black/5">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(c.id)}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 px-3 text-right text-sm transition ${
                      picked === c.id ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-black/[0.03]"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {c.name}
                      {c.company && <span className="text-black/45"> · {c.company}</span>}
                    </span>
                    {linkedIds.has(c.id) && <span className="shrink-0 text-[11px] text-black/40">כבר בפרויקט</span>}
                  </button>
                </li>
              ))}
              {matches.length === 0 && <li className="px-3 py-3 text-sm text-black/40">לא נמצא.</li>}
            </ul>
          )}
        </div>
      ) : (
        <ContactFields contact={defaultName ? { id: "", name: defaultName, company: null, phone: null, email: null, notes: null } : undefined} />
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending || (mode === "existing" && !picked)}
        className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "שומר..." : "הוספה לפרויקט"}
      </button>
    </form>
  );
}
