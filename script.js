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
  let lastResult = null;

  function cloneProcesses(rows) {
    return rows.map((p, index) => ({
      id: index + 1,
      name: String(p.name || `P${index + 1}`).trim(),
      arrival: Math.max(0, Number(p.arrival) || 0),
      burst: Math.max(1, Number(p.burst) || 1),
      color: p.color || colors[index % colors.length],
      order: index
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

    rows.forEach((p) => {
      if (time < p.arrival) {
        gantt.push({ name: "CPU ociosa", start: time, end: p.arrival, idle: true });
        time = p.arrival;
      }
      const start = time;
      const end = start + p.burst;
      gantt.push({ ...p, start, end });
      finished.push(makeResultRow(p, start, end));
      time = end;
    });

    return buildResult("fcfs", gantt, finished, "Se ordenaron los procesos por llegada y se ejecutaron sin interrupciones.");
  }

  function simulateSjf(input) {
    const rows = cloneProcesses(input);
    const pending = rows.slice();
    const gantt = [];
    const finished = [];
    let time = 0;

    while (pending.length) {
      const available = pending.filter((p) => p.arrival <= time);
      if (!available.length) {
        const nextArrival = Math.min(...pending.map((p) => p.arrival));
        gantt.push({ name: "CPU ociosa", start: time, end: nextArrival, idle: true });
        time = nextArrival;
        continue;
      }

      available.sort((a, b) => a.burst - b.burst || byArrival(a, b));
      const chosen = available[0];
      pending.splice(pending.indexOf(chosen), 1);
      const start = time;
      const end = start + chosen.burst;
      gantt.push({ ...chosen, start, end });
      finished.push(makeResultRow(chosen, start, end));
      time = end;
    }

    return buildResult("sjf", gantt, finished, "Cada vez que la CPU quedó libre, se eligió el proceso disponible con menor duración.");
  }

  function simulateRoundRobin(input, quantum) {
    const rows = cloneProcesses(input).sort(byArrival).map((p) => ({
      ...p,
      remaining: p.burst,
      firstStart: null
    }));
    const pending = rows.slice();
    const ready = [];
    const finished = [];
    const gantt = [];
    let time = 0;

    function addArrivals() {
      let moved = true;
      while (moved) {
        moved = false;
        for (let i = 0; i < pending.length; i += 1) {
          if (pending[i].arrival <= time) {
            ready.push(pending.splice(i, 1)[0]);
            moved = true;
            break;
          }
        }
      }
    }

    while (finished.length < rows.length) {
      addArrivals();
      if (!ready.length) {
        const nextArrival = pending[0].arrival;
        gantt.push({ name: "CPU ociosa", start: time, end: nextArrival, idle: true });
        time = nextArrival;
        addArrivals();
      }

      const current = ready.shift();
      if (current.firstStart === null) current.firstStart = time;
      const runTime = Math.min(quantum, current.remaining);
      const start = time;
      const end = start + runTime;
      gantt.push({ ...current, start, end });
      current.remaining -= runTime;
      time = end;
      addArrivals();

      if (current.remaining > 0) {
        ready.push(current);
      } else {
        finished.push(makeResultRow(current, current.firstStart, time));
      }
    }

    return buildResult("rr", gantt, finished, `Se usó quantum ${quantum}. Los procesos que no terminaron regresaron al final de la cola.`);
  }

  function makeResultRow(process, firstStart, finish) {
    const turnaround = finish - process.arrival;
    const wait = turnaround - process.burst;
    const response = firstStart - process.arrival;
    return {
      ...process,
      finish,
      turnaround,
      wait,
      response
    };
  }

  function buildResult(algorithm, gantt, rows, decision) {
    const sortedRows = rows.slice().sort((a, b) => a.order - b.order);
    const average = (field) => sortedRows.reduce((sum, row) => sum + row[field], 0) / Math.max(1, sortedRows.length);
    return {
      algorithm,
      gantt,
      rows: sortedRows,
      averages: {
        wait: average("wait"),
        turnaround: average("turnaround"),
        response: average("response")
      },
      decision
    };
  }

  function simulate(input, algorithm, quantum) {
    if (!input.length) {
      return buildResult(algorithm, [], [], "No hay procesos para simular.");
    }
    if (algorithm === "sjf") return simulateSjf(input);
    if (algorithm === "rr") return simulateRoundRobin(input, Math.max(1, Number(quantum) || 1));
    return simulateFcfs(input);
  }

  function loadExample() {
    processes = cloneProcesses(defaultProcesses);
    renderProcesses();
    runSimulation();
  }

  function addProcess(event) {
    event.preventDefault();
    const name = document.getElementById("nameInput").value.trim();
    const arrival = Number(document.getElementById("arrivalInput").value);
    const burst = Number(document.getElementById("burstInput").value);

    if (!name) return showMessage("Ingresa un nombre para el proceso.");
    if (processes.some((p) => p.name.toLowerCase() === name.toLowerCase())) return showMessage("Usa un nombre único para el proceso.");
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
    runSimulation();
  }

  function renderProcesses() {
    const body = document.getElementById("processBody");
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

  function updateProcess(event) {
    const index = Number(event.target.dataset.index);
    const field = event.target.dataset.field;
    const value = event.target.value.trim();

    if (field === "name") {
      if (!value) {
        showMessage("El nombre no puede estar vacío.");
        renderProcesses();
        return;
      }
      if (processes.some((p, i) => i !== index && p.name.toLowerCase() === value.toLowerCase())) {
        showMessage("No repitas nombres de procesos.");
        renderProcesses();
        return;
      }
      processes[index].name = value;
    } else {
      const number = Number(value);
      if (!Number.isInteger(number) || number < (field === "burst" ? 1 : 0)) {
        showMessage(field === "burst" ? "La duración debe ser mayor o igual a 1." : "La llegada debe ser mayor o igual a 0.");
        renderProcesses();
        return;
      }
      processes[index][field] = number;
    }
    showMessage("");
    runSimulation();
  }

  function deleteProcess(event) {
    const index = Number(event.target.dataset.delete);
    processes.splice(index, 1);
    renderProcesses();
    runSimulation();
  }

  function clearAll() {
    processes = [];
    lastResult = null;
    renderProcesses();
    renderResult(buildResult(document.getElementById("algorithmSelect").value, [], [], "Agrega procesos para iniciar la simulación."));
  }

  function runSimulation() {
    const algorithm = document.getElementById("algorithmSelect").value;
    const quantum = Number(document.getElementById("quantumInput").value);
    lastResult = simulate(processes, algorithm, quantum);
    renderResult(lastResult);
  }

  function renderResult(result) {
    document.getElementById("algorithmExplanation").textContent = explanations[result.algorithm] || explanations.fcfs;
    document.getElementById("decisionExplanation").textContent = result.decision;
    renderGantt(result.gantt);
    renderSummary(result.averages);
    renderResultsTable(result.rows);
  }

  function renderGantt(gantt) {
    const chart = document.getElementById("ganttChart");
    chart.innerHTML = "";
    if (!gantt.length) {
      chart.innerHTML = '<p class="message">No hay datos para mostrar.</p>';
      return;
    }
    gantt.forEach((segment) => {
      const block = document.createElement("div");
      block.className = `gantt-block${segment.idle ? " idle" : ""}`;
      block.style.background = segment.idle ? "" : segment.color;
      block.style.minWidth = `${Math.max(72, (segment.end - segment.start) * 54)}px`;
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
    document.getElementById("summaryCards").innerHTML = cards.map(([label, value]) => `
      <div class="summary-card">
        <strong>${Number.isFinite(value) ? value.toFixed(2) : "0.00"}</strong>
        <span>${label}</span>
      </div>
    `).join("");
  }

  function renderResultsTable(rows) {
    document.getElementById("resultsBody").innerHTML = rows.map((row) => `
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
    const isRoundRobin = document.getElementById("algorithmSelect").value === "rr";
    document.getElementById("quantumLabel").classList.toggle("hidden", !isRoundRobin);
    runSimulation();
  }

  function showMessage(text) {
    document.getElementById("formMessage").textContent = text;
    return false;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function startBrowserApp() {
    document.getElementById("processForm").addEventListener("submit", addProcess);
    document.getElementById("algorithmSelect").addEventListener("change", updateQuantumVisibility);
    document.getElementById("quantumInput").addEventListener("input", runSimulation);
    document.getElementById("simulateBtn").addEventListener("click", runSimulation);
    document.getElementById("clearBtn").addEventListener("click", clearAll);
    document.getElementById("exampleBtn").addEventListener("click", loadExample);
    loadExample();
  }

  if (typeof document !== "undefined") {
    startBrowserApp();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { simulate, simulateFcfs, simulateSjf, simulateRoundRobin, cloneProcesses };
  }
})();
