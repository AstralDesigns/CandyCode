"use strict";
/**
 * Agentic Loop Manager - TypeScript port from Python
 * Manages the conversation loop, executes functions, and automatically continues
 * until task_complete or max iterations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenticLoopManager = void 0;
class AgenticLoopManager {
    maxIterations;
    currentIteration;
    isActive;
    taskCompleted;
    conversationHistory;
    constructor(maxIterations = 50) {
        this.maxIterations = maxIterations;
        this.currentIteration = 0;
        this.isActive = false;
        this.taskCompleted = false;
        this.conversationHistory = [];
    }
    reset() {
        this.currentIteration = 0;
        this.conversationHistory = [];
        this.isActive = false;
        this.taskCompleted = false;
    }
    shouldContinueLoop() {
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
    incrementIteration() {
        this.currentIteration++;
    }
    markTaskCompleted() {
        this.taskCompleted = true;
        this.isActive = false;
    }
    getIsActive() {
        return this.isActive;
    }
    setIsActive(value) {
        this.isActive = value;
    }
    getTaskCompleted() {
        return this.taskCompleted;
    }
    getCurrentIteration() {
        return this.currentIteration;
    }
    addToHistory(message) {
        this.conversationHistory.push(message);
    }
    getHistory() {
        return this.conversationHistory;
    }
    clearHistory() {
        this.conversationHistory = [];
    }
}
exports.AgenticLoopManager = AgenticLoopManager;
//# sourceMappingURL=agentic-loop.service.js.map