import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ operator: string }>;
  searchParams: Promise<{ region?: string }>;
};

// Оператор с активными мобильными тарифами; иначе страницы нет.
function findOperator(slug: string) {
  return prisma.provider.findFirst({
    where: { slug, isActive: true, plans: { some: { type: "MOBILE", isActive: true } } },
    select: { slug: true, name: true },
  });
}

// SEO под запросы «тарифы <оператор>».
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { operator } = await params;
  const op = await findOperator(operator);
  if (!op) return { title: "Оператор не найден" };
  return {
    title: `Тарифы ${op.name}`,
    description: `Все тарифы ${op.name} с ценами вашего региона: гигабайты, минуты, eSIM. Сравните и оформите онлайн.`,
    alternates: { canonical: `/mobile/${op.slug}` },
  };
}

export default async function OperatorPage({ params, searchParams }: Props) {
  const [{ operator }, { region }] = await Promise.all([params, searchParams]);
  const op = await findOperator(operator);
  if (!op) notFound();
  return <MobileCatalog requestedRegion={region} operator={op} />;
}
