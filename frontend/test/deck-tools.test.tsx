import test from 'node:test';
import assert from 'node:assert/strict';
import { randomDeck } from '../src/randomDeck';
import { visiblePlayers, isTestName } from '../src/playerDirectory';
import {isComputerDeck,playerDecks,COMPUTER_DECK_DESCRIPTION} from '../src/deckDirectory';
import { PlayerOptions } from '../src/components/PlayerOptions';
import { renderToStaticMarkup } from 'react-dom/server';
import catalog from '../../backend/src/demo/catalog.json';
import type { Card } from '../../shared/contracts';

test('automatic PC deck snapshots are separate from player decks without hiding personal PC names',()=>{
 const automatic={id:'cpu',name:'PC · 11111111-1111-4111-8111-111111111111',description:COMPUTER_DECK_DESCRIPTION,entries:[]};
 const personal={...automatic,id:'personal',description:'Mi mazo personal'};
 const namedPC={...automatic,id:'pc-name',name:'Mazo PC favorito'};
 const list=[automatic,personal,namedPC];const before=structuredClone(list);
 assert.equal(isComputerDeck(automatic),true);assert.equal(isComputerDeck(personal),false);assert.equal(isComputerDeck(namedPC),false);
 assert.deepEqual(playerDecks(list).map(deck=>deck.id),['personal','pc-name']);assert.deepEqual(list,before);
});
const cards = catalog.cards as Card[];

test('the connected player stays visible regardless of alias and is the only offered identity',()=>{
 for(const alias of ['Prueba','test-123','Ana demo SQL','Academia TA v1 Jugador 01']){
  const currentPlayer={id:'self',alias};
  const html=renderToStaticMarkup(<PlayerOptions players={[{id:'other',alias:'Otro jugador'},currentPlayer]} currentPlayer={currentPlayer}/>);
  assert.ok(html.includes(alias));
  assert.equal((html.match(/<option\b/g)??[]).length,1);
  assert.ok(!html.includes('Otro jugador')&&!html.includes('No hay jugadores disponibles'));
 }
});

test('random deck selects twenty available copies without mutating the catalog or exceeding two copies', () => {
 const before=JSON.stringify(cards);
 const quantities=Object.fromEntries(cards.map((card,i)=>[card.id,i<4?0:i===4?1:8]));
 for(let n=0;n<100;n++){
  const entries=randomDeck(cards,quantities);
  assert.equal(entries.reduce((sum,e)=>sum+e.quantity,0),20);
  assert.equal(new Set(entries.map(e=>e.cardId)).size,entries.length);
  for(const entry of entries) assert.ok(entry.quantity>0 && entry.quantity<=Math.min(2,quantities[entry.cardId]!));
 }
 assert.equal(JSON.stringify(cards),before);
 assert.throws(()=>randomDeck(cards,{}),/veinte cartas/);
 assert.throws(()=>randomDeck(cards,{[cards[0]!.id]:30}),/veinte cartas/);
 assert.equal(randomDeck(cards,undefined,()=>0).reduce((s,e)=>s+e.quantity,0),20);
});

test('player directory hides fixtures, groups demos and sorts normal aliases without deleting or hiding similar real names',()=>{
 const players=[{id:'1',alias:'test-123'},{id:'2',alias:'Ana demo SQL'},{id:'3',alias:'Zoe'},{id:'4',alias:'Álvaro'},
 {id:'5',alias:'PRUEBA uno'},{id:'6',alias:'UI Ana abc123ef'},{id:'7',alias:'Testa'},{id:'8',alias:'Combate Bruno 12abcdef'},
 {id:'9',alias:'combate-02a159b2-e5f9-4e48-923c-4'},{id:'10',alias:'Academia TA v1 Jugador 01'}];
 const visible=visiblePlayers(players);
 assert.deepEqual(visible.map(p=>p.id),['4','2','7','3']);
 assert.equal(players.length,10);
 assert.equal(isTestName('Pruebas_demo'),true);assert.equal(isTestName('Prudencia'),false);
 const html=renderToStaticMarkup(<select><PlayerOptions players={players}/></select>);
 assert.match(html,/label="Jugadores"/);assert.match(html,/label="Demostración"/);
 assert.ok(!html.includes('test-123')&&!html.includes('UI Ana'));
});
