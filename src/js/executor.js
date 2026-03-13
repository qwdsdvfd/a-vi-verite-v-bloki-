import { programState, getBlockFromAnchor, getOwnAnchor, evaluateBlock } from "./evaluator.js";

const right = document.getElementById("right");

export function logToConsole(message) {
  const line = document.createElement("div");
  line.textContent = message;
  document.getElementById("console-out").appendChild(line);
}

export function executeStack(stack) {
  for (const block of stack.children) {
    executeBlock(block);
  }
}

export function executeBlock(block) {
  if (block.classList.contains("print")) {
    const innerBlock = getBlockFromAnchor(block);
    logToConsole(innerBlock ? evaluateBlock(innerBlock) : "0");

  } else if (block.classList.contains("variable")) {
    const mode = block.querySelector(".var-mode").value;
    const nameBlock  = getBlockFromAnchor(block.querySelector(".var-name-anchor"));
    const valueBlock = getBlockFromAnchor(block.querySelector(".var-value-anchor"));
    const name = nameBlock ? evaluateBlock(nameBlock) : null;
    if (!name) return;
    if (mode === "declare") programState.variables[name] = undefined;
    if (mode === "assign") {
      programState.variables[name] = valueBlock ? evaluateBlock(valueBlock) : 0;
    }

  } else if (block.classList.contains("array-block")) {
    const nameBlock  = getBlockFromAnchor(block.querySelector(".array-name"));
    const valueStack = block.querySelector(".array-value .stack");
    const name = nameBlock ? evaluateBlock(nameBlock) : "unnamed";
    programState.arrays[name] = [];
    for (const elem of valueStack.children) {
      programState.arrays[name].push(evaluateBlock(elem));
    }

  } else if (block.classList.contains("array-set")) {
    const nameBlock  = getBlockFromAnchor(block.querySelector(".array-set-name"));
    const indexBlock = getBlockFromAnchor(block.querySelector(".array-set-index"));
    const valueBlock = getBlockFromAnchor(block.querySelector(".array-set-value"));
    const name  = nameBlock  ? evaluateBlock(nameBlock)          : null;
    const index = indexBlock ? Number(evaluateBlock(indexBlock)) : 0;
    const value = valueBlock ? evaluateBlock(valueBlock)         : 0;
    if (name && programState.arrays[name]) programState.arrays[name][index] = value;

  } else if (block.classList.contains("if-block")) {
    const condBlock = getBlockFromAnchor(block.querySelector(".if-cond-anchor"));
    const result = condBlock ? evaluateBlock(condBlock) : 0;
    if (result) {
      executeStack(block.querySelector(".if-body-anchor .stack"));
    } else {
      const toggle = block.querySelector(".if-else-toggle");
      if (toggle?.checked) executeStack(block.querySelector(".if-else-anchor .stack"));
    }

  } else if (block.classList.contains("while-block")) {
    let iterations = 0;
    while (true) {
      if (++iterations > 1000) break;
      const condBlock = getBlockFromAnchor(getOwnAnchor(block, "while-cond-anchor"));
      if (!condBlock || !evaluateBlock(condBlock)) break;
      executeStack(getOwnAnchor(block, "while-body-anchor").querySelector(".stack"));
    }

  } else if (block.classList.contains("for-block")) {
    const initStack = block.querySelector(".for-init-anchor .stack");
    if (initStack) for (const b of initStack.children) executeBlock(b);

    let iterations = 0;
    while (true) {
      if (++iterations > 1000) break;
      const condBlock = getBlockFromAnchor(getOwnAnchor(block, "for-cond-anchor"));
      if (!condBlock || !evaluateBlock(condBlock)) break;
      executeStack(getOwnAnchor(block, "for-body-anchor").querySelector(".stack"));
      const stepStack = block.querySelector(".for-step-anchor .stack");
      if (stepStack) {
        for (const b of stepStack.children) {
          if (b.classList.contains("text-block") || b.dataset.blockType === "value") {
            evaluateBlock(b);
          } else {
            executeBlock(b);
          }
        }
      }
    }

  } else if (block.classList.contains("func-def")) {
    const nameBlock = getBlockFromAnchor(block.querySelector(".func-def-name-anchor"));
    const name = nameBlock ? String(evaluateBlock(nameBlock)) : null;
    if (!name) return;
    programState.functions[name] = block.querySelector(".func-def-body-anchor .stack");

  } else if (block.classList.contains("func-call")) {
    const nameBlock = getBlockFromAnchor(block.querySelector(".func-call-name-anchor"));
    const name = nameBlock ? String(evaluateBlock(nameBlock)) : null;
    if (!name) return;
    const bodyStack = programState.functions[name];
    if (bodyStack) executeStack(bodyStack);

  } else if (block.classList.contains("anchor")) {
    executeStack(block.querySelector(".stack"));
  }
}

document.getElementById("run-btn").addEventListener("click", () => {
  document.getElementById("console-out").innerHTML = "";
  programState.variables = {};
  programState.arrays = {};
  programState.functions = {};
  const root = right.querySelector(".anchor-H0");
  if (!root) return;
  executeStack(root.querySelector(".stack"));
});