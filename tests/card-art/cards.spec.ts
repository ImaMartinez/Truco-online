import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async ({page})=>{await page.addInitScript(()=>localStorage.setItem('truco-arena:play-mode','local'));});
import { mkdir } from 'node:fs/promises';
import type { Card, DuelState } from '../../shared/contracts';

const directory = 'artifacts/cards-sprites-v3';
const suits = ['espadas', 'bastos', 'oros', 'copas'] as const;
const suitName = { espadas: 'Espadas', bastos: 'Bastos', oros: 'Oros', copas: 'Copas' };

async function collection(page: Page) {
  await page.goto('/#/coleccion');
  await expect(page.locator('.collection-grid .playing-card')).toHaveCount(40);
  await page.evaluate(() => document.fonts.ready);
}

async function contactSheet(page: Page, ids: string[], title: string, columns: number) {
  // QA-only composition of the actual rendered components, without a product route or alternative artwork.
  await page.evaluate(({ ids, title, columns }) => {
    document.getElementById('card-art-contact-sheet')?.remove();
    const sheet = document.createElement('section');
    sheet.id = 'card-art-contact-sheet';
    Object.assign(sheet.style, { position: 'absolute', top: '0', left: '0', zIndex: '10000', width: `${columns * 210 + 72}px`, padding: '36px', background: '#f4eddd', color: '#253c35', boxSizing: 'border-box' });
    const heading = document.createElement('h1'); heading.textContent = title;
    Object.assign(heading.style, { fontSize: '26px', margin: '0 0 24px', color: '#253c35', fontFamily: 'Georgia, serif' }); sheet.append(heading);
    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: `repeat(${columns}, 190px)`, gap: '24px 20px', alignItems: 'start' });
    for (const id of ids) {
      const original = document.querySelector<HTMLElement>(`.collection-grid [data-card-id="${id}"]`);
      if (!original) throw new Error(`Missing rendered card ${id}`);
      const wrapper = document.createElement('div');
      const card = original.cloneNode(true) as HTMLElement;
      Object.assign(card.style, { width: '190px', maxWidth: 'none', minWidth: '0', height: 'auto', transform: 'none', margin: '0' });
      const label = document.createElement('p'); label.textContent = id;
      Object.assign(label.style, { textAlign: 'center', fontSize: '12px', margin: '10px 0 0', letterSpacing: '1px', color: '#596259' });
      wrapper.append(card, label); grid.append(wrapper);
    }
    sheet.append(grid); document.body.append(sheet);
  }, { ids, title, columns });
  await page.locator('#card-art-contact-sheet').screenshot({ path: `${directory}/${title.startsWith('Figuras') ? 'figuras-12' : title.split(' · ')[0].toLowerCase()}.png` });
  await page.evaluate(() => document.getElementById('card-art-contact-sheet')?.remove());
}

test('all forty sprites load with matching codes and statistics; capture suits, sevens and figures', async ({ page, request }) => {
  await mkdir(directory, { recursive: true });
  await page.setViewportSize({ width: 1480, height: 1050 });
  const catalog = (await (await request.get('/api/catalog')).json()).cards as Card[];
  await collection(page);
  for (const card of catalog) {
    const rendered = page.locator(`.collection-grid .playing-card[data-card-id="${card.id}"]`);
    await expect(rendered.locator('[data-art-suit]')).toHaveAttribute('data-art-suit', card.suit);
    await expect(rendered.locator('[data-art-value]')).toHaveAttribute('data-art-value', String(card.number));
    await expect(rendered.locator('img[data-sprite-code]')).toHaveAttribute('data-sprite-code', card.id);
    await expect.poll(() => rendered.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 240 && img.naturalHeight === 360)).toBe(true);
    for (const [stat, value] of [['energy', card.cost], ['attack', card.attack], ['health', card.health]] as const) {
      await expect(rendered.locator(`[data-stat="${stat}"]`)).toHaveAttribute('data-stat-value', String(value));
      await expect(rendered.locator(`[data-stat="${stat}"]`)).toContainText(String(value));
    }
  }
  for (const suit of suits) await contactSheet(page, catalog.filter(c => c.suit === suit).map(c => c.id), `${suitName[suit]} · Truco Arena`, 5);
  await contactSheet(page, suits.map(suit => catalog.find(c => c.suit === suit && c.number === 1)!.id), 'Anchos · Truco Arena', 4);
  await contactSheet(page, suits.map(suit => catalog.find(c => c.suit === suit && c.number === 7)!.id), 'Sietes · Sprites v3', 4);
  for (const suit of suits) {
    const id = catalog.find(c => c.suit === suit && c.number === 1)!.id;
    await page.locator(`.collection-grid [data-card-id="${id}"]`).screenshot({ path: `artifacts/cards-sprites-v3/ancho-${suit}.png` });
  }
  await contactSheet(page, suits.flatMap(suit => catalog.filter(c => c.suit === suit && c.number >= 10).map(c => c.id)), 'Figuras · Sota, Caballo y Rey', 3);
  await page.screenshot({ path: `${directory}/coleccion-escritorio.png`, fullPage: true });
});

test('card art fits the frame and avoids all three game badges at collection and detail sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await collection(page);
  const problems = await page.locator('.collection-grid .playing-card').evaluateAll(cards => {
    const failures: string[] = [];
    const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.8 && a.right > b.left + 0.8 && a.top < b.bottom - 0.8 && a.bottom > b.top + 0.8;
    for (const card of cards) {
      const frame = card.getBoundingClientRect();
      const badges = [...card.querySelectorAll('[data-stat]')].map(node => node.getBoundingClientRect());
      const img=card.querySelector('img')!;
      const art=img.getBoundingClientRect();
      if(getComputedStyle(img).objectFit!=='contain') failures.push('Image must not crop');
      if(art.left<frame.left-1||art.right>frame.right+1||art.top<frame.top-1||art.bottom>frame.bottom+1) failures.push('Image outside card');
      const energy=card.querySelector('[data-stat="energy"]')!.getBoundingClientRect();
      for(const stat of card.querySelectorAll('[data-stat="attack"],[data-stat="health"]')) if(overlaps(art,stat.getBoundingClientRect())) failures.push('Image/footer badge overlap');
      // The upper right of every supplied face is reserved for the energy badge.
      if(energy.left<frame.left+frame.width*.65) failures.push('Energy outside reserved corner');
    }
    return failures;
  });
  expect(problems).toEqual([]);
  await page.locator('.collection-grid [data-card-id="BAS-05"]').click();
  const detail = page.getByRole('dialog'); await expect(detail).toBeVisible();
  await expect(detail.locator('img[data-sprite-code]')).toHaveAttribute('data-sprite-code','BAS-05');
  const bounds = await detail.locator('.playing-card').boundingBox(); expect(bounds?.width).toBeGreaterThan(200);
  await detail.screenshot({ path: `${directory}/detalle-cinco-bastos.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('.collection-grid [data-card-id="BAS-05"]')).toBeFocused();
});

test('mobile collection, compact hand, selection and invocation keep readable cards without horizontal overflow', async ({ page }) => {
  await mkdir(directory, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await collection(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Copas', exact: true }).click();
  await expect(page.locator('.collection-grid .playing-card')).toHaveCount(10);
  await page.screenshot({ path: `${directory}/coleccion-movil-copas.png`, fullPage: true });
  await page.goto('/');
  const started = page.waitForResponse(r => r.url().endsWith('/api/duels') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Entrar a la arena', exact: true }).click();
  let state = await (await started).json() as DuelState;
  await page.getByRole('button', { name: 'Estoy listo para jugar' }).click();
  const own = state.players.find(p => p.id === state.activePlayerId)!;
  const copy = own.hand[0]!;
  const hand = page.locator(`.own-hand [data-instance-id="${copy.id}"]`);
  await expect(hand).toHaveClass(/compact/);
  await hand.click(); await expect(hand).toHaveAttribute('aria-pressed','true');
  const action = page.waitForResponse(r => r.url().endsWith(`/api/duels/${state.id}/actions`));
  await page.getByRole('button', { name: 'Invocar carta', exact: true }).click();
  state = await (await action).json();
  await expect(page.locator(`.own-field [data-instance-id="${copy.id}"]`)).toBeVisible();
  expect(state.players.find(p => p.id === state.activePlayerId)!.field.some(c => c.id === copy.id)).toBe(true);
  await expect(page.getByRole('button', { name: 'Finalizar turno', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // Reset scroll before full-page capture so fixed navigation/skip link stays at its viewport origin.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${directory}/mano-campo-movil.png`, fullPage: true });
});

 test('PNG fallback loads the supplied seven when WebP cannot load',async({page})=>{
 await page.route('**/cards/v3/ESP-07.webp',route=>route.abort());await collection(page);
 const img=page.locator('.collection-grid [data-card-id="ESP-07"] img');
 await expect(img).toHaveAttribute('src',/ESP-07\.png$/);
 await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth===240&&el.naturalHeight===360)).toBe(true);
 });

test('corrected ORO-05 loads in collection, modal, hand and field', async ({ page }) => {
  const output = 'artifacts/oro05-correction';
  await mkdir(output, { recursive: true });
  await collection(page);
  const card = page.locator('.collection-grid [data-card-id="ORO-05"]');
  await expect.poll(() => card.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 240 && img.naturalHeight === 360)).toBe(true);
  await card.screenshot({ path: `${output}/cinco-oros-coleccion.png` });
  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('img[data-sprite-code="ORO-05"]')).toBeVisible();
  await dialog.screenshot({ path: `${output}/cinco-oros-modal.png` });
  await page.keyboard.press('Escape');

  // Presentation-only fixture: deterministic ORO-05 copies in both zones. No game rules are changed.
  await page.route(/\/api\/duels(?:\/[^/?]+)?$/, async route => {
    const response = await route.fetch();
    const state = await response.json() as DuelState;
    const own = state.players.find(player => player.id === state.activePlayerId)!;
    own.hand[0] = { ...own.hand[0]!, cardId: 'ORO-05', health: 1 };
    own.field[0] = { id: 'qa-oro05-field', cardId: 'ORO-05', health: 1, enteredTurn: 1, lastAttackTurn: null };
    await route.fulfill({ response, json: state });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar a la arena', exact: true }).click();
  await page.getByRole('button', { name: 'Estoy listo para jugar' }).click();
  for (const zone of ['.own-hand', '.own-field']) {
    const img = page.locator(`${zone} img[data-sprite-code="ORO-05"]`);
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 240 && el.naturalHeight === 360)).toBe(true);
  }
  await page.screenshot({ path: `${output}/cinco-oros-mano-campo.png`, fullPage: true });
});
