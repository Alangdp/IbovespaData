import Database from "./JsonDatabase";

export default class CacheJSON<T, Y extends CacheProps<T>> extends Database<Y> {
  private duration: number; // Time in Minutes

  constructor({ duration, path }: CacheJSONProps) {
    super(path);
    this.duration = duration * 60 * 10 * 10 * 10;
  }

  replaceData(data: T, key: string) {
    const cache: CacheProps<T> = {
      key,
      data: [data],
      instanceTime: new Date().getTime()
    }

    this.clear();
    this.add(cache as Y);
    this.commit();
  }

  validDuration() {
    const cacheData = this.get();
    if (cacheData.length === 0) return false;
    const firstCacheItem = cacheData[0];
    if (firstCacheItem.instanceTime && (new Date().getTime() - firstCacheItem.instanceTime ) < this.duration) return true;
    return false;
  }
}