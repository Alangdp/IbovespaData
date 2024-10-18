export interface ResponseProps<T> {
  status: number;
  data?: T;
  errors?: ErrorResponse[];
}

export interface ErrorResponse {
  message: string;
  data?: any;
}

