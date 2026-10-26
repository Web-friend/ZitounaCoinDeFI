import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  FileSignature,
  Leaf,
  QrCode,
  ShoppingBasket,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { litres, money, percentFromBps, tnd } from "../lib/format.js";
import StatusBadge from "../components/StatusBadge.jsx";
import ReserveGauge from "../components/ReserveGauge.jsx";
import { ErrorState, Spinner } from "../components/ui.jsx";

const STEPS = [
  {
    icon: FileSignature,
    title: "Certified at the mill",
    body: "The auditor signs a stock attestation with a P-256 key and writes it to the lot's Hedera topic.",
  },
  {
    icon: ShoppingBasket,
    title: "Buy fractional litres",
    body: "Pay tUSDT and receive series tokens. 1 DGZ = 10 L, 1 TZT = 1,000 L, with two decimals.",
  },
  {
    icon: Warehouse,
    title: "Redeem real oil",
    body: "Lock tokens, get a pickup code, collect at the warehouse. The tokens are burned at handover.",
  },
  {
    icon: QrCode,
    title: "Verify anywhere",
    body: "Every passport is a public page. The browser re-checks signatures and the hash chain itself.",
  },
];

export default function Market() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["lots"],
    queryFn: api.lots,
    refetchInterval: 30_000,
  });

  if (isLoading) return <Spinner label="Loading lots…" className="py-24" />;
  if (error) return <div className="shell py-16"><ErrorState error={error} onRetry={refetch} /></div>;

  const lots = data?.lots ?? [];
  const featured = lots.find((lot) => lot.series === "DGZ") ?? lots[0];
  const totalCertified = lots.reduce((sum, lot) => sum + (lot.litres?.certified ?? 0), 0);
  const totalSupply = lots.reduce((sum, lot) => sum + (lot.supply?.circulating ?? 0), 0);
  const backed = lots.filter((lot) => lot.status === "BACKED").length;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink/10">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(900px 420px at 78% 12%, rgba(200,169,107,0.28), transparent 65%), radial-gradient(700px 380px at 12% 85%, rgba(79,93,58,0.12), transparent 60%)",
          }}
        />
        <div className="shell grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-olive/20 bg-white/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-olive">
              <Leaf className="h-3.5 w-3.5" />
              Certified Tunisian olive oil · Hedera
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Own the harvest,
              <br />
              <span className="text-olive">litre by litre.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              ZitounaDeFi turns a certified warehouse lot into redeemable tokens. Buy the oil you will
              actually collect, trace every attestation on Hedera, and let a reserve agent prove the
              bottles are still there.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {featured ? (
                <Link to={`/lots/${featured.id}`} className="btn-primary">
                  Explore {featured.id}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              <Link to="/passports" className="btn-secondary">
                <QrCode className="h-4 w-4" />
                Public passports
              </Link>
            </div>
            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-3">
              <div className="rounded-xl border border-ink/8 bg-white/55 px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                  Certified
                </dt>
                <dd className="mt-0.5 font-display text-lg font-bold">{litres(totalCertified, 0)}</dd>
              </div>
              <div className="rounded-xl border border-ink/8 bg-white/55 px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                  Tokenized
                </dt>
                <dd className="mt-0.5 font-display text-lg font-bold">{litres(totalSupply, 2)}</dd>
              </div>
              <div className="rounded-xl border border-ink/8 bg-white/55 px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                  Backed lots
                </dt>
                <dd className="mt-0.5 font-display text-lg font-bold">
                  {backed}/{lots.length}
                </dd>
              </div>
            </dl>
          </div>

          {featured ? (
            <div className="relative">
              <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-gold/25 via-transparent to-olive/15 blur-xl" />
              <article className="card overflow-hidden">
                <div className="passport-banner grain relative px-5 py-4">
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">
                        Featured lot
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-bold">{featured.seriesName}</h2>
                      <p className="text-xs text-cream/70">
                        {featured.id} · {featured.litres.certified.toLocaleString("en-US")} L ·{" "}
                        {featured.producer.label}
                      </p>
                    </div>
                    <StatusBadge status={featured.status} />
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                        Primary price
                      </p>
                      <p className="font-display text-3xl font-bold">
                        {money(featured.price.value)}
                        <span className="ml-1 font-body text-sm font-medium text-ink-soft">/L</span>
                      </p>
                      <p className="text-xs text-ink-soft">≈ {tnd(featured.price.tndPerLitre)} per litre</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                        Per {featured.series}
                      </p>
                      <p className="font-display text-xl font-bold">{money(featured.price.perToken)}</p>
                      <p className="text-xs text-ink-soft">{featured.litres.perToken} L per token</p>
                    </div>
                  </div>
                  <ReserveGauge evaluation={featured.reserve} compact />
                  <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <BadgeCheck className="h-4 w-4 text-ok" />
                      {featured.attestations.length} signed attestation
                      {featured.attestations.length === 1 ? "" : "s"}
                    </div>
                    <Link to={`/lots/${featured.id}/buy`} className="btn-primary !px-4 !py-2 !text-xs">
                      Buy {featured.series}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <p className="font-display text-xl font-bold">No lots yet</p>
              <p className="mt-1 text-sm text-ink-soft">Seed the demo to create the first certified lot.</p>
              <Link to="/demo" className="btn-primary mt-4">
                Open demo controls
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="shell py-12 sm:py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Live market</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Two series, two buyers</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
              Retail tins for restaurants and families; bulk tanks for importers. Both are fully
              redeemable against the same audited warehouse stock.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-ink-soft">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            Prices update when the producer re-lists
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {lots.map((lot) => (
            <article key={lot.id} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-bold">{lot.seriesName}</h3>
                    <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink-soft">
                      {lot.series}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {lot.id} · {lot.producer.label}
                  </p>
                </div>
                <StatusBadge status={lot.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-cream-deep/50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Price</p>
                  <p className="mt-0.5 font-display text-xl font-bold">{money(lot.price.value)}</p>
                  <p className="text-[11px] text-ink-soft">
                    {tnd(lot.price.tndPerLitre)}/L · {money(lot.price.perToken)} per {lot.series}
                  </p>
                </div>
                <div className="rounded-xl bg-cream-deep/50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Remaining
                  </p>
                  <p className="mt-0.5 font-display text-xl font-bold">{litres(lot.litres.remaining, 0)}</p>
                  <p className="text-[11px] text-ink-soft">
                    of {lot.litres.certified.toLocaleString("en-US")} L certified
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-ink-soft">
                  <span>Reserve cover</span>
                  <span>{percentFromBps(lot.reserve.ratioBps)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <div
                    className={`h-full rounded-full ${
                      lot.status === "BACKED" ? "bg-ok" : lot.status === "LOW_STOCK" ? "bg-amber" : "bg-rust"
                    }`}
                    style={{ width: `${Math.min(100, lot.reserve.ratioBps / 100)}%` }}
                  />
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                {lot.agent?.explanation ?? "Reserve agent has not published an explanation yet."}
              </p>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink/10 pt-4">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <Bot className="h-3.5 w-3.5 text-olive" />
                  Agent · {lot.status.toLowerCase().replace("_", " ")}
                </div>
                <div className="flex gap-2">
                  <Link to={`/l/${lot.id}`} className="btn-ghost !px-3 !py-1.5 !text-xs">
                    Passport
                  </Link>
                  <Link to={`/lots/${lot.id}/buy`} className="btn-primary !px-3.5 !py-1.5 !text-xs">
                    Buy
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-ink/10 bg-white/40">
        <div className="shell py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
                A passport for every litre
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
                The token is the claim; the warehouse is the collateral; the auditor's signature is the
                proof. The reserve agent recomputes the whole thing from raw ledger records.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-ok" /> P-256 signed attestations
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Leaf className="h-3.5 w-3.5 text-olive" /> SHA-256 hash chain
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-gold" /> Deterministic rules
                </span>
              </div>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {STEPS.map((step, index) => (
                <li key={step.title} className="card-flat flex gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-olive-light text-olive-deep">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-olive/60">
                      Step {index + 1}
                    </p>
                    <p className="mt-0.5 text-sm font-bold">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
