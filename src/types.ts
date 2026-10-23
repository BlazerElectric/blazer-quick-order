export interface ProductItem {
  PROD_ID: string;
  PRODUCT: string;
  brand_manufacturer?: string;
  manufacturer_part_number?: string;
  clean_title?: string;
  primary_category?: string;
  sub_category?: string;
  search_keywords?: string;
  common_misspellings?: string;
}

export interface MatchedResultItem {
  id: string;
  originalQuery: string;
  requestedQty: number;
  qty: number;
  unit?: string;
  product: ProductItem;
  alternatives: ProductItem[];
  score: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceLabel: string;
  matchReasons: string[];
}

export interface OrderInputRow {
  id: string;
  description: string;
  qty: number;
}
