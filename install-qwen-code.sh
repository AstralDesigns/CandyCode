#!/bin/bash

# =============================================================================
# Qwen Code CLI Installation Script
# Installs and configures Qwen Code CLI with proper Fish shell support
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_header() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n${GREEN}$1${NC}\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# =============================================================================
# Detect Shell Type
# =============================================================================
detect_shell() {
    print_header "Detecting Shell Environment"
    
    CURRENT_SHELL=$(basename "$SHELL")
    print_info "Current shell: $CURRENT_SHELL"
    
    case "$CURRENT_SHELL" in
        fish)
            SHELL_TYPE="fish"
            SHELL_CONFIG="$HOME/.config/fish/config.fish"
            print_success "Fish shell detected"
            ;;
        bash)
            SHELL_TYPE="bash"
            SHELL_CONFIG="$HOME/.bashrc"
            print_success "Bash shell detected"
            ;;
        zsh)
            SHELL_TYPE="zsh"
            SHELL_CONFIG="$HOME/.zshrc"
            print_success "Zsh shell detected"
            ;;
        *)
            SHELL_TYPE="posix"
            SHELL_CONFIG="$HOME/.profile"
            print_warning "Using generic POSIX shell configuration"
            ;;
    esac
}

# =============================================================================
# OS Detection
# =============================================================================
detect_os() {
    print_header "Detecting Operating System"
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS_DISTRO="$ID"
            OS_VERSION="${VERSION_ID:-unknown}"
            print_info "Detected: $NAME ${VERSION:-$VERSION_ID}"
        else
            OS_DISTRO="unknown"
            print_warning "Could not detect specific Linux distribution"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        OS_VERSION=$(sw_vers -productVersion)
        print_info "Detected: macOS $OS_VERSION"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
        print_info "Detected: Windows (Git Bash/Cygwin)"
    else
        print_error "Unsupported OS: $OSTYPE"
        exit 1
    fi
    
    print_success "OS detected: $OS"
}

# =============================================================================
# Check Prerequisites
# =============================================================================
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing_packages=()
    
    # Check for curl
    if command -v curl &> /dev/null; then
        print_success "curl is installed"
    else
        print_error "curl is not installed"
        missing_packages+=("curl")
    fi
    
    # Arch/CachyOS specific checks
    if [[ "$OS_DISTRO" == "cachyos" ]] || [[ "$OS_DISTRO" == "arch" ]] || [[ "$OS_DISTRO" == "manjaro" ]]; then
        if ! pacman -Q ca-certificates &> /dev/null 2>&1; then
            print_warning "ca-certificates not installed"
            missing_packages+=("ca-certificates")
        fi
    fi
    
    # Install missing packages if needed
    if [ ${#missing_packages[@]} -gt 0 ]; then
        print_error "Missing required packages: ${missing_packages[*]}"
        
        case "$OS_DISTRO" in
            arch|cachyos|manjaro|endeavouros)
                print_info "Install with: sudo pacman -S ${missing_packages[*]}"
                read -p "Install missing packages now? (y/n): " INSTALL_DEPS
                
                if [[ "$INSTALL_DEPS" == "y" || "$INSTALL_DEPS" == "Y" ]]; then
                    sudo pacman -S --needed --noconfirm "${missing_packages[@]}"
                    print_success "Packages installed"
                else
                    print_error "Cannot continue without required packages"
                    exit 1
                fi
                ;;
            *)
                print_info "Please install missing packages and try again"
                exit 1
                ;;
        esac
    fi
}

# =============================================================================
# Install Qwen Code CLI
# =============================================================================
install_qwen_code() {
    print_header "Installing Qwen Code CLI"
    
    case "$OS" in
        linux|macos)
            print_info "Using official Qwen installation script for $OS..."
            echo ""
            
            if curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh | bash; then
                print_success "Qwen Code CLI installed successfully"
            else
                print_error "Installation failed"
                print_info "You can try manual installation from: https://github.com/QwenLM/qwen-code"
                exit 1
            fi
            ;;
            
        windows)
            print_info "Using official Qwen installation script for Windows..."
            curl -fsSL -o "$TEMP/install-qwen.bat" https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.bat
            
            if [ $? -eq 0 ]; then
                cmd.exe /c "$TEMP\\install-qwen.bat"
                if [ $? -eq 0 ]; then
                    print_success "Qwen Code CLI installed successfully"
                else
                    print_error "Installation failed"
                    exit 1
                fi
            else
                print_error "Failed to download installer"
                exit 1
            fi
            ;;
            
        *)
            print_error "Unsupported OS: $OS"
            exit 1
            ;;
    esac
    
    echo ""
    print_info "Waiting for installation to settle..."
    sleep 2
}

# =============================================================================
# Find Qwen Installation
# =============================================================================
find_qwen_path() {
    print_header "Locating Qwen Installation"
    
    # Common installation paths
    local possible_paths=(
        "$HOME/.nvm/versions/node/v20.20.0/bin/qwen"
        "$HOME/.nvm/versions/node/v20.20.0/lib/node_modules/.bin/qwen"
        "$HOME/.local/bin/qwen"
        "$HOME/.npm-global/bin/qwen"
        "/usr/local/bin/qwen"
    )
    
    QWEN_PATH=""
    
    # Check if already in PATH
    if command -v qwen &> /dev/null; then
        QWEN_PATH=$(which qwen)
        print_success "qwen found in PATH: $QWEN_PATH"
        return 0
    fi
    
    # Check common locations
    for path in "${possible_paths[@]}"; do
        if [ -f "$path" ]; then
            QWEN_PATH="$path"
            print_success "Found qwen at: $path"
            return 0
        fi
    done
    
    # Do a broader search
    print_info "Searching for qwen binary..."
    QWEN_PATH=$(find "$HOME" -name "qwen" -type f -executable 2>/dev/null | grep -E "(nvm|npm|\.local)" | head -1)
    
    if [ -n "$QWEN_PATH" ]; then
        print_success "Found qwen at: $QWEN_PATH"
        return 0
    fi
    
    print_error "Could not locate qwen installation"
    return 1
}

# =============================================================================
# Configure Fish Shell
# =============================================================================
configure_fish() {
    print_header "Configuring Fish Shell"
    
    local qwen_dir=$(dirname "$QWEN_PATH")
    
    # Create fish config directory if needed
    mkdir -p "$HOME/.config/fish"
    
    # Check if already configured
    if grep -q "fish_add_path.*qwen\|fish_add_path.*nvm.*node" "$SHELL_CONFIG" 2>/dev/null; then
        print_info "Qwen path already in Fish config"
    else
        print_info "Adding qwen to Fish PATH..."
        
        cat >> "$SHELL_CONFIG" << EOF

# Qwen Code CLI - Added by installer
fish_add_path $qwen_dir
EOF
        print_success "Added to $SHELL_CONFIG"
    fi
    
    # Check if aliases already exist
    if ! grep -q "alias qw=" "$SHELL_CONFIG" 2>/dev/null; then
        print_info "Adding Fish aliases..."
        
        cat >> "$SHELL_CONFIG" << 'EOF'

# Qwen Code CLI aliases
alias qw='qwen'
alias qwask='qwen ask'
alias qwchat='qwen chat'
alias qwgen='qwen generate'
alias qwreview='qwen review'
alias qwexplain='qwen explain'
EOF
        print_success "Aliases added"
    else
        print_info "Aliases already configured"
    fi
    
    # Create symlink for immediate access
    print_info "Creating symlink in ~/.local/bin..."
    mkdir -p "$HOME/.local/bin"
    
    if [ -L "$HOME/.local/bin/qwen" ]; then
        rm "$HOME/.local/bin/qwen"
    fi
    
    ln -sf "$QWEN_PATH" "$HOME/.local/bin/qwen"
    print_success "Symlink created: ~/.local/bin/qwen"
}

# =============================================================================
# Configure POSIX Shell (Bash/Zsh)
# =============================================================================
configure_posix() {
    print_header "Configuring $SHELL_TYPE Shell"
    
    local qwen_dir=$(dirname "$QWEN_PATH")
    
    # Check if already configured
    if grep -q "$qwen_dir" "$SHELL_CONFIG" 2>/dev/null; then
        print_info "Qwen path already in shell config"
    else
        print_info "Adding qwen to PATH..."
        
        cat >> "$SHELL_CONFIG" << EOF

# Qwen Code CLI - Added by installer
export PATH="$qwen_dir:\$PATH"
EOF
        print_success "Added to $SHELL_CONFIG"
    fi
    
    # Check if aliases already exist
    if ! grep -q "alias qw=" "$SHELL_CONFIG" 2>/dev/null; then
        print_info "Adding shell aliases..."
        
        cat >> "$SHELL_CONFIG" << 'EOF'

# Qwen Code CLI aliases
alias qw='qwen'
alias qwask='qwen ask'
alias qwchat='qwen chat'
alias qwgen='qwen generate'
alias qwreview='qwen review'
alias qwexplain='qwen explain'
EOF
        print_success "Aliases added"
    else
        print_info "Aliases already configured"
    fi
}

# =============================================================================
# Verify Installation
# =============================================================================
verify_installation() {
    print_header "Verifying Installation"
    
    # Add to current PATH for immediate testing
    export PATH="$(dirname "$QWEN_PATH"):$HOME/.local/bin:$PATH"
    
    if command -v qwen &> /dev/null; then
        QWEN_VERSION=$(qwen --version 2>/dev/null || echo "installed")
        print_success "qwen is accessible: $(which qwen)"
        print_info "Version: $QWEN_VERSION"
        return 0
    else
        print_error "qwen is still not accessible"
        return 1
    fi
}

# =============================================================================
# Show Usage Info
# =============================================================================
show_usage() {
    print_header "Quick Start Guide"
    
    echo -e "${GREEN}Common Commands:${NC}"
    echo ""
    echo "  qwen                          - Start interactive chat"
    echo "  qwen ask 'question'           - Ask a quick question"
    echo "  qwen chat                     - Start chat mode"
    echo "  qwen --help                   - Show all commands"
    echo ""
    
    echo -e "${YELLOW}To activate in current session:${NC}"
    case "$SHELL_TYPE" in
        fish)
            echo "  source ~/.config/fish/config.fish"
            ;;
        bash)
            echo "  source ~/.bashrc"
            ;;
        zsh)
            echo "  source ~/.zshrc"
            ;;
    esac
    echo ""
    
    echo -e "${BLUE}Or just open a new terminal window.${NC}"
}

# =============================================================================
# Main Installation Flow
# =============================================================================
main() {
    clear
    echo -e "${BLUE}"
    cat << "EOF"
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║               Qwen Code CLI Installation Script               ║
    ║                                                               ║
    ║            AI-Powered Coding Assistant by Alibaba             ║
    ║                   With Fish Shell Support                     ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    # Run installation steps
    detect_shell
    detect_os
    check_prerequisites
    install_qwen_code
    
    if find_qwen_path; then
        case "$SHELL_TYPE" in
            fish)
                configure_fish
                ;;
            *)
                configure_posix
                ;;
        esac
        
        if verify_installation; then
            show_usage
            
            print_header "Installation Complete!"
            print_success "Qwen Code CLI is ready to use! 🎉"
            echo ""
        else
            print_error "Installation verification failed"
            print_info "qwen is installed but may require shell restart"
        fi
    else
        print_error "Could not locate qwen installation"
        print_info "The installation may have failed silently"
        exit 1
    fi
}

# Run main installation
main
