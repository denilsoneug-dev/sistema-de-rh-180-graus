import { buscarFichaPorToken } from "@/app/actions/ficha-publica";
import { FormularioFicha } from "./FormularioFicha";

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
        <div className="card max-w-md w-full p-8 text-center">
          <h1 className="text-xl font-bold mb-2">180 Graus</h1>
          <p className="text-gray-600">{msgs[ficha.motivo || "nao_encontrada"]}</p>
        </div>
      </main>
    );
  }

  return <FormularioFicha token={token} nome={ficha.nome || ""} />;
}
