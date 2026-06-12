"use client";

// Botão de submit que pede confirmação antes de enviar o form
export function ConfirmSubmit({
  mensagem,
  className,
  children,
}: {
  mensagem: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className || "btn-primary"}
      onClick={(e) => {
        if (!confirm(mensagem)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
