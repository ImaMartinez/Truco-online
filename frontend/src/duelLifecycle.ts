export interface GameSummary {
 id:string;turn:number;status:string;reason:string|null;startedAt:string;
 winnerPosition?:number|null;ownPosition?:number;cpuDifficulty?:string;
 room?:{id:string;code:string;status:string};
}
export const cpuClosureMessage='La partida contra la computadora se cerrará como abandonada y la CPU ganará. Tu historial se conservará.';
