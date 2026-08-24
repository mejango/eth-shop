import { Header } from "@/components/Header";
import { SellFlow } from "@/components/SellFlow";

export default async function Sell({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>;
}) {
  const { handle } = await searchParams;
  return (
    <>
      <Header />
      <SellFlow initialHandle={handle ?? ""} />
    </>
  );
}
