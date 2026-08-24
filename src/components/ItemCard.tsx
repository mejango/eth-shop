import type { Item } from "@/lib/types";

export function Art({ hue, className = "" }: { hue: number; className?: string }) {
  // ponytail: placeholder artwork until tier media resolves from IPFS.
  return (
    <div
      className={`aspect-square w-full ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 50% 88%), hsl(${hue} 40% 72%))` }}
    />
  );
}

export function Price({ item, big }: { item: Item; big?: boolean }) {
  return (
    <span
      className={`shrink-0 font-mono font-semibold ${big ? "text-2xl" : "text-lg"} ${item.remaining === 0 ? "text-mute line-through" : ""}`}
    >
      {item.discountPercent > 0 ? (
        <s className="mr-1.5 text-sm font-normal text-mute">{item.fullPriceText}</s>
      ) : null}
      {item.priceText}
    </span>
  );
}

export function Availability({ item }: { item: Item }) {
  if (item.remaining === 0) return <>sold out</>;
  if (item.remaining === undefined) return <>unlimited</>;
  return <>{item.remaining} left</>;
}

export function ItemCard({
  item,
  showShop,
  onOpen,
}: {
  item: Item;
  showShop?: boolean;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      {item.image ? (
        // CSP img-src restricts this to the IPFS gateway and data: URIs, so it's safe to
        // load without the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          className="aspect-square w-full rounded-sm object-cover"
          loading="lazy"
        />
      ) : (
        <Art hue={(item.tierId * 47) % 360} className="rounded-sm" />
      )}
      <div className="tag mt-3 flex items-baseline justify-between gap-3 pt-2">
        <span className="font-sans text-sm leading-tight">{item.name}</span>
        <Price item={item} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-mute">
        <span>{showShop ? `eth.shop/${item.shop}` : item.kind}</span>
        <span>
          <Availability item={item} />
        </span>
      </div>
    </>
  );
  const href = `/${item.shop}?item=${item.tierId}`;
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
