import WebSocketManager from '@/lib/socket'
import { tosuApi } from '@/api';
import { parseBeatmap } from '@/lib/parsers';
import { updateHist, updateNps } from './charts';

const socket = new WebSocketManager(window.location.host);

const cache = {
    checksum: '',
};

socket.api_v2(async (data: any) => {
  try {
    if (cache.checksum !== data.beatmap.checksum && data.state.number === 5) {
      cache.checksum = data.beatmap.checksum;
      console.log(data);
      
      const text = await tosuApi.getCurrentBeatmap();
      const beatmap = parseBeatmap(text);
      updateHist(beatmap);
      updateNps(beatmap);
    }
  } catch (error) {
    console.log(error);
  };
}, []);