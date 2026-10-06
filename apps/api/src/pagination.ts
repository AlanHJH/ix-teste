import { BadRequestException } from "@nestjs/common";

export type PageQuery = {
  page: number;
  pageSize: number;
  sort: string;
};

export type PaginatedResponse<T, TMeta = never> = {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
} & ([TMeta] extends [never] ? object : { meta: TMeta });

export function parsePageQuery(
  pageValue: string | undefined,
  pageSizeValue: string | undefined,
  sortValue: string | undefined,
  options: {
    defaultPageSize?: number;
    maximumPageSize?: number;
    defaultSort: string;
    allowedSorts: readonly string[];
  },
): PageQuery {
  const defaultPageSize = options.defaultPageSize ?? 25;
  const maximumPageSize = options.maximumPageSize ?? 100;
  const page = Math.max(1, Number.parseInt(pageValue ?? "1", 10) || 1);
  const pageSize = Math.min(
    maximumPageSize,
    Math.max(
      1,
      Number.parseInt(pageSizeValue ?? String(defaultPageSize), 10) ||
        defaultPageSize,
    ),
  );
  const sort = sortValue?.trim() || options.defaultSort;
  if (!options.allowedSorts.includes(sort)) {
    throw new BadRequestException(
      `Ordenação inválida. Use: ${options.allowedSorts.join(", ")}.`,
    );
  }
  return { page, pageSize, sort };
}

export function paginate<T, TMeta = never>(
  data: T[],
  totalItems: number,
  page: number,
  pageSize: number,
  meta?: TMeta,
): PaginatedResponse<T, TMeta> {
  const response = {
    data,
    page,
    pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
  } as PaginatedResponse<T, TMeta>;
  if (meta !== undefined) {
    Object.assign(response, { meta });
  }
  return response;
}
