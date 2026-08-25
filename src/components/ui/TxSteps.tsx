"use client";

/**
 * The wallet-prompt queue for a multi-transaction flow, shown before the first
 * prompt so a signer knows how many are coming and why. Steps are strictly
 * sequential: everything before `activeIndex` is done, and a flow that finishes
 * passes `steps.length`.
 */
export function TxSteps({
  steps,
  activeIndex,
  intro,
  ariaLabel,
  className = "rounded border border-shelf-deep bg-shelf p-3 text-xs",
}: {
  steps: readonly {
    /** Stable list key; falls back to the title when it is a plain string. */
    key?: string;
    title: React.ReactNode;
    detail?: string;
  }[];
  activeIndex: number;
  intro?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={className} aria-label={ariaLabel}>
      <p className="text-[11px] leading-relaxed text-mute">
        {intro ??
          (steps.length === 1
            ? "Your wallet will ask for one action."
            : `Your wallet will ask for ${steps.length} actions. This stays open and advances through each one.`)}
      </p>
      <ol className="mt-2 space-y-1">
        {steps.map((step, index) => (
          <li
            key={step.key ?? String(step.title)}
            data-state={
              activeIndex > index ? "complete" : activeIndex === index ? "active" : "pending"
            }
            aria-current={activeIndex === index ? "step" : undefined}
            className="flex items-start gap-2"
          >
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                activeIndex === index
                  ? "border-accent bg-shelf text-ink"
                  : activeIndex > index
                    ? "border-accent bg-accent text-ink"
                    : "border-shelf-deep text-mute"
              }`}
            >
              {activeIndex > index ? "✓" : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={activeIndex === index ? "font-medium text-ink" : "block text-mute"}>
                <span className="sr-only">
                  Step {index + 1} of {steps.length}:{" "}
                </span>
                {step.title}
              </span>
              {step.detail ? (
                <span className="mt-0.5 block text-[11px] text-mute">{step.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Two booleans is how progress usually arrives from a status query. */
export function stepStatus(complete: boolean, active: boolean): "done" | "active" | "pending" {
  return complete ? "done" : active ? "active" : "pending";
}

/**
 * A resumable leg of a flow whose steps can already be satisfied out of order,
 * so each carries its own state and its own explanatory body.
 */
export function TxStep({
  number,
  total,
  title,
  status,
  children,
}: {
  number: number;
  total: number;
  title: string;
  status: "done" | "active" | "pending";
  children?: React.ReactNode;
}) {
  const complete = status === "done";
  const active = status === "active";
  return (
    <li className="flex items-start gap-3" aria-current={active ? "step" : undefined}>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
          complete
            ? "border-accent bg-accent text-ink"
            : active
              ? "border-accent bg-shelf text-ink"
              : "border-shelf-deep text-mute"
        }`}
      >
        {complete ? "✓" : number}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] uppercase tracking-wide ${complete || active ? "text-ink" : "text-mute"}`}>
          Step {number} of {total}
        </p>
        <p className={`font-medium ${complete || active ? "text-ink" : "text-mute"}`}>{title}</p>
        {children}
      </div>
    </li>
  );
}
