import { config } from './config';

export async function downloadReplay(
  scoreId: number,
  modeName?: string,
): Promise<ArrayBuffer> {
  const url = `${config.baseUrl}/api/osuapi/v2/scores/${modeName ? `${modeName}/` : ''}${scoreId}/download`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Failed to download replay via osu! API v2: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
    );
  }
  return await res.arrayBuffer();
}
