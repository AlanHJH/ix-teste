import { PhysicalTopology } from "./PhysicalTopology";

export function TopologyMap({ onOpenNoc }: { onOpenNoc?: () => void }) {
  return (
    <section className="topology-page">
      <PhysicalTopology onOpenNoc={onOpenNoc} />
    </section>
  );
}
