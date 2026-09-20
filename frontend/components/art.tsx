/**
 * Authored SVG for the concourse status board.
 * Everything here is decorative: each graphic ships beside a text label.
 */
import type { Status } from "@/lib/contract";

/** Service mark: a split-flap tile mid-throw, one leaf amber. */
export function BoardMark() {
  return (
    <svg className="mark" viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x="1.5" y="2.5" width="21" height="19" className="mark__case" />
      <rect x="4" y="5" width="16" height="6.4" className="mark__leaf" />
      <rect x="4" y="12.6" width="16" height="6.4" className="mark__leaf mark__leaf--back" />
      <path d="M2.6 12h18.8" className="mark__split" />
    </svg>
  );
}

/**
 * State bar: the status also reads as line form, so the three statuses
 * survive greyscale and colour blindness.
 *   ELIGIBLE  solid · INSUFFICIENT_EVIDENCE  dashed · RESTRICTED  struck
 */
export function StateBar({ status }: { status: Status | "" }) {
  return (
    <svg className={`statebar statebar--${tone(status)}`} viewBox="0 0 48 10" aria-hidden focusable="false" preserveAspectRatio="none">
      {status === "ELIGIBLE" && <rect x="0" y="3" width="48" height="4" className="statebar__ink" />}
      {status === "INSUFFICIENT_EVIDENCE" && (
        <g className="statebar__ink">
          <rect x="0" y="3" width="9" height="4" />
          <rect x="13" y="3" width="9" height="4" />
          <rect x="26" y="3" width="9" height="4" />
          <rect x="39" y="3" width="9" height="4" />
        </g>
      )}
      {status === "RESTRICTED" && (
        <g className="statebar__ink">
          <rect x="0" y="3" width="48" height="4" opacity="0.45" />
          <rect x="0" y="0" width="3" height="10" />
          <rect x="9" y="0" width="3" height="10" />
          <rect x="18" y="0" width="3" height="10" />
          <rect x="27" y="0" width="3" height="10" />
          <rect x="36" y="0" width="3" height="10" />
          <rect x="45" y="0" width="3" height="10" />
        </g>
      )}
      {status === "" && <rect x="0" y="4" width="48" height="2" className="statebar__ink" opacity="0.5" />}
    </svg>
  );
}

function tone(status: Status | "") {
  if (status === "ELIGIBLE") return "eligible";
  if (status === "RESTRICTED") return "restricted";
  if (status === "INSUFFICIENT_EVIDENCE") return "insufficient";
  return "none";
}

/** Gate cell: the split-flap that posts the consequence of the status. */
export function GateFlap({ open }: { open: boolean }) {
  return (
    <span className={`flap ${open ? "flap--open" : "flap--closed"}`}>
      {/* keyed on state: the leaf remounts and the flap replays only when the gate actually changes */}
      <span key={open ? "open" : "closed"} className="flap__leaf" aria-hidden />
      <span className="flap__text">{open ? "GATE OPEN" : "GATE CLOSED"}</span>
    </span>
  );
}

/** Status icon — one stroke weight across the set, never colour alone. */
export function StatusIcon({ status }: { status: Status | "" }) {
  switch (status) {
    case "ELIGIBLE":
      return (
        <svg className="sicon" viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M2.5 8.5 6.5 12.5 13.5 3.5" className="stroke" />
        </svg>
      );
    case "RESTRICTED":
      return (
        <svg className="sicon" viewBox="0 0 16 16" aria-hidden focusable="false">
          <circle cx="8" cy="8" r="5.5" className="stroke" />
          <path d="M4.2 11.8 11.8 4.2" className="stroke" />
        </svg>
      );
    case "INSUFFICIENT_EVIDENCE":
      return (
        <svg className="sicon" viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M8 2.5 14.5 13.5H1.5Z" className="stroke" />
          <path d="M8 6.5v3.2" className="stroke" />
          <path d="M8 11.6v.9" className="stroke" />
        </svg>
      );
    default:
      return (
        <svg className="sicon" viewBox="0 0 16 16" aria-hidden focusable="false">
          <circle cx="8" cy="8" r="5.5" className="stroke" />
          <path d="M5 8h6" className="stroke" />
        </svg>
      );
  }
}

type IconName = "lock" | "open" | "check" | "cross" | "arrow" | "dot" | "chip" | "plate" | "refresh" | "link";

export function Icon({ name }: { name: IconName }) {
  const p = { className: "icon", viewBox: "0 0 16 16", "aria-hidden": true, focusable: false } as const;
  switch (name) {
    case "lock":
      return (
        <svg {...p}>
          <rect x="3.5" y="7" width="9" height="6.5" className="stroke" />
          <path d="M5.5 7V4.8a2.5 2.5 0 0 1 5 0V7" className="stroke" />
        </svg>
      );
    case "open":
      return (
        <svg {...p}>
          <rect x="3.5" y="7" width="9" height="6.5" className="stroke" />
          <path d="M5.5 7V4.8a2.5 2.5 0 0 1 4.8-.9" className="stroke" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="M2.5 8.5 6.5 12.5 13.5 3.5" className="stroke" />
        </svg>
      );
    case "cross":
      return (
        <svg {...p}>
          <path d="M4 4l8 8M12 4l-8 8" className="stroke" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...p}>
          <path d="M2.5 8h10M9.2 4.4 12.8 8l-3.6 3.6" className="stroke" />
        </svg>
      );
    case "dot":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="3" className="fill" />
        </svg>
      );
    case "chip":
      return (
        <svg {...p}>
          <rect x="4" y="4" width="8" height="8" className="stroke" />
          <path d="M6.5 1.5V4M9.5 1.5V4M6.5 12v2.5M9.5 12v2.5M1.5 6.5H4M1.5 9.5H4M12 6.5h2.5M12 9.5h2.5" className="stroke" />
        </svg>
      );
    case "plate":
      return (
        <svg {...p}>
          <rect x="2.5" y="3" width="11" height="10" className="stroke" />
          <path d="M5 6h6M5 8.5h6M5 11h3.5" className="stroke" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...p}>
          <path d="M13 8a5 5 0 1 1-1.8-3.85" className="stroke" />
          <path d="M13.2 1.8v3.1h-3.1" className="stroke" />
        </svg>
      );
    case "link":
      return (
        <svg {...p}>
          <path d="M6.6 9.4a2.8 2.8 0 0 0 4 0l2-2a2.83 2.83 0 0 0-4-4l-1 1" className="stroke" />
          <path d="M9.4 6.6a2.8 2.8 0 0 0-4 0l-2 2a2.83 2.83 0 0 0 4 4l1-1" className="stroke" />
        </svg>
      );
  }
}
