import { RequestHandler } from 'express';
import { errorResponse, response } from '../utils/Responses';
import TickerFetcher from '../useCases/Fetcher';
import { HomeItens } from '../types/HomeItens.type';
import CacheJSON from '../utils/CacheJson';
import { downloadImage } from 'plotly.js';

const getVariations: RequestHandler = async (req, res, next) => {
  async function updateCache(
    cache: CacheJSON<HomeItens, CacheProps<HomeItens>>
  ) {
    const variations = await TickerFetcher.getHighsAndLows();
    if (!variations) throw new Error('Error Getting Variations');
    cache.replaceData(variations, 'HomeItems');
  }

  try {
    const cache = new CacheJSON<HomeItens, CacheProps<HomeItens>>({
      duration: 60,
      path: './json/HomeCache.json',
    });

    if (!cache.validDuration()) {
      const cachedData = cache.get();
      if (
        cachedData.length > 0 &&
        cachedData[0].data &&
        cachedData[0].data[0]
      ) {
        response(res, { status: 200, data: cachedData[0].data[0] });
        await updateCache(cache);
        return;
      }

      await updateCache(cache);
    }

    return response(res, { status: 200, data: cache.get()[0].data[0] });
  } catch (error: any) {
    return errorResponse(res, error);
  }
};

export { getVariations };
