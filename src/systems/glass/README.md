# Escala y posicion de los glasses

El arte se disena sobre un lienzo de **1920x1080**. La ventana casi nunca tiene esa
proporcion, asi que hay que decidir que se estira, que se recorta y donde queda el
sobrante. Las reglas no son las mismas en una pantalla apaisada que en una vertical,
porque no se usan para lo mismo.

Todo lo de aca esta medido sobre la app real, no deducido del codigo.

## Escala

| | Apaisada (ancho >= alto) | Vertical (alto > ancho) |
|---|---|---|
| escala | `W / max(1920, anchoArte)` | `min(1, W/anchoArte, H/altoArte)` |
| manda | el ancho de la ventana | el eje que quede chico |
| desborde | vertical, permitido | **nunca**: o entra justo o se achica |
| amplia el arte | si, si la pantalla es mas ancha que 1920 | no, nunca pasa del tamano real |

**Apaisada.** El ancho de la ventana *es* el 1920 del lienzo: un arte de 1920 de ancho
ocupa la pantalla de borde a borde y uno de 960 ocupa la mitad, sin importar la proporcion
de la ventana. El arte no se toca salvo que se desborde a lo ancho, y ahi se achica lo
justo para que el ancho entre. Que haya recorte o no es solo la consecuencia de si el alto
resultante pasa del alto de la pantalla:

    pantalla 1920x1060  ->  arte 1920x1080  ->  faltan 20px  ->  recorta
    pantalla 1920x1080  ->  arte 1920x1080  ->  justo        ->  nada
    pantalla 1920x1090  ->  arte 1920x1080  ->  sobran 10px  ->  espacio libre

**Vertical.** Es lo que se usa en moviles: el arte crece hasta llenar la pantalla o hasta
su tamano real, lo que pase primero. Medido en 1080x1920:

    arte  100x100   ->   100x100    escala 1.000   no se agranda
    arte 3000x4000  ->  1080x1440   escala 0.360   inscrito, sin recorte
    arte 1080x1920  ->  1080x1920   escala 1.000   exacto
    arte 1920x1080  ->  1080x608    escala 0.563

## Posicion

`position` es `{h, v}` con indices 0/1/2: izquierda/centro/derecha y arriba/centro/abajo.
`PositionManager` ancla el contenido con `top` + `transform`, y de ahi sale solo de que
lado cae la diferencia entre el alto del arte y el de la pantalla. No hay codigo especial
para el recorte: es la misma mecanica con el signo cambiado.

Arte de 1920x1080, medido:

    pantalla 1920x1060 (falta)     v=0  recorta  0px arriba, 20px abajo
                                   v=1  recorta 10px arriba, 10px abajo
                                   v=2  recorta 20px arriba,  0px abajo

    pantalla 1920x1090 (sobra)     v=0  sobra    0px arriba, 10px abajo
                                   v=1  sobra    5px arriba,  5px abajo
                                   v=2  sobra   10px arriba,  0px abajo

En vertical nunca hay recorte, asi que `v` solo reparte el aire.

## Para quien hace el arte

Las plantillas se dibujan a 1920x1080 con la intencion de que ocupen todo el ancho, y por
eso perder alto esta bien: es lo que la regla de apaisado da por sentado.

**Una barra de noticias tiene dos formas de hacerse, y no hay que mezclarlas:**

1. Lienzo 1920x1080 con la barra dibujada abajo, mensaje en `v:1` (centro).
   En una ventana de 1920x1055 se recortan 13px arriba y 12 abajo. La barra esta a 207px
   del fondo del lienzo, asi que no la toca.

2. Lienzo 1920 x alto real de la barra, mensaje en **`v:2` (abajo)**.
   Entra exacta, cero recorte, pegada al borde.

El error a evitar es recortar el lienzo y dejar `v:1`: con lienzo de 1080 la posicion del
mensaje casi no importaba porque el arte ocupaba toda la pantalla, pero al recortarlo pasa
a ser la que manda, y la barra queda flotando en la mitad. Medido, barra de 1920x200 en
pantalla de 1920x1055:

    v=1 centro  ->  arriba=428  abajo=628    flotando en el medio
    v=2 abajo   ->  arriba=855  abajo=1055   pegada al borde

## Geometria de la ventana

En Linux el overlay no va a la pantalla entera sino de la barra de arriba al borde de
abajo, y hay que reponer esa geometria en cada `show()` porque el gestor la recoloca. Eso
vive en `main.js` del cliente, no aca; el detalle esta en los comentarios de
`fijarGeometria()`.

Lo que importa desde este lado: **la ventana casi nunca es 16:9**. Cualquier pantalla
16:9 con una barra de tareas ya queda mas ancha que 16:9. El desborde vertical en apaisado
es la situacion habitual, no la excepcion.

## Un arte vertical en una pantalla apaisada se corta, y esta bien

No hay excepcion: se aplica la misma regla de siempre, se ajusta al ancho y se recorta
segun la posicion. Un arte de 1080x1920 en una ventana de 1920x1055 queda en 1080x1920 y
se ven 1055 de esos 1920.

Es a proposito. Un arte vertical enviado a un equipo horizontal es un error de diseno o de
asignacion, no un caso que el renderer tenga que salvar. La regla de apaisado esta pensada
para el arte que se hace a 1920x1080 con la intencion de llenar el ancho; que un arte que
no sigue esa intencion se vea mal es la senal de que hay que corregir el arte o a quien se
le asigno.
