export type SRMods = 'nm' | 'ht' | 'dt';

export type SRValues = Record<SRMods, number>;

export type StarRatingsResult = {
  sr: SRValues;
  xxy: SRValues;
};

export type SRWorkerApi = {
  calculate(beatmapContent: string): Promise<SRValues>;
};

export const clockRates: Record<SRMods, number> = {
  nm: 1,
  ht: 0.75,
  dt: 1.5,
};

export const emptySRValues = (): SRValues => ({
  nm: 0,
  ht: 0,
  dt: 0,
});