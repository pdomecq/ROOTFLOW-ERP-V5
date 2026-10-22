# Historial de versiones del ERP

Hasta la V80 los cambios se hacían en el chat de Claude y se subían a mano a GitHub. Desde la V81 se hacen con Claude Code directamente sobre este repositorio.
Los SQL de cada versión están en `supabase/sql/historico/`. "Ejecutado" = comprobado en la base de datos el 22-oct-2026.

## V71 – V80 (septiembre–octubre 2026)

| Versión | Cambio | SQL |
|---|---|---|
| V80 | **Compras a particulares (Wallapop)** en Gastos → 🛒 Compras a particulares: contrato de compraventa prerrellenado o en blanco (1 A4), gasto automático con IVA 0 % y proveedor "Particulares (Wallapop)" con su asiento, subida de contrato firmado y justificante, ITP 4 % con plazo de 30 días hábiles, ayuda para el modelo 600 y gasto del ITP (631) al marcarlo presentado, aviso en alertas 7 días antes. Además: las categorías CAPEX van a su cuenta (213/216/217) en el asiento automático, y se quitó un `)}` suelto en Producción → Recetas. | V80-COMPRAS-PARTICULARES (ejecutado) |
| V79 | Descuentos por rango de fechas por cliente (`clientes.descuentos_fechas`, p. ej. 20 % hasta el 20-sep) y corrección de facturas existentes (quitar portes, aplicar descuento) con el modal "Corregir factura". | V79-DESCUENTOS-FECHAS (ejecutado) |
| V78 | Ausencias del calendario mejoradas y PDF mensual imprimible para organizar sobre todo viernes, sábados y domingos. | — |
| V77 | Arreglo de "Cobrar" en Seguimiento de cobros ("Cobro registrado para factura undefined"): estado `pagada`, uso de `factura.id`, comprobación de errores y reutilización del asiento de cobro. | V77-FIX-COBROS (la columna `facturas.fecha_cobro` existe) |
| V76 | Portes por cliente (`clientes.coste_porte`, `porte_gratis_desde`), por albarán (`albaranes.coste_envio`) y en facturas (`facturas.portes_importe`). | V76-PORTES (ejecutado) |
| V75 | Exportación a Excel de los gastos pagados como deuda a socio con lo que ha aportado cada socio en cada gasto (sin mezclar aportaciones a FFPP). | — |
| V74 | Etiquetas de mezclas (Micromezclum) con la lista de variedades que la componen. Tabla `mezclas`. | V74-MEZCLAS (ejecutado) |
| V73 | Arreglo del error `duplicate key value violates unique constraint albaranes_pkey`: IDs con `generarIdSecuencial` + `insertarConIdUnico` (también facturas, presupuestos, lotes y asientos). | — |
| V72 | Las tarifas por cliente no llegaban a las facturas: pedidos y recurrentes usan `getPrecioCliente`; botones para recalcular facturas ya emitidas con las tarifas actuales; revisión completa del cálculo de la factura. | — |
| V71 | Aviso diario a las 9:00 a Guzmán (Slack + email g.greus@rootflow.es) con los gramos a sembrar por variedad según los pedidos abiertos. Incluye la Edge Function `siembra-diaria` y un respaldo al abrir la app. | V71-SIEMBRA-DIARIA (**sin ejecutar**, ver PENDIENTES) |

## Versiones anteriores (resumen por el SQL de cada una)

- V69 Desarrollo (pipeline de financiación y colaboradores con historial de interacciones) · V70 Aportaciones a FFPP por socio y panel de equilibrio en Deuda socios.
- V66 Reparto de gastos entre socios · V64 Insumos y notas de kilometraje · V63 Facturación agrupada · V60 Notas de clientes.
- V58 Albaranes · V57 Presupuestos · V56 Slack · V54 Planificación de producción · V52 Muestras + SEPA · V51 Cobros y etiquetas.
- V48 Costes · V47 Reembolsos a socios · V45 Nevera · V44 Fases productivas · V42 Eventos de calendario · V41 Racks y bandejas · V40 Seguimiento de leads.
- V38 Recibos TPV · V36 Documentos corporativos · V34 SEPA y mora · V31 Extractos bancarios y justificantes · V30 Tareas.
- V29 Arreglo de ausencias · V28 Notificaciones, recetas y turnos · V27 Arreglo de muestras · V25 Movimientos de stock · V23 Producción por bandejas y ausencias de socios · V22 Variedades · V21 Arreglos · V20 Emails (Resend) · V19 Contactos · V18 Turnos · V15–V17 base del ERP actual.
