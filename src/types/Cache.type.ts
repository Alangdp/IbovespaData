export interface CacheProps<T> {
  key: string
  data: T[]
  instanceTime: number
}

export interface CacheJSONProps {
  path: string
  duration: number
}
