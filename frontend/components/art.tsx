/**
 * Authored SVG pieces for the "Guardian Command Center" look.
 * All decorative: callers pair every graphic with a text label.
 */
import type { Status } from "@/lib/contract";

/** 16×16 pixel map → one <rect> per horizontal run, grouped by colour class. */
function Pixels({ rows, palette }: { rows: string[]; palette: Record<string, string> }) {
  const rects: React.ReactNode[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (palette[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} className={palette[ch]} />);
      x = end;
    }
  });
  return <>{rects}</>;
}

const GUARDIAN = [
  "....kkkkkkkk....",
  "..kkbbbbbbbbkk..",
  ".kbwbbbbbbbbbbk.",
  ".kbbbbbbbbbbbbk.",
  ".kbccccccccccbk.",
  ".kbcckcccckccbk.",
  ".kbcckcccckccbk.",
  ".kbcccckkccccbk.",
  ".kbbccccccccbbk.",
  "..kbbbbbbbbbbk..",
  "..kbbbmmmmbbbk..",
  "...kbbbmmbbbk...",
  "....kbbbbbbk....",
  ".....kbbbbk.....",
  "......kbbk......",
  ".......kk.......",
];

export function Guardian({ className = "" }: { className?: string }) {
  return (
    <svg className={`guardian ${className}`} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden focusable="false">
      <Pixels rows={GUARDIAN} palette={{ k: "px-ink", b: "px-body", w: "px-shine", c: "px-face", m: "px-mint" }} />
    </svg>
  );
}

/** Small abstract emblem per monitored territory. */
export function AssetEmblem({ assetId }: { assetId: string }) {
  const cls = `emblem emblem--${assetId.toLowerCase()}`;
  if (assetId === "NWUSD") {
    // north star / compass rose
    return (
      <svg className={cls} viewBox="0 0 24 24" aria-hidden focusable="false">
        <rect x="1" y="1" width="22" height="22" rx="5" className="emblem__plate" />
        <path d="M12 3.5 14 10l6.5 2-6.5 2-2 6.5-2-6.5L3.5 12 10 10Z" className="emblem__mark" />
        <rect x="11" y="11" width="2" height="2" className="emblem__dot" />
      </svg>
    );
  }
  if (assetId === "HLUSD") {
    // halcyon wave over a rising sun
    return (
      <svg className={cls} viewBox="0 0 24 24" aria-hidden focusable="false">
        <rect x="1" y="1" width="22" height="22" rx="5" className="emblem__plate" />
        <path d="M6 14a6 6 0 0 1 12 0Z" className="emblem__mark" />
        <path d="M4 17.5c2-1.6 3.4-1.6 5.3 0s3.4 1.6 5.4 0 3.3-1.6 5.3 0" className="emblem__wave" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x="1" y="1" width="22" height="22" rx="5" className="emblem__plate" />
      <path d="M12 5 18 8.5v7L12 19l-6-3.5v-7Z" className="emblem__mark" />
    </svg>
  );
}

/**
 * The signature gate: two doors in a frame with a beacon.
 * `tone` colours the beacon; `open` slides the doors into the posts.
 */
export function GateArt({ open, tone }: { open: boolean; tone: string }) {
  return (
    <svg className={`gateart gateart--${open ? "open" : "closed"} gateart--${tone}`} viewBox="0 0 64 44" aria-hidden focusable="false">
      <rect x="2" y="42" width="60" height="2" className="gateart__ground" />
      <rect x="8" y="18" width="48" height="24" className="gateart__void" />
      <path d="M26 34h12M32 28l6 6-6 6" className="gateart__path" />
      <g className="gateart__door gateart__door--l">
        <rect x="9" y="18" width="23" height="24" className="gateart__panel" />
        <path d="M15 19v22M21 19v22M27 19v22" className="gateart__bars" />
      </g>
      <g className="gateart__door gateart__door--r">
        <rect x="32" y="18" width="23" height="24" className="gateart__panel" />
        <path d="M37 19v22M43 19v22M49 19v22" className="gateart__bars" />
      </g>
      <g className="gateart__lock">
        <rect x="28" y="27" width="8" height="7" rx="1" />
        <path d="M29.5 27v-2.5a2.5 2.5 0 0 1 5 0V27" />
      </g>
      <rect x="2" y="10" width="6" height="32" className="gateart__post" />
      <rect x="56" y="10" width="6" height="32" className="gateart__post" />
      <rect x="2" y="10" width="60" height="6" className="gateart__beam" />
      <rect x="28" y="4" width="8" height="6" className="gateart__beacon" />
    </svg>
  );
}

/** Icon that accompanies every status label (never colour alone). */
export function StatusIcon({ status }: { status: Status | "" }) {
  switch (status) {
    case "ELIGIBLE":
      return (
        <svg className="sicon" viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M3 8.5 6.5 12 13 4.5" className="sicon__stroke" />
        </svg>
      );
    case "RESTRICTED":
      return (
        <svg className="sicon" viewBox="0 0 16 16" aria-hidden focusable="false">
          <rect x="3" y="7" width="10" height="7" rx="1" className="sicon__fill" />
          <path d="M5 7V5a3 3 0 0 1 6 0v2" className="sicon__stroke" />
        </svg>
      );
    case "INSUFFICIENT_EVIDENCE":
      return (
        <svg className="sicon" viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M5.5 5.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8" className="sicon__stroke" />
          <rect x="7" y="11.5" width="2" height="2" className="sicon__fill" />
        </svg>
      );
    default:
      return (
        <svg className="sicon" viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M4 8h8" className="sicon__stroke" />
        </svg>
      );
  }
}

type IconName = "lock" | "open" | "check" | "cross" | "star" | "arrow" | "node" | "chip" | "scroll";

export function Icon({ name }: { name: IconName }) {
  const common = { className: "icon", viewBox: "0 0 16 16", "aria-hidden": true, focusable: false } as const;
  switch (name) {
    case "lock":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="10" height="7" rx="1" className="icon__fill" />
          <path d="M5 7V5a3 3 0 0 1 6 0v2" className="icon__stroke" />
        </svg>
      );
    case "open":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="10" height="7" rx="1" className="icon__fill" />
          <path d="M5 7V5a3 3 0 0 1 5.8-1" className="icon__stroke" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M3 8.5 6.5 12 13 4.5" className="icon__stroke" />
        </svg>
      );
    case "cross":
      return (
        <svg {...common}>
          <path d="M4 4l8 8M12 4l-8 8" className="icon__stroke" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="M8 1.5 9.6 6.4 14.5 8l-4.9 1.6L8 14.5 6.4 9.6 1.5 8l4.9-1.6Z" className="icon__fill" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" className="icon__stroke" />
        </svg>
      );
    case "node":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="6" height="6" className="icon__fill" />
          <path d="M1 8h4M11 8h4" className="icon__stroke" />
        </svg>
      );
    case "chip":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="9" height="9" rx="1" className="icon__stroke" />
          <path d="M6 1v2.5M10 1v2.5M6 12.5V15M10 12.5V15M1 6h2.5M1 10h2.5M12.5 6H15M12.5 10H15" className="icon__stroke" />
        </svg>
      );
    case "scroll":
      return (
        <svg {...common}>
          <rect x="3" y="2" width="10" height="12" rx="1" className="icon__stroke" />
          <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" className="icon__stroke" />
        </svg>
      );
  }
}
