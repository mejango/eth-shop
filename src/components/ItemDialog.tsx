"use client";
import type { Item, Shop } from "@/lib/fixtures";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Art } from "./ItemCard";

// ponytail: native <dialog>, closes by navigating back to the shop. Buy button is a stub.
export function ItemDialog({ item, shop }: { item: Item; shop: Shop }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    d.showModal();
  }, []);
  const close = () => router.push(`/${shop.handle}`, { scroll: false });
  const soldOut = item.left === 0;
  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      className="m-auto w-[min(92vw,56rem)] rounded-md bg-paper p-0 backdrop:bg-ink/60"
    >
      <div className="grid sm:grid-cols-2">
        <Art hue={item.hue} className="h-full" />
        <div className="flex flex-col p-6">
          <p className="font-mono text-xs text-mute">
            eth.shop/{shop.handle} · {item.category}
          </p>
          <h2 className="display mt-1 text-2xl font-extrabold">{item.name}</h2>
          <p className="mt-3 text-sm text-mute">
            {item.blurb ??
              `${item.kind === "digital" ? "Delivered as a download in your receipt." : "Ships after purchase."}`}
          </p>
          <dl className="tag mt-6 grid grid-cols-2 gap-y-2 pt-4 text-sm">
            <dt className="text-mute">Price</dt>
            <dd className="text-right text-2xl font-semibold">{item.price} ETH</dd>
            <dt className="text-mute">Availability</dt>
            <dd className="text-right">
              {soldOut ? "Sold out" : item.left !== undefined ? `${item.left} left` : "Unlimited"}
            </dd>
            <dt className="text-mute">Type</dt>
            <dd className="text-right capitalize">{item.kind}</dd>
          </dl>
          <div className="mt-auto pt-6">
            <button
              type="button"
              disabled={soldOut}
              className="w-full rounded-full bg-accent py-3 text-lg font-medium text-paper hover:bg-accent-ink disabled:bg-shelf-deep disabled:text-mute"
            >
              {soldOut ? "Sold out" : `Buy for ${item.price} ETH`}
            </button>
            {item.kind === "physical" && (
              <p className="mt-3 text-center text-xs text-mute">
                Shipping details are shared privately with the shop after purchase.
              </p>
            )}
          </div>
        </div>
      </div>
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
