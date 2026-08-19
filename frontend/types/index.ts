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
  payment_method: string;
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
