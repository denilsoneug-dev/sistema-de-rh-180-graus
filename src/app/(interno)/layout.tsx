import { redirect } from "next/navigation";
import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { NavTabs } from "@/components/NavTabs";
import { Sidebar } from "@/components/Sidebar";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { IconBusca } from "@/components/icons";

export default async function InternoLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");

  const acessoTotal = perfil.papel === "acesso_total";
  const iniciais = (perfil.nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-60 lg:pl-64">
      <Sidebar />

      <header className="glass border-b border-slate-200/70 sticky top-0 z-20">
        <div className="px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="md:hidden inline-flex">
            <Logo size={34} showWordmark={false} />
          </Link>

          <form action="/busca" method="get" className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <IconBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                className="input !py-2 !pl-9"
                placeholder="Buscar por nome ou CPF..."
              />
            </div>
          </form>

          <div className="flex items-center gap-2.5 text-sm">
            <span
              className={`badge ${
                acessoTotal ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-600"
              }`}
            >
              {acessoTotal ? "Acesso total" : "Visualização"}
            </span>
            <span className="hidden md:flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-soft">
                {iniciais || "RH"}
              </span>
              <span className="text-slate-600 font-medium">{perfil.nome}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="page-enter max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">{children}</main>

      <NavTabs />
    </div>
  );
}
