# Makefile for the Cosmos Chain Registry App

.PHONY: build run clean lint test package-mac package-windows package-linux package-all

# Build the application
build:
	go build -o chain-registry-app ./cmd/chain-registry-app

# Run the application
run: build
	./chain-registry-app

# Clean up build artifacts
clean:
	rm -f chain-registry-app
	rm -rf fyne-cross

# Run the linter
lint:
	golangci-lint run ./...

# Run tests
test:
	go test ./...

# Package for macOS
package-mac:
	go install fyne.io/fyne/v2/cmd/fyne@latest
	fyne package -os darwin -icon icon.png -name "Cosmos Chain Registry"

# Package for Windows
package-windows:
	go install fyne.io/fyne/v2/cmd/fyne@latest
	fyne package -os windows -icon icon.png -name "Cosmos Chain Registry"

# Package for Linux
package-linux:
	go install fyne.io/fyne/v2/cmd/fyne@latest
	fyne package -os linux -icon icon.png -name "Cosmos Chain Registry"

# Cross-platform packaging (requires Docker)
package-all:
	go install github.com/fyne-io/fyne-cross@latest
	fyne-cross darwin -app-id "com.faddat.chain-registry" -icon icon.png
	fyne-cross windows -app-id "com.faddat.chain-registry" -icon icon.png
	fyne-cross linux -app-id "com.faddat.chain-registry" -icon icon.png 