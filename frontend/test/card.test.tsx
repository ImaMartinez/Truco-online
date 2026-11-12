import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Card } from "../src/components/Card";
import { SuitSymbol } from "../src/components/SuitSymbol";
import type { Card as CardData, Suit } from "../../shared/contracts";

const card: CardData = {
  id: "ESP-01",
  name: "Ancho de espadas",
  suit: "espadas",
  number: 1,
  attack: 6,
  health: 5,
  cost: 5,
  hierarchy: 1,
};
test("card presentation uses HTTP data including current instance health", () => {
  const markup = renderToStaticMarkup(
    <Card
      card={card}
      instance={{
        id: "copy-1",
        cardId: card.id,
        health: 2,
        enteredTurn: 1,
        lastAttackTurn: null,
      }}
    />,
  );
  assert.match(markup, /Ancho de espadas, energía 5, ataque 6, vida 2/);
  assert.match(markup, /data-card-id="ESP-01"/);
  assert.match(markup, /health-stat damaged/);
});
test("card labels escape data supplied by the API", () => {
  const markup = renderToStaticMarkup(
    <Card card={{ ...card, name: "<script>alert(1)</script>" }} />,
  );
  assert.ok(!markup.includes("<script>"));
  assert.match(markup, /&lt;script&gt;/);
});
test("all four original suits render independently without external artwork", () => {
  for (const suit of ["espadas", "bastos", "oros", "copas"] as Suit[]) {
    const markup = renderToStaticMarkup(<SuitSymbol suit={suit} />);
    assert.match(markup, /<svg/);
    assert.match(markup, /<path/);
    assert.ok(!markup.includes("<image"));
  }
});
