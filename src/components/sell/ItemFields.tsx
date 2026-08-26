"use client";
import type { ItemDraft } from "./draft";
import { Check, Field, More, Pills, field } from "./ui";

type Props = {
  item: ItemDraft;
  categories: string[];
  currency: string;
  onChange: (item: ItemDraft) => void;
  onAddCategory: (name: string) => void;
};

export function ItemFields({ item, categories, currency, onChange, onAddCategory }: Props) {
  const set = (patch: Partial<ItemDraft>) => onChange({ ...item, ...patch });
  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-[8rem_1fr]">
        <label className="flex aspect-square cursor-pointer items-center justify-center rounded-sm bg-shelf text-center text-xs text-mute hover:bg-shelf-deep">
          <input
            type="file"
            className="sr-only"
            accept="image/*,video/*,audio/*,.pdf"
            onChange={(e) => set({ media: e.target.files?.[0]?.name ?? "" })}
          />
          {item.media ? (
            <span className="px-2 break-all">{item.media}</span>
          ) : (
            "Add a photo or file"
          )}
        </label>
        <div className="space-y-6">
          <Field label="What are you selling?">
            <input
              required
              value={item.name}
              onChange={(e) => set({ name: e.target.value })}
              className={field}
              placeholder="Hojicha, 50g"
            />
          </Field>
          <Field label="Short description (optional)">
            <input
              value={item.description}
              onChange={(e) => set({ description: e.target.value })}
              className={field}
              placeholder="Roasted green tea. Toasty, low caffeine."
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Field
          label={`Price (${currency})`}
          hint="Fixed once the item exists; only discounts can change later."
        >
          <input
            required
            inputMode="decimal"
            value={item.price}
            onChange={(e) => set({ price: e.target.value })}
            className={`${field} font-mono`}
            placeholder={currency === "USD" ? "25" : "0.004"}
          />
        </Field>
        <div>
          <Check
            label="Limited quantity?"
            checked={item.limited}
            onChange={(v) => set({ limited: v })}
          />
          {item.limited && (
            <input
              aria-label="How many"
              required
              inputMode="numeric"
              value={item.limit}
              onChange={(e) => set({ limit: e.target.value })}
              className={`${field} font-mono`}
              placeholder="40"
            />
          )}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-mute">Delivery</legend>
        <Pills
          name={`kind-${item.name}`}
          value={item.kind}
          options={[
            ["digital", "Digital"],
            ["physical", "Physical"],
          ]}
          onChange={(kind) => set({ kind })}
        />
        {item.kind === "physical" && (
          <p className="mt-3 text-sm text-mute">
            Buyers send you a shipping address through private chat after they pay. Nothing is
            stored on-chain.
          </p>
        )}
      </fieldset>

      <More>
        <Field label="Category" hint="Group items into named shelves on your shop page.">
          <select
            value={item.category}
            onChange={(e) => {
              if (e.target.value !== "+") return set({ category: e.target.value });
              const name = window.prompt("New category name")?.trim();
              if (name) {
                onAddCategory(name);
                set({ category: name });
              }
            }}
            className={field}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="+">+ Add category…</option>
          </select>
        </Field>

        <div>
          <span className="text-sm text-mute">Split sales</span>
          <p className="text-xs text-mute">Send part of every sale of this item somewhere else.</p>
          <div className="mt-2 space-y-2">
            {item.splits.map((s, i) => (
              <div key={i} className="flex items-baseline gap-3">
                <input
                  inputMode="decimal"
                  value={s.percent}
                  onChange={(e) =>
                    set({ splits: item.splits.with(i, { ...s, percent: e.target.value }) })
                  }
                  className={`${field} w-16 font-mono`}
                  placeholder="10"
                  aria-label="Percent"
                />
                <span className="text-sm text-mute">% to</span>
                <input
                  value={s.to}
                  onChange={(e) =>
                    set({ splits: item.splits.with(i, { ...s, to: e.target.value }) })
                  }
                  className={`${field} font-mono`}
                  placeholder="0x… or name.eth"
                  aria-label="Recipient"
                />
                <button
                  type="button"
                  onClick={() => set({ splits: item.splits.filter((_, j) => j !== i) })}
                  className="text-mute hover:text-ink"
                  aria-label="Remove split"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set({ splits: [...item.splits, { percent: "", to: "" }] })}
              className="text-sm underline"
            >
              + Add a recipient
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="Discount" hint="% off the price, for now.">
            <input
              inputMode="numeric"
              value={item.discount}
              onChange={(e) => set({ discount: e.target.value })}
              className={`${field} font-mono`}
              placeholder="0"
            />
          </Field>
        </div>

        <div>
          <span className="text-sm text-mute">Reserve inventory</span>
          <p className="text-xs text-mute">Needs a supply of at least 2.</p>
          <div className="flex flex-wrap items-baseline gap-2 text-sm">
            <span>1 of every</span>
            <input
              inputMode="numeric"
              value={item.reserveEvery}
              onChange={(e) => set({ reserveEvery: e.target.value })}
              className={`${field} !w-14 font-mono`}
              placeholder="10"
              aria-label="Reserve frequency"
            />
            <span>sold goes to</span>
            <input
              value={item.reserveTo}
              onChange={(e) => set({ reserveTo: e.target.value })}
              className={`${field} min-w-40 flex-1 font-mono`}
              placeholder="0x… or name.eth"
              aria-label="Reserve beneficiary"
            />
          </div>
        </div>

        <div>
          <span className="text-sm text-mute">Item rules</span>
          <Check
            label="I can mint this for free"
            checked={item.ownerMint}
            onChange={(v) => set({ ownerMint: v })}
          />
          <Check
            label="Non-transferable"
            hint="Buyers can't resell or send it."
            checked={item.nonTransferable}
            onChange={(v) => set({ nonTransferable: v })}
          />
          <Check
            label="Permanent"
            hint="Can never be removed from the shop."
            checked={item.permanent}
            onChange={(v) => set({ permanent: v })}
          />
          <Check
            label="Allow credit purchases"
            checked={item.credits}
            onChange={(v) => set({ credits: v })}
          />
          <Check
            label="Discounts can change later"
            checked={item.discountsEditable}
            onChange={(v) => set({ discountsEditable: v })}
          />
        </div>
      </More>
    </div>
  );
}
