// packages/ai-core/src/tool-registry.ts
import type { ToolDefinition } from './types.js';

export interface ToolResult {
  ok: boolean;
  content: string;
  error?: string;
}

export interface ToolRegistration extends ToolDefinition {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  requiresConfirmation: boolean;
  /** If true, tool must execute in the renderer process (needs editor access) */
  rendererOnly?: boolean;
}

export class ToolRegistry {
  private tools = new Map<string, ToolRegistration>();

  register(tool: ToolRegistration): () => void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    // Capture reference so unregister only removes this exact registration
    const registeredTool = tool;
    return () => {
      if (this.tools.get(tool.name) === registeredTool) {
        this.tools.delete(tool.name);
      }
    };
  }

  get(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    }));
  }
}
