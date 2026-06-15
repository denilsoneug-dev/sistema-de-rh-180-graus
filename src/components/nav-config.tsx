import {
  IconDashboard,
  IconFichas,
  IconCandidatos,
  IconEquipe,
  IconBusca,
} from "@/components/icons";

export type NavTab = {
  href: string;
  label: string;
  Icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
};

export const NAV_TABS: NavTab[] = [
  { href: "/", label: "Dashboard", Icon: IconDashboard },
  { href: "/fichas", label: "Fichas", Icon: IconFichas },
  { href: "/candidatos", label: "Candidatos", Icon: IconCandidatos },
  { href: "/equipe", label: "Equipe", Icon: IconEquipe },
  { href: "/busca", label: "Busca", Icon: IconBusca },
];

export function isAtivo(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
