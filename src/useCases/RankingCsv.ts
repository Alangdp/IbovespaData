import { PontuationProps, PontuationRule } from "../types/Pontuation.type";
import Json from "../utils/Json";
import fs from "fs";

interface IPontuationService {
  createPontuationInstances(pontuationData: Record<string, PontuationProps>): string;
}

class PontuationService implements IPontuationService {
  private readonly rules: string[] = [
    'Média do Dividend Yield nos últimos 5 anos > 0.06 (5%)',
    'Mediana do Dividend Yield nos últimos 5 anos > 0.06 (5%)',
    'Dividend Yield Atual > 0.06 (6%)',
    'Dívida Bruta/Patrimônio < 0.5 (50%)',
    'Pagamento constante de dividendos nos últimos 5 anos',
    'Dividendos crescentes nos últimos 5 anos',
    '0 < Payout < 1',
    'Preço Atual < Preço Máximo',
    'Segmento válido'
  ];

  public createPontuationInstances(pontuationData: Record<string, PontuationProps>): string {
    let csv = "Pontuation ID,Total Points," + this.rules.join(",") + "\n";
  
    Object.keys(pontuationData).forEach(key => {
      const instance = pontuationData[key];
      csv += `${instance.id},${instance.totalPoints}`;
  
      this.rules.forEach(ruleName => {
        const rule = instance.totalEvaluate.find(rule => rule.ruleName === ruleName);
        if (rule) {
          csv += `,${rule.scored ? rule.ifTrue : '-' + rule.ifFalse}`;
        } else {
          csv += `,0`;
        }
      });
  
      csv += '\n';
    });
    
    return csv;
  }
}

class FileService {
  public static readJSONFromFile(filePath: string): Record<string, PontuationProps> {
    return Json.readJSONFromFile(filePath);
  }

  public static writeToFile(filePath: string, data: string): void {
    fs.writeFileSync(filePath, data);
  }
}

// Usage
const pontuationData = FileService.readJSONFromFile("Ranking.json");
const pontuationService = new PontuationService();
const csvData = pontuationService.createPontuationInstances(pontuationData);
FileService.writeToFile("Ranking.csv", csvData);
