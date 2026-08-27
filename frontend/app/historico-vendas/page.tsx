import type { Metadata } from "next";

import { SalesHistoryPage } from "@/components/sales/sales-history-page";

export const metadata: Metadata = {
  title: "Histórico de vendas | StoreSales",
  description: "Consulte as vendas registradas no StoreSales.",
};

export default function HistoricoVendasPage() {
  return <SalesHistoryPage />;
}
