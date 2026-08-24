import { HandleHero } from "@/components/HandleHero";
import { Header } from "@/components/Header";
import { ItemCard } from "@/components/ItemCard";
import { items, itemsOf, shops } from "@/lib/fixtures";
import Link from "next/link";

// ponytail: two home directions behind ?v= so they can be compared on one deploy.
export default async function Home({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const other = v === "b" ? "/" : "/?v=b";
  const toggle = (
    <Link href={other} className="text-mute hover:text-ink">
      try home {v === "b" ? "A" : "B"} →
    </Link>
  );
  return v === "b" ? <HomeB toggle={toggle} /> : <HomeA toggle={toggle} />;
}

function HomeA({ toggle }: { toggle: React.ReactNode }) {
  const feed = [...items].sort((a, b) => ((a.id * 7919) % 97) - ((b.id * 7919) % 97));
  return (
    <>
      <Header right={toggle} />
      <section className="px-5 pt-10 pb-6">
        <h1 className="display max-w-3xl text-4xl font-extrabold leading-none sm:text-6xl">
          Things people are selling on Ethereum, right now.
        </h1>
        <p className="mt-4 max-w-xl text-mute">
          Every item is sold by its maker from their own shop. Pay once, get the thing, keep the
          receipt.
        </p>
      </section>
      <section className="grid grid-cols-2 gap-x-5 gap-y-10 px-5 pb-20 sm:grid-cols-3 lg:grid-cols-5">
        {feed.map((item) => (
          <ItemCard key={item.id} item={item} showShop />
        ))}
      </section>
      <section className="border-t border-shelf-deep bg-shelf px-5 py-14">
        <p className="display text-2xl font-extrabold sm:text-4xl">Your stuff could be up there.</p>
        <Link
          href="/sell"
          className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-paper hover:bg-accent"
        >
          Open a shop in a minute
        </Link>
      </section>
    </>
  );
}

function HomeB({ toggle }: { toggle: React.ReactNode }) {
  return (
    <>
      <Header right={toggle} />
      <HandleHero />
      <section className="px-5 pb-20">
        <h2 className="mb-8 text-sm text-mute">Shops already open</h2>
        <div className="space-y-14">
          {shops.slice(0, 3).map((shop) => {
            const preview = itemsOf(shop.handle).slice(0, 5);
            return (
              <div key={shop.handle}>
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/${shop.handle}`}
                    className="display text-2xl font-extrabold hover:text-accent"
                  >
                    {shop.name}
                  </Link>
                  <span className="font-mono text-sm text-mute">
                    eth.shop/{shop.handle} · {itemsOf(shop.handle).length} items
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
                  {preview.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="grid gap-10 border-t border-shelf-deep bg-shelf px-5 py-14 sm:grid-cols-3">
        {[
          ["Name your shop", "Pick a handle. That's your link: eth.shop/handle."],
          [
            "Add what you sell",
            "Digital or physical. One item is a shop. Add categories when you outgrow one shelf.",
          ],
          [
            "Get paid, on-chain",
            "Buyers pay in ETH or USDC on the chain you choose. Every sale is an NFT receipt they keep.",
          ],
        ].map(([h, p]) => (
          <div key={h}>
            <h3 className="display text-xl font-extrabold">{h}</h3>
            <p className="mt-2 text-sm text-mute">{p}</p>
          </div>
        ))}
      </section>
    </>
  );
}
