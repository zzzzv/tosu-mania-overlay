let token: string | null = null;

const auth = async (clientId: string, clientSecret: string) => {
  const body = `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&scope=public`;

  const resp = await fetch('https://osu.ppy.sh/oauth/token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!resp.ok) {
    throw new Error(`Failed to authenticate: ${resp.status} ${resp.statusText}`);
  }
  const json = await resp.json();
  token = json.access_token;
}

const getScore = async (mode: string, scoreId: number) => {
  if (!token) {
    throw new Error('Not authenticated. Call auth() first.');
  }
  const resp = await fetch(`https://osu.ppy.sh/api/v2/scores/${mode}/${scoreId}/download`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  return await resp.arrayBuffer();
}

export const osuApi = {
  auth,
  getScore,
}