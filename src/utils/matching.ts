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

export function expandQueryAliases(q: string): string {
  let expanded = q.toLowerCase();
  for (const [alias, expansion] of Object.entries(ALIAS_MAP)) {
    if (expanded.includes(alias)) {
      expanded += ' ' + expansion;
    }
  }
  return expanded;
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

  // Also check trailing qty e.g., "10/2 MC cable 50ft" or "Caddy CJ6 x 12"
  const trailingQtyMatch = line.match(/(?:x|\*|\bq:\s*|\bqty:\s*)\s*(\d+)\s*(ft|feet|pcs|ea|pk)?$/i);
  if (trailingQtyMatch && qty === 1) {
    qty = parseInt(trailingQtyMatch[1], 10);
    if (trailingQtyMatch[2]) unit = trailingQtyMatch[2];
    line = line.replace(trailingQtyMatch[0], '').trim();
  }

  // Clean trailing punctuation or commas
  line = line.replace(/^[-–—:,]+|[-–—:,]+$/g, '').trim();

  return { query: line, qty: qty > 0 ? qty : 1, unit };
}

export async function fetchCsvCatalog(): Promise<{
  catalog: ProductItem[];
  rankMap: Record<string, number>;
}> {
  // Fetch products
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

  // Fetch web ranks
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

  return { catalog, rankMap };
}

export function matchQueryAgainstCatalog(
  query: string,
  qty: number,
  unit: string | undefined,
  catalog: ProductItem[],
  rankMap: Record<string, number>
): MatchedResultItem {
  const expandedQuery = expandQueryAliases(query);
  const tokens = expandedQuery.split(/\s+/).filter((t) => t.length > 1);

  const scored = catalog.map((p) => {
    const productERP = (p.PRODUCT || '').toLowerCase();
    const title = (p.clean_title || '').toLowerCase();
    const mpn = (p.manufacturer_part_number || '').toLowerCase();
    const kw = (p.search_keywords || '').toLowerCase();
    const prodId = String(p.PROD_ID).trim();

    let score = 0;

    for (const tok of tokens) {
      if (mpn === tok) score += 80;
      else if (mpn.includes(tok)) score += 35;

      if (productERP.includes(tok)) score += 20; // ERP Product name match
      if (title.includes(tok)) score += 15;
      if (kw.includes(tok)) score += 10;
    }

    // Boost high-volume order SKUs
    const orderCount = rankMap[prodId] || 0;
    score += Math.min(orderCount / 50, 25);

    return { product: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.filter((s) => s.score > 0).map((s) => s.product);

  const mainMatch = candidates[0] || catalog[0];
  const alternatives = candidates.slice(1, 5);

  return {
    id: `${mainMatch.PROD_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    originalQuery: query,
    requestedQty: qty,
    qty,
    unit,
    product: mainMatch,
    alternatives,
    score: scored[0]?.score || 0,
  };
}
