"use client";
import type { Feed } from "@/lib/feed";
import { useState } from "react";
import { ItemCard } from "./ItemCard";

export function LoadMore({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState(initial);
  const [busy, setBusy] = useState(false);
  const more = async () => {
    if (!feed.next || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/feed?after=${encodeURIComponent(feed.next)}`);
      const page = (await res.json()) as Feed;
      setFeed({ items: [...feed.items, ...page.items], next: page.next });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="grid grid-cols-2 gap-x-5 gap-y-10 px-5 py-6 pb-10 sm:grid-cols-3 lg:grid-cols-5">
        {feed.items.map((item) => (
          <ItemCard key={`${item.shop}-${item.tierId}`} item={item} showShop />
        ))}
      </section>
      {feed.next && (
        <div className="px-5 pb-20">
          <button
            type="button"
            onClick={more}
            disabled={busy}
            className="rounded-full border border-ink px-5 py-2.5 text-sm hover:bg-shelf disabled:text-mute"
          >
            {busy ? "Loading" : "Show more"}
          </button>
        </div>
      )}
    </>
  );
}
