// Package chainregistry provides functionality to parse and work with Cosmos chain registry data
package chainregistry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Chain represents the chain.json data structure
type Chain struct {
	ChainName    string       `json:"chain_name"`
	Status       string       `json:"status"`
	NetworkType  string       `json:"network_type"`
	PrettyName   string       `json:"pretty_name"`
	ChainID      string       `json:"chain_id"`
	Bech32Prefix string       `json:"bech32_prefix"`
	DaemonName   string       `json:"daemon_name"`
	NodeHome     string       `json:"node_home"`
	Codebase     Codebase     `json:"codebase"`
	Peers        Peers        `json:"peers"`
	APIs         APIs         `json:"apis"`
	Images       []ChainImage `json:"images"`
	LogoURIs     LogoURIs     `json:"logo_URIs"`
	Description  string       `json:"description,omitempty"`
}

// Codebase represents the codebase section of the chain.json file
type Codebase struct {
	GitRepo            string            `json:"git_repo"`
	RecommendedVersion string            `json:"recommended_version"`
	CompatibleVersions []string          `json:"compatible_versions"`
	Consensus          CodebaseConsensus `json:"consensus,omitempty"`
	Cosmwasm           *CodebaseCosmwasm `json:"cosmwasm,omitempty"`
	Binaries           Binaries          `json:"binaries,omitempty"`
}

// CodebaseConsensus represents the consensus section of the codebase
type CodebaseConsensus struct {
	Type    string `json:"type"`
	Version string `json:"version"`
}

// CodebaseCosmwasm represents the cosmwasm section of the codebase
type CodebaseCosmwasm struct {
	Enabled bool `json:"enabled"`
}

// Binaries represents the binaries section of the codebase
type Binaries struct {
	LinuxAmd64  string `json:"linux/amd64,omitempty"`
	LinuxArm64  string `json:"linux/arm64,omitempty"`
	DarwinAmd64 string `json:"darwin/amd64,omitempty"`
	DarwinArm64 string `json:"darwin/arm64,omitempty"`
}

// Peers represents the peers section of the chain.json file
type Peers struct {
	Seeds           []Peer `json:"seeds"`
	PersistentPeers []Peer `json:"persistent_peers"`
}

// Peer represents a peer endpoint
type Peer struct {
	ID       string `json:"id"`
	Address  string `json:"address"`
	Provider string `json:"provider"`
}

// APIs represents the API endpoints for the chain
type APIs struct {
	RPC  []API `json:"rpc"`
	REST []API `json:"rest"`
	GRPC []API `json:"grpc"`
}

// API represents an API endpoint
type API struct {
	Address  string `json:"address"`
	Provider string `json:"provider"`
}

// ChainImage represents an image for the chain
type ChainImage struct {
	PNG   string     `json:"png,omitempty"`
	SVG   string     `json:"svg,omitempty"`
	Theme ImageTheme `json:"theme,omitempty"`
}

// ImageTheme represents the theme for an image
type ImageTheme struct {
	PrimaryColorHex string `json:"primary_color_hex"`
}

// LogoURIs represents logo URIs for the chain
type LogoURIs struct {
	PNG string `json:"png,omitempty"`
	SVG string `json:"svg,omitempty"`
}

// Registry represents the chain registry
type Registry struct {
	Chains map[string]*Chain
}

// NewRegistry creates a new instance of the chain registry
func NewRegistry(registryPath string) (*Registry, error) {
	registry := &Registry{
		Chains: make(map[string]*Chain),
	}

	// Walk through the registry path to find all chain.json files
	err := filepath.Walk(registryPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories and non-chain.json files
		if info.IsDir() || info.Name() != "chain.json" {
			return nil
		}

		// Skip test networks
		if filepath.Base(filepath.Dir(filepath.Dir(path))) == "testnets" {
			return nil
		}

		// Read and parse the chain.json file
		chain, err := parseChainJSON(path)
		if err != nil {
			fmt.Printf("Warning: Failed to parse chain.json at %s: %v\n", path, err)
			return nil
		}

		// Add the chain to the registry
		registry.Chains[chain.ChainName] = chain
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk registry path: %w", err)
	}

	return registry, nil
}

// parseChainJSON parses a chain.json file into a Chain struct
func parseChainJSON(path string) (*Chain, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read chain.json: %w", err)
	}

	var chain Chain
	if err := json.Unmarshal(data, &chain); err != nil {
		return nil, fmt.Errorf("failed to unmarshal chain.json: %w", err)
	}

	return &chain, nil
}

// GetChain returns a chain by name
func (r *Registry) GetChain(name string) (*Chain, bool) {
	chain, ok := r.Chains[name]
	return chain, ok
}

// GetLiveChains returns all chains with status "live"
func (r *Registry) GetLiveChains() []*Chain {
	var chains []*Chain
	for _, chain := range r.Chains {
		if chain.Status == "live" && chain.NetworkType == "mainnet" {
			chains = append(chains, chain)
		}
	}
	return chains
}

// GetPrettyNames returns all chain pretty names
func (r *Registry) GetPrettyNames() []string {
	var names []string
	for _, chain := range r.GetLiveChains() {
		names = append(names, chain.PrettyName)
	}
	return names
}

// GetChainByPrettyName returns a chain by its pretty name
func (r *Registry) GetChainByPrettyName(prettyName string) (*Chain, bool) {
	for _, chain := range r.Chains {
		if chain.PrettyName == prettyName {
			return chain, true
		}
	}
	return nil, false
}
