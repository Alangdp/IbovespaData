import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Não existe funções ou váriavies em interfaces Typescript
// Logo torna inviável a criação de um Protocol para a classe de Jsons
// FIXME Revisar SOLID mais tarde
export default class Json {
  static readJSONFromFile(filename: string) {
    const absolutePath = path.resolve(__dirname,'..', '..', 'json', filename);
    try {
      const jsonData = fs.readFileSync(absolutePath, 'utf8');
      return JSON.parse(jsonData);
    } catch (err) {
      console.error('Erro ao ler o arquivo JSON:', err);
      return null;
    }
  }

  static saveJSONToFile(jsonData: Array<any> | any, filename: string) {
    const absolutePath = path.resolve(__dirname, '..', '..', 'json', filename);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    fs.writeFile(
      absolutePath,
      JSON.stringify(jsonData, null, 2),
      'utf8',
      (err) => {
        if (err) {
          console.error(err);
          return;
        }
      }
    );
  }
}
