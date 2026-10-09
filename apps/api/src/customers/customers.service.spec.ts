import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  incidentMatchesEquipment,
  CustomersService,
} from "./customers.service";

const equipment = {
  serial: "KSTL-001",
  customer_id: "C123456",
  vendor: "Kestrel",
  model: "KX-3000",
  hw_revision: "B",
  software_version: "2.4.1",
  plan_mbps: 500,
  previous_plan_mbps: 300,
  plan_since: "2026-07-20",
  olt: "OLT-2",
  pon_port: "1/7",
  cto: "CTO-JA-07",
  city: "Florianópolis",
  neighborhood: "Jardim Aurora",
};

describe("incidentMatchesEquipment", () => {
  it("encontra cliente dentro de um incidente de PON", () => {
    assert.equal(
      incidentMatchesEquipment(
        {
          incident_id: "INC-12345678",
          title: "Falha compartilhada",
          severity: "high",
          scope: {
            type: "pon",
            identifier: "OLT-2 · PON 1/7",
            olt: "OLT-2",
            pon: "1/7",
          },
        },
        equipment,
      ),
      true,
    );
  });

  it("não vincula uma PON vizinha", () => {
    assert.equal(
      incidentMatchesEquipment(
        {
          incident_id: "INC-87654321",
          title: "Falha em outra porta",
          severity: "high",
          scope: {
            type: "pon",
            identifier: "OLT-2 · PON 1/8",
            olt: "OLT-2",
            pon: "1/8",
          },
        },
        equipment,
      ),
      false,
    );
  });

  it("encontra grupo lógico pela versão de firmware", () => {
    assert.equal(
      incidentMatchesEquipment(
        {
          incident_id: "INC-AABBCCDD",
          title: "Regressão de firmware",
          severity: "critical",
          scope: { type: "firmware", identifier: "Kestrel 2.4.1" },
        },
        equipment,
      ),
      true,
    );
  });

  it("vincula o N1 a todos os escopos de agrupamento suportados", () => {
    const scopes = [
      { type: "park", identifier: "Todo o parque" },
      { type: "olt", identifier: "OLT-2" },
      {
        type: "pon",
        identifier: "OLT-2 · PON 1/7",
        olt: "OLT-2",
        pon: "1/7",
      },
      {
        type: "cto",
        identifier: "OLT-2 · PON 1/7 · CTO-JA-07",
        olt: "OLT-2",
        pon: "1/7",
        cto: "CTO-JA-07",
      },
      { type: "customer", identifier: "C123456" },
      { type: "firmware", identifier: "2.4.1" },
      { type: "equipment", identifier: "Kestrel KX-3000 B" },
      { type: "region", identifier: "Jardim Aurora" },
    ];

    for (const [index, scope] of scopes.entries()) {
      assert.equal(
        incidentMatchesEquipment(
          {
            incident_id: `INC-SCOPE-${index}`,
            title: `Agrupamento ${scope.type}`,
            severity: "high",
            scope,
          },
          equipment,
        ),
        true,
        `o escopo ${scope.type} deveria alcançar o cliente`,
      );
    }
  });
});

describe("CustomersService.offlineAlerts", () => {
  it("prioriza o último sinal e preserva o contexto para o diagnóstico", async () => {
    const service = new CustomersService({
      query: async (sql: string) => {
        if (sql.includes("count(*)")) return { rows: [{ total: 1 }] } as never;
        return {
          rows: [
            {
              customer_id: "C198410",
              serial: "TUIM03210A02",
              vendor: "Tuim",
              model: "TW-AC12",
              city: "Serra Alta",
              neighborhood: "Jardim Aurora",
              olt: "OLT-2",
              pon_port: "1/8",
              cto: "CTO-2-18-03",
              ticket_id: "TN1-F3187553",
              opened_at: "2026-10-07T01:05:34.000Z",
              description: "Cliente sem acesso.",
              resolution: "Escalado para NOC",
              closed_at: "2026-10-07T01:05:34.000Z",
              noc_status: "closed",
              alert_status: "in_noc",
            },
          ],
        } as never;
      },
    });

    const response = await service.offlineAlerts(1, 8, "alert_desc");
    assert.deepEqual(response, {
      data: [
        {
          customer_id: "C198410",
          serial: "TUIM03210A02",
          vendor: "Tuim",
          model: "TW-AC12",
          city: "Serra Alta",
          neighborhood: "Jardim Aurora",
          network: "OLT-2 · PON 1/8 · CTO-2-18-03",
          ticket_id: "TN1-F3187553",
          reported_at: "2026-10-07T01:05:34.000Z",
          description: "Cliente sem acesso.",
          resolution: "Escalado para NOC",
          alert_status: "in_noc",
          confirmed_offline: false,
        },
      ],
      page: 1,
      pageSize: 8,
      totalItems: 1,
      totalPages: 1,
    });
  });
});
