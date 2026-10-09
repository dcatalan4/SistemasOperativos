# Simulador de Planificación de CPU

Aplicación web sencilla para demostrar planificación de procesos en Sistemas Operativos.

## Cómo abrirla

Abra `index.html` directamente en un navegador. No requiere servidor, base de datos, instalación de paquetes ni conexión a internet.

## Qué incluye

- Procesos editables con nombre, tiempo de llegada y duración.
- Botón para agregar procesos.
- Botón para limpiar la lista.
- Ejemplo inicial con `P1`, `P2` y `P3`.
- Selector de algoritmo.
- Campo de quantum cuando se selecciona Round Robin.
- Diagrama de Gantt con colores por proceso.
- Animación paso a paso al presionar **Simular**.
- Tabla de resultados.
- Promedios de espera, retorno y respuesta inicial.
- Explicaciones educativas breves.

## Algoritmos implementados

- **FCFS:** primero en llegar, primero en ser atendido.
- **SJF no expropiativo:** cuando la CPU queda libre, ejecuta el proceso disponible con menor duración.
- **Round Robin:** reparte la CPU en turnos de tamaño `quantum`.

## Fórmulas

- Retorno = finalización - llegada.
- Espera = retorno - duración de CPU.
- Respuesta inicial = primera ejecución - llegada.

## Supuestos

Esta es una simulación educativa básica. Cada proceso tiene una sola ráfaga de CPU, no realiza entrada/salida y el costo de cambio de contexto es cero. La aplicación no controla la planificación real del sistema operativo.
