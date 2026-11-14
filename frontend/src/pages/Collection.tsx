import { useEffect, useMemo, useRef, useState } from "react";
import type { Card as CardData, Player, Suit } from "../../../shared/contracts";
import { api } from "../api";
import { Card } from "../components/Card";
import { GameHeader, Notice } from "../components/GameHeader";
import { Icon } from "../components/Icon";
import { SuitSymbol } from "../components/SuitSymbol";
import { PlayerOptions } from '../components/PlayerOptions';
import { randomDeck, type RandomDeckDraft } from '../randomDeck';

export const suitNames: Record<Suit, string> = {
  espadas: "Espadas",
  bastos: "Bastos",
  oros: "Oros",
  copas: "Copas",
};
export function Collection({ cards, persistent = false, players = [], onRandomDraft, remoteProfile=false }: { cards: CardData[]; persistent?: boolean; players?: Player[]; onRandomDraft?: (draft: RandomDeckDraft) => void;remoteProfile?:boolean }) {
  const [suit, setSuit] = useState<Suit | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("natural");
  const [detail, setDetail] = useState<CardData | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [owner, setOwner] = useState(players[0]?.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [collectionError, setCollectionError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!persistent || !owner) return;
    let ignore = false;
    setLoading(true); setQuantities({}); setCollectionError("");
    api.collection(owner).then(result => { if (!ignore) setQuantities(Object.fromEntries(result.cards.map(card => [card.id, card.quantity]))); })
      .catch(e => { if (!ignore) setCollectionError(e instanceof Error ? e.message : "No se pudo consultar la colección."); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [persistent, owner]);
  useEffect(() => {
    if (!detail) return;
    const previous = opener.current;
    const dialog = document.querySelector<HTMLElement>(".card-detail-modal");
    const controls = dialog?.querySelectorAll<HTMLButtonElement>("button");
    controls?.[0]?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDetail(null);
      }
      if (event.key === "Tab" && controls?.length) {
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      if (previous?.isConnected) previous.focus();
    };
  }, [detail]);
  const filtered = useMemo(
    () =>
      cards
        .filter(
          (card) =>
            (suit === "all" || card.suit === suit) &&
            card.name
              .toLocaleLowerCase("es")
              .includes(search.toLocaleLowerCase("es")),
        )
        .sort((a, b) =>
          sort === "cost"
            ? a.cost - b.cost || a.hierarchy - b.hierarchy
            : sort === "attack"
              ? b.attack - a.attack
              : sort === "health"
                ? b.health - a.health
                : a.id.localeCompare(b.id),
        ),
    [cards, suit, search, sort],
  );
  return (
    <>
      <GameHeader
        title="Tu colección"
        eyebrow="CADA CARTA TIENE SU MOMENTO"
        subtitle="Cuarenta naipes. Cuatro palos. Encontrá tu próxima jugada."
      >
        <span className="pill gold">{persistent ? `${Object.values(quantities).filter(n => n > 0).length} / 40 tipos propios` : "40 / 40 cartas"}</span>
      </GameHeader>
      <div className="collection-intro">
        <Icon name="cards" />
        <span>
          {persistent ? "Tu colección, lista para preparar el próximo mazo." : <>Colección de demostración: <strong>2 copias de cada carta</strong>.</>}
        </span>
      </div>
      {persistent && <div className="persistent-panel"><label>Jugador de la colección<select aria-label="Jugador de la colección" value={owner} onChange={e => setOwner(e.target.value)}><PlayerOptions players={players} currentPlayer={remoteProfile ? players[0] : undefined} /></select></label>{loading && <p role="status">Consultando colección…</p>}</div>}
      <div className="random-deck-panel"><button className="button secondary" disabled={!onRandomDraft || loading || (persistent && (!owner || !!collectionError || !Object.keys(quantities).length))} onClick={() => {
        try { onRandomDraft?.({ ownerId: persistent ? owner : undefined, entries: randomDeck(cards, persistent ? quantities : undefined) }); }
        catch (e) { setCollectionError(e instanceof Error ? e.message : 'No se pudo generar el mazo.'); }
      }}>Armar mazo aleatorio de 20 cartas</button><p className="small-note">Se eligen de toda tu colección, con hasta dos copias por carta. Podrás revisarlo y ponerle nombre antes de guardarlo.</p></div>
      {collectionError && <Notice onClose={()=>setCollectionError('')}>{collectionError}</Notice>}
      <div className="collection-toolbar">
        <div className="suit-tabs" aria-label="Filtrar por palo">
          <button
            className={suit === "all" ? "active" : ""}
            onClick={() => setSuit("all")}
          >
            Todos los palos
          </button>
          {(Object.keys(suitNames) as Suit[]).map((value) => (
            <button
              key={value}
              className={suit === value ? "active" : ""}
              onClick={() => setSuit(value)}
            >
              <SuitSymbol suit={value} />
              {suitNames[value]}
            </button>
          ))}
        </div>
        <div className="search-sort">
          <label className="search-field">
            <Icon name="search" size={17} />
            <input
              aria-label="Buscar carta"
              placeholder="Buscar carta…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Ordenar cartas"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="natural">Orden del catálogo</option>
            <option value="cost">Menor energía</option>
            <option value="attack">Mayor ataque</option>
            <option value="health">Mayor vida</option>
          </select>
        </div>
      </div>
      <div className="grid-heading">
        <span>
          {filtered.length} cartas{" "}
          {suit !== "all" && `de ${suitNames[suit].toLowerCase()}`}
        </span>
        <span>Elegí una carta para conocerla</span>
      </div>
      <div className="collection-grid">
        {filtered.map((card) => (
          <div className="collection-item" key={card.id}>
            <Card card={card} onClick={(event) => {
              opener.current = event.currentTarget;
              setDetail(card);
            }} />
            <div className="card-copy-count">
              <span>COLECCIÓN</span>
              <strong>{persistent ? (loading ? "…" : `×${quantities[card.id] ?? 0}`) : "×2"}</strong>
            </div>
          </div>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Icon name="search" size={32} />
          <h2>No hay cartas con esa búsqueda</h2>
          <p>Probá con otro nombre o elegí todos los palos.</p>
          <button
            className="button secondary"
            onClick={() => {
              setSearch("");
              setSuit("all");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="card-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${detail.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setDetail(null)}
              aria-label="Cerrar detalle"
            >
              <Icon name="close" />
            </button>
            <Card card={detail} />
            <div>
              <span className="eyebrow">
                {suitNames[detail.suit]} · CATÁLOGO 0.1
              </span>
              <h2>{detail.name}</h2>
              <p>
                Una carta española de tu colección.
              </p>
              <dl>
                <div>
                  <dt>Energía</dt>
                  <dd>{detail.cost}</dd>
                </div>
                <div>
                  <dt>Ataque</dt>
                  <dd>{detail.attack}</dd>
                </div>
                <div>
                  <dt>Vida</dt>
                  <dd>{detail.health}</dd>
                </div>
              </dl>
              <p className="muted">
                Jerarquía tradicional: {detail.hierarchy}. Es una referencia del
                Truco; no resuelve este combate.
              </p>
              <button
                className="button secondary"
                onClick={() => setDetail(null)}
              >
                Volver a la colección
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
