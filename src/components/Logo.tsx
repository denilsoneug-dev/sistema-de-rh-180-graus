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
      <Image
        src="/logo-180.png"
        alt="180graus"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
      {showWordmark && (
        <span className="leading-none">
          <span className={`block font-display font-extrabold tracking-tight ${wordColor}`}>
            180<span className="text-accent-500">graus</span>
          </span>
          <span className={`block text-[10px] font-semibold uppercase tracking-[0.18em] ${subColor}`}>
            Recrutamento
          </span>
        </span>
      )}
    </span>
  );
}
