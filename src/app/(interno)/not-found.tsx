import Link from "next/link";

export default function InternoNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="card max-w-md w-full p-8 text-center animate-scale-in">
        <p className="font-display text-5xl font-extrabold text-gradient-brand">404</p>
        <h1 className="mt-3 font-display text-xl font-extrabold text-slate-900">Página não encontrada</h1>
        <p className="mt-2 text-slate-600">
          O registro que você procura pode ter sido movido ou não existe mais.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/" className="btn-primary">Voltar ao painel</Link>
        </div>
      </div>
    </div>
  );
}
