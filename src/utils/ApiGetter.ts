import axios from 'axios';
import { AxiosOptions } from '../types/AxiosOptions.type';
import { AxiosUtils } from './Axios.Utils.js';
import { MainPrices } from '../types/prices.type';

export default async function apiGetter<T>(
  axiosParams: AxiosOptions,
  finalUrl: string
): Promise<T | null> {
  try {
    const options = AxiosUtils.makeOptionsJson(axiosParams, finalUrl);

    const response = await axios.request(options);
    const responseData: T = response.data;

    return responseData;
  } catch (error) {
    return null;
  }
}
