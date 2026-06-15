"use client";

import { useState } from "react";

// Confirmação visual de dois passos, dentro da própria interface (sem window.confirm).
// Ao clicar no gatilho, troca para os botões "Confirmar apagar" / "Cancelar".
// O botão de confirmação é um submit, disparando a action do <form> que envolve este componente.
export function ConfirmInline({
  acaoLabel = "apagar",
  confirmarLabel = "Confirmar apagar",
  cancelarLabel = "Cancelar",
}: {
  acaoLabel?: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
}) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-xs text-red-400 hover:text-red-600"
      >
        {acaoLabel}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button type="submit" className="text-xs font-medium text-red-600 hover:text-red-700">
        {confirmarLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        {cancelarLabel}
      </button>
    </span>
  );
}
