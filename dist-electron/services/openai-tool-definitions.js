"use strict";
/**
 * OpenAI-compatible tool definitions for OpenWebAI
 * Converted from Gemini format
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENAI_TOOL_DEFINITIONS = void 0;
exports.OPENAI_TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Reads the full content of a file. Use this to understand code before modifying it.',
            parameters: {
                type: 'object',
                properties: {
                    file_path: {
                        type: 'string',
                        description: 'Path to the file to read (relative or absolute)',
                    },
                },
                required: ['file_path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'write_file',
            description: 'Writes or modifies file content. This is the PRIMARY action for all file modifications. Use this to create or modify files. When user asks to generate/create files, use this tool immediately.',
            parameters: {
                type: 'object',
                properties: {
                    file_path: {
                        type: 'string',
                        description: 'Path to the file to write (will be created if it doesn\'t exist). Use absolute paths like ~/filename.md or /home/username/filename.md',
                    },
                    content: {
                        type: 'string',
                        description: 'Full file content to write',
                    },
                },
                required: ['file_path', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_files',
            description: 'Lists files and directories in a given directory. Use this to explore project structure.',
            parameters: {
                type: 'object',
                properties: {
                    directory_path: {
                        type: 'string',
                        description: 'Path to the directory to list (relative or absolute)',
                    },
                },
                required: ['directory_path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'grep_lines',
            description: 'Reads specific line ranges from a file. Use this when modifying existing files to read only the relevant sections (more efficient than read_file for targeted changes). Use read_file when you need the complete file context.',
            parameters: {
                type: 'object',
                properties: {
                    file_path: {
                        type: 'string',
                        description: 'Path to the file to read lines from (relative or absolute)',
                    },
                    start_line: {
                        type: 'integer',
                        description: 'Starting line number (1-indexed)',
                    },
                    end_line: {
                        type: 'integer',
                        description: 'Ending line number (1-indexed, inclusive)',
                    },
                },
                required: ['file_path', 'start_line', 'end_line'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_code',
            description: 'Searches the codebase for patterns using grep. Use this to find where code patterns exist.',
            parameters: {
                type: 'object',
                properties: {
                    search_term: {
                        type: 'string',
                        description: 'Search term or pattern to find in the codebase',
                    },
                },
                required: ['search_term'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_plan',
            description: 'Creates or updates a plan/to-do list with checkable steps. Use this for complex tasks with multiple steps. You can update the plan later by calling this again with completed steps marked. The plan widget shows a checklist that you control - mark steps as completed as you finish them.',
            parameters: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'Title of the plan',
                    },
                    steps: {
                        type: 'array',
                        description: 'Array of plan steps. Each step should have description and optionally status (pending, in-progress, completed). When updating an existing plan, include all steps with updated statuses.',
                        items: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    description: 'Unique step ID (use same ID when updating to mark as completed)',
                                },
                                description: {
                                    type: 'string',
                                    description: 'Description of the step',
                                },
                                status: {
                                    type: 'string',
                                    enum: ['pending', 'in-progress', 'completed', 'skipped'],
                                    description: 'Status of the step. Use \'completed\' when you finish a step, \'in-progress\' when working on it, \'pending\' for not started.',
                                },
                                order: {
                                    type: 'number',
                                    description: 'Order/sequence number of the step',
                                },
                            },
                            required: ['id', 'description', 'status', 'order'],
                        },
                    },
                },
                required: ['title', 'steps'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'task_complete',
            description: 'Marks the current task as complete and ends the agentic loop. Use this ONLY when the task is fully completed, all requested work is done, and you have provided a summary. After calling this, the agentic loop will end and the system will clear the active state.',
            parameters: {
                type: 'object',
                properties: {
                    summary: {
                        type: 'string',
                        description: 'Final summary of the completed task. Should use numbered points with optional bullet points underneath for clarity. Format: 1. Main point one - Detail one - Detail two 2. Main point two - Detail one',
                    },
                },
                required: ['summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'execute_command',
            description: 'Executes shell commands. For commands requiring elevated privileges (sudo, etc.), set needs_elevation=True and the user will be prompted for approval.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'Command to execute',
                    },
                    needs_elevation: {
                        type: 'boolean',
                        description: 'Whether the command requires elevated privileges (sudo, etc.)',
                    },
                },
                required: ['command'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_web',
            description: 'Search the web for current information, documentation, tutorials, or answers. Use this when you need up-to-date information, recent documentation, or real-time data that might not be in your training data.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query or question to search for',
                    },
                    max_results: {
                        type: 'integer',
                        description: 'Maximum number of results to return (default: 5, max: 10)',
                    },
                },
                required: ['query'],
            },
        },
    },
];
//# sourceMappingURL=openai-tool-definitions.js.map