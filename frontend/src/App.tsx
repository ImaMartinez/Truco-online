import { useEffect, useRef, useState } from "react";
import type { Card, Deck, DuelState, Player, HealthResponse, CreateDuelRequest } from "../../shared/contracts";
import { api, uncertainFailure } from "./api";
import { Icon } from "./components/Icon";
import { Notice } from "./components/GameHeader";
import {PopupNotice} from './components/PopupNotice';
import { AboutDialog } from "./components/AboutDialog";
import { Home } from "./pages/Home";
import { Collection } from "./pages/Collection";
import { Decks } from "./pages/Decks";
import { Battlefield } from "./pages/Battlefield";
import { PersistentGames } from "./pages/PersistentGames";
import { readPending, writePending } from "./pendingRequests";
import { visiblePlayers, isTestName } from './playerDirectory';
import {isComputerDeck,playerDecks} from './deckDirectory';
import type { RandomDeckDraft } from './randomDeck';
import { Play } from './pages/Play';
import { defaultOpponent, opponentFor, rememberOpponent, type Opponent } from './computer';

type Page = "inicio" | "coleccion" | "mazos" | "jugar" | "arena";
const navigation: { id: Page; label: string; icon: string }[] = [
  { id: "inicio", label: "Inicio", icon: "home" },
  { id: "coleccion", label: "Colección", icon: "cards" },
  { id: "mazos", label: "Mis mazos", icon: "deck" },
  { id: "jugar", label: "Jugar", icon: "swords" },
  { id: "arena", label: "La arena", icon: "swords" },
];
function currentPage(): Page {
  const key = window.location.hash.replace("#/", "").split("?")[0];
  return navigation.some((item) => item.id === key) ? (key as Page) : "inicio";
}
const routeDuelId = () => new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("partida");

export function App() {
  const [page, setPage] = useState<Page>(currentPage);
  const [cards, setCards] = useState<Card[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [help, setHelp] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [randomDraft, setRandomDraft] = useState<RandomDeckDraft | null>(null);
  const selectablePlayers = visiblePlayers(players);
  const [duelId, setDuelId] = useState<string | null>(routeDuelId);
  const [pendingStart, setPendingStart] = useState<CreateDuelRequest | null>(null);
  const pendingStartRef = useRef<CreateDuelRequest | null>(null);
  const persistent = health?.mode === "persistent";
  const selectableDecks = playerDecks(decks).filter(deck=>!persistent||(selectablePlayers.some(player=>player.id===deck.ownerId)&&!isTestName(deck.name)));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [catalog, list, status] = await Promise.all([
        api.catalog(),
        api.decks(),
        api.health().then(status => { setHealth(status); return status; }),
      ]);
      setCards(catalog.cards);
      setDecks(list.decks);
      setHealth(status);
      if (status.mode === "persistent") {
        setPlayers((await api.players()).players);
        const pending = readPending<CreateDuelRequest>("truco-arena:sql:start");
        pendingStartRef.current = pending; setPendingStart(pending);
      }
      setOnline(status.status === "ok");
    } catch (e) {
      setOnline(false);
      setError(
        e instanceof Error ? e.message : "No se pudo cargar la demostración.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const route = () => {
      setPage(currentPage());
      setDuelId(routeDuelId());
      if (new URLSearchParams(window.location.hash.split("?")[1] ?? "").has("partidas")) setDuel(null);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    if (!persistent || page !== "arena" || !duelId || duel?.id === duelId) return;
    let ignore = false;
    setStarting(true);
    setError("");
    setDuel(null);
    api.duel(duelId).then(next => { if (!ignore) setDuel(next); })
      .catch(e => { if (!ignore) setError(e instanceof Error ? e.message : "No se pudo recuperar la partida."); })
      .finally(() => { if (!ignore) setStarting(false); });
    return () => { ignore = true; };
  }, [persistent, page, duelId]);
  function showDuel(next: DuelState) {
    setDuel(next);
    window.location.hash = next.mode === "persistent" ? `/arena?partida=${encodeURIComponent(next.id)}` : "/arena";
    setPage("arena");
  }
  async function submitStart(input: CreateDuelRequest) {
    setStarting(true); setError("");
    try {
      const next = await api.createDuel(input);
      const settingsKey = `truco-arena:setup:${input.requestId ?? 'memory'}`;
      let settings = defaultOpponent();
      try {
        const stored = JSON.parse(localStorage.getItem(settingsKey) ?? 'null') as Opponent | null;
        if(stored && ['cpu','local'].includes(stored.mode) && ['facil','normal','dificil'].includes(stored.difficulty)) settings=stored;
      } catch { /* An invalid local preference must not hide a successfully created game. */ }
      rememberOpponent(next, settings);
      localStorage.removeItem(settingsKey);
      pendingStartRef.current = null; setPendingStart(null);
      if (persistent) writePending("truco-arena:sql:start", null);
      showDuel(next);
      void api.decks().then(async result=>{
        const automatic=next.mode==='demo'&&settings.mode==='cpu'?result.decks.find(deck=>deck.id===input.deckIds?.[1]&&isComputerDeck(deck)):undefined;
        // Memory matches already own their card instances; SQL keeps the used deck for its history.
        if(automatic)await api.deleteDeck(automatic.id);
        setDecks(result.decks.filter(deck=>deck.id!==automatic?.id));
      }).catch(()=>setError('La partida fue creada. No se pudo actualizar la lista de mazos; recargá para volver a consultarla.'));
    } catch (e) {
      if (!uncertainFailure(e)) { pendingStartRef.current = null; setPendingStart(null); if (persistent) writePending("truco-arena:sql:start", null); }
      setError(e instanceof Error ? e.message : "No se pudo preparar la mesa.");
    } finally { setStarting(false); }
  }
  async function start(
    scenario: "mesa-abierta" | "inicio" = "mesa-abierta",
    deckIds?: [string, string],
    playerIds?: [string, string],
    settings: Opponent = defaultOpponent(),
    replaceActive = false,
  ) {
    if (persistent) {
      if (!deckIds || !playerIds) { window.location.hash = "/jugar"; return; }
      if (pendingStartRef.current) { setError("Hay un inicio sin resultado confirmado. Reintentá ese mismo inicio antes de crear otro."); return; }
      const input: CreateDuelRequest = { scenario: "inicio", deckIds, playerIds, requestId: crypto.randomUUID(), ...(replaceActive ? {replaceActive:true} : {}) };
      localStorage.setItem(`truco-arena:setup:${input.requestId}`,JSON.stringify(settings));
      pendingStartRef.current = input; setPendingStart(input);
      writePending("truco-arena:sql:start", input);
      await submitStart(input);
    } else {
      localStorage.setItem('truco-arena:setup:memory',JSON.stringify(settings));
      await submitStart({ scenario, deckIds });
    }
  }
  function updateDeck(deck: Deck) {
    setDecks((prev) =>
      prev.some((d) => d.id === deck.id)
        ? prev.map((d) => (d.id === deck.id ? deck : d))
        : [...prev, deck],
    );
  }
  return (
    <div className={`app-shell ${page==='arena'&&duel?'arena-viewport':''}`}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
          document
            .getElementById("main-content")
            ?.scrollIntoView({ block: "start" });
        }}
      >
        Saltar al contenido
      </a>
      <aside className="app-sidebar">
        <a className="brand" href="#/inicio" aria-label="Truco Arena, inicio">
          <span className="brand-mark">
            <Icon name="swords" size={27} />
          </span>
          <span>
            TRUCO<strong>ARENA</strong>
            <small>BATALLA DE NAIPES</small>
          </span>
        </a>
        <span className="sidebar-label">TU MESA</span>
        <nav aria-label="Navegación principal">
          {navigation.map((item) => (
            <a
              href={item.id === "arena" && persistent && duel ? `#/arena?partida=${duel.id}` : `#/${item.id}`}
              key={item.id}
              className={page === item.id ? "active" : ""}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {page === item.id && <span className="nav-indicator" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="help-link" aria-haspopup="dialog" onClick={() => setHelp(true)}>
            <Icon name="help" size={18} />
            Sobre el juego
          </button>
          <div className="demo-profile">
            <span className="profile-avatar">TA</span>
            <span>
              <strong>Jugador local</strong>
              <small>La mesa es de todos</small>
            </span>
            <span className="live-dot" />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <div className="topbar">
          <span className="topbar-breadcrumb">
            TRUCO ARENA<span>/</span>
            {navigation.find((item) => item.id === page)?.label}
          </span>
          <div className="topbar-status">
            <span className={`connection-dot ${online ? "online" : ""}`} />
            <span>{online ? "Conectado" : health?.database === "unavailable" ? "Sin conexión" : "Conectando…"}</span>
            <span className="demo-badge">{persistent ? `Modo local · ${health.database === "connected" ? "Partidas guardadas" : "Sin conexión"}` : health?.storage === "memory" ? "Modo demostración" : "Conectando…"}</span>
          </div>
        </div>
        <main
          id="main-content"
          className={`main-content page-${page}`}
          tabIndex={-1}
        >
          {error && (
            <Notice onClose={() => setError("")}>
              {error}
              <button className="inline-retry" onClick={() => void load()}>
                Reintentar conexión
              </button>
              {pendingStart && <button className="button secondary" disabled={starting} onClick={() => void submitStart(pendingStart)}>Reintentar inicio pendiente</button>}
            </Notice>
          )}
          {help && <AboutDialog persistent={persistent} onClose={() => setHelp(false)} />}
          {persistent && pendingStart && !error && !starting && <PopupNotice title="Inicio pendiente" identity={pendingStart.requestId??'pending-start'}>Hay un inicio pendiente de confirmar. <button className="button secondary" onClick={() => void submitStart(pendingStart)}>Reintentar inicio pendiente</button></PopupNotice>}
          {loading ? (
            <div className="loading-state" role="status">
              <span className="loading-spinner" />
              <h2>Preparando los naipes…</h2>
              <p>Conectando con tu API local.</p>
            </div>
          ) : cards.length === 0 ? (
            <div className="empty-state">
              <Icon name="cards" size={42} />
              <h1>Falta abrir la mesa</h1>
              <p>
                Iniciá el backend en el puerto 4000 para cargar el catálogo y
                navegar por la demo.
              </p>
              <button className="button primary" onClick={() => void load()}>
                Volver a intentar
              </button>
            </div>
          ) : (
            <>
              {page === "inicio" && (
                <Home cards={cards} persistent={persistent} onPlay={() => { if (!persistent && defaultOpponent().mode === 'local') void start(); else window.location.hash = '/jugar'; }} />
              )}{" "}
              {page === "coleccion" && <Collection cards={cards} persistent={persistent} players={selectablePlayers} onRandomDraft={draft => { setRandomDraft(draft); window.location.hash = '/mazos'; }} />}{" "}
              {page === "mazos" && (
                <Decks
                  cards={cards}
                  decks={selectableDecks}
                  players={selectablePlayers}
                  initialDraft={randomDraft}
                  onDraftConsumed={() => setRandomDraft(null)}
                  persistent={persistent}
                  onSaved={updateDeck}
                  onDeleted={id => setDecks(previous => previous.filter(deck => deck.id !== id))}
                />
              )}{" "}
              {page === 'jugar' && <Play cards={cards} players={selectablePlayers} decks={selectableDecks} persistent={persistent} onPlay={(ids,owners,settings,replace)=>start('inicio',ids,owners,settings,replace)} />}
              {page === "arena" &&
                (duel ? (
                  <Battlefield
                    key={duel.id}
                    cards={cards}
                    duel={duel}
                    onUpdate={setDuel}
                    onReset={(scenario) => { if(!persistent && opponentFor(duel).mode==='local') void start(scenario); else window.location.hash = '/jugar'; }}
                  />
                ) : persistent ? <PersistentGames players={selectablePlayers} onPlayerCreated={p => setPlayers(prev => [...prev, p])} onRecover={async id => { setStarting(true); setError(""); try { showDuel(await api.duel(id)); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo recuperar."); } finally { setStarting(false); } }} /> : (
                  <section className="arena-welcome">
                    <span className="eyebrow">BIENVENIDO A LA MESA</span>
                    <h1>
                      Todo empieza
                      <br />
                      con una buena mano.
                    </h1>
                    <p>
                      Probá una mesa preparada para aprender a invocar y atacar,
                      o empezá una partida desde cero.
                    </p>
                    <div>
                      <button
                        className="button primary large"
                        disabled={starting}
                        onClick={() => void start()}
                      >
                        <Icon name="swords" />
                        Abrir mesa preparada
                      </button>
                      <button
                        className="button secondary"
                        disabled={starting}
                        onClick={() => void start("inicio")}
                      >
                        Partida desde cero
                      </button>
                    </div>
                    <p className="small-note">
                      Modo presencial de demostración. Las partidas son temporales.
                    </p>
                  </section>
                ))}
            </>
          )}
          {starting && (
            <div className="starting-overlay" role="status">
              <span className="loading-spinner" />
              <span>Repartiendo las cartas…</span>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>
            TRUCO ARENA <i>✦</i> HECHO PARA LA MESA
          </span>
          <span>Batalla de naipes</span>
        </footer>
      </div>
    </div>
  );
}
