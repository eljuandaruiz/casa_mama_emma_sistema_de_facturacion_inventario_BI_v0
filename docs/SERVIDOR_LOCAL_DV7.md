# 🖥️ Servidor local en la HP Pavilion DV7 (Linux) con acceso desde internet

Guía paso a paso para convertir la HP Pavilion DV7 en el **servidor** de Casa Mamá Emma:
la laptop hace TODO el procesamiento, corre 24/7 en tu red, y puedes entrar al sistema
**desde cualquier lugar del mundo** por internet.

> La DV7 es una laptop antigua (Core i5/i7 de 1.ª–2.ª generación, 4–8 GB RAM).
> Es MÁS que suficiente: esta app usa SQLite y atiende a 2-3 usuarios a la vez.
> Con Linux de servidor (sin escritorio) va sobrada.

---

## Fase 1 — Instalar Linux en la DV7

1. **Descarga Ubuntu Server 22.04 LTS** (https://ubuntu.com/download/server, archivo `.iso`).
   - ¿Por qué Server y no Desktop? No gasta RAM en interfaz gráfica; todo se maneja por terminal/SSH.
   - Alternativa si prefieres pantalla gráfica: **Lubuntu 22.04** (liviano) — los pasos siguientes son idénticos.
2. **Crea un USB arrancable** desde tu PC con Windows usando **Rufus** (https://rufus.ie): eliges el `.iso`, el USB (8 GB+), y "Empezar".
3. **Arranca la DV7 desde el USB**: enciéndela pulsando `Esc` y luego `F9` (menú de arranque de HP) → elige el USB.
4. Instala Ubuntu Server aceptando los valores por defecto. Puntos importantes:
   - **Nombre de usuario**: `casaemma` (o el que quieras — recuérdalo).
   - Marca **"Install OpenSSH server"** cuando lo pregunte (para manejarla sin pantalla después).
   - Deja que use todo el disco (⚠️ borra Windows y todo lo que hubiera en esa laptop).
5. Al terminar, retira el USB y reinicia. Ya tienes Linux.

### Ajustes de laptop-como-servidor (importantes)

```bash
# Que NO se suspenda al cerrar la tapa (así vive cerrada en una repisa):
sudo nano /etc/systemd/logind.conf
#   → descomenta/edita estas líneas:
#   HandleLidSwitch=ignore
#   HandleLidSwitchDocked=ignore
sudo systemctl restart systemd-logind

# Que se encienda sola tras un corte de luz: en la BIOS (F10 al encender),
# busca "Power On After Power Loss" o similar → Enabled (si tu BIOS lo tiene).
```

> 🌡️ Consejo físico: la DV7 es famosa por calentarse. Límpiale el ventilador,
> ponla elevada (que respire por abajo) y déjala SIEMPRE conectada al cargador.

---

## Fase 2 — Instalar la aplicación

Entra a la laptop (directamente o por SSH desde tu PC: `ssh casaemma@IP-DE-LA-DV7`):

```bash
# 1. Node.js 20 LTS + herramientas
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2

# 2. El proyecto
git clone <tu-repositorio> ~/casa-mama-emma     # o cópialo por USB/scp
cd ~/casa-mama-emma
npm install

# 3. Configuración
cp .env.example .env
nano .env    # AUTH_SECRET propio, credenciales SRI, APP_URL (ver Fase 3)

# 4. Certificado de firma: copia tu firma.p12 a ~/casa-mama-emma/certificados/
#    (desde Windows: scp C:\ruta\firma.p12 casaemma@IP-DE-LA-DV7:~/casa-mama-emma/certificados/)

# 5. Base de datos + build de producción
npm run db:setup
npm run build

# 6. Arrancar con PM2 (revive sola si falla o si se reinicia la laptop)
pm2 start npm --name casa-mama-emma -- start
pm2 save
pm2 startup     # ejecuta la línea que te imprime (registra el arranque automático)
```

Prueba en la red local: desde tu celular (mismo WiFi) abre `http://IP-DE-LA-DV7:3000`.

**IP fija en la red local**: entra a tu router (usualmente `192.168.1.1`) → DHCP →
"Reserva de IP" y fija la MAC de la DV7 a una IP (ej. `192.168.1.50`). Así nunca cambia.

---

## Fase 3 — Acceso DESDE FUERA (internet)

Hay dos caminos. **Recomendado: Opción A (Cloudflare Tunnel)** — no hay que abrir
puertos en el router, funciona aunque tu proveedor use CG-NAT (común en Ecuador),
y te da HTTPS gratis.

### Opción A · Cloudflare Tunnel (recomendada, gratis)

Requisito: un dominio tuyo (p. ej. `casamamaemma.com`, ~$10-12/año) gestionado en
Cloudflare (plan gratis).

```bash
# En la DV7:
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login                 # abre un enlace: autorízalo con tu cuenta Cloudflare
cloudflared tunnel create casa-emma
cloudflared tunnel route dns casa-emma app.casamamaemma.com

# Config del túnel:
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Contenido de `config.yml` (cambia `<ID-DEL-TUNEL>` por el que te dio `tunnel create`):

```yaml
tunnel: <ID-DEL-TUNEL>
credentials-file: /home/casaemma/.cloudflared/<ID-DEL-TUNEL>.json
ingress:
  - hostname: app.casamamaemma.com
    service: http://localhost:3000
  - service: http_status:404
```

```bash
sudo cloudflared service install   # queda como servicio permanente
sudo systemctl start cloudflared
```

Listo: entras desde cualquier lugar en **https://app.casamamaemma.com** (HTTPS
automático). En `.env` pon `APP_URL="https://app.casamamaemma.com"` y reinicia
(`pm2 restart casa-mama-emma`) para que los enlaces de los correos salgan bien.

### Opción B · Abrir puerto + DNS dinámico (la clásica)

1. **DuckDNS** (gratis): crea `casamamaemma.duckdns.org` en https://www.duckdns.org
   y sigue sus instrucciones de "install" para Linux (un cron que avisa tu IP cada 5 min).
2. **Port forwarding** en tu router: puerto externo `443` (o `8443`) → IP interna de
   la DV7 (`192.168.1.50`) puerto `3000`.
3. ⚠️ Esta opción expone el puerto directamente: usa contraseñas fuertes (el sistema
   ya bloquea 8 h tras 10 intentos fallidos) y de preferencia añade Nginx + certificado
   Let's Encrypt delante (ver README sección 7.1, pasos 6-7).
4. Si tu proveedor usa **CG-NAT** (Netlife/CNT a veces), esta opción NO funciona:
   usa la Opción A.

---

## Fase 4 — Mantenimiento

```bash
# Respaldo diario de la base (cron a las 3 AM, guarda 30 días):
crontab -e
# añade:
0 3 * * * cp ~/casa-mama-emma/casa-mama-emma.db ~/respaldos/casa-mama-emma-$(date +\%F).db && find ~/respaldos -mtime +30 -delete

# Ver estado / logs / reiniciar:
pm2 status
pm2 logs casa-mama-emma
pm2 restart casa-mama-emma

# Actualizar la app:
cd ~/casa-mama-emma && git pull && npm install && npm run build && pm2 restart casa-mama-emma
```

> 🌐 Recuerda: aunque el servidor sea local, **emitir facturas necesita internet**
> (los Web Services SOAP del SRI). Sin conexión, las facturas quedan FIRMADAS y se
> reintentan al volver la red (esquema offline del SRI, 72 h).
