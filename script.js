const left = document.getElementById("left");
const right = document.getElementById("right");

let dragged = null;
let fromPalette = false;
let placeholder = null;
let originalParent = null;
let originalNextSibling = null;

function getBlockType(block) {
  return block ? block.dataset.blockType || "any" : "any";
}

function stackAccepts(stack) {
  const anchor = stack.closest("[data-accepts]");
  return anchor ? anchor.dataset.accepts || "any" : "any";
}

function getStackLimit(stack) {
  const anchor = stack.closest("[data-accepts]");
  if (!anchor) return Infinity;
  const raw = anchor.dataset.limit;
  if (raw === undefined || raw === "" || raw === "inf") return Infinity;
  const n = Number(raw);
  return isNaN(n) ? Infinity : n;
}

function isDropAllowed(block, stack) {
  if (!block || !stack) return false;
  const blockType = getBlockType(block);
  const accepts = stackAccepts(stack);

  if (accepts !== "any" && blockType !== "any" && accepts !== blockType)
    return false;

  const limit = getStackLimit(stack);
  if (isFinite(limit)) {
    const realChildren = [...stack.children].filter(
      (c) => !c.classList.contains("drop-placeholder"),
    );
    if (realChildren.length >= limit) return false;
  }

  return true;
}

function createPlaceholder() {
  const el = document.createElement("div");
  el.className = "drop-placeholder";
  return el;
}

function removePlaceholder() {
  if (placeholder && placeholder.parentNode)
    placeholder.parentNode.removeChild(placeholder);
  placeholder = null;
}

function getInsertionPoint(stack, clientY) {
  const children = [...stack.children].filter(
    (c) => !c.classList.contains("drop-placeholder"),
  );
  for (let i = 0; i < children.length; i++) {
    const rect = children[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return children[i];
  }
  return null;
}

function findTargetStack(target) {
  let el = target;
  while (el && el !== document) {
    if (dragged && el === dragged) break;
    if (el.classList && el.classList.contains("stack") && right.contains(el)) {
      if (!dragged || !dragged.contains(el)) return el;
    }
    if (el.classList && el.classList.contains("anchor") && right.contains(el)) {
      const s = el.querySelector(":scope > .stack");
      if (s && (!dragged || !dragged.contains(s))) return s;
    }
    el = el.parentElement;
  }
  const rootAnchor = right.querySelector(".anchor-H0");
  return rootAnchor ? rootAnchor.querySelector(".stack") : null;
}

let lastRejectedStack = null;

function showRejectFeedback(stack) {
  if (lastRejectedStack === stack) return;
  clearRejectFeedback();
  lastRejectedStack = stack;
  const anchor = stack.closest("[data-accepts]");
  if (anchor) anchor.classList.add("reject-drop");
}

function clearRejectFeedback() {
  if (lastRejectedStack) {
    const anchor = lastRejectedStack.closest("[data-accepts]");
    if (anchor) anchor.classList.remove("reject-drop");
    lastRejectedStack = null;
  }
}

document.addEventListener("dragstart", (e) => {
  const block = e.target.closest(".block");
  if (!block) return;

  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
    e.preventDefault();
    return;
  }

  dragged = block;
  fromPalette = left.contains(block);
  originalParent = block.parentNode;
  originalNextSibling = block.nextSibling;
  block.classList.add("dragging");
});

document.addEventListener("dragend", () => {
  if (dragged) dragged.classList.remove("dragging");
  dragged = null;
  removePlaceholder();
  clearRejectFeedback();
});

right.addEventListener("dragover", (e) => {
  e.preventDefault();

  const overDragged =
    !fromPalette &&
    dragged &&
    (e.target === dragged || dragged.contains(e.target));

  if (overDragged) {
    clearRejectFeedback();
    if (!placeholder) placeholder = createPlaceholder();
    if (originalNextSibling)
      originalParent.insertBefore(placeholder, originalNextSibling);
    else originalParent.appendChild(placeholder);
    return;
  }

  const targetStack = findTargetStack(e.target);
  if (!targetStack) {
    removePlaceholder();
    clearRejectFeedback();
    return;
  }

  if (!isDropAllowed(dragged, targetStack)) {
    removePlaceholder();
    showRejectFeedback(targetStack);
    e.dataTransfer.dropEffect = "none";
    return;
  }

  clearRejectFeedback();
  if (!placeholder) placeholder = createPlaceholder();
  const insertBefore = getInsertionPoint(targetStack, e.clientY);
  if (insertBefore) targetStack.insertBefore(placeholder, insertBefore);
  else targetStack.appendChild(placeholder);
});

right.addEventListener("dragleave", (e) => {
  if (!right.contains(e.relatedTarget)) {
    removePlaceholder();
    clearRejectFeedback();
  }
});

right.addEventListener("drop", (e) => {
  e.preventDefault();
  clearRejectFeedback();
  if (!dragged) return;

  const targetStack = findTargetStack(e.target);
  if (targetStack && !isDropAllowed(dragged, targetStack)) {
    removePlaceholder();
    return;
  }

  let block;

  if (fromPalette) {
    block = dragged.cloneNode(true);
    block.setAttribute("draggable", "true");

    const inputs = block.querySelectorAll("input, select");
    inputs.forEach((inp) => {
      inp.disabled = false;
      inp.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
      });
    });

    const elseToggle = block.querySelector(".if-else-toggle");
    if (elseToggle) {
      const elseAnchor = block.querySelector(".if-else-anchor");
      elseToggle.addEventListener("change", () => {
        if (elseToggle.checked) {
          elseAnchor.style.display = "block";
        } else {
          elseAnchor.style.display = "none";
          elseAnchor.querySelector(".stack").innerHTML = "";
        }
      });
    }

    const modeSelect = block.querySelector(".var-mode");
    if (modeSelect) {
      const valueAnchor = block.querySelector(".var-value-anchor");
      if (modeSelect.value === "declare") {
        valueAnchor.style.display = "none";
      } else {
        valueAnchor.style.display = "block";
      }
      modeSelect.addEventListener("change", () => {
        if (modeSelect.value === "declare") {
          valueAnchor.style.display = "none";
        } else {
          valueAnchor.style.display = "block";
        }
      });
    }
  } else {
    block = dragged;
  }

  block.classList.remove("dragging");

  if (placeholder && placeholder.parentNode) {
    placeholder.parentNode.insertBefore(block, placeholder);
    removePlaceholder();
    return;
  }

  if (targetStack) {
    const insertBefore = getInsertionPoint(targetStack, e.clientY);
    if (insertBefore) targetStack.insertBefore(block, insertBefore);
    else targetStack.appendChild(block);
  }

  removePlaceholder();
});

left.addEventListener("dragover", (e) => e.preventDefault());

left.addEventListener("drop", (e) => {
  e.preventDefault();
  if (dragged && !fromPalette) {
    dragged.remove();
  }
});

const consoleOutput = document.getElementById("console-out");

function logToConsole(message) {
  const line = document.createElement("div");
  line.textContent = message;
  consoleOutput.appendChild(line);
}

const programState = {
  variables: {},
  arrays: {},
  functions: {},
};

function getBlockFromAnchor(anchor) {
  if (!anchor) return null;
  const stack = anchor.querySelector(".stack");
  if (!stack || stack.children.length === 0) return null;
  return stack.children[0];
}

function getOwnAnchor(block, className) {
  const candidates = block.querySelectorAll("." + className);
  for (let el of candidates) {
    if (el.closest(".block") === block) return el;
  }
  return null;
}

function getOwnSelect(block, className) {
  const candidates = block.querySelectorAll("." + className);
  for (let el of candidates) {
    if (el.closest(".block") === block) return el;
  }
  return null;
}

function evaluateBlock(block) {
  if (!block) return 0;

  if (block.classList.contains("text-block")) {
    const input = block.querySelector(".text-input");
    let val = input && input.value.trim() !== "" ? input.value.trim() : "0";
    if (val.startsWith("@")) {
      const varName = val.slice(1);
      const match = varName.match(/^(\w+)(?:\[(.+)\])?$/);
      if (match) {
        const arrName = match[1];
        let index = match[2];
        const array = programState.arrays[arrName];

        if (array) {
          if (index !== undefined) {
            index = index.trim();
            if (index === "length") return array.length;
            if (index.startsWith("@")) {
              const idxVar = index.slice(1);
              index = Number(programState.variables[idxVar] ?? 0);
            } else {
              index = Number(index);
            }

            return array[index] ?? 0;
          } else {
            return array;
          }
        } else {
          return programState.variables[arrName] ?? 0;
        }
      }
    }

    return val;
  }

  if (block.classList.contains("variable")) {
    const nameBlock = getBlockFromAnchor(
      block.querySelector(".var-name-anchor"),
    );
    const valueBlock = getBlockFromAnchor(
      block.querySelector(".var-value-anchor"),
    );
    const mode = block.querySelector(".var-mode").value;
    const name = nameBlock ? evaluateBlock(nameBlock) : null;
    if (!name) return 0;
    if (mode === "declare") {
      programState.variables[name] = undefined;
      return 0;
    }
    if (mode === "assign") {
      const value = valueBlock ? evaluateBlock(valueBlock) : 0;
      programState.variables[name] = value;
      return value;
    }
    return 0;
  }

  if (block.classList.contains("math")) {
    const leftBlock = getBlockFromAnchor(
      block.querySelector(".math-left-anchor"),
    );
    const rightBlock = getBlockFromAnchor(
      block.querySelector(".math-right-anchor"),
    );
    const operator = block.querySelector(".math-operator").value;
    const leftValue = leftBlock ? Number(evaluateBlock(leftBlock)) : 0;
    const rightValue = rightBlock ? Number(evaluateBlock(rightBlock)) : 0;
    switch (operator) {
      case "+":
        return leftValue + rightValue;
      case "-":
        return leftValue - rightValue;
      case "*":
        return leftValue * rightValue;
      case "/":
        return rightValue !== 0 ? leftValue / rightValue : 0;
    }
  }

  if (block.classList.contains("anchor")) {
    const inner = getBlockFromAnchor(block);
    return inner ? evaluateBlock(inner) : 0;
  }

  return 0;
}

document.getElementById("run-btn").addEventListener("click", runH0Program);

function runH0Program() {
  consoleOutput.innerHTML = "";
  programState.variables = {};
  programState.arrays = {};
  programState.functions = {};
  const root = right.querySelector(".anchor-H0");
  if (!root) return;
  executeStack(root.querySelector(".stack"));
}

function executeStack(stack) {
  for (let block of stack.children) {
    executeBlock(block);
  }
}

function executeBlock(block) {
  if (block.classList.contains("print")) {
    const innerBlock = getBlockFromAnchor(block);
    if (!innerBlock) {
      logToConsole("0");
      return;
    }
    const result = evaluateBlock(innerBlock);
    logToConsole(result);
  } else if (block.classList.contains("variable")) {
    const mode = block.querySelector(".var-mode").value;
    const nameBlock = getBlockFromAnchor(
      block.querySelector(".var-name-anchor"),
    );
    const valueBlock = getBlockFromAnchor(
      block.querySelector(".var-value-anchor"),
    );
    const name = nameBlock ? evaluateBlock(nameBlock) : null;
    if (!name) return;
    if (mode === "declare") programState.variables[name] = undefined;
    if (mode === "assign") {
      const value = valueBlock ? evaluateBlock(valueBlock) : 0;
      programState.variables[name] = value;
    }
  } else if (block.classList.contains("array-block")) {
    const nameBlock = getBlockFromAnchor(block.querySelector(".array-name"));
    const valueStack = block.querySelector(".array-value .stack");
    const name = nameBlock ? evaluateBlock(nameBlock) : "unnamed";
    programState.arrays[name] = [];
    for (let elem of valueStack.children) {
      const val = evaluateBlock(elem);
      programState.arrays[name].push(val);
    }
  } else if (block.classList.contains("array-set")) {
    const nameBlock = getBlockFromAnchor(
      block.querySelector(".array-set-name"),
    );
    const indexBlock = getBlockFromAnchor(
      block.querySelector(".array-set-index"),
    );
    const valueBlock = getBlockFromAnchor(
      block.querySelector(".array-set-value"),
    );

    const name = nameBlock ? evaluateBlock(nameBlock) : null;
    const index = indexBlock ? Number(evaluateBlock(indexBlock)) : 0;
    const value = valueBlock ? evaluateBlock(valueBlock) : 0;
    if (name && programState.arrays[name])
      programState.arrays[name][index] = value;
  } else if (block.classList.contains("if-block")) {
    const leftBlock = getBlockFromAnchor(
      block.querySelector(".if-left-anchor"),
    );
    const rightBlock = getBlockFromAnchor(
      block.querySelector(".if-right-anchor"),
    );
    const operator = block.querySelector(".if-operator").value;
    const leftValue = leftBlock ? Number(evaluateBlock(leftBlock)) : 0;
    const rightValue = rightBlock ? Number(evaluateBlock(rightBlock)) : 0;
    let result = false;

    switch (operator) {
      case "==":
        result = leftValue == rightValue;
        break;
      case "!=":
        result = leftValue != rightValue;
        break;
      case ">":
        result = leftValue > rightValue;
        break;
      case "<":
        result = leftValue < rightValue;
        break;
      case ">=":
        result = leftValue >= rightValue;
        break;
      case "<=":
        result = leftValue <= rightValue;
        break;
    }

    if (result) {
      executeStack(block.querySelector(".if-body-anchor .stack"));
    } else {
      const toggle = block.querySelector(".if-else-toggle");
      if (toggle && toggle.checked)
        executeStack(block.querySelector(".if-else-anchor .stack"));
    }
  } else if (block.classList.contains("while-block")) {
    let iterations = 0;
    const MAX_ITERATIONS = 1000;
    while (true) {
      if (++iterations > MAX_ITERATIONS) {
        break;
      }
      const leftBlock = getBlockFromAnchor(
        getOwnAnchor(block, "while-left-anchor"),
      );
      const rightBlock = getBlockFromAnchor(
        getOwnAnchor(block, "while-right-anchor"),
      );

      const leftValue = leftBlock ? Number(evaluateBlock(leftBlock)) : 0;
      const rightValue = rightBlock ? Number(evaluateBlock(rightBlock)) : 0;

      let condition = false;
      const operator = getOwnSelect(block, "while-operator").value;

      switch (operator) {
        case "==":
          condition = leftValue == rightValue;
          break;
        case "!=":
          condition = leftValue != rightValue;
          break;
        case ">":
          condition = leftValue > rightValue;
          break;
        case "<":
          condition = leftValue < rightValue;
          break;
        case ">=":
          condition = leftValue >= rightValue;
          break;
        case "<=":
          condition = leftValue <= rightValue;
          break;
      }

      if (!condition) break;
      const bodyAnchor = getOwnAnchor(block, "while-body-anchor");
      executeStack(bodyAnchor.querySelector(".stack"));
    }
  } else if (block.classList.contains("func-def")) {
    const nameBlock = getBlockFromAnchor(
      block.querySelector(".func-def-name-anchor"),
    );
    const name = nameBlock ? String(evaluateBlock(nameBlock)) : 0;
    if (!name) return;
    const bodyStack = block.querySelector(".func-def-body-anchor .stack");
    programState.functions[name] = bodyStack;
  } else if (block.classList.contains("func-call")) {
    const nameBlock = getBlockFromAnchor(
      block.querySelector(".func-call-name-anchor"),
    );
    const name = nameBlock ? String(evaluateBlock(nameBlock)) : 0;
    if (!name) return;
    const bodyStack = programState.functions[name];
    if (bodyStack) executeStack(bodyStack);
  } else if (block.classList.contains("anchor")) {
    executeStack(block.querySelector(".stack"));
  }
}

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

function getAnchorBlock(block, selector) {
  return getBlockFromAnchor(block.querySelector(selector));
}

function evalNumericAnchor(block, selector) {
  const b = getAnchorBlock(block, selector);
  return b ? Number(evaluateBlock(b)) : 0;
}

function evalStringAnchor(block, selector) {
  const b = getAnchorBlock(block, selector);
  return b ? String(evaluateBlock(b)) : null;
}

function evalOperator(lv, operator, rv) {
  switch (operator) {
    case "==":
      return lv == rv;
    case "!=":
      return lv != rv;
    case ">":
      return lv > rv;
    case "<":
      return lv < rv;
    case ">=":
      return lv >= rv;
    case "<=":
      return lv <= rv;
    default:
      return false;
  }
}

function collectStepsFromAnchor(anchor, dest) {
  if (!anchor) return;
  collectSteps(anchor.querySelector(".stack"), dest);
}

function collectSteps(stack, steps) {
  if (!stack) return;
  Array.from(stack.children).forEach((block) =>
    collectBlockSteps(block, steps),
  );
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
        const lv = evalNumericAnchor(block, ".if-left-anchor");
        const rv = evalNumericAnchor(block, ".if-right-anchor");
        const operator = block.querySelector(".if-operator").value;
        const result = evalOperator(lv, operator, rv);

        logToConsole(
          `→ Условие: ${lv} ${operator} ${rv} = ${result ? "ИСТИНА" : "ЛОЖЬ"}`,
          "debug-info",
        );

        if (result) {
          collectStepsFromAnchor(
            block.querySelector(".if-body-anchor"),
            ctx.extraSteps,
          );
        } else {
          const toggle = block.querySelector(".if-else-toggle");
          if (toggle?.checked) {
            collectStepsFromAnchor(
              block.querySelector(".if-else-anchor"),
              ctx.extraSteps,
            );
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
          logToConsole(
            "⚠ Превышено 1000 итераций, цикл остановлен",
            "debug-warn",
          );
          return;
        }

        const lv = evalNumericAnchor(block, ".while-left-anchor");
        const rv = evalNumericAnchor(block, ".while-right-anchor");
        const operator = getOwnSelect(block, "while-operator").value;
        const condition = evalOperator(lv, operator, rv);

        logToConsole(
          `Условие: ${lv} ${operator} ${rv} = ${
            condition
              ? `ИСТИНА (итерация ${whileStep.iterations})`
              : "ЛОЖЬ — выход из цикла"
          }`,
          "debug-info",
        );

        if (condition) {
          const bodySteps = [];
          collectStepsFromAnchor(
            getOwnAnchor(block, "while-body-anchor"),
            bodySteps,
          );
          ctx.extraSteps.push(...bodySteps, whileStep);
        }
      },
    };
    steps.push(whileStep);
  } else if (block.classList.contains("func-def")) {
    steps.push({
      block,
      desc: "Функция — определение",
      execute() {
        const name = evalStringAnchor(block, ".func-def-name-anchor");
        if (!name) return;
        programState.functions[name] = block.querySelector(
          ".func-def-body-anchor .stack",
        );
        logToConsole(`Функция "${name}" определена`, "debug-info");
      },
    });
  } else if (block.classList.contains("func-call")) {
    steps.push({
      block,
      desc: "Вызов функции",
      execute(ctx) {
        const name = evalStringAnchor(block, ".func-call-name-anchor");
        if (!name) return;

        logToConsole(`Вызов "${name}"`, "debug-info");

        const bodyStack = programState.functions[name];
        if (bodyStack) {
          collectSteps(bodyStack, ctx.extraSteps);
        } else {
          logToConsole(`Функция "${name}" не найдена`, "debug-warn");
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
  const { variables, arrays } = programState;

  for (const [k, v] of Object.entries(variables)) {
    if (debugLastState.variables[k] !== v) {
      logToConsole(`Переменная "${k}" = ${v}`, "debug-info");
      debugLastState.variables[k] = v;
    }
  }

  for (const [k, v] of Object.entries(arrays)) {
    if (JSON.stringify(debugLastState.arrays[k]) !== JSON.stringify(v)) {
      logToConsole(`Массив "${k}" = [${v.join(", ")}]`, "debug-info");
      debugLastState.arrays[k] = [...v];
    }
  }
}

function clearHighlights(cls) {
  document
    .querySelectorAll(`.${cls}`)
    .forEach((el) => el.classList.remove(cls));
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
  document.getElementById("debug-toolbar").style.display = visible
    ? "flex"
    : "none";
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

  consoleOutput.innerHTML = "";
  resetDebugState();

  const root = right.querySelector(".anchor-H0");
  if (!root) return;

  collectSteps(root.querySelector(".stack"), stepQueue);

  if (stepQueue.length === 0) {
    logToConsole("Нет блоков для отладки.", "debug-info");
    return;
  }

  debugMode.active = true;
  debugMode.cursor = 0;

  setDebugToolbarVisible(true);
  setRunButtonDisabled(true);
  setDebugButtonActive(true);

  updateDebugLabel("Отладка готова к запуску", "paused");
  highlightBlock(stepQueue[0].block);
  logToConsole("Режим отладки запущен.", "debug-info");
}

function stepForward() {
  if (!debugMode.active) return;

  if (debugMode.cursor >= stepQueue.length) {
    finishDebug();
    return;
  }

  const step = stepQueue[debugMode.cursor];
  highlightBlock(step.block);
  updateDebugLabel(
    `Шаг ${debugMode.cursor + 1} / ${stepQueue.length}: ${step.desc}`,
    "running",
  );

  const ctx = { extraSteps: [] };

  try {
    step.execute(ctx);
  } catch (err) {
    logToConsole("Ошибка: " + err.message, "debug-error");
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
    updateDebugLabel(
      `Следующий: ${stepQueue[debugMode.cursor].desc}`,
      "paused",
    );
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
      "paused",
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
  logToConsole("Программа завершена.", "debug-info");

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

  if (wasActive) {
    logToConsole("Отладка остановлена.", "debug-info");
  }
}

document.getElementById("debug-btn").addEventListener("click", startDebug);
document.getElementById("dbg-step").addEventListener("click", stepForward);
document
  .getElementById("dbg-continue")
  .addEventListener("click", continueDebug);
document.getElementById("dbg-stop").addEventListener("click", stopDebug);
