#!/bin/bash
CHAIN="osmosis"
GIT_LINK="https://raw.githubusercontent.com/cosmos/chain-registry/master"
ALTLINK="https://raw.githubusercontent.com/clemensgg/RELAYER-dev-crew/main/chains"
GOLINK="https://git.io/vQhTU"
DATABASE="goleveldb"
echo "---------------------- S T A T E - S Y N C ----------------------"

    #getopts
while getopts ":c:d:h" option
	do
	case $option in
	c) CHAIN="$OPTARG"      ;;
    d) DATABASE="$OPTARG"   ;;   
    h) echo "Spin up & state-sync Cosmos-SDK Node (cosmoshub, osmosis, terra)
Usage: ./statesync.sh -c CHAIN (-X)
   -c CHAIN     Choose chain (cosmoshub | osmosis | terra) (default \"osmosis\")
   -d DATABASE  Choose database backend (goleveldb | rocksdb) (default \"goleveldb\")
   -h           print help message" && exit 0
       ;;
    \?) echo "Invalid option -$OPTARG" >&2 && exit 1
       ;;
	esac
	done

    #main
main() {
    check_input
    install_dependencies
    install_go
    fetch_cr
    check_rpc
    build_init
    config
    start
}

    #helperfunction check unique vaulues
unique_values() {
    typeset i
    for i do
        [ "$1" = "$i" ] || return 1
    done
    return 0
}

    #check input
check_input() {
    if [[ "$CHAIN" != "cosmoshub" ]] && [[ "$CHAIN" != "osmosis" ]] && [[ "$CHAIN" != "terra" ]] ; then
        echo "Invalid chain: $CHAIN (supported chains: cosmoshub | osmosis | terra)" >&2 && exit 1
    fi
    if [[ "$DATABASE" != "goleveldb" ]] && [[ "$DATABASE" != "rocksdb" ]] ; then
        echo "Invalid database backend: $CHAIN (supported database backends: goleveldb | rocksdb)" >&2 && exit 1
    fi
}

    #install basic dependencies
install_dependencies() {
    echo "> updating dependencies..."
    sudo apt update -qq && sudo apt upgrade -qq
    sudo apt install -qq build-essential git curl jq wget
}

    #install go
install_go() {
    echo "> installing go..."
    sudo rm -rf /usr/local/go && sudo rm -rf $HOME/.go
    wget -q -O - $GOLINK | bash && source $HOME/.bashrc
}

    #fetch chain-registry
fetch_cr() {
    echo "> fetching chain-registry..."
    echo "-----------------------------------------------------------------"
    case $CHAIN in
        cosmoshub)
            CHAIN_JSON=$(curl -s ${GIT_LINK}/cosmoshub/chain.json)
            TRUST_PERIOD=336h0m0s
            HEIGHT_DIFF=4500
            ;;
        osmosis)
            CHAIN_JSON=$(curl -s ${GIT_LINK}/osmosis/chain.json)
            TRUST_PERIOD=224h0m0s
            HEIGHT_DIFF=3000
            ;;
        terra)
            CHAIN_JSON=$(curl -s ${GIT_LINK}/terra/chain.json)
            TRUST_PERIOD=336h0m0s
            HEIGHT_DIFF=4500
            ;;
    esac

    NODE_HOME_DIR=$(echo $CHAIN_JSON | jq -r '.node_home') 
    NODE_HOME_DIR=$(eval echo $NODE_HOME_DIR)
    CHAIN_NAME=$(echo $CHAIN_JSON | jq -r '.chain_name')
    CHAIN_ID=$(echo $CHAIN_JSON | jq -r '.chain_id')
    NODED=$(echo $CHAIN_JSON | jq -r '.daemon_name')
    GEN_URL=$(echo $CHAIN_JSON | jq -r '.genesis.genesis_url')
    DPATH=$(echo $CHAIN_JSON | jq -r '.slip44')
    GIT_REPO=$(echo $CHAIN_JSON | jq -r '.codebase.git_repo')
    VERSION=$(echo $CHAIN_JSON | jq -r '.codebase.recommended_version')
    SEEDS=$(echo $CHAIN_JSON | jq -r '.peers.seeds')
    RPC_SERVERS=$(echo $CHAIN_JSON | jq -r '.apis.rpc')
    MEP2P=$(curl -s ifconfig.me):26656
    SEEDLIST=""
    PEERLIST=""
    RPCLIST=""

    readarray -t arr < <(jq -c '.[]' <<< $SEEDS)
    for item in ${arr[@]}; do
        ID=$(echo $item | jq -r '.id')
        ADD=$(echo $item | jq -r '.address')
        SEEDLIST="${SEEDLIST},${ID}@${ADD}"
    done
    readarray -t arr < <(jq -c '.[]' <<< $RPC_SERVERS)
    for item in ${arr[@]}; do
        ADD=$(echo $item | jq -r '.address')

            #seed is on another network, makes hash-check fail   
        if [[ "$ADD" == *"osmosis.validator.network"* ]]; then      
            ADD="https://osmosis.stakesystems.io:2053"      
        fi
        RPCLIST="${RPCLIST},${ADD}"
    done
    SEEDLIST="${SEEDLIST:1}"
    RPCLIST="${RPCLIST:1}"

        #fetch alternative seeds
    if [[ "$CHAIN" == "osmosis" ]] || [[ "$CHAIN" == "terra" ]] ; then
        ALTSEEDS=$(curl -s ${ALTLINK}/${CHAIN}/seeds.txt)
        echo "> adding alternative seeds from ${ALTLINK}/${CHAIN}/seeds.txt"
        SEEDLIST="${SEEDLIST},${ALTSEEDS}"
        #SEEDLIST=${ALTSEEDS}
    fi

        #fix osmo version
    if [[ "$CHAIN" == "osmosis" ]] ; then
        VERSION="v6.0.0"
    fi  

    echo "home dir: $NODE_HOME_DIR"
    echo "chain name: $CHAIN_NAME"
    echo "chain id: $CHAIN_ID"
    echo "daemon name: $NODED"
    echo "genesis file url: $GEN_URL"
    echo "git repo: $GIT_REPO"
    echo "version: $VERSION"
    echo "seeds: $SEEDLIST"
    echo "rpc servers: $RPCLIST"
}

    #check rpc connectivity, query trust hash
check_rpc(){
    HASHES=""
    echo "> checking RPC connectivity..."
    IFS=',' read -ra rpcarr <<< "$RPCLIST"
    for rpc in ${rpcarr[@]}; do
        RPCNUM=$((RPCNUM+1))
        RES=$(curl -s $rpc/status --connect-timeout 3) || true
        if [ -z "$RES" ] || [[ "$RES" == *"Forbidden"* ]]; then
            echo "> $rpc didn't respond. dropping..."
        else
            HEIGHT=$(echo $RES | jq -r '.result.sync_info.latest_block_height')
            re='.*[0-9].*'
            CHECKHEIGHT=$(($HEIGHT-$HEIGHT_DIFF))
            RES=$(curl -s "$rpc/commit?height=$CHECKHEIGHT")
            HASH=$(echo $RES | jq -r '.result.signed_header.commit.block_id.hash')
            TRUSTHASH=$HASH
            HASHES="${HASHES},${HASH}"
            if [[ "$rpc" == *"https://"* ]] && [[ ! $rpc =~ $re ]] ; then
                rpc=$rpc:443
            fi
            RPCLIST_FINAL="${RPCLIST_FINAL},${rpc}"
        fi
    done
    HASHES="${HASHES:1}"
    RPCLIST_FINAL="${RPCLIST_FINAL:1}"
    echo "working rpc list: $RPCLIST_FINAL"
    if unique_values "${HASHES[@]}"; then
        echo "> hash checks passed!"
        echo "> trust hash: $TRUSTHASH"
    else
        echo "> hash checks failed, exiting..."
        exit
    fi
    echo "-----------------------------------------------------------------"
}

    #build and initialize node
build_init(){
    echo "> building $NODED $VERSION from $GIT_REPO..."
    if [ -d "$HOME/$CHAIN_NAME-core" ] ; then
        cd $HOME/$CHAIN_NAME-core && git fetch
    else
        mkdir -p $HOME/$CHAIN_NAME-core
        git clone $GIT_REPO $HOME/$CHAIN_NAME-core && cd $HOME/$CHAIN_NAME-core
    fi
    git checkout $VERSION && make install && cd

    RAND=$(echo $RANDOM | md5sum | head -c 6; echo;)
    echo "> initializing $NODED with moniker $RAND"
    echo "> home dir: ${NODE_HOME_DIR}"
    
    $NODED init $RAND --chain-id=$CHAIN_ID -o

    echo "> downloading genesis from $GEN_URL..."
    rm ${NODE_HOME_DIR}/config/genesis.json
    if [[ "$GEN_URL" == *".gz"* ]]; then
        wget -q $GEN_URL -O genesis.json.gz
        gunzip -df genesis.json.gz && mv genesis.json ${NODE_HOME_DIR}/config/genesis.json
    else
        wget -q $GEN_URL -O ${NODE_HOME_DIR}/config/genesis.json
    fi
}

    #configure state-sync
config() {
    echo "> configuring seeds & state-sync"
    sed -i '/rpc_servers = ""/c rpc_servers = "'$RPCLIST_FINAL'"' $NODE_HOME_DIR/config/config.toml
    sed -i 's/external_address = ""/external_address = "'$MEP2P'"/g' $NODE_HOME_DIR/config/config.toml
    sed -i 's/seeds = .*/seeds = "'$SEEDLIST'"/g' $NODE_HOME_DIR/config/config.toml
    sed -i 's/enable = false/enable = true/g' $NODE_HOME_DIR/config/config.toml
    sed -i 's/trust_height.*/trust_height = '$CHECKHEIGHT'/g' $NODE_HOME_DIR/config/config.toml
    sed -i 's/trust_hash.*/trust_hash = "'$TRUSTHASH'"/g' $NODE_HOME_DIR/config/config.toml
    sed -i 's/trust_period.*/trust_period = "'$TRUST_PERIOD'"/g' $NODE_HOME_DIR/config/config.toml
}

    #spin up node
start() {
    echo "> starting $NODED..."
    $NODED start --home $NODE_HOME_DIR --x-crisis-skip-assert-invariants --db_backend $DATABASE || true
    
        #osmosisd needs tendermint app version set to 1
    if [[ "$CHAIN" == "osmosis" ]] ; then
        echo "installing tendermint..."
        if [ -d "$HOME/tendermint" ] ; then
            sudo rm -r $HOME/tendermint
        fi
        git clone https://github.com/tendermint/tendermint && cd tendermint
        git checkout remotes/origin/callum/app-version && make install && cd
        tendermint set-app-version 1 --home $NODE_HOME_DIR
        $NODED start --home $NODE_HOME_DIR --x-crisis-skip-assert-invariants --db_backend $DATABASE || true
    fi
    echo "done!"
}


main; exit
