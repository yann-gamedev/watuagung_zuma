"use client";
import { useEffect, useState, type ReactNode } from "react";
import { contact } from "@/lib/data";
import { getSiteSection } from "@/services/site";
import type { SiteContact } from "@/types/site";
import { ContactContext } from "./office-contact";

/** Satu GET /site/contact per halaman (PublicShell). Demo/404/galat tetap memakai lib/data.ts. */
export function ContactProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SiteContact>(contact);
  useEffect(() => {
    let active = true;
    getSiteSection("contact").then((result) => { if (active && result) setValue(result); });
    return () => { active = false; };
  }, []);
  return <ContactContext.Provider value={value}>{children}</ContactContext.Provider>;
}
