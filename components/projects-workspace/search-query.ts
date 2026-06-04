export type ParsedSearchQuery = {
  include: string;
  exclusions: string[];
};

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const exclusions: string[] = [];
  const include = query.replace(/\[([^\]]*)\]/g, (_match, term: string) => {
    const normalizedTerm = normalizeSearchText(term);
    if (normalizedTerm) {
      exclusions.push(normalizedTerm);
    }
    return " ";
  });

  return {
    include: normalizeSearchText(include),
    exclusions: Array.from(new Set(exclusions)),
  };
}

export function hasSearchQuery(query: ParsedSearchQuery) {
  return query.include.length > 0 || query.exclusions.length > 0;
}

export function matchesSearchQuery(
  query: ParsedSearchQuery,
  content: string,
) {
  const normalizedContent = normalizeSearchText(content);
  if (query.exclusions.some((exclusion) => normalizedContent.includes(exclusion))) {
    return false;
  }

  if (!query.include) {
    return true;
  }

  return normalizedContent.includes(query.include);
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
