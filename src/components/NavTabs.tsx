"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS, isAtivo } from "@/components/nav-config";

// Barra de navegação inferior — apenas mobile (no desktop usa-se a Sidebar)
export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-slate-200/70 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {NAV_TABS.map((t) => {
          const ativo = isAtivo(t.href, pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                ativo ? "text-brand-700" : "text-slate-400"
              }`}
            >
              <span
                className={`flex h-9 w-12 items-center justify-center rounded-xl transition-all duration-200 ${
                  ativo ? "bg-brand-100 text-brand-700" : "text-slate-500"
                }`}
              >
                <t.Icon className="h-5 w-5" />
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
