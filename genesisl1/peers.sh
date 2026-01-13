#!/bin/sh
set -eu

NETINFO_URL="https://26657.genesisl1.org/net_info"
TIMEOUT_SEC=2

LIST_FILE="$(mktemp)"
OUT_FILE="$(mktemp)"

# Build a TSV list: host \t port \t json_object
# - provider extracted from moniker
# - address computed: listen_addr if routable, else remote_ip:port
curl -s "$NETINFO_URL" | jq -r '
  def provider_from_moniker:
    (tostring
     | gsub("[^A-Za-z0-9]+";" ")
     | split(" ")
     | map(select(length>0))
     | .[0]);

  .result.peers[] |
    (.node_info.listen_addr | tostring | sub("^tcp://";"")) as $la |
    (try ($la | capture(":(?<p>[0-9]+)$").p) catch "26656") as $port |
    (.node_info.moniker | provider_from_moniker) as $provider |
    ($la | test("^(0\\.0\\.0\\.0|127\\.0\\.0\\.1|localhost|\\[?::\\]?)(:|$)")) as $nonroutable |

    # host for probing:
    (if $nonroutable then .remote_ip
     else
       (if ($la | test("^\\[")) then ($la | capture("^\\[(?<h>[^\\]]+)\\]").h)
        else ($la | sub(":.*$";""))
        end)
     end) as $host |

    # address for output:
    (if $nonroutable then (.remote_ip + ":" + $port) else $la end) as $addr |

    # TSV: host, port, json-object
    [$host, $port, ( {id: .node_info.id, address: $addr, provider: $provider} | tojson )] | @tsv
' > "$LIST_FILE"

TAB="$(printf '\t')"
while IFS="$TAB" read -r host port objjson; do
  # TCP probe using bash's /dev/tcp
  if timeout "$TIMEOUT_SEC" bash -c "echo > /dev/tcp/$host/$port" >/dev/null 2>&1; then
    printf '%s\n' "$objjson" >> "$OUT_FILE"
  fi
done < "$LIST_FILE"

# Output JSON array
if [ -s "$OUT_FILE" ]; then
  jq -s '.' "$OUT_FILE"
else
  echo "[]"
fi

rm -f "$LIST_FILE" "$OUT_FILE"
