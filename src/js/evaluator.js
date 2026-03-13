export const programState = {
  variables: {},
  arrays: {},
  functions: {},
};

export function getBlockFromAnchor(anchor) {
  if (!anchor) return null;
  const stack = anchor.querySelector(".stack");
  if (!stack || stack.children.length === 0) return null;
  return stack.children[0];
}

export function getOwnAnchor(block, className) {
  for (const el of block.querySelectorAll("." + className)) {
    if (el.closest(".block") === block) return el;
  }
  return null;
}

export function getOwnSelect(block, className) {
  for (const el of block.querySelectorAll("." + className)) {
    if (el.closest(".block") === block) return el;
  }
  return null;
}

export function evalOperator(lv, operator, rv) {
  switch (operator) {
    case "==": return lv == rv;
    case "!=": return lv != rv;
    case ">":  return lv > rv;
    case "<":  return lv < rv;
    case ">=": return lv >= rv;
    case "<=": return lv <= rv;
    default:   return false;
  }
}

export function evaluateBlock(block) {
  if (!block) return 0;

  if (block.classList.contains("text-block")) {
    const input = block.querySelector(".text-input");
    let val = input?.value.trim() !== "" ? input.value.trim() : "0";

    if (val.startsWith("@")) {
      const varName = val.slice(1);

      if (varName.endsWith("++")) {
        const name = varName.slice(0, -2);
        const current = Number(programState.variables[name] ?? 0);
        programState.variables[name] = current + 1;
        return current + 1;
      }

      if (varName.endsWith("--")) {
        const name = varName.slice(0, -2);
        const current = Number(programState.variables[name] ?? 0);
        programState.variables[name] = current - 1;
        return current - 1;
      }

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
              index = Number(programState.variables[index.slice(1)] ?? 0);
            } else {
              index = Number(index);
            }
            return array[index] ?? 0;
          }
          return array;
        }

        return programState.variables[arrName] ?? 0;
      }
    }

    return val;
  }

  if (block.classList.contains("variable")) {
    const nameBlock  = getBlockFromAnchor(block.querySelector(".var-name-anchor"));
    const valueBlock = getBlockFromAnchor(block.querySelector(".var-value-anchor"));
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
    const leftBlock  = getBlockFromAnchor(block.querySelector(".math-left-anchor"));
    const rightBlock = getBlockFromAnchor(block.querySelector(".math-right-anchor"));
    const operator   = block.querySelector(".math-operator").value;
    const lv = leftBlock  ? Number(evaluateBlock(leftBlock))  : 0;
    const rv = rightBlock ? Number(evaluateBlock(rightBlock)) : 0;

    switch (operator) {
      case "+": return lv + rv;
      case "-": return lv - rv;
      case "*": return lv * rv;
      case "/": return rv !== 0 ? lv / rv : 0;
    }
  }

  if (block.classList.contains("cond-block")) {
    const boolToggle = getOwnSelect(block, "cond-bool-toggle");

    if (boolToggle?.checked) {
      const op = getOwnSelect(block, "cond-bool-operator").value;
      const leftBlock = getBlockFromAnchor(getOwnAnchor(block, "cond-left-anchor-b"));
      const lv = leftBlock ? evaluateBlock(leftBlock) : 0;
      if (op === "!") return lv ? 0 : 1;
      const rightBlock = getBlockFromAnchor(getOwnAnchor(block, "cond-right-anchor-b"));
      const rv = rightBlock ? evaluateBlock(rightBlock) : 0;
      if (op === "&&") return lv && rv ? 1 : 0;
      if (op === "||") return lv || rv ? 1 : 0;
    } else {
      const leftBlock  = getBlockFromAnchor(getOwnAnchor(block, "cond-left-anchor"));
      const rightBlock = getBlockFromAnchor(getOwnAnchor(block, "cond-right-anchor"));
      const op = getOwnSelect(block, "cond-operator").value;
      const lv = leftBlock  ? Number(evaluateBlock(leftBlock))  : 0;
      const rv = rightBlock ? Number(evaluateBlock(rightBlock)) : 0;
      return evalOperator(lv, op, rv) ? 1 : 0;
    }

    return 0;
  }

  if (block.classList.contains("anchor")) {
    const inner = getBlockFromAnchor(block);
    return inner ? evaluateBlock(inner) : 0;
  }

  return 0;
}