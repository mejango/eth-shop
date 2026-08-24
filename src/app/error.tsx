"use client";
import { Header } from "@/components/Header";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <Header />
      <div className="px-5 py-20">
        <h1 className="display text-4xl font-extrabold">Couldn&apos;t reach the chain.</h1>
        <p className="mt-3 text-mute">
          The shop is still there.{" "}
          <button type="button" onClick={reset} className="underline">
            Try again
          </button>
          .
        </p>
      </div>
    </>
  );
}
