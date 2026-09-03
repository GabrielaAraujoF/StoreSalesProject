import type { Metadata } from "next";

import { DashboardPage } from "@/components/dashboard/dashboard-page";

export const metadata: Metadata = {
  title: "Dashboard | StoreSales",
  description: "Acompanhe vendas, produtos e desempenho da equipe no StoreSales.",
};

export default function DashboardRoute() {
  return <DashboardPage />;
}
