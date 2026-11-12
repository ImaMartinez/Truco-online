import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderToStaticMarkup} from 'react-dom/server';
import {Card} from '../src/components/Card';
import type {Card as CardData} from '../../shared/contracts';
const root=new URL('../../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('truco_arena_sprites/sprites.json',root),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('backend/src/demo/catalog.json',root),'utf8')).cards as CardData[];
test('v3 has exactly the forty original codes, suits and values without reordering the catalog',()=>{
 assert.equal(manifest.cards.length,40);assert.equal(new Set(manifest.cards.map((c:any)=>c.code)).size,40);
 for(const card of catalog){const entry=manifest.cards.find((c:any)=>c.code===card.id);assert.ok(entry);assert.equal(entry.palo,card.suit);assert.equal(entry.valor,card.number);}
});
test('all eighty served PNG/WebP files match the source package including the ORO-05 correction; PNG size is 240×360',()=>{
 const path=new URL('frontend/public/cards/v3/',root);assert.equal(readdirSync(path).length,80);
 for(const c of manifest.cards)for(const ext of ['png','webp']){
   const original=readFileSync(new URL(`truco_arena_sprites/cards/${c.code}.${ext}`,root));const served=readFileSync(new URL(`${c.code}.${ext}`,path));
   assert.equal(createHash('sha256').update(served).digest('hex'),createHash('sha256').update(original).digest('hex'));
   if(ext==='png'){assert.equal(served.readUInt32BE(16),240);assert.equal(served.readUInt32BE(20),360);}
 }
});
test('every live Card uses its individual v3 WebP and no generated face or printed game statistics',()=>{
 for(const card of catalog){const markup=renderToStaticMarkup(<Card card={card}/>);assert.match(markup,new RegExp(`src="/cards/v3/${card.id}\\.webp"`));assert.ok(!/data-central-pip|data-figure|data-ace-suit/.test(markup));assert.match(markup,/draggable="false"/);}
});
