"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { NAV_TABS, isAtivo } from "@/components/nav-config";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar-grad hidden md:flex md:w-60 lg:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 z-30 text-white">
      <div className="px-5 py-5">
        <Link href="/" className="inline-flex">
          <Logo variant="dark" size={38} />
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_TABS.map((t, i) => {
          const ativo = isAtivo(t.href, pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{ animationDelay: `${i * 55}ms` }}
              className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 animate-slide-in-left ${
                ativo
                  ? "bg-white/15 text-white shadow-soft"
                  : "text-brand-100/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-500 transition-all duration-200 ${
                  ativo ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                }`}
              />
              <t.Icon className="h-5 w-5 shrink-0" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] text-brand-100/50">
        © {new Date().getFullYear()} 180 Graus
      </div>
    </aside>
  );
}
