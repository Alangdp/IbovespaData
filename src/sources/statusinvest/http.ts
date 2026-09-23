import apiGetter from '../../utils/ApiGetter.js'

// Ponto único de acesso às APIs JSON do statusinvest. Cada consulta desta
// pasta (dividendos, indicadores, preços...) só monta os parâmetros e converte
// a resposta; qualquer falha de rede/HTTP vira `null` (ver ApiGetter).
export const statusInvestApi = apiGetter
