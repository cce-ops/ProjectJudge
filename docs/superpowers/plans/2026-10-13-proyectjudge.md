# Plan de Implementación: ProyectJudge

> **Para agentes:** REQUERIDO SUB-SKILL: usar `superpowers:executing-pllines` para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Implementar ProyectJudge, una aplicación web que evalúa informes de proyectos de ingeniería usando IA (Gemini), con análisis jerárquico (mapa → secciones → síntesis), y salida en pantalla, PDF y Word.

**Stack:** Vite 6 + React 19 + TypeScript + Tailwind CSS 4, `@google/genai`, `pdfjs-dist`, `jszip`, `marked`, `docx`, `idb-keyval`, Vitest + Testing Library.

**Especificación:** `docs/superpowers/specs/2026-10-11-proyectjudge-design.md`

## Restricciones globales (verbatim de la spec)

- Sin nota global: la UI y la síntesis nunca calculan ni muestran una nota numérica global.
- Solo Gemini como proveedor de IA; toda llamada pasa por `src/lib/ai/gemini.ts`.
- La API key vive solo en `localStorage` del profesor; nunca se sube a ningún sitio.
- Topes: 6.000 caracteres por sección, 60.000 por informe, 10.000 por referencia, 3 figuras por sección, 2 referencias, 20 secciones, concurrencia 2, 4 reintentos con espera 2 s duplicada.
- Filtros de figuras: área < 20.000 px, lado < 100 px, peso < 30 KB, duplicados por hash SHA-1; redimensionar a 1024 px lado mayor, JPEG 0,8.
- Sin servidor ni base de datos; los archivos de referencia se guardan en IndexedDB.
- Todos los módulos puros se prueban con Vitest; las pruebas de UI usan Testing Library.

---

## Fase 1 — Fundamentos

### Tarea 1: Andamiaje del proyecto

**Files:**
- Create/Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `src/vite-env.d.ts`, `eslint.config.js`, `src/test/setup.ts`

**Interfaces:**
- Consume: nada.
- Produce: scripts `dev`, `build`, `preview`, `lint`, `test`, `typecheck`; plugins `react()` y `tailwindcss()`; configuración de test con `environment: 'jsdom'` y `setupFiles: ['./src/test/setup.ts']`.

- [ ] **Paso 1: Crear `package.json` con todas las dependencias**
  - Dependencias: `react`, `react-dom`, `@google/genai`, `pdfjs-dist`, `jszip`, `marked`, `docx`, `idb-keyval`, `lucide-react`.
  - DevDependencies: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `@types/react`, `@types/react-dom`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.
  - Scripts: `dev`, `build`, `preview`, `lint`, `test`, `typecheck`.

- [ ] **Paso 2: Crear `vite.config.ts`**
  - Plugin `react()`, plugin `tailwindcss()`, configuración de test con `environment: 'jsdom'` y `setupFiles: ['./src/test/setup.ts']`.

- [ ] **Paso 3: Crear `tsconfig.json` y `tsconfig.node.json`**
  - Target ESNext, lib DOM + DOM.Iterable, module ESNext, moduleResolution Bundler, strict, jsx react-jsx.

- [ ] **Paso 4: Crear `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `src/vite-env.d.ts`**
  - `index.html` con `<div id="root"></div>` y `<script type="module" src="/src/main.tsx">`.
  - `src/index.css` con `@import "tailwindcss";`.
  - `src/App.tsx` con un componente mínimo que muestre "ProyectJudge".

- [ ] **Paso 5: Crear `eslint.config.js` y `src/test/setup.ts`**
  - `src/test/setup.ts` importa `@testing-library/jest-dom/vitest`.

- [ ] **Paso 6: Ejecutar `npm install` y verificar que la app arranca**
  - Run: `npm run dev` → la página muestra "ProjectJudge".

- [ ] **Paso 7: Commit**
  ```bash
  git add -A && git commit -m "chore: andamiaje del proyecto"
  ```

---

### Tarea 2: Tipos compartidos

**Files:**
- Create: `src/types/extract.ts`, `src/types/rubric.ts`, `src/types/evaluation.ts`, `src/types/app.ts`

**Interfaces:**
- Consume: nada.
- Produce: `Figure`, `Section`, `ExtractedDocument`, `FigureCandidate`, `RubricModel`, `RubricCriterion`, `RubricLevel`, `TemplateSlot`, `DocumentMap`, `SectionCriterionResult`, `SectionEvaluation`, `Synthesis`, `ReportView`, `DocumentCheck`, `Settings`, `ReferenceSummary`, `StoredReference`.

- [ ] **Paso 1: Crear `src/types/extract.ts`**
  - `Figure { id, base64, mimeType, width, height, bytes }`
  - `Section { id, title, level, text, pageStart?, pageEnd?, figureIds }`
  - `ExtractedDocument { fileName, format: 'pdf'|'docx'|'md'|'txt', text, sections, figures, warnings, stats: { pages?, words, figuresUsed, figuresDiscarded } }`
  - `FigureCandidate { id, base64, mimeType, width, height, bytes, hash, sourcePage? }`

- [ ] **Paso 2: Crear `src/types/rubric.ts`**
  - `RubricLevel { label, descriptor, score }`
  - `RubricCriterion { id, name, description, levels: RubricLevel[], maxScore, group?, weight? }`
  - `RubricModel { criteria, scale: { min, max }, source, fingerprint, notes? }`

- [ ] **Paso 3: Crear `src/types/evaluation.ts`**
  - `TemplateSlot { id, label, description }`
  - `DocumentMap { slots: { slot, present, sectionId }[], summary, titles?: { sectionId, title }[] }`
  - `SectionCriterionResult { criterionId, score, maxScore, evidence, feedback, evaluable, motivo? }`
  - `SectionEvaluation { sectionId, title, slotId, criteria, strengths, improvements, figureNotes, evaluated, error? }`
  - `Synthesis { overallAssessment: 'Correcto'|'Mejorable'|'Insuficiente', summary, strengths, improvements, coherenceNotes, referenceComparison }`
  - `ReportView { reportId, createdAt, model, rubric, document: { fileName, format, stats }, map, sections, synthesis, checks }`

- [ ] **Paso 4: Crear `src/types/app.ts`**
  - `Settings { apiKey, model, theme }`
  - `ReferenceSummary { fileName, format, text, stats }`
  - `StoredReference { id, label, fileName, savedAt, document: ExtractedDocument }`
  - `DocumentCheck { id, passed, message }`

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: contratos de tipos compartidos"
  ```

---

### Tarea 3: Utilidades de texto y figuras

**Files:**
- Create: `src/lib/text.ts`, `src/lib/extract/figures.ts`, `src/lib/text.test.ts`, `src/lib/extract/figures.test.ts`

**Interfaces:**
- Consume: `Figure`, `FigureCandidate` de `src/types/extract.ts`.
- Produce: `truncateText(text, maxChars)`, `findFigureCitations(text)`, `selectFigures(candidates, options?)`, `reencodeFigure(candidate, maxEdge, factory?)`.

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - `truncateText('abcdef', 3)` → `{ text: 'abc[…]', truncated: true }`
  - `findFigureCitations('Ver Figura 2 y Tabla 1')` → `[2, 1]`
  - `selectFigures` filtra por área < 20000 px, lado < 100 px, bytes < 30*1024, duplicados por hash
  - `reencodeFigure` con un mock de canvas devuelve imagen con `mimeType: 'image/jpeg'`

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/text.test.ts src/lib/extract/figures.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - `truncateText`: corta y añade `[…]` si excede.
  - `findFigureCitations`: busca números tras "Figura", "Fig.", "Tabla", "Gráfico" y devuelve lista ordenada sin duplicados.
  - `selectFigures`: filtra por área, lado, bytes, deduplica por hash y conserva el orden.
  - `reencodeFigure`: calcula dimensiones manteniendo ratio, usa la fábrica inyectada para crear canvas y devuelve `base64` sin prefijo `data:`.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/text.test.ts src/lib/extract/figures.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: utilidades de texto y seleccion de figuras"
  ```

---

### Tarea 4: Extracción de Markdown

**Files:**
- Create: `src/lib/extract/markdown.ts`, `src/lib/extract/markdown.test.ts`

**Interfaces:**
- Consume: `markdownToModel` de `src/types/extract.ts`.
- Produce: `markdownToModel(markdown: string): { sections, figures, warnings }`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Markdown con `# Título` y `## Subtítulo`: dos secciones con nivel 1 y 2.
  - Markdown sin encabezados: una única sección con advertencia.
  - Markdown con `![imagen](url)`: aviso de imagen externa ignorada.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/extract/markdown.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - Usa `marked.lexer` para recorrer tokens.
  - Tokens `heading` abren sección con `level` y `title`.
  - Tokens `paragraph` se acumulan en la sección actual.
  - Si no hay encabezados, crea una sección por defecto.
  - Imágenes externas (`![...](url)`) generan un aviso y se ignoran.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/extract/markdown.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: extraccion de secciones desde Markdown"
  ```

---

### Tarea 5: Modelo de PDF (líneas visuales)

**Files:**
- Create: `src/lib/extract/pdfModel.ts`, `src/lib/extract/pdfModel.test.ts`

**Interfaces:**
- Consume: `Section`, `FigureCandidate` de `src/types/extract.ts`.
- Produce: `groupTextItemsIntoLines(items)`, `pdfPagesToModel(pages, keywords): { sections, figureCandidates, warnings }`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - `groupTextItemsIntoLines` agrupa fragmentos por coordenada Y (con tolerancia 2) y ordena por X.
  - `pdfPagesToModel` detecta encabezados numéricos ("1. Introducción") y en mayúsculas ("METODOLOGÍA").
  - Rechaza números de página sueltos como encabezados.
  - Genera `figureCandidates` con `sourcePage` para cada imagen.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/extract/pdfModel.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - `groupTextItemsIntoLines`: agrupa por Y con tolerancia, ordena por X, une con espacio.
  - `pdfPagesToModel`: itera páginas, agrupa líneas, detecta encabezados con `looksLikeHeading`.
  - `looksLikeHeading`: patrón numérico `^\d+(\.\d+)*[.)]?\s+\S` (excluye años seguidos de `[`), mayúsculas < 60 chars con al menos una letra, o coincidencia con palabras clave.
  - Imágenes se convierten en `FigureCandidate` con `sourcePage`.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/extract/pdfModel.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: modelo de extraccion de PDF"
  ```

---

### Tarea 6: Envoltorio PDF con pdfjs-dist

**Files:**
- Create: `src/lib/extract/pdf.ts`, `src/lib/extract/pdf.test.ts`

**Interfaces:**
- Consume: `pdfPagesToModel`, `groupTextItemsIntoLines`, `selectFigures`, `findFigureCitations`, `truncateText`.
- Produce: `extractPdf(file, deps?): Promise<ExtractedDocument>`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Con un `getDocument` mock que devuelve 2 páginas con texto e imágenes: se obtienen secciones y figuras.
  - Imágenes pequeñas (< 20x20 o < 30 KB) se descartan.
  - Texto total > 60.000 caracteres se recorta con advertencia.
  - Páginas sin texto generan aviso de PDF escaneado.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/extract/pdf.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - Lee el `ArrayBuffer`, obtiene el documento con `pdfjsLib.getDocument`.
  - Para cada página: `getTextContent()` para líneas, `getOperatorList()` para imágenes.
  - Usa `groupTextItemsIntoLines` y `pdfPagesToModel`.
  - Filtra figuras con `selectFigures`.
  - Recorta texto con `truncateText` y añade advertencia si se recorta.
  - Añade aviso de PDF escaneado si no hay texto.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/extract/pdf.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: envoltorio de extraccion de PDF con pdfjs"
  ```

---

### Tarea 7: Extracción de DOCX

**Files:**
- Create: `src/lib/extract/docx.ts`, `src/lib/extract/docx.test.ts`

**Interfaces:**
- Consume: `documentXmlToModel`, `selectFigures`.
- Produce: `extractDocx(file, deps?): Promise<ExtractedDocument>`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Con un ZIP mock que contiene `word/document.xml` con párrafos Heading1 y Heading2: se obtienen secciones.
  - Imágenes en `word/media/` se incluyen como figuras.
  - Párrafos sin estilo se acumulan en la sección abierta.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/extract/docx.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - Abre el ZIP con `JSZip.loadAsync`.
  - Lee `word/document.xml`, parsea con `DOMParser`.
  - Usa `documentXmlToModel` para secciones y candidatos.
  - Filtra figuras con `selectFigures`.
  - Lee imágenes de `word/media/` y las añade como figuras.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/extract/docx.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: extraccion de texto y figuras desde DOCX"
  ```

---

### Tarea 8: Fachada de extracción

**Files:**
- Create: `src/lib/extract/extractDocument.ts`, `src/lib/extract/extractDocument.test.ts`

**Interfaces:**
- Consume: `extractPdf`, `extractDocx`, `markdownToModel`.
- Produce: `extractDocument(file): Promise<ExtractedDocument>`, `isSupportedFile(file): boolean`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - `.pdf` → delega en `extractPdf`.
  - `.docx` → delega en `extractDocx`.
  - `.md` / `.txt` → lee texto y usa `markdownToModel`.
  - `.exe` → lanza error "Formato no compatible".

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/extract/extractDocument.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - Despacho por extensión.
  - Para `.md`/`.txt`: lee texto, llama `markdownToModel`.
  - Para `.pdf`/`.docx`: delega en el extractor correspondiente.
  - Lanza error para formatos no soportados.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/extract/extractDocument.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: fachada de extraccion de documentos"
  ```

---

## Fase 2 — Evaluación

### Tarea 9: Cliente de Gemini con reintentos

**Files:**
- Create: `src/lib/ai/gemini.ts`, `src/lib/ai/gemini.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `createGeminiClient(deps): JsonClient`, `createGeminiClientFromKey(apiKey, model): JsonClient`, `JsonClient`, `JsonRequest`.

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Reintento en 429: primera llamada lanza error 429, segunda devuelve `{ ok: true }`.
  - Reintento en 503: similar.
  - Reintento en JSON inválido: primera devuelve `"not json"`, segunda devuelve JSON válido.
  - Si todas las llamadas fallan, se lanza el último error.
  - `createGeminiClientFromKey` llama al SDK con el modelo correcto.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/ai/gemini.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - `createGeminiClient` acepta `generateContent` inyectado, `sleep`, `maxRetries`, `baseDelayMs`, `model`.
  - Reintentos con espera exponencial (2s, 4s, 8s, 16s).
  - `withTimeout` para abortar peticiones colgadas.
  - `createGeminiClientFromKey` instancia `GoogleGenAI` y delega.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/ai/gemini.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: cliente de Gemini con reintentos y timeout"
  ```

---

### Tarea 10: Limitador de concurrencia

**Files:**
- Create: `src/lib/ai/limiter.ts`, `src/lib/ai/limiter.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `createConcurrencyLimiter(max): ConcurrencyLimiter`, `ConcurrencyLimiter { run<T>(task: () => Promise<T>): Promise<T> }`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Con `max: 2` y 3 tareas simultáneas: el conteo máximo de tareas activas es 2.
  - Todas las tareas se completan correctamente.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/ai/limiter.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - Cola de tareas pendientes.
  - Cuando una tarea termina, se ejecuta la siguiente de la cola.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/ai/limiter.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: limitador de concurrencia"
  ```

---

### Tarea 11: Interpretación de la rúbrica

**Files:**
- Create: `src/lib/rubric/parseRubric.ts`, `src/lib/rubric/parseRubric.test.ts`

**Interfaces:**
- Consume: `JsonClient`, `RubricModel`.
- Produce: `parseRubric(rubricText, client, cache?): Promise<RubricModel>`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Con un cliente mock que devuelve criterios con niveles: el modelo tiene esos criterios.
  - Si falta `maxScore`, se aplica 10 por defecto.
  - Si faltan niveles, se crea un nivel "Aprobado".
  - El mismo texto con la misma caché provoca una sola llamada.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/rubric/parseRubric.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - Prompt de rol de profesor de Proyectos de Ingeniería.
  - Esquema JSON estricto con criterios, niveles, `maxScore`, `scale`, `source`.
  - Normalización post-parseo (default `maxScore`, niveles).
  - Caché por huella del texto.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/rubric/parseRubric.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: interpretacion de rubrica con cache"
  ```

---

### Tarea 12: Plantilla de apartados de ingeniería

**Files:**
- Create: `src/lib/templates/sections.ts`, `src/lib/templates/sections.test.ts`

**Interfaces:**
- Consume: `TemplateSlot`.
- Produce: `ENGINEERING_SECTIONS: TemplateSlot[]`, `SECTION_KEYWORDS: string[]`, `findSlotByKeywords(title): TemplateSlot | null`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Todos los `id` son únicos.
  - `findSlotByKeywords('3. Planificación temporal')` → slot "Planificación".
  - `findSlotByKeywords('Aleatorio')` → `null`.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/templates/sections.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - 13 slots: Antecedentes, Objetivos, Alcance, Metodología, Diseño, Planificación, Presupuesto, Impacto ambiental, Normativa, Riesgos, Conclusiones, Bibliografía, Anexos.
  - Palabras clave para matching.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/templates/sections.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: plantilla de apartados de ingenieria"
  ```

---

### Tarea 13: Mapa estructural del documento

**Files:**
- Create: `src/lib/evaluation/buildDocumentMap.ts`, `src/lib/evaluation/buildDocumentMap.test.ts`

**Interfaces:**
- Consume: `JsonClient`, `ExtractedDocument`, `ENGINEERING_SECTIONS`, `findSlotByKeywords`.
- Produce: `buildDocumentMap(document, client): Promise<DocumentMap>`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Con un cliente mock que asigna secciones a slots: el mapa tiene esos slots como `present: true`.
  - Secciones sin slot conocido → `present: false`.
  - Títulos propuestos por la IA se usan en `titles`.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/evaluation/buildDocumentMap.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - Prompt con IDs de slots y títulos de secciones.
  - Esquema JSON con `slots`, `summary`, `titles`.
  - Mapeo de respuesta a `DocumentMap`.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/evaluation/buildDocumentMap.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: mapa estructural del informe"
  ```

---

### Tarea 14: Evaluación por secciones

**Files:**
- Create: `src/lib/evaluation/evaluateSections.ts`, `src/lib/evaluation/evaluateSections.test.ts`

**Interfaces:**
- Consume: `JsonClient`, `ConcurrencyLimiter`, `ExtractedDocument`, `RubricModel`, `DocumentMap`.
- Produce: `evaluateSections(input, client, limiter?): Promise<SectionEvaluation[]>`

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - Evalúa cada sección con texto recortado a 6.000 caracteres.
  - Figuras por sección limitadas a 3.
  - Si una sección falla, las demás se conservan.
  - Más de 20 secciones → las primeras 20 se evalúan, el resto `evaluated: false`.
  - `criterionId` del cliente se normaliza al id canónico de la rúbrica.

- [ ] **Paso 2: Ejecutar y comprobar que fallan**
  - Run: `npm test src/lib/evaluation/evaluateSections.test.ts` → FAIL

- [ ] **Paso 3: Implementar**
  - Porción: texto truncado, figuras (máx 3), criterios, contexto de referencias.
  - Concurrencia mediante `limiter.run`.
  - Normalización de `criterionId` por id o nombre.
  - Captura de errores por sección.

- [ ] **Paso 4: Verificar**
  - Run: `npm test src/lib/evaluation/evaluateSections.test.ts` → PASS

- [ ] **Paso 5: Commit**
  ```bash
  git add -A && git commit -m "feat: evaluacion por secciones"
  ```

---

### Tarea 15: Síntesis cualitativa

**Files:**
- Create: `src/lib/evaluation/synthesize.ts`, `src/lib/evaluation/synthesize.test.ts`

- **Paso 1: Pruebas que fallan**
  - Devuelve `overallAssessment` válido, `summary`, `strengths`, `improvements`, `coherenceNotes`, `referenceComparison`, `about`.
  - Rechaza `overallAssessment` inválido.
  - Lanza error si no hay secciones evaluadas.
- [ ] **Paso 2: Ejecutar y comprobar que fallan** → FAIL
- [ ] **Paso 3: Implementar** prompt con esquema JSON estricto, validación del enumerado.
- [ ] **Paso 4: Verificar** → PASS
- [ ] **Paso 5: Commit** → `feat: sintesis cualitativa`

---

### Tarea 16: Orquestador de la evaluación

**Files:**
- Create: `src/lib/evaluation/orchestrate.ts`, `src/lib/evaluation/orchestrate.test.ts`
- **Paso 1: Pruebas que fallan**
  - Orden de fases: mapa → secciones → síntesis.
  - `onProgress` recibe progreso por sección.
  - `ReportView` con `reportId`, `createdAt`, `model`, `rubric`, `document`, `map`, `sections`, `synthesis`.
  - Estimación de `calls` y `tokens` correcta.
- [ ] **Paso 2: Ejecutar y comprobar que fallan** → FAIL
- [ ] **Paso 3: Implementar** encadenado de fases, progreso, armado de `ReportView`.
- [ ] **Paso 4: Verificar** → PASS
- [ ] **Paso 5: Commit** → `feat: orquestador de la evaluacion y estimacion de coste`

---

### Tarea 17: Exportación a Word

**Files:**
- Create `src/lib/report/toDocx.ts`, `src/lib/report/toDocx.test.ts` (con `@vitest/environment node`)
- **Paso 1: Pruebas que fallan** - genera `.docx` con título y secciones.
- **Paso 2: Ejecutar y comprobar que fallan** → FAIL
- **Paso 3: Implementar** con librería `docx`.
- **Paso 4: Verificar** → PASS
- **Paso 5: Commit** → `feat: exportacion del informe a Word`

---

### Tarea 18: Persistencia (localStorage + IndexedDB)

**Files:** `src/lib/storage/settings.ts`, `src/lib/storage/references.ts`, tests.
- **Paso 1-5** como patrón anterior.

---

### Tarea 19: UI — máquina de estados y armazón

**Files:** `src/state/appMachine.ts`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/ErrorNotice.tsx`, tests.
- **Paso 1-5** como patrón anterior.

---

### Tarea 20: UI — pasos de rúbrica, documentos y resultados

**Files:** `src/components/RubricPanel.tsx`, `src/components/DocumentsPanel.tsx`, `src/components/ResultsPanel.tsx`, `src/hooks/useEvaluation.ts`, tests.
- **Paso 1-5** como patrón anterior.

---

## Registro de decisiones (Rulings)

(Se irán añadiendo durante la ejecución.)
