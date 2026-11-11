import {readFile} from 'node:fs/promises';
export async function seedTwentyDecks(connection){
 const {cards}=JSON.parse(await readFile(new URL('../../backend/src/demo/catalog.json',import.meta.url),'utf8'));
 let created=0;
 for(const [index,name] of ['Ana','Bruno','Carla','Diego'].entries()){
  const [players]=await connection.execute('SELECT id_jugador FROM jugador WHERE alias=? AND fecha_archivo IS NULL',[`${name} demo SQL`]);
  if(!players.length)continue;
  const owner=players[0].id_jugador,deckName=`Mazo 20 · ${name}`;
  if((await connection.execute('SELECT id_mazo FROM mazo WHERE id_jugador=? AND nombre=?',[owner,deckName]))[0].length)continue;
  const entries=cards.slice(index*10,index*10+10).map(card=>({cardId:card.id,quantity:2}));
  await connection.beginTransaction();
  try{await connection.execute('CALL ta_guardar_mazo(?,NULL,?,?,?)',[owner,deckName,'Formato de 20 cartas para jugar contra la PC.',JSON.stringify(entries)]);await connection.commit();created++;}
  catch(error){await connection.rollback();throw error;}
 }
 return created;
}
