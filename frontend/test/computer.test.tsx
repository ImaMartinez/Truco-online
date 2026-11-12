import test from 'node:test';
import assert from 'node:assert/strict';
import {computerAction,type Difficulty} from '../src/computer';
import type {Card,DuelState} from '../../shared/contracts';
import {createApp} from '../../backend/src/app';
import {once} from 'node:events';
import catalog from '../../backend/src/demo/catalog.json';
const cards:Card[]=[{id:'a',attack:4,health:3,cost:1,name:'A',suit:'oros',number:1,hierarchy:1},{id:'b',attack:2,health:2,cost:5,name:'B',suit:'oros',number:2,hierarchy:2}];
function state():DuelState{return {id:'qa',version:1,turn:4,activePlayerId:'pc',status:'active',winnerId:null,mode:'demo',scenario:'inicio',log:[],players:[{id:'human',name:'Vos',life:4,energy:2,maxEnergy:2,hand:[],field:[],deckCount:0,discardCount:0},{id:'pc',name:'PC',life:20,energy:1,maxEnergy:2,hand:[{id:'hand-a',cardId:'a',health:3,enteredTurn:0,lastAttackTurn:null},{id:'hand-b',cardId:'b',health:2,enteredTurn:0,lastAttackTurn:null}],field:[],deckCount:0,discardCount:0}]};}
test('all difficulties spend only available energy and stop when no actions remain',()=>{
 for(const difficulty of ['facil','normal','dificil'] as Difficulty[]){const s=state();assert.deepEqual(computerAction(s,cards,difficulty,()=>0),{type:'play',instanceId:'hand-a'});s.players[1].energy=0;assert.deepEqual(computerAction(s,cards,difficulty),{type:'endTurn'});}
});
test('hard mode takes lethal hero damage, respects field protection, summoning delay and one attack per turn',()=>{
 const s=state();s.players[1].field=[{id:'attacker',cardId:'a',health:3,enteredTurn:2,lastAttackTurn:null}];
 assert.deepEqual(computerAction(s,cards,'dificil'),{type:'attack',attackerId:'attacker',targetId:'hero'});
 s.players[0].field=[{id:'defender',cardId:'a',health:1,enteredTurn:1,lastAttackTurn:null}];
 assert.deepEqual(computerAction(s,cards,'dificil'),{type:'attack',attackerId:'attacker',targetId:'defender'});
 s.players[1].energy=0;s.players[1].field[0]!.lastAttackTurn=4;
 assert.deepEqual(computerAction(s,cards,'dificil'),{type:'endTurn'});
 s.players[1].field[0]!.lastAttackTurn=null;s.players[1].field[0]!.enteredTurn=4;
 assert.deepEqual(computerAction(s,cards,'dificil'),{type:'endTurn'});
});
test('computer policy does not inspect the human hand or mutate snapshots',()=>{
 const s=state();const before=JSON.stringify(s);const action=computerAction(s,cards,'dificil');assert.equal(JSON.stringify(s),before);
 s.players[0].hand=[{id:'secret',cardId:'b',health:2,enteredTurn:0,lastAttackTurn:null}];assert.deepEqual(computerAction(s,cards,'dificil'),action);
});

test('all three policies complete a real API match without invalid commands or endless turns',async()=>{
 const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 try {
  const address=server.address();if(!address||typeof address==='string')throw new Error('Missing test server');
  const base=`http://127.0.0.1:${address.port}/api`;
  for(const difficulty of ['facil','normal','dificil'] as Difficulty[]){
   const started=await fetch(`${base}/duels`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:'inicio'})});
   assert.equal(started.status,201);let current=await started.json() as DuelState;let commands=0;
   while(current.status==='active'&&commands++<250){
    const command=computerAction(current,catalog.cards as Card[],difficulty);
    const response=await fetch(`${base}/duels/${current.id}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:current.version,action:command})});
    const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));current=body as DuelState;
   }
   assert.equal(current.status,'finished');assert.ok(current.turn<=30);assert.ok(commands<250);
  }
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
