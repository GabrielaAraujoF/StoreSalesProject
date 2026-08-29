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

export interface SellerSummary {
  id: number;
  seller_number: number;
  name: string;
}

export interface Seller extends SellerSummary {
  email: string;
  active: boolean;
}

export interface Account {
  id: number;
  name: string;
  email: string;
  role: string;
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
  seller: SellerSummary | null;
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

export interface SellerInput {
  name: string;
  email: string;
}

export interface SellerUpdateInput {
  name?: string;
  email?: string;
  active?: boolean;
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

export interface SellerListResponse {
  sellers: Seller[];
}

export interface ActiveSellerListResponse {
  sellers: SellerSummary[];
}

export interface AuthResponse {
  message: string;
  account: Account;
}

export interface AccountResponse {
  account: Account;
}

export interface SaleListResponse {
  sales: Sale[];
}
