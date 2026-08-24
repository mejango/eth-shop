import { HandleHero } from "@/components/HandleHero";
import { Header } from "@/components/Header";
import { ItemCard } from "@/components/ItemCard";
import { demoItems } from "@/lib/fixtures";

export default function Home() {
  // ponytail: temporary — Task 8 replaces this with the on-chain feed.
  const feed = [...demoItems].sort(
    (a, b) => ((a.tierId * 7919) % 97) - ((b.tierId * 7919) % 97),
  );
  return (
    <>
      <Header />
      <HandleHero />
      <section id="buy" className="scroll-mt-14 border-t border-shelf-deep px-5 pt-8">
        <h2 className="text-sm text-mute">Selling right now</h2>
      </section>
      <section className="grid grid-cols-2 gap-x-5 gap-y-10 px-5 py-6 pb-20 sm:grid-cols-3 lg:grid-cols-5">
        {feed.map((item) => (
          <ItemCard key={item.tierId} item={item} showShop />
        ))}
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
