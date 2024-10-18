type ChartsDefault = {
  [key: string]: {
    value: number;
    label: string;
  };
};

type StocKPropTemp = {
  ticker: string;
  dividendsChart: ChartsDefault;
  p_vp: ChartsDefault;
  p_l: ChartsDefault;
  roe: ChartsDefault;
  roa: ChartsDefault;
  liquid_margin: ChartsDefault;
  liquid_debit_ebitda: ChartsDefault;
  current_liquidity: ChartsDefault;
};
