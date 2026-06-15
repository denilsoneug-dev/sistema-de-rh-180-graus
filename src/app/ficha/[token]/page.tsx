import { buscarFichaPorToken } from "@/app/actions/ficha-publica";
import { FormularioFicha } from "./FormularioFicha";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function FichaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ficha = await buscarFichaPorToken(token);

  if (!ficha.ok) {
    const msgs = {
      nao_encontrada: "Este link não é válido. Confira com o recrutamento do 180 Graus.",
      expirada: "Este link expirou. Peça um novo link ao recrutamento do 180 Graus.",
      ja_enviada: "Esta ficha já foi enviada. Obrigado!",
    };
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md w-full p-8 text-center animate-scale-in">
          <div className="mb-4 flex justify-center"><Logo size={48} showWordmark={false} /></div>
          <h1 className="font-display text-xl font-extrabold mb-2 text-slate-900">180 Graus</h1>
          <p className="text-slate-600">{msgs[ficha.motivo || "nao_encontrada"]}</p>
        </div>
      </main>
    );
  }

  return <FormularioFicha token={token} nome={ficha.nome || ""} />;
}
