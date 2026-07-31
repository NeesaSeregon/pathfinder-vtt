#!/usr/bin/env bash
#
# Restringe los puertos 80 y 443 del ORIGEN a SOLO las IPs de Cloudflare.
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
# RECUPERACIÓN DE EMERGENCIA (desde tu SSH, si la web dejara de cargar):
#     iptables -F DOCKER-USER && ip6tables -F DOCKER-USER
#
set -euo pipefail

MARCA="cf-only"   # etiqueta para reconocer y borrar solo NUESTRAS reglas

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
  $ipt -I DOCKER-USER -p udp --dport 443                  -m comment --comment "$MARCA" -j DROP
  $ipt -I DOCKER-USER -p tcp -m multiport --dports 80,443 -m comment --comment "$MARCA" -j DROP
  while read -r rango; do
    [ -z "$rango" ] && continue
    $ipt -I DOCKER-USER -s "$rango" -p udp --dport 443                  -m comment --comment "$MARCA" -j RETURN
    $ipt -I DOCKER-USER -s "$rango" -p tcp -m multiport --dports 80,443 -m comment --comment "$MARCA" -j RETURN
  done <<< "$rangos"
}

aplicar iptables  "$V4"
aplicar ip6tables "$V6"

echo "[$(date +%F' '%T)] Cortafuegos Cloudflare aplicado: 80/443 solo desde Cloudflare."
