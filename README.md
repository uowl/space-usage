# Space Usage

A desktop application for analyzing disk space usage. Scan folders and mounted network paths to visualize which files and directories are consuming the most space.

## Features

- Scan single or multiple directories simultaneously (up to 10 locations)
- Visualize disk usage with sortable tables and progress bars
- Support for local paths and network mounts (e.g., `/mnt/nas`, `\\server\share`)
- Configurable scan depth and top children per folder
- Real-time progress tracking during scans
- Click on directories to drill down into subdirectories

## Prerequisites

### All Platforms
- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

### Linux (Fedora/RHEL)
- GTK3 and WebKitGTK development libraries
- Build tools (gcc, make, pkg-config)
- OpenSSL development libraries

### Linux (Ubuntu/Debian)
- GTK3 and WebKitGTK development libraries
- Build tools
- OpenSSL development libraries

### macOS
- Xcode Command Line Tools: `xcode-select --install`

### Windows
- Microsoft Visual Studio C++ Build Tools or Visual Studio with C++ workload
- Windows SDK

### Rust (Required for building)
- Rust toolchain (installed automatically if missing, or use the provided script)

## Installation

### Option 1: Install from Source

1. **Clone or download this repository**
   ```bash
   cd space-usage
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install system dependencies**

   **For Fedora/RHEL:**
   ```bash
   bash scripts/install-fedora-deps.sh
   ```

   **For Ubuntu/Debian:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y \
     libwebkit2gtk-4.1-dev \
     build-essential \
     curl \
     wget \
     file \
     libssl-dev \
     libgtk-3-dev \
     libayatana-appindicator3-dev \
     librsvg2-dev
   ```

   **For macOS:**
   ```bash
   # Install Xcode Command Line Tools if not already installed
   xcode-select --install
   ```

   **For Windows:**
   - Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - Select "Desktop development with C++" workload

4. **Install Rust (if not already installed)**
   ```bash
   bash scripts/install-rust.sh
   # Or manually: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   After installation, restart your terminal or run:
   ```bash
   source $HOME/.cargo/env
   ```

5. **Run the application in development mode**
   ```bash
   npm run tauri:dev
   ```

### Option 2: Build Standalone Executable

1. **Follow steps 1-4 from Option 1**

2. **Build the application**
   ```bash
   # For your current platform
   bash scripts/build-portable.sh
   
   # Or use npm scripts directly:
   npm run tauri:build              # Build for current platform
   npm run tauri:build:linux        # Build Linux AppImage
   npm run tauri:build:macos        # Build macOS .app bundle
   npm run tauri:build:windows      # Build Windows portable .exe
   ```

3. **Find the built executable:**
   - **Linux:** `src-tauri/target/release/bundle/appimage/space-usage-app_*.AppImage`
     - Make executable: `chmod +x *.AppImage`
   - **macOS:** `src-tauri/target/release/bundle/macos/Space Usage.app`
   - **Windows:** `src-tauri/target/release/bundle/portable/Space Usage.exe`

### Option 3: Build Windows Portable Executable (Detailed Steps)

Follow these steps to build a portable Windows `.exe` file that can run without installation:

1. **Install Prerequisites**

   **a. Install Node.js**
   - Download and install from [nodejs.org](https://nodejs.org/) (v18 or later)
   - Verify installation:
     ```powershell
     node --version
     npm --version
     ```

   **b. Install Visual Studio Build Tools**
   - Download [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - Run the installer and select:
     - ✅ **Desktop development with C++** workload
     - This includes MSVC compiler, Windows SDK, and other required tools
   - Restart your computer after installation

   **c. Install Rust**
   - Open PowerShell or Command Prompt
   - Run:
     ```powershell
     # Using the provided script
     .\scripts\install-rust.ps1
     
     # Or manually
     # Download and run: https://win.rustup.rs/x86_64
     # Or use: winget install Rustlang.Rustup
     ```
   - After installation, restart your terminal or run:
     ```powershell
     $env:Path += ";$env:USERPROFILE\.cargo\bin"
     ```
   - Verify installation:
     ```powershell
     cargo --version
     rustc --version
     ```

2. **Set Up the Project**

   ```powershell
   # Navigate to the project directory
   cd space-usage
   
   # Install Node.js dependencies
   npm install
   ```

3. **Build the Portable Executable**

   **Option A: Using the PowerShell script (Recommended)**
   ```powershell
   .\scripts\build-portable.ps1
   ```

   **Option B: Using npm directly**
   ```powershell
   npm run tauri:build:windows
   ```

   **Option C: Build for all Windows bundle types**
   ```powershell
   npm run tauri:build
   ```

4. **Find Your Portable Executable**

   After building completes, you'll find the portable executable at:
   ```
   src-tauri\target\release\bundle\portable\Space Usage.exe
   ```

   This is a **standalone executable** - no installation needed! You can:
   - Copy it to any Windows machine (same architecture)
   - Run it directly by double-clicking
   - Share it with others (no installer required)

5. **Optional: Create a Distribution Package**

   You can zip the executable for easy distribution:
   ```powershell
   # Create a zip file with the executable
   Compress-Archive -Path "src-tauri\target\release\bundle\portable\Space Usage.exe" -DestinationPath "Space-Usage-Portable.zip"
   ```

**Note:** The first build may take 10-30 minutes as it compiles Rust dependencies. Subsequent builds will be much faster.

## Usage

### Starting a Scan

1. **Launch the application** (development: `npm run tauri:dev`, or run the built executable)

2. **Enter a path to scan:**
   - Type a path directly (e.g., `/`, `/home`, `/mnt/nas`, `C:\`, `\\server\share`)
   - Or click "Browse…" to select a folder using the file picker

3. **Add multiple locations (optional):**
   - Click "+ Add location" to scan up to 10 directories simultaneously
   - Each location will appear as a separate tab in the results

4. **Configure scan settings:**
   - **Max depth:** How many directory levels to scan (default: 6)
   - **Top children per folder:** Maximum number of items to show per directory (default: 200)

5. **Click "Start scan"** to begin analyzing disk usage

### Viewing Results

- **Tabs:** Each scanned location appears as a tab at the top
- **Sorting:** Click column headers (Size, Name, Type) to sort results
  - Click again to toggle ascending/descending order
- **Drill down:** Click on any directory name in the results to scan that specific folder
- **Progress:** Watch real-time progress during scanning, including:
  - Total bytes scanned
  - Number of entries processed
  - Current path being scanned

### Understanding the Results

- **Name:** File or directory name
- **Type:** `file` or `dir`
- **Size:** Total size of the item (including all subdirectories for directories)
- **Share:** Visual bar showing percentage of total space used

### Tips

- For large filesystems, start with a shallow scan (low max depth) to get an overview
- Increase "Top children per folder" if you want to see more items per directory
- Network paths may take longer to scan; be patient
- Permission errors are expected on some system directories and won't stop the scan
- Click on directories in the results to quickly navigate deeper into the filesystem

## Development

### Available Scripts

- `npm run dev` - Run Vite dev server (frontend only)
- `npm run tauri:dev` - Run Tauri app in development mode
- `npm run build` - Build frontend only
- `npm run tauri:build` - Build complete Tauri application
- `npm run preview` - Preview built frontend

### Project Structure

- `src/` - React frontend (TypeScript)
- `src-tauri/src/` - Rust backend
- `src-tauri/src/scan.rs` - Disk scanning logic
- `scripts/` - Build and installation scripts

## Troubleshooting

### Build Errors

**"cargo: command not found"**
- Install Rust: `bash scripts/install-rust.sh`
- Restart your terminal or run `source $HOME/.cargo/env`

**Linux: Missing GTK/WebKit libraries**
- Fedora: Run `bash scripts/install-fedora-deps.sh`
- Ubuntu/Debian: Install packages listed in Installation section

**macOS: "xcrun: error: invalid active developer path"**
- Run: `xcode-select --install`

**Windows: Linker errors**
- Ensure Visual Studio Build Tools with C++ workload is installed
- May need to restart terminal/IDE after installation

### Runtime Issues

**App won't start**
- Check that all dependencies are installed
- Try running `npm run tauri:dev` to see error messages

**Scan is slow**
- Reduce max depth
- Reduce top children per folder
- Network paths are inherently slower than local paths

**Permission errors**
- These are normal when scanning system directories
- The scan will continue despite permission errors
- Check the Errors section at the bottom of the app for details

## License

See [LICENSE](LICENSE) file for details.
