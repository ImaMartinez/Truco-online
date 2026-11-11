import manifest from '../../../../truco_arena_sprites/sprites.json';

const sprites = new Map(manifest.cards.map(card => [card.code, card]));
const base = import.meta.env?.BASE_URL ?? '/';

/** The supplied v3 files are the only rendered face; numbers and artwork are never redrawn. */
export function SpriteCardArt({ code }: { code: string }) {
  const sprite = sprites.get(code);
  if (!sprite) return <span className="missing-card-art">Ilustración no disponible</span>;
  const path = `${base}cards/v3/${code}`;
  return <img className="card-art sprite-illustration" src={`${path}.webp`} width={240} height={360}
    alt="" aria-hidden="true" draggable={false} decoding="async"
    data-art-suit={sprite.palo} data-art-value={sprite.valor} data-sprite-code={code}
    onError={event => {
      const img = event.currentTarget;
      if (!img.dataset.pngFallback) { img.dataset.pngFallback = 'true'; img.src = `${path}.png`; }
    }} />;
}
