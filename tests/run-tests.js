const assert = require("assert");
const E = require("../js/sim-engine.js");

function nearly(actual, expected, label) {
  assert(Math.abs(actual - expected) < 1e-9, `${label}: esperado ${expected}, recibido ${actual}`);
}

const batch = E.examples.verifiedBatch;
const fcfs = E.runSimulation(batch, "fcfs", { contextCost: 0, maxTime: 80 });
nearly(fcfs.metrics.averageWait, 10, "FCFS espera promedio");
nearly(fcfs.metrics.averageTurnaround, 15.5, "FCFS retorno promedio");

const sjf = E.runSimulation(batch, "sjf", { contextCost: 0, maxTime: 80 });
nearly(sjf.metrics.averageWait, 5, "SJF espera promedio");
nearly(sjf.metrics.averageTurnaround, 10.5, "SJF retorno promedio");
assert.deepStrictEqual(sjf.gantt.filter((s) => s.kind === "run").map((s) => s.id), ["P3", "P2", "P4", "P1"], "SJF ordena por ráfaga");

const srtf = E.runSimulation(E.examples.srtfPreempt, "srtf", { maxTime: 40 });
assert(srtf.gantt.some((s) => s.id === "P2" && s.start === 2), "SRTF expropia cuando llega P2");

const rr = E.runSimulation([
  { id: "P1", arrival: 0, burst: 5 },
  { id: "P2", arrival: 0, burst: 3 }
], "rr", { quantum: 2, maxTime: 30 });
assert.deepStrictEqual(rr.gantt.filter((s) => s.kind === "run").map((s) => s.id), ["P1", "P2", "P1", "P2", "P1"], "Round Robin respeta quantum");

const io = E.runSimulation([{ id: "P1", arrival: 0, burst: 4, io: [{ after: 1, duration: 3 }] }, { id: "P2", arrival: 0, burst: 2 }], "fcfs", { maxTime: 30 });
assert(io.events.some((e) => e.text.includes("solicita E/S")), "Registra bloqueo por E/S");
assert(io.rows.find((r) => r.id === "P1").wait >= 0, "Espera se acumula por cola de preparados");

const tie = E.runSimulation([{ id: "P1", arrival: 0, burst: 3 }, { id: "P2", arrival: 0, burst: 3 }], "sjf", { maxTime: 20 });
assert.strictEqual(tie.gantt[0].id, "P1", "Empate conserva orden de carga");

const aging = E.runSimulation(E.examples.priority, "aging", { agingEvery: 1, maxTime: 40 });
assert(aging.events.some((e) => e.text.includes("Envejecimiento")), "Registra envejecimiento");

const lotteryA = E.runSimulation(E.examples.rr, "lottery", { seed: 123, quantum: 1, maxTime: 30 });
const lotteryB = E.runSimulation(E.examples.rr, "lottery", { seed: 123, quantum: 1, maxTime: 30 });
assert.deepStrictEqual(lotteryA.lotteryDraws, lotteryB.lotteryDraws, "Lotería reproducible con la misma semilla");

const rtOk = E.runRealtime(E.examples.realtimeOk, "edf", { horizon: 24 });
assert.strictEqual(rtOk.metrics.missed, 0, "EDF cumple escenario viable");
const rtOver = E.runRealtime(E.examples.realtimeOverload, "edf", { horizon: 30 });
assert(rtOver.metrics.missed > 0, "Escenario sobrecargado incumple plazos");

console.log("Todas las verificaciones pasaron.");
