import type { Metadata } from "next";
import { MobileCatalog } from "@/components/MobileCatalog";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ region?: string }> };

export const metadata: Metadata = {
  title: "Тарифы мобильной связи",
  description:
    "Сравните тарифы МТС, Билайна, МегаФона, t2 и других операторов в вашем регионе: гигабайты, минуты, цена, eSIM и перенос номера.",
  alternates: { canonical: "/mobile" },
};

export default async function MobilePage({ searchParams }: Props) {
  const { region } = await searchParams;
  return <MobileCatalog requestedRegion={region} />;
}
