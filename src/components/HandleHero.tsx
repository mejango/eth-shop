import Link from "next/link";

export function HandleHero() {
  return (
    <section className="px-5 pt-14 pb-16">
      <h1 className="display max-w-6xl text-5xl font-extrabold leading-none sm:text-8xl">
        Make it your own.
      </h1>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/sell"
          className="rounded-md bg-accent px-6 py-3 text-lg font-medium text-ink hover:bg-accent-ink"
        >
          Open a shop
        </Link>
      </div>
    </section>
  );
}
