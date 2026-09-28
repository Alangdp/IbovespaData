// Executado antes de qualquer teste (ver bunfig.toml).
// Fixa o fuso: DateFormatter usa `new Date(ano, mes, dia)` (hora local), então
// o resultado serializado dependeria da máquina que roda os testes.
process.env.TZ = 'America/Sao_Paulo'
