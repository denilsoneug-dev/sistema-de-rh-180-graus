"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro("E-mail ou senha inválidos.");
      setCarregando(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center p-4">
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />

      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={56} showWordmark={false} className="animate-float" />
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-slate-900">
            180<span className="text-accent-500">Graus</span>
          </h1>
          <p className="text-sm text-slate-500">Sistema de Recrutamento</p>
        </div>

        <div className="card p-6 shadow-card">
          <form onSubmit={entrar} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input id="email" name="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="senha">Senha</label>
              <input id="senha" name="senha" className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
            </div>
            {erro && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 animate-fade-in">{erro}</p>
            )}
            <button className="btn-primary w-full" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} 180 Graus · Recrutamento e Equipe</p>
      </div>
    </main>
  );
}
