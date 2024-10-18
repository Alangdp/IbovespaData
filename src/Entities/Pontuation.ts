import { InfoData, PontuationProps } from '../types/Pontuation.type';
import { PontuationRule } from '../types/Pontuation.type';
class Pontuation implements PontuationProps {
  // Identifier
  public id: string;
  public subId?: string;

  // Used on Constructor
  public defaultIfTrue: number;
  public defaultIfFalse: number;
  
  // Points
  public totalPoints: number = 0;
  
  // Rules
  public totalEvaluate: PontuationRule[] = [];

  // Info Data
  infoData: InfoData;
  
  constructor(props: PontuationProps) {
    this.defaultIfFalse = props.defaultIfFalse;
    this.defaultIfTrue = props.defaultIfTrue;
    this.id = props.id;
    this.subId = props.subId;
    this.infoData = props.infoData;
  }

  addRule(rule: PontuationRule) {
    this.totalEvaluate.push(rule);
  }

  calculate() {
    for (const rule of this.totalEvaluate) {
      if (rule.rule) {
        if (rule.ifTrue) this.totalPoints += rule.ifTrue;
        else this.totalPoints += this.defaultIfTrue;
        rule.scored = true;
      }
      if (!rule.rule) {
        if (rule.ifFalse) this.totalPoints -= rule.ifFalse;
        else this.totalPoints -= this.defaultIfFalse;
        rule.scored = false;
      }
    }
  }
}

export { Pontuation };
