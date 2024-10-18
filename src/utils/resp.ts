import { Response } from '../types/Reponse.type';

// Monta um objeto de Resposta para padronizar as requisições
// EXEMPLO DE RETORNO
// interface Response {
//   status: number;
//   message: string;
//   data: any;
// }

/**
 *
 * @param s StatusCode
 * @param m Message
 * @param d Data
 * @param err Error
 * @example {status: s, msg: m, data: data | error, }
 */
export const resp = (s: number, m: string, d: any, err?: any): Response => {
  if (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return {
        status: 400,
        message: 'Unique constraint error',
        data: { msg: err.errors[0].message, field: err.errors[0].path },
      };
    }
  }

  return {
    status: s,
    message: m,
    data: d,
  };
};

