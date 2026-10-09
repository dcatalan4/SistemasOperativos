(function () {
  "use strict";

  const E = window.SchedulerEngine;
  const $ = (id) => document.getElementById(id);
  const state = {
    module: "intro",
    processes: [],
    result: null,
    frame: 0,
    timer: null,
    realtime: false
  };

  const modules = {
    intro: {
      title: "Fundamentos de planificación",
      text: "La planificación decide qué proceso usa la CPU, cuándo espera, cuándo se bloquea por E/S y cuándo termina. Aquí se juntan los conceptos base: programa frente a proceso, estados, ráfagas, métricas, cambio de contexto, planificadores clásicos y la diferencia entre política y mecanismo.",
      algorithms: [["rr", "Estados con Round Robin"], ["fcfs", "Mecanismo con política FCFS"], ["priority-preemptive", "Mecanismo con prioridades"]],
      examples: [["intro", "Proceso ejecutando, preparado y bloqueado"]]
    },
    batch: {
      title: "Planificación en sistemas por lotes",
      text: "Los sistemas por lotes buscan rendimiento y tiempos promedio bajos. FCFS respeta llegada, SJF elige la ráfaga conocida más corta sin expropiar y SRTF expropia cuando llega una tarea con menor tiempo restante. Empates: llegada más antigua y luego orden de carga.",
      algorithms: [["fcfs", "FCFS"], ["sjf", "SJF no expropiativo"], ["srtf", "SRTF"]],
      examples: [["verifiedBatch", "Caso verificable"], ["convoy", "Efecto convoy"], ["srtfPreempt", "Interrupción SRTF"]]
    },
    interactive: {
      title: "Planificación en sistemas interactivos",
      text: "Los sistemas interactivos favorecen respuesta rápida y equidad percibida. Round Robin usa quantum, prioridades pueden expropiar, el envejecimiento reduce inanición, MLFQ adapta colas, lotería reparte probabilísticamente y reparto justo compara usuarios o grupos.",
      algorithms: [["rr", "Round Robin"], ["priority", "Prioridades no expropiativo"], ["priority-preemptive", "Prioridades expropiativo"], ["aging", "Envejecimiento"], ["mlq", "Colas multinivel"], ["mlfq", "MLFQ"], ["predicted", "Ráfaga estimada"], ["guaranteed", "Garantizada"], ["lottery", "Lotería"], ["fair", "Reparto justo"]],
      examples: [["rr", "Round Robin con E/S"], ["priority", "Inanición y prioridad"], ["fair", "Cuatro procesos contra uno"]]
    },
    realtime: {
      title: "Planificación en sistemas de tiempo real",
      text: "Tiempo real duro exige cumplir plazos obligatorios; en tiempo real blando, incumplir degrada el servicio. La simulación asume un procesador, tareas independientes, expropiación y costos configurables. Una utilización menor al 100 % no garantiza cualquier conjunto de tareas: depende del modelo y de los plazos.",
      algorithms: [["rm", "Rate Monotonic"], ["edf", "Earliest Deadline First"]],
      examples: [["realtimeOk", "Conjunto viable"], ["realtimeOverload", "Conjunto sobrecargado"]],
      realtime: true
    },
    threads: {
      title: "Planificación de hilos",
      text: "Los procesos contienen hilos de usuario y pueden mapearse a hilos del núcleo. Muchos a uno delega decisiones a una biblioteca; uno a uno permite que el sistema operativo planifique cada hilo; muchos a muchos combina ambos niveles. Con dos núcleos aparece paralelismo real.",
      algorithms: [["rr", "Planificación RR de hilos"]],
      examples: [["rr", "Hilos por proceso"]]
    }
  };

  function boot() {
    document.querySelectorAll(".module-tab").forEach((btn) => btn.addEventListener("click", () => setModule(btn.dataset.module)));
    $("algorithmSelect").addEventListener("change", recompute);
    $("exampleSelect").addEventListener("change", loadExample);
    ["quantumInput", "contextInput", "seedInput"].forEach((id) => $(id).addEventListener("change", recompute));
    $("runBtn").addEventListener("click", play);
    $("pauseBtn").addEventListener("click", pause);
    $("stepBtn").addEventListener("click", step);
    $("resetBtn").addEventListener("click", reset);
    $("presentationBtn").addEventListener("click", () => document.body.classList.toggle("presentation"));
    $("processForm").addEventListener("submit", addProcess);
    setModule("intro");
  }

  function setModule(name) {
    pause();
    state.module = name;
    const mod = modules[name];
    state.realtime = !!mod.realtime;
    document.querySelectorAll(".module-tab").forEach((b) => b.classList.toggle("active", b.dataset.module === name));
    $("moduleTitle").textContent = mod.title;
    $("moduleText").textContent = mod.text;
    fillSelect($("algorithmSelect"), mod.algorithms);
    fillSelect($("exampleSelect"), mod.examples);
    $("arrivalInput").placeholder = mod.realtime ? "Período" : "Llegada";
    $("burstInput").placeholder = mod.realtime ? "Ejecución" : "Ráfaga";
    $("priorityInput").placeholder = mod.realtime ? "Plazo" : "Prioridad";
    $("ticketsInput").disabled = !!mod.realtime;
    $("userInput").disabled = !!mod.realtime;
    loadExample();
    renderSpecial();
  }

  function fillSelect(select, rows) {
    select.innerHTML = "";
    rows.forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    });
  }

  function loadExample() {
    const key = $("exampleSelect").value;
    state.processes = structuredClone(E.examples[key] || E.examples.rr);
    state.frame = 0;
    recompute();
  }

  function options() {
    return {
      quantum: Math.max(1, Number($("quantumInput").value) || 1),
      contextCost: Math.max(0, Number($("contextInput").value) || 0),
      seed: Math.max(1, Number($("seedInput").value) || 1),
      horizon: 30,
      maxTime: 90
    };
  }

  function recompute() {
    pause();
    const algorithm = $("algorithmSelect").value;
    state.frame = 0;
    if (state.realtime) state.result = E.runRealtime(state.processes, algorithm, options());
    else state.result = E.runSimulation(state.processes, algorithm, options());
    renderFrame();
    renderProcessTable();
    renderSpecial();
  }

  function play() {
    pause();
    state.timer = setInterval(() => {
      if (state.frame >= state.result.timeline.length - 1) pause();
      else step();
    }, Number($("speedSelect").value));
  }

  function pause() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function step() {
    if (!state.result) return;
    state.frame = Math.min(state.frame + 1, state.result.timeline.length - 1);
    renderFrame();
  }

  function reset() {
    pause();
    state.frame = 0;
    renderFrame();
  }

  function renderFrame() {
    if (!state.result) return;
    const frame = state.result.timeline[state.frame] || { time: 0, ready: [], blocked: [], done: [], decision: "" };
    $("clock").textContent = `t = ${frame.time}`;
    $("cpu").textContent = frame.cpu || "Ociosa";
    $("cpu").classList.toggle("idle", !frame.cpu);
    const color = colorFor(frame.cpu);
    $("cpu").style.borderColor = frame.cpu ? color : "";
    $("cpu").style.background = frame.cpu ? `${color}22` : "";
    $("decision").textContent = frame.decision || "Sin decisión pendiente.";
    renderChips("readyQueue", frame.ready || []);
    renderChips("blockedQueue", frame.blocked || []);
    renderChips("doneQueue", frame.done || []);
    renderGantt((frame.gantt || state.result.gantt || []).filter((seg) => seg.start <= frame.time + 1));
    renderMetrics();
    renderEvents(frame.events || state.result.events.slice(-10));
    renderQueues(frame);
    renderLottery(frame);
    if (state.module === "realtime") renderRealtimeSpecial(frame);
  }

  function colorFor(id) {
    if (!id) return "#94a3b8";
    const clean = String(id).split(".")[0];
    const p = state.result.processes?.find((x) => x.id === clean) || state.result.tasks?.find((x) => x.id === clean);
    return p?.color || "#64748b";
  }

  function renderChips(target, items) {
    const el = $(target);
    el.innerHTML = "";
    if (!items.length) {
      el.innerHTML = '<span class="empty">vacío</span>';
      return;
    }
    items.forEach((item) => {
      const text = String(item);
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = text;
      chip.style.background = colorFor(text.split(" ")[0]);
      el.appendChild(chip);
    });
  }

  function renderGantt(segments) {
    const el = $("gantt");
    el.innerHTML = "";
    segments.forEach((seg) => {
      const div = document.createElement("div");
      div.className = `gantt-seg ${seg.kind || ""}`;
      div.style.minWidth = `${Math.max(42, (seg.end - seg.start) * 34)}px`;
      if (seg.kind !== "idle" && seg.kind !== "overhead") div.style.background = colorFor(seg.id);
      div.innerHTML = `<span>${seg.id}</span><span class="gantt-time">${seg.start}-${seg.end}</span>`;
      el.appendChild(div);
    });
  }

  function renderMetrics() {
    const m = state.result.metrics;
    const rows = state.realtime ? [
      ["Carga", `${(m.utilization * 100).toFixed(1)} %`],
      ["CPU útil", m.usefulCpu],
      ["Horizonte", m.totalTime],
      ["Plazos fallidos", m.missed]
    ] : [
      ["Espera prom.", m.averageWait.toFixed(2)],
      ["Retorno prom.", m.averageTurnaround.toFixed(2)],
      ["Respuesta prom.", m.averageResponse.toFixed(2)],
      ["Rendimiento", m.throughput.toFixed(3)],
      ["CPU útil", m.usefulCpu],
      ["Ociosa", m.idleCpu],
      ["Sobrecarga", m.overhead],
      ["Utilización", `${(m.utilization * 100).toFixed(1)} %`]
    ];
    $("metrics").innerHTML = rows.map(([k, v]) => `<div class="metric"><b>${v}</b><span>${k}</span></div>`).join("");
  }

  function renderEvents(events) {
    $("eventLog").innerHTML = (events || []).slice().reverse().map((e) => `<li><strong>t=${e.time}</strong> ${e.text}</li>`).join("");
  }

  function renderQueues(frame) {
    const el = $("queueVisual");
    if (!frame.queues || !Object.keys(frame.queues).length) {
      el.innerHTML = state.module === "interactive" ? "<p>MLQ/MLFQ muestran aquí sus colas cuando el algoritmo las usa.</p>" : "";
      return;
    }
    el.innerHTML = Object.entries(frame.queues).map(([q, ids]) => `<div class="state-row"><strong>${q}</strong><div class="chips">${ids.map((id) => `<span class="chip" style="background:${colorFor(id)}">${id}</span>`).join("")}</div></div>`).join("");
  }

  function renderLottery(frame) {
    const box = $("lotteryBox");
    if ($("algorithmSelect").value !== "lottery") {
      box.innerHTML = "";
      return;
    }
    const tickets = state.result.processes.map((p) => `${p.id}: ${p.tickets} boletos`).join(" · ");
    const last = (frame.lotteryDraws || []).slice(-3).map((d) => `t=${d.time}: gana ${d.winner} (sorteo ${d.roll}/${d.total})`).join("<br>");
    box.innerHTML = `<p><strong>Boletos:</strong> ${tickets}</p><p><strong>Sorteos recientes:</strong><br>${last || "Aún no hay sorteo."}</p><p>Una probabilidad positiva no garantiza un límite exacto de espera.</p>`;
  }

  function renderProcessTable() {
    if (state.realtime) {
      $("processTable").innerHTML = `<table><thead><tr><th>Tarea</th><th>Ejecuta</th><th>Período</th><th>Plazo relativo</th><th></th></tr></thead><tbody>${state.processes.map((p, i) => `<tr><td>${p.id}</td><td>${p.execution}</td><td>${p.period}</td><td>${p.deadline}</td><td><button class="small-button" data-del="${i}">Eliminar</button></td></tr>`).join("")}</tbody></table>`;
    } else {
      $("processTable").innerHTML = `<table><thead><tr><th>ID</th><th>Llegada</th><th>Ráfaga</th><th>Prioridad</th><th>Boletos</th><th>Usuario</th><th>Fin</th><th>Espera</th><th>Retorno</th><th></th></tr></thead><tbody>${state.processes.map((p, i) => {
        const row = state.result.rows.find((r) => r.id === p.id) || {};
        return `<tr><td>${p.id}</td><td>${p.arrival}</td><td>${p.burst}</td><td contenteditable data-edit="${i}:priority">${p.priority ?? 5}</td><td contenteditable data-edit="${i}:tickets">${p.tickets ?? 10}</td><td contenteditable data-edit="${i}:user">${p.user ?? ""}</td><td>${row.finish ?? "-"}</td><td>${row.wait ?? "-"}</td><td>${row.turnaround ?? "-"}</td><td><button class="small-button" data-del="${i}">Eliminar</button></td></tr>`;
      }).join("")}</tbody></table>`;
    }
    $("processTable").querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => {
      state.processes.splice(Number(btn.dataset.del), 1);
      recompute();
    }));
    $("processTable").querySelectorAll("[contenteditable]").forEach((cell) => cell.addEventListener("blur", () => {
      const [idx, field] = cell.dataset.edit.split(":");
      const value = ["priority", "tickets"].includes(field) ? Number(cell.textContent) : cell.textContent.trim();
      state.processes[Number(idx)][field] = value;
      recompute();
    }));
  }

  function addProcess(ev) {
    ev.preventDefault();
    const id = $("pidInput").value.trim() || `P${state.processes.length + 1}`;
    const arrival = Number($("arrivalInput").value);
    const burst = Number($("burstInput").value);
    const priority = Number($("priorityInput").value || 5);
    const tickets = Number($("ticketsInput").value || 10);
    const user = $("userInput").value.trim() || "Usuario A";
    if (!id || state.processes.some((p) => p.id === id)) return error("Use un identificador único, por ejemplo P5.");
    if (!Number.isFinite(arrival) || arrival < 0) return error("La llegada debe ser un número mayor o igual que 0.");
    if (!Number.isFinite(burst) || burst < 1) return error("La ráfaga debe ser un número entero mayor que 0.");
    if (state.realtime) state.processes.push({ id, execution: burst, period: Math.max(1, arrival || 5), deadline: Math.max(1, priority || arrival || 5) });
    else state.processes.push({ id, arrival, burst, priority, tickets, user });
    $("processForm").reset();
    error("");
    recompute();
  }

  function error(text) {
    $("formError").textContent = text;
    return false;
  }

  function renderSpecial() {
    const panel = $("specialPanel");
    if (state.module === "intro") {
      panel.innerHTML = `<div class="concept-grid">
        <div class="concept"><strong>Preparado</strong><p>Tiene lo necesario para ejecutar, pero espera CPU. Su tiempo aquí cuenta como espera.</p></div>
        <div class="concept"><strong>Ejecución</strong><p>La CPU avanza su ráfaga. La primera vez que entra define la respuesta inicial.</p></div>
        <div class="concept"><strong>Bloqueado</strong><p>Espera una operación de entrada/salida. No suma espera de cola de preparados.</p></div>
        <div class="concept"><strong>Planificadores</strong><p>Largo plazo admite trabajos, mediano plazo suspende/reanuda y corto plazo elige la CPU.</p></div>
        <div class="concept"><strong>Política</strong><p>Es el criterio para decidir quién ejecuta: llegada, quantum, prioridad, plazo o reparto.</p></div>
        <div class="concept"><strong>Mecanismo</strong><p>Son las operaciones que hacen posible la decisión: cola, temporizador, guardar/restaurar contexto y entregar la CPU.</p></div>
      </div>`;
    } else if (state.module === "threads") {
      panel.innerHTML = threadPanel();
      panel.querySelector("#coreSelect").addEventListener("change", (e) => updateThreadMap(e.target.value));
      panel.querySelector("#threadModel").addEventListener("change", () => updateThreadMap(panel.querySelector("#coreSelect").value));
      updateThreadMap("1");
    } else if (state.module === "realtime") {
      renderRealtimeSpecial();
    } else {
      panel.innerHTML = `<p><strong>Nota didáctica:</strong> SJF y SRTF usan un modelo básico que conoce duraciones. En sistemas reales suelen estimarse con historial. Las métricas separan CPU útil, ociosa y sobrecarga.</p>`;
    }
  }

  function renderRealtimeSpecial(frame = state.result?.timeline?.[state.frame]) {
    const deadlines = frame?.deadlines || [];
    $("specialPanel").innerHTML = `<p><strong>Plazos de instancias:</strong> ${deadlines.slice(-10).map((d) => `<span class="${d.missed ? "deadline" : ""}">${d.jobId}@t=${d.at}${d.done ? " ✓" : ""}</span>`).join(" · ") || "Avance la simulación para ver instancias."}</p>`;
  }

  function threadPanel() {
    return `<div class="control-strip">
      <label>Modelo
        <select id="threadModel">
          <option value="many-one">Muchos a uno</option>
          <option value="one-one">Uno a uno</option>
          <option value="many-many">Muchos a muchos</option>
        </select>
      </label>
      <label>Núcleos
        <select id="coreSelect"><option value="1">Un núcleo</option><option value="2">Dos núcleos</option></select>
      </label>
    </div>
    <div id="threadMap" class="thread-map"></div>`;
  }

  function updateThreadMap(cores) {
    const model = $("threadModel").value;
    const map = $("threadMap");
    const kernel = model === "many-one" ? 1 : model === "one-one" ? 5 : 3;
    const note = model === "many-one"
      ? "La biblioteca decide entre hilos de usuario; si el único hilo del núcleo queda bloqueado en este ejemplo, los hilos asociados no avanzan."
      : model === "one-one"
        ? "El sistema operativo ve cada hilo del núcleo y puede competir entre procesos."
        : "La biblioteca multiplexa varios hilos de usuario sobre varios hilos del núcleo.";
    map.innerHTML = `
      <div class="thread-process"><h3>Proceso A</h3><p>Usuario: A1, A2, A3</p><p>Hilos del núcleo disponibles: ${kernel}</p></div>
      <div class="thread-process"><h3>Proceso B</h3><p>Usuario: B1, B2</p><p>Núcleos activos: ${cores}</p></div>
      <div class="thread-process"><h3>Decisión</h3><p>${note}</p><p>${Number(cores) === 2 ? "Con dos núcleos se representa paralelismo: dos hilos del núcleo pueden ejecutar al mismo tiempo." : "Con un núcleo hay concurrencia: los hilos progresan alternando turnos."}</p></div>`;
  }

  boot();
})();
