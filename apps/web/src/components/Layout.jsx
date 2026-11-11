import { Leaf, Menu, ShieldCheck, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAccount } from "../lib/account.jsx";

const NAV = [
  { to: "/", label: "Market", end: true },
  { to: "/wallet", label: "Wallet" },
  { to: "/redemptions", label: "Redemptions" },
  { to: "/passports", label: "Passports" },
  { to: "/demo", label: "Demo" },
];

function NavItems({ onNavigate }) {
  return NAV.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `rounded-full px-3.5 py-2 text-sm font-semibold transition ${
          isActive ? "bg-olive text-cream" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
        }`
      }
    >
      {item.label}
    </NavLink>
  ));
}

function AccountSwitcher() {
  const { accounts, account, selectAccount } = useAccount();
  if (!accounts.length) return null;
  return (
    <label className="flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 py-1 pl-3 pr-1.5">
      <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 sm:block">
        Acting as
      </span>
      <select
        value={account?.id ?? ""}
        onChange={(event) => selectAccount(event.target.value)}
        className="max-w-[11rem] cursor-pointer bg-transparent py-1 pr-1 text-sm font-semibold text-ink outline-none"
        aria-label="Switch demo account"
      >
        {accounts
          .filter((candidate) => candidate.role !== "OPERATOR")
          .map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label} · {candidate.role.toLowerCase()}
            </option>
          ))}
      </select>
    </label>
  );
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { account } = useAccount();
  const state = useQuery({ queryKey: ["demo-state"], queryFn: api.demoState, staleTime: 60_000, retry: 0 });
  const mode = state.data?.mode ?? "stub";

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      {mode === "stub" ? (
        <div className="no-print bg-gold-soft/90 text-olive-deep">
          <div className="shell flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1.5 text-center text-[11px] font-semibold tracking-wide">
            <span className="rounded-full bg-olive px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cream">
              Simulated ledger
            </span>
            <span>
              LEDGER_MODE=stub — transactions are local and deterministic. Add Hedera testnet keys to
              switch to on-chain mode.
            </span>
          </div>
        </div>
      ) : (
        <div className="no-print bg-ok-soft text-ok">
          <div className="shell flex items-center justify-center gap-2 py-1.5 text-[11px] font-semibold tracking-wide">
            <ShieldCheck className="h-3.5 w-3.5" />
            Hedera testnet — every sale, transfer and verdict is written to HCS.
          </div>
        </div>
      )}

      <header className="no-print sticky top-0 z-40 border-b border-ink/10 bg-cream/85 backdrop-blur">
        <div className="shell flex h-16 items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive text-cream">
              <Leaf className="h-4.5 w-4.5" />
            </span>
            <span className="leading-none">
              <span className="display block text-lg font-bold tracking-tight">ZitounaDeFi</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em] text-olive/60">
                Olive oil, on-ledger
              </span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            <NavItems />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <AccountSwitcher />
            </div>
            <Link
              to="/wallet"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-white/70 text-olive transition hover:bg-olive hover:text-cream"
              aria-label="Open wallet"
              title={account ? `${account.label} · ${account.accountId}` : "Wallet"}
            >
              <Wallet className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-white/70 text-ink lg:hidden"
              aria-label="Toggle navigation"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-ink/10 bg-cream/95 lg:hidden">
            <div className="shell flex flex-col gap-1 py-3">
              <NavItems onNavigate={() => setOpen(false)} />
              <div className="mt-2 sm:hidden">
                <AccountSwitcher />
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="no-print mt-16 border-t border-ink/10 bg-cream-deep/60">
        <div className="shell flex flex-col gap-6 py-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-olive" />
              <span className="display text-base font-bold">ZitounaDeFi</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              Certified Tunisian olive oil, fractional litres, redeemable in the warehouse. Built for
              the Hedera testnet as a working demo — not investment advice and not affiliated with
              Zitouna Bank.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-ink-soft">
            <Link className="link" to="/demo">
              Demo controls
            </Link>
            <a className="link" href={api.base.replace("/api/v1", "") + "/docs"} target="_blank" rel="noreferrer">
              API docs
            </a>
            <a className="link" href="https://hashscan.io/testnet" target="_blank" rel="noreferrer">
              HashScan
            </a>
            <span className="text-ink/40">Testnet demo · {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
