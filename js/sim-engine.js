(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SchedulerEngine = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#be123c", "#4d7c0f"];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const byArrival = (a, b) => a.arrival - b.arrival || a.index - b.index;

  function makeRng(seed) {
    let state = (Number(seed) || 1) >>> 0;
    return function rng() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function normalizeProcesses(input) {
    return clone(input).map((p, index) => ({
      id: String(p.id || `P${index + 1}`).trim(),
      arrival: Math.max(0, Number(p.arrival) || 0),
      burst: Math.max(1, Number(p.burst) || 1),
      priority: Number.isFinite(Number(p.priority)) ? Number(p.priority) : 5,
      tickets: Math.max(1, Number(p.tickets) || 10),
      weight: Math.max(1, Number(p.weight) || 1),
      user: String(p.user || (index % 2 ? "Usuario B" : "Usuario A")),
      queue: Math.max(0, Number(p.queue) || 0),
      io: Array.isArray(p.io) ? p.io.map((op) => ({
        after: Math.max(1, Number(op.after) || 1),
        duration: Math.max(1, Number(op.duration) || 1),
        used: false
      })) : [],
      index,
      color: p.color || COLORS[index % COLORS.length]
    }));
  }

  function makeState(processes) {
    return {
      time: 0,
      cpu: null,
      ready: [],
      blocked: [],
      done: [],
      events: [],
      gantt: [],
      overhead: 0,
      useful: 0,
      idle: 0,
      contextSwitches: 0,
      lastCpuId: null,
      quantumLeft: 0,
      lotteryDraws: [],
      processes: processes.map((p) => ({
        ...p,
        remaining: p.burst,
        executed: 0,
        readyWait: 0,
        firstRun: null,
        finish: null,
        blockedUntil: null,
        service: 0,
        ageBoost: 0,
        cpuInQueue: 0,
        estimated: p.estimated || p.burst
      }))
    };
  }

  function recordEvent(state, text) {
    state.events.push({ time: state.time, text });
  }

  function appendGantt(state, id, kind) {
    const last = state.gantt[state.gantt.length - 1];
    if (last && last.id === id && last.kind === kind && last.end === state.time) {
      last.end = state.time + 1;
    } else {
      state.gantt.push({ id, kind, start: state.time, end: state.time + 1 });
    }
  }

  function statusSnapshot(state, decision) {
    return {
      time: state.time,
      cpu: state.cpu ? state.cpu.id : null,
      ready: state.ready.map((p) => p.id),
      blocked: state.blocked.map((p) => `${p.id} hasta t=${p.blockedUntil}`),
      done: state.done.map((p) => p.id),
      gantt: clone(state.gantt),
      events: state.events.slice(-10),
      decision,
      quantumLeft: state.quantumLeft,
      queues: buildQueueSnapshot(state),
      lotteryDraws: clone(state.lotteryDraws)
    };
  }

  function buildQueueSnapshot(state) {
    const queues = {};
    [...state.ready, ...(state.cpu ? [state.cpu] : [])].forEach((p) => {
      const key = `Q${p.queue || 0}`;
      if (!queues[key]) queues[key] = [];
      queues[key].push(p.id);
    });
    return queues;
  }

  function betterProcess(a, b, algorithm, state, options) {
    if (!b) return a;
    if (!a) return b;
    const pick = (cmp) => (cmp < 0 ? a : cmp > 0 ? b : (byArrival(a, b) < 0 ? a : b));
    if (algorithm === "sjf") return pick(a.burst - b.burst);
    if (algorithm === "srtf") return pick(a.remaining - b.remaining);
    if (algorithm === "priority" || algorithm === "priority-preemptive" || algorithm === "aging") {
      const ap = a.priority - (algorithm === "aging" ? a.ageBoost : 0);
      const bp = b.priority - (algorithm === "aging" ? b.ageBoost : 0);
      return pick(ap - bp);
    }
    if (algorithm === "predicted") return pick(a.estimated - b.estimated);
    if (algorithm === "guaranteed") {
      const elapsed = Math.max(1, state.time + 1);
      const ar = a.service / elapsed / a.weight;
      const br = b.service / elapsed / b.weight;
      return pick(ar - br);
    }
    if (algorithm === "fair") {
      const userShare = (p) => state.processes.filter((x) => x.user === p.user).reduce((sum, x) => sum + x.service, 0);
      return pick(userShare(a) - userShare(b));
    }
    if (algorithm === "mlq" || algorithm === "mlfq") return pick((a.queue || 0) - (b.queue || 0));
    return byArrival(a, b) < 0 ? a : b;
  }

  function chooseReady(state, algorithm, options, rng) {
    if (!state.ready.length) return null;
    if (algorithm === "rr") return state.ready[0];
    if (algorithm === "lottery") {
      const total = state.ready.reduce((s, p) => s + p.tickets, 0);
      const roll = rng() * total;
      let acc = 0;
      for (const p of state.ready) {
        acc += p.tickets;
        if (roll < acc) {
          state.lotteryDraws.push({ time: state.time, roll: Number(roll.toFixed(3)), winner: p.id, total });
          return p;
        }
      }
      return state.ready[state.ready.length - 1];
    }
    return state.ready.reduce((best, p) => betterProcess(p, best, algorithm, state, options), null);
  }

  function removeReady(state, process) {
    const idx = state.ready.indexOf(process);
    if (idx >= 0) state.ready.splice(idx, 1);
  }

  function addArrivals(state) {
    for (const p of state.processes) {
      if (p.arrival === state.time && !state.ready.includes(p) && !state.cpu && !state.blocked.includes(p) && !state.done.includes(p) && p.executed === 0) {
        state.ready.push(p);
        recordEvent(state, `Llega ${p.id} y entra a preparados.`);
      } else if (p.arrival === state.time && p.executed === 0 && !state.ready.includes(p) && !state.blocked.includes(p) && !state.done.includes(p)) {
        state.ready.push(p);
        recordEvent(state, `Llega ${p.id} y espera CPU.`);
      }
    }
  }

  function unblock(state) {
    const returning = state.blocked.filter((p) => p.blockedUntil <= state.time);
    state.blocked = state.blocked.filter((p) => p.blockedUntil > state.time);
    returning.sort(byArrival).forEach((p) => {
      p.blockedUntil = null;
      state.ready.push(p);
      recordEvent(state, `${p.id} termina E/S y regresa a preparados.`);
    });
  }

  function needsIo(p) {
    return p.io.find((op) => !op.used && p.executed >= op.after && p.remaining > 0);
  }

  function addContextCost(state, options, next) {
    const cost = Math.max(0, Number(options.contextCost) || 0);
    if (!next || !state.lastCpuId || state.lastCpuId === next.id || cost === 0) return;
    for (let i = 0; i < cost; i += 1) {
      appendGantt(state, "CC", "overhead");
      state.overhead += 1;
      state.time += 1;
      state.contextSwitches += 1;
      recordEvent(state, "Costo de cambio de contexto.");
      unblock(state);
      addArrivals(state);
    }
  }

  function tickWait(state, running) {
    state.ready.forEach((p) => {
      if (p !== running) {
        p.readyWait += 1;
        p.ageBoost += 1;
      }
    });
  }

  function runSimulation(inputProcesses, algorithm, opts = {}) {
    const options = { quantum: 2, contextCost: 0, maxTime: 80, agingEvery: 4, boostEvery: 12, seed: 7, ...opts };
    const state = makeState(normalizeProcesses(inputProcesses));
    const preemptive = ["srtf", "priority-preemptive", "aging", "rr", "lottery", "guaranteed", "fair", "mlq", "mlfq"].includes(algorithm);
    const rng = makeRng(options.seed);
    const timeline = [];

    while (state.done.length < state.processes.length && state.time < options.maxTime) {
      unblock(state);
      addArrivals(state);
      if (algorithm === "aging" && state.time > 0 && state.time % options.agingEvery === 0) {
        state.ready.forEach((p) => { p.ageBoost += 1; });
        recordEvent(state, "Envejecimiento: se mejora la prioridad efectiva de quienes esperan.");
      }
      if (algorithm === "mlfq" && state.time > 0 && state.time % options.boostEvery === 0) {
        [...state.ready, ...(state.cpu ? [state.cpu] : [])].forEach((p) => { p.queue = 0; p.cpuInQueue = 0; });
        recordEvent(state, "Ascenso periódico de MLFQ para reducir postergación.");
      }

      let reason = "La CPU conserva la tarea actual.";
      if (!state.cpu || preemptive) {
        const chosen = chooseReady(state, algorithm, options, rng);
        const shouldPreempt = state.cpu && ["srtf", "priority-preemptive", "aging", "mlq", "mlfq"].includes(algorithm) && betterProcess(chosen, state.cpu, algorithm, state, options) === chosen;
        if (chosen && (!state.cpu || shouldPreempt)) {
          if (state.cpu && state.cpu !== chosen) {
            state.ready.push(state.cpu);
            reason = `${chosen.id} toma la CPU según ${labelFor(algorithm)}; ${state.cpu.id} vuelve a preparados.`;
          } else {
            reason = `${chosen.id} toma la CPU según ${labelFor(algorithm)}.`;
          }
          removeReady(state, chosen);
          addContextCost(state, options, chosen);
          state.cpu = chosen;
          state.quantumLeft = ["rr", "mlq", "mlfq", "lottery", "guaranteed", "fair"].includes(algorithm) ? Number(options.quantum) || 2 : Infinity;
        }
      }

      if (!state.cpu) {
        appendGantt(state, "Ociosa", "idle");
        state.idle += 1;
        timeline.push(statusSnapshot(state, "No hay procesos preparados; la CPU queda ociosa."));
        state.time += 1;
        continue;
      }

      const p = state.cpu;
      if (p.firstRun === null) p.firstRun = state.time;
      tickWait(state, p);
      p.remaining -= 1;
      p.executed += 1;
      p.service += 1;
      p.cpuInQueue += 1;
      p.ageBoost = 0;
      state.useful += 1;
      state.lastCpuId = p.id;
      appendGantt(state, p.id, "run");
      timeline.push(statusSnapshot(state, reason));
      state.time += 1;
      state.quantumLeft -= 1;

      const io = needsIo(p);
      if (p.remaining <= 0) {
        p.finish = state.time;
        state.done.push(p);
        recordEvent(state, `${p.id} termina en t=${state.time}.`);
        state.cpu = null;
      } else if (io) {
        io.used = true;
        p.blockedUntil = state.time + io.duration;
        state.blocked.push(p);
        recordEvent(state, `${p.id} solicita E/S hasta t=${p.blockedUntil}.`);
        state.cpu = null;
      } else if (["rr", "lottery", "guaranteed", "fair", "mlq", "mlfq"].includes(algorithm) && state.quantumLeft <= 0) {
        if (algorithm === "mlfq") p.queue = Math.min(2, (p.queue || 0) + 1);
        state.ready.push(p);
        recordEvent(state, `${p.id} agota su quantum y vuelve a preparados.`);
        state.cpu = null;
      }
    }

    return finalize(state, timeline, algorithm, options);
  }

  function finalize(state, timeline, algorithm, options) {
    const rows = state.processes.map((p) => ({
      id: p.id,
      arrival: p.arrival,
      burst: p.burst,
      finish: p.finish,
      turnaround: p.finish === null ? null : p.finish - p.arrival,
      response: p.firstRun === null ? null : p.firstRun - p.arrival,
      wait: p.readyWait,
      service: p.service,
      user: p.user,
      color: p.color
    }));
    const complete = rows.filter((r) => r.finish !== null);
    const avg = (field) => complete.length ? complete.reduce((s, r) => s + r[field], 0) / complete.length : 0;
    return {
      algorithm,
      label: labelFor(algorithm),
      options,
      timeline,
      gantt: state.gantt,
      events: state.events,
      rows,
      processes: state.processes.map((p) => ({ id: p.id, color: p.color, tickets: p.tickets, user: p.user, priority: p.priority })),
      lotteryDraws: state.lotteryDraws,
      metrics: {
        averageWait: avg("wait"),
        averageTurnaround: avg("turnaround"),
        averageResponse: avg("response"),
        throughput: complete.length / Math.max(1, state.time),
        usefulCpu: state.useful,
        idleCpu: state.idle,
        overhead: state.overhead,
        totalTime: state.time,
        utilization: state.useful / Math.max(1, state.time)
      }
    };
  }

  function labelFor(algorithm) {
    return {
      fcfs: "FCFS",
      sjf: "SJF no expropiativo",
      srtf: "SRTF",
      rr: "Round Robin",
      priority: "Prioridades no expropiativo",
      "priority-preemptive": "Prioridades expropiativo",
      aging: "Prioridades con envejecimiento",
      mlq: "Colas multinivel",
      mlfq: "MLFQ",
      predicted: "Próxima ráfaga estimada",
      guaranteed: "Planificación garantizada",
      lottery: "Lotería",
      fair: "Reparto justo"
    }[algorithm] || algorithm;
  }

  function runRealtime(tasks, algorithm, opts = {}) {
    const options = { horizon: 30, contextCost: 0, ...opts };
    const jobs = [];
    const events = [];
    const gantt = [];
    let running = null;
    let useful = 0;
    const normalized = clone(tasks).map((t, index) => ({
      id: t.id || `T${index + 1}`,
      execution: Math.max(1, Number(t.execution) || 1),
      period: Math.max(1, Number(t.period) || 5),
      deadline: Math.max(1, Number(t.deadline) || Number(t.period) || 5),
      color: t.color || COLORS[index % COLORS.length],
      index
    }));
    const timeline = [];
    for (let time = 0; time < options.horizon; time += 1) {
      normalized.forEach((t) => {
        if (time % t.period === 0) {
          const job = { ...t, jobId: `${t.id}.${Math.floor(time / t.period) + 1}`, release: time, absDeadline: time + t.deadline, remaining: t.execution, missed: false };
          jobs.push(job);
          events.push({ time, text: `Llega ${job.jobId}; plazo absoluto t=${job.absDeadline}.` });
        }
      });
      const ready = jobs.filter((j) => j.remaining > 0 && j.release <= time);
      ready.forEach((j) => {
        if (time >= j.absDeadline && !j.missed) {
          j.missed = true;
          events.push({ time, text: `${j.jobId} incumple su plazo.` });
        }
      });
      if (ready.length) {
        running = ready.reduce((best, j) => {
          if (!best) return j;
          if (algorithm === "rm") {
            const cmp = j.period - best.period || j.release - best.release;
            return cmp < 0 ? j : best;
          }
          {
            const cmp = j.absDeadline - best.absDeadline || j.release - best.release;
            return cmp < 0 ? j : best;
          }
        }, null);
        running.remaining -= 1;
        useful += 1;
        const last = gantt[gantt.length - 1];
        if (last && last.id === running.jobId && last.end === time) last.end = time + 1;
        else gantt.push({ id: running.jobId, task: running.id, kind: "run", start: time, end: time + 1 });
        if (running.remaining === 0) events.push({ time: time + 1, text: `${running.jobId} completa antes de t=${running.absDeadline}.` });
      } else {
        const last = gantt[gantt.length - 1];
        if (last && last.id === "Ociosa" && last.end === time) last.end = time + 1;
        else gantt.push({ id: "Ociosa", kind: "idle", start: time, end: time + 1 });
      }
      timeline.push({
        time,
        cpu: running && running.remaining >= 0 ? running.jobId : null,
        ready: ready.map((j) => `${j.jobId} (${j.remaining})`),
        deadlines: jobs.map((j) => ({ jobId: j.jobId, at: j.absDeadline, missed: j.missed, done: j.remaining === 0 })),
        events: events.slice(-8),
        decision: ready.length ? `${algorithm === "rm" ? "Rate Monotonic elige el menor período" : "EDF elige el plazo absoluto más cercano"}: ${running.jobId}.` : "Sin instancias listas."
      });
      running = null;
    }
    return {
      algorithm,
      label: algorithm === "rm" ? "Rate Monotonic" : "Earliest Deadline First",
      tasks: normalized,
      jobs,
      timeline,
      gantt,
      events,
      metrics: {
        utilization: normalized.reduce((s, t) => s + t.execution / t.period, 0),
        usefulCpu: useful,
        totalTime: options.horizon,
        missed: jobs.filter((j) => j.missed).length
      }
    };
  }

  const examples = {
    intro: [
      { id: "P1", arrival: 0, burst: 5, io: [{ after: 2, duration: 3 }] },
      { id: "P2", arrival: 0, burst: 4 },
      { id: "P3", arrival: 1, burst: 3, io: [{ after: 1, duration: 2 }] }
    ],
    verifiedBatch: [
      { id: "P1", arrival: 0, burst: 10 },
      { id: "P2", arrival: 0, burst: 4 },
      { id: "P3", arrival: 0, burst: 2 },
      { id: "P4", arrival: 0, burst: 6 }
    ],
    convoy: [
      { id: "P1", arrival: 0, burst: 12 },
      { id: "P2", arrival: 1, burst: 2 },
      { id: "P3", arrival: 2, burst: 2 },
      { id: "P4", arrival: 3, burst: 1 }
    ],
    srtfPreempt: [
      { id: "P1", arrival: 0, burst: 9 },
      { id: "P2", arrival: 2, burst: 2 },
      { id: "P3", arrival: 3, burst: 1 }
    ],
    rr: [
      { id: "P1", arrival: 0, burst: 5 },
      { id: "P2", arrival: 1, burst: 4, io: [{ after: 2, duration: 2 }] },
      { id: "P3", arrival: 2, burst: 3 }
    ],
    priority: [
      { id: "P1", arrival: 0, burst: 9, priority: 6 },
      { id: "P2", arrival: 1, burst: 2, priority: 1 },
      { id: "P3", arrival: 2, burst: 2, priority: 2 },
      { id: "P4", arrival: 3, burst: 2, priority: 1 }
    ],
    fair: [
      { id: "A1", arrival: 0, burst: 4, user: "Ana" },
      { id: "A2", arrival: 0, burst: 4, user: "Ana" },
      { id: "A3", arrival: 0, burst: 4, user: "Ana" },
      { id: "A4", arrival: 0, burst: 4, user: "Ana" },
      { id: "B1", arrival: 0, burst: 8, user: "Beto" }
    ],
    realtimeOk: [
      { id: "T1", execution: 1, period: 4, deadline: 4 },
      { id: "T2", execution: 2, period: 6, deadline: 6 }
    ],
    realtimeOverload: [
      { id: "T1", execution: 2, period: 4, deadline: 4 },
      { id: "T2", execution: 3, period: 5, deadline: 5 },
      { id: "T3", execution: 2, period: 7, deadline: 7 }
    ]
  };

  return { runSimulation, runRealtime, examples, COLORS, labelFor, normalizeProcesses };
});
