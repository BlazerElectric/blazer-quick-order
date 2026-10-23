import Papa from 'papaparse';
import { ProductItem, MatchedResultItem } from '../types';

export const ALIAS_MAP: Record<string, string> = {
  'cj6': 'CSS cable support strap cross cj6',
  'mc cable': 'metal clad cable aluminum armored 10/2 12/2',
  'mc': 'metal clad cable armored',
  '1in': '1 inch 1.00 in',
  '1/2in': '1/2 inch 0.50 in',
  '3/4in': '3/4 inch 0.75 in',
  '10/2': '10/2 10-2',
  '12/2': '12/2 12-2',
  'romex': 'nm-b non-metallic nonmetallic sheath cable',
  '14/2': '14/2 14-2',
  'wirenuts': 'wire connectors nut twist tan yellow red blue',
  'wire nuts': 'wire connectors nut twist',
  'emt': 'electrical metallic tubing conduit connector coupling',
  'ground rod': 'grounding rod copper clad',
  'strut': 'unistrut channel slotted',
};

// Inverted Index structure for sub-millisecond retrieval
export interface InvertedIndex {
  tokenMap: Map<string, number[]>;
  categorySet: string[];
}

let cachedIndex: InvertedIndex | null = null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\/-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function buildInvertedIndex(catalog: ProductItem[]): InvertedIndex {
  const tokenMap = new Map<string, number[]>();
  const categories = new Set<string>();

  for (let i = 0; i < catalog.length; i++) {
    const p = catalog[i];
    if (p.primary_category) categories.add(p.primary_category);

    const docText = `${p.PROD_ID} ${p.manufacturer_part_number || ''} ${p.clean_title || ''} ${p.PRODUCT || ''} ${p.search_keywords || ''}`;
    const tokens = new Set(tokenize(docText));

    tokens.forEach((token) => {
      const existing = tokenMap.get(token);
      if (existing) {
        existing.push(i);
      } else {
        tokenMap.set(token, [i]);
      }
    });
  }

  cachedIndex = {
    tokenMap,
    categorySet: Array.from(categories).sort(),
  };

  return cachedIndex;
}

export function expandQueryAliases(q: string): { expanded: string; appliedAliases: string[] } {
  let expanded = q.toLowerCase();
  const appliedAliases: string[] = [];

  for (const [alias, expansion] of Object.entries(ALIAS_MAP)) {
    if (expanded.includes(alias)) {
      expanded += ' ' + expansion;
      appliedAliases.push(alias);
    }
  }
  return { expanded, appliedAliases };
}

export function parseInputLine(rawLine: string): { query: string; qty: number; unit?: string } {
  let qty = 1;
  let unit = '';
  let line = rawLine.trim();

  const leadingQtyMatch = line.match(/^(\d+)\s*(ft|feet|pcs|ea|pk|box|boxes|spool|spools|roll|rolls)?\b/i);
  if (leadingQtyMatch) {
    qty = parseInt(leadingQtyMatch[1], 10);
    unit = leadingQtyMatch[2] || '';
    line = line.replace(leadingQtyMatch[0], '').trim();
  }

  const trailingQtyMatch = line.match(/(?:x|\*|\bq:\s*|\bqty:\s*)\s*(\d+)\s*(ft|feet|pcs|ea|pk)?$/i);
  if (trailingQtyMatch && qty === 1) {
    qty = parseInt(trailingQtyMatch[1], 10);
    if (trailingQtyMatch[2]) unit = trailingQtyMatch[2];
    line = line.replace(trailingQtyMatch[0], '').trim();
  }

  line = line.replace(/^[-–—:,]+|[-–—:,]+$/g, '').trim();

  return { query: line, qty: qty > 0 ? qty : 1, unit };
}

export async function fetchCsvCatalog(): Promise<{
  catalog: ProductItem[];
  rankMap: Record<string, number>;
  index: InvertedIndex;
}> {
  const prodResp = await fetch('/Blazer.Products.csv');
  if (!prodResp.ok) {
    throw new Error(`Failed to load Blazer.Products.csv (HTTP ${prodResp.status})`);
  }
  const prodText = await prodResp.text();
  const prodParsed = Papa.parse<ProductItem>(prodText, {
    header: true,
    skipEmptyLines: true,
  });

  const catalog = prodParsed.data.filter((p) => Boolean(p.PROD_ID));

  const rankMap: Record<string, number> = {};
  try {
    const rankResp = await fetch('/Blazer.Web.Rank.csv');
    if (rankResp.ok) {
      const rankText = await rankResp.text();
      const rankParsed = Papa.parse<{ PROD_ID: string; ORDERS: string }>(rankText, {
        header: true,
        skipEmptyLines: true,
      });
      rankParsed.data.forEach((row) => {
        if (row.PROD_ID) {
          rankMap[String(row.PROD_ID).trim()] = parseInt(row.ORDERS, 10) || 0;
        }
      });
    }
  } catch (err) {
    console.warn('Rank file could not be loaded, proceeding with base scoring', err);
  }

  const index = buildInvertedIndex(catalog);

  return { catalog, rankMap, index };
}

export function matchQueryAgainstCatalog(
  query: string,
  qty: number,
  unit: string | undefined,
  catalog: ProductItem[],
  rankMap: Record<string, number>,
  index?: InvertedIndex | null
): MatchedResultItem {
  const { expanded: expandedQuery, appliedAliases } = expandQueryAliases(query);
  const tokens = tokenize(expandedQuery);

  // If index is available, pull candidates with at least one matching token
  let candidateIndices: number[] = [];
  const activeIndex = index || cachedIndex;

  if (activeIndex && tokens.length > 0) {
    const matchCounts = new Map<number, number>();
    tokens.forEach((t) => {
      const hits = activeIndex.tokenMap.get(t);
      if (hits) {
        hits.forEach((idx) => {
          matchCounts.set(idx, (matchCounts.get(idx) || 0) + 1);
        });
      }
    });

    if (matchCounts.size > 0) {
      // Sort candidates by number of matched tokens to narrow to top 250 for detailed scoring
      candidateIndices = Array.from(matchCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 300)
        .map((entry) => entry[0]);
    }
  }

  // If no index hits or index wasn't built yet, fallback to full catalog scan
  const pool = candidateIndices.length > 0 ? candidateIndices.map((i) => catalog[i]) : catalog;

  const scored = pool.map((p) => {
    const productERP = (p.PRODUCT || '').toLowerCase();
    const title = (p.clean_title || '').toLowerCase();
    const mpn = (p.manufacturer_part_number || '').toLowerCase();
    const kw = (p.search_keywords || '').toLowerCase();
    const prodId = String(p.PROD_ID).trim();

    let score = 0;
    const reasons: string[] = [];

    for (const tok of tokens) {
      if (mpn === tok) {
        score += 80;
        reasons.push(`Exact MPN match: ${p.manufacturer_part_number}`);
      } else if (mpn.includes(tok)) {
        score += 35;
        reasons.push(`MPN contains "${tok}"`);
      }

      if (productERP.includes(tok)) {
        score += 20;
      }
      if (title.includes(tok)) {
        score += 15;
      }
      if (kw.includes(tok)) {
        score += 10;
      }
    }

    // Boost high-volume order SKUs
    const orderCount = rankMap[prodId] || 0;
    if (orderCount > 0) {
      const boost = Math.min(orderCount / 50, 25);
      score += boost;
      if (boost >= 10) {
        reasons.push(`High web order volume (${orderCount} orders)`);
      }
    }

    return { product: p, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const validCandidates = scored.filter((s) => s.score > 0);

  const bestMatch = validCandidates[0] || {
    product: catalog[0],
    score: 0,
    reasons: ['Default catalog fallback (no token match)'],
  };
  const alternatives = validCandidates.slice(1, 5).map((s) => s.product);

  // Determine confidence level & friendly verification labels
  let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
  let confidenceLabel = 'Review Needed';

  if (bestMatch.score >= 60 || bestMatch.reasons.some((r) => r.startsWith('Exact MPN'))) {
    confidenceLevel = 'high';
    confidenceLabel = 'Exact / High Match';
  } else if (bestMatch.score >= 25) {
    confidenceLevel = 'medium';
    confidenceLabel = 'Likely Match';
  }

  // Deduplicate and enrich match reasons
  const displayReasons = Array.from(new Set(bestMatch.reasons)).slice(0, 3);
  if (appliedAliases.length > 0) {
    displayReasons.push(`Applied trade alias for "${appliedAliases.join(', ')}"`);
  }

  return {
    id: `${bestMatch.product.PROD_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    originalQuery: query,
    requestedQty: qty,
    qty,
    unit,
    product: bestMatch.product,
    alternatives,
    score: Math.round(bestMatch.score),
    confidenceLevel,
    confidenceLabel,
    matchReasons: displayReasons,
  };
}

// Instant Live Catalog Search function for Drawer/Modal
export function searchCatalogInstant(
  query: string,
  catalog: ProductItem[],
  categoryFilter?: string,
  limit: number = 25
): ProductItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed && !categoryFilter) {
    return catalog.slice(0, limit);
  }

  const tokens = tokenize(trimmed);

  return catalog
    .filter((p) => {
      if (categoryFilter && categoryFilter !== 'ALL') {
        if (p.primary_category !== categoryFilter) return false;
      }
      if (tokens.length === 0) return true;

      const searchable = `${p.PROD_ID} ${p.clean_title || ''} ${p.PRODUCT || ''} ${p.manufacturer_part_number || ''} ${p.brand_manufacturer || ''}`.toLowerCase();
      return tokens.every((tok) => searchable.includes(tok));
    })
    .slice(0, limit);
}
