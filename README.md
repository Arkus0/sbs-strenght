# SBS Strength

PWA local-first para ejecutar el programa **SBS Strength Program Reps To Failure**.

## Comandos

```bash
npm install
npm run generate:sbs
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

En Android o iOS, abre la URL de Vercel en el navegador y usa "Anadir a pantalla
de inicio". Para una APK nativa habria que anadir Capacitor/Android en otro
corte; no es necesario para probarla manana.

## Datos del programa

`src/data/sbsRtfTemplate.json` se genera desde:

```text
C:\Users\Usuario\Downloads\SBS Strength Program reps to failure.xlsx
```

No se copia el Excel al repositorio. Si cambias la hoja fuente, vuelve a ejecutar:

```bash
npm run generate:sbs
```
