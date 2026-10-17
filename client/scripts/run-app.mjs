import { spawn } from "node:child_process";
import electronPath from "electron";

const DEBUG_ARGUMENT = "--debug";
const requestedArguments = process.argv.slice(2);
const interactionDebugEnabled = requestedArguments.includes(DEBUG_ARGUMENT);
const electronArguments = requestedArguments.filter((argument) => argument !== DEBUG_ARGUMENT);

const buildExitCode = await runProcess(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  process.env,
);

if (buildExitCode !== 0) {
  process.exitCode = buildExitCode;
} else {
  const electronExitCode = await runProcess(
    electronPath,
    [".", ...electronArguments],
    {
      ...process.env,
      ...(interactionDebugEnabled ? { DOCUMENT_INTERACTION_DEBUG: "1" } : {}),
    },
  );
  process.exitCode = electronExitCode;
}

function runProcess(command, arguments_, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
    });
    const forwardSignal = (signal) => child.kill(signal);
    process.once("SIGINT", forwardSignal);
    process.once("SIGTERM", forwardSignal);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", forwardSignal);
      process.removeListener("SIGTERM", forwardSignal);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}
