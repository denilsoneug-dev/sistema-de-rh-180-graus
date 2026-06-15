"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconSair } from "@/components/icons";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      title="Sair"
      aria-label="Sair"
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      <IconSair className="h-4 w-4" />
      <span className="hidden sm:inline">Sair</span>
    </button>
  );
}
