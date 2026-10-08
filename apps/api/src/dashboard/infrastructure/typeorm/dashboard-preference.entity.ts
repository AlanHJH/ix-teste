import { Column, Entity, PrimaryColumn } from "typeorm";
import type { DashboardComposition } from "../../dashboard.types";

@Entity({ name: "dashboard_preferences" })
export class DashboardPreferenceEntity {
  @PrimaryColumn({ name: "user_id", type: "text" })
  userId!: string;

  @Column({ name: "composition", type: "jsonb" })
  composition!: DashboardComposition;

  @Column({
    name: "updated_at",
    type: "timestamptz",
    default: () => "now()",
  })
  updatedAt!: Date;
}
