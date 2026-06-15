"use client";

import Link from "next/link";

export default function InternoError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="card max-w-md w-full p-8 text-center animate-scale-in">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl">⚠️</div>
        <h1 className="font-display text-xl font-extrabold text-slate-900">Algo deu errado</h1>
        <p className="mt-2 text-slate-600">
          Não conseguimos carregar esta página agora. Tente novamente ou volte ao painel.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button onClick={reset} className="btn-primary">Tentar novamente</button>
          <Link href="/" className="btn-secondary">Voltar ao painel</Link>
        </div>
      </div>
    </div>
  );
}
