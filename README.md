# ProjectJudge — Evaluador de informes de ingeniería con IA

Herramienta web que ayuda a un **profesor** a evaluar informes, proyectos y anteproyectos de
ingeniería. El profesor aporta una **rúbrica** (pegándola o adjuntándola) y el **informe de un
alumno**; la aplicación extrae el contenido (texto y figuras), lo analiza contra la rúbrica y, si los
hay, contra informes de referencia, y devuelve una valoración estructurada por criterios y por
apartados, con fortalezas, mejoras y evidencias.

Es una herramienta de **apoyo**: no emite nota global, para no suplantar el criterio del profesor.

https://projectjudge.pages.dev/

## Flujo en tres pasos

1. **Rúbrica** — Se pega el texto, o se adjunta un archivo (`.md`, `.txt`, `.docx`, `.pdf`,
   `.xlsx`, `.xls`, `.csv`) desde la barra lateral. La IA la interpreta como criterios con niveles y
   puntuaciones, y el profesor la revisa y confirma antes de evaluar nada.
2. **Documentos** — Se sube el informe a evaluar (`.pdf`, `.docx`, `.md`, `.txt`) y, opcionalmente,
   hasta 2 informes de referencia. Antes de lanzar se muestra el resumen de extracción y una
   estimación de llamadas y tokens.
3. **Resultados** — Ficha del informe, valoración global cualitativa, criterios con puntuación y
   evidencia, evaluación por apartados, criterios no evaluables, comprobaciones mecánicas,
   apartados ausentes, próximos pasos y coherencia. Se puede descargar en PDF (impresión)
   y en Word editable.

## Requisitos

- Node.js ≥ 20 y npm.
- Una API key de **Google AI Studio** (capa gratuita, sin tarjeta). Se introduce en la barra
  lateral y se guarda solo en el navegador.

## Ejecución local

```bash
npm install
npm run dev      # abre http://localhost:5173
```

## Pruebas y calidad

```bash
npm test         # suite Vitest (unitarias + componentes)
npm run typecheck
npm run lint
npm run build    # genera dist/
```

## Modelos de IA y reintentos

Modelos disponibles (en este orden de preferencia): `gemini-3.8-flash`, `gemini-3.6-flash`,
`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`. Ante saturación o errores de red, cada modelo
reintenta con espera creciente; si agota los reintentos, la evaluación pasa automáticamente al
siguiente modelo y recuerda cuál funciona. Cada petición tiene además un límite de 3 minutos.

## Despliegue (Cloudflare Pages, gratis)

1. `npm run build` (genera `dist/`).
2. Opción A: conecta el repositorio en el panel de Cloudflare Pages (comando de build
   `npm run build`, directorio `dist`).
3. Opción B: `npx wrangler pages deploy dist`.

## Privacidad

- La API key vive solo en el navegador del profesor (`localStorage`); nunca se sube a ningún
  sitio ni se escribe en el repositorio.
- El contenido de los informes se envía a Google AI Studio. En la capa gratuita hay revisión
  humana de prompts y respuestas: no subir documentos con datos confidenciales.
- La app no tiene servidor ni base de datos propios.

## Limitaciones conocidas

- Los PDF escaneados (sin capa de texto) no tienen OCR: se avisa y no se evalúan.
- Las figuras embebidas de los PDF se envían a la IA (máximo 3 por apartado, en JPEG). Si una
  sección cita figuras sin imagen extraíble (p. ej. gráficos vectoriales), se renderizan como
  imagen las páginas con sus pies de figura (máximo 6 por documento).
- Las figuras de los DOCX aún no se enlazan con sus apartados.
- Se evalúan como máximo 20 secciones por informe y 2 informes de referencia.
- La herramienta no calcula nota global por diseño.
