import { programState, getBlockFromAnchor, getOwnAnchor, evaluateBlock } from "./evaluator.js";
import { logToConsole, executeBlock, executeStack } from "./executor.js";

const right = document.getElementById("right");

const debugMode = {
  active: false,
  cursor: -1,
  paused: true,
  continueTimer: null,
};

let stepQueue = [];

let debugLastState = {
  variables: {},
  arrays: {},
};

function evalStringAnchor(block, selector) {
  const b = getBlockFromAnchor(block.querySelector(selector));
  return b ? String(evaluateBlock(b)) : null;
}

function collectStepsFromAnchor(anchor, dest) {
  if (!anchor) return;
  collectSteps(anchor.querySelector(".stack"), dest);
}

function collectSteps(stack, steps) {
  if (!stack) return;
  Array.from(stack.children).forEach((block) => collectBlockSteps(block, steps));
}

function describeBlock(block) {
  const map = {
    print: "Вывести",
    variable: "Переменная",
    "array-block": "Массив",
    "array-set": "Изменение массива",
    "if-block": "Если",
    "while-block": "Пока",
    "func-def": "Функция (определение)",
    "func-call": "Вызов функции",
    "cond-block": "Условие",
    "for-block": "Для (for)",
  };
  for (const [cls, label] of Object.entries(map)) {
    if (block.classList.contains(cls)) return label;
  }
  return "Блок";
}

function collectBlockSteps(block, steps) {
  if (block.classList.contains("if-block")) {
    steps.push({
      block,
      desc: "Если — проверка условия",
      execute(ctx) {
        const condBlock = getBlockFromAnchor(block.querySelector(".if-cond-anchor"));
        const result = condBlock ? evaluateBlock(condBlock) : 0;
        logToConsole(`→ Условие: ${result ? "ИСТИНА" : "ЛОЖЬ"}`);
        if (result) {
          collectStepsFromAnchor(block.querySelector(".if-body-anchor"), ctx.extraSteps);
        } else {
          const toggle = block.querySelector(".if-else-toggle");
          if (toggle?.checked) {
            collectStepsFromAnchor(block.querySelector(".if-else-anchor"), ctx.extraSteps);
          }
        }
      },
    });

  } else if (block.classList.contains("while-block")) {
    const whileStep = {
      block,
      desc: "Пока — проверка условия",
      iterations: 0,
      execute(ctx) {
        if (++whileStep.iterations > 1000) {
          logToConsole("⚠ Превышено 1000 итераций, цикл остановлен");
          return;
        }
        const condBlock = getBlockFromAnchor(getOwnAnchor(block, "while-cond-anchor"));
        const condition = condBlock ? evaluateBlock(condBlock) : 0;
        logToConsole(
          `Условие: ${condition ? `ИСТИНА (итерация ${whileStep.iterations})` : "ЛОЖЬ — выход из цикла"}`
        );
        if (condition) {
          const bodySteps = [];
          collectStepsFromAnchor(getOwnAnchor(block, "while-body-anchor"), bodySteps);
          ctx.extraSteps.push(...bodySteps, whileStep);
        }
      },
    };
    steps.push(whileStep);

  } else if (block.classList.contains("for-block")) {
    const initStack = block.querySelector(".for-init-anchor .stack");
    if (initStack) for (const b of initStack.children) executeBlock(b);

    const forStep = {
      block,
      desc: "Для — проверка условия",
      iterations: 0,
      execute(ctx) {
        if (++forStep.iterations > 1000) {
          logToConsole("⚠ Превышено 1000 итераций, цикл остановлен");
          return;
        }
        const condBlock = getBlockFromAnchor(getOwnAnchor(block, "for-cond-anchor"));
        const condition = condBlock ? evaluateBlock(condBlock) : 0;
        logToConsole(
          `Условие: ${condition ? `ИСТИНА (итерация ${forStep.iterations})` : "ЛОЖЬ — выход из цикла"}`
        );
        if (condition) {
          const bodySteps = [];
          collectStepsFromAnchor(getOwnAnchor(block, "for-body-anchor"), bodySteps);
          const stepStack = block.querySelector(".for-step-anchor .stack");
          const stepSteps = [];
          if (stepStack) {
            Array.from(stepStack.children).forEach((b) => {
              if (b.classList.contains("text-block") || b.dataset.blockType === "value") {
                stepSteps.push({ block: b, desc: "Шаг", execute: () => evaluateBlock(b) });
              } else {
                collectBlockSteps(b, stepSteps);
              }
            });
          }
          ctx.extraSteps.push(...bodySteps, ...stepSteps, forStep);
        }
      },
    };
    steps.push(forStep);

  } else if (block.classList.contains("func-def")) {
    steps.push({
      block,
      desc: "Функция — определение",
      execute() {
        const name = evalStringAnchor(block, ".func-def-name-anchor");
        if (!name) return;
        programState.functions[name] = block.querySelector(".func-def-body-anchor .stack");
        logToConsole(`Функция "${name}" определена`);
      },
    });

  } else if (block.classList.contains("func-call")) {
    steps.push({
      block,
      desc: "Вызов функции",
      execute(ctx) {
        const name = evalStringAnchor(block, ".func-call-name-anchor");
        if (!name) return;
        logToConsole(`Вызов "${name}"`);
        const bodyStack = programState.functions[name];
        if (bodyStack) {
          collectSteps(bodyStack, ctx.extraSteps);
        } else {
          logToConsole(`Функция "${name}" не найдена`);
        }
      },
    });

  } else {
    steps.push({
      block,
      desc: describeBlock(block),
      execute: () => executeBlock(block),
    });
  }
}

function logStateChanges() {
  for (const [k, v] of Object.entries(programState.variables)) {
    if (debugLastState.variables[k] !== v) {
      logToConsole(`Переменная "${k}" = ${v}`);
      debugLastState.variables[k] = v;
    }
  }
  for (const [k, v] of Object.entries(programState.arrays)) {
    if (JSON.stringify(debugLastState.arrays[k]) !== JSON.stringify(v)) {
      logToConsole(`Массив "${k}" = [${v.join(", ")}]`);
      debugLastState.arrays[k] = [...v];
    }
  }
}

function clearHighlights(cls) {
  document.querySelectorAll(`.${cls}`).forEach((el) => el.classList.remove(cls));
}

function highlightBlock(block) {
  clearHighlights("debug-current");
  clearHighlights("debug-done");
  if (block) {
    block.classList.add("debug-current");
    block.scrollIntoView({ behavior: "auto", block: "nearest" });
  }
}

function highlightDone(block) {
  block?.classList.add("debug-done");
}

function updateDebugLabel(text, type = "") {
  const lbl = document.getElementById("debug-label");
  lbl.textContent = text;
  lbl.className = type ? `debug-label-${type}` : "";
}

function setRunButtonDisabled(disabled) {
  document.getElementById("run-btn").disabled = disabled;
}

function setDebugButtonActive(active) {
  document.getElementById("debug-btn").classList.toggle("active", active);
}

function setDebugToolbarVisible(visible) {
  document.getElementById("debug-toolbar").style.display = visible ? "flex" : "none";
}

function resetDebugState() {
  programState.variables = {};
  programState.arrays = {};
  programState.functions = {};
  debugLastState = { variables: {}, arrays: {} };
  stepQueue = [];
  debugMode.cursor = -1;
  debugMode.active = false;
  debugMode.paused = true;
  if (debugMode.continueTimer) {
    clearTimeout(debugMode.continueTimer);
    debugMode.continueTimer = null;
  }
  document.getElementById("dbg-continue").textContent = "▶";
}

function startDebug() {
  if (debugMode.active) stopDebug();

  document.getElementById("console-out").innerHTML = "";
  resetDebugState();

  const root = right.querySelector(".anchor-H0");
  if (!root) return;

  collectSteps(root.querySelector(".stack"), stepQueue);

  if (stepQueue.length === 0) {
    logToConsole("Нет блоков для отладки.");
    return;
  }

  debugMode.active = true;
  debugMode.cursor = 0;

  setDebugToolbarVisible(true);
  setRunButtonDisabled(true);
  setDebugButtonActive(true);

  updateDebugLabel("Отладка готова к запуску", "paused");
  highlightBlock(stepQueue[0].block);
  logToConsole("Режим отладки запущен.");
}

function stepForward() {
  if (!debugMode.active) return;

  if (debugMode.cursor >= stepQueue.length) {
    finishDebug();
    return;
  }

  const step = stepQueue[debugMode.cursor];
  highlightBlock(step.block);
  updateDebugLabel(`Шаг ${debugMode.cursor + 1} / ${stepQueue.length}: ${step.desc}`, "running");

  const ctx = { extraSteps: [] };
  try {
    step.execute(ctx);
  } catch (err) {
    logToConsole("Ошибка: " + err.message);
  }

  if (ctx.extraSteps.length > 0) {
    stepQueue.splice(debugMode.cursor + 1, 0, ...ctx.extraSteps);
  }

  highlightDone(step.block);
  logStateChanges();
  debugMode.cursor++;

  if (debugMode.cursor >= stepQueue.length) {
    finishDebug();
  } else {
    highlightBlock(stepQueue[debugMode.cursor].block);
    updateDebugLabel(`Следующий: ${stepQueue[debugMode.cursor].desc}`, "paused");
  }
}

function continueDebug() {
  if (!debugMode.active) return;

  if (!debugMode.paused) {
    debugMode.paused = true;
    if (debugMode.continueTimer) {
      clearTimeout(debugMode.continueTimer);
      debugMode.continueTimer = null;
    }
    document.getElementById("dbg-continue").textContent = "▶";
    updateDebugLabel(
      stepQueue[debugMode.cursor]
        ? `Пауза — следующий: ${stepQueue[debugMode.cursor].desc}`
        : "Пауза",
      "paused"
    );
    return;
  }

  debugMode.paused = false;
  document.getElementById("dbg-continue").textContent = "⏸";
  updateDebugLabel("Выполняется...", "running");

  function runNext() {
    if (!debugMode.active || debugMode.paused) return;
    if (debugMode.cursor >= stepQueue.length) {
      finishDebug();
      return;
    }
    stepForward();
    if (debugMode.active && !debugMode.paused) {
      debugMode.continueTimer = setTimeout(runNext, 120);
    }
  }

  runNext();
}

function finishDebug() {
  if (!debugMode.active) return;

  debugMode.active = false;
  debugMode.paused = true;

  clearHighlights("debug-current");
  updateDebugLabel("Выполнено", "done");
  logToConsole("Программа завершена.");

  setRunButtonDisabled(false);
  setDebugButtonActive(false);
  document.getElementById("dbg-continue").textContent = "▶";

  if (debugMode.continueTimer) {
    clearTimeout(debugMode.continueTimer);
    debugMode.continueTimer = null;
  }
}

function stopDebug() {
  const wasActive = debugMode.active;

  resetDebugState();
  clearHighlights("debug-current");
  clearHighlights("debug-done");
  setDebugToolbarVisible(false);
  setRunButtonDisabled(false);
  setDebugButtonActive(false);

  if (wasActive) logToConsole("Отладка остановлена.");
}

document.getElementById("debug-btn").addEventListener("click", startDebug);
document.getElementById("dbg-step").addEventListener("click", stepForward);
document.getElementById("dbg-continue").addEventListener("click", continueDebug);
document.getElementById("dbg-stop").addEventListener("click", stopDebug);