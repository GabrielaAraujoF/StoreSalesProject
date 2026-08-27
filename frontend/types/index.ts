export interface Customer {
  id: number;
  name: string;
  phone: string | null;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: string;
  stock: number;
}

export interface Seller {
  id: number;
  seller_number: number;
  name: string;
  email: string;
  active: boolean;
}

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "pix";

export interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface Sale {
  id: number;
  customer: Customer | null;
  seller: Pick<Seller, "id" | "seller_number" | "name"> | null;
  payment_method: string;
  total: string;
  created_at: string;
  items: SaleItem[];
}

export interface CustomerInput {
  name: string;
  phone?: string | null;
}

export interface ProductInput {
  name: string;
  category: string;
  price: string;
  stock: number;
}

export interface SaleInput {
  customer_id?: number | null;
  seller_id: number;
  payment_method: PaymentMethod;
  items: Array<{
    product_id: number;
    quantity: number;
  }>;
}

export interface CustomerListResponse {
  customers: Customer[];
}

export interface ProductListResponse {
  products: Product[];
}

export interface SaleListResponse {
  sales: Sale[];
}

export interface SellerListResponse {
  sellers: Seller[];
}
