import type { Metadata } from "next";

import { NewSalePage } from "@/components/sales/new-sale-page";

export const metadata: Metadata = {
  title: "Nova venda | StoreSales",
  description: "Registre uma nova venda e atualize o estoque da StoreSales.",
};

export default function NovaVendaPage() {
  return <NewSalePage />;
}
