# CandyCode Keyboard Shortcuts & Window Manager Integration

This guide covers setting up CandyCode with custom keyboard shortcuts, tiling window managers, and as your default code editor.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Global Hotkeys](#global-hotkeys)
3. [Tiling Window Managers](#tiling-window-managers)
4. [Default Editor Setup](#default-editor-setup)
5. [Custom Keybinds](#custom-keybinds)

---

## Quick Start

### Automatic Setup (Recommended)

```bash
# Install CandyCode (includes all configurations)
npm run install-app

# Or manually setup WM integration
node scripts/setup-wm-config.js --auto

# Setup global hotkeys
node scripts/setup-hotkeys.js --all
```

### Manual Configuration

Choose your window manager below and follow the instructions.

---

## Global Hotkeys

CandyCode includes built-in global hotkeys that work while the app is running.

### Default Hotkeys

| Platform | Hotkey | Action |
|----------|--------|--------|
| **Linux** | `Super + Alt + C` | Launch/focus CandyCode |
| **macOS** | `Command + Alt + C` | Launch/focus CandyCode |
| **Windows** | `Ctrl + Alt + C` | Launch/focus CandyCode |

### Configure Custom Hotkeys

1. Open CandyCode
2. Go to **Settings** → **Hotkeys**
3. Click on a hotkey field
4. Press your desired key combination
5. Changes apply immediately

### System-Level Hotkeys (Work Even When App Isn't Running)

```bash
# Run the hotkey setup script
node scripts/setup-hotkeys.js --all
```

This configures:
- **Linux:** GNOME, KDE, XFCE, MATE, Cinnamon, or generic X11
- **macOS:** System Preferences integration
- **Windows:** Startup shortcuts

---

## Tiling Window Managers

### Hyprland

**Automatic Setup:**
```bash
node scripts/setup-wm-config.js --wm hyprland
```

**Manual Configuration:**

Add to `~/.config/hypr/hyprland.conf`:

```ini
# Launch CandyCode
bind = $mainMod ALT, C, exec, ~/.local/bin/CandyCode

# Alternative: SUPER + E (like VSCode)
# bind = $mainMod, E, exec, ~/.local/bin/CandyCode

# Set as default editor
env = EDITOR,~/.local/bin/CandyCode
env = VISUAL,~/.local/bin/CandyCode

# Optional: Window rules
windowrulev2 = float, class:^(CandyCode)$, title:^(CandyCode)$
windowrulev2 = size 1200 800, class:^(CandyCode)$
windowrulev2 = center, class:^(CandyCode)$
```

**Reload Hyprland:** `Super + Shift + R`

---

### sway

**Automatic Setup:**
```bash
node scripts/setup-wm-config.js --wm sway
```

**Manual Configuration:**

Add to `~/.config/sway/config`:

```ini
# Launch CandyCode
bindsym $mod+Alt+C exec ~/.local/bin/CandyCode

# Alternative: Mod + E (like VSCode)
# bindsym $mod+e exec ~/.local/bin/CandyCode

# Set as default editor
set $env EDITOR ~/.local/bin/CandyCode
set $env VISUAL ~/.local/bin/CandyCode

# Optional: Window preferences
for_window [class="CandyCode"] resize set 1200 800
for_window [class="CandyCode"] move position center
```

**Reload sway:** `Super + Shift + C`

---

### i3

**Automatic Setup:**
```bash
node scripts/setup-wm-config.js --wm i3
```

**Manual Configuration:**

Add to `~/.config/i3/config`:

```ini
# Launch CandyCode
bindsym $mod+Alt+C exec ~/.local/bin/CandyCode

# Alternative: Mod + E (like VSCode)
# bindsym $mod+e exec ~/.local/bin/CandyCode

# Set as default editor
set $env EDITOR ~/.local/bin/CandyCode
set $env VISUAL ~/.local/bin/CandyCode

# Optional: Window preferences
for_window [class="CandyCode"] resize set 1200 800
for_window [class="CandyCode"] move position center
```

**Reload i3:** `Super + Shift + R`

---

### Other Window Managers

The setup script generates configs for your WM:

```bash
# Auto-detect and setup
node scripts/setup-wm-config.js --auto

# Or generate config for specific WM
node scripts/setup-wm-config.js --wm hyprland  # or sway, i3
```

Generated configs are saved to: `~/.config/candycode/`

---

## Default Editor Setup

### Why Setting Default Editor Matters

When you run `git commit`, `crontab -e`, or use tools like `nano`/`vim` wrappers, they use the `$EDITOR` or `$VISUAL` environment variable.

### Automatic Setup

```bash
node scripts/setup-wm-config.js --desktop-only
```

This configures:
- Desktop entry with MIME type associations
- Shell configurations (`.bashrc`, `.zshrc`, `config.fish`)
- System-wide default editor settings

### Manual Setup

**For Bash** (`~/.bashrc`):
```bash
export EDITOR="$HOME/.local/bin/CandyCode"
export VISUAL="$HOME/.local/bin/CandyCode"
```

**For Zsh** (`~/.zshrc`):
```bash
export EDITOR="$HOME/.local/bin/CandyCode"
export VISUAL="$HOME/.local/bin/CandyCode"
```

**For Fish** (`~/.config/fish/config.fish`):
```fish
set -gx EDITOR "$HOME/.local/bin/CandyCode"
set -gx VISUAL "$HOME/.local/bin/CandyCode"
```

**For Git** (`~/.gitconfig`):
```ini
[core]
    editor = ~/.local/bin/CandyCode
```

**Verify:**
```bash
echo $EDITOR
# Should output: /home/youruser/.local/bin/CandyCode
```

---

## Custom Keybinds

### For Hyprland Users

Hyprland allows flexible keybind configurations. Here are some examples:

```ini
# Basic launch
bind = $mainMod, C, exec, ~/.local/bin/CandyCode

# With modifiers
bind = $mainMod SHIFT, C, exec, ~/.local/bin/CandyCode
bind = ALT SUPER, C, exec, ~/.local/bin/CandyCode

# Launch specific files with CandyCode
bind = $mainMod, O, exec, sh -c 'CandyCode ~/projects/my-app'

# Launch with specific project
bind = $mainMod SHIFT, O, exec, sh -c 'CandyCode ~/projects/web-app'

# Toggle CandyCode (show/hide)
bind = $mainMod, SPACE, exec, wmctrl -a "CandyCode" || CandyCode
```

### For sway/i3 Users

```ini
# Basic launch
bindsym $mod+C exec ~/.local/bin/CandyCode

# With modifiers
bindsym $mod+Shift+C exec ~/.local/bin/CandyCode
bindsym Alt+Mod4+C exec ~/.local/bin/CandyCode

# Launch in floating mode
bindsym $mod+F exec "[class=CandyCode] floating enable, move position center"

# Workspace assignment
bindsym $mod+1 exec "CandyCode; wmctrl -r CandyCode -t 1"

# Open specific file
bindsym $mod+O exec sh -c '~/.local/bin/CandyCode ~/projects/my-app'
```

### Using CandyCode with `xdg-open`

To make `xdg-open` use CandyCode for text files:

**Create `~/.config/mimeapps.list`:**
```ini
[Default Applications]
text/plain=candycode.desktop
text/html=candycode.desktop
text/css=candycode.desktop
application/json=candycode.desktop
```

**Or use the setup script:**
```bash
node scripts/setup-wm-config.js --desktop-only
```

---

## Troubleshooting

### CandyCode command not found

```bash
# Ensure ~/.local/bin is in PATH
echo $PATH | grep -q "$HOME/.local/bin" || export PATH="$HOME/.local/bin:$PATH"

# Add to your shell config permanently
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Keybind not working

1. **Check for conflicts:** Another app may be using the same keybind
2. **Reload WM config:** Usually `Super + Shift + R` or `Super + Shift + C`
3. **Verify installation:** Run `CandyCode --version` or `~/.local/bin/CandyCode`

### Default editor not working

```bash
# Check current editor
echo $EDITOR
echo $VISUAL

# Test opening a file
CandyCode /path/to/file.txt

# Update desktop database
update-desktop-database ~/.local/share/applications
```

### AppImage not launching from keybind

Ensure the AppImage has execute permissions:
```bash
chmod +x ~/AgenticApp/release/CandyCode-*.AppImage
```

### Hyprland specific issues

Check Hyprland logs:
```bash
hyprctl clients | grep -i candycode
```

### sway/i3 specific issues

Check window class:
```bash
xprop | grep WM_CLASS
# Click on CandyCode window, should show "CandyCode"
```

---

## Advanced Configuration

### Environment Variables

Set these before launching CandyCode:

```bash
# Custom project directory
export CANDYCODE_HOME="/path/to/candycode"

# Custom installation
export CANDYCODE_ROOT="/opt/CandyCode"

# Force specific display
export GDK_SCALE=2
export GDK_DPI_SCALE=1
```

### Launch Options

```bash
# Open specific file
CandyCode /path/to/file.txt

# Open project directory
CandyCode /path/to/project/

# Multiple files
CandyCode file1.txt file2.js
```

### Custom Desktop Entry

Create `~/.local/share/applications/candycode-custom.desktop`:

```ini
[Desktop Entry]
Name=CandyCode (Custom)
Comment=AI-powered code editor with custom settings
Exec=/home/youruser/.local/bin/CandyCode --custom-config
Icon=candycode
Terminal=false
Type=Application
Categories=Development;IDE;
```

---

## Additional Resources

- [Hyprland Wiki](https://wiki.hyprland.org/)
- [sway Documentation](https://swaywm.org/docs/)
- [i3 User Guide](https://i3wm.org/docs/userguide.html)
- [XDG Desktop Entry Spec](https://specifications.freedesktop.org/desktop-entry-spec/)
- [MIME Types Reference](https://www.iana.org/assignments/media-types/media-types.xhtml)

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review your WM's documentation
3. Check CandyCode logs: `~/.config/CandyCode/logs/`
4. Open an issue on the CandyCode repository
