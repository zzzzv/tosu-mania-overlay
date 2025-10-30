const getCurrentBeatmap = async () => {
  const response = await fetch('/api/v2/files/beatmap/file');
  return await response.text();
}

export const tosuApi = {
  getCurrentBeatmap,
}