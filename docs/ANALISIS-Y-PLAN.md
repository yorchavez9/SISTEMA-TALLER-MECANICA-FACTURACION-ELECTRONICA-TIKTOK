# Sistema de Taller Mecánico con Facturación Electrónica SUNAT
## Análisis técnico y plan de implementación

> Fuente analizada: `3. API FACTURACION SUNAT PERU ✅✅✅✅✅.postman_collection.json` (Postman v2.1, 26 carpetas, ~390 requests).
> Fecha del análisis: 2026-11-18. Estado: **análisis previo, sin código**.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Análisis completo de la colección Postman](#2-análisis-completo-de-la-colección-postman)
3. [Inventario de endpoints](#3-inventario-de-endpoints)
4. [Mapeo API → taller mecánico](#4-mapeo-api--taller-mecánico)
5. [Arquitectura general](#5-arquitectura-general)
6. [Módulos funcionales](#6-módulos-funcionales)
7. [Flujo operativo completo](#7-flujo-operativo-completo)
8. [Arquitectura de integración SUNAT](#8-arquitectura-de-integración-sunat)
9. [Configuración fiscal multiempresa](#9-configuración-fiscal-multiempresa)
10. [Base de datos y relaciones](#10-base-de-datos-y-relaciones)
11. [Estructura de carpetas](#11-estructura-de-carpetas)
12. [Interfaz y componentes shadcn/ui](#12-interfaz-y-componentes-shadcnui)
13. [Tablas responsive](#13-tablas-responsive)
14. [Imágenes opcionales de productos](#14-imágenes-opcionales-de-productos)
15. [Autenticación, Setup Wizard y permisos](#15-autenticación-setup-wizard-y-permisos)
16. [Seguridad](#16-seguridad)
17. [Plan de implementación por fases](#17-plan-de-implementación-por-fases)
18. [Riesgos técnicos y recomendaciones](#18-riesgos-técnicos-y-recomendaciones)
19. [Checklist de validación](#19-checklist-de-validación)
20. [Recomendación final y orden de desarrollo](#20-recomendación-final-y-orden-de-desarrollo)

---

## 1. Resumen ejecutivo

Se construirá una aplicación **SaaS multiempresa** para talleres mecánicos (Laravel + Inertia + React + shadcn/ui + MySQL) que cubre el ciclo **cliente → vehículo → orden de trabajo → venta → comprobante electrónico**, consumiendo por HTTP la API propia "API SUNAT PRO".

Hallazgos de la colección que **condicionan el diseño** (detallados en §2):

| # | Hallazgo | Impacto en el diseño |
|---|----------|----------------------|
| H1 | La autenticación es **por empresa**: cada empresa (tenant) tiene su propio `X-Api-Key` + `X-Api-Secret`, que la API devuelve al hacer `POST /registro`. No existe en la colección una credencial maestra global documentada. | Laravel registra (aprovisiona) cada taller en la API y guarda sus credenciales **cifradas en el backend**. El taller nunca las ve. Así se cumple la regla "el cliente no ingresa API Key/Secret". |
| H2 | El registro exige `sol_user`, `sol_pass` (Clave SOL), certificado `.pfx` + contraseña, régimen, `entorno` (beta/producción) y `plan`. | El aprovisionamiento debe pedir **usuario y Clave SOL**, que no estaban en la lista original. Certificado, Clave SOL, plan y entorno los gestiona el **super admin** (ver §9). |
| H3 | La emisión es **asíncrona dentro de la API**: crear → `enviado` (la API encola su propio job) → `aceptado` / `rechazado`. Estados: `pendiente`, `enviado`, `aceptado`, `rechazado`. | Laravel **no** necesita colas: hace el POST, guarda el ID y consulta el estado con `GET /{tipo}/{id}` (botón manual + tarea programada de solo lectura). |
| H4 | La colección **no contiene ninguna respuesta de ejemplo guardada** (0 responses en los 390 requests). Solo se documenta el sobre genérico `{estado, mensaje, datos, meta, errores}`. | Los nombres de campos dentro de `datos` (ID, estado, código SUNAT, hash, totales) **deben verificarse** en una fase 0 antes de programar el cliente HTTP. |
| H5 | No hay cabecera de idempotencia documentada (la carpeta de alias menciona un "stack de idempotencia", sin decir cómo se usa). Sí se acepta `correlativo` explícito y se puede buscar por `serie` + `correlativo`. | La protección contra duplicados se basa en: bloqueo local de la venta, correlativo reservado localmente y **verificación por serie+correlativo antes de cualquier reintento**. |
| H6 | `precio_unitario` se envía **con IGV incluido** (ej.: 10 × 118 = 1 180 = 2 cuotas de 590). | Los precios de servicios y productos se almacenarán con IGV incluido, igual que la API. |
| H7 | Existe `webhook_url` en `PUT /empresa`, pero sin documentación del payload ni de la firma. | Se deja preparado para una fase posterior; el MVP usa consulta de estado. |
| H8 | La API trae mucho más de lo que necesita un taller (SIRE, guías, retenciones, percepciones, liquidaciones, suscripciones, emisión masiva). | Se usa solo un subconjunto (~30 endpoints). El resto queda fuera de alcance de forma explícita. |

**Alcance del MVP:** setup wizard, empresas/usuarios, configuración fiscal con aprovisionamiento en la API, clientes, vehículos, servicios, productos (con imagen opcional y stock básico), órdenes de trabajo, ventas, **factura y boleta electrónicas**, **detracción en facturas de servicios**, consulta de estado y descarga de PDF/XML/CDR, y **nota de crédito** para anular o corregir.

**Decisiones del propietario (2026-11-18):**
1. **Toda la configuración de la API se hace desde el sistema.** Nunca se usa Postman ni el panel de la API para operar un taller: registro, datos de empresa, régimen, certificado, logo, sucursales, series, plan/suscripción, entorno y credenciales tienen su pantalla (§9.5).
2. **El certificado digital lo sube y renueva el super admin** del sistema (con su contraseña y la Clave SOL). **Solo se sube:** Laravel lo reenvía a la API, que lo valida, cifra y custodia. El sistema no guarda el archivo, la contraseña ni la Clave SOL.
6. **Imágenes de productos en `storage` público** (disco `public`).
3. **El plan de la API se asigna por taller** (lo elige el super admin desde `GET /planes`).
4. **El super admin cambia cada taller entre beta y producción.**
5. **Se incluye la detracción** en facturas de servicios, con el bloque `detraccion` tal como aparece en la colección (§8.8).
**Después del MVP:** nota de débito, comunicación de baja, anulación de boletas por resumen diario, ventas a crédito con cuotas, webhook y reportes avanzados.

---

## 2. Análisis completo de la colección Postman

### 2.1 Datos generales

- **Nombre:** API FACTURACION SUNAT PERU ("API SUNAT PRO").
- **Base URL:** `{{base_url}}` = `https://sunat.kodevo.es/api/v1` (producción) o `http://api-pro.test/api/v1` (local).
- **Base sin versión:** `{{base_api}}` = `https://sunat.kodevo.es/api` (alias `/api/sunat`, `/api/health`, `/api/debug`, `/api/bridge`).
- **Documentación externa referenciada:** la colección cita `documentacion/README.md`, `01-Configuracion.md`, `04-Facturas.md`, `05-Boletas.md`, `06-Notas-credito.md`, `08-Resumen-diario.md`, `09-Anular.md`, `12-Envio-manual.md`, `13-Actualizar.md`, `14-Consultar-CPE.md`, etc. **Esos archivos no están en este proyecto** y conviene conseguirlos antes de la fase 6.

### 2.2 Autenticación y configuración

- La colección no define autenticación a nivel colección ni carpeta; cada request lleva estas cabeceras:
  ```
  Accept: application/json
  Content-Type: application/json        (en requests con body JSON)
  X-Api-Key: {{api_key}}                ("credencial pública de la empresa")
  X-Api-Secret: {{api_secret}}          ("credencial secreta de la empresa")
  ```
- **Públicos (sin credenciales):** `POST /registro`, `GET /planes`, `POST /credenciales/recuperar`, `POST /credenciales/recuperar/verificar` y `GET /api/health`.
- `POST /registro` devuelve `api_key` + `api_secret`. Según la colección, *"el secret NO se puede recuperar"*, aunque se puede regenerar o recuperar con un token enviado por correo.
- **Multiempresa en la API:** cada par de credenciales identifica una empresa. Los reportes indican: *"Multiempresa: solo trae los comprobantes de la empresa autenticada"*.

### 2.3 Formato de respuesta (único documentado)

```json
{
  "estado": "exito" | "error",
  "mensaje": "texto",
  "datos": { } | [ ],
  "meta": { },        // paginación (opcional)
  "errores": { }      // detalle de validación (solo en errores)
}
```

> ⚠️ **No hay ejemplos de respuesta en la colección.** Los campos concretos de `datos` (por ejemplo `id`, `sunat_status`, código y descripción de SUNAT, `hash`, totales o URLs) **no están documentados**. Los únicos nombres de campo de respuesta que la colección menciona explícitamente son `tax_regime` y `tasa_igv_vigente` (en `GET /empresa`) y, en `GET /sunat/estado`: `disponible`, `circuit` (`closed|open|half_open`), `fallas` y `entorno`. Los valores de estado `pendiente | enviado | aceptado | rechazado` aparecen como filtros (`sunat_status`, `estado_sunat`).

### 2.4 Emisión de facturas (tipo 01) — `POST /facturas`

**Campos de cabecera encontrados en los ejemplos:**

| Campo | Uso / valores observados |
|-------|--------------------------|
| `serie` | `F001` (obligatorio en todos los ejemplos) |
| `correlativo` | Opcional (aparece en "factura básica" y "masivo"; omitido en el resto, por lo que la API lo autoasigna) |
| `fecha_emision` | `YYYY-MM-DD` |
| `tipo_operacion` | `0101` venta interna, `0200` exportación, `0113` NRUS (automático) |
| `tipo_moneda` | `PEN`, `USD` |
| `forma_pago` | `Contado` / `Credito` |
| `fecha_vencimiento`, `cuotas[] {monto, fecha_pago}` | Venta a crédito (la suma de cuotas debe igualar el total) |
| `cliente {tipo_doc, num_doc, razon_social, direccion}` | Cat. 06: `0` otros, `1` DNI, `4` CE, `6` RUC, `7` pasaporte, `A` cédula diplomática |
| `items[]` | Ver abajo |
| `enviar_automatico` | `false` → queda en `pendiente` hasta llamar a `/enviar` |
| `tipo_documento` | `01` (opcional) |
| `detraccion {tipo_operacion, cod_bien, cod_medio_pago, cta_banco, porcentaje, monto}` | **Se usa** en facturas de servicios (§8.8) |
| `percepcion`, `anticipos`, `descuentos_globales`, `guias` | Casos especiales, fuera del alcance del taller |

**Campos de ítem:** `codigo`, `cod_producto_sunat` (cat. 25, p. ej. `78181500` = mantenimiento de vehículos), `descripcion`, `unidad` (`NIU` bienes, `ZZ` servicios, `KGM`…), `cantidad`, `precio_unitario` (con IGV), `tip_afe_igv` (`10` gravado, `20` exonerado, `30` inafecto, `13`/`32` gratuitos), `mto_valor_unitario`, `porcentaje_igv`, `descuentos`, `factor_icbper`, `porcentaje_isc` y `tip_sis_isc`.

**Ejemplo real de la colección (el más cercano a un taller):**
```json
POST {{base_url}}/facturas
{
  "serie": "F001",
  "fecha_emision": "2026-08-19",
  "tipo_operacion": "0101",
  "tipo_moneda": "PEN",
  "forma_pago": "Contado",
  "cliente": { "tipo_doc": "6", "num_doc": "20605145648",
               "razon_social": "TRANSPORTES SAN MARTIN S.A.C.",
               "direccion": "AV. INDUSTRIAL 456 - LIMA" },
  "items": [
    { "codigo": "SERV-001", "cod_producto_sunat": "78181500",
      "descripcion": "Mantenimiento preve", "unidad": "ZZ",
      "cantidad": 1, "precio_unitario": 354, "tip_afe_igv": "10" },
    { "codigo": "REP-045", "cod_producto_sunat": "43211508",
      "descripcion": "Scanner automotriz", "unidad": "NIU",
      "cantidad": 1, "precio_unitario": 118, "tip_afe_igv": "10" }
  ]
}
```
**Respuesta:** no documentada (solo el sobre de §2.3).

**Operaciones sobre una factura existente:**
- `GET /facturas/{id}`: detalle.
- `PUT /facturas/{id}`: corrige y **reenvía automáticamente**; admite PUT parcial (solo `cliente` o solo `items`) y solo funciona si el comprobante no está aceptado.
- `POST /facturas/{id}/enviar` (alias `/reenviar`): para estados `pendiente` o `rechazado`; la API "encola el job" y rechaza la llamada si el comprobante ya está aceptado. El alias `/reenviar` *"no duplica si ya fue aceptado"*.
- `GET /facturas/{id}/xml`: XML UBL 2.1 firmado.
- `GET /facturas/{id}/cdr`: CDR en ZIP.
- `GET /facturas/{id}/pdf?format=a4|a5|ticket-80|ticket-58`.
- `POST|GET /facturas/{id}/pagos` y `DELETE /facturas/{id}/pagos/{pagoId}`: pagos (`monto`, `fecha`, `metodo`, `referencia`, `observacion`).
- `GET /facturas?serie=&correlativo=&fecha_desde=&fecha_hasta=&sunat_status=&client_num_doc=&sucursal_id=&por_pagina=&con=items,payments`.
- `POST /facturas/masivo`: hasta 100 facturas (fuera de alcance).

> ⚠️ Inconsistencia: el PDF A4 de facturas usa `?formato=a4`; el resto usa `?format=...`. Hay que verificar cuál acepta la API (o si acepta ambos).

### 2.5 Emisión de boletas (tipo 03) — `POST /boletas`

- Misma estructura que la factura. `tipo_operacion` y `forma_pago` son opcionales en los ejemplos.
- **Consumidor final:** `tipo_doc: "0"`, `num_doc: "99999999"`, `razon_social: "CONSUMIDOR FINAL"`, solo para boletas **menores a S/ 700**.
- Dos modos de envío:
  - **Individual:** `enviar_automatico` (por defecto) o `POST /boletas/{id}/enviar`.
  - **Por resumen diario:** `solo_registro: true`. La boleta queda en `pendiente` y se envía con `POST /resumenes`.
- `DELETE /boletas/{id}`: solo si no fue aceptada.
- Mismos endpoints de XML, CDR, PDF, pagos, `PUT`, `enviar` y `reenviar` que las facturas.
- Régimen NRUS: solo boletas, `tipo_operacion 0113` automático e IGV 0.

### 2.6 Notas de crédito (07) y débito (08)

```json
POST {{base_url}}/notas-credito
{
  "serie": "FC01", "fecha_emision": "2026-04-17",
  "doc_afectado_tipo": "01", "doc_afectado_serie": "F001", "doc_afectado_correlativo": "622",
  "cod_motivo": "01", "des_motivo": "Anulación de la operación",
  "cliente": { "tipo_doc": "6", "num_doc": "20512345678", "razon_social": "EMPRESA DEMO SAC",
               "direccion": "Av. Los Olivos 123, Lima" },
  "items": [ { "descripcion": "Producto de prueba", "unidad": "NIU", "cantidad": 2,
               "precio_unitario": 100.00, "tip_afe_igv": "10" } ]
}
```
- **Motivos de NC (cat. 09):** 01 anulación, 02 anulación por error de RUC, 03 corrección de descripción, 04 descuento global, 05 descuento por ítem, 06 devolución total, 07 devolución parcial, 08 bonificación, 09 ajuste, 10 otros. Hay ejemplo de **NC sobre boleta**.
- **Motivos de ND (cat. 10):** 01 intereses por mora, 02 aumento de valor, 03 penalidades. Endpoint `POST /notas-debito`, con la misma estructura.
- Ambas tienen `GET`, `PUT` (solo rechazadas), `enviar`, `reenviar`, `xml`, `cdr` y `pdf`. La serie usa el prefijo de la serie afectada: `FC01`/`FD01` para facturas. Para boletas, la serie concreta debe verificarse en el ejemplo "NC - Anulación de boleta".

### 2.7 Resumen diario (RC) y comunicación de baja (RA)

- `POST /resumenes {fecha_resumen}` envía **todas** las boletas pendientes de esa fecha. Plazo: hasta 7 días.
- `POST /resumenes {fecha_resumen, anular: [{id, motivo}]}` anula **boletas aceptadas**; `id` es el ID interno de la boleta en la API.
- `GET /resumenes/{id}/estado` devuelve el estado del RC, incluido el de cada boleta. También existen `xml`, `cdr` y `enviar`, y filtros `mes` y `tipo=anulacion`.
- `POST /anulaciones {fecha_generacion, fecha_comunicacion, detalles: [{tipo_documento, serie, correlativo, motivo}]}` da de baja facturas, NC y ND aceptadas (plazo de 7 días). Para boletas debe usarse el resumen diario.
- `GET /anulaciones/{id}/estado` consulta el estado; también existen `xml`, `cdr` y `enviar`.

### 2.8 Consulta de estado

| Endpoint | Para qué |
|----------|----------|
| `GET /{facturas\|boletas\|notas-credito\|notas-debito}/{id}` | Estado del documento **en la API** (fuente principal) |
| `GET /consultar-cpe?ruc_emisor&tipo_doc&serie&correlativo&fecha_emision&monto_total` | Validación directa en SUNAT ("consulta integrada, rápida") |
| `POST /consultar-cdr {ruc_emisor, tipo_doc, serie, correlativo}` | Recupera el CDR archivado en SUNAT (ZIP) |
| `GET /sunat/estado` | Circuit breaker de SUNAT: `disponible`, `circuit`, `fallas`, `entorno` |
| `GET /api/health` | Disponibilidad de la API |

### 2.9 Consulta de RUC/DNI y catálogos

- `GET /buscar-documento?tipo=1|6|4|7|0&numero=...` consulta primero la base local de la API y, si no encuentra el documento, SUNAT/RENIEC. **Sí existe** y se usará en el formulario de clientes.
- `GET /catalogos/ubigeo/regiones`, `.../provincias?region_id=`, `.../distritos?provincia_id=`: para la configuración fiscal y las sucursales.
- `GET /catalogos/producto-sunat?q=`, `/{codigo}`, `/segmentos`, `/familias`, `/clases` y `/productos`: código de producto SUNAT (opcional en servicios y productos).
- **No existe** un endpoint de tipo de cambio ni de catálogo de unidades de medida.

### 2.10 Configuración del emisor

| Endpoint | Body / uso |
|----------|-----------|
| `POST /registro` (form-data) | `ruc, razon_social, direccion, ubigeo, departamento, provincia, distrito, sol_user, sol_pass, certificado (file .pfx), contrasena_certificado, tax_regime, plan, entorno (beta/production), client_id, client_secret` → devuelve `api_key`/`api_secret` |
| `GET /empresa` | Perfil: régimen, `tasa_igv_vigente`, plan, contadores de uso, datos del certificado |
| `PUT /empresa` (JSON) | `ruc, razon_social, nombre_comercial, direccion, ubigeo, departamento, provincia, distrito, telefonos[], emails[], mensaje_agradecimiento, webhook_url, entorno, client_id, client_secret`; régimen con `tax_regime` (`general`, `rer`, `mype`, `rus`), `nrus_categoria` e `igv_rate_override` |
| `POST /empresa/certificado` (form-data) | `certificado` (.pfx), `contrasena_certificado` (reemplazo o renovación anual) |
| `POST /empresa/logo` (form-data) | `logo` PNG/JPG, que aparece en los PDF |
| `GET /empresa/credenciales` / `POST /empresa/credenciales/regenerar` | Consultar o rotar el API key/secret (las descripciones de estos dos requests están copiadas de otro endpoint y no son fiables) |
| `DELETE /empresa` | Elimina el tenant (irreversible) |
| `POST/GET/PUT/DELETE /sucursales` | `nombre, cod_local (4 dígitos, "0000" para la principal), direccion, ubigeo, es_principal, telefono, email` |
| `POST /series` (lote), `POST /series/init-defaults`, `GET/PUT/DELETE /series/{id}` | `{tipo: factura\|boleta\|nota_credito\|nota_debito\|..., serie, sucursal_id, correlativo_inicial}`; una serie se desactiva con `is_active: false` |

> ⚠️ `client_id` / `client_secret` parecen ser credenciales del API REST de SUNAT (usadas sobre todo en guías de remisión). Hay que confirmar si son obligatorias para emitir facturas y boletas.
> ⚠️ `PUT /empresa` no muestra `sol_user` / `sol_pass`: **no está documentado cómo cambiar la clave SOL** después del registro.

### 2.11 Manejo de errores

- Respuesta con `estado: "error"`, `mensaje` y `errores` (detalle de validación).
- Códigos HTTP: no documentados. Se asumirá el convenio Laravel (422 validación, 401/403 credenciales, 404, 429, 5xx), **pendiente de verificar**.
- Rechazo SUNAT: el documento queda `rechazado`. Se corrige con `PUT` (se reenvía solo) y se reintenta con `/enviar`. Si ya fue aceptado, no se puede editar: hay que emitir una **NC** o una **comunicación de baja**.
- `GET /sunat/estado` expone un circuit breaker: si `disponible=false`, la UI puede avisar antes de emitir.
- No hay códigos de error SUNAT documentados en la colección.

### 2.12 Otras funcionalidades (fuera de alcance del taller)

Régimen tributario (02), suscripción y planes (03), panel de control con 11 KPIs (15), reportes de la API (16), SIRE con 25 endpoints (17), retenciones (18), percepciones (19), reversiones (20), cotizaciones (21), notas de venta (22), liquidaciones de compra (24), alias `/api/sunat` (25), internas `bridge`/`debug` (26), guías de remisión GRR/GRT (10, 11) y emisión masiva.

---

## 3. Inventario de endpoints

Leyenda de uso: **MVP** = se usa en la versión funcional · **POST-MVP** = fase posterior · **OPC** = opcional · **NO** = fuera de alcance.

### 3.1 Configuración y emisor

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/registro` | **MVP**: aprovisionar el taller (super admin) |
| GET | `/planes` | **MVP**: selector de plan por taller (super admin) |
| GET | `/empresa` | **MVP**: probar conexión y leer régimen, tasa IGV, plan, uso y certificado |
| PUT | `/empresa` | **MVP**: datos fiscales, contacto, régimen, `igv_rate_override`, `entorno` (super admin), `client_id`/`client_secret`, `mensaje_agradecimiento`, `webhook_url` |
| POST | `/empresa/logo` | **MVP**: logo en los PDF |
| POST | `/empresa/certificado` | **MVP**: subir o renovar el certificado (super admin) |
| GET | `/empresa/credenciales` | **MVP** (super admin, diagnóstico; el valor nunca se muestra completo) |
| POST | `/empresa/credenciales/regenerar` | **MVP** (rotación por el super admin) |
| DELETE | `/empresa` | **MVP** (super admin, confirmación escribiendo el RUC) |
| POST | `/credenciales/recuperar`, `/credenciales/recuperar/verificar` | **MVP** (herramienta de recuperación del super admin) |
| GET/POST/PUT | `/suscripcion`, `/suscripcion/cambiar-plan`, `/suscripcion/cancelar` | **MVP** (super admin: ver, activar con prueba, cambiar plan, cancelar) |
| GET | `/suscripcion/uso`, `/suscripcion/pagos` | **MVP** (cupo del mes e historial) |
| CRUD | `/sucursales` | **MVP** (principal y anexos) |
| POST | `/series`, `/series/init-defaults` | **MVP** |
| GET/PUT/DELETE | `/series/{id}` | **MVP** (activar o desactivar) |
| CRUD | `/clientes` | NO (el cliente viaja dentro de cada comprobante; el directorio local es la fuente de verdad) |
| GET | `/buscar-documento` | **MVP**: autocompletar RUC/DNI |

### 3.2 Comprobantes

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/facturas`, `/boletas` | **MVP** |
| GET | `/facturas/{id}`, `/boletas/{id}` | **MVP** (estado) |
| GET | `/facturas`, `/boletas` (filtros `serie`, `correlativo`) | **MVP** (verificación tras un timeout) |
| PUT | `/facturas/{id}`, `/boletas/{id}` | POST-MVP (corregir un rechazado) |
| POST | `/{tipo}/{id}/enviar`, `/reenviar` | **MVP** (reintentar rechazados o pendientes) |
| GET | `/{tipo}/{id}/pdf?format=` | **MVP** (`a4`, `ticket-80`) |
| GET | `/{tipo}/{id}/xml`, `/{tipo}/{id}/cdr` | **MVP** |
| DELETE | `/boletas/{id}` | OPC (limpiar boletas no aceptadas) |
| POST/GET/DELETE | `/{tipo}/{id}/pagos` | NO (los pagos se registran en Laravel) |
| POST | `/notas-credito` + GET/xml/cdr/pdf/enviar | **MVP** (anulación, motivo 01) |
| PUT | `/notas-credito/{id}` | POST-MVP |
| POST | `/notas-debito` + GET/xml/cdr/pdf/enviar | POST-MVP |
| POST/GET | `/resumenes`, `/resumenes/{id}/estado` | POST-MVP (anulación de boletas) |
| POST/GET | `/anulaciones`, `/anulaciones/{id}/estado` | POST-MVP (baja de facturas) |
| POST | `/facturas/masivo` | NO |

### 3.3 Consultas, catálogos y monitoreo

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/sunat/estado` | **MVP** (aviso antes de emitir y prueba de conexión) |
| GET | `/api/health` | **MVP** (prueba de conexión) |
| GET | `/consultar-cpe` | OPC (verificación cruzada en SUNAT) |
| POST | `/consultar-cdr` | OPC (recuperar un CDR perdido) |
| GET | `/catalogos/ubigeo/*` | **MVP** (selects dependientes) |
| GET | `/catalogos/producto-sunat*` | OPC |
| GET | `/reportes/registro-ventas?formato=excel` | OPC (exportación para el contador) |
| GET | `/suscripcion/uso` | OPC (mostrar el cupo al super admin) |
| GET | `/comprobantes/exportar-zip` | OPC (respaldo mensual) |

### 3.4 No utilizados (declarados explícitamente)

Guías GRR/GRT, retenciones, percepciones, reversiones, liquidaciones de compra, SIRE, cotizaciones, notas de venta, panel de la API, suscripción **pagada** con `token` de pasarela (requiere una pasarela de pago, que no está en el alcance), alias `/api/sunat/*` e internas `/api/bridge/*` y `/api/debug/*`.

---

## 4. Mapeo API → taller mecánico

| Necesidad del taller | Solución | Endpoint(s) |
|----------------------|----------|-------------|
| Dar de alta un taller para facturar | Aprovisionamiento desde la configuración fiscal | `POST /registro` → guardar credenciales cifradas |
| Editar datos fiscales | Formulario local → sincronizar | `PUT /empresa` |
| Renovar certificado | Subida por el super admin, reenvío directo a la API | `POST /empresa/certificado` |
| Probar configuración | Botón "Probar conexión" | `GET /api/health`, `GET /empresa`, `GET /sunat/estado` |
| Establecimiento y series | Al completar la configuración | `POST /sucursales`, `POST /series` |
| Autocompletar cliente por RUC/DNI | Botón de búsqueda en el formulario | `GET /buscar-documento` |
| Cobrar una OT con factura | Venta → "Emitir factura" | `POST /facturas` |
| Factura de servicio sujeta a SPOT | Bloque `detraccion` calculado automáticamente | `POST /facturas` (§8.8) |
| Asignar plan, entorno y certificado a un taller | Panel del super admin | `/planes`, `/suscripcion/*`, `PUT /empresa`, `/empresa/certificado` |
| Cobrar con boleta | Venta → "Emitir boleta" (envío individual) | `POST /boletas` |
| Saber si SUNAT aceptó | Botón "Actualizar estado" + tarea programada de lectura | `GET /facturas/{id}`, `GET /boletas/{id}` |
| Imprimir o enviar el comprobante | Descarga A4 o ticket 80 mm | `GET /{tipo}/{id}/pdf` |
| Entregar XML/CDR al cliente o contador | Descargas | `GET /{tipo}/{id}/xml`, `/cdr` |
| Anular un comprobante | NC motivo 01 | `POST /notas-credito` |
| Devolver un repuesto o aplicar descuento | NC motivo 07 / 04 / 05 | `POST /notas-credito` |
| Cobrar intereses o un ajuste | ND | `POST /notas-debito` (post-MVP) |
| Corregir un comprobante rechazado | Editar el cliente y reenviar | `PUT /{tipo}/{id}` (post-MVP) |
| Reporte de comprobantes para el contador | Exportación | `GET /reportes/registro-ventas?formato=excel` (OPC) |

**Datos del vehículo en el comprobante:** la API no documenta un campo de observaciones o leyendas. La placa y el kilometraje se incluirán en la **descripción del primer ítem** (p. ej. `"Mantenimiento preventivo – Placa ABC-123 – 45 000 km"`) o se pedirá al dueño de la API un campo `observaciones`.

---

## 5. Arquitectura general

```
┌──────────────────────────── Navegador ───────────────────────────┐
│ React + Inertia (páginas) · shadcn/ui · Tailwind · Lucide        │
│ Nunca recibe credenciales de la API ni rutas de archivos privados │
└───────────────▲──────────────────────────────────┬───────────────┘
                │ Inertia (HTML/JSON, sesión, CSRF)│
┌───────────────┴──────────────────────────────────▼───────────────┐
│ Laravel                                                          │
│  Middleware: EnsureSystemInstalled · auth · EnsureCompanyContext │
│              EnsureBillingReady · HandleInertiaRequests          │
│  Controllers (delgados) → Form Requests → Policies               │
│  Services de dominio: WorkOrderService · SaleService ·           │
│        StockService · ProductImageService · InstallationService  │
│  Integración SUNAT (app/Services/SunatApi):                      │
│        SunatApiClient (HTTP) · CompanyProvisioner ·              │
│        DocumentPayloadBuilder · DocumentIssuer ·                 │
│        DocumentStatusSynchronizer · DocumentFileFetcher          │
│  Scheduler (cron): sunat:sync-pending (solo lectura de estados)  │
└───────────────┬──────────────────────────────────┬───────────────┘
                │ Eloquent                         │ HTTP (Http::)
         ┌──────▼──────┐                   ┌───────▼──────────┐
         │   MySQL 8   │                   │ API SUNAT PRO     │
         │ company_id  │                   │ (su propia cola   │
         │ en cada tabla│                  │  hacia SUNAT)     │
         └─────────────┘                   └──────────────────┘
```

**Decisiones clave**

1. **Monolito modular** (no microservicios): un solo Laravel con módulos por carpetas de dominio.
2. **Multiempresa con una sola base de datos** y columna `company_id`, global scope y policies.
3. **Sin colas para comprobantes.** La API ya procesa en segundo plano. Laravel solo hace HTTP síncrono y lee estados. La única tarea programada (`schedule:run` por cron) **lee** estados pendientes; nunca crea ni reenvía.
4. **La fuente de verdad fiscal es la API.** Laravel guarda una instantánea de lo enviado y el último estado recibido.
5. **Stack:** Laravel 12+ (o la última estable), PHP 8.3+, MySQL 8, Inertia 2, React 19 + TypeScript, Tailwind CSS 4 y shadcn/ui. Se recomienda partir del **starter kit oficial React de Laravel**, que ya integra Inertia, TypeScript, shadcn/ui, Tailwind y modo claro/oscuro.

**Dependencias mínimas propuestas**

| Paquete | Motivo |
|---------|--------|
| `spatie/laravel-permission` | Roles y permisos (sin la función *teams*: cada usuario pertenece a una sola empresa) |
| `intervention/image` | Reprocesar imágenes subidas (eliminar EXIF, neutralizar archivos manipulados, generar miniaturas) |
| `@tanstack/react-table` | Lógica *headless* de tablas, que es el patrón oficial de shadcn para DataTable. No es una librería visual |
| `sonner` | Notificaciones (componente oficial de shadcn) |
| `pestphp/pest` | Pruebas |

No se añaden otras librerías de UI.

---

## 6. Módulos funcionales

### 6.1 Dashboard
- **Indicadores (4 como máximo, en una fila):** ingresos de hoy, ingresos del mes, OT abiertas y comprobantes con problema (rechazados o en estado incierto).
- **Bloque "Órdenes por estado":** lista compacta con contadores (Pendiente, En diagnóstico, En proceso, Finalizada sin cobrar).
- **Actividad reciente:** las últimas 10 entradas de `activity_logs`.
- **Comprobantes del mes:** conteo por tipo y estado (aceptados, pendientes, rechazados).
- Un solo gráfico opcional: ingresos de los últimos 30 días (barras, color primario).
- Todo se calcula con datos locales, sin llamar a la API para cargar el dashboard.

### 6.2 Clientes
- Campos: tipo de documento (DNI, RUC, CE, pasaporte u otros), número, nombre o razón social, nombre comercial, dirección, teléfono, correo y notas.
- **Búsqueda RUC/DNI:** botón que llama a `/buscar-documento` y rellena nombre y dirección.
- Validaciones: RUC de 11 dígitos con dígito verificador (módulo 11) y DNI de 8 dígitos. Unicidad por `(company_id, tipo, número)`.
- La ficha del cliente muestra sus vehículos, OT y ventas.

### 6.3 Vehículos
- Pertenecen a un cliente. Campos: placa (única por empresa, normalizada en mayúsculas y sin espacios ni guiones), marca, modelo, año, color, VIN o número de motor (opcional), kilometraje actual, características (texto libre) y observaciones.
- El kilometraje actual se actualiza al registrar el kilometraje de ingreso de una OT, solo si es mayor que el anterior.
- Desde la ficha del vehículo se accede a su historial (§6.9).

### 6.4 Servicios del taller
- Nombre, descripción, precio con IGV, afectación IGV (por defecto `10` gravado), código de producto SUNAT opcional (sugerido `78181500`), **"Sujeto a detracción"** (sí/no, por defecto sí) con un **tipo de detracción sugerido** elegido de la lista del taller (si no se elige, se usa el predeterminado; al emitir siempre se puede cambiar) y estado activo/inactivo.
- La unidad SUNAT siempre es `ZZ`.
- Se cargan algunos servicios de ejemplo opcionales (mantenimiento preventivo, cambio de aceite, frenos, suspensión, diagnóstico).

### 6.5 Productos y repuestos
- Código (único por empresa), nombre, descripción, costo, precio de venta con IGV, stock, stock mínimo opcional, unidad (`NIU` por defecto), afectación IGV, código SUNAT opcional, **imagen opcional** (§14) y estado.
- **Inventario básico:** tabla `stock_movements` (entrada, salida por venta, ajuste y devolución) con saldo resultante. El stock solo cambia mediante `StockService`, nunca editando el número a mano; los ajustes manuales también generan un movimiento con motivo.
- Alerta visual cuando el stock es menor o igual al mínimo.

### 6.6 Órdenes de trabajo (módulo central)
- **Número correlativo por empresa:** `OT-000001`.
- Cabecera: cliente, vehículo (filtrado por cliente), kilometraje de ingreso, fecha y hora de ingreso, fecha prometida (opcional), problema reportado, diagnóstico, observaciones, técnico asignado (opcional) y estado.
- **Ítems en una sola tabla** `work_order_items` con `type` = `service` | `product` | `labor`. La mano de obra es una línea libre (descripción + monto). Así se reemplaza la propuesta de tener `work_order_details` y `work_order_products` por separado, y los totales y la conversión a venta salen de un solo lugar.
- Los totales se calculan en el backend (subtotal, IGV y total). La UI los muestra en vivo, pero el servidor recalcula y valida.
- **Máquina de estados** (validada en el backend):
  ```
  pendiente → en_diagnostico → en_proceso → finalizada → entregada
       └──────────┴──────────────┴─────→ cancelada (antes de facturar)
  ```
  - Solo se puede editar el contenido en `pendiente`, `en_diagnostico` y `en_proceso`.
  - En `finalizada` se habilita "Generar venta".
  - `entregada` requiere que la venta exista (configurable).
  - Cada cambio de estado se registra en `activity_logs` con el usuario y una nota.
- La vista de detalle incluye cabecera, vehículo, ítems, totales, línea de tiempo de estados y venta o comprobante vinculado. También se puede imprimir una hoja de OT simple (vista imprimible HTML).

### 6.7 Ventas
- **Origen:** una OT finalizada (relación 1:1, `sales.work_order_id` único) o una **venta directa** (mostrador, por ejemplo la venta de un repuesto suelto).
- Al generar la venta desde una OT, sus ítems se **copian una sola vez** a `sale_items` y la OT pasa a solo lectura. No se considera duplicación: la OT es el registro operativo y la venta es el registro comercial inmutable que se factura. Desde ese momento ya no se modifican.
- Métodos de pago: efectivo, tarjeta, Yape, Plin y transferencia. Se admite pago mixto (`sale_payments`). La suma de pagos debe ser igual al total en ventas al contado.
- El stock se descuenta **al registrar la venta**, que es el único punto de descuento tanto para OT como para venta directa.
- Estados de la venta: `registrada` y `anulada`. Solo se puede anular si no tiene comprobante aceptado; si lo tiene, se anula con NC. Al anular se devuelve el stock.
- El comprobante a emitir se elige al final: Factura, Boleta o "Sin comprobante" (venta interna).

### 6.8 Comprobantes electrónicos
- Se emiten **solo desde una venta registrada**.
- Para cada venta solo puede haber un comprobante 01/03 activo. Restricción en base de datos más bloqueo de fila (§8.4).
- Acciones: emitir, actualizar estado, descargar PDF (A4 o ticket 80 mm), XML y CDR, emitir NC (anulación o devolución), ver la respuesta de la API y el historial de operaciones.
- Listado con filtros por tipo, estado, fechas y cliente.

### 6.9 Historial por vehículo
- Línea de tiempo por placa con las OT (fecha, kilometraje de ingreso, estado y total), los servicios y repuestos de cada una, y el comprobante asociado.
- Se obtiene por consulta (`work_orders` + `work_order_items` + `sales` + `electronic_documents`), sin tabla propia.

### 6.10 Reportes
Todos con rango de fechas, tabla responsive y exportación CSV (respuesta *streamed*, sin dependencias extra):
1. Ventas por fechas (con método de pago).
2. Servicios realizados (agrupados por servicio, cantidad y monto).
3. Órdenes de trabajo (por estado y técnico).
4. Ingresos (por día o mes y por método de pago).
5. Productos y repuestos vendidos (cantidad, monto y margen = precio − costo).
6. Comprobantes emitidos (por tipo y estado), con un botón opcional "Registro de ventas (Excel)" que usa `GET /reportes/registro-ventas?formato=excel` de la API.

### 6.11 Configuración
Toda la configuración de la API se hace desde aquí (detalle por pantalla en §9.5).
- **Taller (admin de la empresa):** nombre comercial, logo, teléfonos y correos, mensaje de agradecimiento, dirección y ubigeo, régimen, establecimientos, series, **detracción** (cuenta del Banco de la Nación, medio de pago, umbral y **lista de tipos con su porcentaje**, que el taller agrega y edita), usuarios de la empresa.
- **Super admin (por taller):** aprovisionamiento, **plan**, **certificado digital**, Clave SOL, **entorno beta/producción**, `client_id`/`client_secret`, credenciales (rotar o recuperar), suscripción y uso, eliminación del tenant, log de llamadas a la API.
- **Preferencias:** tema claro, oscuro o del sistema (por usuario).

---

## 7. Flujo operativo completo

```
1  Recepción  → Buscar/crear CLIENTE (autocompleta con /buscar-documento)
2             → Buscar/crear VEHÍCULO del cliente
3  Orden      → Crear OT [pendiente]: km de ingreso, problema reportado
4             → Diagnóstico [en_diagnostico]
5             → Agregar servicios, repuestos y mano de obra; totales en vivo
6             → Trabajo [en_proceso]
7             → Finalizar [finalizada]
8  Caja       → "Generar venta": copia de ítems, pago(s) y descuento de stock
9             → Elegir FACTURA (cliente con RUC) o BOLETA
10 SUNAT      → Laravel construye el payload y llama a POST /facturas|/boletas
11            → Guarda id_api, estado y respuesta, y escribe api_operation_logs
12            → Estado pendiente/enviado: "Actualizar estado" o tarea programada
13            → Aceptado: se habilitan PDF, XML y CDR. Rechazado: se muestra el motivo
14 Entrega    → OT [entregada]; el kilometraje queda en el historial del vehículo
```

**Reglas de negocio transversales**
- Una factura exige un cliente con RUC (`tipo_doc 6`). Una boleta admite DNI, CE o consumidor final si el total es menor a S/ 700.
- Si una factura incluye servicios sujetos a detracción y su total supera el umbral configurado (por defecto S/ 700), se sugiere la detracción; **el usuario elige el tipo y el porcentaje** al emitir (§8.8).
- Si la empresa está en régimen `rus` (NRUS), no se pueden emitir facturas ni notas.
- No se puede emitir si la configuración fiscal no está en estado `ready` (middleware `EnsureBillingReady` en las rutas de emisión).
- La fecha de emisión es la fecha actual en la zona `America/Lima`.

---

## 8. Arquitectura de integración SUNAT

### 8.1 Componentes (`app/Services/SunatApi/`)

| Clase | Responsabilidad |
|-------|-----------------|
| `SunatApiClient` | Única clase que habla HTTP. Se construye **por empresa** (`forCompany($company)`), inyecta `X-Api-Key` y `X-Api-Secret` desde la configuración cifrada, define timeouts y `Accept: application/json`, interpreta el sobre `{estado, mensaje, datos, errores}` y lanza excepciones tipadas. Registra cada llamada en `api_operation_logs` con datos sensibles enmascarados. |
| `SunatApiException` y derivadas | `ApiValidationException` (422 / `errores`), `ApiAuthException` (401/403), `ApiUnavailableException` (5xx), `ApiTimeoutException` (sin respuesta), `ApiBusinessException` (`estado=error`) |
| `CompanyProvisioner` | `POST /registro`, `PUT /empresa`, `POST /empresa/certificado`, `POST /empresa/logo`, sucursales y series |
| `DocumentPayloadBuilder` | Venta → payload de factura, boleta, NC o ND exactamente con los campos de la colección |
| `DocumentIssuer` | Orquesta la emisión con protección contra duplicados (§8.4) |
| `DocumentStatusSynchronizer` | `GET /{tipo}/{id}` → actualiza el estado local. Lo usan el botón manual y el comando programado |
| `DocumentFileFetcher` | PDF, XML y CDR: descarga desde la API, devuelve un *stream* al navegador y guarda en caché privada XML y CDR una vez aceptado el comprobante |
| `SunatApiEndpoints` (enum o const) | Rutas centralizadas: `facturas`, `boletas`, `notas-credito`, `notas-debito` por tipo de documento |

Los controladores y componentes React **nunca** construyen payloads ni conocen URLs de la API.

### 8.2 Configuración global (`config/sunat_api.php` ← `.env`)

```
SUNAT_API_BASE_URL=https://sunat.kodevo.es/api/v1
SUNAT_API_ROOT_URL=https://sunat.kodevo.es/api        # health
SUNAT_API_TIMEOUT=30
SUNAT_API_CONNECT_TIMEOUT=10
SUNAT_API_DEFAULT_ENV=beta                            # entorno inicial de un taller nuevo
```
El **plan** no va en `.env`: el super admin lo elige para cada taller (`companies.api_plan`).
Las credenciales `api_key` y `api_secret` son **por empresa** y se guardan en la base de datos con cast `encrypted` (que usa `APP_KEY`). Si en el futuro la API ofrece una credencial maestra para `/bridge/provision`, iría en `.env` y nunca en la base de datos.

### 8.3 Ciclo de vida de un comprobante (estado local)

```
draft_local ──POST──► (respuesta OK) ──► pendiente / enviado ──GET──► aceptado
     │                                          │                       │
     │                                          └──GET──► rechazado ────┘ (corrección PUT / NC)
     ├──(422/estado=error, la API NO lo creó)──► failed   (corregir y reintentar)
     └──(timeout / sin respuesta)──────────────► unknown  (verificar antes de reintentar)
aceptado ──(NC motivo 01 aceptada)──► anulado
```
`api_status` refleja literalmente lo que devuelve la API. `local_status` agrega `draft_local`, `failed`, `unknown` y `anulado`.

### 8.4 Protección contra duplicados (crítico)

1. **Base de datos:** `electronic_documents.issuance_key` UNIQUE, con valor `sale:{id}` para 01/03. Si se intenta un segundo comprobante para la misma venta, MySQL lo rechaza.
2. **Bloqueo:** `DB::transaction` + `Sale::lockForUpdate()` + `DocumentSeries::lockForUpdate()`. Se reserva el siguiente correlativo y se crea la fila `draft_local` con el payload completo. Después se hace *commit* y **la llamada HTTP se hace fuera de la transacción**.
3. **Correlativo explícito:** se envía `correlativo` en el payload (la colección lo admite). Así cada intento tiene un identificador natural `serie-correlativo` que se puede buscar.
4. **POST sin reintentos automáticos.** Si hay timeout, se marca `unknown` y en la UI aparece **"Verificar en la API"**, que ejecuta `GET /facturas?serie=F001&correlativo=N`:
   - Si existe, se adopta su `id` y estado. No se reenvía.
   - Si no existe, se habilita "Reintentar envío" con **el mismo payload y el mismo correlativo**.
5. Para reenviar a SUNAT un documento rechazado o pendiente se usa `POST /{tipo}/{id}/enviar`, que según la colección rechaza la llamada si el documento ya está aceptado. Nunca se crea un documento nuevo.
6. El botón "Emitir" se deshabilita mientras la petición está en curso (`processing` de Inertia). Esto es solo comodidad: la garantía real está en los puntos 1 y 2.

> **Verificar en la fase 0:** (a) que la API rechace un `serie+correlativo` duplicado; (b) que aceptar correlativos explícitos no desincronice el contador interno de la serie en la API; (c) si existe una cabecera de idempotencia (la carpeta de alias menciona un "stack de idempotencia"). Si (a) o (b) fallan, la alternativa es dejar que la API asigne el correlativo y, ante un timeout, buscar por `client_num_doc` + `fecha_desde` + total.

### 8.5 Consulta de estados (sin colas)

- **Manual:** botón "Actualizar estado" en el comprobante.
- **Automática:** comando `sunat:sync-pending` ejecutado por el **Scheduler** de Laravel (cron cada 5 minutos, `withoutOverlapping`). Toma los documentos en `pendiente`, `enviado` o `unknown` de las últimas 72 horas con *backoff* (`next_check_at`), hace solo GET y actualiza el estado. **No crea ni reenvía comprobantes.**
- **Webhook (post-MVP):** cuando se documente el payload y la firma de `webhook_url`, se agregará `POST /webhooks/sunat/{company_uuid}` con verificación de firma, que solo dispara la misma sincronización por GET.

### 8.6 Registro y diagnóstico

`api_operation_logs` guarda la operación, el método, la ruta relativa, el estado HTTP, la duración, `estado` y `mensaje`, los `errores` y el cuerpo de respuesta truncado (16 KB). **Nunca** se guardan cabeceras de autenticación, el certificado, su contraseña ni la Clave SOL: un `LogSanitizer` reemplaza esas claves por `***`. Se conservan 90 días (comando de limpieza programado).

### 8.7 Construcción del payload (factura o boleta desde una venta)

| Payload | Origen |
|---------|--------|
| `serie`, `correlativo` | `document_series` (bloqueada) |
| `fecha_emision` | `now('America/Lima')` |
| `tipo_operacion` | `0101` (omitido en NRUS) |
| `tipo_moneda` | `PEN` (MVP) |
| `forma_pago` | `Contado` (MVP) |
| `cliente.*` | Instantánea del cliente de la venta |
| `items[].codigo` | código del producto o `SERV-{id}` / `MO` |
| `items[].cod_producto_sunat` | del servicio o producto (si existe) |
| `items[].unidad` | `NIU` (producto) / `ZZ` (servicio y mano de obra) |
| `items[].precio_unitario` | precio con IGV de `sale_items` |
| `items[].tip_afe_igv` | afectación del ítem (por defecto `10`) |
| `enviar_automatico` | `true` |
| `solo_registro` (boleta) | `false` (envío individual) |
| `detraccion` (factura) | Solo si aplica (§8.8) |

### 8.8 Detracción (SPOT) en facturas de servicios

**Ejemplo real de la colección ("Factura con detracción"):**
```json
POST {{base_url}}/facturas
{
  "serie": "F001", "fecha_emision": "2026-05-24",
  "tipo_operacion": "0101", "tipo_moneda": "PEN",
  "cliente": { "tipo_doc": "6", "num_doc": "20000000002", "razon_social": "EMPRESA X SAC",
               "direccion": "AV. AREQUIPA 1234, LIMA" },
  "items": [ { "codigo": "P001", "descripcion": "Matenimiento preventivo de PC", "unidad": "ZZ",
               "cantidad": 1, "precio_unitario": 1000, "tip_afe_igv": "10" } ],
  "detraccion": {
    "tipo_operacion": "1001",
    "cod_bien": "014",
    "cod_medio_pago": "001",
    "cta_banco": "0004-3342343243",
    "porcentaje": 4.00,
    "monto": 37.76
  }
}
```

**La detracción es dinámica: el tipo y el porcentaje los elige el taller.** No hay un código ni un porcentaje fijos en el sistema.

**1. Tipos de detracción por empresa** (tabla `detraction_types`, pantalla *Configuración → Detracción* del admin del taller):
- Cada taller mantiene su propia lista con: código SUNAT (cat. 54, `cod_bien`), descripción, **porcentaje**, activo/inactivo y uno marcado como predeterminado.
- Puede **agregar, editar el porcentaje, desactivar o elegir el predeterminado** cuando quiera, por ejemplo cuando SUNAT cambie las tasas.
- Al crear un taller se siembra una lista inicial **editable**, solo como punto de partida (el taller debe revisarla con su contador): `020` Mantenimiento y reparación de bienes muebles, `022` Otros servicios empresariales, `037` Demás servicios gravados con IGV y `019` Arrendamiento de bienes muebles.

**2. Configuración general de detracción** (`company_billing_settings`):
| Campo | Payload | Valor inicial |
|-------|---------|---------------|
| `detraction_enabled` | — | `true` |
| `detraction_account` | `cta_banco` | cuenta de detracciones del Banco de la Nación (obligatoria si está activa) |
| `detraction_payment_method` | `cod_medio_pago` | `001` (depósito en cuenta), editable |
| `detraction_threshold` | — | `700.00`, editable |

**3. Tipo sugerido por servicio:** cada servicio puede tener un `detraction_type_id` (opcional). Si no lo tiene, se usa el predeterminado de la empresa.

**4. Elección al emitir la factura** (diálogo "Emitir comprobante"):
- Si la venta tiene servicios o mano de obra sujetos a detracción y el total supera el umbral, la sección **Detracción** aparece activada con la sugerencia (tipo del servicio de mayor monto o el predeterminado).
- El usuario puede:
  - **elegir otro tipo** en un `Select` con los tipos activos de su empresa;
  - **cambiar el porcentaje** en un campo numérico (se rellena con el % del tipo elegido);
  - **activarla aunque no se cumpla la regla** o **desactivarla**, en este caso indicando un motivo obligatorio.
- El **monto se recalcula en vivo**: `round(total_factura × porcentaje / 100, 2)`. Se muestra "Detracción: S/ X (Y %) · Neto a cobrar: S/ Z".

**5. Backend (`DetractionCalculator` + Form Request):**
- Recalcula el monto con el tipo y el % recibidos e ignora el monto que envía el navegador.
- Valida: `detraction_type_id` existe y pertenece a la empresa (`Rule::exists` con `company_id`), `0 < porcentaje ≤ 100`, que sea factura (01) en `PEN` y que haya cuenta de detracción configurada.
- Construye el bloque: `{tipo_operacion: "1001", cod_bien, cod_medio_pago, cta_banco, porcentaje, monto}`.
- Guarda la instantánea en `electronic_documents` (`detraction_code`, `detraction_rate`, `detraction_amount`, `detraction_account`, `detraction_payment_method`, `detraction_override_reason`). Si después cambia el porcentaje de un tipo, los comprobantes emitidos no cambian.
- Si se excluye una detracción sugerida o se cambia el % respecto al del tipo, queda registrado en `activity_logs`.

> ⚠️ **Verificar en la Fase 0:**
> - En el ejemplo, `monto` (37.76) no es el 4 % del total (40.00). Hay que confirmar si la API recalcula el monto, cómo lo redondea y si exige que coincida.
> - Confirmar si la API cambia sola el `tipo_operacion` de cabecera (el ejemplo lo deja en `0101`) y si agrega la leyenda SPOT al PDF.
> - Venta a crédito con detracción: SUNAT exige que las cuotas descuenten el monto detraído. Queda junto con el crédito en el post-MVP.

---

## 9. Configuración fiscal multiempresa

### 9.1 Quién configura cada dato

| Dato | Admin del taller | Super admin | Destino en la API |
|------|:---------------:|:-----------:|-------------------|
| RUC, razón social | ✅ (antes de aprovisionar) | ✅ | `/registro`, `PUT /empresa` |
| Nombre comercial, teléfonos, correos, mensaje de agradecimiento | ✅ | ✅ | `PUT /empresa` |
| Dirección fiscal, ubigeo, departamento, provincia, distrito | ✅ (selects con `/catalogos/ubigeo`) | ✅ | `/registro`, `PUT /empresa` |
| Logo de los PDF | ✅ | ✅ | `POST /empresa/logo` |
| Régimen (`general`, `rer`, `mype`, `rus` + categoría NRUS), `igv_rate_override` | ✅ (override solo super admin) | ✅ | `PUT /empresa` |
| Establecimientos (`cod_local`, dirección) | ✅ | ✅ | `/sucursales` |
| Series F/B/FC/BC... | ✅ | ✅ | `/series`, `/series/init-defaults` |
| Detracción (cuenta, código, porcentaje, umbral) | ✅ | ✅ | se envía en cada factura (§8.8) |
| **Certificado `.pfx` y contraseña** | ❌ (solo ve el estado y el vencimiento) | ✅ | `/registro`, `POST /empresa/certificado` |
| **Usuario y Clave SOL** | ❌ | ✅ | `/registro` |
| **Plan** | ❌ (solo ve plan y uso) | ✅ | `/registro`, `/suscripcion/*` |
| **Entorno beta / producción** | ❌ (solo ve el entorno) | ✅ | `/registro`, `PUT /empresa {entorno}` |
| `client_id` / `client_secret` SUNAT | ❌ | ✅ (si la API lo exige) | `/registro`, `PUT /empresa` |
| `webhook_url` | ❌ | automático (post-MVP) | `PUT /empresa` |
| **API Key / API Secret** | ❌ **nunca** | rotar o recuperar, **sin verlos** | `/empresa/credenciales/*`, `/credenciales/recuperar/*` |

### 9.2 Flujo de alta de un taller

1. **Super admin → "Nuevo taller":** RUC (autocompletado con `/buscar-documento?tipo=6`), razón social, dirección y ubigeo, régimen, **plan** (select cargado con `GET /planes`) y **entorno** (beta por defecto). También crea el usuario administrador del taller.
2. **Super admin → "Credenciales SUNAT":** usuario y Clave SOL, **certificado `.pfx` y contraseña**. El backend solo valida que llegue un archivo `.pfx`/`.p12` de tamaño razonable y la contraseña. **La validación y el cifrado los hace la API.** Si la API rechaza el certificado, su `mensaje` y sus `errores` se muestran en el formulario.
3. **Super admin → "Aprovisionar":** `POST /registro` (form-data con certificado, SOL, `plan` y `entorno`), guardar las credenciales cifradas, `PUT /empresa` con los datos complementarios, `POST /sucursales` (principal `0000`), `POST /series` (F001, B001, FC01, BC01) y **prueba de conexión** (`GET /api/health` + `GET /empresa` + `GET /sunat/estado`). Si el plan lo requiere, `POST /suscripcion {plan_slug, ciclo_facturacion, prueba}`.
4. **Admin del taller:** completa nombre comercial, logo, contacto, anexos, series adicionales y la **cuenta de detracciones**. Cada guardado se sincroniza con la API al momento (`PUT /empresa`, `/empresa/logo`, `/sucursales`, `/series`).
5. **Super admin → "Pasar a producción":** diálogo de confirmación que muestra antes una lista de verificación (certificado vigente, al menos una factura y una boleta aceptadas en beta, series de producción creadas). Luego ejecuta `PUT /empresa {entorno: "production"}` y queda registrado en `activity_logs`. La vuelta a beta usa el mismo diálogo.

El resultado se muestra con estados: `not_configured` → `incomplete` → `provisioning_error` → `ready`. Se muestran también la fecha de la última actualización, la última validación, el vencimiento del certificado (con aviso a 30 días) y el entorno actual.

**Si `/registro` falla a la mitad** (por ejemplo, la API creó el tenant pero hubo timeout): el paso queda `provisioning_error` y el super admin puede verificar o recuperar el tenant. Ver riesgo R4.

### 9.3 Certificado y secretos

- **El certificado lo sube, reemplaza y renueva solo el super admin** (permiso `billing.certificate`). El admin del taller ve el estado: vigente, vence en N días o vencido. Ambos reciben el aviso de vencimiento (a 30, 15 y 7 días) en el dashboard y por correo.
- **Decisión: solo subir.** El `.pfx`, su contraseña y la Clave SOL **se reenvían a la API y no se guardan en Laravel** (ni en disco ni en la base de datos). La API ya los valida, cifra y custodia. El archivo subido se lee desde el temporal de PHP y se envía como *multipart* a `POST /registro` o `POST /empresa/certificado`; no se usa `store()`.
- En `company_billing_settings` solo se registra **cuándo y quién** lo subió (`certificate_uploaded_at`, `certificate_uploaded_by`). Si `GET /empresa` devuelve el vencimiento del certificado (la colección dice que trae "datos del certificado"; se confirma en la Fase 0), se copia a `certificate_valid_to` para los avisos de vencimiento.
- Para renovar o volver a aprovisionar, el super admin sube el certificado de nuevo.
- `api_key` / `api_secret`: cast `encrypted`, en `$hidden`, nunca incluidos en *props* de Inertia, nunca escritos en logs. Solo el super admin puede **rotarlos** (`/empresa/credenciales/regenerar`), sin verlos.

### 9.4 Aislamiento multiempresa

- Toda tabla de negocio tiene `company_id` (FK, indexado y primera columna de los índices compuestos).
- Trait `BelongsToCompany`: aplica un global scope `where company_id = current company` y rellena `company_id` al crear.
- `CurrentCompany` (singleton por request) se resuelve en el middleware `EnsureCompanyContext` a partir de `auth()->user()->company_id`. El super admin elige empresa explícitamente (selector) y la elección se guarda en sesión.
- Las **policies** vuelven a verificar `$model->company_id === $user->company_id` (defensa en profundidad).
- *Route model binding* con scope (`Route::scopeBindings()`) y reglas de validación `Rule::exists(...)->where('company_id', ...)` para todos los IDs que llegan en formularios (cliente, vehículo, producto o servicio en una OT).
- **Históricos inmutables:** `electronic_documents` guarda instantáneas del emisor (RUC, razón social, dirección, establecimiento, entorno), del receptor, de los totales, de la detracción y del payload enviado. Si después cambia la configuración, los comprobantes antiguos no se ven afectados.

### 9.5 Pantallas de configuración de la API (todo desde el sistema)

**Super admin → Talleres → [taller] → pestañas:**
| Pestaña | Acciones | Endpoints |
|---------|----------|-----------|
| General | Datos del taller, admin del taller, suspender o activar | local |
| Aprovisionamiento | Estado (`not_configured`, `incomplete`, `provisioning_error`, `ready`), botón "Aprovisionar" o "Reintentar" | `POST /registro`, `PUT /empresa`, `/sucursales`, `/series` |
| Certificado y SOL | Subir o renovar el `.pfx` con su contraseña (se envía a la API y no se guarda), fecha de la última subida y vencimiento informado por la API, Clave SOL (solo al registrar, ver R10) | `POST /empresa/certificado`, `GET /empresa` |
| Plan y suscripción | Plan actual, cambiar plan, activar con prueba de 14 días, cancelar, uso del mes, historial de pagos | `GET /planes`, `GET/POST /suscripcion`, `PUT /suscripcion/cambiar-plan`, `PUT /suscripcion/cancelar`, `GET /suscripcion/uso`, `GET /suscripcion/pagos` |
| Entorno | Beta ⇄ Producción con lista de verificación previa | `PUT /empresa {entorno}` |
| Régimen avanzado | `igv_rate_override`, `client_id`/`client_secret` | `PUT /empresa` |
| Credenciales API | Probar conexión, rotar (`regenerar`), recuperar con token (`/credenciales/recuperar` → `/verificar`). Los valores **nunca** se muestran | `/empresa/credenciales/regenerar`, `/credenciales/recuperar*` |
| Diagnóstico | Log de llamadas a la API filtrable, estado SUNAT | `api_operation_logs`, `GET /sunat/estado`, `GET /api/health` |
| Zona de peligro | Eliminar el tenant en la API (confirmación escribiendo el RUC) | `DELETE /empresa` |

**Admin del taller → Configuración → pestañas:** Empresa (datos y logo), Fiscal (dirección, ubigeo y régimen), Establecimientos, Series, Detracción, Usuarios y un panel de **solo lectura** con plan, uso del mes, entorno y estado del certificado.

**Sincronización:** cada guardado se ejecuta en una transacción local más la llamada a la API. Si la API responde con error, la transacción se revierte y se muestra el `mensaje` y los `errores` junto a cada campo. Ningún cambio queda "a medias". Los datos se vuelven a leer con `GET /empresa` al abrir la pantalla, y si hay diferencias se avisa con un `Alert` "La configuración en la API difiere".

---

## 10. Base de datos y relaciones

### 10.1 Diagrama lógico

```
companies 1─┬─1 company_billing_settings
            ├─* establishments 1─* document_series
            ├─* users
            ├─* customers 1─* vehicles
            ├─* detraction_types 1─* services (tipo sugerido)
            ├─* services
            ├─* products 1─* stock_movements
            ├─* work_orders 1─* work_order_items
            │      (customer_id, vehicle_id)   (service_id | product_id | null)
            ├─* sales 1─* sale_items
            │    │   1─* sale_payments
            │    └─ work_order_id (único, nullable)
            ├─* electronic_documents ─ sale_id, related_document_id (NC/ND → origen)
            ├─* api_operation_logs ─ electronic_document_id (nullable)
            └─* activity_logs
system_settings (fila única: estado de instalación)
roles / permissions / model_has_roles (spatie)
```

### 10.2 Tablas

Convenciones: `id` bigint, `timestamps`, montos `decimal(12,2)`, precios unitarios `decimal(12,4)`, cantidades `decimal(12,3)`. `company_id` va con FK `cascadeOnDelete` solo donde corresponde. En tablas transaccionales se usa `restrictOnDelete` y se eliminan registros con `SoftDeletes` en maestros.

**system_settings**: estado de instalación (una sola fila sembrada por la migración).
- `id` (=1), `installed_at` nullable, `installed_by_user_id` nullable.
- Se usa con `SELECT … FOR UPDATE` para serializar el setup (§15).

**users**
- `company_id` nullable (null = super admin de plataforma), `first_name`, `last_name`, `email` (unique), `password`, `is_active`, `theme` (`light|dark|system`), `last_login_at`, `remember_token`.
- Índice: `(company_id, is_active)`.

**companies**
- `uuid` (unique, para URLs públicas como el webhook), `ruc` (unique), `legal_name`, `trade_name`, `email`, `phone`, `logo_path` nullable, `status` (`active|suspended`), **`api_plan`** (slug del plan asignado por el super admin), `subscription_status`, `subscription_synced_at`.

**company_billing_settings** (1:1)
- `company_id` unique, `fiscal_address`, `ubigeo` char(6), `department`, `province`, `district`, `tax_regime`, `nrus_category` nullable, `igv_rate` (copiada de `tasa_igv_vigente`), `environment` (`beta|production`, solo lo cambia el super admin), `environment_changed_at`, `environment_changed_by`, `api_key` (encrypted text), `api_secret` (encrypted text), `certificate_uploaded_at`, `certificate_uploaded_by`, `certificate_valid_to` nullable (copiado de `GET /empresa`), `status` (`not_configured|incomplete|provisioning_error|ready`), `provisioned_at`, `last_synced_at`, `last_validated_at`, `last_error` text, `thanks_message`.
- **Detracción:** `detraction_enabled`, `detraction_account`, `detraction_payment_method` char(3), `detraction_threshold` decimal(12,2).

**detraction_types** (tipos y porcentajes elegidos por cada taller)
- `company_id`, `code` char(3) (cat. 54), `description`, `rate` decimal(5,2), `is_active`, `is_default`.
- Unique: `(company_id, code)`. Solo un `is_default` por empresa (se controla en el servicio dentro de una transacción).
- No se borra un tipo que ya se usó: se desactiva.

**establishments**
- `company_id`, `api_branch_id` (ID en la API), `name`, `local_code` char(4), `address`, `ubigeo`, `is_main`.
- Unique: `(company_id, local_code)`.

**document_series**
- `company_id`, `establishment_id`, `api_series_id`, `document_type` (`01|03|07|08`), `applies_to` (`01|03` para notas, nullable), `series` char(4), `next_number` unsigned int, `is_active`, `is_default`.
- Unique: `(company_id, document_type, series)`. Se bloquea con `lockForUpdate` al emitir.

**customers**
- `company_id`, `document_type` (`0|1|4|6|7|A`), `document_number`, `name`, `trade_name`, `address`, `phone`, `email`, `notes`, `deleted_at`.
- Unique: `(company_id, document_type, document_number)`. Índice: `(company_id, name)`.

**vehicles**
- `company_id`, `customer_id` (FK), `plate`, `brand`, `model`, `year` smallint, `color`, `vin` nullable, `engine_number` nullable, `current_mileage` unsigned int, `features` text, `notes` text, `deleted_at`.
- Unique: `(company_id, plate)`. Índice: `(company_id, customer_id)`.

**services**
- `company_id`, `name`, `description`, `price` (con IGV), `igv_affectation` char(2) default `10`, `sunat_product_code` nullable, `subject_to_detraction` boolean default `true`, `detraction_type_id` nullable (FK a `detraction_types`; si es null se usa el predeterminado de la empresa), `is_active`, `deleted_at`.

**products**
- `company_id`, `code`, `name`, `description`, `cost`, `sale_price` (con IGV), `stock` decimal(12,3), `min_stock` nullable, `unit` default `NIU`, `igv_affectation`, `sunat_product_code` nullable, **`image` varchar(255) nullable** (ruta relativa en el disco, nunca binario), `is_active`, `deleted_at`.
- Unique: `(company_id, code)`. Índice: `(company_id, name)`.

**stock_movements**
- `company_id`, `product_id`, `type` (`in|out|adjust|return`), `quantity` (con signo), `balance_after`, `reason`, `source_type` / `source_id` (polimórfico: venta, nota de crédito o ajuste), `user_id`, `created_at`.
- Índice: `(company_id, product_id, created_at)`.

**work_orders**
- `company_id`, `number` (unsigned int, correlativo por empresa), `customer_id`, `vehicle_id`, `assigned_user_id` nullable, `mileage_in`, `reported_problem`, `diagnosis`, `observations`, `status`, `received_at`, `promised_at` nullable, `finished_at`, `delivered_at`, `cancelled_at`, `subtotal`, `igv`, `total`, `created_by`.
- Unique: `(company_id, number)`. Índices: `(company_id, status)`, `(company_id, vehicle_id, received_at)`.
- Los totales son valores derivados que se recalculan en el servicio en cada cambio de ítems.

**work_order_items**
- `work_order_id`, `type` (`service|product|labor`), `service_id` nullable, `product_id` nullable, `description`, `unit`, `quantity`, `unit_price` (con IGV), `igv_affectation`, `line_total`, `sort_order`.
- Regla: `type=service` exige `service_id`, `type=product` exige `product_id` y `labor` no exige ninguno. Validado en el Form Request y con CHECK de MySQL 8.

**sales**
- `company_id`, `number` (`V-000001` por empresa), `work_order_id` nullable **unique**, `customer_id`, `issued_at`, `currency` (`PEN`), `taxable_amount`, `exempt_amount`, `igv`, `total`, `status` (`registered|voided`), `notes`, `created_by`, `voided_at`, `voided_by`.
- Índices: `(company_id, issued_at)`, `(company_id, status)`.

**sale_items**
- `sale_id`, `type`, `service_id` / `product_id` nullable, `code`, `description`, `unit`, `quantity`, `unit_price`, `igv_affectation`, `sunat_product_code`, `subject_to_detraction` (instantánea del servicio; `labor` hereda el valor de la empresa), `subtotal`, `igv`, `total`.

**sale_payments**
- `sale_id`, `method` (`cash|card|yape|plin|transfer`), `amount`, `reference` nullable, `paid_at`.

**electronic_documents**
- `company_id`, `sale_id` nullable, `related_document_id` nullable (NC/ND → documento afectado), `document_type` (`01|03|07|08`), `series`, `number`, `issue_date`, `currency`, `total`, `igv`, `taxable_amount`.
- **Instantáneas:** `customer_document_type`, `customer_document_number`, `customer_name`, `customer_address`, `issuer_ruc`, `issuer_name`, `issuer_address`, `establishment_code`, `environment`.
- NC/ND: `reason_code`, `reason_description`.
- Detracción (nullable): `detraction_code`, `detraction_rate`, `detraction_amount`, `detraction_account`, `detraction_payment_method`, `detraction_override_reason`.
- Integración: `issuance_key` nullable **unique**, `api_document_id` nullable, `api_status`, `local_status`, `sunat_code`, `sunat_message`, `request_payload` json, `last_response` json, `sent_at`, `accepted_at`, `last_checked_at`, `next_check_at`, `check_attempts`, `xml_path` / `cdr_path` (caché privada), `created_by`.
- Unique: `(company_id, document_type, series, number)`. Índices: `(company_id, local_status, next_check_at)`, `(company_id, issue_date)`, `(sale_id)`.

**api_operation_logs**
- `company_id` nullable, `electronic_document_id` nullable, `user_id` nullable, `operation` (`provision|update_company|upload_certificate|issue|status|download|credit_note|...`), `http_method`, `endpoint`, `http_status` nullable, `api_estado`, `api_mensaje`, `request_summary` json (sanitizado), `response_body` text (truncado), `error_type` (`timeout|connection|validation|auth|server|business`), `duration_ms`, `created_at`.
- Índices: `(company_id, created_at)`, `(electronic_document_id)`.

**activity_logs** (auditoría y actividad reciente)
- `company_id` nullable, `user_id`, `action` (`work_order.status_changed`, `sale.created`, `document.issued`, `billing.updated`, `user.created`...), `subject_type` / `subject_id`, `description`, `properties` json, `ip`, `created_at`.

### 10.3 Ajustes respecto a la lista sugerida

| Sugerida | Decisión |
|----------|----------|
| `work_order_details` + `work_order_products` | Se unifican en **`work_order_items`** con `type` |
| `company_billing_configurations` | Pasa a `company_billing_settings` (1:1) |
| `company_certificates` | **Se elimina.** El certificado solo se sube a la API; la fecha de subida y el vencimiento quedan en `company_billing_settings` |
| `establishments`, `document_series`, `api_operation_logs` | Se mantienen |
| — | **Nuevas:** `system_settings` (setup), `stock_movements` (inventario), `sale_payments` (pago mixto) y `activity_logs` (auditoría y actividad reciente) |
| tabla de ítems de comprobante | **No se crea.** Los ítems están en `sale_items` y el envío exacto en `request_payload`. Las NC parciales guardan sus líneas en el payload |

---

## 11. Estructura de carpetas

```
app/
├── Enums/                      WorkOrderStatus, DocumentType, ApiDocumentStatus, LocalDocumentStatus,
│                               IgvAffectation, IdentityDocumentType, PaymentMethod, TaxRegime, UserRole
├── Http/
│   ├── Controllers/
│   │   ├── Setup/              SetupController
│   │   ├── Auth/               (starter kit)
│   │   ├── Admin/              CompanyController, CompanyUserController, CompanySwitchController,
│   │   │                       ProvisioningController, CertificateController, PlanSubscriptionController,
│   │   │                       EnvironmentController, ApiCredentialsController, ApiLogController (super admin)
│   │   ├── Settings/           BillingSettingsController, DetractionSettingsController, DetractionTypeController, SeriesController,
│   │   │                       EstablishmentController, CompanyProfileController, LogoController,
│   │   │                       UserController, AppearanceController
│   │   ├── CustomerController, VehicleController, ServiceController, ProductController, ProductImageController,
│   │   ├── StockAdjustmentController, WorkOrderController, WorkOrderStatusController, SaleController,
│   │   ├── ElectronicDocumentController, DocumentFileController, CreditNoteController,
│   │   ├── VehicleHistoryController, ReportController, DashboardController
│   │   └── Lookup/             DocumentLookupController (RUC/DNI), UbigeoController
│   ├── Middleware/             EnsureSystemInstalled, RedirectIfInstalled, EnsureCompanyContext,
│   │                           EnsureBillingReady, HandleInertiaRequests
│   └── Requests/               {Módulo}/Store…Request, Update…Request
├── Models/                     + Concerns/BelongsToCompany.php
├── Policies/                   una por modelo de negocio
├── Services/
│   ├── Setup/InstallationService.php
│   ├── Tenancy/CurrentCompany.php
│   ├── WorkOrders/WorkOrderService.php, WorkOrderTotals.php
│   ├── Sales/SaleService.php, TaxCalculator.php, DetractionCalculator.php
│   ├── Inventory/StockService.php
│   ├── Media/ProductImageService.php
│   └── SunatApi/               SunatApiClient, SunatApiEndpoints, CompanyProvisioner, CompanyConfigSync,
│                               SubscriptionManager, CredentialManager, DocumentPayloadBuilder,
│                               DocumentIssuer, DocumentStatusSynchronizer, DocumentFileFetcher, LogSanitizer,
│                               Exceptions/*
├── Console/Commands/           SyncPendingDocuments (sunat:sync-pending), PruneApiLogs
config/sunat_api.php
database/migrations, seeders (roles y permisos, servicios demo opcionales)
routes/web.php (agrupado por middleware), routes/setup.php, routes/console.php (schedule)

resources/js/
├── app.tsx, ssr.tsx (opcional)
├── components/
│   ├── ui/                     (generados por shadcn: button, input, table, dialog, sheet, …)
│   ├── data-table/             ResponsiveDataTable, DataTableToolbar, DataTablePagination, ExpandToggle,
│   │                           RowActions, MobileDetailList
│   ├── forms/                  FormField, InputError, MoneyInput, SearchableSelect (Command+Popover),
│   │                           CustomerCombobox, VehicleSelect, DocumentLookupButton, UbigeoSelect
│   ├── media/                  ImageUpload, ProductThumbnail
│   ├── feedback/               ConfirmDialog, StatusBadge (OT, venta, SUNAT), EmptyState, PageSkeleton
│   └── layout/                 AppSidebar, AppHeader, ThemeToggle, CompanySwitcher, PageHeader
├── layouts/                    AppLayout, AuthLayout, SetupLayout, SettingsLayout
├── pages/
│   ├── setup/                  Welcome.tsx (registro del super admin)
│   ├── auth/, dashboard/, customers/, vehicles/, services/, products/, work-orders/ (Index, Create,
│   │   Edit, Show), sales/, documents/, reports/, settings/, admin/companies/
├── hooks/                      useAppearance, useMediaQuery, useDebouncedSearch, useConfirm, useFilters
├── lib/                        utils (cn), money.ts (formato S/), dates.ts
└── types/                      index.d.ts (modelos compartidos y PageProps)
```

---

## 12. Interfaz y componentes shadcn/ui

### 12.1 Tema y color primario

`#4361ee` ≈ `oklch(0.556 0.214 269)`. Contraste con texto blanco: **5.0:1** (cumple WCAG AA).

```css
/* resources/css/app.css — tokens de shadcn (Tailwind 4) */
:root {
  --primary: oklch(0.556 0.214 269);          /* #4361ee */
  --primary-foreground: oklch(0.985 0 0);
  --ring: oklch(0.556 0.214 269);
  --sidebar-primary: oklch(0.556 0.214 269);
  --chart-1: oklch(0.556 0.214 269);
  --radius: 0.5rem;
}
.dark {
  --primary: oklch(0.556 0.214 269);          /* mismo color en botones */
  --primary-foreground: oklch(0.985 0 0);
  --ring: oklch(0.65 0.18 269);               /* anillo de foco un poco más claro */
  --link: oklch(0.72 0.15 269);               /* enlaces de texto más claros (#4361ee sobre fondo oscuro ≈ 3.9:1) */
  /* background, card y muted con un ligero matiz azul frío, sin gradientes */
}
```
El hex nunca se repite en los componentes: siempre se usan `bg-primary`, `text-primary`, `ring-ring`, etc.

**Modo claro/oscuro:** el starter kit trae `useAppearance` (light, dark o system) con cookie y localStorage. Se amplía para **persistir en `users.theme`** al cambiarlo, y el servidor envía la preferencia en las *props* compartidas para evitar el parpadeo en el primer render (clase `dark` en `<html>` desde Blade).

### 12.2 Lineamientos visuales
- Tipografía base de 15–16 px; tablas a 14 px como mínimo; títulos de página de 20–24 px. Fuente Inter o la del starter kit.
- Sin gradientes. Sombras solo `shadow-xs` en popovers y diálogos. Bordes de 1 px `border-border` solo donde separan contenido.
- Hover sutil (`bg-muted/50`), sin escalados ni animaciones llamativas.
- Espaciado: `gap-4` / `gap-6`; páginas con `max-w-7xl`.
- Layout: sidebar plegable (componente `Sidebar` de shadcn) con secciones Operación (Dashboard, Órdenes, Ventas, Comprobantes), Maestros (Clientes, Vehículos, Servicios, Productos), Reportes y Configuración. En móvil la sidebar se abre en un `Sheet`.

### 12.3 Uso de componentes

| Necesidad | Componente shadcn |
|-----------|-------------------|
| Formularios | `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup` (factura o boleta), `Label` + `InputError` |
| Selección con búsqueda (cliente, vehículo, producto) | `Popover` + `Command` (combobox) |
| Fechas y filtros de rango | `Popover` + `Calendar` |
| Crear o editar rápido (vehículo desde OT, pago) | `Dialog` (escritorio) / `Sheet` (móvil) |
| Confirmaciones (eliminar, emitir, anular) | `AlertDialog` vía `ConfirmDialog` + hook `useConfirm` |
| Acciones de fila | `DropdownMenu` |
| Detalle de OT (Resumen / Ítems / Historial) | `Tabs` |
| Estados | `Badge` mediante `StatusBadge` con mapa de colores semánticos |
| Ayudas | `Tooltip` |
| Carga | `Skeleton` + `processing` de Inertia en botones (spinner `Loader2` de Lucide) |
| Notificaciones | `Sonner` (mensajes flash de Laravel → toast) |
| Avisos persistentes (certificado por vencer, configuración incompleta) | `Alert` |

**Formularios:** se usa `useForm` de Inertia (estado, `processing`, `errors` del Form Request) con los componentes de campo de shadcn. No se mezcla con react-hook-form, para tener una sola fuente de validación: el backend. Las validaciones en el cliente se limitan a `required`, `type` y `maxLength` para dar feedback rápido.

**Editor de ítems de OT y venta:** tabla editable con combobox de servicio o producto, cantidad, precio y total por línea. En móvil cada línea se muestra como una tarjeta compacta. Los totales quedan fijos al pie (*sticky*).

---

## 13. Tablas responsive

### 13.1 Componente `ResponsiveDataTable`

```ts
type ColumnDef<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  priority: 'primary' | 'md' | 'lg';   // primary: siempre visible; md: desde tablet; lg: solo escritorio
  mobileLabel?: string;                // etiqueta en el panel expandido
  className?: string;                  // p. ej. 'text-right tabular-nums'
};
// props: data, columns, rowKey, actions(row) → [{label, icon, href|onClick, variant, can}],
//        pagination (paginator de Laravel), filters, emptyState
```
Se apoya en `@tanstack/react-table` para el modelo de columnas y la expansión, y en el `Table` de shadcn para el renderizado.

### 13.2 Comportamiento por breakpoint
- **Escritorio (≥ 1024 px):** todas las columnas y acciones en `DropdownMenu` (o iconos directos ver/editar).
- **Tablet (768–1023 px):** se ocultan las columnas `lg`. Si hay columnas ocultas, aparece el botón de expansión.
- **Móvil (< 768 px):**
  - Primera celda: botón **`+`** (`Plus` de Lucide, 40×40 px, `aria-expanded`, `aria-controls`). Al expandir cambia a **`−`** (`Minus`).
  - Se ven solo las columnas `primary` (2–3, por ejemplo Placa y Cliente).
  - Al expandir se inserta una fila con `colSpan` completo y una lista `<dl>` de dos columnas (etiqueta: valor) con las columnas ocultas, y al final **botones de acción visibles** (Ver, Editar, Eliminar) a ancho completo y altura táctil de 44 px.
  - Se pueden expandir varias filas a la vez (estado `expanded` de TanStack).
- **Sin scroll horizontal de la página:** contenedor `w-full min-w-0 overflow-hidden`, tabla `table-fixed` en móvil, celdas con `truncate` o `break-words`, y `max-w-[...]` en textos largos. La visibilidad de columnas se calcula con `useMediaQuery` para que el panel expandido muestre exactamente lo que está oculto.
- **Filtros y paginación:** en escritorio, búsqueda y filtros en línea. En móvil, búsqueda de ancho completo y botón "Filtros" que abre un `Sheet`; la paginación se reduce a "Anterior · Página 2 de 9 · Siguiente".
- **Datos del servidor:** paginación, búsqueda (con *debounce* de 300 ms) y orden mediante *query string* con `router.get(..., { preserveState: true, replace: true })`. Laravel responde con `paginate()->withQueryString()`.

### 13.3 Columnas prioritarias por módulo (móvil)

| Módulo | Visibles en móvil | Panel expandido |
|--------|-------------------|-----------------|
| Clientes | Nombre, Documento | Teléfono, correo, dirección, nº de vehículos |
| Vehículos | Placa, Marca/Modelo | Cliente, año, color, kilometraje |
| Servicios | Nombre, Precio | Descripción, estado |
| Productos | Miniatura + Nombre, Stock | Código, precio, costo, unidad, estado |
| OT | Nº + Placa, Estado | Cliente, fecha, total, técnico |
| Ventas | Nº, Total | Cliente, fecha, método de pago, comprobante |
| Comprobantes | Serie-Nº, Estado SUNAT | Tipo, cliente, fecha, total, descargas |

---

## 14. Imágenes opcionales de productos

**Base de datos:** `products.image VARCHAR(255) NULL`, con la ruta relativa (`companies/12/products/9f1c…e2.webp`). Nunca se guarda el binario.

**Backend**
- Validación en el Form Request: `['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048', 'dimensions:max_width=4000,max_height=4000']` más `remove_image` boolean.
- `ProductImageService`:
  1. Lee la imagen con Intervention Image. Si no se puede decodificar como imagen real, se rechaza (protege contra extensiones manipuladas y archivos políglotos).
  2. La **re-codifica** a WebP (calidad 80, máximo 1200 px) y elimina los metadatos EXIF.
  3. La guarda con un nombre aleatorio (`Str::uuid()`) en `companies/{company_id}/products/`. El nombre original del usuario nunca se usa.
  4. Genera una miniatura de 160 px (`…_thumb.webp`) para los listados.
- **Reemplazo o eliminación:** la base de datos se actualiza en una transacción y el archivo anterior se borra en `DB::afterCommit()`. Así nunca queda un registro apuntando a un archivo inexistente, y si la transacción falla, se borra el archivo nuevo.
- Al eliminar un producto (soft delete) se conserva la imagen; si se hace *force delete*, se borra.
- **Disco (decidido):** `public` (`storage/app/public/companies/{company_id}/products/`, expuesto con `php artisan storage:link`) y nombres impredecibles (UUID). La URL se genera con `Storage::disk('public')->url($path)`.
- Solo los usuarios con el permiso `products.update` pueden subir imágenes (policy). El servidor web no ejecuta scripts en `storage/` (con PHP-FPM y Nginx/Apache configurados para servir archivos estáticos).
- El modelo expone los *accessors* `image_url` y `thumb_url`, que devuelven `null` si no hay imagen. El frontend muestra entonces un *placeholder*.

**Frontend: `ImageUpload`**
- Zona de clic o arrastre con `Input type=file accept="image/jpeg,image/png,image/webp"`.
- Vista previa inmediata con `URL.createObjectURL` (liberada con `revokeObjectURL`).
- Botones "Cambiar" y "Quitar". "Quitar" sobre una imagen existente envía `remove_image=true`.
- Validación previa en el cliente de tipo y tamaño (solo para la experiencia de usuario).
- Inertia sube archivos como `multipart`. Para editar se usa `POST` con `_method: 'put'`, porque PHP no procesa archivos en PUT.
- `ProductThumbnail`: `aspect-square object-cover rounded-md`, tamaños `size-10` en listados y `w-full max-w-sm` en el detalle, con *placeholder* (icono `ImageOff` o `Package` de Lucide sobre `bg-muted`) si no hay imagen. Usa `loading="lazy"`.

---

## 15. Autenticación, Setup Wizard y permisos

### 15.1 Setup Wizard (primer super admin)

**Componentes**
- `InstallationService::isInstalled()`: devuelve `true` si existe un usuario con rol `super_admin` o si `system_settings.installed_at` no es nulo. Ambas condiciones se mantienen sincronizadas. Se guarda en caché con `Cache::rememberForever('system.installed')` y la caché se invalida al completar el setup.
- Middleware **`EnsureSystemInstalled`** (global en el grupo `web`, excepto en las rutas `setup.*` y los assets): si el sistema no está instalado, redirige a `/setup`.
- Middleware **`RedirectIfInstalled`** (solo en `/setup`): si el sistema está instalado, responde con **404** (para no revelar que la ruta existe) o redirige a `/login`.
- `SetupController@show` (GET `/setup`) y `@store` (POST `/setup`, con `throttle:5,1`).
- `StoreSuperAdminRequest`: `first_name` y `last_name` (`required|string|max:100`), `email` (`required|email:rfc,dns|max:255|unique:users`), `password` (`required|confirmed|Password::min(10)->letters()->mixedCase()->numbers()->symbols()->uncompromised()`). Usa `validated()` y **no acepta `role` ni ningún otro campo**.

**Creación segura frente a concurrencia**
```
DB::transaction(function () {
    $settings = SystemSetting::whereKey(1)->lockForUpdate()->firstOrFail(); // fila sembrada por la migración
    if ($settings->installed_at !== null || User::role('super_admin')->exists()) {
        abort(404);                                    // otro proceso ganó la carrera
    }
    $user = User::create([... 'password' => Hash::make(...), 'company_id' => null]);
    $user->assignRole('super_admin');                  // asignado solo en el backend
    $settings->update(['installed_at' => now(), 'installed_by_user_id' => $user->id]);
});
Cache::forget('system.installed'); Auth::login($user); $request->session()->regenerate();
→ redirect('/admin/companies/create')  // siguiente paso: crear el primer taller
```
- El `SELECT … FOR UPDATE` sobre la fila única serializa las peticiones simultáneas: la segunda espera, encuentra `installed_at` ya informado y falla. `users.email` UNIQUE es una segunda barrera.
- Los roles se crean en una **migración o seeder idempotente** (`firstOrCreate`) para que existan antes del setup.
- **Reinstalación:** con una base de datos nueva, la migración vuelve a sembrar `system_settings` con `installed_at = null`, así que el wizard reaparece sin tocar código.
- **Pantalla:** `SetupLayout` centrado, con tarjeta, logo, título "Configuración inicial" y los cinco campos. Incluye un botón para mostrar u ocultar la contraseña (`Eye` / `EyeOff`), un indicador de requisitos de contraseña, mensajes de error por campo y un botón con estado de carga. Es responsive.

### 15.2 Autenticación
- Login, logout, recuperación de contraseña y verificación de correo (opcional) del starter kit. **Se elimina el registro público.**
- Usuarios inactivos (`is_active=false`) o de empresas suspendidas no pueden iniciar sesión.
- `throttle` en el login (el starter kit ya limita los intentos).

### 15.3 Roles y permisos (spatie, guard `web`)

| Rol | Alcance | Permisos principales |
|-----|---------|----------------------|
| `super_admin` | Plataforma (`company_id` null) | Empresas, usuarios de cualquier empresa, aprovisionamiento API, **certificado digital y Clave SOL**, **plan y suscripción**, **entorno beta/producción**, rotación o recuperación de credenciales, eliminación del tenant, logs de API, entrar a una empresa |
| `company_admin` | Su empresa | Todo lo de su empresa: datos fiscales y de contacto, logo, régimen, establecimientos, series, detracción y usuarios. Ve sin poder modificar el plan, el entorno y el estado del certificado |
| `cashier` (caja/recepción) | Su empresa | Clientes, vehículos, OT, ventas, emisión de comprobantes y NC, reportes |
| `mechanic` (técnico) | Su empresa | Ver OT asignadas, registrar diagnóstico e ítems, cambiar el estado hasta `finalizada`, consultar el historial del vehículo |

Permisos granulares con el formato `modulo.accion` (`work_orders.update`, `documents.issue`, `documents.credit_note`, `billing.manage`, `billing.certificate`, `billing.plan`, `billing.environment`, `products.update`...), verificados en las policies y expuestos a React como `auth.can` (lista booleana) **solo para mostrar u ocultar botones**. La autorización real siempre está en el backend.

### 15.4 Grupos de rutas

```
web:  EnsureSystemInstalled
 ├─ /setup                       RedirectIfInstalled, guest
 ├─ /login …                     guest
 └─ auth, active
     ├─ /admin/*                 role:super_admin
     └─ EnsureCompanyContext
         ├─ /dashboard, /customers, /vehicles, /work-orders, /sales, …
         └─ EnsureBillingReady → /sales/{sale}/documents (emitir), /documents/{doc}/credit-note
```

---

## 16. Seguridad

| Área | Medida |
|------|--------|
| Credenciales de la API | `api_key`/`api_secret` cifrados (`encrypted` cast), en `$hidden`, nunca en *props* de Inertia ni en logs. `LogSanitizer` enmascara las claves `X-Api-*`, `api_secret`, `sol_pass`, `contrasena_certificado` y `certificado`. Se configura `config/logging` y la excepción de `Http` para no volcar cabeceras |
| Certificado y Clave SOL | No se guardan en Laravel: se reenvían a la API, que los valida y cifra. Subida solo por el super admin, con `throttle`. No se escriben en logs (`LogSanitizer`) |
| Multiempresa | Global scope + policies + `Rule::exists` con `company_id` + `scopeBindings`. Pruebas automáticas de acceso cruzado (§19) |
| Autorización | Policies en todos los controladores (`authorize` / `can` middleware). Nada depende de ocultar botones |
| Validación | Form Requests en todas las escrituras. Los totales se recalculan en el servidor y se ignoran los que envía el cliente |
| Archivos | Validación de MIME real, re-codificación, nombres aleatorios, tamaño máximo y discos separados (`public` para imágenes, `local` para XML/CDR). Las descargas de comprobantes pasan por un controlador con policy y nunca exponen una ruta directa |
| Concurrencia | `lockForUpdate` en el setup, en las series y en la venta al emitir. Restricciones UNIQUE en base de datos |
| Sesión y web | CSRF (Inertia lo maneja), cookies `secure`, `http_only` y `same_site=lax`, `session()->regenerate()` al iniciar sesión, cabeceras de seguridad (CSP básica, `X-Frame-Options`, `Referrer-Policy`) mediante middleware |
| Fuerza bruta | `throttle` en login, setup, búsqueda RUC/DNI (para no agotar el cupo de la API) y emisión |
| Auditoría | `activity_logs` para el setup, inicios de sesión de administradores, cambios fiscales, certificados, emisión, NC, anulación de ventas y cambios de rol |
| Webhook (futuro) | URL con `company.uuid`, verificación de firma y que solo dispare una consulta GET; nunca confía en el contenido |
| Producción | `APP_DEBUG=false`, `APP_KEY` respaldada (sin ella se pierden las credenciales cifradas), HTTPS obligatorio y respaldos de MySQL |

---

## 17. Plan de implementación por fases

> Se añade una **Fase 0** porque la colección no tiene respuestas de ejemplo; sin ella el cliente HTTP se construiría sobre suposiciones.

### Fase 0 — Verificación de la API (antes de programar la integración)
- **Objetivo:** convertir las incógnitas (§2.3, §8.4, §2.10) en hechos.
- **Tareas:** con una empresa de prueba en `entorno=beta`, ejecutar y **guardar las respuestas reales** (como *examples* en Postman) de: `/registro`, `GET/PUT /empresa`, `/empresa/certificado`, `/sucursales`, `/series`, `/buscar-documento`, `POST /facturas`, `POST /boletas` (básica y consumidor final), `GET /facturas/{id}` en cada estado, `GET /facturas?serie&correlativo`, `/enviar`, `/pdf` (con `format` y con `formato`), `/xml`, `/cdr`, `POST /notas-credito`, `/sunat/estado`, y respuestas de error (422, credenciales inválidas, duplicado de serie+correlativo, certificado inválido).
- **Preguntas a resolver:** ¿hay cabecera de idempotencia?; ¿se valida la unicidad de `serie+correlativo`?; ¿`client_id`/`client_secret` son obligatorios?; ¿cómo se actualiza la Clave SOL?; ¿formato del webhook?; ¿campo de observaciones o leyendas?; ¿qué correo usa `/credenciales/recuperar`?
- **Resultado:** documento `docs/api-contrato.md` con los campos reales de `datos`, y la colección actualizada con *examples*.
- **Terminada cuando:** cada endpoint marcado MVP en §3 tiene una respuesta real documentada.
- *Puede hacerse en paralelo con las fases 1–3.*

### Fase 1 — Base, Setup Wizard, autenticación y diseño
- **Objetivo:** esqueleto funcional, seguro y con el sistema de diseño listo.
- **Funcionalidades:** instalación, setup del super admin, login, layout, tema claro/oscuro, componentes base y tabla responsive.
- **Backend:** proyecto Laravel con el starter kit React, MySQL y zona horaria `America/Lima`; migraciones `users` (ajustada), `system_settings`, permisos (spatie) y `activity_logs`; `InstallationService`, `EnsureSystemInstalled`, `RedirectIfInstalled`, `SetupController` y `StoreSuperAdminRequest`; eliminación del registro público; seeder de roles; `users.theme`.
- **Frontend:** tokens con `#4361ee`, `AppLayout` con sidebar, `ThemeToggle` persistente, página `setup/Welcome`, `ResponsiveDataTable`, `ConfirmDialog`, `StatusBadge`, `PageHeader`, `FormField`/`InputError`, toasts con Sonner y `EmptyState`.
- **Tablas:** `users`, `system_settings`, `roles`/`permissions`, `activity_logs`.
- **Dependencias:** ninguna.
- **Terminada cuando:** con la base de datos vacía `/` lleva a `/setup`; tras el registro inicia sesión y `/setup` devuelve 404; una prueba de concurrencia (dos POST simultáneos) crea un solo super admin; el tema persiste por usuario; la tabla de demostración funciona en 360 px sin scroll horizontal.

### Fase 2 — Empresas, usuarios, multiempresa y configuración fiscal
- **Objetivo:** que un taller quede habilitado para facturar, configurado **por completo desde el sistema**.
- **Funcionalidades:** CRUD de empresas (super admin), usuarios por empresa, selector de empresa para el super admin, flujo de alta de §9.2, **pantallas de configuración de la API de §9.5** (aprovisionamiento, certificado y SOL, plan y suscripción, entorno beta/producción, régimen avanzado, credenciales, diagnóstico, zona de peligro), configuración del taller (empresa, logo, fiscal, establecimientos, series, detracción), prueba de conexión y estado de configuración.
- **Backend:** `companies`, `company_billing_settings`, `establishments`, `document_series`; trait `BelongsToCompany`, `CurrentCompany`, `EnsureCompanyContext`, `EnsureBillingReady`; `SunatApiClient` (versión base), `CompanyProvisioner`, `CompanyConfigSync`, `SubscriptionManager`, `CredentialManager`, `LogSanitizer` y `api_operation_logs`; `UbigeoController` y `DocumentLookupController` (proxy de la API con *throttle*); aviso programado de vencimiento del certificado.
- **Frontend:** `admin/companies/Show` con las pestañas de §9.5, `settings/*` del taller (incluida Detracción), `UbigeoSelect`, subida del PFX (solo super admin), diálogo "Pasar a producción" con lista de verificación, panel de solo lectura para el taller (plan, uso, entorno y certificado) y `CompanySwitcher`.
- **Dependencias:** Fase 1 y respuestas de `/registro` de la Fase 0 (o un *mock* con `Http::fake` mientras tanto).
- **Terminada cuando:** se aprovisiona un taller en beta de principio a fin; las credenciales no aparecen en ninguna respuesta HTTP ni en logs (verificado con prueba); un usuario de la empresa A no puede ver ni modificar nada de la B (pruebas de policy); reemplazar el certificado funciona y solo el super admin puede hacerlo; el plan se asigna y cambia por taller; el paso beta → producción y la vuelta funcionan con confirmación y quedan auditados; cada pantalla de §9.5 ejecuta su endpoint sin usar Postman; la prueba de conexión informa de forma clara del éxito o del error.

### Fase 3 — Clientes, vehículos, servicios y productos
- **Objetivo:** maestros del taller.
- **Backend:** `customers`, `vehicles`, `services`, `products`, `stock_movements`; controladores, requests y policies; `StockService` (ajustes); `ProductImageService`; validación de RUC (módulo 11) y DNI; normalización de placas.
- **Frontend:** listados responsive con búsqueda y filtros; formularios con `DocumentLookupButton` (RUC/DNI); ficha de cliente con sus vehículos; `ImageUpload` y `ProductThumbnail`; diálogo de ajuste de stock; alerta de stock mínimo.
- **Dependencias:** Fase 2 (multiempresa).
- **Terminada cuando:** CRUD completo en los 4 módulos; un producto se guarda con o sin imagen; reemplazar o quitar una imagen borra el archivo anterior; un archivo `.php` renombrado a `.jpg` es rechazado; las tablas pasan la revisión en móvil.

### Fase 4 — Órdenes de trabajo
- **Objetivo:** el flujo operativo del taller.
- **Backend:** `work_orders`, `work_order_items`; `WorkOrderService` (creación, ítems, totales, máquina de estados con transiciones válidas), `TaxCalculator`, `WorkOrderStatusController`, y actualización del kilometraje del vehículo.
- **Frontend:** `work-orders/Create|Edit` con `CustomerCombobox` → `VehicleSelect` (con alta rápida en `Dialog`), editor de ítems (servicio, producto o mano de obra), totales en vivo, `Show` con `Tabs` (Resumen, Ítems, Historial) y cambio de estado con nota; hoja imprimible.
- **Dependencias:** Fase 3.
- **Terminada cuando:** se recorre la OT de `pendiente` a `finalizada`; las transiciones inválidas son rechazadas por el backend; los totales del servidor coinciden con los de la UI; una OT finalizada ya no se puede editar.

### Fase 5 — Ventas
- **Objetivo:** cobro y registro comercial.
- **Backend:** `sales`, `sale_items`, `sale_payments`; `SaleService::fromWorkOrder()` y `::direct()` (transacción: copia de ítems, pagos, descuento de stock y bloqueo de la OT); anulación de venta sin comprobante (devuelve stock).
- **Frontend:** botón "Generar venta" en la OT, formulario de venta directa, registro de pagos (mixto), listado e historial, detalle con el bloque "Comprobante" (vacío hasta la Fase 6).
- **Dependencias:** Fase 4.
- **Terminada cuando:** una OT genera exactamente una venta (UNIQUE probado); el stock baja una sola vez; la suma de pagos se valida; la venta directa funciona.

### Fase 6 — Integración SUNAT (comprobantes)
- **Objetivo:** emisión electrónica confiable.
- **Backend:** `electronic_documents`; `DocumentPayloadBuilder` (factura y boleta desde la venta, NC desde un comprobante), `DetractionCalculator` y bloque `detraccion` (§8.8), `DocumentIssuer` (§8.4), `DocumentStatusSynchronizer`, `DocumentFileFetcher`, comando `sunat:sync-pending` + Scheduler, `ElectronicDocumentController` (emitir, estado, verificar, reintentar), `DocumentFileController` (pdf, xml y cdr con policy) y `CreditNoteController` (motivo 01 de anulación total; 07 de devolución parcial con reingreso de stock opcional).
- **Frontend:** diálogo "Emitir comprobante" (Factura o Boleta, validaciones de RUC y del tope de S/ 700, sección de detracción con selector de tipo, porcentaje editable y monto en vivo (opción de excluirla con motivo), aviso si `/sunat/estado` no está disponible), tarjeta de estado con `StatusBadge` y mensaje SUNAT, botones de descarga (PDF A4 / ticket 80 mm, XML, CDR) habilitados según el estado, "Actualizar estado", "Verificar en la API" para `unknown`, listado de comprobantes, formulario de NC y vista de la respuesta de la API (solo administradores).
- **Dependencias:** Fase 5 y **Fase 0 terminada**.
- **Terminada cuando:** en beta, una factura y una boleta llegan a `aceptado`; una factura de servicio mayor al umbral se acepta con detracción y una menor no la lleva; se descargan PDF, XML y CDR; un doble clic o dos pestañas no generan dos comprobantes; un timeout simulado (`Http::fake` con `ConnectionException`) deja el documento en `unknown` sin reenviarlo y "Verificar" lo recupera; una NC de anulación se acepta y marca el original como anulado; ningún log contiene secretos.

### Fase 7 — Dashboard, historial y reportes
- **Objetivo:** visibilidad del negocio.
- **Backend:** `DashboardController` (consultas agregadas con índices adecuados y caché corta de 60 s), `VehicleHistoryController` y `ReportController` (6 reportes + exportación CSV *streamed*); opcionalmente, un proxy al Excel de registro de ventas de la API.
- **Frontend:** dashboard sobrio (§6.1), línea de tiempo del vehículo, páginas de reportes con filtro de fechas (`Calendar`) y tablas responsive.
- **Dependencias:** Fases 4–6.
- **Terminada cuando:** las cifras del dashboard cuadran con los reportes; el historial muestra todas las OT de una placa; las exportaciones se abren correctamente en Excel (UTF-8 con BOM).

### Fase 8 — Pruebas, seguridad y optimización
- **Pruebas (Pest):** unitarias (`TaxCalculator`, transiciones de OT, `DocumentPayloadBuilder` comparado con los JSON de la colección, `LogSanitizer`); de feature (setup y concurrencia, aislamiento entre empresas en cada módulo, policies por rol, carga de imágenes válidas y maliciosas, emisión con `Http::fake` para éxito, 422, timeout, rechazo y duplicado); integración opcional contra beta con un `@group` separado.
- **Responsive:** revisión manual o con Playwright en 360, 768 y 1280 px, en ambos temas.
- **Rendimiento:** *eager loading* (evitar N+1, con `Model::preventLazyLoading()` en desarrollo), índices revisados con `EXPLAIN`, paginación en todos los listados y *props* de Inertia mínimas.
- **Seguridad:** revisión de §16, `composer audit` / `npm audit`, cabeceras de seguridad, CSP.
- **Terminada cuando:** se cumple el checklist de §19 y el flujo completo OT → venta → factura aceptada → NC funciona en beta.

### Fases posteriores al MVP (en orden sugerido)
1. Corrección de rechazados con `PUT /{tipo}/{id}`.
2. Nota de débito.
3. Comunicación de baja (facturas) y anulación de boletas por resumen diario.
4. Venta a crédito con cuotas (`forma_pago=Credito`) y cuentas por cobrar.
5. Webhook (cuando esté documentado).
6. Logo en los PDF (`/empresa/logo`).
7. Código de producto SUNAT con buscador de catálogo.
8. Anexos (sucursales adicionales) y series por establecimiento.
9. Uso del plan (`/suscripcion/uso`) en el panel del super admin.

---

## 18. Riesgos técnicos y recomendaciones

| # | Riesgo | Prob./Impacto | Mitigación |
|---|--------|---------------|------------|
| R1 | La colección no tiene respuestas: el cliente HTTP podría leer campos equivocados | Alta / Alta | Fase 0 obligatoria. Encapsular la lectura de `datos` en un DTO (`ApiDocumentResult`) para cambiar el mapeo en un solo lugar |
| R2 | Comprobante duplicado por timeout | Media / Alta | §8.4: UNIQUE, bloqueos, correlativo explícito, sin reintentos automáticos de POST y verificación por serie+correlativo |
| R3 | Desfase de correlativos entre Laravel y la API | Media / Media | Confirmarlo en la Fase 0. Si la API debe controlar los correlativos, no enviar `correlativo` y leerlo de la respuesta; ajustar §8.4 según la alternativa indicada |
| R4 | `/registro` crea el tenant pero se pierde la respuesta (el *secret* no se puede recuperar) | Baja / Alta | Timeout amplio en ese único POST; registrar en `api_operation_logs` sin el secret; procedimiento de recuperación del super admin (`/credenciales/recuperar` o `bridge`); estado `provisioning_error` visible |
| R5 | La recuperación de credenciales envía un token por correo: si el correo es del taller, este podría obtener las credenciales | Media / Media | Confirmar a qué correo se envía. Si es configurable, registrar un correo de la plataforma; o aceptar el riesgo, ya que las credenciales son del propio tenant |
| R6 | Pérdida de `APP_KEY` → credenciales cifradas ilegibles | Baja / Alta | Respaldar `APP_KEY` en un gestor de secretos; documentar la rotación (`APP_PREVIOUS_KEYS`) |
| R7 | Certificado vencido → rechazos masivos | Media / Alta | Copiar `certificate_valid_to` desde `GET /empresa` (si la API lo devuelve) y avisar a 30, 15 y 7 días. Si la API no lo informa, pedir al dueño de la API que lo exponga |
| R8 | Montos con decimales (redondeo IGV distinto a la API) | Media / Media | Precios con IGV como la API; tomar los totales oficiales de la respuesta de la API una vez creado el documento; pruebas con casos límite |
| R9 | Detracción mal calculada (código, porcentaje, redondeo, ventas mixtas de repuestos y servicios) | Media / Alta | Incluida en el MVP (§8.8). Tipos y porcentajes los administra cada taller y se eligen al emitir; el backend recalcula el monto y valida el tipo; se verifica en la Fase 0 cómo calcula y valida la API el `monto`; pruebas con casos límite (S/ 700.00 y S/ 700.01, venta mixta) |
| R15 | Pasar a producción por error o con datos de prueba | Baja / Alta | Solo el super admin; diálogo con lista de verificación y confirmación; series distintas recomendadas; auditoría |
| R10 | Cambio de la Clave SOL no documentado | Media / Media | Pedir al dueño de la API el endpoint o campo; mientras tanto, procedimiento del super admin |
| R11 | Inconsistencia `formato` / `format` en el PDF | Alta / Baja | Usar `format` (mayoritario) y verificar en la Fase 0 |
| R12 | Agotar el cupo del plan con búsquedas RUC/DNI (si cuentan como uso) | Baja / Media | *Throttle* + caché local de 30 días de las búsquedas |
| R13 | Scheduler no configurado en el hosting → estados `enviado` sin actualizar | Media / Baja | El botón manual siempre funciona; la configuración de fiscal muestra la "última sincronización" |
| R14 | Alcance que crece hacia un ERP | Media / Media | Mantener la lista "fuera de alcance" de §3.4 y §17 como contrato |

---

## 19. Checklist de validación

**Instalación y acceso**
- [ ] Con la base de datos vacía, cualquier URL redirige a `/setup`.
- [ ] El setup valida nombres, correo único, contraseña segura y confirmación; tiene botón de ver/ocultar contraseña.
- [ ] El rol `super_admin` se asigna en el backend; enviar `role` en el POST no tiene efecto.
- [ ] Tras el setup inicia sesión automáticamente y redirige al siguiente paso.
- [ ] `/setup` (GET y POST) devuelve 404 o redirige una vez instalado.
- [ ] Dos POST simultáneos crean un solo super admin.
- [ ] No hay registro público; los usuarios inactivos no pueden iniciar sesión.

**Multiempresa y configuración fiscal**
- [ ] El taller no ve campos de API Key/Secret en ninguna pantalla.
- [ ] Toda la configuración de la API (registro, empresa, régimen, logo, certificado, sucursales, series, plan/suscripción, entorno y credenciales) se hace desde el sistema.
- [ ] Solo el super admin sube o renueva el certificado, asigna o cambia el plan y cambia beta ⇄ producción (el admin del taller recibe 403).
- [ ] El taller agrega, edita el porcentaje, desactiva y marca como predeterminado sus tipos de detracción.
- [ ] Al emitir una factura se puede elegir el tipo y cambiar el %; el monto se recalcula en la UI y el backend lo vuelve a calcular; el bloque `detraccion` usa el tipo y el % elegidos.
- [ ] Factura menor al umbral o boleta → sin detracción sugerida; excluir una detracción sugerida exige un motivo; un tipo de otra empresa es rechazado.
- [ ] Cambiar el % de un tipo no altera los comprobantes ya emitidos.
- [ ] Las credenciales no aparecen en *props* de Inertia, respuestas JSON ni logs.
- [ ] El certificado se sube a la API y no queda ninguna copia en `storage` ni en la base de datos; los errores de la API se muestran en el formulario.
- [ ] El aprovisionamiento crea el tenant, el establecimiento y las series en la API.
- [ ] La prueba de conexión muestra éxito o un error comprensible.
- [ ] Se muestran el estado de configuración, la última actualización y el vencimiento del certificado.
- [ ] Los usuarios de la empresa A obtienen 403/404 al acceder por URL a recursos de la empresa B (todos los módulos).

**Maestros**
- [ ] CRUD de clientes con autocompletado RUC/DNI; validación de RUC (módulo 11) y DNI.
- [ ] Vehículos asociados a un cliente; placa única por empresa.
- [ ] CRUD de servicios con precio y estado.
- [ ] Producto sin imagen se guarda y muestra el *placeholder*.
- [ ] Imagen JPG, PNG o WEBP: vista previa, guardado, reemplazo (borra la anterior) y eliminación.
- [ ] Archivo con extensión falsa o mayor de 2 MB rechazado por el backend.
- [ ] Los ajustes de stock generan un movimiento con motivo.

**Operación**
- [ ] OT: cliente → vehículo → kilometraje → problema → diagnóstico → ítems (servicio, repuesto y mano de obra) → totales.
- [ ] Las transiciones de estado inválidas son rechazadas; el historial de estados es visible.
- [ ] La venta desde una OT finalizada es única; también funciona la venta directa.
- [ ] Pago mixto validado; el stock se descuenta una sola vez.

**Comprobantes**
- [ ] Factura con RUC y boleta con DNI o consumidor final (< S/ 700) llegan a `aceptado` en beta.
- [ ] Doble clic o dos pestañas no generan dos comprobantes.
- [ ] Un timeout deja el comprobante en `unknown`; "Verificar" lo resuelve sin reenviar.
- [ ] Rechazado: se ve el mensaje SUNAT y se puede reenviar con `/enviar`.
- [ ] PDF A4 y ticket, XML y CDR descargables solo por usuarios autorizados de la misma empresa.
- [ ] NC de anulación aceptada y comprobante original marcado como anulado.
- [ ] `sunat:sync-pending` actualiza estados sin crear ni reenviar comprobantes.
- [ ] No existen Jobs, Queues ni Workers para comprobantes.

**Reportes, interfaz y calidad**
- [ ] Historial por vehículo completo.
- [ ] Los 6 reportes filtran por fechas y exportan CSV.
- [ ] Dashboard con 4 indicadores, estados de OT, actividad reciente y resumen de comprobantes.
- [ ] `#4361ee` aplicado solo mediante tokens; modo claro/oscuro persistente por usuario.
- [ ] Todas las tablas: sin scroll horizontal a 360 px, botón `+`/`−`, acciones accesibles y filtros en `Sheet`.
- [ ] Textos legibles (≥ 14 px en tablas), sin gradientes ni sombras exageradas.
- [ ] Suite de Pest en verde, incluidas las pruebas de aislamiento y concurrencia.

---

## 20. Recomendación final y orden de desarrollo

**Arquitectura recomendada:** monolito modular Laravel + Inertia/React (starter kit oficial), con multiempresa por `company_id` (global scope + policies), un **módulo de integración `SunatApi` aislado** (cliente HTTP por empresa, constructor de payloads, emisor con protección contra duplicados y sincronizador de estados de solo lectura) y **cero colas** para comprobantes. La API SUNAT es la fuente de verdad fiscal. Laravel guarda instantáneas inmutables de lo emitido y una bitácora completa de cada llamada.

**Orden para tener pronto una versión funcional:**

```
Semana 1–2   Fase 1  Base + Setup Wizard + diseño + tabla responsive
             Fase 0  (en paralelo) Contrato real de la API en beta
Semana 3     Fase 2  Empresas, usuarios, multiempresa, configuración fiscal y aprovisionamiento
Semana 4     Fase 3  Clientes, vehículos, servicios y productos (con imagen y stock)
Semana 5–6   Fase 4  Órdenes de trabajo
Semana 6     Fase 5  Ventas
Semana 7–8   Fase 6  Factura, boleta, estado, PDF/XML/CDR y NC de anulación  ← MVP utilizable
Semana 9     Fase 7  Dashboard, historial y reportes
Semana 10    Fase 8  Pruebas, seguridad y responsive final
Después      Post-MVP: PUT de rechazados → ND → baja/resumen → crédito (con detracción) → webhook
```
*(Las semanas son orientativas para una persona a tiempo completo.)*

**Decisiones tomadas:** toda la configuración de la API desde el sistema; el certificado (y la Clave SOL) lo sube el super admin y solo se reenvía a la API, sin guardarse en Laravel; plan asignado por taller; el super admin cambia beta/producción; detracción incluida en el MVP; imágenes de productos en `storage` público.

La detracción es **dinámica**: cada taller administra sus tipos y porcentajes, y el usuario elige el tipo y el % al emitir cada factura. La lista inicial que se siembra es solo un punto de partida editable.

No quedan decisiones de diseño pendientes. Lo siguiente es la Fase 1 y, en paralelo, la Fase 0.
