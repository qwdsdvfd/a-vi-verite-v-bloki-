const left = document.getElementById("left");
const right = document.getElementById("right");

let dragged = null;
let fromPalette = false;
let placeholder = null;
let originalParent = null;
let originalNextSibling = null;

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
});

right.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (!placeholder) placeholder = createPlaceholder();

  const overDragged =
    !fromPalette &&
    dragged &&
    (e.target === dragged || dragged.contains(e.target));
  if (overDragged) {
    if (originalNextSibling)
      originalParent.insertBefore(placeholder, originalNextSibling);
    else originalParent.appendChild(placeholder);
    return;
  }

  const targetStack = findTargetStack(e.target);
  if (!targetStack) {
    removePlaceholder();
    return;
  }
  const insertBefore = getInsertionPoint(targetStack, e.clientY);
  if (insertBefore) targetStack.insertBefore(placeholder, insertBefore);
  else targetStack.appendChild(placeholder);
});

right.addEventListener("dragleave", (e) => {
  if (!right.contains(e.relatedTarget)) removePlaceholder();
});

right.addEventListener("drop", (e) => {
  e.preventDefault();
  if (!dragged) return;

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

  const targetStack = findTargetStack(e.target);
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

            if (index === "length") {
              return array.length;
            }

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
    if (mode === "declare") {
      programState.variables[name] = undefined;
    }
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

    if (name && programState.arrays[name]) {
      programState.arrays[name][index] = value;
    }
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
      if (toggle && toggle.checked) {
        executeStack(block.querySelector(".if-else-anchor .stack"));
      }
    }
  }  else if (block.classList.contains("while-block")) {
    let iterations = 0;
    const MAX_ITERATIONS = 1000;
    while (true) {
      if (++iterations > MAX_ITERATIONS) {
        logToConsole("Превышен лимит итераций");
        break;
      }
      const leftBlock = getBlockFromAnchor(
        block.querySelector(".while-left-anchor"),
      );
      const rightBlock = getBlockFromAnchor(
        block.querySelector(".while-right-anchor"),
      );

      const leftValue = leftBlock ? Number(evaluateBlock(leftBlock)) : 0;
      const rightValue = rightBlock ? Number(evaluateBlock(rightBlock)) : 0;

      let condition = false;
      const operator = block.querySelector(".while-operator").value;

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
      executeStack(block.querySelector(".while-body-anchor .stack"));
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
    if (bodyStack) {
      executeStack(bodyStack);
    }
  } else if (block.classList.contains("anchor")) {
    executeStack(block.querySelector(".stack"));
  }
}
