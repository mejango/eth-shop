"use client";
import type { Feed } from "@/lib/feed";
import { useCallback, useEffect, useRef, useState } from "react";
import { ItemCard } from "./ItemCard";

export function LoadMore({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const more = useCallback(async () => {
    if (!feed.next || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/feed?after=${encodeURIComponent(feed.next)}`);
      if (!res.ok) throw new Error("feed fetch failed");
      const page = (await res.json()) as Feed;
      setFeed({ items: [...feed.items, ...page.items], next: page.next });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [feed, busy]);
  // ponytail: one sentinel + IntersectionObserver; pages stay small so the DOM grows
  // only as far as the user actually scrolls.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !feed.next || error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void more();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, feed.next, error]);
  return (
    <>
      <section className="grid grid-cols-2 gap-x-5 gap-y-10 px-5 py-6 pb-10 sm:grid-cols-3 lg:grid-cols-5">
        {feed.items.map((item) => (
          <ItemCard key={`${item.shop}-${item.tierId}`} item={item} showShop />
        ))}
      </section>
      {feed.next && (
        <div ref={sentinel} className="px-5 pb-20 text-sm text-mute">
          {busy && "Loading"}
          {error && (
            <button type="button" onClick={more} className="underline hover:text-ink">
              Couldn&apos;t load more. Try again.
            </button>
          )}
        </div>
      )}
    </>
  );
}
