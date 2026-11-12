import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Card } from '../src/components/Card';
import { TraditionalCardArt } from '../src/components/cards/TraditionalCardArt';
import type { Card as CardData } from '../../shared/contracts';

const cards = (JSON.parse(readFileSync(new URL('../../backend/src/demo/catalog.json', import.meta.url), 'utf8')) as { cards: CardData[] }).cards;
const figure = { 10: 'sota', 11: 'caballo', 12: 'rey' } as const;
const matches = (markup: string, pattern: RegExp) => [...markup.matchAll(pattern)].length;

test('legacy SVG reference: aces have dedicated art with restrained ornaments for coins/cups and still one central object', () => {
  for (const card of cards.filter(c => c.number === 1)) {
    const markup = renderToStaticMarkup(<TraditionalCardArt suit={card.suit} value={card.number} />);
    assert.match(markup, new RegExp(`data-ace-suit="${card.suit}"`));
    assert.equal(matches(markup, /data-central-pip=/g), 1);
    assert.equal(markup.includes('data-ace-decoration="rays"'), ['espadas','bastos'].includes(card.suit));
    assert.match(markup, /data-ace-decoration="laurel"/);
  }
});

test('legacy SVG reference: the complete original catalog maps to the matching suit and number in SVG', () => {
  assert.equal(cards.length, 40);
  for (const card of cards) {
    const markup = renderToStaticMarkup(<TraditionalCardArt suit={card.suit} value={card.number} />);
    assert.match(markup, new RegExp(`data-art-suit="${card.suit}"`), card.id);
    assert.match(markup, new RegExp(`data-art-value="${card.number}"`), card.id);
    assert.match(markup, /<svg/);
    assert.ok(!/<(?:image|img)\b/.test(markup), `${card.id}: original scalable vector art, without remote bitmap artwork`);
  }
});

test('legacy SVG reference: number cards contain exactly 1–7 central pips, excluding corner suit marks', () => {
  for (const card of cards.filter(card => card.number <= 7)) {
    const markup = renderToStaticMarkup(<TraditionalCardArt suit={card.suit} value={card.number} />);
    assert.equal(matches(markup, /data-central-pip(?:=|[\s>])/g), card.number, `${card.id}: count the central objects`);
    assert.equal(matches(markup, /data-figure=/g), 0, `${card.id}: no court figure on a number card`);
  }
});

test('legacy SVG reference: the twelve court cards use Sota, mounted Caballo and crowned Rey instead of repeated pips', () => {
  const courts = cards.filter(card => card.number >= 10);
  assert.equal(courts.length, 12);
  for (const card of courts) {
    const markup = renderToStaticMarkup(<TraditionalCardArt suit={card.suit} value={card.number} />);
    assert.equal(matches(markup, /data-central-pip(?:=|[\s>])/g), 0, card.id);
    assert.match(markup, new RegExp(`data-figure="${figure[card.number as 10 | 11 | 12]}"`), card.id);
    assert.match(markup, new RegExp(`data-court-suit="${card.suit}"`), card.id);
    assert.match(markup, new RegExp(`data-court-rank="${card.number}"`), card.id);
    if (card.number === 11) assert.match(markup, /data-court-horse/, `${card.id}: mounted horse silhouette`);
    if (card.number === 12) assert.match(markup, /data-court-crown/, `${card.id}: royal crown`);
  }
});

test('all cards keep real energy/attack and current instance health in the three separate badges', () => {
  for (const card of cards) {
    const health = Math.max(0, card.health - 1);
    const markup = renderToStaticMarkup(<Card card={card} instance={{ id: `test-${card.id}`, cardId: card.id, health, enteredTurn: 1, lastAttackTurn: null }} />);
    for (const [stat, value] of [['energy', card.cost], ['attack', card.attack], ['health', health]] as const) {
      const tag = markup.match(new RegExp(`<[^>]+data-stat="${stat}"[^>]*>`))?.[0];
      assert.ok(tag, `${card.id}: ${stat} badge`);
      assert.match(tag, new RegExp(`data-stat-value="${value}"`), `${card.id}: ${stat} uses HTTP state`);
    }
    assert.match(markup, new RegExp(`energía ${card.cost}, ataque ${card.attack}, vida ${health}`));
    assert.match(markup, /health-stat damaged/);
  }
});

test('compact and large cards preserve art identity, button selection and disabled semantics', () => {
  for (const card of [cards[4]!, cards.find(card => card.id === 'COP-11')!]) {
    for (const compact of [false, true]) {
      const markup = renderToStaticMarkup(<Card card={card} compact={compact} selected disabled onClick={() => undefined} />);
      assert.match(markup, /<button\s/); // React may prepend an image preload link during SSR.
      assert.match(markup, /aria-pressed="true"/);
      assert.match(markup, /disabled=""/);
      assert.match(markup, /playing-card[^\"]*selected/);
      assert.equal(markup.includes(' compact'), compact);
      assert.match(markup, new RegExp(`data-card-id="${card.id}"`));
      assert.match(markup, new RegExp(`data-art-suit="${card.suit}"`));
    }
  }
});
