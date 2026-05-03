"use client";
// ComoFuncionaLiga — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-list (.como-funciona, líneas 3082-3093).

import { useState } from "react";

export function ComoFuncionaLiga() {
  const [abierto, setAbierto] = useState(true);
  return (
    <div className="como-funciona">
      <button
        type="button"
        className="como-funciona-header"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <div className="como-funciona-title">📋 Cómo funciona la Liga</div>
        <span className="como-funciona-toggle">{abierto ? "−" : "+"}</span>
      </button>
      {abierto ? (
        <div className="como-funciona-body">
          <div className="cf-item">
            <span className="cf-bullet">1</span>
            <div>
              <strong>Armá tu combinada</strong> de 5 predicciones por cada
              partido cubierto: resultado, ambos anotan, ±2.5 goles, tarjeta
              roja, marcador exacto.
            </div>
          </div>
          <div className="cf-item">
            <span className="cf-bullet">2</span>
            <div>
              <strong>Editá cuantas veces quieras</strong> hasta el kickoff.
              Después queda fija.
            </div>
          </div>
          <div className="cf-item">
            <span className="cf-bullet gold">★</span>
            <div>
              <strong>Marcador exacto = 8 pts</strong>. Tarjeta roja = 6 pts.
              Resultado = 3 pts.
            </div>
          </div>
          <div className="cf-item">
            <span className="cf-bullet gold">★</span>
            <div>
              <strong>Top 10 del mes cobra en efectivo</strong>. Pago por Yape
              dentro de 3 días hábiles del cierre.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
