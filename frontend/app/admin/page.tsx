import type { Metadata } from "next";

import { AdminSellersPage } from "@/components/sellers/admin-sellers-page";
import { requireAdmin } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Administração | StoreSales",
  description: "Gerencie os vendedores da loja no StoreSales.",
};

export default async function AdminPage() {
  const account = await requireAdmin();

  return <AdminSellersPage account={account} />;
}
