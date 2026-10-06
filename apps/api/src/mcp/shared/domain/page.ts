export type PageRequest = {
  page: number;
  pageSize: number;
  sort: string;
};

export type Page<T> = {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export function pageOffset(input: PageRequest): number {
  return (input.page - 1) * input.pageSize;
}

export function createPage<T>(
  data: T[],
  totalItems: number,
  input: PageRequest,
): Page<T> {
  return {
    data,
    page: input.page,
    pageSize: input.pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
  };
}
