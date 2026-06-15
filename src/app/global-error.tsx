"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#f5f7fb" }}>
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center", background: "#fff", borderRadius: 16, border: "1px solid #e6e9ef" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>Erro inesperado</h1>
          <p style={{ color: "#475569", marginTop: 8 }}>Ocorreu um erro ao carregar o sistema. Tente novamente.</p>
          <button
            onClick={reset}
            style={{ marginTop: 20, padding: "10px 18px", borderRadius: 12, border: "none", background: "#1a66dc", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
