import { QRCodeSVG } from "qrcode.react";

export default function QRCard({ url, size = 148, label = "Scan to open the lot passport", tone = "light" }) {
  const dark = tone === "dark";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`rounded-xl p-2.5 ${dark ? "bg-cream" : "bg-white"} shadow-sm`}>
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#1f2a1a"
          title={label}
        />
      </div>
      <p className={`max-w-[11rem] text-center text-[10px] leading-snug ${dark ? "text-cream/60" : "text-ink/45"}`}>
        {label}
      </p>
    </div>
  );
}
