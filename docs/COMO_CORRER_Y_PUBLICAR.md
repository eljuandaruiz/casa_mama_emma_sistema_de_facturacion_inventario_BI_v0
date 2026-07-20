# 🚀 Cómo correr Casa Mamá Emma (local) y cómo ponerla en línea

Guía rápida en un solo lugar. Para el detalle completo de cada camino, este
documento enlaza a `README.md` (sección 7) y a `docs/SERVIDOR_LOCAL_DV7.md`.

---

## 1. Correr el proyecto AHORA MISMO (lo más fácil)

Doble clic en **`EJECUTAR.bat`** (está en la raíz del proyecto). Hace todo solo:

1. Revisa que tengas Node.js instalado (si no, te abre la página para instalarlo).
2. Copia el proyecto a `Documentos\casa-mama-emma` (si lo corriste desde otra carpeta, p. ej. un USB o descargas).
3. Abre VS Code en esa carpeta (si lo tienes instalado).
4. Instala las dependencias (`npm install`) — la primera vez tarda unos minutos.
5. Crea la base de datos y siembra las 6 habitaciones + usuarios.
6. Arranca el servidor y abre `http://localhost:3000` en tu navegador solo.

**Para detenerlo:** cierra la ventana negra (o `Ctrl+C` dentro de ella).
**Para volver a abrirlo otro día:** doble clic en `EJECUTAR.bat` de nuevo — ya no
reinstala nada, solo arranca (unos segundos).

### Usuarios para entrar
| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | la que pusiste en `.env` (`ADMIN_PASSWORD`) o `CambiarClave123` por defecto | Administrador |
| `recepcion` | `Recepcion123` | Facturador |
| `operaciones` | `Operaciones123` | Operaciones |

⚠️ Cámbialas desde `/usuarios` antes de usarlo en serio.

---

## 2. Correr manualmente (si prefieres ver cada paso)

```bash
npm install                     # instalar dependencias
copy .env.example .env          # crear tu configuración (edítala después)
npm run db:setup                # crear BD SQLite + sembrar habitaciones/usuarios
npm run dev                     # arrancar → http://localhost:3000
```

Para entrar desde tu celular en la misma red WiFi:
```bash
npm run dev -- -H 0.0.0.0       # y abre http://IP-DE-TU-PC:3000 desde el celular
```

Más detalle (certificado `.p12`, ambiente de pruebas del SRI, etc.) → `README.md` sección 2.

---

## 3. Ponerlo EN LÍNEA (accesible desde cualquier lugar)

Tres caminos. Todos requieren que **la emisión de facturas tenga internet**
(llama a los servidores del SRI); si se corta, la factura queda pendiente y se
reintenta sola cuando vuelva la conexión (72 horas de margen legal).

### Comparativa rápida

| Camino | Costo | Quién administra | Ideal si… |
|---|---|---|---|
| **A. VPS en la nube (DigitalOcean/AWS/Vultr)** | ~$5-7/mes + dominio ~$12/año | Tú, por SSH (una vez configurado, casi no se toca) | Quieres acceso confiable desde cualquier lugar sin depender de tu casa |
| **B. Tu propia HP Pavilion DV7 (Linux, en casa)** | $0/mes (solo la luz) | Tú, físicamente en casa | Ya tienes esa laptop libre y no te importa que dependa de tu internet/luz de casa |
| **C. Solo localhost / red local** | $0 | — | Solo lo usa la recepción, desde la misma red WiFi del hospedaje |

---

### Camino A — VPS con dominio (DigitalOcean, AWS o Vultr)

Pasos completos en **`README.md` → sección "7.1 VPS en la nube"** (crear el
servidor, Node+PM2, Nginx, HTTPS gratis con Let's Encrypt, respaldos automáticos).

**Si usas AWS en vez de DigitalOcean**, los pasos son los mismos (es el mismo
Ubuntu) con estas diferencias puntuales:
1. Lanza una instancia **EC2** → Ubuntu 22.04 → tipo `t3.micro` o `t2.micro`
   (elegible en la capa gratuita el primer año).
2. En **Security Groups** (el "firewall" de AWS) abre los puertos:
   `22` (SSH, solo tu IP), `80` y `443` (HTTP/HTTPS, abierto a todos).
3. Asigna una **Elastic IP** a la instancia (gratis mientras esté en uso) para
   que la IP no cambie si reinicias el servidor — apunta tu dominio ahí.
4. El resto (Node, PM2, Nginx, certbot, `.env`, `.p12`) es idéntico a los
   pasos 2-9 de la sección 7.1 del README.

### Camino B — Servidor propio en la HP Pavilion DV7 (Linux)

Tutorial completo y detallado en **`docs/SERVIDOR_LOCAL_DV7.md`**: instalar
Ubuntu Server en la laptop, que no se suspenda con la tapa cerrada, arranque
automático, y **acceso desde fuera de casa con Cloudflare Tunnel** (gratis,
sin abrir puertos del router, funciona aunque tu proveedor de internet use
CG-NAT — algo común con CNT/Netlife en Ecuador).

### Camino C — Solo red local (sin salir a internet)

Sigue la sección 2 de arriba, pero en vez de `npm run dev` usa:
```bash
npm run build
npm run start -- -H 0.0.0.0     # accesible desde otros dispositivos de la misma WiFi
```

---

## 4. ¿Cuál me conviene a mí?

- **¿Quieres poder facturar aunque no estés en el hospedaje** (desde el celular,
  en la calle)? → **Camino A** (VPS con dominio).
- **¿Tienes la DV7 libre, buena luz e internet en casa, y no te importa
  depender de que esté prendida?** → **Camino B** (gratis, pero más manual).
- **¿Solo la usa recepción desde el mostrador?** → **Camino C** (más simple, cero costo).

Si no sabes por cuál empezar: arranca con **Camino C** ahora (ya lo tienes
corriendo con `EJECUTAR.bat`), y cuando quieras acceso remoto, migra a A o B
sin perder nada — es la misma base de datos, solo cambia dónde vive el servidor.
