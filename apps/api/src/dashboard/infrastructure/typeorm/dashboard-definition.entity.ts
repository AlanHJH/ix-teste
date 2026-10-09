import { Column, Entity, PrimaryColumn } from "typeorm";
import type { DashboardComposition } from "../../dashboard.types";

@Entity({ name: "dashboard_definitions" })
export class DashboardDefinitionEntity {
  @PrimaryColumn({ name: "dashboard_id", type: "text" })
  dashboardId!: string;

  @Column({ name: "user_id", type: "text" })
  userId!: string;

  @Column({ name: "name", type: "text" })
  name!: string;

  @Column({ name: "description", type: "text", default: "" })
  description!: string;

  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault!: boolean;

  @Column({ name: "composition", type: "jsonb" })
  composition!: DashboardComposition;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "now()",
  })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "timestamptz",
    default: () => "now()",
  })
  updatedAt!: Date;
}
