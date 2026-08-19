import type { Metadata } from "next";

import { ProductsPage } from "@/components/products/products-page";

export const metadata: Metadata = {
  title: "Produtos | StoreSales",
  description: "Consulte e cadastre produtos no StoreSales.",
};

export default function ProdutosPage() {
  return <ProductsPage />;
}
