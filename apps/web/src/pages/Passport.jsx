import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  ExternalLink,
  Leaf,
  MapPin,
  Package,
  Printer,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { dateOnly, litres, money, percentFromBps, tnd } from "../lib/format.js";
import AgentCard from "../components/AgentCard.jsx";
import QRCard from "../components/QRCard.jsx";
import ReserveGauge from "../components/ReserveGauge.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Timeline from "../components/Timeline.jsx";
import VerifyPanel from "../components/VerifyPanel.jsx";
import { ErrorState, Spinner } from "../components/ui.jsx";

export default function Passport() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["lot", id],
    queryFn: () => api.lot(id),
    refetchInterval: 30_000,
  });
  const lot = data?.lot;

  if (isLoading) return <Spinner label="Opening passport…" className="py-24" />;
  if (error) return <div className="shell py-16"><ErrorState error={error} onRetry={refetch} title="Passport unavailable" /></div>;
  if (!lot) return null;

  const passportUrl = `${window.location.origin}/l/${lot.id}`;

  return (
    <div className="shell max-w-5xl py-6 sm:py-8">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/passports" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          All passports
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="btn-secondary !px-3.5 !py-1.5 !text-xs">
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <Link to={`/lots/${lot.id}`} className="btn-primary !px-3.5 !py-1.5 !text-xs">
            Trade this lot
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <article className="print-sheet overflow-hidden rounded-2xl border-2 border-olive/25 bg-white/85 shadow-xl">
        <header className="relative border-b border-olive/20 bg-gradient-to-br from-olive via-olive-deep to-olive px-6 py-6 text-cream sm:px-8">
          <div className="grain absolute inset-0 opacity-30" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-cream/70">
                <Leaf className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.28em]">
                  ZitounaDeFi · lot passport
                </span>
              </div>
              <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
                {lot.seriesName}
              </h1>
              <p className="mt-1 text-sm text-cream/70">
                {lot.id} · {lot.grade.replace(/_/g, " ")} · harvest {lot.harvestYear}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusBadge status={lot.status} />
                <span className="rounded-full border border-cream/20 bg-cream/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cream/80">
                  {lot.series} · {lot.litres.perToken.toLocaleString("en-US")} L per token
                </span>
                <span className="rounded-full border border-cream/20 bg-cream/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cream/80">
                  NFT serial #{lot.nft.serial ?? "—"}
                </span>
              </div>
            </div>
            <QRCard url={passportUrl} size={128} tone="dark" label="Public passport · scan to verify" />
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6">
            <section>
              <p className="eyebrow">Certificate of custody</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/85">
                This lot is held at <strong>{lot.warehouse}</strong> and certified at{" "}
                {litres(lot.litres.certified, 0)}. Every token in the {lot.series} series is a claim on{" "}
                {lot.litres.perToken.toLocaleString("en-US")} litres from this stock. The reserve agent
                recomputes the cover from signed warehouse attestations published to Hedera Consensus
                Service topic <span className="font-mono text-xs">{lot.topicId}</span>.
              </p>
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-ink/10 bg-cream/60 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Certified</p>
                <p className="mt-1 font-display text-lg font-bold">{litres(lot.litres.certified, 0)}</p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-cream/60 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Attested left</p>
                <p className="mt-1 font-display text-lg font-bold">{litres(lot.litres.remaining, 0)}</p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-cream/60 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Tokenized</p>
                <p className="mt-1 font-display text-lg font-bold">{litres(lot.reserve.supplyLitres, 2)}</p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-cream/60 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Cover</p>
                <p className="mt-1 font-display text-lg font-bold">{percentFromBps(lot.reserve.ratioBps)}</p>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-ink/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                  <Sprout className="h-3.5 w-3.5 text-olive" /> Producer
                </p>
                <p className="mt-1 text-sm font-bold">{lot.producer.label}</p>
                <p className="font-mono text-[10px] text-ink-soft">{lot.producer.accountId}</p>
              </div>
              <div className="rounded-xl border border-ink/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                  <MapPin className="h-3.5 w-3.5 text-olive" /> Warehouse
                </p>
                <p className="mt-1 text-sm font-bold">{lot.warehouse}</p>
                <p className="text-[11px] text-ink-soft">Certified {dateOnly(lot.certifiedAt)}</p>
              </div>
              <div className="rounded-xl border border-ink/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                  <BadgeCheck className="h-3.5 w-3.5 text-olive" /> Primary price
                </p>
                <p className="mt-1 text-sm font-bold">
                  {money(lot.price.value)} / L
                  <span className="ml-1 font-medium text-ink-soft">({tnd(lot.price.tndPerLitre)}/L)</span>
                </p>
                <p className="text-[11px] text-ink-soft">{money(lot.price.perToken)} per {lot.series}</p>
              </div>
              <div className="rounded-xl border border-ink/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                  <Building2 className="h-3.5 w-3.5 text-olive" /> Redemption
                </p>
                <p className="mt-1 text-sm font-bold">
                  {lot.series === "DGZ" ? "0.5 DGZ (5 L)" : "1 TZT (1,000 L)"} minimum
                </p>
                <p className="text-[11px] text-ink-soft">Pickup at the warehouse, tokens burn at handover</p>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow">Consensus trail</p>
                <span className="inline-flex items-center gap-1 text-[10px] text-ink/40">
                  <ShieldCheck className="h-3 w-3" />
                  {lot.messages.length} messages
                </span>
              </div>
              <Timeline messages={lot.messages} compact />
            </section>
          </div>

          <aside className="space-y-4">
            <ReserveGauge evaluation={lot.reserve} compact />
            <AgentCard lot={lot} agent={lot.agent} variant="compact" />

            <div className="rounded-xl border border-ink/10 bg-cream/60 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Auditor key</p>
              <p className="mt-1 break-all font-mono text-[9px] leading-relaxed text-ink-soft">
                {lot.auditorPublicKey}
              </p>
            </div>

            <div className="rounded-xl border border-ink/10 bg-cream/60 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Ledger links</p>
              <div className="mt-2 space-y-1.5 text-[11px]">
                <a href={lot.hashscan.topic} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 text-olive hover:underline">
                  <span>HCS topic {lot.topicId}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a href={lot.hashscan.token} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 text-olive hover:underline">
                  <span>{lot.series} token</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a href={lot.hashscan.nft} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 text-olive hover:underline">
                  <span>Passport NFT</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-gold/30 bg-gold-soft/50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber">Verify it yourself</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                The passport page can re-check every signature in your browser. The audit proves stock
                custody, not legal title or insurance.
              </p>
            </div>

            <div className="rounded-xl border border-ink/10 p-3.5 text-center">
              <Package className="mx-auto h-4 w-4 text-olive" />
              <p className="mt-1 text-[11px] font-semibold">Redeem at the warehouse</p>
              <Link to="/redemptions" className="btn-secondary mt-2 w-full !py-1.5 !text-[11px]">
                Open redemption flow
              </Link>
            </div>
          </aside>
        </div>

        <footer className="border-t border-olive/20 bg-cream/60 px-6 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" />
              Issued {dateOnly(lot.createdAt)} · {lot.series} series · 2 decimals
            </span>
            <span className="font-mono">{passportUrl}</span>
          </div>
        </footer>
      </article>

      <div className="no-print mt-5">
        <VerifyPanel lot={lot} />
      </div>
    </div>
  );
}
