"use client";
import { SLOGANS } from "@/lib/slogans";
import Link from "next/link";
import { useState } from "react";

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);

export function HandleHero({ slogan = 0 }: { slogan?: number }) {
  const [handle, setHandle] = useState("");
  const h = clean(handle);
  return (
    <section className="px-5 pt-14 pb-16">
      <h1 className="display max-w-5xl text-5xl font-extrabold leading-none sm:text-8xl">
        {SLOGANS[slogan]}
      </h1>
      <label className="mt-8 flex max-w-2xl flex-wrap items-baseline gap-x-1 font-mono text-3xl sm:text-5xl">
        <span className="text-mute">eth.shop/</span>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="you"
          aria-label="Your shop handle"
          className="min-w-[5ch] flex-1 border-b-2 border-ink bg-transparent px-0 py-1 outline-none placeholder:text-shelf-deep focus:border-accent"
          style={{ width: `${Math.max(h.length, 3) + 1}ch` }}
        />
      </label>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link
          href={`/sell${h ? `?handle=${h}` : ""}`}
          className="rounded-full bg-accent px-6 py-3 text-lg font-medium text-paper hover:bg-accent-ink"
        >
          {h ? `Open eth.shop/${h}` : "Open a shop"}
        </Link>
        <span className="text-sm text-mute">Takes a minute. No fees beyond Juicebox&apos;s.</span>
      </div>
    </section>
  );
}
