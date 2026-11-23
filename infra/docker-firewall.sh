#!/usr/bin/env bash
set -euo pipefail
# Apply to each public-interface default route, including IPv6 where Docker enables it.
for family in 4 6; do
  firewall=iptables
  [[ "$family" == 6 ]] && firewall=ip6tables
  if ! "$firewall" -w -nL DOCKER-USER >/dev/null 2>&1; then
    [[ "$family" == 6 ]] && continue
    echo 'Docker DOCKER-USER chain missing.' >&2
    exit 1
  fi
  "$firewall" -w -N AQ-INGRESS 2>/dev/null || true
  "$firewall" -w -F AQ-INGRESS
  "$firewall" -w -A AQ-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  "$firewall" -w -A AQ-INGRESS -p tcp -m conntrack --ctorigdstport 80 -j RETURN
  "$firewall" -w -A AQ-INGRESS -p tcp -m conntrack --ctorigdstport 443 -j RETURN
  "$firewall" -w -A AQ-INGRESS -p udp -m conntrack --ctorigdstport 1700 -j RETURN
  "$firewall" -w -A AQ-INGRESS -j DROP
  while read -r interface; do
    [[ -n "$interface" ]] || continue
    "$firewall" -w -C DOCKER-USER -i "$interface" -j AQ-INGRESS 2>/dev/null || \
      "$firewall" -w -I DOCKER-USER 1 -i "$interface" -j AQ-INGRESS
  done < <(ip -"$family" route show default | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | sort -u)
done
