interface CacheProps<T> {
  key: string;
  data: T[];
  instanceTime: number
}

interface CacheJSONProps {
  path: string;
  duration: number;
}
