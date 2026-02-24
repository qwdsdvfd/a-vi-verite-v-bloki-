const left = document.getElementById("left");
const right = document.getElementById("right");

let dragged = null;
let fromPalette = false;

document.addEventListener("dragstart", e => {
    const block = e.target.closest(".block");
    if (!block) return;

    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
        e.preventDefault();
        return;
    }

    dragged = block;
    fromPalette = left.contains(block);
    block.classList.add("dragging");
});

document.addEventListener("dragend", () => {
    if (dragged) dragged.classList.remove("dragging");
    dragged = null;
});

right.addEventListener("dragover", e => e.preventDefault());

right.addEventListener("drop", e => {
    e.preventDefault();
    if (!dragged) return;

    let block;

    if (fromPalette) {
        block = dragged.cloneNode(true);
        block.setAttribute("draggable", "true");

        const inputs = block.querySelectorAll("input, select");
        inputs.forEach(inp => {
            inp.disabled = false;
            inp.addEventListener("mousedown", ev => {
                ev.stopPropagation();
            });
        });

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

    const container = e.target.closest(".anchor");
    if (container && right.contains(container)) {
        container.querySelector(".stack").appendChild(block);
    } else {
        right.appendChild(block);
    }
});

left.addEventListener("dragover", e => e.preventDefault());

left.addEventListener("drop", e => {
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
    variables: {}
};

function getBlockFromAnchor(anchor) {
    if (!anchor) return null;
    const stack = anchor.querySelector(".stack");
    if (!stack || stack.children.length === 0) return null;
    return stack.children[0];
}

function evaluateBlock(block) {
    if (block.classList.contains("text-block")) {
        const input = block.querySelector(".text-input");
        return input && input.value.trim() !== ""
            ? input.value.trim()
            : "0";
    }

    if (block.classList.contains("math")) {
        const leftBlock = getBlockFromAnchor(
            block.querySelector(".math-left-anchor")
        );

        const rightBlock = getBlockFromAnchor(
            block.querySelector(".math-right-anchor")
        );

        const operator = block.querySelector(".math-operator").value;

        const leftValue = leftBlock ? Number(evaluateBlock(leftBlock)) : 0;
        const rightValue = rightBlock ? Number(evaluateBlock(rightBlock)) : 0;

        switch (operator) {
            case "+": return leftValue + rightValue;
            case "-": return leftValue - rightValue;
            case "*": return leftValue * rightValue;
            case "/": return rightValue !== 0 ? leftValue / rightValue : 0;
        }
    }

    return 0;
}

document.getElementById("run-btn")
    .addEventListener("click", runH0Program);

function runH0Program() {
    consoleOutput.innerHTML = "";
    programState.variables = {};

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
    }

    else if (block.classList.contains("variable")) {
        const mode = block.querySelector(".var-mode").value;

        const nameBlock = getBlockFromAnchor(
            block.querySelector(".var-name-anchor")
        );

        const valueBlock = getBlockFromAnchor(
            block.querySelector(".var-value-anchor")
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
    }

    else if (block.classList.contains("anchor")) {
        executeStack(block.querySelector(".stack"));
    }
}
