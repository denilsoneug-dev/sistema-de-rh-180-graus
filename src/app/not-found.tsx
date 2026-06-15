import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8 text-center animate-scale-in">
        <div className="mb-4 flex justify-center"><Logo size={44} showWordmark={false} /></div>
        <p className="font-display text-5xl font-extrabold text-gradient-brand">404</p>
        <h1 className="mt-2 font-display text-xl font-extrabold text-slate-900">Página não encontrada</h1>
        <p className="mt-2 text-slate-600">O endereço que você acessou não existe.</p>
        <div className="mt-6 flex justify-center">
          <Link href="/" className="btn-primary">Ir para o início</Link>
        </div>
      </div>
    </main>
  );
}
