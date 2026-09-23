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

export interface SaleFilterSeller extends SellerSummary {
  active: boolean;
}

export interface SaleFilters {
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
  seller?: string;
  sellerId?: number;
  paymentMethod?: PaymentMethod | "";
}

export interface SalePagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface SaleSummary {
  sales_count: number;
  total_amount: string;
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
  pagination: SalePagination;
  summary: SaleSummary;
}

export interface SaleFilterSellerListResponse {
  sellers: SaleFilterSeller[];
}

export interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  seller?: string;
  sellerId?: number;
}

export interface DashboardSummary {
  total_amount: string;
  sales_count: number;
  average_ticket: string;
  units_sold: number;
}

export interface DashboardEvolutionPoint {
  key: string;
  label: string;
  total: string;
}

export interface DashboardPayment {
  method: PaymentMethod;
  label: string;
  sales_count: number;
  total: string;
  percentage: number;
}

export interface DashboardProductRanking {
  product_id: number;
  name: string;
  units_sold: number;
  total_amount: string;
}

export interface DashboardSellerPerformance {
  seller_id: number;
  seller_number: number;
  name: string;
  active: boolean;
  sales_count: number;
  total_amount: string;
}

export interface DashboardResponse {
  period: {
    date_from: string;
    date_to: string;
  };
  summary: DashboardSummary;
  evolution: {
    grouping: "hour" | "day" | "month";
    points: DashboardEvolutionPoint[];
  };
  payments: DashboardPayment[];
  top_products: DashboardProductRanking[];
  seller_performance: DashboardSellerPerformance[];
  recent_sales: Sale[];
}
