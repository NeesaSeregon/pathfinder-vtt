# Estilos — Pathfinder VTT

Cómo se escribe CSS en esta aplicación: dónde va cada regla, qué se puede
usar y qué no, y las invariantes de maqueta que no se ven en el código.

Este documento **no copia la paleta**. Los valores viven en
[styles.scss](apps/pathfinder-app/src/styles.scss), junto a su comentario;
duplicarlos aquí sería garantizar que algún día no coincidan. Aquí están las
decisiones y las reglas, que es lo que el código no puede contar solo.

Para la narrativa de cada pantalla (qué hace la mesa, por qué tiene cinco
contenedores) está `CLAUDE.md`. Para el sistema entero, `ARQUITECTURA.md`.

---

## 1. Dónde va cada estilo

Hay **tres niveles**, y elegir mal no da error: se ve mal y ya.

| Nivel | Fichero | Para qué |
|---|---|---|
| Global | `src/styles.scss` | El tema (variables), los elementos desnudos (`button`, `input`, `h1`), y patrones que usa **toda** la app: `.overlay`, `.modal`, `.pestanas`, `.panel`, `.pagina-estrecha` |
| Compartido de una zona | `_mesa-comun.scss` | Vocabulario que usan **varios componentes de una misma pantalla** pero cuyo nombre es demasiado genérico para el ámbito global: `.rotulo`, `.tarjeta`, `.boton`, `.ficha`, `.marca`, `.pg`, `.pgbar`, `.vital` |
| Propio | `mesa-tablero.scss`, … | Lo que solo existe en ese componente |

**El criterio**: ¿lo usa otro componente? Si sí, y su nombre es genérico, va
al parcial. Si sí, y es un patrón de toda la app, va al global. Si no, se
queda en casa.

### La trampa que ya ha mordido dos veces

Los estilos de componente están **encapsulados**: una clase definida en
`mesa-seleccion.scss` NO llega a `mesa-personas.html`, aunque el nombre sea
el mismo. Al mover markup de una zona a otra, la clase se va y su regla se
queda, y nadie avisa.

Pasó con `.pg` (la tarjeta de tu personaje salió con el input a lo ancho y
los botones apilados) y con `.rotulo` en `mesa-tablero`, que no hacía `@use`
del parcial.

Se caza en un minuto, sin herramientas nuevas: compila la hoja del
componente y busca en ella las clases de su plantilla.

```bash
npx sass --no-source-map apps/pathfinder-app/src/app/partidas/mesa-tablero.scss
```

Todo componente que use el vocabulario compartido debe empezar con:

```scss
@use 'mesa-comun';
```

---

## 2. El contrato del tema

`styles.scss` lo dice desde la primera línea: **los componentes no declaran
colores propios**, siempre las variables, y así el tema se ajusta tocando un
solo fichero.

En la práctica ese contrato **está incumplido en 23 sitios**, y casi siempre
por la misma razón legítima: hace falta el color de un token **con
transparencia**, y a una variable que guarda un hex no se le puede sacar
alfa. Así que se reescribe a mano:

```scss
/* Esto es --actitud-aliado, pero escrito otra vez */
background: rgba(91, 181, 106, 0.08);
```

El resultado es que cambiar un token no cambia sus transparencias, y la
deriva ya empezó: `crear-partida-page.scss` usa `#ff6b6b` donde `--danger`
es `#ff6b81`. Parecidos, distintos, e invisibles a ojo.

**La salida sancionada es `color-mix()`**, que trabaja con la variable en
lugar de contra ella:

```scss
/* En vez de rgba(91, 181, 106, 0.08) */
background: color-mix(in oklab, var(--actitud-aliado) 8%, transparent);
```

Sigue el token si el token cambia, y no añade variables nuevas.

Excepciones que **sí** pueden ir literales, porque no son tema sino tinta
del propio elemento: las sombras negras (`rgba(0,0,0,…)`), los brillos
blancos de los tokens (`rgba(255,255,255,…)`) y el color de texto de un
avatar sobre su color de fondo.

> **Deuda conocida**: los 23 `rgba()` de token siguen ahí. Migrarlos es
> mecánico pero toca ocho ficheros; hacerlo de golpe y a la vez, no a
> trozos, para no dejar dos estilos conviviendo.

---

## 3. Nomenclatura

BEM con guion bajo doble y guion doble, en **castellano**, como el resto del
código:

```scss
.fila { }            // bloque
.fila__nombre { }    // elemento
.fila--turno { }     // modificador de estado
```

Dos convenciones más que ya se siguen y conviene no romper:

- **El modificador describe el estado, no el aspecto**: `.fila--caida`,
  `.util--activa`, `.tablero__token--oculto`. Nunca `.fila--roja`.
- **Las clases sueltas del vocabulario compartido no llevan bloque**:
  `.ficha`, `.vital`, `.marca`, `.pgbar`. Son piezas que se pegan dentro de
  cualquier bloque, y por eso viven en el parcial.

En las plantillas, el estado se ata con `[class.bloque--modificador]`, no
concatenando cadenas, salvo cuando el valor viene de un dato — como el tramo
vital, que es `[class]="'vital vital--' + pep.estadoVital"`.

---

## 4. Invariantes de maqueta

Estas tres cosas parecen arbitrarias y no lo son. Romperlas rompe la mesa.

### La cadena de alturas

La mesa ocupa **exactamente** el alto de la ventana y no hay scroll de
página: lo que se desplaza es cada zona por dentro. Eso es lo que permite
que el tablero reciba "el hueco que sobre de verdad", que cambia según haya
banquillo o no — con un valor fijo en `rem` no se habría acertado nunca.

```
body (height: 100vh, flex)
  └ app-root (flex: 1, min-height: 0)
      └ :host de la página (flex: 1, min-height: 0)
          └ .mesa (flex: 1, min-height: 0, overflow: hidden)
              └ .mesa__cuerpo (grid, grid-template-rows: minmax(0, 1fr))
                  └ :host de cada zona (min-height: 0)
```

Dos detalles que cuestan una tarde si se olvidan:

- `height: 100vh` y **no** `min-height`. Con `min-height` el body crece con
  su contenido y "quédate con el alto de la ventana" deja de significar
  nada: no hay tope contra el que repartir.
- `grid-template-rows: minmax(0, 1fr)` en el cuerpo. Contra una fila
  automática, el `height: 100%` del tablero no tiene contra qué medirse y
  crece sin tope.
- El `min-height: 0` de cada eslabón. Sin él, un hijo alto estira la caja en
  vez de desplazarse por dentro.

### Se pierden filas, nunca columnas

El tablero es 24×30: **más alto que ancho**, y no cabe entero en un monitor
apaisado. El primer intento fue encogerlo hasta que cupiera, y dejaba
casillas de ~25px con dos franjas negras a los lados.

La regla actual: el tablero **llena el ancho** y se sale por abajo; el marco
lo recorta y se recorre agarrándolo. Se pierden filas de abajo, nunca
columnas, para no perder de vista un flanco en pleno combate.

De ahí se sigue una consecuencia práctica: **el cromo que quite espacio
quita ALTO, no ancho**. Por eso la barra de herramientas acabó en una fila
encima del tablero y no en un raíl a la izquierda: una fila cuesta una fila
de treinta, y un raíl encoge la casilla entera.

Y una prohibición: **nada flota sobre el tablero con fondo opaco**. Las
casillas de debajo dejan de poder pulsarse y de recibir un token, y como a
lo ancho cabe entero, las columnas tapadas no se destapan desplazando. Ya
pasó con la barra de herramientas; lo cazó el e2e, y hoy `MesaTablero` tiene
un test de que la barra es **hermana** del marco y no hija.

### Los cortes

- **≤ 85rem** — no caben tres zonas sin ahogar el tablero: Personas baja a
  lo ancho por debajo, en rejilla, y se vuelve al flujo normal con scroll de
  página.
- **≤ 60rem** — todo en una columna.

---

## 5. Presupuestos de CSS

En [project.json](apps/pathfinder-app/project.json):

- `initial`: aviso a 500 kB, error a 1 MB.
- `anyComponentStyle`: **aviso a 10 kB, error a 16 kB**.

**Rebasar el presupuesto de un componente no se arregla subiéndolo.** Es la
señal de que ese componente hace demasiado.

Hay precedente: al rediseñar la mesa, su hoja llegó a 17,1 kB y el
presupuesto se subió dos veces (10/16 → 14/20). Al partir la mesa en
componentes, la hoja más gorda bajó a ~5,5 kB y el presupuesto **volvió a
10/16 sin un solo aviso**. Subirlo solo aplazó el problema; partir lo
resolvió.

Antes de tocar el número, mira si hay algo duplicado que suba de nivel: así
salieron `.overlay`/`.modal` y `.pestanas`/`.pestana` a `styles.scss`,
donde estaban copiados en dos páginas.

---

## 6. Accesibilidad

Lo que ya está y no hay que estropear:

- **Foco visible** en todo control, definido una vez en `styles.scss`: los
  campos cambian el borde a `--accent` con el resplandor del tema; los
  botones llevan `outline` de 2px con `outline-offset`. Si un componente
  quita el `outline`, tiene que poner otra cosa en su lugar.
- **Estado en el DOM, no solo en el color**: `aria-pressed` en las
  herramientas y en las filas seleccionables, `aria-expanded` en el menú del
  máster, `aria-label` en los botones que solo llevan icono, y los SVG
  decorativos con `aria-hidden="true"`.
- **El color nunca va solo**: un token caído se pone gris **y** tachado; un
  PNJ oculto lleva borde punteado **y** la etiqueta "oculto"; el tramo vital
  se dice con palabras (Ileso / Herido / Malherido / Caído), no solo con el
  color de la barra.

Deudas conocidas, por orden de lo que más molesta:

1. **720 casillas en el orden de tabulación.** El tablero son 24×30
   `<button>`. Con teclado, atravesarlo son 720 paradas. La salida es un
   solo contenedor focalizable con *roving tabindex* y flechas para moverse.
2. **`role="grid"` incompleto.** El tablero lo declara, pero sin roles de
   fila ni de celda, así que no se anuncia como rejilla.
3. **La regla de medir es solo visual.** La distancia se pinta; no se
   anuncia.

---

## 7. Dónde están las maquetas

El rediseño de la mesa (agosto de 2026) se decidió sobre maquetas, no sobre
código. Están fuera del repositorio, en `Desktop/workspace/diseno-mesa/`:
artboards `.dc.html` más `canvas.json`, publicadas como lienzo en
<https://claude.ai/code/artifact/ca4145b7-5f64-4ceb-91db-13d2f5f8c5c5>.

Cinco vistas: mesa del máster, mesa del jugador, arranque del combate,
tablet y mapa de la app. Las notas del lienzo llevan el diagnóstico de lo
que no escalaba y las decisiones tomadas, con fecha.

Sirven para dos cosas: recordar **por qué** la pantalla es así, y probar un
cambio grande antes de escribirlo.
