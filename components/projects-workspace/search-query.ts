export type ParsedSearchQuery = {
  include: string;
  titleExclusions: string[];
};

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const titleExclusions: string[] = [];
  const include = query.replace(/\[([^\]]*)\]/g, (_match, term: string) => {
    const normalizedTerm = normalizeSearchText(term);
    if (normalizedTerm) {
      titleExclusions.push(normalizedTerm);
    }
    return " ";
  });

  return {
    include: normalizeSearchText(include),
    titleExclusions: Array.from(new Set(titleExclusions)),
  };
}

export function hasSearchQuery(query: ParsedSearchQuery) {
  return query.include.length > 0 || query.titleExclusions.length > 0;
}

export function matchesSearchQuery(
  query: ParsedSearchQuery,
  content: string,
  title: string,
) {
  const normalizedTitle = normalizeSearchText(title);
  if (
    query.titleExclusions.some((exclusion) =>
      normalizedTitle.includes(exclusion),
    )
  ) {
    return false;
  }

  if (!query.include) {
    return true;
  }

  return normalizeSearchText(content).includes(query.include);
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
