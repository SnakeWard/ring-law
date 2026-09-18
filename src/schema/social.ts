export const SOCIAL_LAW = {
  version: 1,
  frozenAt: "2026-09-18",
  evidence: "assumed" as const,
  presenceTtlS: 45,
  heartbeatS: 20,
  searchCap: 40,
  deferred: ["Party chat", "Block list"],
} as const;

export type OnlinePilot = {
  userId: string;
  name: string;
  online: boolean;
};

export type LobbyInvite = {
  id: string;
  fromId: string;
  fromName: string;
  code: string;
};

export type OpenLobbyRow = {
  code: string;
  hostName: string;
  tier: number;
  format: string;
  mapId: string;
  humans: number;
};
