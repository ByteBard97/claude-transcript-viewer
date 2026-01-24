/**
 * Embedding Server Manager
 *
 * Manages the MLX Qwen3 embedding server lifecycle on Apple Silicon.
 * Automatically sets up Python venv, installs dependencies, and spawns the server.
 * Falls back gracefully on non-Apple systems or setup failures.
 */

import { spawn, spawnSync, ChildProcess } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, arch } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Server configuration
const DEFAULT_PORT = 8100; // Use different port to avoid conflicts
const HEALTH_CHECK_INTERVAL = 5000;
const STARTUP_TIMEOUT = 120000; // 2 minutes for model download on first run
const VENV_DIR = ".embedding-venv";

export interface ServerManagerOptions {
  port?: number;
  modelName?: string;
  verbose?: boolean;
  dataDir?: string; // Where to store venv (defaults to user's home)
}

export interface ServerStatus {
  running: boolean;
  healthy: boolean;
  port?: number;
  model?: string;
  dim?: number;
  error?: string;
}

/**
 * Check if running on Apple Silicon
 */
export function isAppleSilicon(): boolean {
  return platform() === "darwin" && arch() === "arm64";
}

/**
 * Check if Python 3 is available and return its path
 */
function getPythonPath(): string | null {
  const candidates = ["python3", "python"];

  for (const cmd of candidates) {
    const result = spawnSync(cmd, ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
    });

    if (result.status === 0) {
      const version = (result.stdout || result.stderr || "").trim();
      if (version.includes("Python 3")) {
        return cmd;
      }
    }
  }
  return null;
}

/**
 * Manages the embedding server subprocess
 */
export class EmbeddingServerManager {
  private process: ChildProcess | null = null;
  private port: number;
  private modelName: string;
  private verbose: boolean;
  private dataDir: string;
  private venvPath: string;
  private pythonPath: string | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private _status: ServerStatus = { running: false, healthy: false };

  constructor(options: ServerManagerOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT;
    this.modelName =
      options.modelName ?? "mlx-community/Qwen3-Embedding-0.6B-4bit-DWQ";
    this.verbose = options.verbose ?? false;
    this.dataDir =
      options.dataDir ??
      join(process.env.HOME ?? "~", ".claude-transcript-viewer");
    this.venvPath = join(this.dataDir, VENV_DIR);
  }

  get status(): ServerStatus {
    return { ...this._status };
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /**
   * Check if the system supports MLX embeddings
   */
  canRun(): { supported: boolean; reason?: string } {
    if (!isAppleSilicon()) {
      return {
        supported: false,
        reason: "MLX embeddings require Apple Silicon (M1/M2/M3/M4)",
      };
    }

    this.pythonPath = getPythonPath();
    if (!this.pythonPath) {
      return {
        supported: false,
        reason: "Python 3 not found. Install Python 3.9+ to enable embeddings.",
      };
    }

    return { supported: true };
  }

  /**
   * Set up the Python virtual environment and install dependencies
   */
  async setup(): Promise<{ success: boolean; error?: string }> {
    const check = this.canRun();
    if (!check.supported) {
      return { success: false, error: check.reason };
    }

    try {
      // Create data directory
      if (!existsSync(this.dataDir)) {
        mkdirSync(this.dataDir, { recursive: true });
      }

      // Create venv if it doesn't exist
      if (!existsSync(this.venvPath)) {
        this.log("Creating Python virtual environment...");
        const venvResult = spawnSync(
          this.pythonPath!,
          ["-m", "venv", this.venvPath],
          {
            encoding: "utf-8",
            stdio: this.verbose ? "inherit" : "pipe",
          }
        );

        if (venvResult.status !== 0) {
          return {
            success: false,
            error: `Failed to create venv: ${venvResult.stderr}`,
          };
        }
      }

      // Get venv python path
      const venvPython = join(this.venvPath, "bin", "python");

      // Check if dependencies are installed
      const pipListResult = spawnSync(venvPython, ["-m", "pip", "list"], {
        encoding: "utf-8",
        timeout: 30000,
      });

      const pipListOutput = pipListResult.stdout || "";
      const hasMLX = pipListOutput.toLowerCase().includes("mlx-lm");
      const hasFastAPI = pipListOutput.toLowerCase().includes("fastapi");

      if (!hasMLX || !hasFastAPI) {
        this.log(
          "Installing MLX embedding dependencies (this may take a few minutes)..."
        );
        const requirementsPath = this.getRequirementsPath();

        const installResult = spawnSync(
          venvPython,
          ["-m", "pip", "install", "-r", requirementsPath, "--quiet"],
          {
            encoding: "utf-8",
            stdio: this.verbose ? "inherit" : "pipe",
            timeout: 300000, // 5 minute timeout for pip install
          }
        );

        if (installResult.status !== 0) {
          return {
            success: false,
            error: `Failed to install dependencies: ${installResult.stderr}`,
          };
        }

        this.log("Dependencies installed successfully");
      }

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown setup error";
      return { success: false, error: message };
    }
  }

  /**
   * Start the embedding server
   */
  async start(): Promise<{ success: boolean; error?: string }> {
    if (this.process) {
      return { success: true }; // Already running
    }

    // Run setup first
    const setupResult = await this.setup();
    if (!setupResult.success) {
      this._status = {
        running: false,
        healthy: false,
        error: setupResult.error,
      };
      return setupResult;
    }

    try {
      const venvPython = join(this.venvPath, "bin", "python");
      const serverScript = this.getServerScriptPath();

      this.log(`Starting embedding server on port ${this.port}...`);

      this.process = spawn(venvPython, [serverScript], {
        env: {
          ...process.env,
          PORT: String(this.port),
          MODEL_NAME: this.modelName,
          LOG_LEVEL: this.verbose ? "DEBUG" : "WARNING",
        },
        stdio: this.verbose ? "inherit" : "pipe",
        detached: false,
      });

      this.process.on("error", (err) => {
        this.log(`Server process error: ${err.message}`);
        this._status = { running: false, healthy: false, error: err.message };
        this.process = null;
      });

      this.process.on("exit", (code) => {
        this.log(`Server process exited with code ${code}`);
        this._status = { running: false, healthy: false };
        this.process = null;
        this.stopHealthCheck();
      });

      // Wait for server to be healthy
      const healthy = await this.waitForHealthy(STARTUP_TIMEOUT);
      if (!healthy) {
        this.stop();
        return {
          success: false,
          error: "Server failed to become healthy within timeout",
        };
      }

      // Start health check monitoring
      this.startHealthCheck();

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown start error";
      this._status = { running: false, healthy: false, error: message };
      return { success: false, error: message };
    }
  }

  /**
   * Stop the embedding server
   */
  stop(): void {
    this.stopHealthCheck();

    if (this.process) {
      this.log("Stopping embedding server...");
      this.process.kill("SIGTERM");

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.process) {
          this.process.kill("SIGKILL");
        }
      }, 5000);

      this.process = null;
    }

    this._status = { running: false, healthy: false };
  }

  /**
   * Check server health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.url}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as {
        status: string;
        model?: string;
        model_name?: string;
        dim?: number;
        embedding_dim?: number;
      };

      if (data.status === "ok") {
        this._status = {
          running: true,
          healthy: true,
          port: this.port,
          model: data.model ?? data.model_name,
          dim: data.dim ?? data.embedding_dim,
        };
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Wait for server to become healthy
   */
  private async waitForHealthy(timeout: number): Promise<boolean> {
    const start = Date.now();
    const checkInterval = 1000;

    while (Date.now() - start < timeout) {
      if (await this.checkHealth()) {
        this.log("Embedding server is ready");
        return true;
      }
      await new Promise((r) => setTimeout(r, checkInterval));
    }

    return false;
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      const healthy = await this.checkHealth();
      if (!healthy && this._status.healthy) {
        this.log("Embedding server health check failed");
        this._status.healthy = false;
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Get path to the Python server script
   */
  private getServerScriptPath(): string {
    // Both dev and prod: python/ is at package root
    // __dirname = src/embeddings/ (dev) or dist/embeddings/ (prod)
    // So ../../python/ works for both
    const pythonPath = join(__dirname, "../../python/embed_server.py");

    if (existsSync(pythonPath)) {
      return pythonPath;
    }

    throw new Error(
      `Embedding server script not found at ${pythonPath}. ` +
        "Ensure the python/ directory is included in the package."
    );
  }

  /**
   * Get path to requirements.txt
   */
  private getRequirementsPath(): string {
    const requirementsPath = join(__dirname, "../../python/requirements.txt");

    if (existsSync(requirementsPath)) {
      return requirementsPath;
    }

    throw new Error(
      `Requirements file not found at ${requirementsPath}. ` +
        "Ensure the python/ directory is included in the package."
    );
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[EmbeddingServer] ${message}`);
    }
  }
}

/**
 * Create and optionally start an embedding server manager
 */
export async function createEmbeddingServer(
  options: ServerManagerOptions & { autoStart?: boolean } = {}
): Promise<EmbeddingServerManager | null> {
  const manager = new EmbeddingServerManager(options);

  const check = manager.canRun();
  if (!check.supported) {
    if (options.verbose) {
      console.log(`[EmbeddingServer] ${check.reason}`);
    }
    return null;
  }

  if (options.autoStart !== false) {
    const result = await manager.start();
    if (!result.success) {
      if (options.verbose) {
        console.log(`[EmbeddingServer] Failed to start: ${result.error}`);
      }
      return null;
    }
  }

  return manager;
}
