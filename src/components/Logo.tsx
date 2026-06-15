import Image from "next/image";

export function Logo({
  size = 36,
  showWordmark = true,
  variant = "light",
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  variant?: "light" | "dark";
  className?: string;
}) {
  const wordColor = variant === "dark" ? "text-white" : "text-brand-800";
  const subColor = variant === "dark" ? "text-brand-100/80" : "text-slate-400";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="shimmer rounded-[28%] shadow-soft" style={{ width: size, height: size }}>
        <Image src="/logo-180.svg" alt="180 Graus" width={size} height={size} priority />
      </span>
      {showWordmark && (
        <span className="leading-none">
          <span className={`block font-display font-extrabold tracking-tight ${wordColor}`}>
            180<span className="text-accent-500">Graus</span>
          </span>
          <span className={`block text-[10px] font-semibold uppercase tracking-[0.18em] ${subColor}`}>
            Recrutamento
          </span>
        </span>
      )}
    </span>
  );
}
