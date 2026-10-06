-- O ID é estável enquanto o serial da CPE existir. O prefixo L-DROP deixa
-- explícito que se trata de uma relação lógica, não de uma etiqueta física.
TRUNCATE generated_logical_drops;

INSERT INTO generated_logical_drops (
  drop_id,
  serial,
  customer_id,
  olt,
  pon_port,
  cto,
  source,
  confidence
)
SELECT
  'L-DROP-' || serial,
  serial,
  customer_id,
  olt,
  pon_port,
  cto,
  'generated_from_inventory',
  'estimated'
FROM inventory
WHERE status = 'active';
