/**
 * Agentic Loop Manager - TypeScript port from Python
 * Manages the conversation loop, executes functions, and automatically continues
 * until task_complete or max iterations.
 */

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface FunctionResponse {
  name: string;
  response: any;
}

export class AgenticLoopManager {
  private maxIterations: number;
  private currentIteration: number;
  private isActive: boolean;
  private taskCompleted: boolean;
  private conversationHistory: Array<{
    role: 'user' | 'model' | 'function';
    parts?: Array<any>;
    content?: string;
  }>;

  constructor(maxIterations: number = 50) {
    this.maxIterations = maxIterations;
    this.currentIteration = 0;
    this.isActive = false;
    this.taskCompleted = false;
    this.conversationHistory = [];
  }

  reset(): void {
    this.currentIteration = 0;
    this.conversationHistory = [];
    this.isActive = false;
    this.taskCompleted = false;
  }

  shouldContinueLoop(): boolean {
    if (!this.isActive) {
      return false;
    }

    if (this.taskCompleted) {
      return false;
    }

    if (this.currentIteration >= this.maxIterations) {
      return false;
    }

    return true;
  }

  incrementIteration(): void {
    this.currentIteration++;
  }

  markTaskCompleted(): void {
    this.taskCompleted = true;
    this.isActive = false;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  setIsActive(value: boolean): void {
    this.isActive = value;
  }

  getTaskCompleted(): boolean {
    return this.taskCompleted;
  }

  getCurrentIteration(): number {
    return this.currentIteration;
  }

  addToHistory(message: { role: 'user' | 'model' | 'function'; parts?: Array<any>; content?: string }): void {
    this.conversationHistory.push(message);
  }

  getHistory(): Array<{ role: 'user' | 'model' | 'function'; parts?: Array<any>; content?: string }> {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}
