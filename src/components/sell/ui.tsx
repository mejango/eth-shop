export const field =
  "w-full border-b-2 border-shelf-deep bg-transparent py-2 text-lg outline-none focus:border-accent focus-visible:outline-none";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

export function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 py-1.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-accent"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-mute">{hint}</span>}
      </span>
    </label>
  );
}

/** Native disclosure: the progressive-reveal primitive for every optional section. */
export function More({
  label = "More options",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group pt-1">
      <summary className="cursor-pointer list-none text-sm text-mute select-none hover:text-ink">
        <span className="inline-block w-4 transition-transform group-open:rotate-90">▸</span>{" "}
        {label}
      </summary>
      <div className="mt-5 space-y-6">{children}</div>
    </details>
  );
}

export function PillsMulti<T extends string>({
  values,
  options,
  onToggle,
}: {
  values: T[];
  options: [T, string][];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => {
        const on = values.includes(v);
        return (
          <label
            key={v}
            className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${on ? "border-ink bg-ink text-paper" : "border-shelf-deep hover:border-ink"}`}
          >
            <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggle(v)} />
            {label}
          </label>
        );
      })}
    </div>
  );
}

export function Pills<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label
          key={v}
          className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${value === v ? "border-ink bg-ink text-paper" : "border-shelf-deep hover:border-ink"}`}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === v}
            onChange={() => onChange(v)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
