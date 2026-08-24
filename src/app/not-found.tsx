import { Header } from "@/components/Header";
import Link from "next/link";
export default function NotFound() {
  return (
    <>
      <Header />
      <div className="px-5 py-20">
        <h1 className="display text-4xl font-extrabold">No shop here yet.</h1>
        <p className="mt-3 text-mute">
          This handle is free.{" "}
          <Link href="/sell" className="underline">
            Take it.
          </Link>
        </p>
      </div>
    </>
  );
}
