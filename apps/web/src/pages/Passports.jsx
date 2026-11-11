import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Leaf, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { litres, percentFromBps } from "../lib/format.js";
import QRCard from "../components/QRCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { EmptyState, ErrorState, Spinner } from "../components/ui.jsx";

export default function Passports() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["lots"], queryFn: api.lots });
  if (isLoading) return <Spinner label="Loading passports…" className="py-24" />;
  if (error) return <div className="shell py-16"><ErrorState error={error} onRetry={refetch} /></div>;

  const lots = data?.lots ?? [];

  return (
    <div className="shell py-8 sm:py-10">
      <div className="max-w-2xl">
        <p className="eyebrow">Public record</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Lot passports
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Each passport is a stable URL you can print on a warehouse label and scan at the mill, in the
          truck, or at the counter. No login required.
        </p>
      </div>

      {lots.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No passports yet"
            description="Seed the demo to create the first certified lot and its passport."
            action={<Link to="/demo" className="btn-primary !py-2 !text-xs">Open demo controls</Link>}
            icon={QrCode}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {lots.map((lot) => {
            const url = `${window.location.origin}/l/${lot.id}`;
            return (
              <article key={lot.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <QRCard url={url} size={112} label={`/l/${lot.id}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold">{lot.seriesName}</h2>
                    <StatusBadge status={lot.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {lot.id} · {litres(lot.litres.certified, 0)} certified · {lot.warehouse}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-ink-soft">
                      <Leaf className="h-3.5 w-3.5 text-olive" />
                      {percentFromBps(lot.reserve.ratioBps)} covered
                    </span>
                    <span className="text-ink-soft">{lot.attestations.length} attestations</span>
                    <span className="text-ink-soft">NFT #{lot.nft.serial ?? "—"}</span>
                  </div>
                  <Link to={`/l/${lot.id}`} className="btn-secondary mt-3 !px-3.5 !py-1.5 !text-xs">
                    Open passport
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
