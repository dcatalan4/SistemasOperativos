# Manual para explicar la aplicación

Este manual está pensado para usar la aplicación frente a una clase. La idea no es leer todo literalmente, sino seguir el orden, ejecutar los ejemplos y usar las frases clave como apoyo.

Antes de iniciar, aclare:

> Esta es una simulación educativa. No controla la planificación real del sistema operativo; solo representa decisiones calculadas por el simulador.

## Preparación

1. Abra `index.html`.
2. Active el modo exposición con el botón `⛶` si se proyecta en clase.
3. Use **Avanzar** para explicar paso a paso. Use **Iniciar** solo cuando el grupo ya entendió qué está viendo.
4. Cada vez que cambie de algoritmo o ejemplo, presione **Reiniciar** si quiere volver al inicio.
5. Señale siempre cuatro zonas: CPU, cola de preparados, bloqueados/terminados y diagrama de Gantt.

## Módulo 1: Fundamentos

### Objetivo

Explicar qué es la planificación, qué estados puede tener un proceso, qué mide el simulador y cómo se separan política y mecanismo.

### Ejemplo recomendado

- Módulo: **Fundamentos**
- Ejemplo: **Proceso ejecutando, preparado y bloqueado**
- Algoritmo inicial: **Estados con Round Robin**

### Cómo explicarlo

1. Empiece con la diferencia entre programa y proceso:
   > Un programa es código guardado; un proceso es ese programa ejecutándose, con estado, memoria, registros y recursos.

2. Avance uno o dos pasos y señale la CPU:
   > En cada unidad de tiempo, el planificador decide qué proceso recibe la CPU.

3. Señale la cola de preparados:
   > Estos procesos están listos, pero esperan turno. El tiempo que pasan aquí cuenta como espera.

4. Señale bloqueados:
   > Un proceso bloqueado no está esperando CPU; espera una operación de entrada o salida. Por eso no debemos calcular la espera solo como retorno menos ráfaga.

5. Cuando aparezca una interrupción o cambio de proceso:
   > El cambio de contexto significa guardar el estado del proceso actual y restaurar el del siguiente. No es lo mismo que suspender o intercambiar un proceso fuera de memoria.

6. Cambie el algoritmo a **Mecanismo con política FCFS** o **Mecanismo con prioridades**:
   > El mecanismo es el mismo: cola, temporizador, guardar/restaurar contexto y entregar CPU. Lo que cambia es la política, es decir, el criterio para elegir.

### Puntos clave

- Preparado no es lo mismo que bloqueado.
- Expropiativo significa que el sistema puede quitar la CPU antes de que el proceso termine.
- No expropiativo significa que el proceso conserva la CPU hasta terminar o bloquearse.
- Métricas:
  - Espera: tiempo acumulado en preparados.
  - Retorno: finalización menos llegada.
  - Respuesta: primera ejecución menos llegada.
  - Rendimiento: trabajos terminados por unidad de tiempo.

## Módulo 2: Planificación por lotes

### Objetivo

Comparar FCFS, SJF y SRTF con la misma carga de trabajo y mostrar cómo cambia el promedio sin cambiar la cantidad total de CPU requerida.

### Ejemplo recomendado

- Módulo: **Por lotes**
- Ejemplo: **Caso verificable**
- Algoritmos: **FCFS**, luego **SJF no expropiativo**

### Cómo explicarlo

1. Seleccione **FCFS** y avance hasta terminar:
   > FCFS atiende en orden de llegada. Es simple y justo en llegada, pero puede hacer esperar demasiado a trabajos cortos si un trabajo largo llegó primero.

2. Señale las métricas:
   > En este caso, FCFS debe dar espera promedio 10 y retorno promedio 15.5.

3. Cambie a **SJF no expropiativo** con el mismo ejemplo:
   > SJF elige el trabajo con ráfaga más corta entre los disponibles. En el modelo básico suponemos que conoce las duraciones.

4. Termine la simulación:
   > Ahora la espera promedio debe bajar a 5 y el retorno promedio a 10.5.

5. Explique la idea central:
   > No cambió la suma del trabajo de CPU. Lo que cambió fue el orden, y ese orden reduce cuánto tiempo esperan los trabajos cortos.

6. Use el ejemplo **Efecto convoy**:
   > El efecto convoy ocurre cuando un proceso largo al frente retrasa a varios procesos cortos.

7. Use el ejemplo **Interrupción SRTF** con **SRTF**:
   > SRTF es la versión expropiativa: si llega un proceso con menos tiempo restante, puede interrumpir al actual.

### Puntos clave

- FCFS: simple, pero puede producir efecto convoy.
- SJF: mejora promedios, pero necesita conocer o estimar ráfagas.
- SRTF: puede interrumpir, mejora respuesta de trabajos cortos, pero puede postergar trabajos largos.
- Empates: llegada más antigua y luego orden de carga.

## Módulo 3: Planificación interactiva

### Objetivo

Mostrar algoritmos pensados para sistemas donde importa la respuesta rápida, la equidad y evitar inanición.

### Ejemplo recomendado

- Módulo: **Interactivos**
- Ejemplo inicial: **Round Robin con E/S**
- Algoritmo inicial: **Round Robin**

### Cómo explicarlo

1. Empiece con Round Robin:
   > Round Robin reparte la CPU en turnos llamados quantum. Cuando se agota el quantum, el proceso vuelve a preparados si no terminó.

2. Cambie el quantum:
   > Con quantum pequeño hay más respuesta, pero también más cambios de contexto. Con quantum grande se parece más a FCFS.

3. Aumente el costo de cambio de contexto:
   > El tiempo de cambio de contexto no hace trabajo útil; es sobrecarga.

4. Cambie a **Prioridades expropiativo**:
   > Aquí el número menor representa mayor prioridad. Si llega un proceso más prioritario, puede quitar la CPU.

5. Use **Envejecimiento**:
   > El envejecimiento mejora gradualmente la prioridad efectiva de quienes esperan, para reducir la inanición.

6. Muestre **MLFQ**:
   > MLFQ clasifica procesos en colas. Los procesos que consumen mucho CPU bajan de cola; los ascensos periódicos evitan que queden olvidados.

7. Muestre **Lotería**:
   > Cada proceso tiene boletos. Más boletos significan más probabilidad, pero no garantizan un límite exacto de espera.

8. Muestre **Reparto justo** con el ejemplo de cuatro procesos contra uno:
   > Si un usuario crea cuatro procesos y otro solo uno, repartir por proceso favorece al primero. Repartir por usuario busca balancear entre grupos.

### Puntos clave

- En sistemas interactivos no basta con terminar rápido; importa responder pronto.
- Round Robin depende mucho del quantum.
- Prioridades sin cuidado pueden causar inanición.
- Envejecimiento y MLFQ ayudan a reducir postergación.
- Lotería es probabilística: con la misma semilla se repite el experimento.

## Módulo 4: Tiempo real

### Objetivo

Explicar planificación con plazos y diferenciar tiempo real duro y blando.

### Ejemplo recomendado

- Módulo: **Tiempo real**
- Ejemplo inicial: **Conjunto viable**
- Algoritmos: **Rate Monotonic** y luego **Earliest Deadline First**

### Cómo explicarlo

1. Presente los conceptos:
   > En tiempo real duro, incumplir un plazo puede ser inaceptable. En tiempo real blando, incumplir degrada el servicio, pero no necesariamente destruye el sistema.

2. Use **Rate Monotonic**:
   > Rate Monotonic usa prioridad fija: cuanto menor es el período, mayor es la prioridad.

3. Señale las instancias:
   > Cada tarea periódica genera instancias. Cada instancia tiene ejecución pendiente y plazo absoluto.

4. Cambie a **EDF**:
   > EDF usa prioridad dinámica: ejecuta la instancia con el plazo absoluto más cercano.

5. Cambie al ejemplo **Conjunto sobrecargado**:
   > Cuando la carga excede lo que el procesador puede atender, aparecen incumplimientos.

6. Aclare la condición importante:
   > No basta decir “utilización menor al 100 %” para garantizar cualquier conjunto de tareas. Los criterios dependen del modelo, los plazos, independencia, expropiación y costos.

### Puntos clave

- RM: prioridad fija por período.
- EDF: prioridad dinámica por plazo.
- Cada instancia conserva su plazo aunque llegue otra nueva.
- La simulación asume un procesador, tareas independientes y expropiación.
- La carga del procesador ayuda a razonar, pero no cuenta toda la historia.

## Módulo 5: Planificación de hilos

### Objetivo

Explicar cómo se relacionan procesos, hilos de usuario, hilos del núcleo, concurrencia y paralelismo.

### Ejemplo recomendado

- Módulo: **Hilos**
- Ejemplo: **Hilos por proceso**
- Cambiar el selector entre **Muchos a uno**, **Uno a uno** y **Muchos a muchos**
- Cambiar entre **Un núcleo** y **Dos núcleos**

### Cómo explicarlo

1. Empiece con la idea base:
   > Un proceso puede contener varios hilos. Los hilos comparten recursos del proceso, pero cada hilo tiene su propia ejecución.

2. Modelo muchos a uno:
   > Muchos hilos de usuario se mapean a un solo hilo del núcleo. La biblioteca de hilos decide entre ellos. En este ejemplo, si el único hilo del núcleo se bloquea, los hilos asociados no avanzan.

3. Modelo uno a uno:
   > Cada hilo de usuario se asocia a un hilo del núcleo. El sistema operativo puede planificar cada hilo directamente.

4. Modelo muchos a muchos:
   > Varios hilos de usuario se multiplexan sobre varios hilos del núcleo. Combina decisiones de biblioteca y del sistema operativo.

5. Cambie a dos núcleos:
   > Con un núcleo hay concurrencia: las tareas progresan alternando. Con dos núcleos puede haber paralelismo: dos hilos ejecutan al mismo tiempo.

6. Señale el bloqueo:
   > El efecto de una operación bloqueante depende del modelo. No debemos generalizar el comportamiento de muchos a uno a todos los modelos.

### Puntos clave

- Hilo de usuario: gestionado por biblioteca o entorno de ejecución.
- Hilo del núcleo: visible para el sistema operativo.
- Concurrencia no significa necesariamente paralelismo.
- El planificador del sistema operativo decide sobre hilos del núcleo.
- La biblioteca de hilos puede decidir antes de que el sistema operativo vea la ejecución.

## Cierre sugerido

Puede cerrar con esta comparación oral:

> No hay un algoritmo universalmente mejor. FCFS es simple, SJF/SRTF reducen promedios bajo ciertos supuestos, Round Robin mejora respuesta interactiva, prioridades y MLFQ expresan importancia y adaptación, RM/EDF se enfocan en plazos, y la planificación de hilos depende del modelo de mapeo. La mejor política depende de la carga y del objetivo del sistema.

## Ruta rápida de exposición

Si tiene poco tiempo:

1. Fundamentos: estados y política contra mecanismo.
2. Por lotes: caso verificable FCFS contra SJF.
3. Interactivos: Round Robin con quantum y costo de cambio.
4. Tiempo real: EDF con conjunto viable y sobrecargado.
5. Hilos: muchos a uno frente a uno a uno, luego dos núcleos.
