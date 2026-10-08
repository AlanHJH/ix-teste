import type { DashboardComposition } from "../dashboard.types";

export const DASHBOARD_REPOSITORY = Symbol("DASHBOARD_REPOSITORY");

export type DashboardPreference = {
  composition: unknown;
  updated_at: Date | string;
};

export interface DashboardRepository {
  getPreference(userId: string): Promise<DashboardPreference | null>;
  savePreference(
    userId: string,
    composition: DashboardComposition,
  ): Promise<{ updated_at: Date | string }>;
}
