// Package ui provides the UI for the Chain Registry app
package ui

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"github.com/faddat/chain-registry/pkg/chainregistry"
	"github.com/faddat/chain-registry/pkg/node"
)

// UI represents the UI state
type UI struct {
	App              fyne.App
	Window           fyne.Window
	ChainSelector    *widget.Select
	NodeSelector     *widget.Select // New selector for switching between running nodes
	LogText          *widget.Entry  // Using Entry for text display
	StartButton      *widget.Button
	StopButton       *widget.Button
	StatusLabel      *widget.Label
	ProgressBar      *widget.ProgressBar
	Registry         *chainregistry.Registry
	ActiveNodes      map[string]*node.Node // Map of chain names to running nodes
	DisplayedNode    string                // Currently displayed node
	DataDir          string
	LogWriter        io.Writer
	NodeMutex        sync.Mutex
	LogBuffers       map[string]*strings.Builder // Separate log buffer for each node
	StatusUpdateTick *time.Ticker
	statusDone       chan bool
	initComplete     bool // Flag to indicate initialization is complete
}

// Logger is an io.Writer that writes to the UI log
type Logger struct {
	UI      *UI
	ChainID string     // Identify which chain this logger is for
	mu      sync.Mutex // Add mutex to protect concurrent writes
}

// Write implements io.Writer
func (l *Logger) Write(p []byte) (n int, err error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Always print to stdout as backup and for debugging
	os.Stdout.Write(p)

	// Make sure we have a UI and app instance
	if l.UI == nil {
		// Fall back to stdout if UI is not available
		return len(p), nil
	}

	// Get the appropriate log buffer for this chain
	logBuffer, exists := l.UI.LogBuffers[l.ChainID]
	if !exists {
		// If buffer doesn't exist, create one
		logBuffer = &strings.Builder{}
		l.UI.LogBuffers[l.ChainID] = logBuffer
	}

	// Add the new content to the buffer
	logBuffer.Write(p)

	// Keep buffer size reasonable (limit to 200,000 chars)
	if logBuffer.Len() > 200000 {
		// Get the current content and trim off the oldest entries
		content := logBuffer.String()
		trimmedContent := content[len(content)-190000:]

		// Find the first newline to start at a clean line
		firstNewline := strings.Index(trimmedContent, "\n")
		if firstNewline > 0 {
			trimmedContent = trimmedContent[firstNewline+1:]
		}

		// Reset the buffer with the trimmed content
		logBuffer.Reset()
		logBuffer.WriteString("...[older logs trimmed]...\n\n")
		logBuffer.WriteString(trimmedContent)
	}

	// Update the UI only if this is the currently displayed node
	// and we're not in initialization
	if l.ChainID == l.UI.DisplayedNode && l.UI.initComplete {
		text := logBuffer.String()
		l.updateFormattedLogDisplay(text)
	}

	return len(p), nil
}

// updateFormattedLogDisplay updates the log display with text
func (l *Logger) updateFormattedLogDisplay(text string) {
	// For debugging - check if our log widget is nil
	if l.UI.LogText == nil {
		fmt.Println("ERROR: LogText widget is nil!")
		return
	}

	// Apply syntax highlighting to text
	highlightedText := l.addLogSyntaxHinting(text)

	// Don't call DoFromGoroutine from the main thread
	if fyne.CurrentApp() != nil && fyne.CurrentApp().Driver() != nil {
		// Use asynchronous execution to avoid deadlocks
		fyne.CurrentApp().Driver().DoFromGoroutine(func() {
			// Update the text
			l.UI.LogText.SetText(highlightedText)

			// Scroll to the bottom
			lineCount := len(strings.Split(highlightedText, "\n"))
			if lineCount > 0 {
				l.UI.LogText.CursorRow = lineCount - 1
			}

			// Refresh to ensure visible update
			l.UI.LogText.Refresh()

			// Also refresh the window content to ensure updates are displayed
			if l.UI.Window != nil && l.UI.Window.Content() != nil {
				l.UI.Window.Content().Refresh()
			}
		}, false) // Use asynchronous execution to avoid deadlocks
	}
}

// addLogSyntaxHinting adds visual hints to make different parts of the log stand out
func (l *Logger) addLogSyntaxHinting(text string) string {
	// Since we can't do true rich text with color, we'll use symbols to make certain lines stand out
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		// Add visual hints to different types of log lines
		if strings.Contains(line, "=====") {
			// Make headers stand out with stars
			lines[i] = "★ " + line + " ★"
		} else if strings.Contains(line, "ERROR") ||
			strings.Contains(line, "Error") ||
			strings.Contains(line, "error") ||
			strings.Contains(line, "failed") ||
			strings.Contains(line, "Failed") {
			// Add error indicator
			lines[i] = "❌ " + line
		} else if strings.Contains(line, "WARN") ||
			strings.Contains(line, "Warning") ||
			strings.Contains(line, "warning") {
			// Add warning indicator
			lines[i] = "⚠️ " + line
		} else if strings.Contains(line, "SUCCESS") ||
			strings.Contains(line, "successfully") ||
			strings.Contains(line, "Successfully") ||
			strings.Contains(line, "COMPLETED") {
			// Add success indicator
			lines[i] = "✅ " + line
		} else if strings.Contains(line, "Downloading") ||
			strings.Contains(line, "Download progress") {
			// Add download indicator
			lines[i] = "⬇️ " + line
		}
	}

	return strings.Join(lines, "\n")
}

// updateLogDisplay directly updates the log display with the given text
func (ui *UI) updateLogDisplay(text string) {
	ui.updateUIInMainThread(func() {
		// Apply syntax highlighting if possible
		highlightedText := text
		if logger, ok := ui.LogWriter.(*Logger); ok {
			highlightedText = logger.addLogSyntaxHinting(text)
		}

		ui.LogText.SetText(highlightedText)
		lineCount := len(strings.Split(highlightedText, "\n"))
		if lineCount > 0 {
			ui.LogText.CursorRow = lineCount - 1
		}
		ui.LogText.Refresh()
	})
}

// NewUI creates a new UI instance
func NewUI() (*UI, error) {
	// Create the Fyne application
	fyneApp := app.New()
	fyneApp.Settings().SetTheme(theme.DarkTheme())

	// Create the main window
	window := fyneApp.NewWindow("Cosmos Chain Registry")
	window.Resize(fyne.NewSize(1200, 800))

	// Set up the data directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user home directory: %w", err)
	}
	dataDir := filepath.Join(homeDir, ".chain-registry-app")

	// Create the UI components
	chainSelector := widget.NewSelect([]string{}, nil)
	nodeSelector := widget.NewSelect([]string{"No running nodes"}, nil)
	nodeSelector.Disable() // Disable until we have nodes running

	// Create a styled log text with light green text for better readability
	logText := widget.NewMultiLineEntry()
	logText.TextStyle = fyne.TextStyle{Monospace: true}
	logText.Wrapping = fyne.TextWrapWord
	logText.SetMinRowsVisible(25)
	logText.Disable() // Use Disable instead of ReadOnly

	// Set a custom text color - use a brighter color than the default
	// Note: We can't directly set text color on an Entry widget, but using monospace style helps visibility

	logScroll := container.NewScroll(logText)
	// Increase the minimum size of the log scroll area
	logScroll.SetMinSize(fyne.NewSize(1100, 600))

	statusLabel := widget.NewLabel("Status: Not Running")
	progressBar := widget.NewProgressBar()
	startButton := widget.NewButton("Start Node", nil)
	stopButton := widget.NewButton("Stop Node", nil)
	stopButton.Disable()

	// Create the UI layout
	headerContainer := container.New(layout.NewVBoxLayout(),
		widget.NewLabel("Select Chain:"),
		chainSelector,
	)

	nodeSelectionContainer := container.New(layout.NewVBoxLayout(),
		widget.NewLabel("Running Nodes:"),
		nodeSelector,
	)

	controlsContainer := container.New(layout.NewHBoxLayout(),
		startButton,
		stopButton,
		statusLabel,
		progressBar,
	)

	topContainer := container.New(layout.NewGridLayout(2),
		headerContainer,
		nodeSelectionContainer,
	)

	logContainer := container.New(layout.NewVBoxLayout(),
		widget.NewLabel("Node Logs:"),
		logScroll,
	)

	mainContainer := container.New(layout.NewVBoxLayout(),
		topContainer,
		controlsContainer,
		logContainer,
	)

	window.SetContent(mainContainer)

	// Create the UI instance
	ui := &UI{
		App:              fyneApp,
		Window:           window,
		ChainSelector:    chainSelector,
		NodeSelector:     nodeSelector,
		LogText:          logText,
		StartButton:      startButton,
		StopButton:       stopButton,
		StatusLabel:      statusLabel,
		ProgressBar:      progressBar,
		DataDir:          dataDir,
		ActiveNodes:      make(map[string]*node.Node),
		LogBuffers:       make(map[string]*strings.Builder),
		StatusUpdateTick: time.NewTicker(time.Second),
		statusDone:       make(chan bool),
		initComplete:     false, // Initialize to false
	}

	// Set up the log writer
	defaultLogger := &Logger{UI: ui}
	ui.LogWriter = defaultLogger

	// Print initial message to stdout only (avoid UI updates during startup)
	fmt.Println("===== CHAIN REGISTRY APP INITIALIZED =====")
	fmt.Printf("Log system initialized. Logs will appear in the UI once loaded.\n")
	fmt.Printf("Data directory: %s\n\n", dataDir)

	return ui, nil
}

// SetupRegistry loads the chain registry data
func (ui *UI) SetupRegistry(registryPath string) error {
	registry, err := chainregistry.NewRegistry(registryPath)
	if err != nil {
		return fmt.Errorf("failed to load registry: %w", err)
	}

	ui.Registry = registry

	// Populate the chain selector
	prettyNames := registry.GetPrettyNames()
	if len(prettyNames) == 0 {
		return fmt.Errorf("no chains found in registry")
	}

	ui.ChainSelector.Options = prettyNames
	ui.ChainSelector.SetSelected(prettyNames[0])

	// Now that UI is set up, mark initialization as complete
	ui.initComplete = true

	// Now it's safe to log to the UI
	fmt.Fprintf(ui.LogWriter, "===== CHAIN REGISTRY APP INITIALIZED =====\n")
	fmt.Fprintf(ui.LogWriter, "Loaded %d chains from registry\n", len(registry.GetLiveChains()))
	fmt.Fprintf(ui.LogWriter, "Data directory: %s\n\n", ui.DataDir)

	return nil
}

// SetupConnections sets up the UI signal connections
func (ui *UI) SetupConnections() {
	// Chain selector change event
	ui.ChainSelector.OnChanged = func(name string) {
		chain, ok := ui.Registry.GetChainByPrettyName(name)
		if !ok {
			fmt.Fprintf(ui.LogWriter, "Chain not found: %s\n", name)
			return
		}

		fmt.Fprintf(ui.LogWriter, "Selected chain: %s (%s)\n", chain.PrettyName, chain.ChainName)
	}

	// Node selector change event
	ui.NodeSelector.OnChanged = func(name string) {
		if name == "No running nodes" {
			return
		}

		// Update the displayed logs
		ui.DisplayedNode = name
		if logBuffer, ok := ui.LogBuffers[name]; ok {
			ui.updateUIInMainThread(func() {
				// Get log text and apply syntax highlighting
				text := logBuffer.String()
				if logger, ok := ui.LogWriter.(*Logger); ok {
					text = logger.addLogSyntaxHinting(text)
				}

				ui.LogText.SetText(text)
				lineCount := len(strings.Split(text, "\n"))
				if lineCount > 0 {
					ui.LogText.CursorRow = lineCount - 1
				}
				ui.LogText.Refresh()
			})
		}

		// Update stop button state based on the selected node
		ui.updateUIInMainThread(func() {
			if _, ok := ui.ActiveNodes[name]; ok {
				ui.StopButton.Enable()
			} else {
				ui.StopButton.Disable()
			}
		})
	}

	// Start button click event
	ui.StartButton.OnTapped = func() {
		go ui.startNode()
	}

	// Stop button click event
	ui.StopButton.OnTapped = func() {
		go ui.stopNode()
	}

	// Set up status update goroutine
	go func() {
		for {
			select {
			case <-ui.StatusUpdateTick.C:
				ui.updateNodeStatus()
			case <-ui.statusDone:
				return
			}
		}
	}()
}

// updateNodeSelector updates the node selector dropdown with current running nodes
func (ui *UI) updateNodeSelector() {
	ui.NodeMutex.Lock()
	defer ui.NodeMutex.Unlock()

	// Create a list of running nodes
	var nodeNames []string

	for name := range ui.ActiveNodes {
		nodeNames = append(nodeNames, name)
	}

	// Update the node selector
	ui.updateUIInMainThread(func() {
		if len(nodeNames) == 0 {
			ui.NodeSelector.Options = []string{"No running nodes"}
			ui.NodeSelector.SetSelected("No running nodes")
			ui.NodeSelector.Disable()
		} else {
			ui.NodeSelector.Options = nodeNames
			if ui.DisplayedNode == "" || !contains(nodeNames, ui.DisplayedNode) {
				ui.DisplayedNode = nodeNames[0]
				ui.NodeSelector.SetSelected(nodeNames[0])
			} else {
				ui.NodeSelector.SetSelected(ui.DisplayedNode)
			}
			ui.NodeSelector.Enable()
		}
	})
}

// contains checks if a string slice contains a specific string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// getSDKVersion attempts to determine the Cosmos SDK version from chain info
func (ui *UI) getSDKVersion(chain *chainregistry.Chain) string {
	// Check if we can determine it from the recommended version
	if chain.Codebase.RecommendedVersion != "" {
		// Many chains include SDK version info in compatible_versions
		for _, ver := range chain.Codebase.CompatibleVersions {
			if strings.Contains(ver, "sdk") {
				return ver
			}
		}
	}

	// Default to a recent version if we can't determine
	return "0.46.0" // Assume newer by default for safety
}

// needsMinGasPrice checks if this chain needs minimum gas prices set
func (ui *UI) needsMinGasPrice(chain *chainregistry.Chain) bool {
	sdkVersion := ui.getSDKVersion(chain)

	// Extract version number if in format like "v0.45.0" or just "0.45.0"
	version := sdkVersion
	if strings.HasPrefix(version, "v") {
		version = version[1:]
	}

	// Get the major and minor version components
	parts := strings.Split(version, ".")
	if len(parts) >= 2 {
		major := parts[0]
		minor := parts[1]

		// Check if version is >= 0.45.0
		if major == "0" && (minor == "45" || minor == "46" || minor == "47" || minor == "48" || minor == "49" || minor >= "50") {
			return true
		}

		// Handle v1.x.x and above
		if major >= "1" {
			return true
		}
	}

	return false
}

// updateUIInMainThread schedules a function to run on the main thread
func (ui *UI) updateUIInMainThread(updateFunc func()) {
	// Use fyne's thread-safe mechanism to ensure UI updates happen on the main thread
	fyne.CurrentApp().Driver().DoFromGoroutine(func() {
		updateFunc()
		// Ensure the UI refreshes correctly
		if ui.Window != nil && ui.Window.Content() != nil {
			ui.Window.Content().Refresh()
		}
	}, true) // Use synchronous execution
}

// startNode starts the currently selected node
func (ui *UI) startNode() {
	ui.NodeMutex.Lock()
	defer ui.NodeMutex.Unlock()

	// Get the selected chain
	prettyName := ui.ChainSelector.Selected
	chain, ok := ui.Registry.GetChainByPrettyName(prettyName)
	if !ok {
		fmt.Fprintf(ui.LogWriter, "Chain not found: %s\n", prettyName)
		ui.updateUIInMainThread(func() {
			ui.StatusLabel.SetText("Status: Error - Chain not found")
		})
		return
	}

	// Check if this node is already running
	if _, exists := ui.ActiveNodes[chain.ChainName]; exists {
		fmt.Fprintf(ui.LogWriter, "Node for %s is already running\n", chain.PrettyName)
		return
	}

	// Create a new log buffer for this chain
	if _, exists := ui.LogBuffers[chain.ChainName]; !exists {
		ui.LogBuffers[chain.ChainName] = &strings.Builder{}
	} else {
		// Clear existing log buffer
		ui.LogBuffers[chain.ChainName].Reset()
	}

	// Create a chain-specific logger
	chainLogger := &Logger{
		UI:      ui,
		ChainID: chain.ChainName,
	}

	// Update UI to show we're working on this chain
	ui.DisplayedNode = chain.ChainName
	ui.updateNodeSelector()

	// Add a prominent header to the chain's log
	fmt.Fprintf(chainLogger, "\n========================================\n")
	fmt.Fprintf(chainLogger, "        STARTING NODE PROCESS\n")
	fmt.Fprintf(chainLogger, "========================================\n\n")

	// Update the UI
	ui.updateUIInMainThread(func() {
		ui.StartButton.Disable()
		ui.StopButton.Enable()
		ui.ProgressBar.SetValue(0)
		ui.StatusLabel.SetText(fmt.Sprintf("Status: Preparing %s", chain.PrettyName))
	})

	fmt.Fprintf(chainLogger, "Selected chain: %s (%s)\n", chain.PrettyName, chain.ChainName)
	fmt.Fprintf(chainLogger, "Chain ID: %s\n", chain.ChainID)
	fmt.Fprintf(chainLogger, "Binary: %s\n", chain.DaemonName)
	fmt.Fprintf(chainLogger, "Codebase: %s\n", chain.Codebase.GitRepo)
	fmt.Fprintf(chainLogger, "Recommended version: %s\n\n", chain.Codebase.RecommendedVersion)

	// Create the node
	nodeInstance, err := node.NewNode(chain, ui.DataDir, chainLogger)
	if err != nil {
		fmt.Fprintf(chainLogger, "Failed to create node: %v\n", err)
		ui.updateUIInMainThread(func() {
			ui.StartButton.Enable()
			ui.StopButton.Disable()
			ui.StatusLabel.SetText("Status: Error - Failed to create node")
		})
		return
	}

	// Download the binary
	fmt.Fprintf(chainLogger, "======== BINARY ACQUISITION PHASE ========\n\n")
	fmt.Fprintf(chainLogger, "Downloading binary for %s...\n", chain.PrettyName)
	ui.updateUIInMainThread(func() {
		ui.StatusLabel.SetText(fmt.Sprintf("Status: Downloading Binary for %s", chain.PrettyName))
		ui.ProgressBar.SetValue(0.1)
	})

	if err := nodeInstance.Download(); err != nil {
		fmt.Fprintf(chainLogger, "\n===== ERROR =====\n")
		fmt.Fprintf(chainLogger, "Failed to download binary: %v\n", err)
		ui.updateUIInMainThread(func() {
			ui.StartButton.Enable()
			ui.StopButton.Disable()
			ui.StatusLabel.SetText(fmt.Sprintf("Status: Error - Failed to download binary for %s", chain.PrettyName))
		})
		return
	}
	ui.updateUIInMainThread(func() {
		ui.ProgressBar.SetValue(0.25)
		ui.StatusLabel.SetText(fmt.Sprintf("Status: Initializing Node for %s", chain.PrettyName))
	})

	// Initialize the node
	fmt.Fprintf(chainLogger, "\n======== NODE INITIALIZATION PHASE ========\n\n")
	fmt.Fprintf(chainLogger, "Initializing node for %s...\n", chain.PrettyName)
	if err := nodeInstance.Initialize(); err != nil {
		fmt.Fprintf(chainLogger, "\n===== ERROR =====\n")
		fmt.Fprintf(chainLogger, "Failed to initialize node: %v\n", err)
		ui.updateUIInMainThread(func() {
			ui.StartButton.Enable()
			ui.StopButton.Disable()
			ui.StatusLabel.SetText(fmt.Sprintf("Status: Error - Failed to initialize %s", chain.PrettyName))
		})
		return
	}
	ui.updateUIInMainThread(func() {
		ui.ProgressBar.SetValue(0.4)
	})

	// Set minimum gas prices if needed
	if ui.needsMinGasPrice(chain) {
		fmt.Fprintf(chainLogger, "\n======== SETTING MINIMUM GAS PRICES ========\n\n")
		fmt.Fprintf(chainLogger, "Chain uses SDK >= 0.45.x, setting minimum gas prices...\n")

		if err := nodeInstance.SetMinGasPrices("0.0025stake"); err != nil {
			fmt.Fprintf(chainLogger, "Warning: Failed to set minimum gas prices: %v\n", err)
			// Continue anyway, this is not a critical error
		} else {
			fmt.Fprintf(chainLogger, "Minimum gas prices set successfully\n")
		}
	}

	ui.updateUIInMainThread(func() {
		ui.ProgressBar.SetValue(0.5)
		ui.StatusLabel.SetText(fmt.Sprintf("Status: Setting up State Sync for %s", chain.PrettyName))
	})

	// Set up state sync
	fmt.Fprintf(chainLogger, "\n======== STATE SYNC CONFIGURATION PHASE ========\n\n")
	fmt.Fprintf(chainLogger, "Setting up state sync for %s...\n", chain.PrettyName)
	if err := nodeInstance.SetupStateSync(); err != nil {
		fmt.Fprintf(chainLogger, "\n===== ERROR =====\n")
		fmt.Fprintf(chainLogger, "Failed to set up state sync: %v\n", err)
		ui.updateUIInMainThread(func() {
			ui.StartButton.Enable()
			ui.StopButton.Disable()
			ui.StatusLabel.SetText(fmt.Sprintf("Status: Error - Failed to set up state sync for %s", chain.PrettyName))
		})
		return
	}
	ui.updateUIInMainThread(func() {
		ui.ProgressBar.SetValue(0.75)
		ui.StatusLabel.SetText(fmt.Sprintf("Status: Starting Node for %s", chain.PrettyName))
	})

	// Start the node
	fmt.Fprintf(chainLogger, "\n======== NODE STARTUP PHASE ========\n\n")
	fmt.Fprintf(chainLogger, "Starting node for %s...\n", chain.PrettyName)
	if err := nodeInstance.Start(); err != nil {
		fmt.Fprintf(chainLogger, "\n===== ERROR =====\n")
		fmt.Fprintf(chainLogger, "Failed to start node: %v\n", err)
		ui.updateUIInMainThread(func() {
			ui.StartButton.Enable()
			ui.StopButton.Disable()
			ui.StatusLabel.SetText(fmt.Sprintf("Status: Error - Failed to start %s", chain.PrettyName))
		})
		return
	}

	// Add to active nodes
	ui.ActiveNodes[chain.ChainName] = nodeInstance

	// Update the node selector
	ui.updateNodeSelector()

	ui.updateUIInMainThread(func() {
		ui.ProgressBar.SetValue(1.0)
		ui.StatusLabel.SetText(fmt.Sprintf("Status: Running %s", chain.PrettyName))
		ui.StartButton.Enable() // Re-enable to allow starting another node
	})

	fmt.Fprintf(chainLogger, "\n======== NODE STARTED SUCCESSFULLY ========\n")
	fmt.Fprintf(chainLogger, "Node is now running for %s\n", chain.PrettyName)
	fmt.Fprintf(chainLogger, "Chain ID: %s\n", chain.ChainID)
	fmt.Fprintf(chainLogger, "Home directory: %s\n", nodeInstance.HomeDir)
}

// stopNode stops the currently selected node
func (ui *UI) stopNode() {
	ui.NodeMutex.Lock()
	defer ui.NodeMutex.Unlock()

	// Use the selected node from the node selector
	chainName := ui.DisplayedNode
	if chainName == "" || chainName == "No running nodes" {
		return
	}

	activeNode, exists := ui.ActiveNodes[chainName]
	if !exists || activeNode == nil {
		return
	}

	// Get the logger for this chain
	var logger io.Writer
	if _, ok := ui.LogBuffers[chainName]; ok {
		logger = &Logger{
			UI:      ui,
			ChainID: chainName,
		}
	} else {
		logger = ui.LogWriter // Fallback to default logger
	}

	fmt.Fprintf(logger, "\n======== STOPPING NODE ========\n")
	fmt.Fprintf(logger, "Stopping node...\n")
	if err := activeNode.Stop(); err != nil {
		fmt.Fprintf(logger, "Failed to stop node: %v\n", err)
	} else {
		fmt.Fprintf(logger, "Node stopped successfully\n")

		// Remove from active nodes
		delete(ui.ActiveNodes, chainName)

		// Update the node selector
		ui.updateNodeSelector()
	}

	ui.updateUIInMainThread(func() {
		// If there are no more active nodes, disable stop button
		if len(ui.ActiveNodes) == 0 {
			ui.StopButton.Disable()
		}
		ui.ProgressBar.SetValue(0)
	})
}

// updateNodeStatus updates the node status in the UI
func (ui *UI) updateNodeStatus() {
	ui.NodeMutex.Lock()
	defer ui.NodeMutex.Unlock()

	// Update status for all running nodes
	for chainName, activeNode := range ui.ActiveNodes {
		status, err := activeNode.Status()

		// Check if the node is still running
		if err != nil || status != "Running" {
			// Node is no longer running, remove it from active nodes
			fmt.Fprintf(&Logger{UI: ui, ChainID: chainName}, "Node status check: %s (chain: %s)\n", status, chainName)

			if status != "Running" {
				fmt.Fprintf(&Logger{UI: ui, ChainID: chainName}, "Node is no longer running. Removing from active nodes.\n")
				delete(ui.ActiveNodes, chainName)
			}
		}
	}

	// Update the node selector after checking all nodes
	if ui.DisplayedNode != "" && ui.DisplayedNode != "No running nodes" {
		// If the displayed node is no longer active, update its status
		if node, ok := ui.ActiveNodes[ui.DisplayedNode]; ok {
			status, _ := node.Status()
			ui.updateUIInMainThread(func() {
				ui.StatusLabel.SetText(fmt.Sprintf("Status: %s - %s", status, ui.DisplayedNode))
			})
		} else {
			// Node is no longer active
			ui.updateUIInMainThread(func() {
				ui.StatusLabel.SetText(fmt.Sprintf("Status: Not Running - %s", ui.DisplayedNode))
			})
		}
	} else {
		ui.updateUIInMainThread(func() {
			ui.StatusLabel.SetText("Status: No Nodes Running")
		})
	}

	// Update the node selector
	ui.updateNodeSelector()
}

// Start starts the UI
func (ui *UI) Start() {
	// Set a more generous default window size to show logs clearly
	ui.Window.Resize(fyne.NewSize(1200, 800))

	// Make the text area larger
	ui.LogText.SetMinRowsVisible(25)

	// Force refresh
	ui.Window.Content().Refresh()

	// Start the UI
	ui.Window.ShowAndRun()

	// Clean up when the window is closed
	ui.StatusUpdateTick.Stop()
	close(ui.statusDone)

	// Stop all running nodes
	for _, node := range ui.ActiveNodes {
		node.Stop()
	}
}
