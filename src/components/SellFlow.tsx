"use client";
import Link from "next/link";
import { useState } from "react";
import { Art } from "./ItemCard";
import { CHAINS, blankItem, blankShop, type ItemDraft, type ShopDraft } from "./sell/draft";
import { ItemFields } from "./sell/ItemFields";
import { Check, Field, More, Pills, field } from "./sell/ui";

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);

const primary = "rounded-full bg-ink px-6 py-3 text-paper hover:bg-accent";
const secondary = "rounded-full border border-ink px-5 py-3 hover:bg-shelf";

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
          <Field label="Link">
            <span className="flex items-baseline font-mono text-2xl">
              <span className="text-mute">eth.shop/</span>
              <input
                required
                value={shop.handle}
                onChange={(e) => setS({ handle: clean(e.target.value) })}
                className={`${field} text-2xl`}
                placeholder="you"
              />
            </span>
          </Field>
          <Field label="Shop name">
            <input
              required
              value={shop.name}
              onChange={(e) => setS({ name: e.target.value })}
              className={field}
              placeholder="Small Hours Tea"
            />
          </Field>

          <More label="More about your shop">
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
              <legend className="mb-2 text-sm text-mute">Chain</legend>
              <Pills
                name="chain"
                value={shop.chain}
                options={Object.entries(CHAINS) as [ShopDraft["chain"], string][]}
                onChange={(chain) => setS({ chain })}
              />
            </fieldset>
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
          </More>

          <More label="Shop settings">
            <p className="text-xs text-mute">
              Name and symbol can change later. Everything else is fixed when the shop opens.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <Field label="Collection name">
                <input
                  value={shop.collectionName}
                  onChange={(e) => setS({ collectionName: e.target.value })}
                  className={field}
                  placeholder={shop.name || "Your shop"}
                />
              </Field>
              <Field label="Symbol">
                <input
                  value={shop.symbol}
                  onChange={(e) =>
                    setS({
                      symbol: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 11),
                    })
                  }
                  className={`${field} font-mono`}
                  placeholder={(shop.name || "SHOP")
                    .replace(/[^a-zA-Z0-9]/g, "")
                    .slice(0, 6)
                    .toUpperCase()}
                />
              </Field>
            </div>
            <div>
              <Check
                label="Items can cash out for surplus"
                hint="Holders can burn an item for its share of what the shop holds."
                checked={shop.cashOut}
                onChange={(v) => setS({ cashOut: v })}
              />
              <Check
                label="Full token credit on split sales"
                hint="Buyers get project tokens for their whole payment, even the part an item routes to splits."
                checked={shop.issueTokensForSplits}
                onChange={(v) => setS({ issueTokensForSplits: v })}
              />
              <Check
                label="Require exact payment"
                hint="Reject payments that overshoot an item's price."
                checked={shop.exactPayment}
                onChange={(v) => setS({ exactPayment: v })}
              />
              <Check
                label="Lock reserved items after opening"
                hint="No new items with reserve inventory later."
                checked={shop.lockReserved}
                onChange={(v) => setS({ lockReserved: v })}
              />
              <Check
                label="Lock voting items after opening"
                checked={shop.lockVotes}
                onChange={(v) => setS({ lockVotes: v })}
              />
              <Check
                label="Lock free minting after opening"
                checked={shop.lockOwnerMint}
                onChange={(v) => setS({ lockOwnerMint: v })}
              />
            </div>
            <div>
              <span className="text-sm text-mute">What you can do after opening</span>
              <Check
                label="Add & remove items"
                checked={shop.opAddRemove}
                onChange={(v) => setS({ opAddRemove: v })}
              />
              <Check
                label="Update item details"
                checked={shop.opMetadata}
                onChange={(v) => setS({ opMetadata: v })}
              />
              <Check
                label="Mint items for free"
                checked={shop.opMint}
                onChange={(v) => setS({ opMint: v })}
              />
              <Check
                label="Increase discounts"
                checked={shop.opDiscounts}
                onChange={(v) => setS({ opDiscounts: v })}
              />
            </div>
          </More>

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
            This is how eth.shop/{shop.handle || "you"} will look.
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
                              {it.price || "0"} {shop.currency}
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
              className="rounded-full bg-accent px-6 py-3 text-paper hover:bg-accent-ink"
            >
              Open shop on {CHAINS[shop.chain]}
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
