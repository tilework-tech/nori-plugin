/**
 * Agent registry for managing AI agent implementations
 * Singleton registry that maps agent names to implementations
 */

import { claudeCodeAgent } from "@/cli/features/claude-code/agent.js";

import type { Agent } from "@/cli/features/types.js";

/**
 * Registry singleton for managing agent implementations
 */
export class AgentRegistry {
  private static instance: AgentRegistry | null = null;
  private agents: Map<string, Agent>;

  private constructor() {
    this.agents = new Map();

    // Register all agents
    this.register(claudeCodeAgent);
  }

  /**
   * Register an agent implementation
   * @param agent The agent to register
   */
  private register(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  /**
   * Get the singleton instance
   * @returns The AgentRegistry singleton instance
   */
  public static getInstance(): AgentRegistry {
    if (AgentRegistry.instance == null) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static resetInstance(): void {
    AgentRegistry.instance = null;
  }

  /**
   * Get an agent by name
   * @param args - Configuration arguments
   * @param args.name - The agent name to look up
   *
   * @throws Error if agent not found
   *
   * @returns The agent implementation
   */
  public get(args: { name: string }): Agent {
    const { name } = args;
    const agent = this.agents.get(name);

    if (agent == null) {
      const available = this.list().join(", ");
      throw new Error(
        `Unknown agent '${name}'. Available agents: ${available}`,
      );
    }

    return agent;
  }

  /**
   * Get the default agent (claude-code)
   * @returns The default agent implementation
   */
  public getDefault(): Agent {
    return this.get({ name: "claude-code" });
  }

  /**
   * List all registered agent names
   * @returns Array of agent names
   */
  public list(): Array<string> {
    return Array.from(this.agents.keys());
  }
}
