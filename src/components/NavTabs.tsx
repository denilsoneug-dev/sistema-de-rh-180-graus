"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Dashboard" },
  { href: "/fichas", label: "Fichas" },
  { href: "/candidatos", label: "Candidatos" },
  { href: "/equipe", label: "Equipe" },
  { href: "/busca", label: "Busca" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
      {tabs.map((t) => {
        const ativo = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
              ativo
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
