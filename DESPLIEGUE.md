# Guía de despliegue — Pathfinder VTT (con Coolify)

Cómo poner la aplicación en línea sobre un **VPS**, usando **Coolify** como
panel y un dominio de **Cloudflare**. Coolify se encarga del proxy, el HTTPS,
las variables y los backups desde una interfaz web; tú apenas tocas la
terminal.

---

## 0. Qué necesitas antes de empezar

- Un **VPS** con **Ubuntu 24.04 LTS** (64 bits). También vale Debian 12.
  - **Mínimo 4 GB de RAM** (Coolify + compilar el front piden memoria; con
    1–2 GB se queda corto). 2 vCPU y ~40–60 GB de disco.
- Un **dominio** en **Cloudflare** (con acceso a su panel de DNS).
- El proyecto en un repositorio Git accesible desde internet (Coolify se
  conecta a él para desplegar).

---

## 1. Instalar Coolify en el VPS

Conéctate por SSH (`ssh root@LA_IP`, o el usuario que te dé el proveedor) y
lanza el instalador oficial:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Cuando termine, abre `http://LA_IP:8000` en el navegador. Crea la cuenta de
administrador (la primera que entra manda) y ya tienes el panel.

> Coolify instala Docker y su propio proxy (Traefik) por ti. No hace falta
> que instales nada más a mano.

---

## 2. Apuntar el dominio (Cloudflare)

En Cloudflare, en **DNS → Records**, crea:

| Tipo | Nombre                | Contenido (IPv4) | Proxy                  |
| ---- | --------------------- | ---------------- | ---------------------- |
| A    | `pathfinder` (o `@`)  | la IP de tu VPS  | **DNS only** (☁️ gris) |

> **Empieza con "DNS only" (nube gris).** Así Traefik puede pedir el
> certificado HTTPS sin tropiezos. Cuando todo funcione, el paso 8 explica
> cómo activar el proxy naranja de Cloudflare.

El nombre completo (p. ej. `pathfinder.tudominio.com`) lo usarás en el paso 4.

---

## 3. Crear el proyecto en Coolify

1. En el panel, **+ New → Project**, ponle nombre (p. ej. "Pathfinder").
2. Dentro, **+ New Resource → Docker Compose**.
3. Conéctalo a tu **repositorio Git** y dile que el fichero de compose es
   **`docker-compose.prod.yml`**.

Coolify leerá el compose y verá tres servicios: `postgres`, `migrate` y `api`.

---

## 4. Configurar variables y dominio

Antes de desplegar, en la pantalla del recurso:

### Variables de entorno

Coolify te muestra como campos las variables que el compose pide. Rellena:

- **`DB_PASSWORD`** — una cadena larga y aleatoria.
- **`JWT_SECRET`** — otra distinta, larga y aleatoria.
- **`APP_URL`** — la dirección pública, con https y **sin barra final**:
  `https://rolnees.com`. De aquí sale el enlace de los correos de
  recuperación. Si la pones mal, los enlaces no llevarán a ninguna parte.
- **Las cinco `MAIL_*`** — ver la sección 4.1, justo debajo.

Para generarlas, en cualquier terminal:

```bash
openssl rand -base64 48
```

(El resto tienen valores por defecto razonables. `NODE_ENV=production` ya va
fijado en el compose.)

### Dominio

En el servicio **`api`**, asigna el dominio: `https://pathfinder.tudominio.com`
apuntando al puerto **3000**. Coolify se encarga solo de Traefik y del
certificado de Let's Encrypt para ese nombre.

---

## 4.1. Correo saliente (Resend)

Hace falta para que funcione **"he olvidado mi contraseña"**. Sin esto la app
arranca igual y todo parece correcto, pero **los correos no salen nunca** y
nadie puede recuperar su cuenta. (La API responde lo mismo pase lo que pase:
no puede decir si el correo salió sin delatar qué cuentas existen. El único
sitio donde se ve el problema es el log, que al arrancar deja un error si
falta `MAIL_HOST`.)

**1. Crear la cuenta.** En [resend.com](https://resend.com), plan gratuito
(3.000 correos/mes, 100/día — de sobra: aquí un correo es alguien que ha
perdido su contraseña).

**2. Verificar el dominio.** En Resend, *Domains → Add Domain* → `rolnees.com`.
Te dará **tres registros DNS** (DKIM, SPF y, si lo ofrece, DMARC). Añádelos en
**Cloudflare** → tu dominio → *DNS* → *Add record*, copiando tipo, nombre y
valor tal cual.

> ⚠️ Los registros de correo van con la nube **GRIS** (*DNS only*), nunca
> naranja. La nube naranja es para tráfico web; sobre un registro TXT o MX no
> hace nada bueno.

Vuelve a Resend y pulsa *Verify*. Suele tardar unos minutos.

**Estos tres registros no son burocracia.** Le dicen al servidor de tu amigo
que un correo firmado como `@rolnees.com` salió de verdad de nosotros. Sin
ellos, Gmail manda el mensaje a spam o lo rechaza — y un correo de
recuperación en spam es lo mismo que un correo que no existe.

**3. Crear la API key.** *API Keys → Create*, permiso de envío. **Cópiala en
ese momento**: no se vuelve a mostrar.

**4. Rellenar las variables en el panel de Coolify:**

| Variable | Valor |
|---|---|
| `MAIL_HOST` | `smtp.resend.com` |
| `MAIL_PORT` | `465` |
| `MAIL_USER` | `resend` (literal, no tu correo) |
| `MAIL_PASSWORD` | la API key del paso 3 |
| `MAIL_FROM` | `Pathfinder VTT <no-responder@rolnees.com>` |

El remitente **tiene que ser del dominio verificado**. Con un `@gmail.com`
Resend rechazará el envío.

> **Cambiar de proveedor** (Brevo, Postmark, Amazon SES) es cambiar estas
> cinco variables y nada más: la app habla SMTP, no el SDK de nadie.

---

## 5. Desplegar

Pulsa **Deploy**. Coolify:

1. Clona el repo y **construye** las imágenes (tarda; compila front y back).
2. Levanta **postgres**, espera a que esté sano.
3. Corre **migrate**, que aplica el esquema y termina.
4. Arranca **api** (solo si las migraciones fueron bien).
5. Enruta tu dominio con HTTPS.

Puedes seguir todo en la pestaña de **Logs** del panel. El contenedor
`migrate` aparecerá como "exited" cuando acabe: es lo normal, es de un solo
uso.

> **Las migraciones son automáticas en cada despliegue.** No hay un paso
> manual: `api` no arranca hasta que `migrate` termina bien. Si una migración
> falla, el despliegue se marca en rojo y la versión anterior sigue en pie.

---

## 6. Prueba de humo

Comprueba lo esencial, sobre todo la cookie (es lo que más se rompe):

1. Abre `https://tu-dominio`: debe cargar la portada **con el candado** de
   HTTPS.
2. **Regístrate** y confirma que te deja entrar. Si te registras pero
   "no pasa nada" o te echa, casi siempre es que la cookie no se guarda →
   revisa que la URL sea `https://` (no `http://`).
3. Crea una mesa y **mueve un token con dos navegadores** a la vez: verifica
   que el tiempo real (WebSocket) atraviesa el proxy.
4. Sube un mapa a una mesa y recarga: debe seguir ahí (volumen persistente).
5. **Recuperar contraseña, de punta a punta** — es lo único que depende de un
   servicio externo, así que se prueba entero:
   - En `/entrar`, pulsa *¿Has olvidado tu contraseña?* y pide el enlace con
     tu correo. **Mira también la carpeta de spam.**
   - Abre el enlace, elige una contraseña nueva y entra con ella.
   - Comprueba que llega el segundo correo, el de aviso del cambio.
   - Y que **la contraseña vieja ya no entra**.

   Si el correo no llega: revisa las `MAIL_*` en el panel, que el dominio
   esté *verified* en Resend, y el log de la API — un fallo de envío se
   registra ahí con el texto `No se pudo enviar el correo`.

---

## 7. Copias de seguridad

Lo que hay que salvar es la BASE DE DATOS. Como el PostgreSQL vive DENTRO de
nuestro docker-compose (no es un recurso "Database" propio de Coolify), no
usamos el backup de Coolify: un script lo salva y lo programamos con cron.

> El script archiva además el volumen `uploads`. Desde el 2026-08-25 ese
> volumen está VACÍO: el tablero dejó de admitir mapas de fondo (las salas y
> pasillos se dibujan y viven en la base de datos, ver CLAUDE.md → ZONAS DEL
> TABLERO). Se deja montado y en la copia porque compartir imágenes como
> ilustración sigue en la lista; mientras tanto no cuesta nada y evita
> tocar el despliegue dos veces.

El script está en el repo: [scripts/backup.sh](scripts/backup.sh). Localiza el
contenedor de postgres por sus etiquetas de compose, hace `pg_dump` + archiva
el volumen `uploads`, y borra las copias más viejas que `RETENER_DIAS`.

**Instalarlo en el servidor** (por SSH):

```bash
# 1. Traer el repo (público) solo para tener el script
git clone https://github.com/TU_USUARIO/pathfinder-vtt.git /root/pathfinder-vtt

# 2. Probarlo una vez a mano
bash /root/pathfinder-vtt/scripts/backup.sh
ls -lh /root/backups/pathfinder     # deberían aparecer db-*.sql.gz y uploads-*.tar.gz

# 3. Programarlo cada noche a las 3:00 (sin abrir editor)
(crontab -l 2>/dev/null; echo "0 3 * * * bash /root/pathfinder-vtt/scripts/backup.sh >> /var/log/pathfinder-backup.log 2>&1") | crontab -
```

Para actualizar el script el día que cambie: `cd /root/pathfinder-vtt && git pull`.

> **Importante:** estas copias viven EN el propio VPS. Si el VPS muere, mueren
> con él. Descárgatelas de vez en cuando a tu ordenador (o configura un
> destino externo tipo S3 más adelante). Y si tu proveedor ofrece "snapshots"
> de la máquina entera, actívalos: son la red de seguridad más cómoda.

Para **descargar** una copia a tu PC (desde PowerShell, en tu ordenador):

```powershell
scp root@LA_IP:/root/backups/pathfinder/db-*.sql.gz .
```

---

## 8. (Opcional, recomendado más adelante) Activar el proxy de Cloudflare

Con la nube gris ya tienes HTTPS y todo funciona. La **nube naranja** (proxy
de Cloudflare) añade protección contra ataques y oculta la IP del servidor,
pero requiere dos ajustes:

1. **En Cloudflare**, cambia el registro A a **Proxied** (naranja) y en
   **SSL/TLS → Overview** pon el modo en **Full (strict)**. Con otro modo, la
   cookie no viaja segura o entras en un bucle de redirecciones.

2. **Cierra el cortafuegos del VPS para que SOLO Cloudflare entre** por los
   puertos 80/443. Si no, alguien podría saltarse Cloudflare llamando a la IP
   directa y falsificar la cabecera de IP del visitante, engañando al freno de
   login. OJO: `ufw` NO sirve — Docker publica esos puertos y se lo salta; hay
   que usar la cadena `DOCKER-USER` de iptables. El script
   [scripts/cortafuegos-cloudflare.sh](scripts/cortafuegos-cloudflare.sh) lo
   hace: descarga los rangos oficiales de Cloudflare y bloquea al resto en
   80/443, sin tocar SSH (22) ni el panel de Coolify (8000).

   ```bash
   # Con el SSH ABIERTO como red de seguridad. Rescate si algo va mal:
   #   iptables -F DOCKER-USER && ip6tables -F DOCKER-USER
   bash /root/pathfinder-vtt/scripts/cortafuegos-cloudflare.sh

   # Persistencia: reaplicar en cada arranque y refrescar los rangos cada semana
   (crontab -l 2>/dev/null; \
    echo "@reboot bash /root/pathfinder-vtt/scripts/cortafuegos-cloudflare.sh >> /var/log/pathfinder-cortafuegos.log 2>&1"; \
    echo "0 4 * * 1 bash /root/pathfinder-vtt/scripts/cortafuegos-cloudflare.sh >> /var/log/pathfinder-cortafuegos.log 2>&1") | crontab -
   ```

   **Comprueba SIEMPRE las dos mitades.** Un cortafuegos puede quedar mal de
   dos maneras opuestas, y la web sigue cargando igual en ambos casos:

   - *Que los contenedores conserven salida a internet.* Lo hace ya el propio
     script al terminar (debe decir `OK: un contenedor llega a github.com`).
     Si esto falla, la web funciona pero **los despliegues fallan**: Coolify no
     puede ni leer el repositorio. Nos pasó el 2026-08-03.
   - *Que el origen siga cerrado.* Esto **no se puede probar desde el VPS** (un
     paquete que nace en el host hacia su propia IP no pasa por `FORWARD`, así
     que no toca estas reglas). Desde tu portátil, saltándote Cloudflare:

     ```bash
     curl -sk -m 10 --resolve TUDOMINIO:443:<IP-DEL-VPS> https://TUDOMINIO
     ```

     Debe quedarse colgado hasta el timeout. Si responde, el origen está
     abierto y cualquiera puede falsificar `CF-Connecting-IP`.

**Nada que tocar en el código:** la app ya lee la IP real del visitante de la
cabecera `CF-Connecting-IP` de Cloudflare (decorador `IpCliente`), así que el
freno de fuerza bruta sigue distinguiendo a cada persona. En "DNS only" esa
cabecera no existe y usa la IP que le pasa Traefik; el código funciona igual
en ambos casos.

---

## 9. Actualizar la app

Cada vez que subas cambios al repositorio, pulsa **Deploy** en Coolify (o
activa el despliegue automático por webhook para que lo haga solo con cada
push). Coolify reconstruye, corre las migraciones nuevas si las hay y arranca
la versión nueva. Los datos de PostgreSQL y los mapas siguen intactos.

---

## Resolución de problemas

- **Me registro pero no inicia sesión / me echa enseguida.** La cookie no se
  guarda. Comprueba: URL en `https://` (candado) y que el dominio esté bien
  asignado al servicio `api` en Coolify.
- **Traefik no consigue el certificado.** El dominio aún no apunta bien
  (espera a que propague el DNS) o Cloudflare está en "Proxied" antes de
  tiempo: déjalo en "DNS only" para la primera emisión.
- **El despliegue falla al construir.** Suele ser poca RAM. Necesitas 4 GB;
  amplía el VPS.
- **El despliegue falla en `migrate`.** Mira los logs de ese contenedor en
  Coolify: casi siempre es la conexión a la base de datos (¿está bien
  `DB_PASSWORD`?) o un error en una migración nueva.
- **El correo de recuperación no llega.** La pantalla siempre dice lo mismo
  (no puede revelar si esa cuenta existe), así que hay que mirar el log de la
  API. Por orden:
  1. `Correo en modo CONSOLA` al arrancar → falta `MAIL_HOST`: los correos se
     están escribiendo en el log en vez de enviarse.
  2. `No se pudo enviar el correo` → la clave o el remitente. Comprueba que
     `MAIL_FROM` sea del dominio verificado y que la API key siga viva.
  3. Nada en el log → el correo salió. Mirad **spam**, y en el panel de
     Resend (*Emails*) se ve si fue entregado o rebotado.
- **El enlace del correo lleva a un sitio raro o da 404.** `APP_URL` está mal:
  tiene que ser la URL pública completa, con `https://` y sin barra final.
- **"Este enlace ya no sirve".** Es lo normal si han pasado más de 30 minutos
  o si ya se usó una vez (los dos son a propósito). También pasa si se pidió
  el enlace dos veces: solo vale el último. Que pida uno nuevo.
