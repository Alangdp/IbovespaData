import { DataToUse, segmentBreaks } from '../types/Segment.type';

export abstract class SegmentProtocol {
  abstract getSegmentsList(
    listNumber: number
  ): Promise<DataToUse[] | undefined>;
  abstract formatData(segments: DataToUse[]): segmentBreaks;
  abstract execute(): void;
}
