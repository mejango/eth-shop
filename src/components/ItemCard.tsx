import type { Item } from "@/lib/fixtures";

export function Art({ hue, className = "" }: { hue: number; className?: string }) {
  // ponytail: placeholder artwork until tier media resolves from IPFS.
  return (
    <div
      className={`aspect-square w-full ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 50% 88%), hsl(${hue} 40% 72%))` }}
    />
  );
}

export const priceAfterDiscount = (item: Item) =>
  item.discount
    ? +(Number(item.price) * (1 - item.discount / 100)).toPrecision(3)
    : Number(item.price);

export function Price({ item, unit = "ETH", big }: { item: Item; unit?: string; big?: boolean }) {
  const now = priceAfterDiscount(item);
  return (
    <span
      className={`shrink-0 font-mono font-semibold ${big ? "text-2xl" : "text-lg"} ${item.left === 0 ? "text-mute line-through" : ""}`}
    >
      {item.discount ? <s className="mr-1.5 text-sm font-normal text-mute">{item.price}</s> : null}
      {now === 0 ? "Free" : `${now} ${unit}`}
    </span>
  );
}

export function Availability({ item }: { item: Item }) {
  if (item.removed) return <>removed</>;
  if (item.left === 0) return <>sold out</>;
  if (item.left === undefined) return <>unlimited</>;
  return (
    <>
      {item.left} left{item.reservePending ? `, ${item.reservePending} reserved` : ""}
    </>
  );
}

export function ItemCard({
  item,
  showShop,
  unit,
  onOpen,
}: {
  item: Item;
  showShop?: boolean;
  unit?: string;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      <Art
        hue={item.hue}
        className={`rounded-sm transition-transform group-hover:-translate-y-0.5 ${item.removed ? "opacity-40" : ""}`}
      />
      <div className="tag mt-3 flex items-baseline justify-between gap-3 pt-2">
        <span className="font-sans text-sm leading-tight">{item.name}</span>
        <Price item={item} unit={unit} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-mute">
        <span>{showShop ? `eth.shop/${item.shop}` : item.kind}</span>
        <span>
          <Availability item={item} />
        </span>
      </div>
    </>
  );
  const href = `/${item.shop}?item=${item.id}`;
  return onOpen ? (
    <button type="button" onClick={onOpen} className="group block w-full text-left">
      {inner}
    </button>
  ) : (
    <a href={href} className="group block">
      {inner}
    </a>
  );
}
