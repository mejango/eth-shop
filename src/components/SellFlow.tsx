"use client";
import { useState } from "react";
import { Art } from "./ItemCard";
import { ChainMark } from "@/components/ChainMark";
import { CHAINS, blankItem, blankShop, type ItemDraft, type ShopDraft } from "./sell/draft";
import { ItemFields } from "./sell/ItemFields";
import { Field, Pills, field } from "./sell/ui";
import { formatPrice } from "@/lib/items";
import type { Currency } from "@/lib/types";
import { parseUnits } from "viem";

const CHAIN_IDS: Record<ShopDraft["chains"][number], number> = { eth: 1, op: 10, base: 8453, arb: 42161 };

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);

// Preview only — the draft's price is a decimal string typed by the seller, not raw units yet.
const previewPrice = (price: string, currency: Currency) => {
  try {
    return formatPrice(parseUnits(price || "0", 18), 18, currency);
  } catch {
    return `${price || "0"} ${currency}`;
  }
};

const primary = "rounded-md bg-ink px-6 py-3 text-paper hover:bg-accent";
const secondary = "rounded-md border border-ink px-5 py-3 hover:bg-shelf";

// ponytail: three screens, local state only. "Open shop" = launchProjectFor + 721 hook later.
export function SellFlow({ initialHandle }: { initialHandle: string }) {
  const [step, setStep] = useState(0);
  const [shop, setShop] = useState<ShopDraft>(() => blankShop(clean(initialHandle)));
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [categories, setCategories] = useState<string[]>([]);
  const setS = (patch: Partial<ShopDraft>) => setShop({ ...shop, ...patch });
  const steps = ["Your shop", "Items", "Open"];

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
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
          <Field label="Shop name">
            <input
              required
              value={shop.name}
              onChange={(e) => setS({ name: e.target.value })}
              className={field}
              placeholder="Small Hours Tea"
            />
          </Field>

            <div className="grid gap-6 sm:grid-cols-[8rem_1fr]">
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-full bg-shelf text-center text-xs text-mute hover:bg-shelf-deep">
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={(e) => setS({ logo: e.target.files?.[0]?.name ?? "" })}
                />
                {shop.logo ? <span className="px-3 break-all">{shop.logo}</span> : "Logo"}
              </label>
              <div className="space-y-6">
                <Field label="Tagline">
                  <input
                    value={shop.tagline}
                    onChange={(e) => setS({ tagline: e.target.value })}
                    className={field}
                    placeholder="Three teas. That's the whole shop."
                  />
                </Field>
                <Field label="About">
                  <textarea
                    value={shop.about}
                    onChange={(e) => setS({ about: e.target.value })}
                    className={`${field} min-h-24 resize-y text-base`}
                    placeholder="Who you are, what you make, how you ship."
                  />
                </Field>
              </div>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm text-mute">Price items in</legend>
              <Pills
                name="currency"
                value={shop.currency}
                options={[
                  ["ETH", "ETH"],
                  ["USD", "USD"],
                ]}
                onChange={(currency) => setS({ currency })}
              />
              <p className="mt-2 text-xs text-mute">
                Buyers can pay in ETH or USDC either way; this is just the unit your prices are
                written in.
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm text-mute">Chains</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(CHAINS) as [ShopDraft["chains"][number], string][]).map(
                  ([c, label]) => {
                    const on = shop.chains.includes(c);
                    return (
                      <label
                        key={c}
                        title={label}
                        className={`flex cursor-pointer items-center justify-center rounded-md border p-2 ${on ? "border-ink bg-shelf" : "border-shelf-deep opacity-40 hover:opacity-100"}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() =>
                            setS({
                              chains: on
                                ? shop.chains.length > 1
                                  ? shop.chains.filter((x) => x !== c)
                                  : shop.chains
                                : [...shop.chains, c],
                            })
                          }
                        />
                        <ChainMark chainId={CHAIN_IDS[c]} className="h-5 w-5" />
                      </label>
                    );
                  },
                )}
              </div>
            </fieldset>

          <button className={primary}>Next: add items</button>
        </form>
      )}

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep(2);
          }}
          className="space-y-10"
        >
          {items.map((item, i) => (
            <section key={i} className="rounded-md border border-shelf-deep p-5">
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="display text-lg font-extrabold">{item.name || `Item ${i + 1}`}</h2>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
                    className="text-sm text-mute hover:text-ink"
                  >
                    Remove
                  </button>
                )}
              </div>
              <ItemFields
                item={item}
                categories={categories}
                currency={shop.currency}
                onChange={(next) => setItems(items.with(i, next))}
                onAddCategory={(c) => setCategories([...new Set([...categories, c])])}
              />
            </section>
          ))}
          <button
            type="button"
            onClick={() => setItems([...items, blankItem()])}
            className="text-sm underline"
          >
            + Add another item
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(0)} className={secondary}>
              Back
            </button>
            <button className={primary}>Preview shop</button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div>
          <p className="text-sm text-mute">
            This is how {shop.name || "your shop"} will look.
          </p>
          <div className="mt-4 rounded-md border border-shelf-deep p-6">
            <p className="display text-3xl font-extrabold">{shop.name || "Your shop"}</p>
            {shop.tagline && <p className="mt-1">{shop.tagline}</p>}
            {["", ...categories]
              .filter((c) => items.some((it) => it.category === c))
              .map((c) => (
                <div key={c || "default"} className="mt-6">
                  {c && <p className="mb-3 text-sm text-mute">{c}</p>}
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                    {items
                      .filter((it) => it.category === c)
                      .map((it, i) => (
                        <div key={i}>
                          <Art hue={(200 + i * 37) % 360} className="rounded-sm" />
                          <div className="tag mt-3 flex items-baseline justify-between pt-2">
                            <span className="font-sans text-sm">{it.name || "Item"}</span>
                            <span className="text-lg font-semibold">
                              {previewPrice(it.price, shop.currency)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-mute">
                            {it.kind}, {it.limited && it.limit ? `${it.limit} left` : "unlimited"}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(1)} className={secondary}>
              Back
            </button>
            <button
              type="button"
              className="rounded-md bg-accent px-6 py-3 text-ink hover:bg-accent-ink"
            >
              {shop.chains.length === 1
                ? `Open shop on ${CHAINS[shop.chains[0]]}`
                : `Open shop on ${shop.chains.length} chains`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
