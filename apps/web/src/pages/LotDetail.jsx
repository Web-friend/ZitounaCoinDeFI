import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Building2,
  CalendarDays,
  ExternalLink,
  MapPin,
  Package,
  Printer,
  QrCode,
  ShieldCheck,
  Sprout,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { dateTime, litres, money, percentFromBps, tnd } from "../lib/format.js";
import { useToast } from "../lib/toast.jsx";
import AgentCard from "../components/AgentCard.jsx";
import QRCard from "../components/QRCard.jsx";
import ReserveGauge from "../components/ReserveGauge.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Timeline from "../components/Timeline.jsx";
import TxLink from "../components/TxLink.jsx";
import VerifyPanel from "../components/VerifyPanel.jsx";
import { Callout, EmptyState, ErrorState, Spinner, Stat } from "../components/ui.jsx";

const TABS = [
  { id: "passport", label: "Passport" },
  { id: "audit", label: "Audit trail" },
  { id: "activity", label: "Market activity" },
];

export default function LotDetail() {
  const { id } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("passport");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["lot", id],
    queryFn: () => api.lot(id),
    refetchInterval: 20_000,
  });
  const lot = data?.lot;

  const agentCheck = useMutation({
    mutationFn: () => api.agentCheck(lot.dbId ?? lot.id),
    onSuccess: (result) => {
      toast.success(`Verdict: ${result.verdict.replace("_", " ")}`, {
        description: "A fresh verdict was appended to the lot topic.",
      });
      queryClient.invalidateQueries({ queryKey: ["lot", id] });
      queryClient.invalidateQueries({ queryKey: ["lots"] });
    },
    onError: (mutationError) => toast.error("Agent check failed", { description: mutationError.message }),
  });

  if (isLoading) return <Spinner label="Loading lot passport…" className="py-24" />;
  if (error) return <div className="shell py-16"><ErrorState error={error} onRetry={refetch} /></div>;
  if (!lot) return null;

  const saleOpen = lot.listing?.active && ["BACKED", "LOW_STOCK"].includes(lot.status);
  const passportUrl = `${window.location.origin}/l/${lot.id}`;
  const soldLitres = Math.max(0, lot.listing ? lot.listing.litresOffered - lot.litres.remaining : 0);

  return (
    <div className="shell py-6 sm:py-8">
      <nav className="no-print mb-4 flex items-center gap-2 text-xs text-ink-soft">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          Market
        </Link>
        <span className="text-ink/25">/</span>
        <span className="font-semibold text-ink">{lot.id}</span>
      </nav>

      <header className="card overflow-hidden">
        <div className="passport-banner grain relative px-5 py-5 sm:px-7 sm:py-6">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">
                  Lot passport
                </p>
                <StatusBadge status={lot.status} />
                <span className="rounded-full bg-cream/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cream/80">
                  {lot.lotStatus.toLowerCase().replace("_", " ")}
                </span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {lot.seriesName}
              </h1>
              <p className="mt-1 text-sm text-cream/70">
                {lot.id} · {lot.litres.certified.toLocaleString("en-US")} L certified · grade{" "}
                {lot.grade.replace(/_/g, " ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-cream/70">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {lot.warehouse}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Harvest {lot.harvestYear}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sprout className="h-3.5 w-3.5" />
                  {lot.producer.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:flex-col sm:items-end">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cream/50">Price</p>
                <p className="font-display text-3xl font-bold">{money(lot.price.value)}</p>
                <p className="text-xs text-cream/60">
                  per litre · {money(lot.price.perToken)} per {lot.series}
                </p>
              </div>
              <QRCard url={passportUrl} size={92} tone="dark" label="Public passport" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-white/50 px-5 py-3 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            {saleOpen ? (
              <Link to={`/lots/${lot.id}/buy`} className="btn-primary !px-4 !py-2 !text-xs">
                Buy {lot.series}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className="badge border border-ink/15 bg-cream-deep text-ink-soft">
                Sales {lot.status === "LOW_STOCK" ? "closing" : "paused"}
              </span>
            )}
            <Link to={`/redemptions?lot=${lot.id}`} className="btn-secondary !px-4 !py-2 !text-xs">
              <Package className="h-3.5 w-3.5" />
              Redeem
            </Link>
            <Link to={`/lots/${lot.id}/label`} className="btn-ghost !px-3 !py-2 !text-xs">
              <Printer className="h-3.5 w-3.5" />
              Label
            </Link>
            <button
              type="button"
              onClick={() => agentCheck.mutate()}
              disabled={agentCheck.isPending}
              className="btn-ghost !px-3 !py-2 !text-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {agentCheck.isPending ? "Checking…" : "Agent check"}
            </button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5 text-olive" />
              {lot.supply.circulating.toFixed(2)} {lot.series} circulating
            </span>
            {lot.topicId ? (
              <a
                href={lot.hashscan.topic}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] text-olive hover:underline"
              >
                <QrCode className="h-3 w-3" />
                {lot.topicId}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Certified" value={litres(lot.litres.certified, 0)} hint="Audited at intake" />
            <Stat label="Attested left" value={litres(lot.litres.remaining, 0)} hint="Latest stock count" />
            <Stat
              label="Tokenized"
              value={litres(lot.supply.circulating * lot.litres.perToken, 2)}
              hint={`${lot.supply.circulating.toFixed(2)} ${lot.series}`}
            />
            <Stat
              label="Cover"
              value={percentFromBps(lot.reserve.ratioBps)}
              hint={lot.reserve.headroomLitres ? `${lot.reserve.headroomLitres.toFixed(1)} L headroom` : "Fully covered"}
            />
          </div>

          <div className="flex flex-wrap gap-1 rounded-full border border-ink/10 bg-white/50 p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  tab === item.id ? "bg-olive text-cream" : "text-ink-soft hover:bg-ink/5"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "passport" ? (
            <div className="space-y-5">
              <section className="card p-5">
                <h2 className="font-display text-lg font-bold">What this token represents</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  One {lot.series} token is a claim on {lot.litres.perToken.toLocaleString("en-US")} litres
                  from this certified lot. Tokens carry two decimals, so the smallest unit is{" "}
                  {(lot.litres.perToken / 100).toLocaleString("en-US")} L. Redemption burns the token and
                  releases the physical oil.
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-cream-deep/50 px-3.5 py-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                      Listing
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold">
                      {lot.listing?.active
                        ? `${litres(lot.listing.litresOffered, 0)} offered · ${money(
                            lot.price.value,
                          )}/L`
                        : "Not listed"}
                    </dd>
                    <dd className="mt-0.5 text-[11px] text-ink-soft">
                      {lot.listing ? `${litres(soldLitres, 1)} sold so far` : "Producer has not opened sales"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream-deep/50 px-3.5 py-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                      TND reference
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold">
                      {tnd(lot.price.tndPerLitre)} / L
                    </dd>
                    <dd className="mt-0.5 text-[11px] text-ink-soft">
                      Fixed demo rate 1 USD = {lot.tndPerUsd.toFixed(2)} TND
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream-deep/50 px-3.5 py-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                      Producer
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
                      <Building2 className="h-3.5 w-3.5 text-olive" />
                      {lot.producer.label}
                    </dd>
                    <dd className="mt-0.5 font-mono text-[10px] text-ink-soft">
                      {lot.producer.accountId}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-cream-deep/50 px-3.5 py-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                      Passport NFT
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
                      <BadgeCheck className="h-3.5 w-3.5 text-ok" />
                      Serial #{lot.nft.serial ?? "—"}
                    </dd>
                    <dd className="mt-0.5 font-mono text-[10px] text-ink-soft">
                      {lot.nft.tokenId ?? "not minted"}
                    </dd>
                  </div>
                </dl>
              </section>

              <VerifyPanel lot={lot} />

              <Callout tone="info" title="What the audit does and does not prove">
                A valid chain proves the auditor signed these stock counts, in order, without edits. It
                does not prove legal title, insurance, or that the mill never over-issued a paper receipt.
                The trust anchor is the auditor key in the genesis message; the topic submit key is held
                by the demo operator.
              </Callout>
            </div>
          ) : null}

          {tab === "audit" ? (
            <div className="space-y-5">
              <section className="card p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">HCS audit trail</h2>
                    <p className="text-xs text-ink-soft">
                      {lot.messages.length} consensus message{lot.messages.length === 1 ? "" : "s"} on{" "}
                      {lot.topicId ?? "—"}
                    </p>
                  </div>
                  {lot.topicId ? (
                    <a
                      href={lot.hashscan.topic}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary !px-3.5 !py-1.5 !text-xs"
                    >
                      HashScan
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <Timeline messages={lot.messages} />
              </section>

              <section className="card p-5">
                <h2 className="font-display text-lg font-bold">Signed attestations</h2>
                <p className="text-xs text-ink-soft">
                  Each record chains to the previous hash and is signed by the auditor key.
                </p>
                <div className="mt-4 space-y-2">
                  {lot.attestations.map((attestation) => (
                    <details key={attestation.seq} className="rounded-xl border border-ink/10 bg-white/60 px-3.5 py-2.5">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded bg-cream-deep px-1.5 py-0.5 font-mono text-[10px]">
                          #{attestation.seq}
                        </span>
                        <span>{dateTime(attestation.consensusTs)}</span>
                        <span className="ml-auto font-mono text-[10px] text-ink/40" title={attestation.chainHash}>
                          {attestation.chainHash?.slice(0, 16)}…
                        </span>
                      </summary>
                      <div className="mt-2 space-y-2 text-[11px]">
                        <p className="break-all font-mono leading-relaxed text-ink-soft">{attestation.text}</p>
                        <p className="break-all font-mono text-[10px] text-ink/40">
                          signature: {attestation.signature}
                        </p>
                      </div>
                    </details>
                  ))}
                  {lot.attestations.length === 0 ? (
                    <p className="text-sm text-ink-soft">No attestations yet.</p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "activity" ? (
            <div className="space-y-5">
              <section className="card p-5">
                <h2 className="font-display text-lg font-bold">Sales</h2>
                {lot.trades.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Buyer</th>
                          <th>Litres</th>
                          <th>Tokens</th>
                          <th>Paid</th>
                          <th>Tx</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lot.trades.map((trade) => (
                          <tr key={trade.id}>
                            <td className="font-medium">{trade.buyer}</td>
                            <td>{litres(trade.litres, 1)}</td>
                            <td>
                              {trade.tokens} {lot.series}
                            </td>
                            <td>{money(trade.amount)}</td>
                            <td>
                              <TxLink txId={trade.swapTxId} />
                            </td>
                            <td className="whitespace-nowrap text-xs text-ink-soft">{dateTime(trade.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="No sales yet"
                    description="Be the first buyer. The primary sale mints tokens and swaps tUSDT atomically."
                    action={
                      saleOpen ? (
                        <Link to={`/lots/${lot.id}/buy`} className="btn-primary !py-2 !text-xs">
                          Buy {lot.series}
                        </Link>
                      ) : null
                    }
                  />
                )}
              </section>

              <section className="card p-5">
                <h2 className="font-display text-lg font-bold">Transfers</h2>
                {lot.transfers.length ? (
                  <ul className="mt-3 divide-y divide-ink/5">
                    {lot.transfers.map((transfer) => (
                      <li key={transfer.id} className="flex flex-wrap items-center gap-2 py-2.5 text-xs">
                        <span className="font-medium">{transfer.from}</span>
                        <ArrowRight className="h-3 w-3 text-ink/30" />
                        <span className="font-medium">{transfer.to}</span>
                        <span className="rounded bg-cream-deep px-1.5 py-0.5 font-mono text-[10px]">
                          {transfer.tokens} {lot.series}
                        </span>
                        <span className="ml-auto text-ink/40">{dateTime(transfer.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-soft">No peer transfers yet.</p>
                )}
              </section>

              <section className="card p-5">
                <h2 className="font-display text-lg font-bold">Redemptions</h2>
                {lot.redemptions.length ? (
                  <ul className="mt-3 divide-y divide-ink/5">
                    {lot.redemptions.map((redemption) => (
                      <li key={redemption.id} className="flex flex-wrap items-center gap-2 py-2.5 text-xs">
                        <Link to={`/redemptions/${redemption.id}`} className="font-semibold text-olive hover:underline">
                          {redemption.code}
                        </Link>
                        <span className="text-ink-soft">
                          {redemption.holder} · {litres(redemption.litres, 1)}
                        </span>
                        <StatusBadge status={redemption.status} className="ml-auto" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-soft">No redemption requests yet.</p>
                )}
              </section>
            </div>
          ) : null}
        </div>

        <aside className="space-y-5">
          <ReserveGauge evaluation={lot.reserve} />
          <AgentCard lot={lot} onChecked={() => refetch()} />

          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Series constants</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Litres per token</dt>
                <dd className="font-semibold">{lot.litres.perToken.toLocaleString("en-US")} L</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Token decimals</dt>
                <dd className="font-semibold">2 (0.01 {lot.series})</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Smallest unit</dt>
                <dd className="font-semibold">{(lot.litres.perToken / 100).toLocaleString("en-US")} L</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Max supply</dt>
                <dd className="font-semibold">
                  {lot.supply.max.toLocaleString("en-US")} {lot.series}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Series token</dt>
                <dd className="font-mono text-[10px] font-semibold">{lot.supply.tokenId}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Verify externally</h2>
            <div className="mt-3 space-y-2 text-xs">
              <a href={lot.hashscan.topic} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-cream-deep/50 px-3 py-2 hover:bg-cream-deep">
                <span className="inline-flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-olive" />
                  HCS topic
                </span>
                <ExternalLink className="h-3 w-3 text-ink/40" />
              </a>
              <a href={lot.hashscan.token} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-cream-deep/50 px-3 py-2 hover:bg-cream-deep">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-olive" />
                  {lot.series} token
                </span>
                <ExternalLink className="h-3 w-3 text-ink/40" />
              </a>
              <a href={`/l/${lot.id}`} className="flex items-center justify-between rounded-lg bg-cream-deep/50 px-3 py-2 hover:bg-cream-deep">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-olive" />
                  Public passport
                </span>
                <ArrowRight className="h-3 w-3 text-ink/40" />
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
