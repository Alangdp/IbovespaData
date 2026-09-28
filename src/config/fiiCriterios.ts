/**
 * Limites dos critérios de qualidade dos FIIs (diversificado,
 * boa_localizacao), num lugar só para calibrar
 *
 * Ao mudar um valor, aumente o `CACHE_VERSION` de fundoDataBase.ts (e o
 * `DATA_VERSION` de cvmDataBase.ts se o critério for de localização), para o
 * cache antigo deixar de ser usado
 */
export const CRITERIOS = {
  diversificado: {
    tijolo: {
      /** Mínimo de imóveis no último informe trimestral */
      minImoveis: 5,
      /** Maior participação de um imóvel na receita (ou na área), em % */
      maxParticipacao: 30,
      /** Mínimo de estados diferentes */
      minEstados: 2,
    },
    papel: {
      /** Mínimo de CRIs/CRAs na carteira */
      minAtivos: 10,
      /** Maior CRI/CRA sobre o patrimônio líquido, em % */
      maxParticipacaoPl: 15,
    },
    fof: {
      /** Mínimo de FIIs na carteira */
      minAtivos: 10,
      /** Maior FII sobre o patrimônio líquido, em % */
      maxParticipacaoPl: 20,
    },
  },
  localizacao: {
    /** Mínimo de imóveis para a vacância média de uma cidade valer */
    minImoveisCidade: 3,
    /** Mínimo de fundos diferentes na cidade (evita um fundo só com vários galpões no mesmo endereço) */
    minFundosCidade: 2,
    /** Parte da área do fundo que precisa estar em cidades boas, em % */
    minAreaBoa: 60,
    /** Parte da área que precisa ter cidade classificada para o resultado valer, em % */
    minAreaClassificada: 50,
    /** Plano B (IBGE): população mínima para a cidade contar como boa */
    minPopulacao: 500_000,
  },
} as const

/** Capital de cada UF, para o plano B do IBGE (região metropolitana de capital) */
export const CAPITAIS: Record<string, string> = {
  AC: 'Rio Branco',
  AL: 'Maceió',
  AP: 'Macapá',
  AM: 'Manaus',
  BA: 'Salvador',
  CE: 'Fortaleza',
  DF: 'Brasília',
  ES: 'Vitória',
  GO: 'Goiânia',
  MA: 'São Luís',
  MT: 'Cuiabá',
  MS: 'Campo Grande',
  MG: 'Belo Horizonte',
  PA: 'Belém',
  PB: 'João Pessoa',
  PR: 'Curitiba',
  PE: 'Recife',
  PI: 'Teresina',
  RJ: 'Rio de Janeiro',
  RN: 'Natal',
  RS: 'Porto Alegre',
  RO: 'Porto Velho',
  RR: 'Boa Vista',
  SC: 'Florianópolis',
  SP: 'São Paulo',
  SE: 'Aracaju',
  TO: 'Palmas',
}
