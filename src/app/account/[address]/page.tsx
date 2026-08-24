import { Header } from "@/components/Header";
import { groupByShop, readOwnedItems } from "@/lib/account";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress } from "viem";

export default async function Account({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  const groups = groupByShop(await readOwnedItems(address));
  return (
    <>
      <Header />
      <div className="px-5 py-10">
        <h1 className="display text-4xl font-extrabold">Your items</h1>
        <p className="mt-1 font-mono text-sm text-mute">{address}</p>
        {groups.length === 0 && (
          <p className="mt-8 text-mute">
            Nothing yet.{" "}
            <Link href="/#buy" className="underline">
              Find something
            </Link>
            .
          </p>
        )}
        {groups.map((g) => (
          <section key={g.shop} className="mt-10">
            <Link href={`/${g.shop}`} className="display text-2xl font-extrabold hover:text-accent">
              {g.shopName}
            </Link>
            <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
              {g.items.map((it) => (
                <li key={it.tokenId} className="text-sm">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="aspect-square w-full rounded-sm object-cover" />
                  ) : (
                    <div className="aspect-square w-full rounded-sm bg-shelf" />
                  )}
                  <p className="mt-2">{it.name}</p>
                  <p className="font-mono text-xs text-mute">token {it.tokenId}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
