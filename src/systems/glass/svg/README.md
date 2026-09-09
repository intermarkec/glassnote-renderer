# Parser de SVG

Sustituye las variables `%VAR%` de una plantilla y compone los textos que llevan marco.

## Por que hace falta

SVG no parte lineas. Un `<text>` se dibuja siempre en una sola linea, y las dos formas
de "texto de marco" que existen no las implementa ningun navegador:

| Forma | Origen | Que hace el navegador |
|---|---|---|
| `<flowRoot>` + `<flowRegion>` + `<flowPara>` | SVG 1.2, Inkscape 0.92 | nada, el texto no se ve |
| `<text style="shape-inside:url(#rect)">` | SVG 2, Inkscape 1.x, por defecto | dibuja los `<tspan>` que horneo Inkscape |
| `<text style="inline-size:N">` | SVG 2, Inkscape 1.x | dibuja los `<tspan>` que horneo Inkscape |

En los dos ultimos casos Inkscape guarda su propio resultado de wrap como `<tspan x y>`
posicionados. Eso se ve, pero son las lineas que Inkscape calculo **antes** de sustituir
las variables: con un `%NOMBRE%` largo el texto se sale del marco.

## Que hace

1. **Espera a las fuentes.** Medir con la fuente de reemplazo da cortes equivocados.
2. **Sustituye los `%VAR%`** sobre el DOM, no sobre la cadena del archivo. Inkscape parte
   una variable entre varios `<tspan>` en cuanto se edita a mitad de palabra, y un
   `replace` de texto plano no la encuentra. El estilo de cada tramo se conserva.
3. **Detecta las areas** en las tres formas de la tabla.
4. **Compone**: mide cada palabra con canvas, llena lineas hasta el ancho util y emite un
   `<tspan>` por linea con su `x` e `y` resueltos.

## Reglas de composicion

- **Salto duro vs. salto por wrap.** En `shape-inside` e `inline-size` los `<tspan>` que
  dejo Inkscape son resultado de wrap: se concatenan y se vuelve a partir. El salto que
  escribio el autor sobrevive como un `\n` literal dentro del tspan, y ese si se respeta.
- **Alineacion.** Manda `text-align` si dice algo distinto de `start`; si no, decide
  `text-anchor`. Justificado reparte el sobrante entre los espacios de la linea con
  `word-spacing`; la ultima linea de cada parrafo no se justifica.
- **Desborde.** Si el texto no entra en el alto del marco se reduce el cuerpo por busqueda
  binaria hasta que entre, hasta un minimo del 15%. Nunca se descarta contenido.
  `inline-size` no acota el alto, asi que ahi no se reduce nada.
- **Primera linea base.** `top + fontSize * ascendente + (lineHeight - fontSize) / 2`, que
  es como la coloca Inkscape. Con `inline-size` y con texto plano va exactamente en la `y`
  declarada.
- **Texto plano.** Un `<text>` sin marco no se toca, salvo que la sustitucion haya metido
  un salto de linea: en ese caso se reparte en varias lineas y las que venian despues se
  empujan hacia abajo, conservando su interlineado original.

## Fidelidad con el arte original

Lo que no es texto no se toca: el motor solo reemplaza los elementos de texto, y lo hace
con `replaceChild`, asi que el nodo nuevo queda en la misma posicion entre sus hermanos,
dentro del mismo grupo, y conserva `id`, `transform`, `clip-path`, `mask`, `filter`,
`opacity`, `class` y cualquier atributo propio. Un `<use>` que apuntaba al texto por su
`id` sigue resolviendo.

Comparado contra el render del propio Inkscape sobre un arte con grupos anidados,
rotaciones, `clipPath`, mascara de luminancia, filtro de desenfoque, degradados lineal y
radial con `gradientTransform`, y un patron de fondo: **todo lo que no es texto sale
identico**. La unica diferencia esta en los glifos, y es el rasterizador: Inkscape dibuja
con Cairo y el navegador con Skia. Medida sobre ese arte, el 97.5% de los pixeles no
llega a diferenciarse en 8 niveles sobre 255, y el bloque de texto no tiene desplazamiento
sistematico: la mejor alineacion entre ambos renders es exactamente cero.

Los export de Illustrator tambien salen identicos. Illustrator posiciona el texto con
`transform="matrix(...)"` en vez de `x`/`y`, y eso funciona igual. Ojo con una cosa: al
exportar, Illustrator **pierde el marco** del texto de area y lo escribe como lineas ya
partidas. Un texto de Illustrator no se puede volver a partir porque no queda en el
archivo la caja que lo contenia; si hace falta wrap, el arte tiene que venir de Inkscape.

El SVG se parsea como XML y se cae al parser de HTML solo si el archivo no es XML bien
formado. Para SVG estandar ambos caminos dan un render byte a byte identico; el parseo
XML solo hace falta por el `<flowRoot>` de Inkscape, que el parser de HTML convierte a
`<flowroot>` por no conocerlo.

## Marquesina de noticias

Un texto marcado con `%NEWS%` no se compone: se convierte en marquesina. Se puede hacer
con SVG puro y no hace falta pasar por HTML.

    <g [transform del texto original]>      <- ocupa el lugar exacto del <text>
      <g clip-path="url(#...)">             <- la ventana por la que se asoma
        <g id="gn-news-track-...">          <- lo unico que se anima
          <text/> <text/> <text/>           <- copias encadenadas

- **La ventana** es el marco si el disenador dibujo uno; si el texto es suelto, el ancho
  del lienzo. Antes no habia recorte y el texto pasaba por encima del resto del arte.
- **El ancho** lo da el medidor, con las fuentes ya cargadas. Antes se pedia con
  `getBBox()` tras un `setTimeout` de 50 ms, y si las fuentes llegaban tarde el ancho
  salia mal, o se usaba un 200 fijo. De ese ancho depende la duracion del recorrido.
- **El bucle empalma**: se emiten copias suficientes para cubrir la ventana y se desplaza
  exactamente un paso, asi que la copia siguiente queda donde estaba la anterior.
  Verificado comparando el fotograma en t=0 con el de una vuelta completa: identicos,
  diferencia maxima 0. Antes el texto desaparecia y reaparecia desde el principio.
- **Los estilos sobreviven**: si en el arte la noticia esta en negrita o en otro color,
  se conserva. Antes se hacia `textContent = ...`, que aplana todos los `<tspan>` y se
  lleva por delante cualquier estilo por tramo.
- **La animacion es CSS**, no SMIL. Con `%LOOP%` en false se hace una sola pasada, entra
  por la derecha y sale por la izquierda, y al terminar avisa por `animationend`.

Cambio de aspecto respecto de lo anterior: ya no hay el fundido de entrada y salida que
hacia el `<animate>` de opacidad en cada vuelta. Con el bucle continuo no hace falta, y
con la pasada unica el texto entra y sale deslizandose.

## Limites conocidos

- **Fuentes genericas.** El navegador y Inkscape resuelven `sans-serif` a fuentes
  distintas (aca, Liberation Sans contra Noto Sans), asi que los cortes de linea no
  coinciden con lo que muestra Inkscape. Con una fuente nombrada explicitamente en la
  plantilla, coinciden exactamente. Conviene nombrar la fuente en el arte.
- **Metricas verticales.** Inkscape usa las metricas OS/2 typo y el navegador solo expone
  las hhea. En las fuentes donde ambas coinciden (las Noto y casi todas las modernas) la
  linea base cae en el mismo sitio; donde difieren, como DejaVu Sans, queda 0.04 em mas
  abajo: medio pixel a cuerpo 16.
- No hay soporte de texto de derecha a izquierda ni de escritura vertical.
- Un texto de area exportado desde Illustrator no se puede volver a partir: el export no
  conserva el marco.
- `shape-inside` sobre una forma que no sea un rectangulo se aproxima por su caja
  envolvente: no se contornea la forma real.

## Banco de pruebas

```
npm run dev
```

y abrir <http://localhost:5173/svg-lab.html>. Muestra cada plantilla de
`templates/svg-lab/` dos veces, como la dibuja el navegador hoy y como queda despues del
motor, con los parametros editables en vivo. No entra en el build: solo se empaqueta
`index.html`.

Para comparar contra Inkscape, sustituir las variables en el archivo y dejar que Inkscape
lo vuelva a guardar; escribe su propio wrap en `<tspan x y>` y se pueden cotejar linea
por linea.
