import { Header } from "@/components/Header";
import { ShopView } from "@/components/shop/ShopView";
import { itemsOf, shopBy } from "@/lib/fixtures";
import { notFound } from "next/navigation";

type Params = { handle: string };
type Query = { item?: string; manage?: string };

export default async function ShopPage(props: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}) {
  const { handle } = await props.params;
  const { item, manage } = await props.searchParams;
  const shop = shopBy(handle);
  if (!shop) notFound();
  return (
    <>
      <Header
        right={
          <span className="hidden font-mono text-mute sm:inline">
            {shop.chain}:{shop.projectId}
          </span>
        }
      />
      <ShopView
        shop={shop}
        initialItems={itemsOf(handle)}
        initialOpen={item ? Number(item) : undefined}
        initialManage={manage !== undefined}
      />
    </>
  );
}
