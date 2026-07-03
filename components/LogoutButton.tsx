"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    });
  }

  return (
    <button
      onClick={logout}
      disabled={pending}
      className="text-slate-400 hover:text-brand disabled:opacity-60"
    >
      Выйти
    </button>
  );
}
