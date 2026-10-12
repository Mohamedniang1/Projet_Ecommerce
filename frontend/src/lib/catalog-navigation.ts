export const catalogSorts = [
  { value: "-created_at", label: "Plus récents" },
  { value: "price", label: "Prix croissant" },
  { value: "-price", label: "Prix décroissant" },
  { value: "name", label: "Nom : A à Z" },
] as const;

export type CatalogFilters = {
  category: string;
  search: string;
  ordering: string;
  page: number;
};

export function readCatalogFilters(params: { get: (key: string) => string | null }): CatalogFilters {
  const category = params.get("category") ?? "";
  const ordering = params.get("ordering") ?? "";
  const page = params.get("page") ?? "1";

  return {
    category: /^[a-zA-Z0-9_-]{1,100}$/.test(category) ? category : "",
    search: (params.get("search") ?? "").trim().slice(0, 150),
    ordering: catalogSorts.some((sort) => sort.value === ordering) ? ordering : "-created_at",
    page: /^\d+$/.test(page) && Number.isSafeInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1,
  };
}

export function catalogQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.search) params.set("search", filters.search);
  if (filters.ordering !== "-created_at") params.set("ordering", filters.ordering);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function catalogHref(filters: CatalogFilters): string {
  const query = catalogQuery(filters);
  return `/${query ? `?${query}` : ""}#catalogue`;
}
