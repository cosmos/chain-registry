# Cosmos Chain Registry App

The Cosmos Chain Registry App is a desktop application that allows users to easily run nodes for various Cosmos-based blockchains. It leverages the [Cosmos Chain Registry](https://github.com/cosmos/chain-registry) to provide up-to-date chain information and configuration.

## Features

- **Simple GUI Interface**: Easily select and run nodes for different Cosmos chains
- **State Sync Support**: All nodes are run with state sync enabled, allowing for quick bootstrapping
- **Multi-Platform**: Runs on Linux, macOS, and Windows
- **Automatic Binary Management**: Automatically downloads the appropriate binaries for your platform
- **Chain Registry Integration**: Uses the Cosmos Chain Registry for up-to-date chain information

## Prerequisites

- Go 1.20 or later
- GCC or Clang compiler (required for Fyne UI)

### Installing Dependencies

#### macOS
```bash
brew install go gcc
```

#### Ubuntu/Debian
```bash
sudo apt-get install -y golang build-essential libgl1-mesa-dev xorg-dev
```

#### Windows
Install Go from [golang.org](https://golang.org/dl/) and MinGW from [mingw-w64.org](https://www.mingw-w64.org/) or MSYS2 from [msys2.org](https://www.msys2.org/).

## Installation

1. Clone this repository:
```bash
git clone https://github.com/faddat/chain-registry.git
cd chain-registry
```

2. Build the application:
```bash
go mod tidy
go build -o chain-registry-app ./cmd/chain-registry-app
```

## Usage

Run the application:
```bash
./chain-registry-app
```

1. Select a chain from the dropdown list
2. Click "Start Node" to download the binary, initialize, and start the node
3. Monitor progress in the logs area
4. Stop the node using the "Stop Node" button when done

## Data Storage

The application stores all node data in the `~/.chain-registry-app` directory, including:
- Chain binaries
- Node data directories
- Configuration files

## Development

To rebuild the application after making changes:
```bash
go build -o chain-registry-app ./cmd/chain-registry-app
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Cosmos Chain Registry](https://github.com/cosmos/chain-registry) for chain data
- [Fyne](https://fyne.io/) for the pure Go UI toolkit
