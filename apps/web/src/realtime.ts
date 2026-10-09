import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { loadAccessToken } from "./auth";

export type ScreenUpdateDomain =
  | "dashboard"
  | "tickets"
  | "incidents"
  | "investigations"
  | "network"
  | "customers"
  | "inventory"
  | "diagnostics"
  | "telemetry"
  | "operations";

export type ScreenUpdate = {
  domain: ScreenUpdateDomain;
  entityType?: "noc-group" | "ticket";
  entityId?: string;
  action: "created" | "updated" | "deleted";
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  occurredAt: string;
  source: "rest";
};

export function connectScreenUpdates(
  onUpdate: (update: ScreenUpdate) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const socket = io(window.location.origin, {
    path: "/socket.io",
    auth: { accessToken: loadAccessToken() },
    transports: ["websocket", "polling"],
  });
  socket.on("screen:data-updated", onUpdate);

  return () => {
    socket.off("screen:data-updated", onUpdate);
    socket.disconnect();
  };
}

export function useScreenDataUpdates(
  domains: readonly ScreenUpdateDomain[],
): number {
  const [revision, setRevision] = useState(0);
  const domainKey = domains.join(",");

  useEffect(() => {
    const accepted = new Set(domains);
    function handle(event: Event) {
      const update = (event as CustomEvent<ScreenUpdate>).detail;
      if (!update || !accepted.has(update.domain)) return;
      setRevision((current) => current + 1);
    }
    window.addEventListener("ondaluz:screen-data-updated", handle);
    return () =>
      window.removeEventListener("ondaluz:screen-data-updated", handle);
  }, [domainKey]);

  return revision;
}
