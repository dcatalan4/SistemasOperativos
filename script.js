(function () {
  "use strict";

  const colors = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#be123c", "#4d7c0f"];
  const defaultProcesses = [
    { name: "P1", arrival: 0, burst: 5 },
    { name: "P2", arrival: 0, burst: 3 },
    { name: "P3", arrival: 0, burst: 1 }
  ];

  const explanations = {
    fcfs: "FCFS ejecuta los procesos en orden de llegada. Una vez que un proceso entra a la CPU, no se interrumpe hasta terminar.",
    sjf: "SJF no expropiativo espera a que la CPU quede libre y elige, entre los procesos disponibles, el que tenga menor duración.",
    rr: "Round Robin reparte la CPU en turnos llamados quantum. Si un proceso no termina en su turno, vuelve al final de la cola."
  };

  let processes = [];
  let animationTimer = null;

  function cloneProcesses(rows) {
    return rows.map((p, index) => ({
      id: p.id || index + 1,
      name: String(p.name || `P${index + 1}`).trim(),
      arrival: Math.max(0, Number(p.arrival) || 0),
      burst: Math.max(1, Number(p.burst) || 1),
      color: p.color || colors[index % colors.length],
      order: Number.isFinite(p.order) ? p.order : index
    }));
  }

  function byArrival(a, b) {
    return a.arrival - b.arrival || a.order - b.order;
  }

  function simulateFcfs(input) {
    const rows = cloneProcesses(input).sort(byArrival);
    let time = 0;
    const gantt = [];
    const finished = [];

    rows.forEach((process) => {
      if (time < process.arrival) {
        gantt.push({ name: "Ociosa", start: time, end: process.arrival, idle: true });
        time = process.arrival;
      }
      const start = time;
      const end = start + process.burst;
      gantt.push({ ...process, start, end });
      finished.push(makeResultRow(process, start, end));
      time = end;
    });

    return buildResult("fcfs", gantt, finished, "Se ordenaron los procesos por tiempo de llegada y se ejecutaron completos, sin interrupciones.");
  }

  function simulateSjf(input) {
    const pending = cloneProcesses(input);
    const gantt = [];
    const finished = [];
    let time = 0;

    while (pending.length > 0) {
      const available = pending.filter((process) => process.arrival <= time);
      if (available.length === 0) {
        const nextArrival = Math.min(...pending.map((process) => process.arrival));
        gantt.push({ name: "Ociosa", start: time, end: nextArrival, idle: true });
        time = nextArrival;
        continue;
      }

      available.sort((a, b) => a.burst - b.burst || byArrival(a, b));
      const selected = available[0];
      pending.splice(pending.indexOf(selected), 1);

      const start = time;
      const end = start + selected.burst;
      gantt.push({ ...selected, start, end });
      finished.push(makeResultRow(selected, start, end));
      time = end;
    }

    return buildResult("sjf", gantt, finished, "Cada vez que la CPU quedó libre, se eligió el proceso disponible con la menor duración.");
  }

  function simulateRoundRobin(input, quantum) {
    const sorted = cloneProcesses(input).sort(byArrival).map((process) => ({
      ...process,
      remaining: process.burst,
      firstStart: null
    }));
    const pending = sorted.slice();
    const ready = [];
    const gantt = [];
    const finished = [];
    let time = 0;

    function moveArrivals() {
      while (pending.length > 0 && pending[0].arrival <= time) {
        ready.push(pending.shift());
      }
    }

    while (finished.length < sorted.length) {
      moveArrivals();
      if (ready.length === 0) {
        const nextArrival = pending[0].arrival;
        gantt.push({ name: "Ociosa", start: time, end: nextArrival, idle: true });
        time = nextArrival;
        moveArrivals();
      }

      const current = ready.shift();
      if (current.firstStart === null) current.firstStart = time;

      const runTime = Math.min(quantum, current.remaining);
      const start = time;
      const end = start + runTime;
      gantt.push({ ...current, start, end });

      current.remaining -= runTime;
      time = end;
      moveArrivals();

      if (current.remaining > 0) {
        ready.push(current);
      } else {
        finished.push(makeResultRow(current, current.firstStart, time));
      }
    }

    return buildResult("rr", gantt, finished, `Se usó quantum ${quantum}. Si un proceso no terminó en su turno, volvió al final de la cola.`);
  }

  function makeResultRow(process, firstStart, finish) {
    const turnaround = finish - process.arrival;
    const wait = turnaround - process.burst;
    const response = firstStart - process.arrival;
    return { ...process, finish, turnaround, wait, response };
  }

  function buildResult(algorithm, gantt, rows, decision) {
    const orderedRows = rows.slice().sort((a, b) => a.order - b.order);
    const average = (field) => orderedRows.length === 0 ? 0 : orderedRows.reduce((sum, row) => sum + row[field], 0) / orderedRows.length;
    return {
      algorithm,
      gantt,
      rows: orderedRows,
      averages: {
        wait: average("wait"),
        turnaround: average("turnaround"),
        response: average("response")
      },
      decision
    };
  }

  function simulate(input, algorithm, quantum) {
    if (input.length === 0) return buildResult(algorithm, [], [], "No hay procesos para simular.");
    if (algorithm === "sjf") return simulateSjf(input);
    if (algorithm === "rr") return simulateRoundRobin(input, Math.max(1, Number(quantum) || 1));
    return simulateFcfs(input);
  }

  function init() {
    $("processForm").addEventListener("submit", addProcess);
    $("algorithmSelect").addEventListener("change", () => {
      updateQuantumVisibility();
      renderPreview();
    });
    $("quantumInput").addEventListener("input", renderPreview);
    $("simulateBtn").addEventListener("click", () => runSimulation(true));
    $("clearBtn").addEventListener("click", clearAll);
    $("exampleBtn").addEventListener("click", loadExample);
    loadExample(false);
  }

  function loadExample(animate = false) {
    stopAnimation();
    processes = cloneProcesses(defaultProcesses);
    renderProcesses();
    showMessage("");
    renderPreview();
    if (animate) runSimulation(true);
  }

  function addProcess(event) {
    event.preventDefault();
    const name = $("nameInput").value.trim();
    const arrival = Number($("arrivalInput").value);
    const burst = Number($("burstInput").value);

    if (!name) return showMessage("Ingresa un nombre para el proceso.");
    if (processes.some((process) => process.name.toLowerCase() === name.toLowerCase())) return showMessage("Usa un nombre único para el proceso.");
    if (!Number.isInteger(arrival) || arrival < 0) return showMessage("El tiempo de llegada debe ser un entero mayor o igual a 0.");
    if (!Number.isInteger(burst) || burst < 1) return showMessage("La duración debe ser un entero mayor o igual a 1.");

    processes.push({
      id: Date.now(),
      name,
      arrival,
      burst,
      color: colors[processes.length % colors.length],
      order: processes.length
    });

    event.target.reset();
    showMessage("");
    renderProcesses();
    renderPreview();
  }

  function updateProcess(event) {
    const index = Number(event.target.dataset.index);
    const field = event.target.dataset.field;
    const value = event.target.value.trim();

    if (field === "name") {
      if (!value) {
        renderProcesses();
        return showMessage("El nombre no puede estar vacío.");
      }
      if (processes.some((process, otherIndex) => otherIndex !== index && process.name.toLowerCase() === value.toLowerCase())) {
        renderProcesses();
        return showMessage("No repitas nombres de procesos.");
      }
      processes[index].name = value;
    } else {
      const number = Number(value);
      const minimum = field === "burst" ? 1 : 0;
      if (!Number.isInteger(number) || number < minimum) {
        renderProcesses();
        return showMessage(field === "burst" ? "La duración debe ser mayor o igual a 1." : "La llegada debe ser mayor o igual a 0.");
      }
      processes[index][field] = number;
    }

    showMessage("");
    renderPreview();
  }

  function deleteProcess(event) {
    const index = Number(event.target.dataset.delete);
    processes.splice(index, 1);
    processes = processes.map((process, order) => ({ ...process, order }));
    renderProcesses();
    renderPreview();
  }

  function clearAll() {
    stopAnimation();
    processes = [];
    renderProcesses();
    renderResult(buildResult(getAlgorithm(), [], [], "Agrega procesos para iniciar la simulación."), { partialGantt: [] });
    setBoard("Lista", "t = 0", "Pendiente");
    $("simulationStatus").textContent = "Lista limpia. Agrega procesos o carga el ejemplo inicial.";
  }

  function runSimulation(animated) {
    const result = getCurrentResult();
    if (result.gantt.length === 0) {
      renderResult(result, { partialGantt: [] });
      setBoard("Sin procesos", "t = 0", "Pendiente");
      return;
    }

    if (!animated) {
      renderResult(result);
      return;
    }

    animateResult(result);
  }

  function renderPreview() {
    stopAnimation();
    const result = getCurrentResult();
    renderResult(result);
    const totalTime = result.gantt.length ? result.gantt[result.gantt.length - 1].end : 0;
    setBoard("Lista", `t = ${totalTime}`, orderText(result));
    $("simulationStatus").textContent = "Vista calculada. Presiona Simular para reproducir la ejecución paso a paso.";
  }

  function getCurrentResult() {
    return simulate(processes, getAlgorithm(), Number($("quantumInput").value));
  }

  function getAlgorithm() {
    return $("algorithmSelect").value;
  }

  function animateResult(result) {
    stopAnimation();
    $("simulateBtn").disabled = true;
    $("simulateBtn").textContent = "Simulando...";
    $("simulationStatus").textContent = "Ejecutando la línea de tiempo...";
    renderResult(result, { partialGantt: [] });

    let index = 0;
    const paintStep = () => {
      const segment = result.gantt[index];
      const partial = result.gantt.slice(0, index + 1);
      renderResult(result, { partialGantt: partial, activeIndex: index });
      setBoard(segment.idle ? "Ociosa" : segment.name, `t = ${segment.end}`, orderText({ gantt: partial }));
      $("simulationStatus").textContent = segment.idle
        ? `La CPU queda ociosa de t=${segment.start} a t=${segment.end}.`
        : `${segment.name} usa la CPU de t=${segment.start} a t=${segment.end}.`;
      index += 1;

      if (index >= result.gantt.length) {
        stopAnimation(false);
        $("simulateBtn").disabled = false;
        $("simulateBtn").textContent = "Simular";
        $("simulationStatus").textContent = "Simulación terminada. Puedes cambiar datos o algoritmo y volver a simular.";
      }
    };

    paintStep();
    if (animationTimer === null && result.gantt.length > 1) {
      animationTimer = window.setInterval(paintStep, 650);
    }
  }

  function stopAnimation(resetButton = true) {
    if (animationTimer) {
      window.clearInterval(animationTimer);
      animationTimer = null;
    }
    if (resetButton && $("simulateBtn")) {
      $("simulateBtn").disabled = false;
      $("simulateBtn").textContent = "Simular";
    }
  }

  function renderResult(result, options = {}) {
    $("algorithmExplanation").textContent = explanations[result.algorithm] || explanations.fcfs;
    $("decisionExplanation").textContent = result.decision;
    renderGantt(options.partialGantt || result.gantt, options.activeIndex);
    renderSummary(result.averages);
    renderResultsTable(result.rows);
  }

  function renderProcesses() {
    const body = $("processBody");
    body.innerHTML = "";
    processes.forEach((process, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input value="${escapeHtml(process.name)}" data-index="${index}" data-field="name" aria-label="Nombre de ${escapeHtml(process.name)}"></td>
        <td><input type="number" min="0" step="1" value="${process.arrival}" data-index="${index}" data-field="arrival" aria-label="Llegada de ${escapeHtml(process.name)}"></td>
        <td><input type="number" min="1" step="1" value="${process.burst}" data-index="${index}" data-field="burst" aria-label="Duración de ${escapeHtml(process.name)}"></td>
        <td><span class="color-dot" style="background:${process.color}"></span></td>
        <td><button class="delete-btn" type="button" data-delete="${index}">Eliminar</button></td>
      `;
      body.appendChild(row);
    });

    body.querySelectorAll("input").forEach((input) => input.addEventListener("change", updateProcess));
    body.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", deleteProcess));
  }

  function renderGantt(gantt, activeIndex) {
    const chart = $("ganttChart");
    chart.innerHTML = "";
    if (gantt.length === 0) {
      chart.innerHTML = '<p class="empty-state">No hay datos para mostrar.</p>';
      return;
    }

    gantt.forEach((segment, index) => {
      const block = document.createElement("div");
      block.className = `gantt-block${segment.idle ? " idle" : ""}${index === activeIndex ? " active" : ""}`;
      if (!segment.idle) block.style.background = segment.color;
      block.style.minWidth = `${Math.max(86, (segment.end - segment.start) * 62)}px`;
      block.innerHTML = `<span>${escapeHtml(segment.name)}</span><small>${segment.start} - ${segment.end}</small>`;
      chart.appendChild(block);
    });
  }

  function renderSummary(averages) {
    const cards = [
      ["Espera promedio", averages.wait],
      ["Retorno promedio", averages.turnaround],
      ["Respuesta promedio", averages.response]
    ];
    $("summaryCards").innerHTML = cards.map(([label, value]) => `
      <div class="summary-card">
        <strong>${Number(value).toFixed(2)}</strong>
        <span>${label}</span>
      </div>
    `).join("");
  }

  function renderResultsTable(rows) {
    $("resultsBody").innerHTML = rows.map((row) => `
      <tr>
        <td><strong style="color:${row.color}">${escapeHtml(row.name)}</strong></td>
        <td>${row.arrival}</td>
        <td>${row.burst}</td>
        <td>${row.finish}</td>
        <td>${row.turnaround}</td>
        <td>${row.wait}</td>
        <td>${row.response}</td>
      </tr>
    `).join("");
  }

  function updateQuantumVisibility() {
    $("quantumLabel").classList.toggle("hidden", getAlgorithm() !== "rr");
  }

  function setBoard(cpu, time, order) {
    $("cpuStatus").textContent = cpu;
    $("timeStatus").textContent = time;
    $("orderStatus").textContent = order || "Pendiente";
  }

  function orderText(result) {
    const names = result.gantt.filter((segment) => !segment.idle).map((segment) => segment.name);
    return names.length ? names.join(" -> ") : "Pendiente";
  }

  function showMessage(text) {
    $("formMessage").textContent = text;
    return false;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { simulate, simulateFcfs, simulateSjf, simulateRoundRobin, cloneProcesses };
  }
})();
