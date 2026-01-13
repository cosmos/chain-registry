curl -s https://26657.genesisl1.org/net_info | jq '
  def provider_from_moniker:
    (tostring
     | gsub("[^A-Za-z0-9]+";" ")
     | split(" ")
     | map(select(length>0))
     | .[0]);

  [ .result.peers[] |
    (.node_info.listen_addr | tostring | sub("^tcp://";"")) as $la |
    (try ($la | capture(":(?<p>[0-9]+)$").p) catch "26656") as $port |
    (.node_info.moniker | provider_from_moniker) as $provider |
    {
      id: .node_info.id,
      address: (
        if ($la | test("^(0\\.0\\.0\\.0|127\\.0\\.0\\.1|localhost|\\[?::\\]?)(:|$)"))
        then (.remote_ip + ":" + $port)
        else $la
        end
      ),
      provider: $provider
    }
  ]
'

