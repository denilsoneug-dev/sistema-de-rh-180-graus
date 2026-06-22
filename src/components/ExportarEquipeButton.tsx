"use client";

import { useState } from "react";

export function ExportarEquipeButton() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/equipe/exportar");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Não foi possível gerar o relatório.");
      }
      if (!res.headers.get("content-type")?.includes("application/pdf")) {
        throw new Error("Sua sessão expirou. Faça login novamente para exportar.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio-equipe-atual-180graus.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
      <button type="button" onClick={exportar} disabled={carregando} className="btn-secondary w-full sm:w-auto">
        {carregando ? "Gerando relatório..." : "Exportar relatório"}
      </button>
      {erro && <p className="text-xs text-red-600 sm:max-w-64">{erro}</p>}
    </div>
  );
}
