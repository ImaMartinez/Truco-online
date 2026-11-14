import type { Card as CardData } from "../../../shared/contracts";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";

export function Home({
  cards,
  onPlay,
  persistent = false,
}: {
  cards: CardData[];
  onPlay: () => void;
  persistent?: boolean;
}) {
  const showcase = ["BAS-01", "ESP-01", "ORO-07"]
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is CardData => Boolean(card));
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow">
            <i />
            LOS NAIPES DE SIEMPRE. UNA NUEVA BATALLA.
          </span>
          <h1>
            La mesa está lista.
            <br />
            <em>Tu estrategia,</em>
            <br />
            por jugar.
          </h1>
          <p>
            Espadas, bastos, oros y copas.
            <br />
            Armá tu mazo, dominá la mesa y llevate la victoria.
          </p>
          <div className="hero-buttons">
            <button className="button primary large" onClick={onPlay}>
              <Icon name="swords" />
              {persistent ? "Jugar contra la PC" : "Entrar a la arena"}
              <Icon name="arrow" />
            </button>
            <a href="#/coleccion" className="text-link">
              Explorar las cartas <Icon name="chevron" size={16} />
            </a>
          </div>
          <div className="hero-footnote">
            <span className="live-dot" /> {persistent ? "Mazos guardados · Tres dificultades" : "Juego local · Tres dificultades · Sin registro"}
          </div>
        </div>
        <div
          className="hero-visual"
          aria-label="Cartas españolas originales de Truco Arena"
        >
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <span className="hero-spark spark-one">✦</span>
          <span className="hero-spark spark-two">✦</span>
          <div className="hero-fan">
            {showcase.map((card, i) => (
              <div className={`fan-card fan-${i}`} key={card.id}>
                <Card card={card} />
              </div>
            ))}
          </div>
          <div className="hero-seal">
            <span>TRUCO</span>
            <strong>ARENA</strong>
            <small>BATALLA DE NAIPES</small>
          </div>
          <span className="visual-caption">
            TRADICIÓN EN CADA CARTA. ESTRATEGIA EN CADA TURNO.
          </span>
        </div>
      </section>
      <div className="home-stats">
        <div>
          <strong>40</strong>
          <span>NAIPES ESPAÑOLES</span>
        </div>
        <div>
          <strong>20</strong>
          <span>CARTAS POR MAZO</span>
        </div>
        <div>
          <strong>20</strong>
          <span>PUNTOS DE VIDA</span>
        </div>
        <div>
          <strong>2</strong>
          <span>JUGADORES, UNA MESA</span>
        </div>
      </div>
      <section className="discover-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TU PRÓXIMA JUGADA</span>
            <h2>Conocé tu arena</h2>
          </div>
          <span className="section-note">
            Fácil de empezar. Mucho por decidir.
          </span>
        </div>
        <div className="discover-grid">
          <a className="discover-card" href="#/coleccion">
            <span className="feature-icon">
              <Icon name="cards" size={25} />
            </span>
            <h3>Tu colección</h3>
            <p>Conocé las cuarenta cartas y encontrá tu estilo de juego.</p>
            <span>
              Ver las cartas <Icon name="arrow" size={17} />
            </span>
          </a>
          <a className="discover-card" href="#/mazos">
            <span className="feature-icon">
              <Icon name="deck" size={25} />
            </span>
            <h3>Tu mejor mazo</h3>
            <p>Veinte cartas. Dos copias como máximo. Infinitas decisiones.</p>
            <span>
              Preparar un mazo <Icon name="arrow" size={17} />
            </span>
          </a>
          <button className="discover-card" onClick={onPlay}>
            <span className="feature-icon">
              <Icon name="swords" size={25} />
            </span>
            <h3>Una buena partida</h3>
            <p>{persistent ? "Prepará tu mazo y elegí cómo querés jugar." : "Probá una mesa preparada y descubrí el combate por turnos."}</p>
            <span>
              {persistent ? "Preparar partida" : "Jugar la demo"} <Icon name="arrow" size={17} />
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
