# ProyectJudge — Evaluador de informes de ingeniería con IA

Herramienta web que ayuda a un **profesor** a evaluar informes, proyectos y anteproyectos de
ingeniería. El profesor aporta una **rúbrica** (pegándola o adjuntándola) y el **informe de un
alumno**; la aplicación extrae el contenido (texto y figuras), lo analiza contra la rúbrica y, si
los hay, contra informes de referencia, y devuelve una valoración estructurada por criterios y por
apartados, con fortalezas, mejoras y evidencias.

Es una herramienta de **apoyo**: no emite nota global, para no suplantar el criterio del profesor.

## Flujo en tres pasos

1. **Rúbrica** — Se pega el texto, o se adjunta un archivo (`.md`, `.txt`, `.docx`, `.pdf`,
   `.xlsx`, `.xls`, `.csv`). La IA la interpreta como criterios con niveles y puntuaciones.
2. **Documentos** — Se sube el informe a evaluar (`.pdf`, `.docx`, `.md`, `.txt`) y, opcionalmente,
   hasta 2 informes de referencia.
3. **Resultados** — Valoración global cualitativa, criterios con puntuación y evidencia, evaluación
   por apartados, criterios no evaluables, comprobaciones mecánicas, apartados ausentes, próximos
   pasos y coherencia. Se puede descargar en PDF (impresión) y en Word editable.

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

## Exportación a Markdown

Además de PDF y Word, el resultado se puede exportar como Markdown para pegar en el campus
virtual o en un repositorio.

## Despliegue (Cloudflare Pages, gratis)

1. `npm run build` (genera `dist/`).
2. Opción A: conecta el repositorio en el panel de Cloudflare Pages (comando de build
   `npm run build`, directorio `dist`).
3. Opción B: `npx vite preview --port 5173` y desplegar `dist/` estático.

## Limitaciones conocidas

- Los PDF escaneados (sin capa de texto) no tienen OCR: se avisa y no se evalúan.
- Las figuras de los PDF se envían a la IA (máx. 3 por apartado, en JPEG); las de los DOCX aún no
  se enlazan con sus apartados.
- La herramienta no calcula nota global por diseño.
