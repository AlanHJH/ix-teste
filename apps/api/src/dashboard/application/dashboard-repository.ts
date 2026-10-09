import type { DashboardComposition } from "../dashboard.types";

export const DASHBOARD_REPOSITORY = Symbol("DASHBOARD_REPOSITORY");

export type DashboardPreference = {
  composition: unknown;
  updated_at: Date | string;
};

export type DashboardDefinition = {
  dashboard_id: string;
  user_id: string;
  name: string;
  description: string;
  is_default: boolean;
  composition: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

export type DashboardDefinitionInput = {
  name: string;
  description: string;
  composition: DashboardComposition;
  is_default?: boolean;
};

export interface DashboardRepository {
  getPreference(userId: string): Promise<DashboardPreference | null>;
  savePreference(
    userId: string,
    composition: DashboardComposition,
  ): Promise<{ updated_at: Date | string }>;
  listDashboards(userId: string): Promise<DashboardDefinition[]>;
  getDashboard(
    userId: string,
    dashboardId: string,
  ): Promise<DashboardDefinition | null>;
  createDashboard(
    userId: string,
    input: DashboardDefinitionInput & { dashboard_id: string },
  ): Promise<DashboardDefinition>;
  saveDashboard(
    userId: string,
    dashboardId: string,
    input: DashboardDefinitionInput,
  ): Promise<DashboardDefinition | null>;
  setDefaultDashboard(
    userId: string,
    dashboardId: string,
  ): Promise<DashboardDefinition | null>;
}
