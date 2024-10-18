interface RootCashFlow {
  success: boolean;
  data: Data;
}

interface Data {
  years: number[];
  grid: Grid[];
  chart: any[];
}

interface Grid {
  isHeader: boolean;
  row: number;
  spaces: number;
  columns: Column[];
  reverse: boolean;
  emptyLine: boolean;
  highlight: boolean;
  article?: string;
  gridLineModel?: GridLineModel;
}

interface Column {
  value: string;
  hide: boolean;
  hasColor: boolean;
  ignoreReverse: boolean;
  timeType: number;
  lastTwelveMonths: boolean;
  name?: string;
  title?: string;
  symbol?: string;
}

interface GridLineModel {
  key: string;
  name: string;
  values: number | undefined[];
  ranks: any[];
  emptyLine: boolean;
  spaces: number;
  reverse: boolean;
  format: string;
  highlight: boolean;
  article: string;
  financialType?: number;
}

export { RootCashFlow };
