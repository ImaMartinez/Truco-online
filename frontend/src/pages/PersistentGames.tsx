import { useEffect, useState } from "react";
import type { ActiveDuel, Player } from "../../../shared/contracts";
import { api } from "../api";
import { PlayerOptions } from '../components/PlayerOptions';
import { Notice } from "../components/GameHeader";

export function PersistentGames({ players, onPlayerCreated, onRecover }: { players: Player[]; onPlayerCreated: (player: Player) => void; onRecover: (id: string) => void }) {
  const [owner, setOwner] = useState(players[0]?.id ?? "");
  const [duels, setDuels] = useState<ActiveDuel[]>([]);
  const [alias, setAlias] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!owner) return;
    let ignore = false;
    setDuels([]); setError("");
    api.activeDuels(owner).then(result => { if (!ignore) setDuels(result.duels); }).catch(e => { if (!ignore) setError(e instanceof Error ? e.message : "No se pudieron consultar partidas."); });
    return () => { ignore = true; };
  }, [owner]);
  async function createPlayer() {
    setBusy(true); setError("");
    try { const player = await api.createPlayer(alias); onPlayerCreated(player); setOwner(player.id); setAlias(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el jugador."); }
    finally { setBusy(false); }
  }
  return <section className="arena-welcome persistent-games"><span className="eyebrow">VOLVÉ A LA MESA</span><h1>Tu mesa continúa.</h1><p>Elegí una partida guardada para continuar o prepará una nueva.</p><a className="button primary" href="#/jugar">Jugar contra la computadora</a>{error && <Notice onClose={() => setError("")}>{error}</Notice>}<div className="persistent-panel"><h2>Partidas activas</h2><label>Jugador<select aria-label="Jugador para recuperar partida" value={owner} onChange={e => setOwner(e.target.value)}><PlayerOptions players={players} /></select></label>{duels.length ? duels.map(d => <button className="button secondary" key={d.id} onClick={() => onRecover(d.id)}>{players.find(player => player.id === owner)?.alias} · Partida {d.id} · Turno {d.turn}</button>) : <p>No hay partidas activas para este jugador.</p>}</div><div className="persistent-panel"><h2>Nuevo jugador</h2><label>Alias<input aria-label="Alias del nuevo jugador" maxLength={40} value={alias} onChange={e => setAlias(e.target.value)} /></label><button className="button secondary" disabled={busy || !alias.trim()} onClick={() => void createPlayer()}>{busy ? "Creando…" : "Crear jugador"}</button><p className="small-note">Los nuevos jugadores comienzan con dos copias de cada tipo del catálogo.</p></div></section>;
}
