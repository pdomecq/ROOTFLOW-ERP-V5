# 📧 Configuración del Sistema de Emails - Rootflow ERP

Esta guía te lleva paso a paso para que las alertas del ERP lleguen al email de los socios.

---

## 📦 Pre-requisitos

- Cuenta en [Supabase](https://supabase.com) (la que ya usas para el ERP)
- Cuenta en [Resend](https://resend.com) (gratis hasta 3.000 emails/mes)
- Acceso al dominio `rootflow.es` para añadir registros DNS
- Supabase CLI instalado: `npm install -g supabase`

---

## 🔧 PASO 1: Crear cuenta en Resend

1. Ir a https://resend.com
2. Sign Up → con email/Google/GitHub
3. Confirmar email

---

## 🌐 PASO 2: Verificar el dominio rootflow.es

1. En Resend, ir a **Domains** → **Add Domain**
2. Introducir: `rootflow.es`
3. Resend te dará 3 registros DNS para añadir:
   - 1 registro **MX** (recibir respuestas)
   - 2 registros **TXT** (SPF y DKIM)
4. Ir al panel de tu proveedor DNS (donde está registrado rootflow.es) y añadir esos registros
5. Volver a Resend y pulsar **Verify DNS Records**
6. Esperar a que aparezcan ✅ verdes (suele tardar 5-30 min)

> ⚠️ **Sin dominio verificado:** podrás enviar emails solo desde `onboarding@resend.dev` para pruebas.

---

## 🔑 PASO 3: Generar API Key

1. En Resend, ir a **API Keys** → **Create API Key**
2. Nombre: `rootflow-erp-production`
3. Permission: **Full access** (o **Sending access**)
4. Copiar el valor que empieza por `re_`...
5. **GUARDARLO** — solo se muestra una vez

---

## ⚙️ PASO 4: Añadir el secret en Supabase

### Opción A - Desde el panel web (más fácil)

1. Ir a tu proyecto en https://supabase.com/dashboard
2. **Project Settings** → **Edge Functions** → **Secrets**
3. **New Secret**:
   - Name: `RESEND_API_KEY`
   - Value: `re_xxxxx...` (el que copiaste)
4. **Save**

### Opción B - Desde la CLI

```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
```

---

## 🚀 PASO 5: Desplegar la Edge Function

### Setup inicial (solo la primera vez)

```bash
# Desde la raíz del proyecto del ERP
cd /ruta/a/rootflow-erp

# Login en Supabase
supabase login

# Vincular con tu proyecto (encontrarás el project-ref en la URL del dashboard)
supabase link --project-ref TU-PROJECT-REF
```

### Desplegar la función

```bash
supabase functions deploy send-email
```

Si todo va bien verás:
```
Deployed Function send-email to https://TU-PROJECT-REF.supabase.co/functions/v1/send-email
```

---

## ✅ PASO 6: Activar y probar en el ERP

1. Abrir el ERP
2. Pulsar la 🔔 **campana de alertas** (esquina superior derecha)
3. Pulsar el icono ⚙️ (configurar emails)
4. Marcar **"Sistema de emails ACTIVO"**
5. Verificar el remitente (debe coincidir con tu dominio verificado en Resend)
6. Pulsar **"Enviar email de prueba"**
7. Si todo va bien, los socios recibirán un email de prueba ✉️

---

## 🧪 Verificación

Después de configurarlo, debes ver:
- ✅ El icono de email azul aparece en cada alerta del panel
- ✅ El botón "Notificar a socios por email" está activo
- ✅ Los socios reciben emails al pulsar dichos botones

---

## 🆘 Troubleshooting

### "RESEND_API_KEY no configurada"
- Verificar que el secret está en Supabase: Project Settings → Edge Functions → Secrets
- Re-desplegar la función: `supabase functions deploy send-email`

### "Domain not verified"
- Esperar a que los registros DNS propaguen (puede tardar hasta 24h en algunos proveedores)
- Verificar en Resend → Domains que están todos los ✅
- Como solución temporal usar como remitente `onboarding@resend.dev` (funciona sin verificación)

### "Invalid API key"
- Volver a Resend → API Keys → crear nueva
- Actualizar el secret en Supabase
- Re-desplegar la función

### El email se envía pero no llega
- Revisar carpeta de spam
- Verificar que el dominio del destinatario no bloquea Resend
- En Resend → Logs ver el estado del email

---

## 📊 Tabla email_log

Cada email enviado se registra en la tabla `email_log` con:
- destinatarios
- asunto  
- alerta_id (si aplica)
- estado (enviado/error)
- respuesta (id de Resend o mensaje de error)
- created_at

Útil para auditoría y debugging.

---

**Cualquier duda, revisa los logs de la Edge Function:**
- Supabase Dashboard → Edge Functions → send-email → Logs
