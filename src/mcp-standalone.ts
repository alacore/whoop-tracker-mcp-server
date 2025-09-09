#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import "reflect-metadata";

interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  stored_at?: number;
}

class WhoopMcpServer {
  private server: Server;
  private tokenFilePath: string;
  private tokens: WhoopTokens | null = null;
  private readonly authBaseUrl = "https://api.prod.whoop.com/oauth";
  private readonly apiBaseUrl = "https://api.prod.whoop.com/developer/v2";
  private readonly handlers = new Map<string, (args: any) => Promise<any>>();

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
    const configDir = path.join(homeDir, ".whoop-mcp");
    this.tokenFilePath = path.join(configDir, "tokens.json");

    this.server = new Server(
      {
        name: "whoop-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );
  }

  async start() {
    await this.ensureConfigDir();
    await this.loadTokens();
    this.setupHandlerMap();
    this.setupHandlers();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // MCP servers should not output anything to stdout except JSON protocol messages
    // console.error("Whoop MCP Server started successfully");
  }

  private async ensureConfigDir() {
    const dir = path.dirname(this.tokenFilePath);
    await fs.mkdir(dir, { recursive: true });
  }

  private async loadTokens() {
    try {
      const data = await fs.readFile(this.tokenFilePath, "utf-8");
      this.tokens = JSON.parse(data);
    } catch (error) {
      // Tokens file doesn't exist yet
    }
  }

  private async saveTokens(tokens: WhoopTokens) {
    this.tokens = {
      ...tokens,
      stored_at: Date.now(),
    };
    await fs.writeFile(
      this.tokenFilePath,
      JSON.stringify(this.tokens, null, 2),
    );
  }

  private isTokenExpired(): boolean {
    if (!this.tokens?.stored_at || !this.tokens?.expires_in) {
      return true;
    }
    const expirationTime =
      this.tokens.stored_at + this.tokens.expires_in * 1000;
    return Date.now() > expirationTime - 60000; // 1 minute buffer
  }

  private setupHandlerMap() {
    this.handlers.set("whoop_auth_url", this.handleAuthUrl.bind(this));
    this.handlers.set("whoop_exchange_token", this.handleTokenExchange.bind(this));
    this.handlers.set("whoop_refresh_token", this.handleTokenRefresh.bind(this));
    this.handlers.set("whoop_get_profile", this.handleGetProfile.bind(this));
    this.handlers.set("whoop_get_body_measurement", this.handleGetBodyMeasurement.bind(this));
    this.handlers.set("whoop_get_cycles", this.handleGetCycles.bind(this));
    this.handlers.set("whoop_get_cycle_by_id", this.handleGetCycleById.bind(this));
    this.handlers.set("whoop_get_recovery", this.handleGetRecovery.bind(this));
    this.handlers.set("whoop_get_recovery_for_cycle", this.handleGetRecoveryForCycle.bind(this));
    this.handlers.set("whoop_get_sleep", this.handleGetSleep.bind(this));
    this.handlers.set("whoop_get_sleep_by_id", this.handleGetSleepById.bind(this));
    this.handlers.set("whoop_get_sleep_for_cycle", this.handleGetSleepForCycle.bind(this));
    this.handlers.set("whoop_get_workouts", this.handleGetWorkouts.bind(this));
    this.handlers.set("whoop_get_workout_by_id", this.handleGetWorkoutById.bind(this));
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "whoop_auth_url",
          description: "Generate OAuth authorization URL for Whoop",
          inputSchema: {
            type: "object",
            properties: {
              state: {
                type: "string",
                description: "Optional state parameter for OAuth flow",
              },
            },
          },
        },
        {
          name: "whoop_exchange_token",
          description: "Exchange authorization code for access token",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "Authorization code from OAuth callback",
              },
            },
            required: ["code"],
          },
        },
        {
          name: "whoop_refresh_token",
          description: "Refresh the access token using refresh token",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "whoop_get_profile",
          description: "Get basic user profile (name, email)",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "whoop_get_body_measurement",
          description: "Get user body measurements (height, weight, max heart rate)",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "whoop_get_cycles",
          description: "Get physiological cycles for a date range",
          inputSchema: {
            type: "object",
            properties: {
              start: {
                type: "string",
                description: "Start datetime (ISO 8601)",
              },
              end: {
                type: "string",
                description: "End datetime (ISO 8601)",
              },
              limit: {
                type: "number",
                description: "Limit on number of cycles (max 25)",
              },
              nextToken: {
                type: "string",
                description: "Token for pagination",
              },
            },
          },
        },
        {
          name: "whoop_get_cycle_by_id",
          description: "Get a specific cycle by ID",
          inputSchema: {
            type: "object",
            properties: {
              cycleId: {
                type: "number",
                description: "Cycle ID",
              },
            },
            required: ["cycleId"],
          },
        },
        {
          name: "whoop_get_recovery",
          description: "Get recovery data for a date range",
          inputSchema: {
            type: "object",
            properties: {
              start: {
                type: "string",
                description: "Start datetime (ISO 8601)",
              },
              end: {
                type: "string",
                description: "End datetime (ISO 8601)",
              },
              limit: {
                type: "number",
                description: "Limit on number of recoveries (max 25)",
              },
              nextToken: {
                type: "string",
                description: "Token for pagination",
              },
            },
          },
        },
        {
          name: "whoop_get_recovery_for_cycle",
          description: "Get recovery for a specific cycle",
          inputSchema: {
            type: "object",
            properties: {
              cycleId: {
                type: "number",
                description: "Cycle ID",
              },
            },
            required: ["cycleId"],
          },
        },
        {
          name: "whoop_get_sleep",
          description: "Get sleep data for a date range",
          inputSchema: {
            type: "object",
            properties: {
              start: {
                type: "string",
                description: "Start datetime (ISO 8601)",
              },
              end: {
                type: "string",
                description: "End datetime (ISO 8601)",
              },
              limit: {
                type: "number",
                description: "Limit on number of sleeps (max 25)",
              },
              nextToken: {
                type: "string",
                description: "Token for pagination",
              },
            },
          },
        },
        {
          name: "whoop_get_sleep_by_id",
          description: "Get a specific sleep by ID",
          inputSchema: {
            type: "object",
            properties: {
              sleepId: {
                type: "string",
                description: "Sleep ID (UUID)",
              },
            },
            required: ["sleepId"],
          },
        },
        {
          name: "whoop_get_sleep_for_cycle",
          description: "Get sleep for a specific cycle",
          inputSchema: {
            type: "object",
            properties: {
              cycleId: {
                type: "number",
                description: "Cycle ID",
              },
            },
            required: ["cycleId"],
          },
        },
        {
          name: "whoop_get_workouts",
          description: "Get workout data for a date range",
          inputSchema: {
            type: "object",
            properties: {
              start: {
                type: "string",
                description: "Start datetime (ISO 8601)",
              },
              end: {
                type: "string",
                description: "End datetime (ISO 8601)",
              },
              limit: {
                type: "number",
                description: "Limit on number of workouts (max 25)",
              },
              nextToken: {
                type: "string",
                description: "Token for pagination",
              },
            },
          },
        },
        {
          name: "whoop_get_workout_by_id",
          description: "Get a specific workout by ID",
          inputSchema: {
            type: "object",
            properties: {
              workoutId: {
                type: "string",
                description: "Workout ID (UUID)",
              },
            },
            required: ["workoutId"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const handler = this.handlers.get(name);
        if (!handler) {
          throw new Error(`Unknown tool: ${name}`);
        }
        
        return await handler(args);
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleAuthUrl(args: any) {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const redirectUri =
      process.env.WHOOP_REDIRECT_URI || "http://localhost:3000/callback";
    const scope =
      process.env.WHOOP_SCOPES ||
      "offline read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout";

    if (!clientId) {
      throw new Error("WHOOP_CLIENT_ID is not configured");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
    });

    // Generate a secure state parameter if not provided
    const state = args?.state || `whoop_auth_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    params.append("state", state);

    const authUrl = `${this.authBaseUrl}/oauth2/auth?${params.toString()}`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ authUrl }, null, 2),
        },
      ],
    };
  }

  private async handleTokenExchange(args: any) {
    if (!args?.code) {
      throw new Error("Authorization code is required");
    }

    const tokenData = new URLSearchParams({
      grant_type: "authorization_code",
      code: args.code,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      redirect_uri:
        process.env.WHOOP_REDIRECT_URI || "http://localhost:3000/callback",
    });

    const response = await fetch(`${this.authBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as WhoopTokens;

    await this.saveTokens(data);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, ...data }, null, 2),
        },
      ],
    };
  }

  private async handleTokenRefresh(args?: any) {
    if (!this.tokens?.refresh_token) {
      throw new Error("No refresh token available");
    }

    const tokenData = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.tokens.refresh_token,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    });

    const response = await fetch(`${this.authBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as WhoopTokens;

    // Preserve existing refresh_token if not returned in response
    const tokens = {
      ...data,
      refresh_token: data.refresh_token || this.tokens.refresh_token,
    };
    await this.saveTokens(tokens);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, ...data }, null, 2),
        },
      ],
    };
  }

  private async handleGetProfile(args?: any) {
    await this.ensureValidToken();

    const response = await fetch(`${this.apiBaseUrl}/user/profile/basic`, {
      headers: {
        Authorization: `Bearer ${this.tokens!.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get profile: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetBodyMeasurement(args?: any) {
    await this.ensureValidToken();

    const response = await fetch(`${this.apiBaseUrl}/user/measurement/body`, {
      headers: {
        Authorization: `Bearer ${this.tokens!.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get body measurement: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetCycles(args: any) {
    await this.ensureValidToken();

    const params = new URLSearchParams();
    if (args?.start) params.append("start", args.start);
    if (args?.end) params.append("end", args.end);
    if (args?.limit) params.append("limit", args.limit.toString());
    if (args?.nextToken) params.append("nextToken", args.nextToken);

    const response = await fetch(
      `${this.apiBaseUrl}/cycle?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get cycles: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetCycleById(args: any) {
    await this.ensureValidToken();

    if (!args?.cycleId) {
      throw new Error("Cycle ID is required");
    }

    const response = await fetch(
      `${this.apiBaseUrl}/cycle/${args.cycleId}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get cycle: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetRecovery(args: any) {
    await this.ensureValidToken();

    const params = new URLSearchParams();
    if (args?.start) params.append("start", args.start);
    if (args?.end) params.append("end", args.end);
    if (args?.limit) params.append("limit", args.limit.toString());
    if (args?.nextToken) params.append("nextToken", args.nextToken);

    const response = await fetch(
      `${this.apiBaseUrl}/recovery?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get recovery: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetRecoveryForCycle(args: any) {
    await this.ensureValidToken();

    if (!args?.cycleId) {
      throw new Error("Cycle ID is required");
    }

    const response = await fetch(
      `${this.apiBaseUrl}/cycle/${args.cycleId}/recovery`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get recovery for cycle: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetSleep(args: any) {
    await this.ensureValidToken();

    const params = new URLSearchParams();
    if (args?.start) params.append("start", args.start);
    if (args?.end) params.append("end", args.end);
    if (args?.limit) params.append("limit", args.limit.toString());
    if (args?.nextToken) params.append("nextToken", args.nextToken);

    const response = await fetch(
      `${this.apiBaseUrl}/activity/sleep?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get sleep: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetSleepById(args: any) {
    await this.ensureValidToken();

    if (!args?.sleepId) {
      throw new Error("Sleep ID is required");
    }

    const response = await fetch(
      `${this.apiBaseUrl}/activity/sleep/${args.sleepId}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get sleep: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetSleepForCycle(args: any) {
    await this.ensureValidToken();

    if (!args?.cycleId) {
      throw new Error("Cycle ID is required");
    }

    const response = await fetch(
      `${this.apiBaseUrl}/cycle/${args.cycleId}/sleep`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get sleep for cycle: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetWorkouts(args: any) {
    await this.ensureValidToken();

    const params = new URLSearchParams();
    if (args?.start) params.append("start", args.start);
    if (args?.end) params.append("end", args.end);
    if (args?.limit) params.append("limit", args.limit.toString());
    if (args?.nextToken) params.append("nextToken", args.nextToken);

    const response = await fetch(
      `${this.apiBaseUrl}/activity/workout?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get workouts: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async handleGetWorkoutById(args: any) {
    await this.ensureValidToken();

    if (!args?.workoutId) {
      throw new Error("Workout ID is required");
    }

    const response = await fetch(
      `${this.apiBaseUrl}/activity/workout/${args.workoutId}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get workout: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async ensureValidToken() {
    if (!this.tokens?.access_token) {
      throw new Error(
        "Not authenticated. Please authenticate first using whoop_auth_url and whoop_exchange_token.",
      );
    }

    if (this.isTokenExpired() && this.tokens.refresh_token) {
      await this.handleTokenRefresh();
    }
  }
}

const server = new WhoopMcpServer();
server.start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
