import type {Page} from '@playwright/test';
export async function observeCombatEffects(page:Page) {
 await page.evaluate(()=>{
  const events={stages:[] as string[],damage:[] as string[],deaths:[] as string[]};(window as any).__combatEffects=events;
  const observer=new MutationObserver(()=>{
   const layer=document.querySelector<HTMLElement>('[data-combat-animation]');if(!layer)return;
   const stage=layer.dataset.combatStage;if(stage&&!events.stages.includes(stage))events.stages.push(stage);
   for(const el of layer.querySelectorAll<HTMLElement>('[data-damage-target]'))events.damage.push(`${el.dataset.damageTarget}:${el.textContent}`);
   for(const el of layer.querySelectorAll<HTMLElement>('[data-eliminated-instance]'))if(!events.deaths.includes(el.dataset.eliminatedInstance!))events.deaths.push(el.dataset.eliminatedInstance!);
  });observer.observe(document.body,{subtree:true,childList:true,attributes:true});
 });
}
