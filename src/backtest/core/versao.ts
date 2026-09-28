/**
 * Identifica o código que gerou um resultado: commit do git e se havia
 * alterações não commitadas (para reproduzir depois)
 *
 * @returns Ex.: `a1b2c3d` ou `a1b2c3d+alterado`; `desconhecido` fora do git
 */
export function versaoCodigo(): string {
  try {
    const commit = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'])
    // Se não está num repositório git
    if (commit.exitCode !== 0) {
      return 'desconhecido'
    }
    const status = Bun.spawnSync(['git', 'status', '--porcelain', '--', 'src'])
    const alterado = status.stdout.toString().trim().length > 0
    return `${commit.stdout.toString().trim()}${alterado ? '+alterado' : ''}`
  } catch {
    return 'desconhecido'
  }
}
