import { redirect } from "next/navigation";
import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { NavTabs } from "@/components/NavTabs";
import { LogoutButton } from "@/components/LogoutButton";

export default async function InternoLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="font-bold text-lg text-brand-700 whitespace-nowrap">180 Graus</Link>
          <form action="/busca" method="get" className="flex-1 max-w-md hidden sm:block">
            <input name="q" className="input !py-1.5" placeholder="Buscar por nome ou CPF..." />
          </form>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden md:inline text-gray-600">{perfil.nome}</span>
            <span className={`badge ${perfil.papel === "acesso_total" ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-600"}`}>
              {perfil.papel === "acesso_total" ? "Acesso total" : "Visualização"}
            </span>
            <LogoutButton />
          </div>
        </div>
        <NavTabs />
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
