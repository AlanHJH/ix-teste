export type PageRequest = {
  limit: number;
  offset: number;
};

export type Page<T> = PageRequest & {
  total: number;
  items: T[];
};
