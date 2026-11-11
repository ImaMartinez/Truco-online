import type {DemoPlayer} from '../../../shared/contracts';
import {Icon} from './Icon';
import {EnergyCounter,LifeCounter} from './PlayerPanel';
import {DrawPile} from './DrawPile';
import type {ReactNode} from 'react';

export function ArenaIndicators({actor,rival,previewCost,actions}:{actor:DemoPlayer;rival:DemoPlayer;previewCost:number;actions?:ReactNode}){
 const rows=[{player:rival,label:'Rival',rival:true},{player:actor,label:'Vos',rival:false}];
 return <div className="indicator-cards" aria-label="Indicadores de la partida">
  <section className="indicator-card indicator-lives"><h2><Icon name="heart"/>Vidas</h2>{rows.map(({player,label,rival})=><div className="indicator-row" key={player.id} data-indicator-player={player.id}><span>{label}</span><LifeCounter player={player} reverse={rival}/></div>)}</section>
  <div className="indicator-middle">
  <section className="indicator-card indicator-energy"><h2><Icon name="spark"/>Energía</h2>{rows.map(({player,label,rival})=><div className="indicator-row" key={player.id} data-energy-player={player.id}><span>{label}</span><EnergyCounter value={player.energy} maximum={player.maxEnergy} preview={rival?0:previewCost}/></div>)}</section>
  <section className="indicator-card indicator-decks"><h2><Icon name="deck"/>Mazo restante</h2>{rows.map(({player,label,rival})=><div className="indicator-row" key={player.id}><span>{label}</span><DrawPile playerId={player.id} count={player.deckCount} name={player.name} rival={rival}/></div>)}</section>
  <section className="indicator-card indicator-hands"><h2><Icon name="cards"/>Mano</h2>{rows.map(({player,label})=><div className="indicator-row" key={player.id}><span>{label}</span><strong>{player.hand.length}</strong></div>)}</section>
  <section className="indicator-card indicator-discards"><h2><Icon name="cards"/>Descartes</h2>{rows.map(({player,label})=><div className="indicator-row" key={player.id}><span>{label}</span><strong>{player.discardCount}</strong></div>)}</section>
  </div>
  <div className="indicator-footer">
  <section className="indicator-card indicator-draw"><h2><Icon name="deck"/>Por robar</h2>{rows.map(({player,label})=><div className="indicator-row" key={player.id}><span>{label}</span><strong>{player.deckCount}</strong></div>)}<p>Robo automático según el turno.</p></section>
  <div className="indicator-actions">{actions}</div>
  </div>
 </div>;
}
