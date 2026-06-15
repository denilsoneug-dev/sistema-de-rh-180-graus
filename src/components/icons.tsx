import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconDashboard(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function IconFichas(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

export function IconCandidatos(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M17 8.5a3 3 0 0 1 0 5" />
      <path d="M19.5 20a4.6 4.6 0 0 0-3-4.3" />
    </svg>
  );
}

export function IconEquipe(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <circle cx="12" cy="9.5" r="2.4" />
      <path d="M8.5 17a3.5 3.5 0 0 1 7 0" />
    </svg>
  );
}

export function IconBusca(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function IconSair(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M9 12h11M16 8l4 4-4 4" />
    </svg>
  );
}
