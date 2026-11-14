import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async ({page})=>{await page.addInitScript(()=>localStorage.setItem('truco-arena:play-mode','local'));});
import type { DuelState } from '../../shared/contracts';
import { mkdir } from 'node:fs/promises';

test('home and about use player-facing copy without academic approval or implementation notes',async({page})=>{
 await page.goto('/#/inicio');
 await expect(page.getByRole('heading',{name:/La mesa está lista/})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/B1[–—-]B4|pendientes de aprobación|modelo académico|MariaDB|PostgreSQL|API local conectada/);
 await page.getByRole('button',{name:'Sobre el juego',exact:true}).click();
 const about=page.getByRole('dialog',{name:'Sobre Truco Arena',exact:true});
 await expect(about).toBeVisible();await expect(about).toContainText('Modo demostración: las partidas son temporales.');
 await expect(about).not.toContainText(/B1[–—-]B4|aprobación|MariaDB|PostgreSQL|backend|truco_arena_dev/);
 await page.keyboard.press('Escape');await expect(about).toHaveCount(0);
});

async function readyAtTable(page: Page) {
  await expect(page.locator('.turn-curtain, .battle-table')).toHaveCount(1);
  const ready = page.getByRole('button', { name: 'Estoy listo para jugar' });
  if (await ready.isVisible()) await ready.click();
  await expect(page.getByRole('button', { name: 'Finalizar turno' })).toBeVisible();
}

async function preparedTable(page: Page): Promise<DuelState> {
  await page.goto('/');
  const response = page.waitForResponse(r => r.url().endsWith('/api/duels') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Entrar a la arena' }).click();
  const state = await (await response).json() as DuelState;
  await readyAtTable(page);
  return state;
}

test('salud y catálogo reales por el proxy HTTP', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toMatchObject({ status: 'ok', mode: 'demo', storage: 'memory', database: 'not-connected', agreements: 'pending' });
  const catalog = await (await request.get('/api/catalog')).json();
  expect(catalog.cards).toHaveLength(40);
  expect(new Set(catalog.cards.map((c: { id: string }) => c.id)).size).toBe(40);
});

test('inicio, colección, filtros, orden y detalle accesible', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('La mesa está lista');
  await expect(page.getByText('Modo demostración',{exact:true})).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Colección', exact: true }).click();
  await expect(page.locator('.collection-grid [data-card-id]')).toHaveCount(40);
  await page.getByRole('button', { name: 'Espadas', exact: true }).click();
  await expect(page.locator('.collection-grid [data-card-id]')).toHaveCount(10);
  await page.getByLabel('Ordenar cartas').selectOption('attack');
  await expect(page.locator('.collection-grid [data-card-id]').first()).toHaveAttribute('data-card-id', 'ESP-01');
  await page.getByLabel('Buscar carta', { exact: true }).fill('Ancho');
  await expect(page.locator('.collection-grid [data-card-id]')).toHaveCount(1);
  await page.locator('.collection-grid [data-card-id="ESP-01"]').click();
  await expect(page.getByRole('dialog', { name: 'Detalle de Ancho de espadas' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.collection-grid [data-card-id="ESP-01"]')).toBeFocused();
  expect(errors).toEqual([]);
});

test('crear borrador de mazo en memoria y rechazar inicio incompleto', async ({ page }) => {
  await page.goto('/#/mazos');
  await page.getByRole('button', { name: 'Nuevo mazo', exact: true }).click();
  await page.getByLabel('Nombre del mazo').fill('Prueba de navegador');
  const add = page.getByRole('button', { name: 'Agregar Cuatro de espadas', exact: true });
  await add.click();
  await add.click();
  await expect(add).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar mazo' }).click();
  await expect(page.getByText('“Prueba de navegador” guardado para esta sesión.', { exact: false })).toBeVisible();
  await page.getByRole('link',{name:'Jugar',exact:true}).click();
  await page.getByLabel('Mazo del jugador 1').selectOption({ label: 'Prueba de navegador (2 cartas)' });
  await expect(page.getByRole('button', { name: 'Comenzar desde cero' })).toBeDisabled();
  await expect(page.getByText('Para iniciar la mesa, completá los mazos de 20 cartas o usá dos clásicos de 12.')).toBeVisible();
});

test('invocación, combate, transición y regreso sin revelar la mano', async ({ page }) => {
  const state = await preparedTable(page);
  const actor = state.players.find(p => p.id === state.activePlayerId)!;
  const rival = state.players.find(p => p.id !== state.activePlayerId)!;
  const handCard = actor.hand[0];
  await page.locator(`.own-hand [data-instance-id="${handCard.id}"]`).click();
  const playResponse = page.waitForResponse(r => r.url().endsWith('/actions') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Invocar carta', exact: true }).click();
  const played = await (await playResponse).json() as DuelState;
  const afterPlay = played.players.find(p => p.id === actor.id)!;
  expect(afterPlay.field).toHaveLength(actor.field.length + 1);
  expect(afterPlay.energy).toBeLessThan(actor.energy);
  await expect(page.locator(`.own-field [data-instance-id="${handCard.id}"]`)).toBeVisible();
  await page.locator(`.own-field [data-instance-id="${actor.field[0].id}"]`).click();
  const attackResponse = page.waitForResponse(r => r.url().endsWith('/actions') && r.request().method() === 'POST');
  await page.locator(`.enemy-field [data-instance-id="${rival.field[0].id}"]`).click();
  const attacked = await (await attackResponse).json() as DuelState;
  expect(attacked.version).toBe(played.version + 1);
  expect(attacked.players[0].discardCount + attacked.players[1].discardCount).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Finalizar turno' }).click();
  await expect(page.getByRole('region', { name: 'Cambio de jugador' })).toBeVisible();
  await expect(page.locator('.own-hand')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Colección', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'La arena', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cambio de jugador' })).toBeVisible();
  await expect(page.locator('.own-hand')).toHaveCount(0);
  await page.getByRole('button', { name: 'Estoy listo para jugar' }).click();
  await expect(page.locator('.own-hand')).toBeVisible();
});

test('móvil sin desborde horizontal en las cuatro pantallas', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ['inicio', 'coleccion', 'mazos', 'arena']) {
    await page.goto(`/#/${route}`);
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.locator('.loading-state')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
  await page.getByRole('button', { name: 'Abrir mesa preparada' }).click();
  await readyAtTable(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('un error de conexión se explica y permite volver a cargar', async ({ page }) => {
  await page.route('**/api/catalog', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Falta abrir la mesa' })).toBeVisible();
  await expect(page.getByText('No pudimos conectar con la API.', { exact: false })).toBeVisible();
  await page.unroute('**/api/catalog');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reintentar conexión', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('La mesa está lista');
});

test('una partida desde cero llega a empate y puede reiniciarse', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/#/arena');
  await page.getByRole('button', { name: 'Partida desde cero', exact: true }).click();
  await readyAtTable(page);
  for (let turn = 1; turn <= 30; turn++) {
    await page.getByRole('button', { name: 'Finalizar turno', exact: true }).click();
    if (turn < 30) {
      await expect(page.getByRole('button', { name: 'Estoy listo para jugar' })).toBeEnabled();
      await page.getByRole('button', { name: 'Estoy listo para jugar' }).click();
    }
  }
  await expect(page.getByRole('heading', { name: 'Una mesa pareja. Es empate.' })).toBeVisible();
  await expect(page.getByText('30 turnos globales', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva partida de demostración' }).click();
  await readyAtTable(page);
  await expect(page.locator('.table-topline')).toContainText('Turno 1 / 30');
});

test('capturas verificables del inicio y del tablero', async ({ page }) => {
  await mkdir('artifacts/demo', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.hero-fan [data-card-id]')).toHaveCount(3);
  await page.screenshot({ path: 'artifacts/demo/inicio.png', fullPage: true });
  await preparedTable(page);
  await page.screenshot({ path: 'artifacts/demo/tablero.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'artifacts/demo/tablero-movil.png', fullPage: true });
});
