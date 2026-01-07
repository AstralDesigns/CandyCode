# AlphaStudio

A futuristic AI-powered code editor and workspace with Gemini integration, built with Electron, React, and TypeScript.

## Features

- **Monaco Editor** with autocompletion and CursorAI-style widgets
- **Gemini AI Integration** via native Electron IPC (no Python backend required)
- **Chat Panel** with streaming responses and context attachment
- **Task Management** with AI-powered task analysis
- **Diff Widget** for reviewing generated code changes
- **Agent Terminal** with permission prompts for elevated commands
- **Dual Panel Modes**: File navigation and project mode
- **Image & File Context** attachment with preview
- **Multiple Themes**: Light, Dark, and Aether gradient
- **Cross-platform**: Linux, macOS, and Windows

## Setup

### Prerequisites

- Node.js 20+ and npm
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Installation

1. Clone or navigate to the project:
```bash
cd ~/alpha-studio
```

2. Install dependencies:
```bash
npm install
```

3. Configure API key:
   - Open the app and go to Settings (gear icon)
   - Enter your Gemini API key

### Development

Run in development mode:
```bash
npm run dev
```

This will start:
- Vite dev server on http://localhost:5173
- Electron app (Gemini API integrated directly via IPC)

### Building

Build for production:
```bash
npm run build
```

Package for distribution:
```bash
npm run package        # All platforms
npm run package:linux # Linux only
npm run package:mac   # macOS only
npm run package:win   # Windows only
```

## Usage

1. **Configure API Key**: Open Settings (gear icon) and enter your Gemini API key
2. **Open Files**: Use the sidebar to navigate and open files
3. **Chat with AI**: Use the chat panel to ask questions or request code changes
4. **Manage Tasks**: Add tasks in the task panel - the AI can help plan and track progress
5. **Review Changes**: When AI suggests changes, review them in the diff widget
6. **Execute Commands**: Use the terminal panel to run commands (with permission prompts for elevated access)

## Project Structure

```
alpha-studio/
├── electron/              # Electron main process
│   ├── services/          # Gemini service, file operations, agentic loop
│   ├── main.ts            # Main process with IPC handlers
│   └── preload.ts         # Preload script for secure IPC
├── src/                   # React frontend
│   ├── components/        # React components
│   ├── services/          # Frontend services (Gemini API, etc.)
│   ├── store.ts           # Zustand state management
│   └── types/             # TypeScript types
└── public/                # Static assets
```

## Technologies

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Monaco Editor
- **Desktop**: Electron with native Node.js APIs
- **AI Integration**: @google/genai SDK (native TypeScript/Node.js)
- **File Operations**: Node.js fs module (native)
- **State**: Zustand
- **UI**: Lucide React icons, Framer Motion

## License

MIT
