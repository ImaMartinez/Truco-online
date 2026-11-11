/** Disposable in-memory UI simulator. NOT the definitive rules engine or SQL validation. */
import { randomUUID, randomInt } from 'node:crypto';
import type { ActionRequest, Card, CardInstance, CreateDuelRequest, Deck, DeckInput, DemoPlayer, DuelState } from '../../../shared/contracts.js';
import type { ArenaRepository } from '../repositories/arena-repository.js';
import { ApiError, invalid } from '../errors.js';
import { deckInput } from '../validation.js';
import {DECK_SIZE,isPlayableDeckSize} from '../../../shared/deck-rules.js';
import catalogData from './catalog.json' with { type: 'json' };

const cards = catalogData.cards as Card[];
const cardIndex = new Map(cards.map(card => [card.id, card]));
const MAX_DUELS = 50;
const MAX_DECKS = 30;
type StoredDuel = { state: DuelState; piles: [CardInstance[], CardInstance[]] };
const copy = <T>(value: T): T => structuredClone(value);

function cardFor(instance: CardInstance): Card {
  const card = cardIndex.get(instance.cardId);
  if (!card) throw new Error('Demo catalog reference missing.');
  return card;
}

function total(deck: Deck): number {
  return deck.entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

function instances(deck: Deck, shuffled: boolean): CardInstance[] {
  const result = deck.entries.flatMap(entry => Array.from({ length: entry.quantity }, () => {
    const card = cardIndex.get(entry.cardId)!;
    return { id: randomUUID(), cardId: card.id, health: card.health, enteredTurn: 0, lastAttackTurn: null };
  }));
  if (shuffled) {
    for (let index = result.length - 1; index > 0; index--) {
      const other = randomInt(index + 1);
      [result[index], result[other]] = [result[other]!, result[index]!];
    }
  }
  return result;
}

function template(id: string, name: string, description: string, ids: string[]): Deck {
  return { id, name, description, entries: ids.map(cardId => ({ cardId, quantity: 2 })) };
}

export class DemoRepository implements ArenaRepository {
  readonly source = `${catalogData.source.path} · catálogo ${catalogData.source.catalogVersion}`;
  private readonly decks = new Map<string, Deck>([
    ['mesa-espadas', template('mesa-espadas', 'Mesa de espadas', 'Curva equilibrada · 12 cartas · promedio 2,17', ['ESP-04', 'ESP-05', 'ESP-02', 'ESP-06', 'ESP-03', 'ESP-07'])],
    ['ronda-copas', template('ronda-copas', 'Ronda de copas', 'Control del campo · 12 cartas · promedio 2,17', ['COP-04', 'COP-05', 'COP-02', 'COP-06', 'COP-03', 'COP-12'])],
    ['espadas-20', template('espadas-20', 'Espadas · 20 cartas', 'Formato de 20 cartas', ['ESP-04','ESP-05','ESP-02','ESP-06','ESP-03','ESP-07','ESP-01','ESP-10','ESP-11','ESP-12'])],
    ['copas-20', template('copas-20', 'Copas · 20 cartas', 'Formato de 20 cartas', ['COP-04','COP-05','COP-02','COP-06','COP-03','COP-12','COP-01','COP-07','COP-10','COP-11'])],
  ]);
  private readonly duels = new Map<string, StoredDuel>();

  listCards(): Card[] { return copy(cards); }
  listDecks(): Deck[] { return copy([...this.decks.values()]); }
  deleteDeck(id: string): void {
    if (!this.decks.delete(id)) throw new ApiError(404, 'MAZO_NO_ENCONTRADO', 'Ese mazo ya no está disponible.');
  }

  saveDeck(value: DeckInput, id?: string): Deck {
    const input = deckInput(value);
    if (id && !this.decks.has(id)) throw new ApiError(404, 'MAZO_NO_ENCONTRADO', 'Ese mazo de demostración ya no está disponible.');
    if (!id && this.decks.size >= MAX_DECKS) throw new ApiError(409, 'LIMITE_DEMO', 'La demo admite hasta 30 mazos. Reiniciá el backend para limpiar la memoria.');
    const seen = new Set<string>();
    for (const entry of input.entries) {
      if (!cardIndex.has(entry.cardId)) invalid('El mazo contiene una carta que no existe en el catálogo.');
      if (seen.has(entry.cardId)) invalid('No repitas el mismo tipo en dos renglones: ajustá su cantidad.');
      seen.add(entry.cardId);
    }
    const deck: Deck = { id: id ?? randomUUID(), name: input.name, description: input.description ?? '', entries: copy(input.entries) };
    if (total(deck) > DECK_SIZE) invalid(`El mazo no puede superar las ${DECK_SIZE} cartas.`);
    this.decks.set(deck.id, deck);
    return copy(deck);
  }

  createDuel(input: CreateDuelRequest): DuelState {
    const ids = input.deckIds ?? ['mesa-espadas', 'ronda-copas'];
    const selected = ids.map(id => this.decks.get(id));
    if (!selected[0] || !selected[1]) throw new ApiError(404, 'MAZO_NO_ENCONTRADO', 'Seleccioná dos mazos disponibles.');
    if (selected.some(deck => !isPlayableDeckSize(total(deck!)))) invalid('Para iniciar la mesa, ambos mazos deben tener 20 cartas o ser clásicos de 12.');
    if(total(selected[0])!==total(selected[1])) invalid('Ambos jugadores deben usar mazos del mismo tamaño.');
    const scenario = input.scenario ?? 'mesa-abierta';
    const prepared = scenario === 'mesa-abierta';
    const piles: [CardInstance[], CardInstance[]] = [instances(selected[0], !prepared), instances(selected[1], !prepared)];
    const fieldCards = prepared ? piles.map(pile => {
      const index = pile.findIndex(instance => cardFor(instance).cost <= 2 && cardFor(instance).attack >= 2);
      return pile.splice(index < 0 ? 0 : index, 1)[0]!;
    }) : [];
    // Prepared scenes are a presentation fixture, not a reconstructed historical SQL match.
    const ownTurn = prepared ? Math.max(3, ...fieldCards.map(instance => cardFor(instance).cost + 1)) : 1;
    const turn = ownTurn * 2 - 1;
    const players = [0, 1].map(index => {
      const playerIndex = index as 0 | 1;
      const field = fieldCards[playerIndex];
      if (field) field.enteredTurn = turn - (index === 0 ? 2 : 1);
      const drawn = prepared ? ownTurn + (index === 0 ? 1 : 0) : 3;
      const hand = piles[playerIndex].splice(0, drawn);
      return {
        id: `jugador-${index + 1}`,
        name: index === 0 ? 'Vos' : 'Rival',
        life: 20,
        energy: index === 0 ? Math.min(5, ownTurn) : prepared ? Math.max(0, Math.min(5, ownTurn - 1) - cardFor(field!).cost) : 0,
        maxEnergy: index === 0 ? Math.min(5, ownTurn) : prepared ? Math.min(5, ownTurn - 1) : 0,
        hand, field: field ? [field] : [], deckCount: piles[playerIndex].length, discardCount: 0,
      } satisfies DemoPlayer;
    }) as [DemoPlayer, DemoPlayer];
    const state: DuelState = {
      id: randomUUID(), version: 1, turn, activePlayerId: players[0].id, players,
      status: 'active', winnerId: null, mode: 'demo', scenario,
      log: [prepared ? 'Mesa preparada: elegí una carta en mano o un atacante en campo. Todo es simulación.' : 'Comienza una simulación desde cero. Tres cartas para cada participante.'],
    };
    // Bounded memory, no real sessions/history. Oldest demo is evicted after 50 tables.
    if (this.duels.size >= MAX_DUELS) this.duels.delete(this.duels.keys().next().value!);
    this.duels.set(state.id, { state, piles });
    return copy(state);
  }

  getDuel(id: string): DuelState { return copy(this.find(id).state); }

  private find(id: string): StoredDuel {
    const duel = this.duels.get(id);
    if (!duel) throw new ApiError(404, 'MESA_NO_ENCONTRADA', 'Esta mesa ya no está en memoria. Iniciá otra demostración.');
    return duel;
  }

  act(id: string, request: ActionRequest): DuelState {
    const previous = this.find(id);
    if (request.expectedVersion !== previous.state.version) throw new ApiError(409, 'ESTADO_DESACTUALIZADO', 'La mesa cambió. Actualizá su estado antes de repetir la acción.');
    if (previous.state.status !== 'active') throw new ApiError(409, 'PARTIDA_FINALIZADA', 'La simulación terminó. Reiniciá la mesa para jugar otra.');
    // Copy-before-write keeps rejections unchanged. This is only a demo adapter, not SQL atomicity.
    const draft = copy(previous);
    const state = draft.state;
    const index: 0 | 1 = state.activePlayerId === state.players[0].id ? 0 : 1;
    const actor = state.players[index];
    const rival = state.players[index === 0 ? 1 : 0];
    const action = request.action;
    if (action.type === 'play') {
      const handIndex = actor.hand.findIndex(instance => instance.id === action.instanceId);
      if (handIndex < 0) invalid('Elegí una copia de tu mano actual.');
      const instance = actor.hand[handIndex]!;
      const card = cardFor(instance);
      if (actor.field.length >= 3) throw new ApiError(409, 'CAMPO_LLENO', 'Tenés tres cartas en campo. Necesitás un espacio libre.');
      if (actor.energy < card.cost) throw new ApiError(409, 'ENERGIA_INSUFICIENTE', 'No alcanza la energía de este turno para esa carta.');
      actor.energy -= card.cost;
      actor.hand.splice(handIndex, 1);
      actor.field.push({ ...instance, health: card.health, enteredTurn: state.turn });
      state.log.push(`${actor.name} invocó ${card.name}. Espera al próximo turno propio para atacar.`);
    } else if (action.type === 'attack') {
      const attacker = actor.field.find(instance => instance.id === action.attackerId);
      if (!attacker) invalid('Elegí un atacante de tu campo.');
      if (attacker.enteredTurn >= state.turn) throw new ApiError(409, 'CARTA_NUEVA', 'Esa carta acaba de entrar y todavía no puede atacar.');
      if (attacker.lastAttackTurn === state.turn) throw new ApiError(409, 'CARTA_AGOTADA', 'Esa copia ya atacó en este turno.');
      const attack = cardFor(attacker).attack;
      if (action.targetId === 'hero') {
        if (rival.field.length) throw new ApiError(409, 'HEROE_PROTEGIDO', 'Primero despejá las cartas del campo rival.');
        rival.life = Math.max(0, rival.life - attack);
        state.log.push(`${cardFor(attacker).name} hizo ${attack} de daño al héroe rival.`);
      } else {
        const target = rival.field.find(instance => instance.id === action.targetId);
        if (!target) invalid('Elegí una carta del campo rival como objetivo.');
        const counter = cardFor(target).attack;
        attacker.health = Math.max(0, attacker.health - counter);
        target.health = Math.max(0, target.health - attack);
        state.log.push(`${cardFor(attacker).name} atacó a ${cardFor(target).name}: ${attack} / ${counter} de daño simultáneo.`);
      }
      attacker.lastAttackTurn = state.turn;
      for (const player of state.players) {
        const dead = player.field.filter(instance => instance.health === 0);
        player.discardCount += dead.length;
        player.field = player.field.filter(instance => instance.health > 0);
        for (const instance of dead) state.log.push(`${cardFor(instance).name} pasó al descarte.`);
      }
      if (rival.life === 0) {
        state.status = 'finished'; state.winnerId = actor.id;
        state.log.push(`${actor.name} ganó la simulación al reducir la vida rival a cero.`);
      }
    } else {
      if (state.turn === 30) {
        state.status = 'finished';
        const [one, two] = state.players;
        state.winnerId = one.life === two.life ? null : one.life > two.life ? one.id : two.id;
        state.log.push(state.winnerId ? 'Fin del turno 30: gana quien conserva más vida.' : 'Fin del turno 30: empate de la simulación.');
      } else {
        state.turn++;
        state.activePlayerId = rival.id;
        const own = Math.floor((state.turn + 1) / 2);
        rival.maxEnergy = Math.min(5, own); rival.energy = rival.maxEnergy;
        const nextIndex: 0 | 1 = index === 0 ? 1 : 0;
        if (own > 1) {
          const drawn = draft.piles[nextIndex].shift();
          if (drawn) rival.hand.push(drawn);
          else state.log.push(`${rival.name} no tiene más cartas para robar; no recibe daño.`);
        }
        rival.deckCount = draft.piles[nextIndex].length;
        state.log.push(`Turno ${state.turn}: juega ${rival.name}. Energía ${rival.energy}/${rival.maxEnergy}.`);
      }
    }
    state.version++;
    state.log = state.log.slice(-60);
    this.duels.set(id, draft);
    return copy(state);
  }
}
