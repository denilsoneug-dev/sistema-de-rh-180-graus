"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold text-center mb-1">180 Graus</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Sistema de Recrutamento</p>
        <form onSubmit={entrar} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="senha">Senha</label>
            <input id="senha" name="senha" className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button className="btn-primary w-full" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
