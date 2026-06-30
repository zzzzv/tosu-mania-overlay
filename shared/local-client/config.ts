export const config = {
  baseUrl: 'http://localhost:5048',
};

export interface ServerStatus {
  version: string;
  lazer: {
    available: boolean;
    clientRealmPath: string;
  };
  stable: {
    available: boolean;
    osuRootPath: string;
  };
  apiv2: {
    configured: boolean;
    tokenValid: boolean;
    clientId: string;
  };
}

export async function getStatus(): Promise<ServerStatus> {
  const res = await fetch(`${config.baseUrl}/api/status`);
  if (!res.ok) throw new Error(`Status error: ${res.status} ${res.statusText}`);
  return res.json();
}
