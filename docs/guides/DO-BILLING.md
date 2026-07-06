# Consultar Balance de DigitalOcean via API

Guía para consultar el balance y uso mensual de tu cuenta de DigitalOcean usando `curl`.

---

## Requisitos

- **PowerShell 5.1+** (viene con Windows)
- **Token de acceso personal** de DigitalOcean

---

## Paso 1: Configurar el Token como variable de entorno (seguro)

```powershell
$env:DO_TOKEN = "DIGITALOCEAN_ACCESS_TOKEN_PLACEHOLDER"
```

> ⚠️ Esto solo vive en la sesión actual de PowerShell. Al cerrar la terminal, desaparece.

---

## Paso 2: Consultar el balance

```powershell
curl -Headers @{Authorization = "Bearer $env:DO_TOKEN"} `
     -Uri "https://api.digitalocean.com/v2/customers/my/balance" `
     | Select-Object -ExpandProperty Content
```

### Respuesta esperada

```json
{
  "month_to_date_balance": "15.23",
  "account_balance": "0.00",
  "month_to_date_usage": "15.23",
  "generated_at": "2026-06-19T12:00:00Z"
}
```

| Campo | Significado |
|---|---|
| `month_to_date_balance` | Total facturado en el mes actual |
| `account_balance` | Crédito restante en tu cuenta |
| `month_to_date_usage` | Consumo acumulado en el mes |
| `generated_at` | Marca de tiempo de la consulta |

---

## Paso 3: Consultar el historial de facturación

```powershell
curl -Headers @{Authorization = "Bearer $env:DO_TOKEN"} `
     -Uri "https://api.digitalocean.com/v2/customers/my/billing_history" `
     | Select-Object -ExpandProperty Content
```

---

## Paso 4: Consultar la factura actual (líneas de detalle)

```powershell
curl -Headers @{Authorization = "Bearer $env:DO_TOKEN"} `
     -Uri "https://api.digitalocean.com/v2/customers/my/invoices" `
     | Select-Object -ExpandProperty Content
```

Para ver el detalle de una factura específica (reemplaza `FECHA` por el valor real):

```powershell
curl -Headers @{Authorization = "Bearer $env:DO_TOKEN"} `
     -Uri "https://api.digitalocean.com/v2/customers/my/invoices/2026-06" `
     | Select-Object -ExpandProperty Content
```

---

## Formatear la salida (opcional)

Si quieres ver el JSON con formato legible:

```powershell
curl -Headers @{Authorization = "Bearer $env:DO_TOKEN"} `
     -Uri "https://api.digitalocean.com/v2/customers/my/balance" `
     | Select-Object -ExpandProperty Content `
     | ConvertFrom-Json `
     | ConvertTo-Json
```

---

## Alternativa: `doctl` (CLI oficial)

> ⚠️ `doctl` tiene comandos planos (no anidados bajo `billing`).
> Los comandos correctos se listan en la sección *View Billing* del `--help`.

### Autenticar (solo la primera vez)

```powershell
# Te pedirá pegar el token
doctl auth init
```

### Consultar balance

```powershell
doctl balance get
```

### Consultar historial de facturación

```powershell
doctl billing-history list
```

### Consultar facturas disponibles

```powershell
doctl invoice list
```

### Ver detalle de una factura específica

```powershell
doctl invoice get <UUID-de-la-factura>
```
