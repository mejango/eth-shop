import { Header } from "@/components/Header";
import { ShopView } from "@/components/shop/ShopView";
import { demoExtras, demoItems, demoShop } from "@/lib/fixtures";
import { notFound } from "next/navigation";

type Params = { handle: string };
type Query = { item?: string; manage?: string };

// ponytail: temporary — Tasks 8-9 add real per-project shops behind this route.
const DEMO_OPERATORS = [{ address: "ada.eth", can: ["Add & remove items", "Update item details"] }];

export default async function ShopPage(props: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}) {
  const { handle } = await props.params;
  if (handle !== "demo") notFound();
  const { item, manage } = await props.searchParams;
  return (
    <>
      <Header
        right={<span className="hidden font-mono text-mute sm:inline">{demoShop.slug}</span>}
      />
      <ShopView
        shop={demoShop}
        initialItems={demoItems}
        extras={demoExtras}
        initialOperators={DEMO_OPERATORS}
        initialOpen={item ? Number(item) : undefined}
        initialManage={manage !== undefined}
      />
    </>
  );
}
