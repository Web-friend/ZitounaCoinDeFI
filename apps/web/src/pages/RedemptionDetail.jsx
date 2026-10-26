import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardCheck,
  Clock,
  Flame,
  KeyRound,
  MapPin,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Ticket,
  Warehouse,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { dateTime, litres, relative } from "../lib/format.js";
import { useToast } from "../lib/toast.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import TxLink from "../components/TxLink.jsx";
import { Callout, ErrorState, Spinner } from "../components/ui.jsx";

const STEP_ORDER = ["REQUESTED", "HANDED_OVER", "BURNED"];

function StepRow({ active, done, title, at, description, icon: Icon }) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-olive text-cream" : active ? "bg-gold-soft text-amber" : "bg-cream-deep text-ink/30"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
      </span>
      <div className="pb-4">
        <p className={`text-sm font-semibold ${done || active ? "text-ink" : "text-ink/40"}`}>{title}</p>
        <p className="text-xs text-ink-soft">{description}</p>
        {at ? <p className="mt-0.5 text-[11px] text-ink/40">{dateTime(at)}</p> : null}
      </div>
    </li>
  );
}

export default function RedemptionDetail() {
  const { id } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pickupCode, setPickupCode] = useState("");
  const [source, setSource] = useState("VAULT_BOX");
  const [operatorOverride, setOperatorOverride] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["redemption", id],
    queryFn: () => api.redemption(id),
    refetchInterval: 10_000,
  });
  const redemption = data?.redemption;

  useEffect(() => {
    if (redemption?.pickupCode && redemption.status === "REQUESTED") {
      setPickupCode(redemption.pickupCode);
    }
  }, [redemption?.pickupCode, redemption?.status]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["redemption", id] });
    queryClient.invalidateQueries({ queryKey: ["redemptions"] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    queryClient.invalidateQueries({ queryKey: ["lots"] });
    queryClient.invalidateQueries({ queryKey: ["lot"] });
  };

  const handoverMutation = useMutation({
    mutationFn: () =>
      api.handover(redemption.id, {
        source,
        ...(operatorOverride ? { operatorOverride: true } : { pickupCode }),
      }),
    onSuccess: (result) => {
      toast.success("Oil handed over · tokens burned", {
        description: `${result.redemption.litres} L released · burn ${result.burnTxId}`,
      });
      invalidate();
    },
    onError: (mutationError) => toast.error("Handover failed", { description: mutationError.message }),
  });

  const returnMutation = useMutation({
    mutationFn: () => api.returnRedemption(redemption.id, { force: true }),
    onSuccess: () => {
      toast.info("Tokens returned to the holder", { description: "The pickup is closed and the tokens are back." });
      invalidate();
    },
    onError: (mutationError) => toast.error("Return failed", { description: mutationError.message }),
  });

  if (isLoading) return <Spinner label="Loading pickup…" className="py-24" />;
  if (error)
    return (
      <div className="shell py-16">
        <ErrorState error={error} onRetry={refetch} title="Pickup not found" />
      </div>
    );
  if (!redemption) return null;

  const statusIndex = STEP_ORDER.indexOf(redemption.status);
  const deadlinePassed = new Date(redemption.deadline).getTime() < Date.now();
  const isOpen = redemption.status === "REQUESTED";

  return (
    <div className="shell max-w-5xl py-6 sm:py-8">
      <nav className="mb-4 flex items-center gap-2 text-xs text-ink-soft">
        <Link to="/redemptions" className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          Redemptions
        </Link>
        <span className="text-ink/25">/</span>
        <span className="font-semibold text-ink">{redemption.code}</span>
      </nav>

      <header className="card overflow-hidden">
        <div className="passport-banner grain relative px-5 py-5 sm:px-7">
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">
                Warehouse pickup ticket
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold">{redemption.code}</h1>
              <p className="mt-1 text-sm text-cream/70">
                {redemption.holder.label} · {redemption.lotId} · {redemption.series}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-cream/60">
                <span className="inline-flex items-center gap-1.5">
                  <PackageCheck className="h-3.5 w-3.5" />
                  {litres(redemption.litres, 2)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Deadline {dateTime(redemption.deadline)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={redemption.status} />
              {isOpen ? (
                <div className="rounded-xl border border-cream/20 bg-cream/10 px-4 py-2 text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cream/50">Pickup code</p>
                  <p className="font-mono text-xl font-bold tracking-[0.2em]">{redemption.pickupCode}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/50 px-5 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-ink-soft">
            <Clock className="h-3.5 w-3.5" />
            Requested {relative(redemption.requestedAt)} · {dateTime(redemption.requestedAt)}
          </span>
          <span className="inline-flex items-center gap-2 text-ink-soft">
            Request tx <TxLink txId={redemption.requestTxId} />
          </span>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Pickup progress</h2>
            <ol className="mt-4">
              <StepRow
                done={statusIndex >= 0 && redemption.status !== "RETURNED"}
                active={redemption.status === "REQUESTED"}
                title="Tokens locked in treasury"
                description="The holder's tokens moved to the demo treasury. They are not burned yet."
                at={redemption.requestedAt}
                icon={Ticket}
              />
              <StepRow
                done={statusIndex >= 1 && redemption.status !== "RETURNED"}
                active={redemption.status === "REQUESTED"}
                title="Signed warehouse handover"
                description={
                  redemption.status === "RETURNED"
                    ? "Closed without handover; tokens were returned."
                    : "A signed handover record with the pickup hash is written to HCS."
                }
                at={redemption.handoverAt}
                icon={PackageCheck}
              />
              <StepRow
                done={redemption.status === "BURNED"}
                active={redemption.status === "HANDED_OVER"}
                title="Tokens burned"
                description="Burn clears the tokenized claim; the litre is now physical only."
                at={redemption.burnedAt}
                icon={Flame}
              />
            </ol>
            {redemption.status === "RETURNED" ? (
              <Callout tone="warn">This pickup was returned. Tokens are back in the holder's wallet.</Callout>
            ) : null}
          </section>

          {isOpen ? (
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-olive" />
                <h2 className="font-display text-lg font-bold">Operator handover</h2>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                The warehouse operator checks the code, confirms the litres, and burns the tokens. In the
                demo any account can act as the operator.
              </p>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handoverMutation.mutate();
                }}
              >
                <div>
                  <label className="label" htmlFor="pickup">
                    Pickup code
                  </label>
                  <input
                    id="pickup"
                    className="input font-mono tracking-widest"
                    value={pickupCode}
                    onChange={(event) => setPickupCode(event.target.value)}
                    maxLength={12}
                    disabled={operatorOverride}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="source">
                    Handover source
                  </label>
                  <select id="source" className="input" value={source} onChange={(event) => setSource(event.target.value)}>
                    <option value="VAULT_BOX">Vault box</option>
                    <option value="WAREHOUSE">Warehouse counter</option>
                    <option value="OPERATOR">Operator override</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-soft sm:col-span-2">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-olive"
                    checked={operatorOverride}
                    onChange={(event) => setOperatorOverride(event.target.checked)}
                  />
                  Operator override — skip the pickup code (demo rescue path)
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="btn-primary w-full !py-2.5 !text-xs"
                    disabled={handoverMutation.isPending || (!pickupCode && !operatorOverride)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {handoverMutation.isPending ? "Burning…" : "Confirm handover & burn"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {isOpen ? (
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber" />
                <h2 className="font-display text-lg font-bold">Missed the pickup?</h2>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                After {dateTime(redemption.deadline)} the holder can reclaim the tokens. The deadline
                {deadlinePassed ? " has passed." : ` is ${relative(redemption.deadline)}.`}
              </p>
              <button
                type="button"
                className="btn-secondary mt-3 !py-2 !text-xs"
                disabled={!deadlinePassed || returnMutation.isPending}
                onClick={() => {
                  if (window.confirm("Return the locked tokens to the holder and close this pickup?")) {
                    returnMutation.mutate();
                  }
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {deadlinePassed ? "Return tokens to holder" : "Available after the deadline"}
              </button>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Pickup details</h2>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Lot</dt>
                <dd className="font-semibold">
                  <Link to={`/lots/${redemption.lotId}`} className="hover:underline">
                    {redemption.lotId}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Series</dt>
                <dd className="font-semibold">{redemption.series}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Tokens</dt>
                <dd className="font-semibold">
                  {redemption.tokens} {redemption.series}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Litres</dt>
                <dd className="font-semibold">{litres(redemption.litres, 2)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Handover source</dt>
                <dd className="font-semibold">{redemption.handoverSource ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Burn tx</dt>
                <dd>
                  <TxLink txId={redemption.burnTxId} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-olive" />
              <h2 className="font-display text-lg font-bold">Collection point</h2>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive" />
              Demo warehouse · Sousse Central Warehouse, Bay 3. Bring the pickup code; the operator burns
              the tokens in front of you.
            </p>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-olive" />
              <h2 className="font-display text-lg font-bold">How the code works</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              The six-digit code is hashed into the handover record. It is not a secret key: the operator
              also checks the holder and lot. Timing: every step is a Hedera consensus message.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
