export type AgentGrants = { documentIds: string[]; write: boolean; create: boolean; libraryRead: boolean; render: boolean };
export type AgentConnection = { id: string; name: string; revoked: boolean; grants: AgentGrants; createdAt: string };
export type AgentSettings = { workspaceId: string; enabled: boolean; port: number; connections: AgentConnection[]; running: boolean; endpoint: string; error?: string };
