# Brainstorming — ruta arquitectónica (seguimiento)

Proyecto: evaluador de informes/anteproyectos de ingeniería (nuevo, independiente).
Inspiración (solo lectura): https://github.com/cce087/evaluador-presentaciones-ia — **no se modifica**.

## Decisiones tomadas

| # | Decisión | Respuesta del usuario |
|---|---|---|
| 1 | Usuario objetivo | Profesor evaluando informes de alumnos |
| 2 | Origen de la rúbrica | La pega/sube el profesor cada vez (texto, PDF, Word, MD) |
| 3 | Nota global | No: cualitativa + puntuación por criterio |
| 4 | Extracción | Multimodal: texto + figuras |
| 5 | Estrategia de análisis | Jerárquico: mapa → secciones → síntesis |
| 6 | Proveedor de IA | Solo Gemini (capa gratuita, key del profesor) |
| 7 | Informes de referencia | Comparables completos, como SlideJudge |
| 8 | Salida | Pantalla + PDF + Word editable |
| 9 | Despliegue | Cloudflare Pages |
| 10 | Ritmo de trabajo | Un informe a la vez |
| 11 | Apartados | Detección de secciones + plantilla de apartados de ingeniería |
| 12 | Enfoque de construcción | Proyecto nuevo limpio (mismo stack, sin arrastrar código de PPTX) |

## Checklist de la ruta arquitectónica

- [x] 1. Explorar contexto del proyecto (repo de referencia leído en clon temporal de solo lectura)
- [x] 2. Compañero visual — no ha surgido ninguna pregunta genuinamente visual; se omite salvo que el usuario lo pida
- [x] 3. Preguntas aclaratorias (12 respuestas recogidas)
- [x] 4. Proponer enfoques (3 propuestos; elegido: proyecto nuevo limpio)
- [x] 5a. Diseño — sección 1: arquitectura y módulos — **aprobada**
- [x] 5b. Diseño — sección 2: flujo de datos y control de tokens — **aprobada**
- [x] 5c. Diseño — sección 3: interfaz, estados, errores y pruebas — **aprobada**
- [x] 6. Spec escrita en `docs/superpowers/specs/2026-10-11-proyectjudge-design.md` + commit
- [x] 7. Autorevisión de la spec (sin placeholders; presupuesto coherente entre §6 y §9; se resolvió
      la ambigüedad del origen del texto de la rúbrica en §8; ámbito acotado a un solo plan)
- [x] 8. Revisión de la spec por el usuario — **aprobada** (2026-10-11)
- [ ] 9. Pasar a `writing-plans` (plan de implementación)
