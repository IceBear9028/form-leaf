export type AgentGrants = { documentIds: string[]; write: boolean; create: boolean; libraryRead: boolean; render: boolean };
export type AgentConnection = { id: string; name: string; revoked: boolean; grants: AgentGrants; createdAt: string };
export type AgentSettings = { workspaceId: string; enabled: boolean; port: number; connections: AgentConnection[]; running: boolean; endpoint: string; error?: string };

export type AgentOperationSummary = {
  credentialId: string; connectionName: string; requestId: string;
  tool: "create_document" | "apply_operations" | "export_pdf";
  status: "pending" | "completed" | "failed" | "recovery_required";
  outcome: "not_committed" | "committed" | "unknown";
  acceptedAt?: string; accessible: boolean; documentId?: string; documentName?: string; revision?: string;
  persisted?: boolean; uiSynced?: boolean; errorCode?: string;
  artifact?: { artifactId: string; filename: string; expiresAt: string; byteSize: number; available: boolean };
};
