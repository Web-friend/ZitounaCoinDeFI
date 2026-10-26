import { parseRecord } from "@zitouna/rules";
import {
  ArrowLeftRight,
  Bot,
  FileCheck2,
  Flame,
  PackageCheck,
  ScrollText,
  ShoppingBasket,
  Tag,
  Ticket,
} from "lucide-react";
import { dateTime, shortId } from "../lib/format.js";

const TYPE_META = {
  GENESIS: { icon: ScrollText, label: "Genesis", tone: "bg-olive text-cream" },
  ATTESTATION: { icon: FileCheck2, label: "Attestation", tone: "bg-ok text-cream" },
  LISTING: { icon: Tag, label: "Listing", tone: "bg-gold text-olive-deep" },
  SALE: { icon: ShoppingBasket, label: "Sale", tone: "bg-olive-light text-olive-deep" },
  TRANSFER: { icon: ArrowLeftRight, label: "Transfer", tone: "bg-olive-light text-olive-deep" },
  REDEMPTION: { icon: Ticket, label: "Redemption", tone: "bg-amber-soft text-amber" },
  HANDOVER: { icon: PackageCheck, label: "Handover", tone: "bg-amber-soft text-amber" },
  BURN: { icon: Flame, label: "Burn", tone: "bg-rust-soft text-rust" },
  VERDICT: { icon: Bot, label: "Agent verdict", tone: "bg-olive-deep text-cream" },
};

function summarize(type, fields) {
  switch (type) {
    case "GENESIS":
      return `${fields.series} · ${Number(fields.litres).toLocaleString("en-US")} L · ${fields.grade.replace(/_/g, " ")} · ${fields.warehouse}`;
    case "ATTESTATION":
      return `${Number(fields.litresRemaining).toLocaleString("en-US")} L remaining · seq ${fields.seq}`;
    case "LISTING":
      return `${(fields.pricePerLitreCents / 100).toFixed(2)} ${fields.currency}/L · ${Number(fields.litresOffered).toLocaleString("en-US")} L offered`;
    case "SALE":
      return `${(fields.tokensCt / 100).toFixed(2)} tokens · ${(fields.litresMl / 1000).toFixed(1)} L · ${(fields.amountCents / 100).toFixed(2)} tUSDT`;
    case "TRANSFER":
      return `${(fields.tokensCt / 100).toFixed(2)} tokens · ${fields.from} → ${fields.to}`;
    case "REDEMPTION":
      return `${fields.rid} · ${(fields.litresMl / 1000).toFixed(1)} L locked`;
    case "HANDOVER":
      return `${fields.rid} · source ${fields.source}`;
    case "BURN":
      return `${fields.rid} · ${(fields.tokensCt / 100).toFixed(2)} tokens burned`;
    case "VERDICT":
      return `${fields.verdict} · ${(fields.ratioBps / 100).toFixed(1)}% cover${fields.reasons.length ? ` · ${fields.reasons.join(", ")}` : ""}`;
    default:
      return "";
  }
}

export default function Timeline({ messages = [], compact = false }) {
  if (!messages.length) {
    return (
      <p className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink-soft">
        No consensus messages yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {messages.map((message, index) => {
        const meta = TYPE_META[message.type] ?? { icon: ScrollText, label: message.type, tone: "bg-cream-deep text-ink" };
        const Icon = meta.icon;
        let parsed = null;
        try {
          parsed = parseRecord(message.payload);
        } catch {
          parsed = null;
        }
        const fields = parsed?.fields ?? {};
        return (
          <li key={`${message.topicId ?? "t"}-${message.seq}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
            {index < messages.length - 1 ? (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-ink/10" aria-hidden />
            ) : null}
            <span className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl border border-ink/8 bg-white/60 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-ink">{meta.label}</span>
                <span className="rounded bg-cream-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
                  #{message.seq}
                </span>
                <span className="text-[11px] text-ink/40">{dateTime(message.consensusTs)}</span>
                {message.hash ? (
                  <span className="ml-auto hidden font-mono text-[10px] text-ink/35 sm:block" title={message.hash}>
                    {shortId(message.hash, 10, 6)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 break-words text-xs leading-relaxed text-ink-soft">
                {parsed ? summarize(parsed.name, fields) : message.payload}
              </p>
              {!compact && parsed ? (
                <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-ink/30">{parsed.text}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
