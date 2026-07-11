# SBS Strength — reglas de trabajo

## Invariante principal: el Excel es la especificación

- `SBS Strength Program reps to failure.xlsx` es la fuente normativa de toda prescripción y progresión SBS RTF.
- No reinterpretar, optimizar ni cambiar buckets, ajustes de TM, intensidades, targets, singles @8, AMRAP, deloads, redondeo u orden de aplicación.
- El motor congelado vive en `src/lib/sbsRtf.js`; la plantilla generada vive en `src/data/sbsRtfTemplate.json`.
- La plantilla sólo se regenera mediante `npm run generate:sbs`. No editar el JSON a mano.
- `tests/sbsGolden.test.js` caracteriza todas las frecuencias y 21 semanas. Un cambio de digest sólo es válido si el usuario ha aprobado expresamente un cambio del Excel fuente.
- Calendario, analíticas, accesorios, persistencia y sincronización deben envolver el motor; nunca duplicar sus fórmulas.

## Arquitectura v3

- React/Vite/PWA con TypeScript para la carcasa y el dominio nuevo.
- IndexedDB (`sbs-strength-v3`) es la fuente local canónica. El estado v2 de `localStorage` se conserva como backup y fuente de migración.
- Rutas principales: `/hoy`, `/calendario`, `/programa/:id`, `/analiticas`, `/ajustes`, `/sesion/:id`.
- Sólo hay un programa activo; los IDs de sesión son UUID y el código SBS visible (`W1D1`) permanece estable.
- La progresión de accesorios está aislada en `src/lib/accessoryProgression.ts` y nunca alimenta el TM SBS.
- Las analíticas son derivadas: e1RM Epley, tonelaje, récords y adherencia no modifican prescripciones.
- Supabase es opcional. La app debe abrir, entrenar y guardar sin red ni cuenta.

## Supabase y seguridad

- Usar únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en cliente; nunca una secret/service-role key.
- Toda tabla expuesta debe tener RLS, grants explícitos y políticas de propiedad por `auth.uid()`.
- Las migraciones se crean con `supabase migration new`; no inventar nombres de archivo.
- Verificar migraciones con pgTAP y advisors cuando haya Docker o un proyecto Supabase dedicado disponible. No aplicar el esquema a proyectos ajenos.

## Verificación obligatoria

```bash
npm run generate:sbs
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
npm audit
```

- Tras tocar varios componentes TSX, revisar estructura, hooks, dependencias, accesibilidad, claves estables y carga lazy.
- Validar móvil y escritorio en el navegador, sin errores de consola.
- No publicar si falla un digest SBS golden.
