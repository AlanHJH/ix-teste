import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../database";
import { paginate } from "../pagination";

export type ScopeType =
  | "park"
  | "olt"
  | "pon"
  | "cto"
  | "customer"
  | "firmware"
  | "equipment"
  | "region";

export type IncidentOptionType =
  "olt" | "pon" | "cto" | "customer" | "firmware" | "equipment" | "region";

type IncidentOptionsInput = {
  type: IncidentOptionType;
  query: string;
  olt: string;
  pon: string;
  page: number;
  pageSize: number;
  sort: string;
};

type IncidentOptionRow = {
  value: string;
  label: string;
};

export type CreateIncidentInput = {
  openedBy: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  scopeType: ScopeType;
  identifier: string;
  olt: string;
  pon: string;
  cto: string;
  probableCause: string;
  recommendedAction: string;
  originTicketId: string | null;
};

type CountRow = { affected: number };

export type ProposedIncidentScope = {
  type: ScopeType | "network";
  identifier: string;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

@Injectable()
export class IncidentsService {
  constructor(private readonly database: DatabaseService) {}

  async options(input: IncidentOptionsInput) {
    const query = input.query.trim();
    const olt = input.olt.trim().toUpperCase();
    const pon = input.pon.trim();
    let sql = "";
    let params: string[] = [];

    switch (input.type) {
      case "olt":
        sql = `SELECT DISTINCT olt AS value, olt AS label
          FROM inventory
          WHERE status='active'
            AND ($1='' OR left(lower(olt), length($1))=lower($1))
          GROUP BY olt`;
        params = [query];
        break;
      case "pon":
        if (!olt)
          return paginate([], 0, input.page, input.pageSize, {
            type: input.type,
          });
        sql = `SELECT DISTINCT pon_port AS value,
            concat('PON ', pon_port, ' · ', olt) AS label
          FROM inventory
          WHERE status='active' AND olt=$1
            AND ($2='' OR left(lower(pon_port), length($2))=lower($2))
          `;
        params = [olt, query];
        break;
      case "cto":
        if (!olt || !pon)
          return paginate([], 0, input.page, input.pageSize, {
            type: input.type,
          });
        sql = `SELECT DISTINCT cto AS value,
            concat(cto, ' · ', olt, ' / ', pon_port) AS label
          FROM inventory
          WHERE status='active' AND olt=$1 AND pon_port=$2
            AND ($3='' OR left(lower(cto), length($3))=lower($3))
          `;
        params = [olt, pon, query];
        break;
      case "firmware":
        sql = `SELECT DISTINCT software_version AS value,
            software_version AS label
          FROM inventory
          WHERE status='active'
            AND ($1='' OR left(lower(software_version), length($1))=lower($1))
          `;
        params = [query];
        break;
      case "equipment":
        sql = `SELECT DISTINCT
            concat_ws(' ', vendor, model, hw_revision) AS value,
            concat(vendor, ' ', model, ' · rev. ', hw_revision) AS label
          FROM inventory
          WHERE status='active'
            AND ($1='' OR left(lower(concat_ws(' ', vendor, model, hw_revision)), length($1))=lower($1))
          `;
        params = [query];
        break;
      case "region":
        sql = `SELECT value, min(label) AS label FROM (
            SELECT city AS value, concat('Cidade · ', city) AS label
            FROM inventory WHERE status='active'
            UNION ALL
            SELECT neighborhood AS value, concat('Bairro · ', neighborhood) AS label
            FROM inventory WHERE status='active'
          ) regions
          WHERE $1='' OR left(lower(value), length($1))=lower($1)
          GROUP BY value`;
        params = [query];
        break;
      case "customer":
        if (query.length < 2)
          return paginate([], 0, input.page, input.pageSize, {
            type: input.type,
          });
        sql = `SELECT customer_id AS value,
            concat(customer_id, ' · ', serial, ' · ', city, ' / ', neighborhood) AS label
          FROM inventory
          WHERE status='active' AND (
            left(lower(customer_id), length($1))=lower($1)
            OR left(lower(serial), length($1))=lower($1)
          )
          `;
        params = [query];
        break;
      default:
        throw new BadRequestException("Catálogo de agrupamento inválido.");
    }

    const limitPosition = params.length + 1;
    const offsetPosition = params.length + 2;
    const direction = input.sort === "value_desc" ? "DESC" : "ASC";
    const [countResult, result] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM (${sql}) options`,
        params,
      ),
      this.database.query<IncidentOptionRow>(
        `SELECT * FROM (${sql}) options ORDER BY value ${direction}
         LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
        [...params, input.pageSize, (input.page - 1) * input.pageSize],
      ),
    ]);
    return paginate(
      result.rows,
      countResult.rows[0]?.total ?? 0,
      input.page,
      input.pageSize,
      { type: input.type },
    );
  }

  async list(page: number, pageSize: number, sort: string, scopeType = "") {
    const orderBy =
      sort === "opened_at_asc"
        ? "opened_at ASC, incident_id ASC"
        : sort === "opened_at_desc"
          ? "opened_at DESC, incident_id ASC"
          : `CASE status WHEN 'open' THEN 0 WHEN 'mitigating' THEN 1
              WHEN 'monitoring' THEN 2 ELSE 3 END,
            CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
              WHEN 'medium' THEN 2 ELSE 3 END, opened_at DESC`;
    const [countResult, result] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM operational_incidents
         WHERE status IN ('open', 'mitigating', 'monitoring')
           AND ($1='' OR scope->>'type'=$1)`,
        [scopeType],
      ),
      this.database.query<Record<string, unknown>>(
        `
      SELECT incident_id, investigation_id, status, category, severity, title,
        scope, affected_cpes, confidence, probable_cause, recommended_action,
        evidence, opened_at::text, opened_by, approval_note, source,
        origin_ticket_id
      FROM operational_incidents
      WHERE status IN ('open', 'mitigating', 'monitoring')
        AND ($1='' OR scope->>'type'=$1)
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3`,
        [scopeType, pageSize, (page - 1) * pageSize],
      ),
    ]);
    return paginate(
      result.rows,
      countResult.rows[0]?.total ?? 0,
      page,
      pageSize,
    );
  }

  async create(input: CreateIncidentInput) {
    const openedBy = input.openedBy.trim();
    const title = input.title.trim();
    const probableCause = input.probableCause.trim();
    const recommendedAction = input.recommendedAction.trim();
    if (openedBy.length < 2 || openedBy.length > 100) {
      throw new BadRequestException("Informe o responsável do NOC.");
    }
    if (title.length < 5 || title.length > 160) {
      throw new BadRequestException("Informe um título de 5 a 160 caracteres.");
    }
    if (!new Set(["critical", "high", "medium", "low"]).has(input.severity)) {
      throw new BadRequestException("Selecione uma severidade válida.");
    }
    if (probableCause.length < 5 || probableCause.length > 600) {
      throw new BadRequestException(
        "Descreva a causa ou hipótese em 5 a 600 caracteres.",
      );
    }
    if (recommendedAction.length < 5 || recommendedAction.length > 600) {
      throw new BadRequestException(
        "Descreva a próxima ação em 5 a 600 caracteres.",
      );
    }

    const { scope, affected } = await this.resolveScope(input);
    if (affected < 1) {
      throw new BadRequestException(
        "O escopo informado não contém nenhuma CPE ativa.",
      );
    }

    const originTicketId = input.originTicketId?.trim() || null;
    if (originTicketId) {
      const ticket = await this.database.query<{ ticket_id: string }>(
        `SELECT ticket_id FROM tickets
         WHERE ticket_id=$1 AND source='n1'
           AND resolution='Escalado para NOC'
           AND noc_status IN ('pending', 'in_progress')`,
        [originTicketId],
      );
      if (!ticket.rows[0]) {
        throw new NotFoundException(
          "Chamado N1 não encontrado ou já tratado pelo NOC.",
        );
      }
    }

    const incidentId = `INC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const evidence = [
      {
        source: "operator",
        reference: openedBy,
        summary: "Incidente aberto manualmente por um operador do NOC.",
      },
      ...(originTicketId
        ? [
            {
              source: "ticket",
              reference: originTicketId,
              summary: "Chamado N1 usado como origem do incidente.",
            },
          ]
        : []),
    ];
    const result = await this.database.query<Record<string, unknown>>(
      `WITH created AS (
         INSERT INTO operational_incidents(
           incident_id, investigation_id, category, severity, title, scope,
           affected_cpes, confidence, probable_cause, recommended_action,
           evidence, opened_by, approval_note, source, origin_ticket_id
         ) VALUES (
           $1, NULL, 'operator_report', $2, $3, $4, $5, 1,
           $6, $7, $8, $9, NULL, 'manual', $10
         )
         RETURNING *
       ), linked AS (
         UPDATE tickets t
         SET related_problem_id=$1, noc_status='linked',
           closed_at=coalesce(closed_at, now())
         FROM created
         WHERE $10::text IS NOT NULL AND t.ticket_id=$10
         RETURNING t.ticket_id
       )
       SELECT created.*, (SELECT ticket_id FROM linked) AS linked_ticket_id
       FROM created`,
      [
        incidentId,
        input.severity,
        title,
        JSON.stringify(scope),
        affected,
        probableCause,
        recommendedAction,
        JSON.stringify(evidence),
        openedBy,
        originTicketId,
      ],
    );
    return result.rows[0];
  }

  async close(incidentId: string, status: "resolved") {
    if (status !== "resolved") {
      throw new BadRequestException("Encerramento de agrupamento inválido.");
    }
    const normalizedIncidentId = incidentId.trim().toUpperCase();
    const result = await this.database.query<{
      incident_id: string;
      status: "resolved";
    }>(
      `UPDATE operational_incidents
       SET status='resolved'
       WHERE incident_id=$1
         AND status IN ('open', 'mitigating', 'monitoring')
       RETURNING incident_id, status`,
      [normalizedIncidentId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(
        "Agrupamento não encontrado ou já encerrado.",
      );
    }

    return result.rows[0];
  }

  async resolveProposedScope(scope: ProposedIncidentScope) {
    const scopeType: ScopeType =
      scope.type === "network"
        ? scope.cto
          ? "cto"
          : scope.pon
            ? "pon"
            : "olt"
        : scope.type;
    return this.resolveScope({
      openedBy: "agent",
      title: "Proposta do agente",
      severity: "medium",
      scopeType,
      identifier: scope.identifier,
      olt: scope.olt ?? "",
      pon: scope.pon ?? "",
      cto: scope.cto ?? "",
      probableCause: "Proposta pendente de validação humana.",
      recommendedAction: "Validar as evidências antes de atuar.",
      originTicketId: null,
    });
  }

  private async resolveScope(input: CreateIncidentInput) {
    const olt = input.olt.trim().toUpperCase();
    const pon = input.pon.trim();
    const cto = input.cto.trim().toUpperCase();
    const identifier = input.identifier.trim();
    let query = "";
    let params: string[] = [];
    let displayIdentifier = identifier;

    switch (input.scopeType) {
      case "park":
        query =
          "SELECT count(*)::int AS affected FROM inventory WHERE status='active'";
        displayIdentifier = "Todo o parque";
        break;
      case "olt":
        if (!olt) throw new BadRequestException("Informe a OLT afetada.");
        query =
          "SELECT count(*)::int AS affected FROM inventory WHERE status='active' AND olt=$1";
        params = [olt];
        displayIdentifier = olt;
        break;
      case "pon":
        if (!olt || !pon) {
          throw new BadRequestException(
            "Informe a OLT e a porta PON afetadas.",
          );
        }
        query =
          "SELECT count(*)::int AS affected FROM inventory WHERE status='active' AND olt=$1 AND pon_port=$2";
        params = [olt, pon];
        displayIdentifier = `${olt} · PON ${pon}`;
        break;
      case "cto":
        if (!olt || !pon || !cto) {
          throw new BadRequestException(
            "Informe a OLT, a PON e a CTO afetadas.",
          );
        }
        query =
          "SELECT count(*)::int AS affected FROM inventory WHERE status='active' AND olt=$1 AND pon_port=$2 AND cto=$3";
        params = [olt, pon, cto];
        displayIdentifier = `${olt} · PON ${pon} · ${cto}`;
        break;
      case "customer":
        if (!identifier)
          throw new BadRequestException("Informe o cliente ou a CPE.");
        query =
          "SELECT count(*)::int AS affected FROM inventory WHERE status='active' AND (customer_id=$1 OR serial=$1)";
        params = [identifier.toUpperCase()];
        displayIdentifier = identifier.toUpperCase();
        break;
      case "firmware":
        if (!identifier)
          throw new BadRequestException("Informe a versão do firmware.");
        query =
          "SELECT count(*)::int AS affected FROM inventory WHERE status='active' AND software_version=$1";
        params = [identifier];
        break;
      case "equipment":
        if (!identifier)
          throw new BadRequestException(
            "Informe o modelo ou revisão do equipamento.",
          );
        query = `SELECT count(*)::int AS affected FROM inventory
          WHERE status='active'
            AND lower(concat_ws(' ', vendor, model, hw_revision))=lower($1)`;
        params = [identifier];
        break;
      case "region":
        if (!identifier)
          throw new BadRequestException("Informe a cidade ou o bairro.");
        query = `SELECT count(*)::int AS affected FROM inventory
          WHERE status='active'
            AND (lower(city)=lower($1) OR lower(neighborhood)=lower($1))`;
        params = [identifier];
        break;
      default:
        throw new BadRequestException("Selecione um tipo de escopo válido.");
    }

    const result = await this.database.query<CountRow>(query, params);
    return {
      affected: result.rows[0]?.affected ?? 0,
      scope: {
        type: input.scopeType,
        identifier: displayIdentifier,
        olt: olt || null,
        pon: pon || null,
        cto: cto || null,
      },
    };
  }
}
