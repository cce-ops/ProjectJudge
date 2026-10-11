# ProyectJudge — Diseño técnico

**Fecha:** 2026-10-11
**Estado:** borrador para revisión
**Proyecto nuevo e independiente.** Inspiración (solo lectura, no se modifica):
[SlideJudge / evaluador-presentaciones-ia](https://github.com/cce087/evaluador-presentaciones-ia).

---

## 1. Objetivo

Herramienta web que ayuda a un **profesor** a evaluar informes, proyectos y anteproyectos de
ingeniería. El profesor aporta una **rúbrica** (pegándola o subiéndola) y uno o varios **informes**;
la aplicación extrae el contenido (texto y figuras), lo analiza contra la rúbrica y contra
informes de referencia, y devuelve una valoración estructurada por criterios y por apartados, con
fortalezas, mejoras y evidencias.

La herramienta es de **apoyo**: no emite nota global, para no suplantar el criterio del profesor.

## 2. Decisiones de diseño

| # | Decisión | Resolución |
|---|---|---|
| 1 | Usuario | Profesor evaluando informes de alumnos |
| 2 | Rúbrica | La aporta el profesor en cada evaluación (texto pegado, PDF, Word o Markdown); la app la interpreta y el profesor puede corregirla |
| 3 | Nota global | No. Valoración cualitativa + puntuación por criterio |
| 4 | Extracción | Multimodal: texto y figuras |
| 5 | Análisis | Jerárquico: mapa estructural → evaluación por secciones → síntesis |
| 6 | Proveedor de IA | Solo Gemini (capa gratuita de Google AI Studio, clave del profesor) |
| 7 | Informes de referencia | Hasta 2, comparables completos, con etiqueta de nivel |
| 8 | Salida | Pantalla + PDF (impresión) + Word editable |
| 9 | Despliegue | Cloudflare Pages (build estático) |
| 10 | Ritmo | Un informe a la vez |
| 11 | Apartados | Detección de secciones del documento + plantilla de apartados de ingeniería |
| 12 | Construcción | Proyecto nuevo limpio, mismo stack que la inspiración, sin arrastrar código de presentaciones |

## 3. Fuera de alcance (para esta versión)

- Nota numérica global ni ponderaciones automáticas.
- Comparación entre varios informes evaluados, ni historial persistente de evaluaciones.
- Cuentas de usuario, base de datos, servidor propio o subida de archivos a ningún sitio.
- OCR de PDF escaneados (se detecta el caso y se avisa; no se resuelve aquí).
- Otros proveedores de IA (Groq, OpenRouter, Ollama): la arquitectura los permite, no se implementan.
- Corrección automática de redacción/ortografía, detección de plagio.

## 4. Stack

Vite + React 19 + TypeScript + Tailwind CSS 4, todo en el navegador (sin backend).

| Necesidad | Librería | Motivo |
|---|---|---|
| UI | react, react-dom, lucide-react | Igual que el proyecto original; sin dependencias extra |
| Estilos | tailwindcss 4 vía `@tailwindcss/vite` | Integración nativa con Vite, sin PostCSS |
| PDF | pdfjs-dist | Texto por página e imágenes embebidas en cliente |
| DOCX | jszip + DOMParser | Desempaqueta el `.zip` y lee `word/document.xml` conservando encabezados |
| Markdown | marked | Tokenizado para detectar encabezados |
| IA | @google/genai | Cliente oficial de Gemini |
| Word de salida | docx | Genera `.docx` real en el navegador |
| Persistencia ligera | localStorage (clave, rúbrica, ajustes) + idb-keyval (informes de referencia) | `localStorage` no da para archivos grandes |
| Pruebas | vitest | Rápido, sin configuración pesada |

## 5. Estructura del proyecto

```
src/
├── main.tsx, App.tsx, index.css
├── types/                     # contratos de datos compartidos
│   ├── extract.ts             # Figure, Section, ExtractedDocument
│   ├── rubric.ts              # RubricModel
│   ├── evaluation.ts          # DocumentMap, SectionEvaluation, Synthesis, ReportView
│   └── app.ts                 # Settings, estados de la aplicación
├── lib/
│   ├── extract/
│   │   ├── extractDocument.ts # fachada: elige formato por extensión/MIME
│   │   ├── pdf.ts             # texto por página + imágenes embebidas
│   │   ├── docx.ts            # document.xml → secciones (pStyle Heading) + media
│   │   ├── markdown.ts        # encabezados → secciones
│   │   └── figures.ts         # filtros y redimensionado (común a formatos)
│   ├── rubric/parseRubric.ts  # texto libre → RubricModel (con caché por huella)
│   ├── evaluation/
│   │   ├── buildDocumentMap.ts
│   │   ├── evaluateSections.ts
│   │   ├── synthesize.ts
│   │   └── orchestrate.ts     # encadena las tres fases y devuelve ReportView
│   ├── ai/gemini.ts           # único cliente de IA: schemas, reintentos, concurrencia
│   ├── report/                # buildReport, toPdf (CSS impresión), toDocx
│   ├── storage/               # settings.ts (localStorage), references.ts (IndexedDB)
│   └── templates/sections.ts  # plantilla de apartados de ingeniería
├── hooks/                     # useSettings, useDocument, useEvaluation
└── components/                # pasos 1-3 y piezas de resultado
```

## 6. Contratos de datos

```ts
// extract
interface Figure { id: string; base64: string; mimeType: string; width: number; height: number; bytes: number }
interface Section { id: string; title: string; level: number; text: string; pageStart?: number; pageEnd?: number; figureIds: string[] }
interface ExtractedDocument {
  fileName: string; format: 'pdf' | 'docx' | 'md';
  text: string; sections: Section[]; figures: Figure[];
  warnings: string[];                 // p. ej. "PDF sin texto extraíble"
  stats: { pages?: number; words: number; figuresUsed: number; figuresDiscarded: number };
}

// rúbrica
interface RubricLevel { label: string; descriptor: string; score: number }
interface RubricCriterion { id: string; name: string; description: string; levels: RubricLevel[]; maxScore: number }
interface RubricModel {
  criteria: RubricCriterion[]; scale: { min: number; max: number };
  source: string; fingerprint: string; notes?: string;
}

// evaluación
interface TemplateSlot { id: string; label: string; description: string }   // plantilla fija
interface DocumentMap { slots: { slot: TemplateSlot; present: boolean; sectionId: string | null }[]; summary: string }
interface SectionEvaluation {
  sectionId: string; title: string; slotId: string | null;
  criteria: { criterionId: string; score: number; maxScore: number; evidence: string; feedback: string }[];
  strengths: string[]; improvements: string[]; figureNotes: { figureId: string; note: string }[];
  evaluated: boolean; error?: string;
}
interface Synthesis {
  overallAssessment: 'Correcto' | 'Mejorable' | 'Insuficiente';
  summary: string; strengths: string[]; improvements: string[];
  coherenceNotes: string[];                // objetivos vs. conclusiones, etc.
  referenceComparison: string;              // nivel respecto a los informes de referencia
}
interface ReportView {
  reportId: string; createdAt: string; model: string;
  rubric: RubricModel; document: { fileName: string; format: string; stats: ExtractedDocument['stats'] };
  map: DocumentMap; sections: SectionEvaluation[]; synthesis: Synthesis;
}
```

## 7. Extracción de documentos

`extractDocument(file)` elige el extractor por extensión y tipo MIME y devuelve siempre un
`ExtractedDocument`. Los tres extractores comparten `figures.ts`.

- **PDF** (`pdf.ts`): texto página a página con `getTextContent()`; imágenes de cada página
  recorriendo la operator list (`OPS.paintImageXObject` → `page.objs`). Como el texto se extrae por
  página, cada sección sabe su rango de páginas y hereda las imágenes de esas páginas. No hace falta
  calcular cajas de recorte.
- **DOCX** (`docx.ts`): `jszip` abre el `.zip`; `DOMParser` lee `word/document.xml`; los párrafos con
  `w:pStyle` `Heading1..3` abren sección; los `w:drawing`/`a:blip` con `r:embed` aportan la imagen de
  `word/media/` en el punto del documento en que aparecen. Los párrafos sin estilo de encabezado se
  acumulan en la sección abierta.
- **Markdown** (`markdown.ts`): `marked.lexer` da los tokens `heading` (nivel por `#`) y los párrafos.
  Las imágenes Markdown son enlaces externos: se ignoran con un aviso.
- **Filtros de figuras** (`figures.ts`), comunes a los tres: se descartan imágenes con área
  < 20.000 px, cualquier lado < 100 px, peso < 30 KB y duplicados por hash SHA-1 de los bytes
  (evita logos e iconos repetidos). Las supervivientes se redimensionan a 1024 px de lado mayor y se
  recodifican en JPEG calidad 0,8.
- Si no se detecta ningún encabezado, el documento se trata como **una única sección** y se avisa.

## 8. Interpretación de la rúbrica

La rúbrica se lee con el mismo extractor de documentos (`extractDocument`), usando únicamente la
parte de texto: así da igual si el profesor la pega, la sube como PDF, Word o Markdown.
`parseRubric(input)` llama a Gemini con esquema JSON estricto y devuelve un `RubricModel`
normalizado: criterios con identificador, descripción, niveles (con descriptor y puntuación) y
puntuación máxima, más la escala global. Si la rúbrica no trae niveles explícitos, la IA los
propone. El resultado se **cachea por huella** del texto de origen (misma rúbrica → misma
interpretación) y se muestra al profesor en tarjetas editables antes de evaluar; si lo corrige, se
guarda la corrección y se usa esa versión.

## 9. Orquestación de la evaluación

`orchestrate(settings, document, references, rubric)` ejecuta tres fases y devuelve un `ReportView`:

1. **Mapa** (`buildDocumentMap`, 1 llamada): secciones reales del documento + resumen de una línea
   por sección + mapeo a la plantilla de apartados de `templates/sections.ts` (Antecedentes y estado
   del arte, Objetivos, Alcance, Metodología, Diseño y desarrollo, Planificación, Presupuesto,
   Impacto ambiental, Normativa, Riesgos, Conclusiones y líneas futuras, Bibliografía, Anexos),
   marcando los apartados ausentes.
2. **Secciones** (`evaluateSections`, 1 llamada por sección, máximo 2 en paralelo): entrada =
   texto recortado de la sección + sus figuras (máx. 3) + criterios de la rúbrica + contexto de los
   informes de referencia (texto recortado y hasta 2 figuras cada uno, con su etiqueta de nivel).
   Salida = puntuación y evidencia por criterio, fortalezas, mejoras y comentario por figura.
3. **Síntesis** (`synthesize`, 1 llamada): valoración global cualitativa, coherencia entre
   apartados, fortalezas y mejoras priorizadas y comparación de nivel con las referencias.

**Presupuesto anti-desbordes**

| Límite | Valor |
|---|---|
| Caracteres por sección | 6.000 (con marcador `[…]` si se recorta) |
| Caracteres por informe evaluado | 60.000 |
| Caracteres por informe de referencia | 10.000 |
| Figuras por sección | 3 |
| Informes de referencia | 2 |
| Secciones evaluadas | 20 (las restantes se listan como no evaluadas) |
| Concurrencia de llamadas | 2 |
| Reintentos | 4, con espera 2 s duplicada (429/503) |

Antes de lanzar, la app estima llamadas y tokens (≈ 1 token por 4 caracteres de texto, ≈ 1.000
tokens por figura) y avisa si el informe se recortará. Si una sección falla, el resto de la
evaluación se conserva y esa sección se marca `evaluated: false` con su error.

## 10. Interfaz, estados y errores

**Tres pasos** con barra lateral de estado (API key, modelo, rúbrica activa, referencias, tema
claro/oscuro):

1. **Rúbrica** — pegar o subir; «Interpretar rúbrica»; criterios extraídos en tarjetas editables;
   confirmar.
2. **Documentos** — informe a evaluar + hasta 2 referencias con etiqueta de nivel; resumen de
   extracción (secciones, figuras aceptadas/descartadas, palabras, avisos) y estimación de coste.
3. **Resultados** — valoración cualitativa + resumen; criterios con puntuación y evidencia;
   apartados con fortalezas, mejoras y miniaturas de figuras comentadas; coherencia y apartados
   ausentes; descargar PDF / Word / evaluar otro.

**Estados**: `idle → rubric → documents → mapping → sections (n/total) → synthesizing → results | error`,
con progreso concreto («Evaluando sección 5 de 12: Planificación») y botón de cancelar.

**Errores** con mensaje accionable: clave ausente o inválida; formato no admitido; PDF escaneado sin
texto; 429/503 de Gemini; respuesta de IA que no cumple el esquema (un reintento y después error con
el fragmento); fallo de una sección (resultado parcial); aviso al cerrar la pestaña con evaluación en
curso.

## 11. Privacidad y seguridad

- La API key vive solo en el navegador del profesor (`localStorage`) y nunca en el repositorio.
- Aviso visible de que el contenido de los informes se envía a Google AI Studio y de que en la capa
  gratuita hay revisión humana de prompts y respuestas.
- Nada se almacena en servidores propios; los archivos de referencia se guardan en IndexedDB del
  equipo.

## 12. Pruebas

Vitest, sobre módulos puros con dobles de prueba (sin llamadas reales a Gemini):

- **Extractores** con archivos de ejemplo (PDF con texto e imágenes, DOCX con encabezados e
  imágenes, MD): texto, secciones, figuras y descartes de logos.
- **parseRubric** con un cliente de IA falso: normalización de criterios y niveles.
- **Orquestador**: orden mapa→secciones→síntesis, concurrencia máxima, recortes de presupuesto,
  resultado parcial cuando falla una sección.
- **Report**: DOCX y contenido del informe a partir de un `ReportView` de ejemplo.
- **UI**: render del flujo completo con datos falsos.

## 13. Despliegue

Build estático de Vite en Cloudflare Pages (gratis), igual que el proyecto original. `README.md` con
instrucciones de ejecución local y despliegue, y `.env.example` documentando que la clave la
introduce el profesor en la interfaz (no se usa variable de entorno en producción).

## 14. Criterios de aceptación

1. El profesor pega o sube una rúbrica y ve los criterios interpretados, editable, antes de evaluar.
2. Extrae texto y figuras de PDF, DOCX y MD; avisa cuando un formato no tiene texto o no tiene
   encabezados; descarta logos e imágenes repetidas.
3. Detecta secciones y las mapea a la plantilla de apartados, indicando los ausentes.
4. Evalúa cada sección contra los criterios con puntuación, evidencia, fortalezas y mejoras, usando
   los informes de referencia como nivel de comparación.
5. Devuelve una síntesis cualitativa global **sin nota numérica global**.
6. Controla la cuota: concurrencia limitada, reintentos con espera creciente, recortes anunciados y
   resultado parcial si falla una sección.
7. Exporta el resultado a PDF (impresión) y a Word editable.
8. Todo funciona sin servidor; clave y referencias persisten en el navegador.
9. Las pruebas de los módulos puros pasan y la app arranca en local con `npm run dev`.
