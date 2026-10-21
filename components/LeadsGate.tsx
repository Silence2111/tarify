"use client";

import { createContext, useContext } from "react";
import type { LeadsState } from "@/lib/operator";

// Открыт ли приём заявок (lib/operator.ts). Считается на сервере — там видны реквизиты
// оператора — и доходит до форм через корневой layout. Вне провайдера — закрыт.
const Leads = createContext<LeadsState>("no-operator");

export function LeadsProvider({ state, children }: { state: LeadsState; children: React.ReactNode }) {
  return <Leads.Provider value={state}>{children}</Leads.Provider>;
}

export function useLeadsState(): LeadsState {
  return useContext(Leads);
}
