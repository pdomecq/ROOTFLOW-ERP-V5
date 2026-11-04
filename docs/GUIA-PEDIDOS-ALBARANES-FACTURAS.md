# Guía rápida: pedidos → albaranes → facturas (V98)

**Regla de oro:** siempre en este orden, **pedido → albarán → factura**. Si algo está mal se corrige en el **pedido** o en el **albarán**; la factura se pone al día sola. Nada se borra: se **cancela** o se **anula**.

## 1. El cliente (una vez)
- En su ficha, **Periodicidad de facturación**:
  - **Por pedido**: cada pedido tiene su factura (se crea sola al crear el pedido).
  - **Semanal / quincenal / mensual**: una factura con todos los albaranes entregados del periodo.
- Pon también los **portes** (y desde qué importe son gratis) y el email de facturación.
- Cambiar la periodicidad: el ERP no deja pasar a «por pedido» si quedan albaranes sin facturar (hazle antes su factura agrupada).

## 2. Pedido
- **Un pedido por cliente y día de entrega.** Si pide más, **amplía el pedido** (✏️). Si intentas crear otro para el mismo día, el ERP te avisa.
- Los precios salen solos de su tarifa: no los toques en el pedido (los especiales se ponen en Tarifas).
- ¿No se entrega? Botón **⊗ Cancelar pedido**. Anula también su albarán y su factura (con rectificativa si ya se había enviado) y queda como «Cancelado». Un pedido entregado no se cancela.

## 3. Albarán
- **Un albarán por pedido** (en clientes «por pedido» el ERP no deja juntar varios).
- Antes de salir, revisa cantidades y porte. Si al entregar cambia algo, **edita el albarán**.
- Al entregar: **✅ Marcar como entregado**. La factura queda cerrada con los importes del albarán y ya se puede enviar.
- ¿Albarán mal hecho y sin entregar? **⊗ Anular** (conserva su número) y haz uno nuevo. Entregado o facturado no se anula: se edita.

## 4. Factura
- No hagas facturas a mano: salen solas (por pedido) o desde Facturación → facturas agrupadas.
- **Sin enviar**: si no cuadra con su albarán, se corrige sola.
- **Enviada o cobrada**: no se puede modificar. Corrige el albarán y pulsa **↩️ Rectificar y reemitir** en 🧾 Control de facturas (rectificativa + factura nueva, y se mandan las dos al cliente).
- Una factura que no cuadra con su albarán **no se envía** y avisa en Slack.

## 5. Cada día (1 minuto)
- Facturación → panel **🧾 Control de facturas**: verde = todo bien; rojo = pulsa el botón de cada línea.
- Avisos de Slack «Control de facturas» o «Factura NO enviada»: se arreglan desde ese panel.
