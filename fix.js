// Corrige automaticamente imports de arquivos JS/TS para bater com o case correto
import fs from 'fs';
import path from 'path';

/**
 * Retorna o nome do arquivo no sistema com case correto
 */
function resolveCorrectCase(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir);
  const match = files.find(f => f.toLowerCase() === base.toLowerCase());
  if (!match) return null;
  return path.join(dir, match);
}

/**
 * Processa um arquivo JS/TS e corrige os imports
 */
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const regex = /(import .* from ['"](.+?)['"];?|require\(['"](.+?)['"]\))/g;
  let modified = false;

  content = content.replace(regex, (match, importStmt, imp1, imp2) => {
    const imp = imp1 || imp2;
    if (!imp.startsWith('.')) return match; // ignora módulos do node

    const ext = path.extname(imp) ? '' : '.js'; // assume js se não tiver extensão
    const resolved = resolveCorrectCase(path.resolve(path.dirname(filePath), imp + ext));

    if (resolved) {
      const relative = './' + path.relative(path.dirname(filePath), resolved).replace(/\\/g, '/');
      modified = true;
      if (importStmt) return importStmt.replace(imp, relative.replace(/\.js$/, ''));
      return `require('${relative.replace(/\.js$/, '')}')`;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Corrigido: ${filePath}`);
  }
}

/**
 * Varre recursivamente o diretório
 */
function fixDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) fixDir(fullPath);
    else if (file.endsWith('.js') || file.endsWith('.ts')) fixFile(fullPath);
  });
}

// Rodar no diretório src ou outro
fixDir('./src');
