import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Leaf, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { dateOnly, litres, money, tnd } from "../lib/format.js";
import QRCard from "../components/QRCard.jsx";
import { ErrorState, Spinner } from "../components/ui.jsx";

export default function Label() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["lot", id], queryFn: () => api.lot(id) });
  const lot = data?.lot;

  if (isLoading) return <Spinner label="Preparing label…" className="py-24" />;
  if (error) return <div className="shell py-16"><ErrorState error={error} onRetry={refetch} /></div>;
  if (!lot) return null;

  const url = `${window.location.origin}/l/${lot.id}`;

  return (
    <div className="shell max-w-3xl py-6 sm:py-8">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to={`/lots/${lot.id}`} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to lot
        </Link>
        <button type="button" className="btn-primary !px-4 !py-2 !text-xs" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Print label
        </button>
      </div>

      <section className="print-sheet mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-ink bg-white">
        <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-olive" />
            <div>
              <p className="display text-lg font-bold leading-none">ZitounaDeFi</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-ink/50">
                Certified olive oil · warehouse label
              </p>
            </div>
          </div>
          <p className="rounded-full border border-ink/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]">
            Demo lot · {lot.series}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4 p-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink/45">Lot</p>
            <p className="display text-4xl font-bold leading-none tracking-tight">{lot.id}</p>
            <p className="mt-1 text-sm font-semibold">{lot.seriesName}</p>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">Certified</dt>
                <dd className="font-semibold">{litres(lot.litres.certified, 0)}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">Attested left</dt>
                <dd className="font-semibold">{litres(lot.litres.remaining, 0)}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">Grade</dt>
                <dd className="font-semibold capitalize">{lot.grade.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">Harvest</dt>
                <dd className="font-semibold">{lot.harvestYear}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">Price</dt>
                <dd className="font-semibold">
                  {money(lot.price.value)} / L
                  <span className="ml-1 font-normal text-ink/50">({tnd(lot.price.tndPerLitre)})</span>
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">Per token</dt>
                <dd className="font-semibold">
                  {money(lot.price.perToken)} · {lot.litres.perToken} L
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-dashed border-ink/30 pt-3 text-[11px]">
              <p className="font-semibold">{lot.warehouse}</p>
              <p className="text-ink/55">
                Certified {dateOnly(lot.certifiedAt)} · producer {lot.producer.label}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between">
            <QRCard url={url} size={148} label="Scan to verify" />
            <div className="mt-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">HCS topic</p>
              <p className="font-mono text-[10px]">{lot.topicId ?? "—"}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">NFT serial</p>
              <p className="font-mono text-[10px]">#{lot.nft.serial ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-ink px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] leading-relaxed text-ink/55">
            <p className="max-w-[70%]">
              This label identifies a tokenized lot. Tokens are redeemed at the warehouse; the claim is
              burned at handover. Verify the auditor signatures at the passport URL above.
            </p>
            <p className="font-mono text-[8px]">{url}</p>
          </div>
        </div>
      </section>

      <p className="no-print mx-auto mt-3 max-w-2xl text-center text-[11px] text-ink/40">
        Print at 100% scale on A5 or larger. The QR links to the public passport, which re-verifies the
        signatures in the visitor's browser.
      </p>
    </div>
  );
}
