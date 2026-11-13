import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderToStaticMarkup} from 'react-dom/server';
import {Card} from '../src/components/Card';
import type {Card as CardData} from '../../shared/contracts';
const root=new URL('../../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('truco_arena_sprites/sprites.json',root),'utf8'));
const expectedHashes=JSON.parse(readFileSync(new URL('truco_arena_sprites/checksums.json',root),'utf8')).files as Record<string,string>;
const catalog=JSON.parse(readFileSync(new URL('backend/src/demo/catalog.json',root),'utf8')).cards as CardData[];
test('v3 has exactly the forty original codes, suits and values without reordering the catalog',()=>{
 assert.equal(manifest.cards.length,40);assert.equal(new Set(manifest.cards.map((c:any)=>c.code)).size,40);
 for(const card of catalog){const entry=manifest.cards.find((c:any)=>c.code===card.id);assert.ok(entry);assert.equal(entry.palo,card.suit);assert.equal(entry.valor,card.number);}
});
test('all eighty canonical PNG/WebP files retain their audited source hashes including ORO-05; PNG size is 240×360',()=>{
 const path=new URL('frontend/public/cards/v3/',root);assert.equal(readdirSync(path).length,80);
 assert.equal(Object.keys(expectedHashes).length,80);
 for(const c of manifest.cards)for(const ext of ['png','webp']){
   const name=`${c.code}.${ext}`,served=readFileSync(new URL(name,path));
   assert.equal(createHash('sha256').update(served).digest('hex'),expectedHashes[name]);
   if(ext==='png'){assert.equal(served.readUInt32BE(16),240);assert.equal(served.readUInt32BE(20),360);}
 }
});
test('every live Card uses its individual v3 WebP and no generated face or printed game statistics',()=>{
 for(const card of catalog){const markup=renderToStaticMarkup(<Card card={card}/>);assert.match(markup,new RegExp(`src="/cards/v3/${card.id}\\.webp"`));assert.ok(!/data-central-pip|data-figure|data-ace-suit/.test(markup));assert.match(markup,/draggable="false"/);}
});
