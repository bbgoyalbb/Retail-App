// Core type definitions for Retail App (Fix 7.1 - TypeScript migration)

export interface User {
  username: string;
  full_name: string;
  role: 'admin' | 'manager' | 'cashier';
  is_active: boolean;
  allowed_pages?: string[];
}

export interface Item {
  id?: string;
  _id?: string;
  date: string;
  name: string;
  ref: string;
  barcode: string;
  price: number;
  qty: number;
  discount: number;
  fabric_amount: number;
  fabric_received: number;
  fabric_pending: number;
  fabric_pay_date?: string;
  fabric_pay_mode?: string;
  tally_fabric?: boolean;
  tailoring_status?: string;
  tailoring_amount?: number;
  tailoring_received?: number;
  tailoring_pending?: number;
  tailoring_pay_date?: string;
  tailoring_pay_mode?: string;
  tally_tailoring?: boolean;
  embroidery_status?: string;
  embroidery_amount?: number;
  embroidery_received?: number;
  embroidery_pending?: number;
  embroidery_pay_mode?: string;
  embroidery_pay_date?: string;
  karigar?: string;
  emb_labour_amount?: number;
  emb_labour_paid?: number;
  emb_labour_date?: string;
  emb_labour_payment_mode?: string;
  tally_embroidery?: boolean;
  addon_desc?: string;
  addon_amount?: number;
  addon_received?: number;
  addon_pending?: number;
  addon_pay_mode?: string;
  addon_pay_date?: string;
  tally_addon?: boolean;
  cancelled?: boolean;
  article_type?: string;
  order_no?: string;
  delivery_date?: string;
}

export interface Advance {
  id?: string;
  _id?: string;
  date: string;
  name: string;
  ref: string;
  amount: number;
  mode: string;
  tally?: boolean;
}

export interface Bill {
  id?: string;
  _id?: string;
  ref: string;
  date: string;
  name: string;
  items: Item[];
  total: number;
  paid: number;
  pending: number;
  is_settled: boolean;
}

export interface Settings {
  firm_name: string;
  firm_address: string;
  firm_phones: string;
  firm_gstin: string;
  gst_rate: number;
  article_types: string[];
  addon_items: string[];
  payment_modes: string[];
  karigars: string[];
  tailoring_rates: Record<string, number>;
  firm_logo?: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface Balance {
  fabric: number;
  tailoring: number;
  embroidery: number;
  addon: number;
  advance: number;
  total: number;
  pending: number;
}

export interface RefBalance {
  [ref: string]: Balance;
}
