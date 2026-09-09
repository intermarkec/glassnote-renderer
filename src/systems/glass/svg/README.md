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
