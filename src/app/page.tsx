import { HandleHero } from "@/components/HandleHero";
import { Header } from "@/components/Header";
import { LoadMore } from "@/components/LoadMore";
import { readFeed, type Feed } from "@/lib/feed";

export const revalidate = 60;

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
    </>
  );
}
