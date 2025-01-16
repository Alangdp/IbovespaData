export type Data = {
  ticker: string
  indicators: {
    [key: string]: {
      actual: number
    }
  }
}

export interface ComparatorProps {
  arrayToCompare: Data[]
}

export type ArrayWithKeyValue = {
  [key: string]: Array<number | string>
}
