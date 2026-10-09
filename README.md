# Simulador educativo de planificación de procesos e hilos

Aplicación HTML5, CSS3 y JavaScript puro para una exposición universitaria de Sistemas Operativos. Funciona sin conexión y se abre directamente desde `index.html`.

## Ejecución

1. Abra `index.html` en un navegador moderno.
2. Seleccione un módulo, un algoritmo y un ejemplo precargado.
3. Use **Iniciar**, **Pausar**, **Avanzar** y **Reiniciar** para controlar la simulación.
4. Active el botón `⛶` para modo exposición.

No usa React, backend, bases de datos, CDN ni servicios externos.

## Qué demuestra cada módulo

- **Fundamentos:** estados de proceso, programa frente a proceso, ráfagas, E/S, métricas, cambio de contexto, planificadores de largo/mediano/corto plazo y diferencia entre política y mecanismo.
- **Por lotes:** FCFS, SJF no expropiativo y SRTF con el mismo conjunto de procesos. Use el ejemplo “Caso verificable” para comprobar FCFS y SJF.
- **Interactivos:** Round Robin, prioridades, envejecimiento, colas multinivel, MLFQ, estimación de ráfaga, garantizada, lotería y reparto justo.
- **Tiempo real:** Rate Monotonic y EDF con instancias periódicas, plazos absolutos, carga de procesador e incumplimientos.
- **Hilos:** modelos muchos a uno, uno a uno y muchos a muchos; hilos de usuario, hilos del núcleo y uno o dos núcleos.

## Supuestos y simplificaciones

- Es una simulación educativa: no modifica la planificación real del sistema operativo.
- El motor avanza en unidades discretas de tiempo.
- SJF y SRTF usan el modelo básico que conoce las duraciones. En sistemas reales se estiman.
- Los empates se resuelven de forma determinista: llegada más antigua y luego orden de carga.
- La espera se acumula únicamente mientras el proceso está en la cola de preparados; el tiempo bloqueado por E/S no se cuenta como espera.
- En tiempo real se asume un procesador, tareas independientes, expropiación y costos configurables. Una utilización menor al 100 % no garantiza cualquier conjunto de tareas.
- En MLFQ se contabiliza el consumo acumulado y hay ascensos periódicos para reducir postergación.
- En lotería, una probabilidad positiva no garantiza un límite exacto de espera; la semilla permite repetir el experimento.

## Verificación

Si tiene Node.js instalado, ejecute:

```powershell
node tests/run-tests.js
```

Las pruebas cubren:

- FCFS con espera promedio `10` y retorno promedio `15.5`.
- SJF con espera promedio `5` y retorno promedio `10.5`.
- SRTF con expropiación.
- Round Robin y quantum.
- Bloqueos por E/S.
- Empates deterministas.
- Envejecimiento.
- Plazos de tiempo real.
- Reproducción de lotería con la misma semilla.

## Archivos

- `index.html`: interfaz principal.
- `styles.css`: diseño visual, contraste y modo exposición.
- `js/sim-engine.js`: motor de simulación separado de la interfaz.
- `js/app.js`: conexión entre controles, módulos, tablas y visualización.
- `tests/run-tests.js`: verificaciones automáticas.
