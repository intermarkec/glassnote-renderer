declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
// `?inline` de vite: el CSS llega como string en vez de inyectarse en la pagina.
declare module '*.css?inline' {
  const contenido: string;
  export default contenido;
}
