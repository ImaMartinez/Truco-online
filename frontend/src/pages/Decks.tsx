import { useEffect, useMemo, useState } from "react";
import type {
  Card as CardData,
  Deck,
  DeckEntry,
  Player,
} from "../../../shared/contracts";
import { api } from "../api";
import { Card } from "../components/Card";
import { GameHeader, Notice } from "../components/GameHeader";
import { Icon } from "../components/Icon";
import { SuitSymbol } from "../components/SuitSymbol";
import { PlayerOptions } from '../components/PlayerOptions';
import { randomDeck, type RandomDeckDraft } from '../randomDeck';
import { useConfirmation } from '../components/Confirmation';

const size = (entries: DeckEntry[]) =>
  entries.reduce((sum, e) => sum + e.quantity, 0);
export function Decks({
  cards,
  decks,
  onSaved,
  onDeleted,
  persistent = false,
  players = [],
  initialDraft,
  onDraftConsumed,
  remoteProfile = false,
}: {
  cards: CardData[];
  decks: Deck[];
  onSaved: (deck: Deck) => void;
  onDeleted: (id: string) => void;
  persistent?: boolean;
  players?: Player[];
  initialDraft?: RandomDeckDraft | null;
  onDraftConsumed?: () => void;
  remoteProfile?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(decks[0]?.id ?? null);
  const [name, setName] = useState(decks[0]?.name ?? "Mi nuevo mazo");
  const [entries, setEntries] = useState<DeckEntry[]>(() =>
    structuredClone(decks[0]?.entries ?? []),
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmation = useConfirmation();
  const [owner, setOwner] = useState(decks[0]?.ownerId ?? players[0]?.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [collectionLoading, setCollectionLoading] = useState(false);
  const readOnly = persistent && !!decks.find(d => d.id === editing)?.used;
  const ownerDecks = persistent ? decks.filter(d => d.ownerId === owner) : decks;
  useEffect(() => {
    if (!initialDraft) return;
    setEditing(null); setName('Mi mazo aleatorio'); setEntries(initialDraft.entries);
    if (initialDraft.ownerId) setOwner(initialDraft.ownerId);
    setSaved('Veinte cartas elegidas al azar. Podés editarlas antes de guardar.'); setError('');
    onDraftConsumed?.();
  }, [initialDraft]);
  useEffect(() => {
    if (!persistent || !owner) return;
    let ignore = false;
    setCollectionLoading(true); setQuantities({});
    api.collection(owner).then(result => { if (!ignore) setQuantities(Object.fromEntries(result.cards.map(c => [c.id, c.quantity]))); })
      .catch(e => { if (!ignore) setError(e instanceof Error ? e.message : "No se pudo consultar la colección."); })
      .finally(() => { if (!ignore) setCollectionLoading(false); });
    return () => { ignore = true; };
  }, [persistent, owner]);
  const count = size(entries);
  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );
  const totalCost = entries.reduce(
    (sum, e) => sum + (cardMap.get(e.cardId)?.cost ?? 0) * e.quantity,
    0,
  );
  function choose(deck?: Deck) {
    setEditing(deck?.id ?? null);
    setName(deck?.name ?? "Mi nuevo mazo");
    setEntries(structuredClone(deck?.entries ?? []));
    setError("");
    setSaved("");
  }
  function adjust(cardId: string, amount: number) {
    if (readOnly || (persistent && collectionLoading)) return;
    setSaved("");
    const current = entries.find((e) => e.cardId === cardId)?.quantity ?? 0;
    if (amount > 0 && (current >= (persistent ? Math.min(2, quantities[cardId] ?? 0) : 2) || count >= 20)) return;
    const quantity = current + amount;
    setEntries(
      quantity > 0
        ? [...entries.filter((e) => e.cardId !== cardId), { cardId, quantity }]
        : entries.filter((e) => e.cardId !== cardId),
    );
  }
  async function save() {
    setBusy(true);
    setError("");
    setSaved('');
    try {
      const trimmedName = name.trim();
      // Resolve by owner and name from a fresh list, never by the last edited ID.
      const currentDecks = (await api.decks(persistent ? owner : undefined)).decks;
      const matches = currentDecks.filter(deck => (!persistent || deck.ownerId === owner)
        && deck.name.trim().localeCompare(trimmedName, 'es', { sensitivity: 'base' }) === 0);
      if (matches.length > 1) throw new Error('Hay varios mazos con ese nombre. Elegí un nombre nuevo para evitar reemplazar el incorrecto.');
      const existing = matches[0];
      if (persistent && existing?.used) throw new Error('Ese nombre pertenece a un mazo ya usado. Elegí otro nombre para guardar un mazo nuevo.');
      if (existing && !await confirmation.confirm({ title: '¿Reemplazar este mazo?', message: `Ya existe el mazo “${existing.name}”${persistent ? ` de ${players.find(player => player.id === owner)?.alias ?? 'este jugador'}` : ''}. Su composición se reemplazará por las cartas que elegiste.`, action: 'Reemplazar mazo' })) return;
      const deck = await api.saveDeck(
        {
          name: existing?.name ?? trimmedName,
          description: persistent ? "Mazo de desarrollo persistente." : "Mazo editado en la demostración local.",
          entries,
          ...(persistent ? { ownerId: owner } : {}),
        },
        existing?.id,
      );
      onSaved(deck);
      setEditing(deck.id);
      setName(deck.name);
      setSaved(
        remoteProfile ? `“${deck.name}” guardado en tu perfil.` : persistent ? `“${deck.name}” guardado.` : `“${deck.name}” guardado para esta sesión.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(deck: Deck) {
    setBusy(true); setError('');
    try {
      if (!await confirmation.confirm({ title: '¿Eliminar este mazo?', message: `“${deck.name}” se quitará de tus mazos. ${deck.used ? 'Las partidas que ya lo usaron conservarán su historial. Su nombre quedará reservado para ese historial.' : 'Tus cartas seguirán disponibles en la colección.'}`, action: 'Eliminar mazo' })) return;
      await api.deleteDeck(deck.id, persistent ? deck.ownerId : undefined);
      const remaining = ownerDecks.filter(item => item.id !== deck.id);
      onDeleted(deck.id);
      if (editing === deck.id) choose(remaining[0]);
      setSaved(`“${deck.name}” eliminado de tus mazos.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar el mazo.'); }
    finally { setBusy(false); }
  }
  return (
    <fieldset className="deck-workspace" disabled={busy} aria-busy={busy}>
      {confirmation.dialog}
      <GameHeader
        title="Mis mazos"
        eyebrow="LA ESTRATEGIA EMPIEZA ACÁ"
        subtitle="Elegí veinte cartas que se entiendan entre sí."
      >
        <button className="button secondary" onClick={() => choose()}>
          <Icon name="plus" size={17} />
          Nuevo mazo
        </button>
      </GameHeader>
      {persistent && <div className="persistent-panel"><label>Propietario del mazo<select aria-label="Propietario del mazo" value={owner} onChange={e => { const next = e.target.value; setOwner(next); choose(decks.find(d => d.ownerId === next)); }}><PlayerOptions players={players} currentPlayer={remoteProfile ? players[0] : undefined} /></select></label><p className="small-note">Cada mazo pertenece a un jugador. Los mazos usados conservan su composición; duplicalos para preparar otra versión.</p>{collectionLoading && <p role="status">Consultando cartas disponibles…</p>}</div>}
      <div className="deck-saved-list">
        {ownerDecks.map((deck, i) => (
          <div className="saved-deck-tile" key={deck.id}>
          <button
            className={`saved-deck ${editing === deck.id ? "active" : ""}`}
            key={deck.id}
            onClick={() => choose(deck)}
          >
            <span className="deck-thumbnail">
              <SuitSymbol
                suit={
                  cards.find((c) => c.id === deck.entries[0]?.cardId)?.suit ??
                  "espadas"
                }
              />
            </span>
            <span>
              <small>MAZO {String(i + 1).padStart(2, "0")}</small>
              <strong>{deck.name}</strong>
              <span>{size(deck.entries)} / 20 cartas{persistent && deck.used ? " · Usado" : ""}</span>
            </span>
            <Icon name="chevron" size={16} />
          </button>
          <button type="button" className="delete-deck" aria-label={`Eliminar mazo ${deck.name}`} title={`Eliminar ${deck.name}`} onClick={() => void remove(deck)}><Icon name="close" size={14} /></button>
          </div>
        ))}
      </div>
      {error && <Notice onClose={() => setError("")}>{error}</Notice>}
      {saved && (
        <Notice type="success" onClose={() => setSaved("")}>
          {saved}
        </Notice>
      )}
      {readOnly && <Notice type="info">Este mazo ya fue usado y es inmutable. <button className="button secondary" onClick={() => { setEditing(null); setName(`${name} copia`); setSaved(""); setError(""); }}>Duplicar mazo</button></Notice>}
      <div className="deck-editor-layout">
        <section className="deck-pool">
          <div className="panel-heading">
            <h2>Elegí tus cartas</h2>
            <label className="search-field">
              <Icon name="search" size={16} />
              <input
                aria-label="Buscar carta para mazo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en la colección…"
              />
            </label>
          </div>
          <div className="deck-card-grid">
            {cards
              .filter((card) =>
                card.name
                  .toLocaleLowerCase("es")
                  .includes(search.toLocaleLowerCase("es")),
              )
              .map((card) => {
                const qty =
                  entries.find((e) => e.cardId === card.id)?.quantity ?? 0;
                const available = persistent ? Math.min(2, quantities[card.id] ?? 0) : 2;
                return (
                  <div className="deck-pool-card" key={card.id}>
                    <Card
                      compact
                      card={card}
                      onClick={() => adjust(card.id, 1)}
                      disabled={readOnly || collectionLoading || count >= 20 || qty >= available}
                    />
                    <div className="quantity-control">
                      <button
                        aria-label={`Quitar ${card.name}`}
                        disabled={readOnly || !qty}
                        onClick={() => adjust(card.id, -1)}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <span>{qty} / {available}</span>
                      <button
                        aria-label={`Agregar ${card.name}`}
                        disabled={readOnly || collectionLoading || count >= 20 || qty >= available}
                        onClick={() => adjust(card.id, 1)}
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
        <aside className="deck-summary">
          <span className="eyebrow">TU COMPOSICIÓN</span>
          <label htmlFor="deck-name">Nombre del mazo</label>
          <input
            id="deck-name"
            disabled={readOnly}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="button secondary full randomize-composition" disabled={readOnly || collectionLoading || (persistent && !owner)} onClick={() => {
            try { setEntries(randomDeck(cards, persistent ? quantities : undefined)); setSaved('Veinte cartas elegidas al azar. Revisá el mazo y guardalo.'); setError(''); }
            catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar el mazo.'); }
          }}>Elegir 20 cartas al azar</button>
          <p className="small-note">Un nombre nuevo crea otro mazo. Si ya existe para este jugador, te pediremos confirmar el reemplazo.</p>
          <div className="deck-count">
            <strong>
              {count}
              <span>/20</span>
            </strong>
            <span>
              {count === 20 ? "Listo para la arena" : "Cartas seleccionadas"}
            </span>
          </div>
          <div className="count-track">
            <span style={{ width: `${(count / 20) * 100}%` }} />
          </div>
          <p className="deck-energy">
            Energía promedio{" "}
            <strong>
              {count
                ? (totalCost / count).toLocaleString("es-AR", {
                    maximumFractionDigits: 1,
                  })
                : "—"}
            </strong>
          </p>
          <div className="selected-deck-entries">
            {entries.length ? (
              entries.map((entry) => {
                const card = cardMap.get(entry.cardId);
                return (
                  card && (
                    <div className="deck-entry" key={entry.cardId}>
                      <span className="entry-cost">{card.cost}</span>
                      <span>{card.name}</span>
                      <strong>×{entry.quantity}</strong>
                      <button
                        className="icon-button"
                        aria-label={`Retirar ${card.name}`}
                        disabled={readOnly}
                        onClick={() => adjust(entry.cardId, -1)}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                    </div>
                  )
                );
              })
            ) : (
              <p className="muted">
                Agregá cartas desde la colección para empezar.
              </p>
            )}
          </div>
          <button
            className="button primary full"
            disabled={busy || readOnly || !name.trim() || (persistent && (!owner || collectionLoading))}
            onClick={() => void save()}
          >
            {busy ? "Guardando…" : "Guardar mazo"}
            <Icon name="deck" size={17} />
          </button>
          <p className="small-note">
            Podés guardar un borrador. Para iniciar una partida necesitás
            exactamente veinte cartas.
          </p>
        </aside>
      </div>

    </fieldset>
  );
}
