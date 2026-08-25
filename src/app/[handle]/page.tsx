import { Header } from "@/components/Header";
import { ShopView } from "@/components/shop/ShopView";
import { demoExtras, demoItems, demoShop } from "@/lib/fixtures";
import { resolveShopRoute } from "@/lib/resolveShop";
import { readOmnichainShop } from "@/lib/shop";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

type Params = { handle: string };
type Query = { item?: string; manage?: string };

// Cached per request so generateMetadata and the page component share one readShop call
// (and its RPC/Bendystraw reads) instead of fetching the same shop twice.
const load = cache(async (handle: string) => {
  const route = await resolveShopRoute(handle);
  if (!route) return null;
  if ("demo" in route)
    return { shop: demoShop, items: demoItems, chainShops: [demoShop], extras: demoExtras, demo: true };
  const data = await readOmnichainShop(route.chainId, route.projectId);
  return data ? { ...data, extras: {}, demo: false } : null;
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { handle } = await params;
  const data = await load(handle).catch(() => null);
  return data
    ? { title: `${data.shop.name} on eth.shop`, description: data.shop.tagline ?? data.shop.about }
    : { title: "eth.shop" };
}

export default async function ShopPage(props: { params: Promise<Params>; searchParams: Promise<Query> }) {
  const { handle } = await props.params;
  const { item, manage } = await props.searchParams;
  const data = await load(handle); // RPC failure throws to error.tsx; never a false 404
  if (!data) notFound();
  return (
    <>
      <Header />
      <ShopView
        shop={data.shop}
        demo={data.demo}
        initialItems={data.items}
        chainShops={data.chainShops}
        extras={data.extras}
        initialOperators={data.demo ? [{ address: "ada.eth", can: ["Add & remove items", "Update item details"] }] : []}
        initialOpen={item ? Number(item) : undefined}
        initialManage={manage !== undefined}
      />
    </>
  );
}
