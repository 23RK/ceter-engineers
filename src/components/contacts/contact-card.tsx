"use client";

import { useActionState, useEffect, useState } from "react";
import { Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { updateContact } from "@/lib/actions/contacts";
import type { ActionState } from "@/lib/actions/tasks";
import { telHref, whatsappHref } from "@/lib/contacts";

export type ContactInfo = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

/** Phone / WhatsApp / email buttons (SPEC §1.2: direct links, big enough to tap). */
export function ContactLinks({ contact, size = "md" }: { contact: ContactInfo; size?: "sm" | "md" }) {
  const tel = telHref(contact.phone);
  const wa = whatsappHref(contact.phone);
  const box =
    size === "sm"
      ? "flex h-9 w-9 items-center justify-center rounded-lg transition"
      : "flex h-10 w-10 items-center justify-center rounded-lg transition";
  return (
    <span className="flex shrink-0 items-center gap-1">
      {tel && (
        <a href={tel} aria-label={`התקשרות ל${contact.name}`} title={contact.phone ?? ""} className={`${box} bg-brand-50 text-brand-700 hover:bg-brand-100`}>
          <Phone size={16} />
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`וואטסאפ ל${contact.name}`} className={`${box} bg-green-50 text-green-700 hover:bg-green-100`}>
          <MessageCircle size={16} />
        </a>
      )}
      {contact.email && (
        <a href={`mailto:${contact.email}`} aria-label={`מייל ל${contact.name}`} title={contact.email} className={`${box} bg-black/5 text-black/60 hover:bg-black/10`}>
          <Mail size={16} />
        </a>
      )}
    </span>
  );
}

/** Contact fields, used to create or edit a contact. */
export function ContactFields({ contact }: { contact?: ContactInfo }) {
  const input =
    "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-black/60 sm:col-span-2">
        שם *
        <input name="name" required defaultValue={contact?.name} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
        חברה
        <input name="company" defaultValue={contact?.company ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
        טלפון
        <input name="phone" type="tel" dir="ltr" defaultValue={contact?.phone ?? ""} className={`${input} text-right`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-black/60 sm:col-span-2">
        אימייל
        <input name="email" type="email" dir="ltr" defaultValue={contact?.email ?? ""} className={`${input} text-right`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-black/60 sm:col-span-2">
        הערות
        <textarea name="notes" rows={2} defaultValue={contact?.notes ?? ""} className={input} />
      </label>
    </div>
  );
}

function EditContactForm({ contact, onDone }: { contact: ContactInfo; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateContact.bind(null, contact.id),
    {}
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <ContactFields contact={contact} />
      <p className="text-xs text-black/45">
        הכרטיס משותף לכל הפרויקטים שאיש הקשר מקושר אליהם.
      </p>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? "שומר..." : "שמירה"}
        </button>
        <button type="button" onClick={onDone} className="min-h-10 rounded-lg px-4 text-sm text-black/60 hover:bg-black/5">
          ביטול
        </button>
      </div>
    </form>
  );
}

/** The contact card (כרטיס איש קשר): details, direct links, and edit. */
export function ContactCardModal({
  contact,
  trigger,
  projectNames,
}: {
  contact: ContactInfo;
  trigger: React.ReactNode;
  /** Other projects this contact is linked to. */
  projectNames?: string[];
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Modal title="כרטיס איש קשר" trigger={trigger} onOpenChange={(o) => !o && setEditing(false)}>
      {(close) =>
        editing ? (
          <EditContactForm contact={contact} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-brand-900">{contact.name}</p>
                {contact.company && <p className="text-sm text-black/55">{contact.company}</p>}
              </div>
              <ContactLinks contact={contact} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-black/45">טלפון</dt>
              <dd dir="ltr" className="text-right">{contact.phone ?? "—"}</dd>
              <dt className="text-black/45">אימייל</dt>
              <dd dir="ltr" className="text-right break-all">{contact.email ?? "—"}</dd>
              {contact.notes && (
                <>
                  <dt className="text-black/45">הערות</dt>
                  <dd className="whitespace-pre-line">{contact.notes}</dd>
                </>
              )}
              {projectNames && projectNames.length > 0 && (
                <>
                  <dt className="text-black/45">פרויקטים</dt>
                  <dd>{projectNames.join(" · ")}</dd>
                </>
              )}
            </dl>
            <div className="flex gap-2 border-t border-black/5 pt-4">
              <button type="button" onClick={() => setEditing(true)} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 px-3.5 text-sm font-medium text-brand-900 hover:bg-black/5">
                <Pencil size={14} />
                עריכת הכרטיס
              </button>
              <button type="button" onClick={close} className="min-h-10 rounded-lg px-3.5 text-sm text-black/60 hover:bg-black/5">
                סגירה
              </button>
            </div>
          </div>
        )
      }
    </Modal>
  );
}
