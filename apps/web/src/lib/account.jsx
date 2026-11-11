import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api.js";

const STORAGE_KEY = "zitouna.account";

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.accounts()).accounts,
    staleTime: 15_000,
  });

  const accounts = accountsQuery.data ?? [];

  const account = useMemo(() => {
    if (!accounts.length) return null;
    return (
      accounts.find((candidate) => candidate.id === selectedId) ??
      accounts.find((candidate) => candidate.label === "Buyer A") ??
      accounts.find((candidate) => candidate.role === "BUYER") ??
      accounts[0]
    );
  }, [accounts, selectedId]);

  useEffect(() => {
    if (account?.id && account.id !== selectedId) {
      setSelectedId(account.id);
      localStorage.setItem(STORAGE_KEY, account.id);
    }
  }, [account?.id, selectedId]);

  const value = useMemo(
    () => ({
      accounts,
      account,
      isDemo: true,
      loading: accountsQuery.isLoading,
      error: accountsQuery.error,
      selectAccount: (id) => {
        setSelectedId(id);
        localStorage.setItem(STORAGE_KEY, id);
      },
      refreshAccounts: accountsQuery.refetch,
      buyers: accounts.filter((candidate) => candidate.role === "BUYER"),
      producer: accounts.find((candidate) => candidate.role === "PRODUCER"),
    }),
    [accounts, account, accountsQuery],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used inside AccountProvider");
  return context;
}
