# ProyectJudge — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan sintaxis de casillas (`- [ ]`) para el seguimiento.

**Objetivo:** construir ProyectJudge, una aplicación web (sin servidor) que ayuda a un profesor a evaluar informes de proyectos de ingeniería a partir de una rúbrica que él aporta, con análisis multimodal por secciones y salida en pantalla, PDF y Word.

**Arquitectura:** todo se ejecuta en el navegador. La extracción convierte PDF/DOCX/MD en un `ExtractedDocument` (texto + secciones + figuras); la rúbrica se normaliza con IA y el profesor la corrige; un orquestador encadena mapa estructural → evaluación por secciones (concurrencia limitada) → síntesis cualitativa; y `report/` genera PDF y Word desde el mismo `ReportView`.

**Stack:** Vite + React 19 + TypeScript + Tailwind CSS 4, pdfjs-dist, jszip, marked, @google/genai, docx, idb-keyval, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-proyectjudge-design.md`

## Restricciones globales

- **Sin nota global.** Ni la síntesis ni la UI calculan ni muestran una puntuación numérica global.
- **Solo Gemini** como proveedor de IA. Toda llamada pasa por `src/lib/ai/gemini.ts`; nada más importa `@google/genai`.
- **La API key vive solo en el navegador** del profesor (`localStorage`); nunca se escribe en el repositorio ni se sube a ningún sitio.
- **Sin servidor, sin base de datos remota.** Los informes de referencia se guardan en IndexedDB del equipo.
- **Topes de presupuesto (valores exactos de la spec §9):** 6.000 caracteres por sección, 60.000 por informe evaluado, 10.000 por informe de referencia, 3 figuras por sección, 2 informes de referencia, 20 secciones evaluadas, concurrencia máxima 2, 4 reintentos con espera inicial de 2.000 ms duplicada en cada intento.
- **Filtro de figuras (spec §7):** descartar área < 20.000 px, cualquier lado < 100 px, peso < 30 KB y duplicados por hash SHA-1 de los bytes originales; redimensionar las supervivientes a 1.024 px de lado mayor y recodificar a JPEG calidad 0,8.
- **Valoración global cualitativa:** exactamente uno de `Correcto` | `Mejorable` | `Insuficiente`.
- **Textos de interfaz, mensajes de error y comentarios en español.**
- **Todos los módulos puros se prueban con Vitest;** las llamadas a IA se prueban siempre con clientes dobles inyectados.
- **Node ≥ 20** y comandos con `npm`.

## Enfoque de revisión

Cinco clases de entrada que la spec implica pero que ninguna prueba unitaria obvia cubre, y la conducta esperada:

1. **PDF escaneado o sin capa de texto** → la extracción no devuelve texto: debe avisar («el PDF no tiene texto extraíble, parece un escaneado») y no evaluar en silencio. Prueba en la Tarea 4.
2. **Documento sin ningún encabezado** (informe pegado como texto plano): debe tratarse como una única sección, no como secciones vacías ni como fallo. Prueba en las Tareas 3, 4 y 5.
3. **Logo o icono repetido en cada página** → se descarta por hash y por tamaño; no se envía a la IA ni consume cuota. Prueba en la Tarea 2.
4. **Respuesta de la IA con datos inválidos** (criterio que no está en la rúbrica, puntuación fuera de rango, valoración global fuera del enumerado) → se normaliza o se rechaza con error claro, nunca se propaga a la UI. Prueba en las Tareas 11 y 12.
5. **Informe enorme** (más de 20 secciones o más de 60.000 caracteres) → recorte anunciado, secciones sobrantes marcadas como no evaluadas y estimación previa visible. Prueba en las Tareas 11 y 13.

---

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `src/types/extract.ts` | `Figure`, `Section`, `ExtractedDocument`, `FigureCandidate` |
| `src/types/rubric.ts` | `RubricModel`, `RubricCriterion`, `RubricLevel` |
| `src/types/evaluation.ts` | `TemplateSlot`, `DocumentMap`, `SectionEvaluation`, `Synthesis`, `ReportView`, `ReferenceDocument` |
| `src/types/app.ts` | `Settings`, `ReferenceLabel` |
| `src/lib/text.ts` | `truncateText` y recuento de palabras (puro) |
| `src/lib/extract/figures.ts` | `selectFigures` (filtros + dedupe + tope) y `reencodeFigure` (canvas inyectable) |
| `src/lib/extract/markdown.ts` | Markdown → secciones (puro sobre tokens) |
| `src/lib/extract/pdfModel.ts` | volcado de páginas de PDF → secciones y candidatos a figura (puro) |
| `src/lib/extract/pdf.ts` | envoltorio pdfjs + codificador de imágenes por canvas |
| `src/lib/extract/docxModel.ts` | `document.xml` + media → secciones y candidatos (puro) |
| `src/lib/extract/docx.ts` | envoltorio jszip + DOMParser |
| `src/lib/extract/extractDocument.ts` | fachada por extensión/MIME, advertencias globales |
| `src/lib/ai/limiter.ts` | `createConcurrencyLimiter` (puro) |
| `src/lib/ai/gemini.ts` | `createGeminiClient(deps)` con reintentos + `createGeminiClientFromKey` |
| `src/lib/templates/sections.ts` | plantilla de apartados de ingeniería y palabras clave |
| `src/lib/rubric/parseRubric.ts` | texto → `RubricModel` con caché por huella |
| `src/lib/evaluation/buildDocumentMap.ts` | secciones → cobertura de la plantilla |
| `src/lib/evaluation/evaluateSections.ts` | evaluación por sección con recortes y normalización |
| `src/lib/evaluation/synthesize.ts` | síntesis cualitativa global |
| `src/lib/evaluation/orchestrate.ts` | encadenado de las tres fases + `estimateEvaluation` |
| `src/lib/storage/settings.ts` | `localStorage` inyectable |
| `src/lib/storage/references.ts` | almacén IndexedDB inyectable |
| `src/lib/report/buildReport.ts` | `ReportView` → bloques imprimibles (puro) |
| `src/lib/report/toDocx.ts` | `ReportView` → `.docx` |
| `src/state/appMachine.ts` | reductor puro de la máquina de estados de la UI |
| `src/hooks/useSettings.ts`, `src/hooks/useEvaluation.ts` | cableado de UI con almacenamiento y orquestador |
| `src/components/*` | `Sidebar`, `RubricPanel`, `DocumentsPanel`, `ResultsPanel`, `ProgressPanel`, `ErrorNotice` |

---

## Tarea 1: Andamiaje del proyecto y contratos compartidos

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `src/vite-env.d.ts`, `eslint.config.js`, `src/test/setup.ts`, `src/App.test.tsx`, `src/types/extract.ts`, `src/types/rubric.ts`, `src/types/evaluation.ts`, `src/types/app.ts`

**Interfaces:**
- Consumes: nada.
- Produces: los cuatro ficheros de tipos de `src/types/` (definiciones exactas en la spec §6) y los scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`. Todas las tareas siguientes importan de aquí.

- [ ] **Paso 1: Crear la configuración del proyecto**

`package.json` con dependencias `react`, `react-dom`, `lucide-react`, `@google/genai`, `pdfjs-dist`, `jszip`, `marked`, `docx`, `idb-keyval`; desarrollo `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `typescript`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`. `vite.config.ts` con los plugins `react()` y `tailwindcss()` y `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] }`.

- [ ] **Paso 2: Escribir la prueba de humo que falla**

`src/App.test.tsx`: renderiza `<App />` y afirma que aparece el texto `ProyectJudge` y el aviso de que falta la API key.

- [ ] **Paso 3: Ejecutar y comprobar que falla**

Run: `npm test`
Expected: FAIL, no se puede resolver `./App`.

- [ ] **Paso 4: Implementar el andamiaje mínimo**

`src/App.tsx` con el título y el aviso; `src/index.css` con `@import "tailwindcss";`; `src/test/setup.ts` importando `@testing-library/jest-dom/vitest`; los cuatro ficheros de tipos con las definiciones de la spec §6.

- [ ] **Paso 5: Verificar**

Run: `npm test` (PASS) y `npm run typecheck` (sin errores).

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "chore: andamiaje del proyecto y contratos de tipos"
```

---

## Tarea 2: Recorte de texto y selección de figuras

**Files:**
- Create: `src/lib/text.ts`, `src/lib/extract/figures.ts`, `src/lib/text.test.ts`, `src/lib/extract/figures.test.ts`

**Interfaces:**
- Consumes: `FigureCandidate`, `Figure` de `src/types/extract.ts`.
- Produces: `truncateText(text: string, maxChars: number): { text: string; truncated: boolean }`; `selectFigures(candidates: FigureCandidate[], options?: { maxFigures?: number }): { figures: Figure[]; discarded: number }`; `reencodeFigure(candidate: FigureCandidate, maxEdge: number, factory?: CanvasFactory): Promise<Figure>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`text.test.ts`: `truncateText('abcdef', 3)` devuelve `{ text: 'abc', truncated: true }`; un texto por debajo del límite devuelve `truncated: false` y el texto íntegro; el resultado termina con `[…]` cuando recorta.

`figures.test.ts`: se descarta una candidata con `width * height < 20000`; se descarta con cualquier lado `< 100`; se descarta con `bytes < 30 * 1024`; dos candidatas con el mismo `hash` dejan una sola y `discarded` cuenta la otra; con `maxFigures: 2` y tres candidatas válidas se conservan las dos primeras en orden; los identificadores asignados son `fig-0`, `fig-1`, …; `reencodeFigure` con una fábrica de canvas falsa devuelve la imagen reescalada con `mimeType: 'image/jpeg'` y `width`/`height` ajustados a 1.024 px de lado mayor.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**

Run: `npm test src/lib/text.test.ts src/lib/extract/figures.test.ts`
Expected: FAIL, módulos no encontrados.

- [ ] **Paso 3: Implementar**

`selectFigures` filtra por área, lado y peso, deduplica por `hash` conservando la primera aparición, aplica el tope y asigna `id` correlativo. `reencodeFigure` usa la fábrica inyectada (`CanvasFactory = (w, h) => { canvas, ctx }`) y por defecto una implementación con `createImageBitmap` + `<canvas>`.

- [ ] **Paso 4: Verificar**

Run: `npm test src/lib/text.test.ts src/lib/extract/figures.test.ts`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add -A
git commit -m "feat: recorte de texto y seleccion de figuras"
```

---

## Tarea 3: Extracción de Markdown

**Files:**
- Create: `src/lib/extract/markdown.ts`, `src/lib/extract/markdown.test.ts`

**Interfaces:**
- Consumes: `marked`, `selectFigures` si hubiera candidatas (no las hay en MD).
- Produces: `markdownToModel(markdown: string): { sections: Section[]; figures: Figure[]; warnings: string[] }`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Markdown con `# Título`, `## Metodología` y párrafos: dos secciones, la primera con `level: 1` y la segunda con `level: 2`, y el texto de cada párrafo acumulado en su sección. Markdown sin encabezados: una única sección con `title` vacío y todo el texto, más una advertencia. Markdown con `![figura](http://…)`: advertencia de que las imágenes por URL no se incluyen.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**

Run: `npm test src/lib/extract/markdown.test.ts`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

`marked.lexer` para recorrer tokens `heading` y `paragraph`; los `heading` abren sección; expresiones regulares `!\[[^\]]*\]\([^)]*\)` para detectar imágenes externas y generar el aviso.

- [ ] **Paso 4: Verificar** — Run: `npm test src/lib/extract/markdown.test.ts` → PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: extraccion de secciones desde Markdown"`.

---

## Tarea 4: Modelo de PDF (secciones y figuras por página)

**Files:**
- Create: `src/lib/extract/pdfModel.ts`, `src/lib/extract/pdfModel.test.ts`

**Interfaces:**
- Consumes: `Section`, `FigureCandidate` de `src/types/extract.ts`.
- Produces: `pdfPagesToModel(pages: PdfPageDump[], keywords: string[]): { sections: Section[]; figureCandidates: FigureCandidate[]; warnings: string[] }`; `looksLikeHeading(line: string, keywords: string[]): boolean`.

`PdfPageDump = { pageNumber: number; lines: string[]; images: { name: string; width: number; height: number; hash: string }[] }`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Páginas con líneas numeradas (`1. Introducción`), en mayúsculas (`PLANIFICACIÓN`) y normales: las cabeceras abren sección y el resto de líneas se acumula. Todas las líneas normales: una sola sección con advertencia de documento sin encabezados. Una página sin texto (`lines: []`, `images: []`): advertencia de texto no extraíble. Imágenes de dos páginas: candidatas con `sourcePage` correcto y `hash` conservado.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/extract/pdfModel.test.ts` → FAIL.

- [ ] **Paso 3: Implementar**

`looksLikeHeading`: numeración `^\d+(\.\d+)*[.)]?\s+\S` con longitud < 90, todo en mayúsculas con longitud < 60, o coincidencia con las palabras clave de la plantilla. Cada sección registra `pageStart`/`pageEnd` y las candidatas a figura de las páginas que abarca.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: modelo de extraccion de PDF"`.

---

## Tarea 5: Envoltorio de PDF con pdfjs

**Files:**
- Create: `src/lib/extract/pdf.ts`, `src/lib/extract/pdf.test.ts`

**Interfaces:**
- Consumes: `pdfPagesToModel`, `looksLikeHeading` (Tarea 4), `selectFigures`, `reencodeFigure`, `truncateText`, `SECTION_KEYWORDS` de `src/lib/templates/sections.ts` (Tarea 9 crea el fichero).
- Produces: `extractPdf(file: File, deps?: { getDocument?: (data: ArrayBuffer) => Promise<PdfDocumentLike>; encodeImage?: ImageEncoder }): Promise<ExtractedDocument>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Con un `getDocument` doble que devuelve dos páginas con texto y una imagen, y un `encodeImage` doble: se obtiene un documento con dos secciones, una figura reescalada y `stats.figuresUsed: 1`. Páginas sin texto: `warnings` contiene el aviso de PDF sin texto extraíble. Más de 60 candidatas válidas: se conservan 60 y `stats.figuresDiscarded` cuenta el resto (guardia de memoria documentada en esta tarea).

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/extract/pdf.test.ts` → FAIL.

- [ ] **Paso 3: Implementar**

Leer el `ArrayBuffer`, obtener páginas, extraer `getTextContent()` por página agrupando por líneas, recorrer la operator list para `paintImageXObject`, convertir los candidatos con `selectFigures` + `reencodeFigure` y recortar el texto total a 60.000 caracteres.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: extraccion de texto y figuras desde PDF"`.

---

## Tarea 6: Extracción de DOCX

**Files:**
- Create: `src/lib/extract/docxModel.ts`, `src/lib/extract/docxModel.test.ts`, `src/lib/extract/docx.ts`, `src/lib/extract/docx.test.ts`

**Interfaces:**
- Consumes: `selectFigures`, `truncateText`.
- Produces: `documentXmlToModel(xml: string, media: Record<string, { base64: string; mimeType: string; width: number; height: number; bytes: number; hash: string }>): { sections: Section[]; figureCandidates: FigureCandidate[]; warnings: string[] }`; `extractDocx(file: File): Promise<ExtractedDocument>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`documentXmlToModel` con XML sintético que tenga párrafos con `w:pStyle w:val="Heading1"` y `"Heading2"`: secciones con `level` 1 y 2. Sin ningún Heading: una sección y advertencia. Un `w:drawing` con `a:blip r:embed="rId4"` entre dos párrafos: la imagen queda asignada a la sección abierta. `extractDocx` sobre un `.docx` construido en memoria con `jszip` (document.xml + `word/media/image1.png`): devuelve secciones y una figura.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/extract/docxModel.test.ts src/lib/extract/docx.test.ts` → FAIL.

- [ ] **Paso 3: Implementar**

`docxModel` recorre `w:body` con `DOMParser`; `docx` abre el zip con `jszip`, lee `word/document.xml`, convierte las entradas de `word/media/` a base64 y delega en el modelo puro.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: extraccion de texto y figuras desde DOCX"`.

---

## Tarea 7: Fachada de extracción

**Files:**
- Create: `src/lib/extract/extractDocument.ts`, `src/lib/extract/extractDocument.test.ts`

**Interfaces:**
- Consumes: `extractPdf`, `extractDocx`, `markdownToModel`, `selectFigures`, `truncateText`.
- Produces: `extractDocument(file: File): Promise<ExtractedDocument>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`.pdf` → delega en `extractPdf`; `.docx` → `extractDocx`; `.md` → modelo Markdown; `.txt` → una sección única con todo el texto (rúbrica pegada como archivo); `.exe` → error `Formato no compatible…`; archivo vacío → documento con `stats.words: 0` y advertencia. Recorte a 60.000 caracteres con `text.truncated` reflejado en una advertencia.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/extract/extractDocument.test.ts` → FAIL.

- [ ] **Paso 3: Implementar** — despacho por extensión y tipo MIME, advertencias comunes y cálculo de `stats` (palabras, figuras usadas y descartadas).

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: fachada de extraccion de documentos"`.

---

## Tarea 8: Cliente de Gemini con reintentos y concurrencia

**Files:**
- Create: `src/lib/ai/limiter.ts`, `src/lib/ai/limiter.test.ts`, `src/lib/ai/gemini.ts`, `src/lib/ai/gemini.test.ts`

**Interfaces:**
- Consumes: nada (define el contrato de IA que usarán las Tareas 9-13).
- Produces:
  - `interface ConcurrencyLimiter { run<T>(task: () => Promise<T>): Promise<T> }` y `createConcurrencyLimiter(max: number): ConcurrencyLimiter`
  - `JsonRequest = { system?: string; prompt: string; images?: { base64: string; mimeType: string }[]; schema: object }`
  - `JsonClient = { generateJson<T>(request: JsonRequest): Promise<T> }`
  - `createGeminiClient(deps: GeminiDeps): JsonClient`, con `GeminiDeps = { generateContent: (params: { model: string; contents: unknown[]; config: unknown }) => Promise<{ text?: string }>; sleep?: (ms: number) => Promise<void>; maxRetries?: number; baseDelayMs?: number }`
  - `createGeminiClientFromKey(apiKey: string, model: string): JsonClient`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`limiter`: con `max: 2` y cinco tareas que registran su conteo simultáneo, el máximo observado es 2. `gemini`: una respuesta 429 seguida de éxito consume un reintento y espera 2.000 ms; un 503 tras cuatro reintentos propaga el error; un texto que no es JSON provoca exactamente un reintento y después error; el resultado se devuelve parseado como el tipo solicitado.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/ai` → FAIL.

- [ ] **Paso 3: Implementar**

Limiter con contador de tareas activas y cola. Cliente: reintentos con espera `baseDelayMs * 2^intento` para 429/503/`UNAVAILABLE`/`high demand`, un reintento adicional cuando `JSON.parse` falla, y `generateContent` inyectado para poder probar sin red.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: cliente de Gemini con reintentos y limitador de concurrencia"`.

---

## Tarea 9: Plantilla de apartados de ingeniería

**Files:**
- Create: `src/lib/templates/sections.ts`, `src/lib/templates/sections.test.ts`

**Interfaces:**
- Consumes: `TemplateSlot` de `src/types/evaluation.ts`.
- Produces: `ENGINEERING_SECTIONS: TemplateSlot[]` (Antecedentes y estado del arte, Objetivos, Alcance, Metodología, Diseño y desarrollo, Planificación, Presupuesto, Impacto ambiental, Normativa, Riesgos, Conclusiones y líneas futuras, Bibliografía, Anexos); `SECTION_KEYWORDS: string[]` con las palabras que delatan cada apartado; `findSlotByKeywords(title: string): TemplateSlot | null`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Todos los `id` son únicos y no vacíos; `SECTION_KEYWORDS` tiene al menos una palabra por slot; `findSlotByKeywords('3. Planificación temporal')` devuelve el slot de Planificación; `findSlotByKeywords('Anexo II')` devuelve Anexos; un título irreconocible devuelve `null`.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/templates` → FAIL.

- [ ] **Paso 3: Implementar** la plantilla con las palabras clave en minúsculas y la búsqueda sin distinguir mayúsculas ni acentos.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: plantilla de apartados de proyectos de ingenieria"`.

---

## Tarea 10: Interpretación de la rúbrica

**Files:**
- Create: `src/lib/rubric/parseRubric.ts`, `src/lib/rubric/parseRubric.test.ts`

**Interfaces:**
- Consumes: `JsonClient`, `truncateText`, `RubricModel`.
- Produces: `parseRubric(rubricText: string, client: JsonClient, cache?: Map<string, RubricModel>): Promise<RubricModel>`; `fingerprint(text: string): string`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Con un cliente doble que devuelve dos criterios con niveles: el modelo tiene esos criterios con `maxScore` y niveles normalizados. Si el doble omite `maxScore`, se aplica 10 por defecto y la escala `{ min: 0, max: 10 }`. El mismo texto con la misma caché provoca una sola llamada (segunda ejecución sin llamadas). Textos distintos provocan dos llamadas.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/rubric` → FAIL.

- [ ] **Paso 3: Implementar** el prompt de rol de profesor de Proyectos, el esquema JSON estricto, la normalización y la caché por huella.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: interpretacion de la rubrica aportada por el profesor"`.

---

## Tarea 11: Mapa estructural del documento

**Files:**
- Create: `src/lib/evaluation/buildDocumentMap.ts`, `src/lib/evaluation/buildDocumentMap.test.ts`

**Interfaces:**
- Consumes: `JsonClient`, `ENGINEERING_SECTIONS`, `findSlotByKeywords`, `ExtractedDocument`.
- Produces: `buildDocumentMap(document: ExtractedDocument, client: JsonClient): Promise<DocumentMap>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Con un cliente doble que asigna dos secciones a dos slots: `DocumentMap.slots` marca esos dos como `present: true` con su `sectionId` y el resto como `present: false`. Si el doble devuelve un `slotId` inexistente, se ignora esa asignación y el slot queda ausente. Las secciones que no encajan en ningún slot no aparecen en `slots`: se mantienen en el documento y se evalúan igualmente con `slotId: null` (Tarea 12).

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/evaluation/buildDocumentMap.test.ts` → FAIL.

- [ ] **Paso 3: Implementar**: se envían los títulos de sección y las primeras 200 caracteres de cada una; la heurística local cubre los casos obvios y la IA resuelve el resto; `summary` en una o dos frases.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: mapa estructural del informe"`.

---

## Tarea 12: Evaluación por secciones

**Files:**
- Create: `src/lib/evaluation/evaluateSections.ts`, `src/lib/evaluation/evaluateSections.test.ts`

**Interfaces:**
- Consumes: `JsonClient`, `createConcurrencyLimiter`, `truncateText`, `RubricModel`, `ExtractedDocument`, `ReferenceDocument`, `DocumentMap`.
- Produces: `evaluateSections(input: SectionsInput, client: JsonClient, limiter: ConcurrencyLimiter): Promise<SectionEvaluation[]>` con `SectionsInput = { document: ExtractedDocument; references: ReferenceDocument[]; rubric: RubricModel; map: DocumentMap; limits?: { maxSections?: number; maxSectionChars?: number; maxReferenceChars?: number; maxFiguresPerSection?: number } }`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Con límites por defecto y dos secciones: dos llamadas, cada una con el texto recortado a 6.000 caracteres, como máximo 3 figuras y los criterios de la rúbrica. Una sección cuyo cliente doble lanza error: queda con `evaluated: false` y `error`, y la otra se evalúa normalmente. Una respuesta con `criterionId` que no está en la rúbrica se descarta; una puntuación por encima del máximo se recorta a `maxScore`. Más de 20 secciones: las 20 primeras se evalúan y las sobrantes quedan `evaluated: false` con error «no evaluada por límite de secciones». Las referencias aportan como máximo 10.000 caracteres cada una.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/evaluation/evaluateSections.test.ts` → FAIL.

- [ ] **Paso 3: Implementar** el reparto por secciones con el limiter, la construcción del payload (criterios + texto + figuras + contexto de referencia) y la normalización de la respuesta.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: evaluacion por secciones contra la rubrica"`.

---

## Tarea 13: Síntesis cualitativa

**Files:**
- Create: `src/lib/evaluation/synthesize.ts`, `src/lib/evaluation/synthesize.test.ts`

**Interfaces:**
- Consumes: `JsonClient`, `SectionEvaluation`, `DocumentMap`, `RubricModel`.
- Produces: `synthesize(input: { map: DocumentMap; sections: SectionEvaluation[]; rubric: RubricModel; referenceLabels: string[] }, client: JsonClient): Promise<Synthesis>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Con un cliente doble válido: `overallAssessment` es uno de los tres valores y el resto de campos se rellenan. Con un valor fuera del enumerado (`"Aprobado"`): se lanza un error `AiSchemaError` con el valor recibido. Sin secciones evaluadas: error claro («no hay secciones evaluadas para sintetizar»). El resultado **no contiene ninguna nota numérica global** (prueba que recorre el objeto y falla si aparece una clave con un número global).

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/evaluation/synthesize.test.ts` → FAIL.

- [ ] **Paso 3: Implementar** el prompt de coherencia entre apartados y la comparación con las referencias, con validación estricta del enumerado.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: sintesis cualitativa global"`.

---

## Tarea 14: Orquestador y estimación de coste

**Files:**
- Create: `src/lib/evaluation/orchestrate.ts`, `src/lib/evaluation/orchestrate.test.ts`

**Interfaces:**
- Consumes: `buildDocumentMap`, `evaluateSections`, `synthesize`, `JsonClient`, `ConcurrencyLimiter`, `ExtractedDocument`, `RubricModel`, `ReferenceDocument`.
- Produces:
  - `estimateEvaluation(input: { document: ExtractedDocument; references: ReferenceDocument[]; maxSections?: number }): { calls: number; tokens: number; truncated: boolean }`
  - `EvaluationProgress = { phase: 'map' | 'sections' | 'synthesis'; sectionIndex?: number; sectionTotal?: number; sectionTitle?: string }`
  - `orchestrate(input: { document: ExtractedDocument; references: ReferenceDocument[]; rubric: RubricModel; client: JsonClient; limiter: ConcurrencyLimiter; onProgress?: (p: EvaluationProgress) => void }, deps?: { newId?: () => string; now?: () => string }): Promise<ReportView>`

- [ ] **Paso 1: Escribir las pruebas que fallan**

Orden de fases: con clientes dobles que registran el orden, las llamadas son mapa → una por sección → síntesis. `onProgress` recibe `phase: 'sections'` con `sectionIndex` creciente. `ReportView` montado con `reportId` y `createdAt` de los dobles inyectados. `estimateEvaluation`: con un documento de 25 secciones y una referencia devuelve `calls: 22`, `tokens` mayor que 0 y `truncated: true`; con 3 secciones y sin referencias, `calls: 5` y `truncated: false`.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/evaluation/orchestrate.test.ts` → FAIL.

- [ ] **Paso 3: Implementar** el encadenado, el cálculo de tokens (≈ 1 token por 4 caracteres de texto y 1.000 por figura) y el montaje del `ReportView`.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: orquestador de la evaluacion y estimacion de coste"`.

---

## Tarea 15: Persistencia en el navegador

**Files:**
- Create: `src/lib/storage/settings.ts`, `src/lib/storage/references.ts`, `src/lib/storage/settings.test.ts`, `src/lib/storage/references.test.ts`

**Interfaces:**
- Consumes: `Settings`, `ReferenceDocument`, `ReferenceLabel`.
- Produces: `loadSettings(storage: Pick<Storage, 'getItem' | 'setItem'>): Settings`, `saveSettings(storage, settings: Settings): void`, `DEFAULT_SETTINGS`; `StoredReference = { id: string; label: ReferenceLabel; fileName: string; savedAt: string; document: ExtractedDocument }`; `createReferenceStore(store: KeyValLike): ReferenceStore` con `KeyValLike = { get<T>(key: string): Promise<T | undefined>; set(key: string, value: T): Promise<unknown>; delete(key: string): Promise<unknown>; keys(): Promise<string[]> }` y `ReferenceStore = { list(): Promise<StoredReference[]>; put(ref: StoredReference): Promise<void>; remove(id: string): Promise<void>; clear(): Promise<void> }`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`loadSettings` con almacenamiento vacío devuelve `DEFAULT_SETTINGS`; con datos guardados los devuelve; con JSON corrupto devuelve los valores por defecto sin lanzar. `saveSettings` escribe la clave `proyectjudge.settings`. El almacén de referencias lista, guarda, borra y vacía, ignorando claves ajenas al prefijo `proyectjudge.ref.`.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/storage` → FAIL.

- [ ] **Paso 3: Implementar** con inyección de dependencias; el envoltorio real usa `localStorage` e `idb-keyval`.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: persistencia de ajustes e informes de referencia"`.

---

## Tarea 16: Generación del informe (bloques y Word)

**Files:**
- Create: `src/lib/report/buildReport.ts`, `src/lib/report/buildReport.test.ts`, `src/lib/report/toDocx.ts`, `src/lib/report/toDocx.test.ts`

**Interfaces:**
- Consumes: `ReportView`.
- Produces: `buildReportBlocks(view: ReportView): ReportBlock[]` con `ReportBlock = { heading: string; paragraphs: string[] }`; `toDocx(view: ReportView): Promise<Blob>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`buildReportBlocks` sobre un `ReportView` de ejemplo: el primer bloque es la cabecera con el nombre del archivo y la valoración cualitativa; hay un bloque por sección evaluada con su título; **ninguna cadena contiene una nota global**; las secciones no evaluadas aparecen marcadas. `toDocx`: leer el blob generado con `jszip` y comprobar que `word/document.xml` contiene el título del informe y los nombres de los criterios.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/lib/report` → FAIL.

- [ ] **Paso 3: Implementar** los bloques con la librería `docx` (títulos, párrafos y listas) y la función pura de bloques que alimenta tanto la impresión como el Word.

- [ ] **Paso 4: Verificar** — PASS.

- [ ] **Paso 5: Commit** — `git commit -m "feat: generacion del informe en Word y bloques imprimibles"`.

---

## Tarea 17: Máquina de estados de la UI, armazón y barra lateral

**Files:**
- Create: `src/state/appMachine.ts`, `src/state/appMachine.test.ts`, `src/hooks/useSettings.ts`, `src/components/Sidebar.tsx`, `src/components/ErrorNotice.tsx`, `src/components/Sidebar.test.tsx`, `src/App.tsx` (modify)

**Interfaces:**
- Consumes: `Settings`, `loadSettings`, `saveSettings`, `RubricModel`, `ExtractedDocument`, `ReportView`, `ReferenceDocument`.
- Produces: `AppState`, `AppAction`, `initialState(settings?: Settings): AppState`, `appReducer(state: AppState, action: AppAction): AppState`, y el hook `useSettings()` que expone `{ settings, setSettings }`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`appMachine.test.ts`: `rubric/parsed` fija la rúbrica y avanza a `documents`; `documents/extracted` guarda el documento y pasa a `mapping`; `evaluation/progress` actualiza el progreso; `evaluation/done` fija el informe y pasa a `results`; `evaluation/failed` fija el error y vuelve a `documents`; `evaluation/reset` limpia documento e informe; sin API key, la acción `documents/submitted` produce el error «Introduce tu API key de Gemini». `Sidebar.test.tsx`: muestra «Configurada» cuando hay clave y el nombre de la rúbrica activa.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/state src/components/Sidebar.test.tsx` → FAIL.

- [ ] **Paso 3: Implementar** el reductor puro, el hook de ajustes sobre `localStorage`, la barra lateral (clave, modelo, rúbrica activa, referencias, tema claro/oscuro) y el armazón de `App.tsx` que despacha según el paso.

- [ ] **Paso 4: Verificar** — PASS y `npm run typecheck` sin errores.

- [ ] **Paso 5: Commit** — `git commit -m "feat: maquina de estados de la UI y barra lateral"`.

---

## Tarea 18: Pasos 1 y 2 (rúbrica y documentos) con el hook de evaluación

**Files:**
- Create: `src/components/RubricPanel.tsx`, `src/components/DocumentsPanel.tsx`, `src/components/ProgressPanel.tsx`, `src/hooks/useEvaluation.ts`, `src/components/RubricPanel.test.tsx`, `src/components/DocumentsPanel.test.tsx`

**Interfaces:**
- Consumes: `appReducer`, `extractDocument`, `parseRubric`, `orchestrate`, `estimateEvaluation`, `createGeminiClientFromKey`, `createReferenceStore`.
- Produces: `useEvaluation()` que expone `{ parseRubricText, submitDocuments, cancel, retrySynthesis }` y usa `onProgress` para alimentar el reductor.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`RubricPanel`: al pegar texto y pulsar «Interpretar rúbrica» se muestran los criterios devueltos por el doble; el botón «Confirmar rúbrica» queda deshabilitado hasta que haya criterios. `DocumentsPanel`: con un archivo doble muestra el resumen de extracción (secciones, figuras, palabras) y la estimación de llamadas y tokens; sin referencias el aviso indica que se evaluará solo con la rúbrica.

- [ ] **Paso 2: Ejecutar y comprobar que fallan** — Run: `npm test src/components` → FAIL.

- [ ] **Paso 3: Implementar** los dos pasos, el panel de progreso con el botón de cancelar y el hook que encadena extracción → mapa → secciones → síntesis propagando el progreso.

- [ ] **Paso 4: Verificar** — PASS y `npm run typecheck`.

- [ ] **Paso 5: Commit** — `git commit -m "feat: pasos de rubrica y documentos con evaluacion en curso"`.

---

## Tarea 19: Paso 3 (resultados) y exportación

**Files:**
- Create: `src/components/ResultsPanel.tsx`, `src/components/ResultsPanel.test.tsx`
- Modify: `src/index.css` (reglas `@media print`)

**Interfaces:**
- Consumes: `ReportView`, `buildReportBlocks`, `toDocx`.
- Produces: `ResultsPanel({ view, onReset, onDownloadWord })` con bloques de criterios, apartados (con miniaturas de figuras y sus notas), coherencia y apartados ausentes; PDF vía `window.print()` con CSS de impresión en `src/index.css`.

- [ ] **Paso 1: Escribir la prueba que falla**

Renderizar con un `ReportView` de ejemplo: aparece la valoración cualitativa, cada criterio con su puntuación y su evidencia, cada apartado con fortalezas y mejoras, el aviso de apartados ausentes y los botones de descarga. **No aparece ninguna nota global.**

- [ ] **Paso 2: Ejecutar y comprobar que falla** — Run: `npm test src/components/ResultsPanel.test.tsx` → FAIL.

- [ ] **Paso 3: Implementar** el panel y el CSS de impresión (los botones se ocultan con `print:hidden`).

- [ ] **Paso 4: Verificar** — PASS y `npm run typecheck`.

- [ ] **Paso 5: Commit** — `git commit -m "feat: panel de resultados y exportacion"`.

---

## Tarea 20: Documentación, despliegue y verificación final

**Files:**
- Create: `README.md`, `.env.example`
- Modify: `src/App.tsx` (mensajes finales y aviso de privacidad)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: proyecto desplegable en Cloudflare Pages (`npm run build` → `dist`).

- [ ] **Paso 1: Escribir el README**

Objetivo, captura del flujo en tres pasos, requisitos (Node ≥ 20), ejecución local (`npm install`, `npm run dev`), pruebas (`npm test`), construcción (`npm run build`), despliegue en Cloudflare Pages (`npx wrangler pages deploy dist` o conexión del repositorio), aviso de privacidad sobre Google AI Studio y nota de que la herramienta no sustituye el criterio del profesor.

- [ ] **Paso 2: Crear `.env.example`**

Documentando que no se usa ninguna variable en producción: la clave la introduce el profesor en la interfaz y se guarda solo en su navegador.

- [ ] **Paso 3: Verificación completa**

Run: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
Expected: las cuatro órdenes terminan sin errores.

- [ ] **Paso 4: Commit**

```bash
git add -A
git commit -m "docs: README, ejemplo de entorno y verificacion final"
```

---

## Notas de ejecución

- Cada tarea termina con su commit; no avanzar a la siguiente con pruebas en rojo.
- Las Tareas 4 y 6 definen modelos puros separados de sus envoltorios justamente para poder probarlos sin navegador; no merges la lógica de nuevo en el envoltorio.
- La Tarea 9 exporta `SECTION_KEYWORDS`, que la Tarea 5 consume: si se recorre el plan en orden, al llegar a la 5 el fichero ya existe.
- La estimación de coste (Tarea 14) debe mostrarse siempre antes de lanzar la evaluación: es la defensa del profesor contra el agotamiento de la cuota gratuita.
