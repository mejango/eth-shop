import { HandleHero } from "@/components/HandleHero";
import { Header } from "@/components/Header";
import { LoadMore } from "@/components/LoadMore";
import { readFeed, type Feed } from "@/lib/feed";

export const revalidate = 60;

const STEPS: [string, string][] = [
  ["Name your shop", "Pick a handle. That's your link: eth.shop/handle."],
  ["Add what you sell", "Digital or physical. One item is a shop. Add categories when you outgrow one shelf."],
  ["Get paid, on-chain", "Buyers pay in ETH or USDC on the chain you choose. Every sale is an NFT receipt they keep."],
];

export default async function Home() {
  let feed: Feed | null = null;
  try {
    feed = await readFeed();
  } catch {
    feed = null;
  }
  return (
    <>
      <Header />
      <HandleHero />
      <section id="buy" className="scroll-mt-14 px-5 pt-8">
        <h2 className="text-sm text-mute">Selling right now</h2>
      </section>
      {feed ? (
        <LoadMore initial={feed} />
      ) : (
        <p className="px-5 py-10 text-sm text-mute">The feed is unavailable right now. Shops still work by link.</p>
      )}
      <section className="grid gap-10 border-t border-shelf-deep bg-shelf px-5 py-14 sm:grid-cols-3">
        {STEPS.map(([h, p]) => (
          <div key={h}>
            <h3 className="display text-xl font-extrabold">{h}</h3>
            <p className="mt-2 text-sm text-mute">{p}</p>
          </div>
        ))}
      </section>
    </>
  );
}
