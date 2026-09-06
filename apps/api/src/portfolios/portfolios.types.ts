export type PortfolioResponse = {
  id: string;
  name: string;
  version: number;
  visibility: 'PRIVATE' | 'PUBLIC' | 'FOLLOWERS_ONLY';
  shareMode: 'FULL' | 'ALLOCATION_ONLY' | 'HIDDEN';
  createdAt: Date;
  updatedAt: Date;
};
