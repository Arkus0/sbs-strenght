# SBS Strength

PWA local-first para planificar, ejecutar y analizar **SBS Strength Program Reps To Failure**.

El motor generado desde el Excel SBS es la fuente normativa. Calendario, analíticas,
accesorios y sincronización se construyen alrededor de él sin modificar su progresión.

## Producto

- Runner móvil offline con autoguardado, timers y tiempo activo fiable.
- Calendario por fechas, agenda, vista mensual y roadmap de 21 semanas.
- Progresión explicable de accesorios y conditioning contextual.
- Analíticas de TM, e1RM estimado, volumen, consistencia y récords.
- IndexedDB v3 con migración automática desde `localStorage` v1/v2.
- Cuenta y sincronización Supabase opcionales mediante OTP.

## Comandos

```bash
npm install
npm run generate:sbs
npm run typecheck
npm run dev
npm run test:unit
npm run build
npm run test:e2e:list
npm run test:e2e
```

El desarrollo se sirve en `http://127.0.0.1:5173/`.

## Probar en movil

La via mas rapida es desplegar la app como PWA en Vercel. No necesita backend:
todo queda en `localStorage` del navegador, con export/import JSON para copia de
seguridad.

```bash
npm run build
npx vercel --prod
```

Configuracion esperada en Vercel:

```text
Framework: Vite
Build command: npm run build
Output directory: dist
```

En Android o iOS, abre la URL de Vercel en el navegador y usa "Añadir a pantalla
de inicio". Para una APK nativa habría que añadir Capacitor/Android en otro
corte; no es necesario para probarla.

## Sincronización opcional

Copia `.env.example` a `.env.local` y añade un proyecto Supabase dedicado:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Aplica la migración de `supabase/migrations` y configura la plantilla de email
para incluir `{{ .Token }}`. Sin estas variables la app permanece íntegramente
local y todas las funciones de entrenamiento siguen disponibles.

## Datos del programa

`src/data/sbsRtfTemplate.json` se genera desde:

```text
C:\Users\Usuario\Downloads\SBS Strength Program reps to failure.xlsx
```

No se copia el Excel al repositorio. Si cambias la hoja fuente, vuelve a ejecutar:

```bash
npm run generate:sbs
```

Los digests de `tests/sbsGolden.test.js` deben seguir pasando. No se aceptan
cambios en esos digests salvo modificación explícitamente aprobada del Excel.
