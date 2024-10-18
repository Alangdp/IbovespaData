export interface AxiosOptions {
  method: 'POST' | 'GET';
  url?: string;
  data?: object | string;
  params?: object | string;
  headers: {
    'Content-Type'?: 'application/x-www-form-urlencoded' | 'application/json';
    cookie?: string;
    'user-agent'?: string;
  };
}