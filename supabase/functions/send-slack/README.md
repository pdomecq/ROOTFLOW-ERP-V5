# 💬 Configuración del Sistema de Notificaciones Slack - Rootflow ERP

Esta guía te lleva paso a paso para que las alertas del ERP lleguen a Slack.

---

## 📦 Pre-requisitos

- Un workspace de Slack (el que uséis los socios)
- Acceso a tu proyecto en Supabase
- Supabase CLI instalado: `npm install -g supabase`

---

## 🔧 PASO 1: Crear canal de Slack

1. En Slack, crea un canal nuevo: **#rootflow-alertas** (o el nombre que prefieras)
2. Invita a los socios (Pedro, Domingo, Nicolás)
3. Considera ponerlo como "muted" para que solo notifique cuando hay críticas

---

## 🤖 PASO 2: Crear App de Slack

1. Ir a https://api.slack.com/apps
2. Pulsar **"Create New App"** → **"From scratch"**
3. Datos:
   - App Name: `Rootflow ERP`
   - Workspace: tu workspace de Slack
4. **"Create App"**

---

## 🪝 PASO 3: Activar Incoming Webhooks

1. En el menú lateral izquierdo → **"Incoming Webhooks"**
2. Toggle **"Activate Incoming Webhooks"** → ON
3. Bajar y pulsar **"Add New Webhook to Workspace"**
4. Seleccionar el canal `#rootflow-alertas` → **"Allow"**
5. Aparecerá una URL tipo: `https://hooks.slack.com/services/T01ABC.../B02DEF.../xxxxx`
6. **COPIA esta URL** — es secreta

---

## 🔐 PASO 4: Añadir el secret en Supabase

### Opción A - Desde el panel web (más fácil)

1. Ir a https://supabase.com/dashboard → tu proyecto
2. **Project Settings** → **Edge Functions** → **Secrets**
3. **New Secret**:
   - Name: `SLACK_WEBHOOK_URL`
   - Value: la URL que copiaste
4. **Save**

### Opción B - Desde la CLI

```bash
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## 🚀 PASO 5: Desplegar la Edge Function

### Setup inicial (solo la primera vez)

```bash
cd /ruta/al/proyecto-rootflow

supabase login
supabase link --project-ref TU-PROJECT-REF
```

### Desplegar

```bash
supabase functions deploy send-slack
```

Si todo va bien:
```
Deployed Function send-slack to https://TU-PROJECT-REF.supabase.co/functions/v1/send-slack
```

---

## ✅ PASO 6: Activar y probar en el ERP

1. Abrir el ERP
2. Pulsar la 🔔 **campana de alertas** (esquina superior derecha)
3. Pulsar el icono ⚙️ (configurar notificaciones)
4. Marcar **"Notificaciones Slack ACTIVAS"**
5. Dejar marcada la opción **"Usar Edge Function"**
6. Configurar canal informativo (ej: `#rootflow-alertas`)
7. Pulsar **"Enviar mensaje de prueba a Slack"**
8. Verifica que llega al canal ✉️

---

## 📋 Cuándo se envían alertas

Una vez activado, el ERP enviará a Slack automáticamente:
- 🆕 **Nuevos turnos asignados** (si activas la casilla "enviar alerta")
- 🚨 **Alertas manuales** (botón "Enviar a Slack" en el panel de alertas)
- 📊 **Resumen** (botón "Enviar resumen a Slack")

Las alertas se filtran según tu configuración:
- Solo críticas (recomendado para evitar saturación)
- Mencionar `@channel` en críticas (avisa a todos)

---

## 🆘 Troubleshooting

### "SLACK_WEBHOOK_URL no configurada"
- Verifica el secret en Supabase: Project Settings → Edge Functions → Secrets
- Re-desplegar: `supabase functions deploy send-slack`

### "Slack webhook respondió 404"
- La URL del webhook es incorrecta o el webhook se ha eliminado
- Generar nueva URL en https://api.slack.com/apps → tu app → Incoming Webhooks
- Actualizar el secret

### "Slack webhook respondió 403"
- El canal del webhook fue archivado o eliminado
- Crear un nuevo webhook apuntando a un canal válido

### El mensaje llega pero sin formato bonito
- Verificar que la app tiene los permisos básicos (no necesita más que webhooks)
- Asegurarse de que NO has rotado la URL del webhook

---

## 🔄 Migrar de Email a Slack

Si tenías email configurado, **NO se desactiva automáticamente**. Puedes:
- **Tener ambos** (Slack + Email): útil al principio
- **Solo Slack**: ir a "Configurar emails" → desactivar
- **Solo Email**: dejar Slack desactivado

El sistema te muestra ambos botones en el panel de alertas si los dos están activos.

---

**Logs y debugging:**
- Mensajes enviados se guardan en la tabla `email_log` (con destinatarios = "Slack: #canal")
- Logs de la Edge Function: Supabase Dashboard → Edge Functions → send-slack → Logs
