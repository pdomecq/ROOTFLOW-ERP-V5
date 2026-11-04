# Guía de producción, stock y aprovisionamientos (para Guzmán)

En el ERP hay **dos stocks**, y cada uno se actualiza solo si se registra lo que pasa en la granja:

| Qué | Dónde se ve | Qué lo mueve |
|---|---|---|
| **Producto** (granel cosechado y tarrinas en nevera) | Producción → Lotes / Empaquetado / Fases | Cosechar un lote, empaquetar, mermas |
| **Materiales** (semillas, sustrato, envases, etiquetas) | Rentabilidad → 📦 Aprovisionamientos | Facturas de compra (entran solas), lotes sembrados, unidades entregadas y recuentos |

La sección **«Insumos»** del menú es la antigua y está vacía: **no la uses**, todo está en Aprovisionamientos.

**Regla de oro:** el stock no se escribe a mano. Se registra lo que pasa (siembra, cosecha, empaquetado, merma) y, una vez al mes, se hace un **recuento** con lo que hay de verdad. La diferencia la apunta el ERP como merma.

## 1. Sembrar
- Producción → **Nuevo lote**: variedad, **bandejas que siembras de verdad** y fecha de siembra.
- Un lote por variedad y día. Si no hay lote, para el ERP no se ha sembrado: no gasta semilla ni sustrato y no habrá cosecha.
- Si al final siembras menos bandejas de las previstas, edita el lote ese mismo día.

## 2. Fases y cosecha
- Producción → **Fases**: pasa los lotes de germinación a crecimiento con el botón.
- Al cosechar: Producción → **Lotes** → ✓ **Cosechar**. Se suman los gramos al granel de esa variedad.
- Ojo: suma los **gramos por bandeja de la ficha de la variedad**, no lo que pesas. Pesa varias bandejas de cada variedad y pon la media real en su ficha: Productos → Variedades → ✏️ → «Gramos por bandeja (cosechables)».

## 3. Empaquetar y mermas
- Producción → **Empaquetado**: eliges el granel, el formato (5 g, 15 g, 30 g…) y las unidades. Pasa del granel a tarrinas en nevera. Si es para un pedido concreto, elígelo.
- Lo que se tira (no da la calidad, se pasa en nevera) se apunta con **Merma** en el mismo sitio. Si no se apunta, el ERP cree que sigue ahí.

## 4. Materiales (Aprovisionamientos)
- **Compras:** entran solas cuando Peri registra la factura del proveedor. Si una factura sale como «Sin desglose», pulsa **Leer con IA** (o **+ Línea** a mano). Cuando llegue un pedido de semillas o envases, confirma con Peri que la factura está metida.
- **Semilla por bandeja:** pesa los gramos que echas por bandeja de cada variedad y apúntalos en la tabla 🌱 (pulsa el número). Hoy solo 5 de 22 variedades tienen el dato real; el resto es una estimación.
- **Envase de cada producto:** en la tabla 🥡, comprueba que cada formato lleva su tarrina y sus etiquetas.
- **Recuento (el día 1 de cada mes y cuando abras un saco nuevo):** pulsa 📋 **Recuento** en cada material y pon lo que hay de verdad:
  - **semillas:** pesa la bolsa (en gramos);
  - **sustrato:** sacos enteros × 100 L, más lo que quede del abierto;
  - **envases y etiquetas:** paquetes × unidades por paquete.

  El ERP ajusta el stock y apunta la diferencia como merma del mes. **No hay otra forma de corregir el stock de materiales**, y así queda bien.
- **Avisos en amarillo:**
  - «stock negativo»: falta una factura o están mal los gramos por bandeja o el envase de un producto;
  - «sin semilla en el catálogo»: hay que asignar esa variedad a su semilla;
  - «¿factura duplicada?»: avisa a Peri.

## 5. Rutina
- **Cada día:** lotes sembrados, cosechas, empaquetado y mermas apuntados el mismo día.
- **Cada semana:** mira en Aprovisionamientos que no haya avisos en amarillo.
- **El día 1 de cada mes:** recuento de materiales y de la nevera.
