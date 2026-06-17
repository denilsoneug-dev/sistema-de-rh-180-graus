"use client";

import { useState } from "react";

export function CopiarLink({ link, nome }: { link: string; nome: string }) {
  const [copiado, setCopiado] = useState(false);
  const msg = `Olá, ${nome}. Segue o link da sua ficha cadastral para o processo seletivo do 180graus:\n${link}\nPreencha todas as informações com atenção.`;
  const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn-secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}
      >
        {copiado ? "Copiado!" : "Copiar link"}
      </button>
      <a className="btn-success" href={wa} target="_blank" rel="noopener noreferrer">
        Enviar pelo WhatsApp
      </a>
    </div>
  );
}
