"use client";
import { Art, Availability, ItemCard, Price } from "@/components/ItemCard";
import { ProjectRichText } from "@/components/ui/html";
import { blankItem, type ItemDraft } from "@/components/sell/draft";
import { ItemFields } from "@/components/sell/ItemFields";
import { Check, Field, More, field } from "@/components/sell/ui";
import { BuyFlow } from "@/components/shop/BuyFlow";
import { formatPrice } from "@/lib/items";
import type { Item, Shop } from "@/lib/types";
import { TIER_UNLIMITED_SUPPLY } from "@bananapus/nana-sdk-core/v6";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";

// ponytail: the whole storefront + owner console on local state so every 721 action is clickable.
// Each "sign" call is where a real tx goes; the log shows what would be signed.

type Owned = { item: number; tokenId: string };
type Operator = { address: string; can: string[] };
type Extras = Record<
  number,
  { reservePending?: number; noCredits?: boolean; splitPercent?: number; splitTo?: string }
>;
const btn = "rounded-full px-4 py-2 text-sm font-medium";
const primary = `${btn} bg-accent text-paper hover:bg-accent-ink disabled:bg-shelf-deep disabled:text-mute`;
const ghost = `${btn} border border-ink hover:bg-shelf disabled:border-shelf-deep disabled:text-mute`;
const fmt = (n: number) => +n.toPrecision(4);

// ponytail: demo arithmetic; Phase 2 quotes from chain
const priceOf = (item: Item, shop: Shop) => Number(item.effectivePrice) / 10 ** shop.decimals;

export function ShopView({
  shop: initialShop,
  demo,
  initialItems,
  initialOpen,
  initialManage,
  extras: initialExtras = {},
  initialOperators = [],
}: {
  shop: Shop;
  /** Only `/demo` has a fake owner console (Manage) and a simulated checkout. A real shop buys for real via BuyFlow and has no Manage mode. */
  demo: boolean;
  initialItems: Item[];
  initialOpen?: number;
  initialManage?: boolean;
  extras?: Extras;
  initialOperators?: Operator[];
}) {
  const [shop, setShop] = useState(initialShop);
  const [items, setItems] = useState(initialItems);
  const [extras, setExtras] = useState<Extras>(initialExtras);
  const [operators, setOperators] = useState<Operator[]>(initialOperators);
  const [cat, setCat] = useState<string>();
  const [open, setOpen] = useState<number | undefined>(initialOpen);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [credits, setCredits] = useState(0);
  const [owned, setOwned] = useState<Owned[]>([]);
  // A real shop is never in Manage mode: the toggle is hidden and initialManage is ignored.
  const [manage, setManage] = useState(demo && !!initialManage);
  const [log, setLog] = useState<string[]>([]);
  const unit = shop.currency;

  const sign = (what: string) => setLog((l) => [what, ...l]);
  const patch = (tierId: number, p: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.tierId === tierId ? { ...x, ...p } : x)));
  const cats = [...new Set(items.map((i) => i.categoryName))];
  const shown = cat ? items.filter((i) => i.categoryName === cat) : items;
  const openItem = items.find((i) => i.tierId === open);

  const cartLines = Object.entries(cart).map(([id, qty]) => ({
    item: items.find((i) => i.tierId === Number(id))!,
    qty,
  }));
  const cartTotal = cartLines.reduce((s, l) => s + priceOf(l.item, shop) * l.qty, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const add = (tierId: number, n = 1) => setCart((c) => ({ ...c, [tierId]: (c[tierId] ?? 0) + n }));

  const mintReserves = (item: Item) => {
    const n = extras[item.tierId]?.reservePending ?? 0;
    if (!n) return;
    sign(`mintPendingReservesFor(tier ${item.tierId}, ${n}) → ${item.reserveBeneficiary}`);
    patch(item.tierId, {
      remaining: item.remaining === undefined ? undefined : item.remaining - n,
    });
    setExtras((ex) => ({ ...ex, [item.tierId]: { ...ex[item.tierId], reservePending: 0 } }));
  };

  return (
    <>
      <section className="border-b border-shelf-deep px-5 pt-10 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="display text-4xl font-extrabold sm:text-6xl">{shop.name}</h1>
            <p className="mt-2 text-lg">{shop.tagline}</p>
            {shop.about && (
              <ProjectRichText className="rich-text mt-3 max-w-xl text-sm text-mute" source={shop.about} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`${ghost} font-mono`}
              onClick={() =>
                navigator.clipboard?.writeText(`https://eth.shop/${shop.handle ?? shop.slug}`)
              }
              title="Copy link"
            >
              eth.shop/{shop.handle ?? shop.slug}
            </button>
            {demo && (
              <button
                type="button"
                className={manage ? primary : ghost}
                onClick={() => setManage((m) => !m)}
              >
                {manage ? "Back to shop" : "Manage"}
              </button>
            )}
          </div>
        </div>
        {(shop.ruleset.pauseTransfers || shop.ruleset.pauseMintPendingReserves) && (
          <p className="mt-4 text-xs text-mute">
            {shop.ruleset.pauseTransfers && "Transfers are paused for items that allow it. "}
            {shop.ruleset.pauseMintPendingReserves && "Reserve minting is paused."}
          </p>
        )}
      </section>

      {manage ? (
        <Manage
          shop={shop}
          setShop={setShop}
          items={items}
          patch={patch}
          setItems={setItems}
          extras={extras}
          setExtras={setExtras}
          operators={operators}
          setOperators={setOperators}
          sign={sign}
          mintReserves={mintReserves}
        />
      ) : (
        <>
          {cats.length > 1 && (
            <nav
              className="flex gap-1 overflow-x-auto border-b border-shelf-deep px-5 text-sm"
              aria-label="Categories"
            >
              {[undefined, ...cats].map((c) => (
                <button
                  key={c ?? "all"}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 ${c === cat ? "border-ink font-medium" : "border-transparent text-mute hover:text-ink"}`}
                >
                  {c ?? "Everything"}
                  <span className="ml-1.5 font-mono text-xs text-mute">
                    {c ? items.filter((i) => i.categoryName === c).length : items.length}
                  </span>
                </button>
              ))}
            </nav>
          )}
          <section className="grid grid-cols-2 gap-x-5 gap-y-10 px-5 py-10 pb-32 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((item) => (
              <ItemCard key={item.tierId} item={item} onOpen={() => setOpen(item.tierId)} />
            ))}
          </section>
        </>
      )}

      {/* Cart bar */}
      {!manage && (cartCount > 0 || (demo && (credits > 0 || owned.length > 0))) && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-shelf-deep bg-paper px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-4 text-sm">
              <span>
                <b className="font-mono">{cartCount}</b> in cart for{" "}
                <b className="font-mono">
                  {fmt(cartTotal)} {unit}
                </b>
              </span>
              {demo && credits > 0 && (
                <span className="text-mute">
                  You have{" "}
                  <b className="font-mono text-ink">
                    {fmt(credits)} {unit}
                  </b>{" "}
                  credit here
                </span>
              )}
              {demo && owned.length > 0 && (
                <span className="text-mute">
                  You own <b className="font-mono text-ink">{owned.length}</b> item
                  {owned.length > 1 && "s"} from this shop
                </span>
              )}
            </div>
            <button
              type="button"
              className={primary}
              disabled={cartCount === 0}
              onClick={() => setCheckout(true)}
            >
              Check out
            </button>
          </div>
        </div>
      )}

      {openItem && (
        <Dialog onClose={() => setOpen(undefined)} wide>
          <div className="grid sm:grid-cols-2">
            <Art hue={(openItem.tierId * 47) % 360} className="h-full" />
            <div className="flex flex-col p-6">
              <p className="font-mono text-xs text-mute">
                eth.shop/{shop.handle ?? shop.slug} / {openItem.categoryName}
              </p>
              <h2 className="display mt-1 text-2xl font-extrabold">{openItem.name}</h2>
              <p className="mt-3 text-sm text-mute">
                {openItem.description ??
                  (openItem.kind === "digital"
                    ? "Delivered as a download in your receipt."
                    : "Ships after purchase.")}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs">
                {openItem.discountPercent > 0 ? (
                  <Badge>{openItem.discountPercent / 2}% off</Badge>
                ) : null}
                {openItem.reserveFrequency ? (
                  <Badge>
                    1 in {openItem.reserveFrequency} reserved for {openItem.reserveBeneficiary}
                  </Badge>
                ) : null}
                {Number(openItem.votingUnits) ? (
                  <Badge>{Number(openItem.votingUnits)} votes each</Badge>
                ) : null}
                {openItem.transfersPausable && <Badge>non-transferable</Badge>}
                {openItem.cantBeRemoved && <Badge>permanent</Badge>}
                {extras[openItem.tierId]?.noCredits && <Badge>no credit purchases</Badge>}
                {openItem.allowOwnerMint && <Badge>owner can mint free</Badge>}
                {extras[openItem.tierId]?.splitPercent ? (
                  <Badge>
                    {extras[openItem.tierId]?.splitPercent}% to {extras[openItem.tierId]?.splitTo}
                  </Badge>
                ) : null}
                {shop.ruleset.cashOut && <Badge>cashes out for surplus</Badge>}
              </ul>
              <dl className="tag mt-6 grid grid-cols-2 gap-y-2 pt-4 text-sm">
                <dt className="text-mute">Price</dt>
                <dd className="text-right">
                  <Price item={openItem} big />
                </dd>
                <dt className="text-mute">Availability</dt>
                <dd className="text-right">
                  <Availability item={openItem} />
                </dd>
                <dt className="text-mute">Type</dt>
                <dd className="text-right capitalize">{openItem.kind}</dd>
                <dt className="text-mute">Sold</dt>
                <dd className="text-right font-mono">{openItem.sold}</dd>
              </dl>
              <div className="mt-auto space-y-2 pt-6">
                <button
                  type="button"
                  disabled={openItem.remaining === 0}
                  className={`${primary} w-full py-3 text-lg`}
                  onClick={() => {
                    add(openItem.tierId);
                    setOpen(undefined);
                    setCheckout(true);
                  }}
                >
                  {openItem.remaining === 0
                    ? "Sold out"
                    : `Buy for ${priceOf(openItem, shop) ? `${fmt(priceOf(openItem, shop))} ${unit}` : "free"}`}
                </button>
                <button
                  type="button"
                  disabled={openItem.remaining === 0}
                  className={`${ghost} w-full`}
                  onClick={() => {
                    add(openItem.tierId);
                    setOpen(undefined);
                  }}
                >
                  Add to cart
                </button>
                {demo && !!extras[openItem.tierId]?.reservePending && (
                  <button
                    type="button"
                    disabled={shop.ruleset.pauseMintPendingReserves}
                    className={`${ghost} w-full`}
                    onClick={() => mintReserves(openItem)}
                  >
                    Mint {extras[openItem.tierId]?.reservePending} reserved to{" "}
                    {openItem.reserveBeneficiary} (anyone can)
                  </button>
                )}
                {demo && <Holder item={openItem} shop={shop} owned={owned} setOwned={setOwned} sign={sign} />}
                {openItem.kind === "physical" && (
                  <p className="text-center text-xs text-mute">
                    Shipping details are shared privately with the shop after purchase.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {checkout && !demo && (
        <BuyFlow
          shop={shop}
          lines={cartLines.map((l) => ({
            tierId: l.item.tierId,
            qty: l.qty,
            effectivePrice: BigInt(l.item.effectivePrice),
            cantBuyWithCredits: l.item.cantBuyWithCredits,
            name: l.item.name,
          }))}
          onClose={() => setCheckout(false)}
          onPurchased={() => {
            // Only the cart clears here — BuyFlow stays mounted showing its
            // own success/unverified screen; it closes itself (onClose) when
            // the buyer dismisses that screen. Closing the dialog here too
            // would unmount BuyFlow in the same tick as setPhase("success"),
            // so the success screen would never paint.
            setCart({});
          }}
        />
      )}

      {demo && checkout && (
        <Checkout
          lines={cartLines}
          unit={unit}
          credits={credits}
          shop={shop}
          extras={extras}
          onClose={() => setCheckout(false)}
          onPay={(spent, newCredits, minted) => {
            setCredits(newCredits);
            setOwned((o) => [...o, ...minted]);
            for (const l of cartLines) {
              const sold = l.item.sold + l.qty;
              const reserved = l.item.reserveFrequency
                ? Math.ceil(sold / l.item.reserveFrequency) -
                  Math.ceil(l.item.sold / l.item.reserveFrequency)
                : 0;
              patch(l.item.tierId, {
                sold,
                remaining: l.item.remaining === undefined ? undefined : l.item.remaining - l.qty - reserved,
              });
              if (reserved) {
                const pending = extras[l.item.tierId]?.reservePending ?? 0;
                setExtras((ex) => ({
                  ...ex,
                  [l.item.tierId]: { ...ex[l.item.tierId], reservePending: pending + reserved },
                }));
              }
            }
            setCart({});
            setCheckout(false);
            sign(
              `pay(${fmt(spent)} ${unit}, tiers [${cartLines.map((l) => `${l.item.tierId}×${l.qty}`).join(", ")}])`,
            );
          }}
        />
      )}

      {log.length > 0 && (
        <aside className="fixed right-4 bottom-20 z-10 max-w-sm rounded-md border border-shelf-deep bg-paper p-3 text-xs shadow-lg">
          <p className="mb-1 font-medium">Would sign</p>
          <ol className="max-h-40 space-y-1 overflow-auto font-mono text-mute">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </aside>
      )}
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <li className="rounded-full bg-shelf px-2.5 py-1">{children}</li>;
}

function Dialog({
  children,
  onClose,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      className={`m-auto ${wide ? "w-[min(92vw,56rem)]" : "w-[min(92vw,28rem)]"} rounded-md bg-paper p-0 backdrop:bg-ink/60`}
    >
      {children}
      <button
        type="button"
        onClick={() => ref.current?.close()}
        aria-label="Close"
        className="absolute top-3 right-3 h-8 w-8 rounded-full bg-paper/80 text-lg hover:bg-shelf"
      >
        ×
      </button>
    </dialog>
  );
}

/** Buyer-side actions once you hold one of these. */
function Holder({
  item,
  shop,
  owned,
  setOwned,
  sign,
}: {
  item: Item;
  shop: Shop;
  owned: Owned[];
  setOwned: (f: (o: Owned[]) => Owned[]) => void;
  sign: (s: string) => void;
}) {
  const mine = owned.filter((o) => o.item === item.tierId);
  if (!mine.length) return null;
  const one = mine[0];
  const drop = () => setOwned((o) => o.filter((x) => x.tokenId !== one.tokenId));
  const transferBlocked = item.transfersPausable && shop.ruleset.pauseTransfers;
  const votes = Number(item.votingUnits);
  return (
    <div className="tag mt-2 space-y-2 pt-3">
      <p className="text-xs text-mute">
        You own {mine.length} (token {one.tokenId})
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={ghost}
          disabled={transferBlocked}
          title={transferBlocked ? "Transfers are paused for this item" : ""}
          onClick={() => {
            sign(`transferFrom(you, friend.eth, ${one.tokenId})`);
            drop();
          }}
        >
          Send
        </button>
        {shop.ruleset.cashOut && (
          <button
            type="button"
            className={ghost}
            onClick={() => {
              sign(
                `cashOutTokensOf(token ${one.tokenId}) → share of ${shop.surplus ?? "0"} ${shop.currency} surplus`,
              );
              drop();
            }}
          >
            Cash out
          </button>
        )}
        {!!votes && (
          <button
            type="button"
            className={ghost}
            onClick={() => sign(`checkpoints.delegate(you, [${one.tokenId}])`)}
          >
            Delegate {votes} votes
          </button>
        )}
      </div>
    </div>
  );
}

function Checkout({
  lines,
  unit,
  credits,
  shop,
  extras,
  onClose,
  onPay,
}: {
  lines: { item: Item; qty: number }[];
  unit: string;
  credits: number;
  shop: Shop;
  extras: Extras;
  onClose: () => void;
  onPay: (spent: number, credits: number, minted: Owned[]) => void;
}) {
  const [tip, setTip] = useState(false);
  const total = lines.reduce((s, l) => s + priceOf(l.item, shop) * l.qty, 0);
  const noCreditPart = lines
    .filter((l) => extras[l.item.tierId]?.noCredits)
    .reduce((s, l) => s + priceOf(l.item, shop) * l.qty, 0);
  const creditUsed = Math.min(credits, total - noCreditPart);
  const tipAmt = tip ? +(Math.ceil(total * 100) / 100 - total).toFixed(4) : 0;
  const due = total - creditUsed + tipAmt;
  return (
    <Dialog onClose={onClose}>
      <div className="p-6">
        <h2 className="display text-2xl font-extrabold">Check out</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.item.tierId} className="flex justify-between gap-3">
              <span>
                {l.item.name}
                {l.qty > 1 && <span className="text-mute"> ×{l.qty}</span>}
              </span>
              <span className="font-mono">
                {fmt(priceOf(l.item, shop) * l.qty)} {unit}
              </span>
            </li>
          ))}
        </ul>
        <dl className="tag mt-4 grid grid-cols-2 gap-y-1 pt-3 text-sm">
          <dt className="text-mute">Items</dt>
          <dd className="text-right font-mono">
            {fmt(total)} {unit}
          </dd>
          {credits > 0 && (
            <>
              <dt className="text-mute">
                Credit applied
                {noCreditPart > 0 && (
                  <span className="block text-xs">(not on items that refuse credit)</span>
                )}
              </dt>
              <dd className="text-right font-mono">
                −{fmt(creditUsed)} {unit}
              </dd>
            </>
          )}
          {tip && (
            <>
              <dt className="text-mute">Round up (becomes credit)</dt>
              <dd className="text-right font-mono">
                +{tipAmt} {unit}
              </dd>
            </>
          )}
          <dt className="font-medium">You pay</dt>
          <dd className="text-right font-mono text-xl font-semibold">
            {fmt(due)} {unit}
          </dd>
        </dl>
        {!shop.flags.preventOverspending ? (
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={tip}
              onChange={(e) => setTip(e.target.checked)}
            />
            Round up to {Math.ceil(total * 100) / 100} {unit}; the extra stays as credit for next
            time
          </label>
        ) : (
          <p className="mt-4 text-xs text-mute">This shop requires exact payment.</p>
        )}
        <p className="mt-2 text-xs text-mute">
          You&apos;ll also receive {shop.symbol || "shop"} project tokens for what stays in the
          shop.
        </p>
        <button
          type="button"
          className={`${primary} mt-6 w-full py-3 text-lg`}
          onClick={() =>
            onPay(
              due,
              credits - creditUsed + tipAmt,
              lines.flatMap((l) =>
                Array.from({ length: l.qty }, (_, k) => ({
                  item: l.item.tierId,
                  tokenId: `${l.item.tierId}${String(l.item.sold + k + 1).padStart(9, "0")}`,
                })),
              ),
            )
          }
        >
          Pay {fmt(due)} {unit}
        </button>
      </div>
    </Dialog>
  );
}

/** Owner / operator console: every post-launch write the hook exposes. */
function Manage({
  shop,
  setShop,
  items,
  patch,
  setItems,
  extras,
  setExtras,
  operators,
  setOperators,
  sign,
  mintReserves,
}: {
  shop: Shop;
  setShop: (s: Shop) => void;
  items: Item[];
  patch: (tierId: number, p: Partial<Item>) => void;
  setItems: (f: (i: Item[]) => Item[]) => void;
  extras: Extras;
  setExtras: (f: (e: Extras) => Extras) => void;
  operators: Operator[];
  setOperators: (f: (o: Operator[]) => Operator[]) => void;
  sign: (s: string) => void;
  mintReserves: (i: Item) => void;
}) {
  const [draft, setDraft] = useState<ItemDraft>(blankItem());
  const [cats, setCats] = useState([...new Set(items.map((i) => i.categoryName))]);
  const [newOp, setNewOp] = useState("");
  const setS = (p: Partial<Shop>) => setShop({ ...shop, ...p });
  const setRuleset = (p: Partial<Shop["ruleset"]>) =>
    setShop({ ...shop, ruleset: { ...shop.ruleset, ...p } });
  const pending = items.filter((i) => extras[i.tierId]?.reservePending);

  const withDiscount = (it: Item, discountPercent: number): Partial<Item> => {
    const price = BigInt(it.price);
    const effectivePrice = (price * BigInt(200 - discountPercent)) / 200n;
    return {
      discountPercent,
      effectivePrice: effectivePrice.toString(),
      priceText: formatPrice(effectivePrice, shop.decimals, shop.currency),
    };
  };

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-5 py-10">
      <section>
        <h2 className="display text-2xl font-extrabold">Items</h2>
        <p className="mt-1 text-sm text-mute">
          Price, category, supply and rules are fixed once an item exists. To change them, remove
          the item and add a new one. Discount and image can change any time.
        </p>
        <ul className="mt-6 divide-y divide-shelf-deep">
          {items.map((it) => (
            <li
              key={it.tierId}
              className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 py-3"
            >
              <label className="cursor-pointer" title="Change image">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) sign(`setMetadata(tier ${it.tierId}, ipfs://${f.name})`);
                  }}
                />
                <Art hue={(it.tierId * 47) % 360} className="rounded-sm" />
              </label>
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {it.name} <span className="text-mute">in {it.categoryName}</span>
                </p>
                <p className="text-xs text-mute">
                  <Price item={it} />, <Availability item={it} />, sold {it.sold}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    inputMode="numeric"
                    defaultValue={it.discountPercent / 2}
                    onBlur={(e) => {
                      const d = Math.min(100, Number(e.target.value) || 0);
                      if (d !== it.discountPercent / 2) {
                        sign(`setDiscountPercentOf(tier ${it.tierId}, ${d * 2}/200)`);
                        patch(it.tierId, withDiscount(it, d * 2));
                      }
                    }}
                    className="w-12 border-b border-shelf-deep bg-transparent text-right font-mono outline-none focus:border-accent"
                    aria-label="Discount percent"
                  />
                  % off
                </label>
                {it.allowOwnerMint && (
                  <button
                    type="button"
                    className={ghost}
                    onClick={() => {
                      sign(`mintFor([tier ${it.tierId}], friend.eth)`);
                      patch(it.tierId, {
                        remaining: it.remaining === undefined ? undefined : it.remaining - 1,
                      });
                    }}
                  >
                    Mint free
                  </button>
                )}
                <button
                  type="button"
                  className={ghost}
                  disabled={it.cantBeRemoved}
                  title={it.cantBeRemoved ? "Permanent items can't be removed" : ""}
                  onClick={() => {
                    sign(`adjustTiers(remove [${it.tierId}])`);
                    setItems((xs) => xs.filter((x) => x.tierId !== it.tierId));
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display text-2xl font-extrabold">Add an item</h2>
        <form
          className="mt-6 space-y-8 rounded-md border border-shelf-deep p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const tierId = Math.max(0, ...items.map((i) => i.tierId)) + 1;
            const price = BigInt(Math.round((Number(draft.price) || 0) * 10 ** shop.decimals));
            const discountPercent = Math.min(100, Number(draft.discount) || 0) * 2;
            const effectivePrice = (price * BigInt(200 - discountPercent)) / 200n;
            const remaining = draft.limited ? Number(draft.limit) : undefined;
            const reserveBeneficiary = draft.reserveTo.startsWith("0x")
              ? (draft.reserveTo as Address)
              : undefined;
            sign(`adjustTiers(add [tier ${tierId}: ${draft.name}, ${draft.price} ${shop.currency}])`);
            setItems((xs) => [
              ...xs,
              {
                shop: shop.slug,
                tierId,
                category: 0,
                categoryName: draft.category || "Basics",
                name: draft.name,
                description: draft.description || undefined,
                image: undefined,
                price: price.toString(),
                discountPercent,
                effectivePrice: effectivePrice.toString(),
                priceText: formatPrice(effectivePrice, shop.decimals, shop.currency),
                fullPriceText: formatPrice(price, shop.decimals, shop.currency),
                remaining,
                initial: remaining ?? TIER_UNLIMITED_SUPPLY,
                sold: 0,
                reserveFrequency: Number(draft.reserveEvery) || 0,
                reserveBeneficiary,
                votingUnits: draft.votes || "0",
                allowOwnerMint: draft.ownerMint,
                transfersPausable: draft.nonTransferable,
                cantBeRemoved: draft.permanent,
                cantBuyWithCredits: !draft.credits,
                kind: draft.kind,
              },
            ]);
            const splitPercent =
              draft.splits.reduce((s, x) => s + (Number(x.percent) || 0), 0) || undefined;
            if (splitPercent || !draft.credits) {
              setExtras((ex) => ({
                ...ex,
                [tierId]: {
                  splitPercent,
                  splitTo: draft.splits[0]?.to,
                  noCredits: !draft.credits,
                },
              }));
            }
            setCats([...new Set([...cats, draft.category || "Basics"])]);
            setDraft(blankItem());
          }}
        >
          <ItemFields
            item={draft}
            categories={cats}
            currency={shop.currency}
            onChange={setDraft}
            onAddCategory={(c) => setCats([...new Set([...cats, c])])}
          />
          <button className={primary}>Add to shop</button>
        </form>
      </section>

      <section>
        <h2 className="display text-2xl font-extrabold">Reserves</h2>
        {pending.length ? (
          <ul className="mt-4 space-y-2 text-sm">
            {pending.map((it) => (
              <li key={it.tierId} className="flex items-center justify-between gap-3">
                <span>
                  {it.name}: {extras[it.tierId]?.reservePending} pending for{" "}
                  {it.reserveBeneficiary}
                </span>
                <button
                  type="button"
                  className={ghost}
                  disabled={shop.ruleset.pauseMintPendingReserves}
                  onClick={() => mintReserves(it)}
                >
                  Mint now
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-mute">
            Nothing pending. Reserved items appear here as sales come in; anyone can mint them.
          </p>
        )}
      </section>

      <section>
        <h2 className="display text-2xl font-extrabold">Collection</h2>
        <div className="mt-6 grid grid-cols-2 gap-6">
          <Field label="Name">
            <input
              defaultValue={shop.name}
              onBlur={(e) =>
                e.target.value !== shop.name &&
                (sign(`setMetadata(name "${e.target.value}")`), setS({ name: e.target.value }))
              }
              className={field}
            />
          </Field>
          <Field label="Symbol">
            <input
              defaultValue={shop.symbol}
              onBlur={(e) =>
                e.target.value !== shop.symbol &&
                (sign(`setMetadata(symbol "${e.target.value}")`),
                setS({ symbol: e.target.value.toUpperCase() }))
              }
              className={`${field} font-mono`}
            />
          </Field>
        </div>
        <More label="Advanced metadata">
          <Field
            label="Collection metadata (contractURI)"
            hint="OpenSea-style JSON for the collection as a whole."
          >
            <input
              className={`${field} font-mono`}
              placeholder="ipfs://…"
              onBlur={(e) => e.target.value && sign(`setMetadata(contractUri ${e.target.value})`)}
            />
          </Field>
          <Field label="Base URI" hint="Prefix for every item's media hash. Default ipfs://">
            <input
              className={`${field} font-mono`}
              placeholder="ipfs://"
              onBlur={(e) => e.target.value && sign(`setMetadata(baseUri ${e.target.value})`)}
            />
          </Field>
          <Field
            label="Token URI resolver"
            hint="A contract that renders metadata on-chain instead of IPFS. Leave blank to keep IPFS."
          >
            <input
              className={`${field} font-mono`}
              placeholder="0x…"
              onBlur={(e) =>
                e.target.value && sign(`setMetadata(tokenUriResolver ${e.target.value})`)
              }
            />
          </Field>
        </More>
      </section>

      <section>
        <h2 className="display text-2xl font-extrabold">Rules right now</h2>
        <p className="mt-1 text-sm text-mute">
          These live on the project&apos;s ruleset, so changing them queues a new ruleset.
        </p>
        <div className="mt-4">
          <Check
            label="Pause transfers"
            hint="Only affects items marked non-transferable."
            checked={shop.ruleset.pauseTransfers}
            onChange={(v) => {
              sign(`queueRulesetsOf(pauseTransfers=${v})`);
              setRuleset({ pauseTransfers: v });
            }}
          />
          <Check
            label="Pause reserve minting"
            checked={shop.ruleset.pauseMintPendingReserves}
            onChange={(v) => {
              sign(`queueRulesetsOf(pauseMintPendingReserves=${v})`);
              setRuleset({ pauseMintPendingReserves: v });
            }}
          />
          <Check
            label="Items can cash out for surplus"
            hint={`Holders can burn an item for its share of the ${shop.surplus ?? "0"} ${shop.currency} the shop holds.`}
            checked={shop.ruleset.cashOut}
            onChange={(v) => {
              sign(`queueRulesetsOf(useDataHookForCashOut=${v})`);
              setRuleset({ cashOut: v });
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="display text-2xl font-extrabold">Who else can run the shop</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {operators.map((op) => (
            <li key={op.address} className="flex items-center justify-between gap-3">
              <span>
                <span className="font-mono">{op.address}</span>{" "}
                <span className="text-mute">can {op.can.join(", ").toLowerCase()}</span>
              </span>
              <button
                type="button"
                className={ghost}
                onClick={() => {
                  sign(`setPermissionsFor(${op.address}, [])`);
                  setOperators((ops) => ops.filter((o) => o !== op));
                }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newOp) return;
            sign(
              `setPermissionsFor(${newOp}, [ADJUST_721_TIERS, SET_721_METADATA, MINT_721, SET_721_DISCOUNT_PERCENT])`,
            );
            setOperators((ops) => [
              ...ops,
              {
                address: newOp,
                can: ["Add & remove items", "Update item details", "Mint free", "Set discounts"],
              },
            ]);
            setNewOp("");
          }}
        >
          <label className="flex-1">
            <span className="text-sm text-mute">Address or ENS</span>
            <input
              value={newOp}
              onChange={(e) => setNewOp(e.target.value)}
              className={`${field} font-mono`}
              placeholder="0x… or name.eth"
            />
          </label>
          <button className={ghost}>Add operator</button>
        </form>
        <More label="Hand over the shop">
          <p className="text-sm text-mute">
            The shop is a Juicebox project NFT. Whoever holds it owns the shop and everything in it.
          </p>
          <button
            type="button"
            className={ghost}
            onClick={() => sign("transferFrom(you, newowner.eth, project NFT)")}
          >
            Transfer ownership
          </button>
        </More>
      </section>
    </div>
  );
}
