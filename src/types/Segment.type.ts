export interface Root {
  success: boolean;
  data: SegmentData[];
}

export interface Segment {
  segmentFinal: string;
}

export interface SegmentData {
  categoryId: number;
  companyId: number;
  companyName: string;
  ticker: string;
  sectorName: string;
  subSectorName: string;
  segmentName: string;
  categoryName: string;
}

export interface segmentBreaks {
  [sectorName: string]: {
    [subSectorName: string]: string[];
  };
}

export type DataToUse = Omit<SegmentData, 'categoryId' | 'companyId'>;
