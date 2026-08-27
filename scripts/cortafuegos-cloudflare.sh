#!/usr/bin/env bash
#
# Restringe los puertos 80 y 443 del ORIGEN a SOLO las IPs de Cloudflare, y
# cierra a TODO internet el 8000 (panel de Coolify), al que se entra por un
# túnel SSH.
#
# Por qué así: Docker publica esos puertos (coolify-proxy) y se SALTA UFW; la
# única cadena de iptables que Docker respeta para esto es DOCKER-USER. Aquí
# permitimos los rangos oficiales de Cloudflare y bloqueamos al resto, para que
# nadie pueda saltarse Cloudflare llamando directo a la IP del servidor (lo que
# permitiría falsificar la cabecera CF-Connecting-IP y burlar el freno de login).
#
# NO toca el SSH (22, que va por el host, no por Docker) ni el panel de Coolify
# (8000). Idempotente: se puede re-ejecutar; borra sus propias reglas (marcadas
# con un comentario) y las rehace. Fail-safe: si no puede descargar los rangos,
# NO cambia nada.
#
# TODAS las reglas llevan "-i $WAN" (la interfaz pública), y esto NO es un
# adorno: DOCKER-USER cuelga de FORWARD, y por FORWARD pasan LOS DOS SENTIDOS
# del tráfico de un contenedor —lo que entra hacia él y lo que él manda a
# internet—, porque para el kernel ambos son tráfico enrutado entre dos
# interfaces. Sin "-i", un DROP a "--dport 443" también mata las salidas de los
# contenedores hacia cualquier :443 de fuera: --dport es "el puerto del
# servicio al que va este paquete", que tanto puede ser nuestro Traefik como el
# de github.com. Eso tumbó el despliegue del 2026-08-03 (Coolify no pudo hacer
# git ls-remote contra GitHub; habría fallado igual el npm ci del build).
# Filtramos por la interfaz PÚBLICA y no excluyendo los puentes de Docker
# porque los "br-xxxx" los nombra Docker con un hash y cambian al recrear una
# red: la regla dejaría de proteger sin avisar.
#
# Las RESPUESTAS de una conexión entrante no casan con el DROP (su destino es
# el puerto efímero del cliente, no el 443), por eso la web funciona.
#
# RECUPERACIÓN DE EMERGENCIA (desde tu SSH, si la web dejara de cargar):
#     iptables -F DOCKER-USER && ip6tables -F DOCKER-USER
#
set -euo pipefail

MARCA="cf-only"   # etiqueta para reconocer y borrar solo NUESTRAS reglas

# La interfaz por la que se sale a internet, sacada del enrutado y no escrita a
# mano: es por donde ENTRA todo lo que viene de fuera.
WAN="$(ip -o -4 route show to default | awk '{print $5}' | head -1)"
if [ -z "$WAN" ]; then
  echo "ERROR: no encuentro la interfaz pública (ruta por defecto)." >&2
  exit 1
fi

# En el ARRANQUE, Docker tarda en crear la cadena DOCKER-USER. Esperamos a que
# exista (hasta ~60s) para que el @reboot no falle.
for _ in $(seq 1 30); do
  iptables -L DOCKER-USER -n >/dev/null 2>&1 && break
  sleep 2
done

# Descargar PRIMERO los rangos. Si falla, salimos sin tocar nada: mejor no
# cambiar el cortafuegos que dejarlo bloqueando a todo el mundo.
V4="$(curl -fsSL https://www.cloudflare.com/ips-v4 || true)"
V6="$(curl -fsSL https://www.cloudflare.com/ips-v6 || true)"
if [ -z "$V4" ] || [ -z "$V6" ]; then
  echo "ERROR: no pude descargar los rangos de Cloudflare. No se cambia nada." >&2
  exit 1
fi

# Borra solo NUESTRAS reglas anteriores (por el comentario MARCA)
purgar() {
  local ipt="$1" n
  while n="$($ipt -L DOCKER-USER --line-numbers -n 2>/dev/null \
              | awk -v m="$MARCA" '$0 ~ m {print $1; exit}')"; [ -n "${n:-}" ]; do
    $ipt -D DOCKER-USER "$n"
  done
}

aplicar() {
  local ipt="$1" rangos="$2"
  purgar "$ipt"
  # El DROP va PRIMERO, para que quede por encima de cualquier RETURN por
  # defecto que Docker pudiera tener; los permisos de Cloudflare se insertan
  # luego, quedando por ENCIMA del DROP (iptables evalúa de arriba abajo).
  # "-i $WAN" en las CUATRO: solo se filtra lo que llega de fuera (ver cabecera).
  $ipt -I DOCKER-USER -i "$WAN" -p udp --dport 443                  -m comment --comment "$MARCA" -j DROP
  $ipt -I DOCKER-USER -i "$WAN" -p tcp -m multiport --dports 80,443 -m comment --comment "$MARCA" -j DROP
  # El PANEL DE COOLIFY (8000). No lleva RETURN de nadie: se cierra a todo
  # internet, sin excepciones. Se entra por un túnel SSH, que entrega su
  # tráfico por 'lo' y por tanto no pasa por FORWARD ni ve estas reglas:
  #     ssh -N -L 8000:localhost:8000 root@IP   →   http://localhost:8000
  #
  # Es el puerto desde el que se despliega y se leen los secretos, así que
  # estaba peor expuesto que la propia aplicación: sin Cloudflare delante y
  # sin cortafuegos, porque las reglas de arriba solo miran 80/443.
  #
  # OJO con el puerto: Docker publica el 8000 del host contra el 8080 DEL
  # CONTENEDOR, y cuando el paquete llega a DOCKER-USER la traducción YA se
  # ha hecho (nat/PREROUTING va antes que filter/FORWARD). Un `--dport 8000`
  # aquí no casaría con nada y no daría ningún error: creerías tenerlo
  # cerrado. Por eso se pregunta a conntrack por el destino ORIGINAL, que
  # además no se rompe si Coolify cambia su puerto interno.
  $ipt -I DOCKER-USER -i "$WAN" -p tcp -m conntrack --ctorigdstport 8000 -m comment --comment "$MARCA" -j DROP
  while read -r rango; do
    [ -z "$rango" ] && continue
    # El -i aquí es redundante (un contenedor nunca tendrá IP de Cloudflare),
    # pero va igual: las cuatro reglas se leen con el mismo criterio y no hay
    # que razonar la excepción cada vez que se toca esto.
    $ipt -I DOCKER-USER -i "$WAN" -s "$rango" -p udp --dport 443                  -m comment --comment "$MARCA" -j RETURN
    $ipt -I DOCKER-USER -i "$WAN" -s "$rango" -p tcp -m multiport --dports 80,443 -m comment --comment "$MARCA" -j RETURN
  done <<< "$rangos"
}

aplicar iptables  "$V4"
aplicar ip6tables "$V6"

echo "[$(date +%F' '%T)] Cortafuegos aplicado en $WAN: 80/443 solo desde Cloudflare, 8000 cerrado."

# COMPROBACIÓN: ¿los contenedores conservan salida a internet? Es la mitad del
# cortafuegos que no se ve —la web puede seguir cargando perfectamente mientras
# los despliegues están rotos— y es justo lo que se nos escapó al aplicarlo por
# primera vez. Informativa y a prueba de fallos: no cambia reglas ni corta el
# cron si Docker aún no está listo (caso típico del @reboot).
codigo="$(timeout 60 docker run --rm curlimages/curl:latest \
  -sS -m 10 -o /dev/null -w '%{http_code}' https://github.com 2>/dev/null || true)"
if [ "$codigo" = "200" ]; then
  echo "  OK: un contenedor llega a https://github.com (los deploys funcionarán)."
else
  echo "  AVISO: un contenedor NO llegó a https://github.com (respuesta: '${codigo:-sin respuesta}')." >&2
  echo "  Si Docker estaba arrancando, ignóralo y repite el script a mano." >&2
  echo "  Si se repite, los despliegues fallarán: revisa 'iptables -L DOCKER-USER -n'." >&2
fi

# La otra mitad —que el origen SIGA cerrado— NO se puede probar desde aquí: un
# paquete que nace en el host hacia su propia IP no pasa por FORWARD, así que
# no toca estas reglas y siempre daría "abierto". Hay que probarlo DESDE FUERA:
#   curl -sk -m 10 --resolve TUDOMINIO:443:<IP-DEL-VPS> https://TUDOMINIO
# debe quedarse colgado hasta el timeout (ver DESPLIEGUE.md §9).
