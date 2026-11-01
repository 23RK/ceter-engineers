"use client";

import { useTransition } from "react";
import { selectPartnerAction } from "@/lib/actions/auth";
import type { Partner } from "@/lib/auth";

export function PartnerPicker({ partners }: { partners: Partner[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-2 gap-3">
      {partners.map((partner) => (
        <button
          key={partner.id}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => selectPartnerAction(partner.id))}
          className="flex flex-col items-center gap-3 rounded-xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md disabled:opacity-60"
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: partner.color }}
          >
            {partner.name.slice(0, 1)}
          </span>
          <span className="text-sm font-semibold text-brand-900">
            {partner.name}
          </span>
        </button>
      ))}
    </div>
  );
}
