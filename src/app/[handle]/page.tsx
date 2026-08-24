import { Header } from "@/components/Header";
import { ItemCard } from "@/components/ItemCard";
import { ItemDialog } from "@/components/ItemDialog";
import { categoriesOf, items, itemsOf, shopBy } from "@/lib/fixtures";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = { handle: string };
type Query = { c?: string; item?: string };

export default async function ShopPage(props: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}) {
  const { handle } = await props.params;
  const { c, item: itemId } = await props.searchParams;
  const shop = shopBy(handle);
  if (!shop) notFound();
  const all = itemsOf(handle);
  const cats = categoriesOf(handle);
  const shown = c ? all.filter((i) => i.category === c) : all;
  const open = itemId ? items.find((i) => i.id === Number(itemId) && i.shop === handle) : undefined;

  return (
    <>
      <Header
        right={
          <span className="hidden font-mono text-mute sm:inline">
            {shop.chain}:{shop.projectId}
          </span>
        }
      />
      <section className="border-b border-shelf-deep px-5 pt-10 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="display text-4xl font-extrabold sm:text-6xl">{shop.name}</h1>
            <p className="mt-2 text-lg">{shop.tagline}</p>
            <p className="mt-3 max-w-xl text-sm text-mute">{shop.about}</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-ink px-4 py-2 font-mono text-sm hover:bg-shelf"
            title="Copy link"
          >
            eth.shop/{shop.handle}
          </button>
        </div>
      </section>

      {cats.length > 1 && (
        <nav
          className="flex gap-1 overflow-x-auto border-b border-shelf-deep px-5 text-sm"
          aria-label="Categories"
        >
          {[undefined, ...cats].map((cat) => {
            const active = cat === c;
            return (
              <Link
                key={cat ?? "all"}
                href={cat ? `/${handle}?c=${encodeURIComponent(cat)}` : `/${handle}`}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 ${active ? "border-ink font-medium" : "border-transparent text-mute hover:text-ink"}`}
              >
                {cat ?? "Everything"}
                <span className="ml-1.5 font-mono text-xs text-mute">
                  {cat ? all.filter((i) => i.category === cat).length : all.length}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      <section className="grid grid-cols-2 gap-x-5 gap-y-10 px-5 py-10 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </section>

      {open && <ItemDialog item={open} shop={shop} />}
    </>
  );
}
