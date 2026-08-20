import type { Metadata } from "next";

import { CustomersPage } from "@/components/customers/customers-page";

export const metadata: Metadata = {
  title: "Clientes | StoreSales",
  description: "Consulte e gerencie os clientes da StoreSales.",
};

export default function ClientesPage() {
  return <CustomersPage />;
}
