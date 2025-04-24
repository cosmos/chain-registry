// Package node provides functionality for managing Cosmos blockchain nodes
package node

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/faddat/chain-registry/pkg/chainregistry"
)

// Node represents a Cosmos blockchain node
type Node struct {
	Chain          *chainregistry.Chain
	DataDir        string
	Binary         string
	BinaryPath     string
	HomeDir        string
	StateSyncRPC   string
	StateSyncPeers []string
	LogWriter      io.Writer
	cmd            *exec.Cmd
}

// NewNode creates a new Node instance for a given chain
func NewNode(chain *chainregistry.Chain, dataDir string, logWriter io.Writer) (*Node, error) {
	if chain == nil {
		return nil, fmt.Errorf("chain cannot be nil")
	}

	// Determine the binary name
	binary := chain.DaemonName
	if binary == "" {
		return nil, fmt.Errorf("daemon name not specified in chain.json")
	}

	// Set the data directory
	if dataDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get user home directory: %w", err)
		}
		dataDir = filepath.Join(homeDir, ".chain-registry-app")
	}

	// Create the node directories
	homeDir := filepath.Join(dataDir, chain.ChainName)
	if err := os.MkdirAll(homeDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create node home directory: %w", err)
	}

	// If the log writer is nil, use os.Stdout
	if logWriter == nil {
		logWriter = os.Stdout
	}

	node := &Node{
		Chain:      chain,
		DataDir:    dataDir,
		Binary:     binary,
		BinaryPath: filepath.Join(dataDir, "bin", binary),
		HomeDir:    homeDir,
		LogWriter:  logWriter,
	}

	return node, nil
}

// Download downloads the binary for the chain
func (n *Node) Download() error {
	// Create the bin directory if it doesn't exist
	binDir := filepath.Join(n.DataDir, "bin")
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return fmt.Errorf("failed to create bin directory: %w", err)
	}

	// Check if the binary already exists
	if _, err := os.Stat(n.BinaryPath); err == nil {
		fmt.Fprintf(n.LogWriter, "\n===== BINARY ALREADY EXISTS =====\n")
		fmt.Fprintf(n.LogWriter, "Path: %s\n", n.BinaryPath)
		fmt.Fprintf(n.LogWriter, "Skipping download\n\n")
		return nil
	}

	// Determine the URL for the binary based on the OS and architecture
	var url string
	switch runtime.GOOS {
	case "linux":
		if runtime.GOARCH == "amd64" {
			url = n.Chain.Codebase.Binaries.LinuxAmd64
		} else if runtime.GOARCH == "arm64" {
			url = n.Chain.Codebase.Binaries.LinuxArm64
		}
	case "darwin":
		if runtime.GOARCH == "amd64" {
			url = n.Chain.Codebase.Binaries.DarwinAmd64
		} else if runtime.GOARCH == "arm64" {
			url = n.Chain.Codebase.Binaries.DarwinArm64
		}
	}

	if url == "" {
		fmt.Fprintf(n.LogWriter, "\n===== NO PRECOMPILED BINARY AVAILABLE =====\n")
		fmt.Fprintf(n.LogWriter, "Platform: %s/%s\n", runtime.GOOS, runtime.GOARCH)
		fmt.Fprintf(n.LogWriter, "Attempting to build from source...\n\n")
		return n.CompileFromSource()
	}

	// Download the binary
	fmt.Fprintf(n.LogWriter, "\n===== DOWNLOADING BINARY =====\n")
	fmt.Fprintf(n.LogWriter, "Chain: %s\n", n.Chain.PrettyName)
	fmt.Fprintf(n.LogWriter, "Source: %s\n", url)
	fmt.Fprintf(n.LogWriter, "Destination: %s\n", n.BinaryPath)
	fmt.Fprintf(n.LogWriter, "Starting download...\n\n")

	// Make request with proper headers for redirect following
	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return nil
		},
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Chain-Registry-App/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to download binary: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download binary, status code: %d", resp.StatusCode)
	}

	// Get Content-Length if available for progress reporting
	contentLength := resp.ContentLength
	if contentLength > 0 {
		fmt.Fprintf(n.LogWriter, "File size: %.2f MB\n\n", float64(contentLength)/(1024*1024))
	} else {
		fmt.Fprintf(n.LogWriter, "File size: unknown\n\n")
	}

	// Create the binary file
	out, err := os.OpenFile(n.BinaryPath, os.O_CREATE|os.O_WRONLY, 0755)
	if err != nil {
		return fmt.Errorf("failed to create binary file: %w", err)
	}
	defer out.Close()

	// Create a progress tracking wrapper
	var downloaded int64
	progressInterval := time.NewTicker(time.Second)
	defer progressInterval.Stop()

	done := make(chan bool)
	defer close(done)

	// Progress reporting goroutine
	go func() {
		lastPercent := -1
		for {
			select {
			case <-progressInterval.C:
				if contentLength > 0 {
					percent := int(float64(downloaded) / float64(contentLength) * 100)
					if percent != lastPercent && percent <= 100 {
						fmt.Fprintf(n.LogWriter, "Download progress: %d%% (%.2f MB / %.2f MB)\n",
							percent,
							float64(downloaded)/(1024*1024),
							float64(contentLength)/(1024*1024))
						lastPercent = percent
					}
				} else {
					fmt.Fprintf(n.LogWriter, "Downloaded: %.2f MB\n", float64(downloaded)/(1024*1024))
				}
			case <-done:
				return
			}
		}
	}()

	// Write the binary to disk with progress tracking
	reader := &ProgressReader{
		Reader: resp.Body,
		OnRead: func(n int) {
			downloaded += int64(n)
		},
	}

	_, err = io.Copy(out, reader)
	if err != nil {
		return fmt.Errorf("failed to write binary to disk: %w", err)
	}

	// Signal progress reporting to complete
	done <- true

	// Force one final progress update at 100%
	if contentLength > 0 {
		fmt.Fprintf(n.LogWriter, "Download progress: 100%% (%.2f MB / %.2f MB)\n",
			float64(downloaded)/(1024*1024),
			float64(contentLength)/(1024*1024))
	}

	fmt.Fprintf(n.LogWriter, "\n===== DOWNLOAD COMPLETED SUCCESSFULLY =====\n")
	fmt.Fprintf(n.LogWriter, "Binary downloaded to %s\n\n", n.BinaryPath)
	return nil
}

// ProgressReader is a wrapper that reports read progress
type ProgressReader struct {
	Reader io.Reader
	OnRead func(n int)
}

// Read implements io.Reader
func (pr *ProgressReader) Read(p []byte) (n int, err error) {
	n, err = pr.Reader.Read(p)
	if n > 0 && pr.OnRead != nil {
		pr.OnRead(n)
	}
	return
}

// CompileFromSource clones the repository and builds the binary from source
func (n *Node) CompileFromSource() error {
	// Check if git is installed
	if _, err := exec.LookPath("git"); err != nil {
		return fmt.Errorf("git is required to build from source: %w", err)
	}

	// Check if go is installed
	if _, err := exec.LookPath("go"); err != nil {
		return fmt.Errorf("go is required to build from source: %w", err)
	}

	fmt.Fprintf(n.LogWriter, "===== STARTING BUILD PROCESS =====\n")

	// Create a source directory
	sourceDir := filepath.Join(n.DataDir, "source", n.Chain.ChainName)
	if err := os.MkdirAll(sourceDir, 0755); err != nil {
		return fmt.Errorf("failed to create source directory: %w", err)
	}

	// Check if the git repo is specified
	if n.Chain.Codebase.GitRepo == "" {
		return fmt.Errorf("git repository is not specified in chain info")
	}

	// Clone the repository if it doesn't exist
	repoPath := filepath.Join(sourceDir, "repo")
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		fmt.Fprintf(n.LogWriter, "\n===== CLONING REPOSITORY =====\n")
		fmt.Fprintf(n.LogWriter, "Source: %s\n", n.Chain.Codebase.GitRepo)
		fmt.Fprintf(n.LogWriter, "Destination: %s\n\n", repoPath)

		cmd := exec.Command("git", "clone", n.Chain.Codebase.GitRepo, repoPath)
		cmd.Stdout = n.LogWriter
		cmd.Stderr = n.LogWriter
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to clone repository: %w", err)
		}
	}

	// Checkout the recommended version if specified
	if n.Chain.Codebase.RecommendedVersion != "" {
		fmt.Fprintf(n.LogWriter, "\n===== CHECKING OUT VERSION %s =====\n\n", n.Chain.Codebase.RecommendedVersion)
		cmd := exec.Command("git", "checkout", n.Chain.Codebase.RecommendedVersion)
		cmd.Dir = repoPath
		cmd.Stdout = n.LogWriter
		cmd.Stderr = n.LogWriter
		if err := cmd.Run(); err != nil {
			fmt.Fprintf(n.LogWriter, "Warning: Failed to checkout version %s: %v\n", n.Chain.Codebase.RecommendedVersion, err)
			// Try to fetch updates and retry
			fmt.Fprintf(n.LogWriter, "\n===== FETCHING UPDATES =====\n\n")
			fetchCmd := exec.Command("git", "fetch", "--all")
			fetchCmd.Dir = repoPath
			fetchCmd.Stdout = n.LogWriter
			fetchCmd.Stderr = n.LogWriter
			if fetchErr := fetchCmd.Run(); fetchErr != nil {
				return fmt.Errorf("failed to fetch updates: %w", fetchErr)
			}

			// Retry checkout
			fmt.Fprintf(n.LogWriter, "\n===== RETRYING CHECKOUT =====\n\n")
			cmd = exec.Command("git", "checkout", n.Chain.Codebase.RecommendedVersion)
			cmd.Dir = repoPath
			cmd.Stdout = n.LogWriter
			cmd.Stderr = n.LogWriter
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("failed to checkout version after fetch: %w", err)
			}
		}
	}

	// Build the binary
	fmt.Fprintf(n.LogWriter, "\n===== BUILDING BINARY =====\n")
	fmt.Fprintf(n.LogWriter, "Command: go build -o %s ./cmd/%s\n\n", n.BinaryPath, n.Binary)

	buildCmd := exec.Command("go", "build", "-o", n.BinaryPath, "./cmd/"+n.Binary)
	buildCmd.Dir = repoPath
	buildCmd.Stdout = n.LogWriter
	buildCmd.Stderr = n.LogWriter
	if err := buildCmd.Run(); err != nil {
		// Try finding the main package if the default path doesn't work
		fmt.Fprintf(n.LogWriter, "\n===== DEFAULT BUILD FAILED, TRYING ALTERNATE METHODS =====\n")

		// Check if main.go exists in the repo root
		if _, err := os.Stat(filepath.Join(repoPath, "main.go")); err == nil {
			fmt.Fprintf(n.LogWriter, "\n===== ATTEMPTING BUILD FROM ROOT DIRECTORY =====\n\n")
			rootBuildCmd := exec.Command("go", "build", "-o", n.BinaryPath)
			rootBuildCmd.Dir = repoPath
			rootBuildCmd.Stdout = n.LogWriter
			rootBuildCmd.Stderr = n.LogWriter
			if rootBuildErr := rootBuildCmd.Run(); rootBuildErr == nil {
				fmt.Fprintf(n.LogWriter, "Binary built successfully using root directory build\n")
				fmt.Fprintf(n.LogWriter, "\n===== BUILD PROCESS COMPLETED SUCCESSFULLY =====\n\n")
				return nil
			}
		}

		// Try to find the entry point and build using make
		fmt.Fprintf(n.LogWriter, "\n===== TRYING 'make install' (WITHOUT -mod=readonly) =====\n\n")

		// First try to update go.mod if needed
		goModUpdateCmd := exec.Command("go", "mod", "tidy")
		goModUpdateCmd.Dir = repoPath
		goModUpdateCmd.Stdout = n.LogWriter
		goModUpdateCmd.Stderr = n.LogWriter
		goModUpdateCmd.Run() // Ignore errors, just try it

		// Some projects use 'make build' instead of 'make install'
		makeBuildCmd := exec.Command("make", "build")
		makeBuildCmd.Dir = repoPath
		makeBuildCmd.Stdout = n.LogWriter
		makeBuildCmd.Stderr = n.LogWriter
		if makeBuildErr := makeBuildCmd.Run(); makeBuildErr == nil {
			// Look for the binary in the build directory
			buildDir := filepath.Join(repoPath, "build")
			if _, err := os.Stat(buildDir); err == nil {
				// Find the binary in the build directory
				entries, err := os.ReadDir(buildDir)
				if err == nil && len(entries) > 0 {
					for _, entry := range entries {
						if !entry.IsDir() && (entry.Name() == n.Binary || strings.Contains(entry.Name(), n.Chain.ChainName)) {
							buildBinary := filepath.Join(buildDir, entry.Name())
							if copyErr := copyFile(buildBinary, n.BinaryPath); copyErr == nil {
								fmt.Fprintf(n.LogWriter, "Binary built with 'make build' and copied from %s\n", buildBinary)
								fmt.Fprintf(n.LogWriter, "\n===== BUILD PROCESS COMPLETED SUCCESSFULLY =====\n\n")
								return nil
							}
						}
					}
				}
			}
		}

		// Try make install without readonly flag
		makeCmd := exec.Command("make", "install")
		makeCmd.Dir = repoPath
		makeCmd.Stdout = n.LogWriter
		makeCmd.Stderr = n.LogWriter

		// Set environment variables to remove readonly flag if present in Makefile
		makeCmd.Env = append(os.Environ(), "GO_MOD_FLAGS=")

		var makeErrOutput bytes.Buffer
		makeCmd.Stderr = io.MultiWriter(n.LogWriter, &makeErrOutput)

		if makeErr := makeCmd.Run(); makeErr != nil {
			// Check if the error is about readonly flag
			if strings.Contains(makeErrOutput.String(), "updates to go.mod needed, disabled by -mod=readonly") {
				fmt.Fprintf(n.LogWriter, "\n===== DETECTED -mod=readonly ERROR, TRYING DIRECT GO INSTALL =====\n\n")

				// Try direct 'go install' without make
				goInstallCmd := exec.Command("go", "install", "./cmd/"+n.Binary)
				goInstallCmd.Dir = repoPath
				goInstallCmd.Stdout = n.LogWriter
				goInstallCmd.Stderr = n.LogWriter
				if installErr := goInstallCmd.Run(); installErr != nil {
					// Try a broader search
					fmt.Fprintf(n.LogWriter, "\n===== TRYING BROADER SEARCH FOR ENTRY POINT =====\n\n")

					// Use find to locate main packages
					findCmd := exec.Command("find", ".", "-type", "f", "-name", "*.go", "-exec", "grep", "-l", "func main", "{}", ";")
					findCmd.Dir = repoPath
					var outBuf bytes.Buffer
					findCmd.Stdout = &outBuf
					findCmd.Run() // Ignore errors

					// Try building each found main package
					mainFiles := strings.Split(outBuf.String(), "\n")
					for _, mainFile := range mainFiles {
						if mainFile == "" {
							continue
						}

						// Get directory containing the main file
						mainDir := filepath.Dir(mainFile)
						fmt.Fprintf(n.LogWriter, "Trying to build main package found in: %s\n", mainDir)

						buildMainCmd := exec.Command("go", "build", "-o", n.BinaryPath, mainDir)
						buildMainCmd.Dir = repoPath
						buildMainCmd.Stdout = n.LogWriter
						buildMainCmd.Stderr = n.LogWriter
						if buildErr := buildMainCmd.Run(); buildErr == nil {
							fmt.Fprintf(n.LogWriter, "Successfully built binary from %s\n", mainDir)
							fmt.Fprintf(n.LogWriter, "\n===== BUILD PROCESS COMPLETED SUCCESSFULLY =====\n\n")
							return nil
						}
					}
				} else {
					// go install succeeded, find and copy the binary
					gopath := os.Getenv("GOPATH")
					if gopath == "" {
						gopath = filepath.Join(os.Getenv("HOME"), "go")
					}
					binPath := filepath.Join(gopath, "bin", n.Binary)
					if _, statErr := os.Stat(binPath); statErr == nil {
						if copyErr := copyFile(binPath, n.BinaryPath); copyErr == nil {
							fmt.Fprintf(n.LogWriter, "Binary built with 'go install' and copied from %s\n", binPath)
							fmt.Fprintf(n.LogWriter, "\n===== BUILD PROCESS COMPLETED SUCCESSFULLY =====\n\n")
							return nil
						}
					}
				}
			}

			// Check if the binary was installed in GOPATH despite make errors
			gopath := os.Getenv("GOPATH")
			if gopath == "" {
				gopath = filepath.Join(os.Getenv("HOME"), "go")
			}
			binPath := filepath.Join(gopath, "bin", n.Binary)
			if _, statErr := os.Stat(binPath); statErr == nil {
				// Copy the binary to our destination
				fmt.Fprintf(n.LogWriter, "\n===== BINARY FOUND IN GOPATH, COPYING TO DESTINATION =====\n\n")
				if copyErr := copyFile(binPath, n.BinaryPath); copyErr != nil {
					return fmt.Errorf("failed to copy binary: %w", copyErr)
				}
				fmt.Fprintf(n.LogWriter, "Binary installed to %s\n", n.BinaryPath)
				fmt.Fprintf(n.LogWriter, "\n===== BUILD PROCESS COMPLETED SUCCESSFULLY =====\n\n")
				return nil
			}

			return fmt.Errorf("failed to build binary: %w", makeErr)
		}

		// If make install succeeds, check if the binary was installed in GOPATH
		gopath := os.Getenv("GOPATH")
		if gopath == "" {
			gopath = filepath.Join(os.Getenv("HOME"), "go")
		}
		binPath := filepath.Join(gopath, "bin", n.Binary)
		if _, statErr := os.Stat(binPath); statErr == nil {
			// Copy the binary to our destination
			fmt.Fprintf(n.LogWriter, "\n===== COPYING BINARY FROM GOPATH TO DESTINATION =====\n\n")
			if copyErr := copyFile(binPath, n.BinaryPath); copyErr != nil {
				return fmt.Errorf("failed to copy binary: %w", copyErr)
			}
			fmt.Fprintf(n.LogWriter, "Binary built and installed to %s\n", n.BinaryPath)
			fmt.Fprintf(n.LogWriter, "\n===== BUILD PROCESS COMPLETED SUCCESSFULLY =====\n\n")
			return nil
		}

		return fmt.Errorf("failed to build binary and couldn't find installed binary")
	}

	fmt.Fprintf(n.LogWriter, "Binary built successfully at %s\n", n.BinaryPath)
	fmt.Fprintf(n.LogWriter, "\n===== BUILD PROCESS COMPLETED SUCCESSFULLY =====\n\n")
	return nil
}

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer srcFile.Close()

	dstFile, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY, 0755)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		return fmt.Errorf("failed to copy file: %w", err)
	}

	return nil
}

// Initialize initializes the node
func (n *Node) Initialize() error {
	// Create the node config directory if it doesn't exist
	if err := os.MkdirAll(n.HomeDir, 0755); err != nil {
		return fmt.Errorf("failed to create node home directory: %w", err)
	}

	// Check if the node is already initialized
	configPath := filepath.Join(n.HomeDir, "config", "config.toml")
	if _, err := os.Stat(configPath); err == nil {
		fmt.Fprintf(n.LogWriter, "Node already initialized at %s\n", n.HomeDir)
		return nil
	}

	// Initialize the node
	cmd := exec.Command(n.BinaryPath, "init", "chain-registry-app", "--home", n.HomeDir, "--chain-id", n.Chain.ChainID)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = io.MultiWriter(&outBuf, n.LogWriter)
	cmd.Stderr = io.MultiWriter(&errBuf, n.LogWriter)

	fmt.Fprintf(n.LogWriter, "Initializing node with command: %s\n", cmd.String())
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to initialize node: %w, stderr: %s", err, errBuf.String())
	}

	fmt.Fprintf(n.LogWriter, "Node initialized at %s\n", n.HomeDir)
	return nil
}

// SetupStateSync sets up state sync configuration
func (n *Node) SetupStateSync() error {
	// Find a reliable RPC endpoint for state sync
	var rpcEndpoint string
	for _, rpc := range n.Chain.APIs.RPC {
		if strings.HasPrefix(rpc.Address, "https://") {
			rpcEndpoint = rpc.Address
			break
		}
	}

	if rpcEndpoint == "" && len(n.Chain.APIs.RPC) > 0 {
		rpcEndpoint = n.Chain.APIs.RPC[0].Address
	}

	if rpcEndpoint == "" {
		return fmt.Errorf("no RPC endpoint available for state sync")
	}

	// Get the chain status from the RPC endpoint
	fmt.Fprintf(n.LogWriter, "Getting chain status from %s\n", rpcEndpoint)
	resp, err := http.Get(fmt.Sprintf("%s/status", rpcEndpoint))
	if err != nil {
		return fmt.Errorf("failed to get chain status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to get chain status, status code: %d", resp.StatusCode)
	}

	// Parse the response
	var status struct {
		Result struct {
			SyncInfo struct {
				LatestBlockHeight string `json:"latest_block_height"`
			} `json:"sync_info"`
		} `json:"result"`
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, &status); err != nil {
		return fmt.Errorf("failed to unmarshal status response: %w", err)
	}

	// Check if the latest block height is available
	if status.Result.SyncInfo.LatestBlockHeight == "" {
		return fmt.Errorf("latest block height not available in status response")
	}

	// Convert the latest block height to an integer
	latestHeight, err := strconv.Atoi(status.Result.SyncInfo.LatestBlockHeight)
	if err != nil {
		return fmt.Errorf("failed to convert latest block height: %w", err)
	}

	// Calculate the trust height and trust hash
	trustHeight := latestHeight - 2000
	if trustHeight < 1 {
		trustHeight = 1
	}

	// Get the block hash at the trust height
	fmt.Fprintf(n.LogWriter, "Getting block at height %d\n", trustHeight)
	resp, err = http.Get(fmt.Sprintf("%s/block?height=%d", rpcEndpoint, trustHeight))
	if err != nil {
		return fmt.Errorf("failed to get block at height %d: %w", trustHeight, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to get block at height %d, status code: %d", trustHeight, resp.StatusCode)
	}

	// Parse the response
	var block struct {
		Result struct {
			BlockID struct {
				Hash string `json:"hash"`
			} `json:"block_id"`
		} `json:"result"`
	}

	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, &block); err != nil {
		return fmt.Errorf("failed to unmarshal block response: %w", err)
	}

	// Check if the block hash is available
	if block.Result.BlockID.Hash == "" {
		return fmt.Errorf("block hash not available in block response")
	}

	trustHash := block.Result.BlockID.Hash

	// Update the config.toml file
	configPath := filepath.Join(n.HomeDir, "config", "config.toml")
	file, err := os.Open(configPath)
	if err != nil {
		return fmt.Errorf("failed to open config.toml: %w", err)
	}
	defer file.Close()

	// Read the config.toml file
	var configLines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		configLines = append(configLines, scanner.Text())
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("failed to read config.toml: %w", err)
	}

	// Modify the config.toml file
	var modifiedLines []string
	for _, line := range configLines {
		// Update the state sync configuration
		if strings.HasPrefix(line, "enable = ") && strings.Contains(line, "[statesync]") {
			modifiedLines = append(modifiedLines, "enable = true")
		} else if strings.HasPrefix(line, "rpc_servers = ") {
			modifiedLines = append(modifiedLines, fmt.Sprintf(`rpc_servers = "%s,%s"`, rpcEndpoint, rpcEndpoint))
		} else if strings.HasPrefix(line, "trust_height = ") {
			modifiedLines = append(modifiedLines, fmt.Sprintf("trust_height = %d", trustHeight))
		} else if strings.HasPrefix(line, "trust_hash = ") {
			modifiedLines = append(modifiedLines, fmt.Sprintf(`trust_hash = "%s"`, trustHash))
		} else if strings.HasPrefix(line, "discovery_time = ") {
			modifiedLines = append(modifiedLines, "discovery_time = \"30s\"")
		} else {
			modifiedLines = append(modifiedLines, line)
		}
	}

	// Write the modified config.toml file
	if err := os.WriteFile(configPath, []byte(strings.Join(modifiedLines, "\n")), 0644); err != nil {
		return fmt.Errorf("failed to write config.toml: %w", err)
	}

	// Update class variables
	n.StateSyncRPC = rpcEndpoint
	if len(n.Chain.Peers.Seeds) > 0 {
		n.StateSyncPeers = []string{n.Chain.Peers.Seeds[0].Address}
	}

	fmt.Fprintf(n.LogWriter, "State sync configured with RPC %s and trust height %d\n", rpcEndpoint, trustHeight)
	return nil
}

// Start starts the node
func (n *Node) Start() error {
	if n.cmd != nil && n.cmd.Process != nil {
		return fmt.Errorf("node is already running")
	}

	// Build the command
	args := []string{
		"start",
		"--home", n.HomeDir,
	}

	cmd := exec.Command(n.BinaryPath, args...)
	cmd.Stdout = n.LogWriter
	cmd.Stderr = n.LogWriter

	fmt.Fprintf(n.LogWriter, "Starting node with command: %s\n", cmd.String())
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start node: %w", err)
	}

	n.cmd = cmd
	fmt.Fprintf(n.LogWriter, "Node started with PID: %d\n", cmd.Process.Pid)
	return nil
}

// Stop stops the node
func (n *Node) Stop() error {
	if n.cmd == nil || n.cmd.Process == nil {
		return nil
	}

	fmt.Fprintf(n.LogWriter, "Stopping node with PID: %d\n", n.cmd.Process.Pid)
	if err := n.cmd.Process.Signal(os.Interrupt); err != nil {
		return fmt.Errorf("failed to send interrupt signal: %w", err)
	}

	// Wait for the process to exit with a timeout
	done := make(chan error, 1)
	go func() {
		done <- n.cmd.Wait()
	}()

	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("node exited with error: %w", err)
		}
	case <-time.After(10 * time.Second):
		if err := n.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("failed to kill node process: %w", err)
		}
		return fmt.Errorf("node did not exit gracefully, killed after timeout")
	}

	n.cmd = nil
	fmt.Fprintf(n.LogWriter, "Node stopped\n")
	return nil
}

// Status returns the status of the node
func (n *Node) Status() (string, error) {
	if n.cmd == nil || n.cmd.Process == nil {
		return "Not running", nil
	}

	process, err := os.FindProcess(n.cmd.Process.Pid)
	if err != nil {
		return "Unknown", fmt.Errorf("failed to find process: %w", err)
	}

	// Send a signal 0 to check if the process exists
	if err := process.Signal(syscall.Signal(0)); err != nil {
		return "Not running", nil
	}

	return "Running", nil
}

// IsRunning returns true if the node is running
func (n *Node) IsRunning() bool {
	status, _ := n.Status()
	return status == "Running"
}

// SetMinGasPrices sets the minimum gas prices in app.toml
func (n *Node) SetMinGasPrices(prices string) error {
	// Check if app.toml exists
	appTomlPath := filepath.Join(n.HomeDir, "config", "app.toml")
	if _, err := os.Stat(appTomlPath); err != nil {
		return fmt.Errorf("app.toml not found: %w", err)
	}

	// Read the app.toml file
	data, err := os.ReadFile(appTomlPath)
	if err != nil {
		return fmt.Errorf("failed to read app.toml: %w", err)
	}

	// Convert content to lines
	lines := strings.Split(string(data), "\n")

	// Find and update minimum-gas-prices
	updated := false
	for i, line := range lines {
		if strings.HasPrefix(line, "minimum-gas-prices") {
			lines[i] = fmt.Sprintf(`minimum-gas-prices = "%s"`, prices)
			updated = true
			break
		}
	}

	// If we didn't find the setting, we should add it
	if !updated {
		fmt.Fprintf(n.LogWriter, "Warning: minimum-gas-prices setting not found in app.toml, this might not be a valid config file\n")
		return fmt.Errorf("minimum-gas-prices setting not found in app.toml")
	}

	// Write the modified app.toml back to disk
	if err := os.WriteFile(appTomlPath, []byte(strings.Join(lines, "\n")), 0644); err != nil {
		return fmt.Errorf("failed to write app.toml: %w", err)
	}

	fmt.Fprintf(n.LogWriter, "Set minimum-gas-prices to %s in %s\n", prices, appTomlPath)
	return nil
}
