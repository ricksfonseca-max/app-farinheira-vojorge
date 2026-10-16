// Identidade visual da planta. Para instalar em outra farinheira, troque a logo em /public
// e estes textos (ou defina as variáveis VITE_* no build) — o resto do app não muda.
export const MARCA = {
  nome: (import.meta.env.VITE_MARCA_NOME as string | undefined) || "Vô Jorge",
  logo: (import.meta.env.VITE_MARCA_LOGO as string | undefined) || "/logo-vojorge.png",
  titulo: (import.meta.env.VITE_MARCA_TITULO as string | undefined) || "Controle de Qualidade",
  subtitulo: (import.meta.env.VITE_MARCA_SUBTITULO as string | undefined) || "Farinheira · Fornos",
};
