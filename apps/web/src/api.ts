import type { Overview, SupportProfile } from './types';

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `Falha ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  overview: () => request<Overview>('/api/network/overview'),
  support: (customerId: string) => request<SupportProfile>(`/api/customers/${encodeURIComponent(customerId)}/support`)
};

