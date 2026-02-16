const path = require("path");
const { spawn } = require("child_process");

const electronBinary =
  process.platform === "win32"
    ? path.join(__dirname, "..", "node_modules", ".bin", "electron.cmd")
    : path.join(__dirname, "..", "node_modules", ".bin", "electron");

const appRoot = path.resolve(__dirname, "..");
const passthroughArgs = process.argv.slice(2).filter((arg) => arg && arg !== ".");
const args = [appRoot, ...passthroughArgs];
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

console.log(`[joincloud-electron-launcher] binary=${electronBinary}`);
console.log(`[joincloud-electron-launcher] appRoot=${appRoot}`);
console.log(`[joincloud-electron-launcher] args=${JSON.stringify(args)}`);

const proc = spawn(electronBinary, args, {
  stdio: "inherit",
  env,
});

proc.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});

