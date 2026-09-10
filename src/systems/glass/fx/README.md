# Efectos de entrada y salida

Un glass entra, se queda el tiempo que dice el mensaje, y sale. Antes las dos puntas eran
el mismo fundido de un segundo escrito a mano en `glass-system.ts`. Ahora las decide el
mensaje, en el campo `transition`.

## La forma del campo

```json
{
  "in":  { "effects": ["fade", "zoom"], "duration": 700, "easing": "back-out", "zoom": 0.6 },
  "out": { "effects": ["fade", "slide"], "duration": 400, "side": "b" }
}
```

**La entrada y la salida son independientes.** No hay un efecto `fadein` y otro `fadeout`:
hay `fade`, y en `in` entra y en `out` sale. Los efectos de una fase **se combinan**: la
lista de arriba entra apareciendo y creciendo a la vez, no una cosa despues de la otra.

| campo | que es | por omision |
|---|---|---|
| `effects` | lista de efectos combinados; `[]` = aparece de golpe | `["fade"]` |
| `duration` | milisegundos, 0 a 10000 | `1000` |
| `delay` | milisegundos de espera antes de arrancar | `0` |
| `easing` | curva de tiempo (ver abajo) | `"ease-in-out"` |
| `zoom` | escala de partida (entrada) o de llegada (salida) | `0.6` |
| `side` | `l` `r` `t` `b`, para `slide`, `roll` y `wipe` | segun el efecto |
| `spin` | grados de giro de `spin` y `roll` | `180` / `-120` |
| `blur` | pixeles de desenfoque | `12` |

Si solo se declara una de las dos fases, la otra la copia: quien puso un zoom de entrada y
no dijo nada de la salida espera que se vaya con el mismo zoom, no con un fundido.

## Los efectos

| nombre | que hace | parametros |
|---|---|---|
| `fade` | opacidad 0 -> transparencia del mensaje | — |
| `zoom` | escala; `zoom: 1.4` entra achicandose en vez de creciendo | `zoom` |
| `slide` | entra desde afuera de la pantalla por un lado | `side` (por omision `b`) |
| `roll` | `slide` + giro, como una rueda | `side` (`l`), `spin` (`-120`) |
| `spin` | giro sin desplazamiento | `spin` (`180`) |
| `blur` | desenfoque | `blur` (`12`) |
| `wipe` | cortinilla: se revela por un lado sin que el arte se mueva | `side` (`l`) |
| `iris` | lo mismo pero en circulo, desde el centro | — |
| `random` | sortea una combinacion de la lista presentable | — |

`wipe` e `iris` usan los dos el mismo `clip-path`: juntos en una misma fase no se suman,
gana `iris`. Cualquier otra combinacion si se suma.

`random` no es un efecto sino un sorteo, y por eso no se combina: puesto al lado de otro,
gana el. Se resuelve al normalizar —o sea una vez por glass— asi que **el mismo mensaje
entra distinto cada vez que se muestra**, y la entrada y la salida se sortean por separado.
Sale de `fx/presentables.ts`, la misma lista que usa el splash.

El lado tambien se puede escribir pegado al nombre —`"slide-l"`, `"wipe-arriba"`— para no
tener que agregar un campo. El campo `side` le gana al sufijo.

### Curvas

`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `back-in`, `back-out`,
`back-in-out`, `bounce-in`, `bounce-out`, `elastic-in`, `elastic-out`.

Las `back` se pasan de largo y vuelven: es el "pop" de una notificacion, y con `zoom` es
la combinacion que mas se usa. El rebote y el elastico no se pueden escribir como una
bezier —vuelven sobre si mismos mas de una vez— asi que se arman muestreando la formula y
escribiendola como `linear(...)`, que existe desde Chromium 113. En un equipo mas viejo
caen en la bezier mas parecida en vez de quedarse sin animacion.

## Cosas que no se deducen del codigo

**El transform de los efectos va DESPUES del translate de posicion, nunca antes.**
`.glass-content` ya usa `transform` para colocarse contra su ancla y `transform-origin`
apunta a esa ancla. En `translate(pos) scale(s)` el punto de origen queda quieto pase lo
que pase con la escala; en `scale(s) translate(pos)` el arte ademas se corre —el translate
tambien se escala— y un zoom del 60% deja el glass movido de su sitio. De ahi sale que
`PositionManager` exponga `getPositionStyles()`: los efectos necesitan el translate suelto
para reponerlo delante de lo suyo en cada cuadro.

**El desplazamiento de `slide` se mide en pixeles contra la ventana, no en porcentaje del
arte.** `translate(-100%)` saca al arte de su propio ancho, y un mensaje chico en el centro
de la pantalla no entra desde afuera: aparece de la nada en la mitad. El motor mide el
rectangulo que ocupa el arte ya colocado y calcula lo que falta hasta el borde.

**Las dos puntas de la animacion tienen que declarar las mismas propiedades.** Un
`clip-path` que va de un `inset` a `none` no interpola: salta al final. Un `filter` de
`blur(8px)` a `none`, igual. Por eso el estado de reposo dice `blur(0px)` y
`inset(0% 0% 0% 0%)` en vez de no decir nada.

**Se usa la Web Animations API y no `transition`.** Con `transition` hay que escribir el
estado inicial, forzar un reflow y recien ahi escribir el final; con dos fases combinables
y propiedades que no son solo opacidad eso se vuelve una carrera. Ademas WAAPI deja
cancelar la entrada a mitad de camino, que es lo que pasa cuando el mensaje se baja antes
de que termine de entrar.

**La animacion de entrada se cancela al terminar.** Queda con `fill: both`, y si se la
dejara viva le ganaria a cualquier estilo que se escriba despues: la salida escribiria
`transform` y `opacity` y no se veria nada. Al terminar la entrada se pasa el estado final
a estilo del elemento y se descarta la animacion.

**El boton de confirmacion se arma cuando la entrada termino.** Se coloca midiendo donde
quedo el arte, y durante la entrada el arte todavia se esta moviendo: puesto antes, la X
queda clavada donde el glass estaba a mitad de camino.

**El reloj de duracion arranca cuando el arte se inserta, no cuando termina de entrar.**
Es lo que hacia el fundido de siempre. Moverlo cambiaria la exposicion de todos los
mensajes que ya estan cargados.

## El splash entra distinto cada vez

El saludo de arranque (`dom-events.ts`, `showSplash`) sortea su entrada y su salida por
separado con `transicionAlAzar()`, que es lo mismo que consigue un mensaje pidiendo el
efecto `random`. Las dos puertas dan a la misma lista curada, `fx/presentables.ts`, que no
es una combinacion al voleo: `spin` con `iris`, o un giro de 360 grados sobre un arte
grande, salen mal. Cada entrada de esa lista es una fase entera, porque lo que hace que un
efecto quede bien son los tres valores juntos —efectos, duracion y curva—, no el nombre.

Vive en su propio archivo, sin importar nada, para que la lean `spec.ts` —que resuelve
`random`— y `azar.ts` sin importarse en circulo.

Es la misma lista que ofrece el panel al armar un mensaje: si se agrega un efecto bueno hay
que agregarlo en los dos lados, que son repos distintos y no comparten codigo.

## Quien elige el efecto

En el panel **no se arma un efecto: se elige uno de una lista**. La lista vive en
`glassnote-next/src/app/admin/message/interfaces/ITransition.ts` y es corta a proposito:
armar mensajes tiene que ser fluido. Un efecto nuevo se inventa aca, en el banco de
pruebas, y si vale la pena se agrega a esa lista para todos. La escotilla de escape del
panel es "Avanzado", que acepta pegado el mismo JSON que imprime el banco.

## Banco de pruebas

`npm run dev` y `/fx-lab.html`. Se elige la fase, los efectos, la curva y la posicion, se
dispara la entrada y la salida, y abajo queda escrito el JSON listo para pegar en el panel.
No entra en el build: el bundle solo toma `index.html`.

El arte es el **splash del cliente** (`public/splash.html`), escalado con el mismo
ScaleCalculator que usa el renderer de verdad. No es un rectangulo de color a proposito:
un efecto se ve distinto sobre una forma con transparencia que sobre un bloque lleno, y el
splash esta siempre a mano sin depender de la API ni de un upload.

## Lo que no es un efecto de entrada ni de salida

Sacudir, latir, pulsar. Eso es enfasis en bucle mientras el glass esta puesto: otro ciclo
de vida, otro lugar. Aca solo vive lo que pasa una vez al entrar y una vez al salir.
