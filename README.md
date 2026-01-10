# AlphaStudio

A futuristic AI-powered code editor and workspace with native local and non-local AI integration, built with Electron, React, and TypeScript.

## Features

- **Monaco Editor** with autocompletion and modern style widgets
- **Multi-Provider AI Integration** via native Electron IPC:
  - **Ollama** (Native local LLM installation and support for privacy and offline use) 
  - **Google Gemini** (Native API)
  - **xAI Grok** (OpenAI-compatible)
  - **Groq** (OpenAI-compatible, Llama 3)
  - **Moonshot AI** (Kimi, OpenAI-compatible)
- **Chat Panel** with streaming responses, context attachment, and tool execution
- **Task Management** with AI-powered task analysis and dynamic planning
- **Diff Widget** for reviewing generated code changes
- **Agent Terminal** with permission prompts for elevated commands
- **Dual Panel Modes**: File navigation and Project Explorer with search
- **Image & File Context** attachment with preview
- **Multiple Themes**: Light, Dark, Aether gradient, and custom theming support
- **Cross-platform**: Linux, macOS, and Windows

## Showcase

### Canvases

#### Editor
<img width="1366" height="768" alt="screenshot_10012026_223315" src="https://github.com/user-attachments/assets/f022ebde-23b7-48e3-ac2c-a86434dcd0ed" />

#### Media Gallery (Images can be added to context for models that support image context while videos are simply viewed)

1. Image Gallery
<img width="1366" height="768" alt="screenshot_10012026_225718" src="https://github.com/user-attachments/assets/8f1ded35-aa70-421d-a1ff-bd1512814000" />
<img width="1366" height="768" alt="screenshot_10012026_225733" src="https://github.com/user-attachments/assets/4adc6060-2618-4291-b54c-4f68d9e5e67f" />

2. Video Gallery
<img width="1366" height="768" alt="screenshot_10012026_225541" src="https://github.com/user-attachments/assets/d31325e3-c292-406b-a260-31ffc43d7cff" />
<img width="1366" height="768" alt="screenshot_10012026_225632" src="https://github.com/user-attachments/assets/1da9efe6-2dd5-4c84-826c-19b4c94dbfd6" />

#### PDF handling
<img width="1366" height="768" alt="screenshot_10012026_225807" src="https://github.com/user-attachments/assets/527bcbf9-b8ba-406a-9391-75cfd0a2675c" />

### Left sidebar

#### File explorer (Navigate through all your system files -  Changes to root files won't be saved)
<img width="1366" height="768" alt="screenshot_10012026_225110" src="https://github.com/user-attachments/assets/5b0fa875-ef1d-4106-80a3-531d52c5c0d8" />

#### Project tree (Navigate through an open project and easily find files set deeper in the project tree)
<img width="1366" height="768" alt="screenshot_10012026_225044" src="https://github.com/user-attachments/assets/758d862b-be9c-4707-8dc2-0eedb11c41a3" />

### Right sidebar

#### Chat interface (Modern interface to interact with your selected agent model)
<img width="1366" height="768" alt="screenshot_10012026_225832" src="https://github.com/user-attachments/assets/dbb6bb42-7f5e-4296-92c9-9cfebcd84a21" />

#### Terminal (User centric terminal for code execution directly from the app)
<img width="1366" height="768" alt="screenshot_10012026_225842" src="https://github.com/user-attachments/assets/1018a595-3ca2-473b-93bd-7ee8047900bb" />

### Settings

#### Handle app license key setup, user theme settings, AI API key setup, Pulling local Ollama models directly from the app
<img width="1366" height="768" alt="screenshot_10012026_230016" src="https://github.com/user-attachments/assets/a4683f27-b6f1-40e9-92f4-cbdf9d70ad21" />
<img width="1366" height="768" alt="screenshot_10012026_230016" src="https://github.com/user-attachments/assets/4a6a1439-d9fa-4284-a67c-8c21531c9b41" />
<img width="1366" height="768" alt="screenshot_10012026_230016" src="https://github.com/user-attachments/assets/2f2a5862-972c-4bc7-a108-8654540740c7" />

## Usage

1. **Configure AI**: Open Settings to set up your preferred AI model and provider.
2. **Open Project**: Use the Project view to open a folder and search for files.
3. **Chat with AI**: Use the chat panel to ask questions, generate code, or execute complex tasks.
4. **Manage Tasks**: Add tasks in the task panel - the AI can create plans and track progress.
5. **Review Changes**: When AI suggests changes (using `write_file`), review them in the diff widget before applying.
6. **Execute Commands**: Use the terminal panel to run commands safely.

## Technologies

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Monaco Editor
- **Desktop**: Electron with native Node.js APIs
- **AI Integration**: Custom provider adapters for Gemini, OpenAI-compatible APIs, and Ollama
- **File Operations**: Node.js fs module (native)
- **State**: Zustand
- **UI**: Lucide React icons, Framer Motion
