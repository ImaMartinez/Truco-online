import type { Page } from '@playwright/test';

// The product now deliberately hides automated profile names. Expose only this test's
// two actors under ordinary display names, without altering stored aliases or API behavior.
export async function selectFixturePlayers(page: Page, players: {id:string}[]) {
  await page.route('**/api/players', async route => {
    if(route.request().method() !== 'GET') return route.continue();
    const response=await route.fetch();
    const body=await response.json();
    await route.fulfill({response,json:{...body,players:body.players.filter((p:{id:string})=>players.some(actor=>actor.id===p.id)).map((p:{id:string},index:number)=>({...p,alias:`Participante ${index+1}`}))}});
  });
}
