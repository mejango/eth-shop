"use client";
import Link from "next/link";
import { useState } from "react";
import { Art } from "./ItemCard";

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
const field =
  "w-full border-b-2 border-shelf-deep bg-transparent py-2 text-lg outline-none focus:border-accent";

// ponytail: three screens, local state only. Submitting = launchProjectFor + 721 hook later.
export function SellFlow({ initialHandle }: { initialHandle: string }) {
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState(clean(initialHandle));
  const [name, setName] = useState("");
  const [item, setItem] = useState({
    name: "",
    price: "",
    kind: "digital" as "digital" | "physical",
    limit: "",
  });
  const steps = ["Your shop", "First item", "Open"];

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <ol className="mb-10 flex gap-6 text-sm">
        {steps.map((s, i) => (
          <li key={s} className={i === step ? "font-medium" : "text-mute"}>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep(1);
          }}
          className="space-y-8"
        >
          <div>
            <label className="text-sm text-mute" htmlFor="handle">
              Link
            </label>
            <div className="flex items-baseline font-mono text-2xl">
              <span className="text-mute">eth.shop/</span>
              <input
                id="handle"
                required
                value={handle}
                onChange={(e) => setHandle(clean(e.target.value))}
                className={`${field} text-2xl`}
                placeholder="you"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-mute" htmlFor="name">
              Shop name
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
              placeholder="Small Hours Tea"
            />
          </div>
          <button className="rounded-full bg-ink px-6 py-3 text-paper hover:bg-accent">
            Next: add an item
          </button>
        </form>
      )}

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep(2);
          }}
          className="space-y-8"
        >
          <div>
            <label className="text-sm text-mute" htmlFor="iname">
              What are you selling?
            </label>
            <input
              id="iname"
              required
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
              className={field}
              placeholder="Hojicha, 50g"
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-mute" htmlFor="price">
                Price (ETH)
              </label>
              <input
                id="price"
                required
                inputMode="decimal"
                value={item.price}
                onChange={(e) => setItem({ ...item, price: e.target.value })}
                className={`${field} font-mono`}
                placeholder="0.004"
              />
            </div>
            <div>
              <label className="text-sm text-mute" htmlFor="limit">
                How many? (blank = unlimited)
              </label>
              <input
                id="limit"
                inputMode="numeric"
                value={item.limit}
                onChange={(e) => setItem({ ...item, limit: e.target.value })}
                className={`${field} font-mono`}
                placeholder="40"
              />
            </div>
          </div>
          <fieldset className="flex gap-3">
            <legend className="mb-2 text-sm text-mute">Delivery</legend>
            {(["digital", "physical"] as const).map((k) => (
              <label
                key={k}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm capitalize ${item.kind === k ? "border-ink bg-ink text-paper" : "border-shelf-deep"}`}
              >
                <input
                  type="radio"
                  name="kind"
                  className="sr-only"
                  checked={item.kind === k}
                  onChange={() => setItem({ ...item, kind: k })}
                />
                {k}
              </label>
            ))}
          </fieldset>
          {item.kind === "physical" && (
            <p className="text-sm text-mute">
              Buyers send you a shipping address through private chat after they pay. Nothing is
              stored on-chain.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-full border border-ink px-5 py-3 hover:bg-shelf"
            >
              Back
            </button>
            <button className="rounded-full bg-ink px-6 py-3 text-paper hover:bg-accent">
              Preview shop
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div>
          <p className="text-sm text-mute">This is how eth.shop/{handle || "you"} will look.</p>
          <div className="mt-4 rounded-md border border-shelf-deep p-6">
            <p className="display text-3xl font-extrabold">{name || "Your shop"}</p>
            <div className="mt-6 w-48">
              <Art hue={200} className="rounded-sm" />
              <div className="tag mt-3 flex items-baseline justify-between pt-2">
                <span className="font-sans text-sm">{item.name || "Item"}</span>
                <span className="text-lg font-semibold">{item.price || "0"} ETH</span>
              </div>
              <p className="mt-1 text-xs text-mute">
                {item.kind} · {item.limit ? `${item.limit} left` : "unlimited"}
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full border border-ink px-5 py-3 hover:bg-shelf"
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-full bg-accent px-6 py-3 text-paper hover:bg-accent-ink"
            >
              Open shop on Base
            </button>
          </div>
          <p className="mt-4 text-xs text-mute">
            Opening a shop launches a Juicebox project with a 721 hook. You&apos;ll sign one
            transaction.{" "}
            <Link href="/tea" className="underline">
              See a finished shop
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
