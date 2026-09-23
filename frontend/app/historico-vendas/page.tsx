import type { Metadata } from "next";

import { SalesHistoryPage } from "@/components/sales/sales-history-page";

export const metadata: Metadata = {
  title: "Histórico de vendas | StoreSales",
  description: "Consulte as vendas registradas no StoreSales.",
};

type HistorySearchParams = Promise<{
  date_from?: string | string[];
  date_to?: string | string[];
  seller?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HistoricoVendasPage({
  searchParams,
}: {
  searchParams: HistorySearchParams;
}) {
  const query = await searchParams;

  return (
    <SalesHistoryPage
      initialQuery={{
        dateFrom: firstValue(query.date_from),
        dateTo: firstValue(query.date_to),
        seller: firstValue(query.seller),
      }}
    />
  );
}
