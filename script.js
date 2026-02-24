

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
    if (dragged) {
        dragged.classList.remove("dragging");
    }
    dragged = null;
});

right.addEventListener("dragover", e => {
    e.preventDefault();
});

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

function getValueFromAnchor(anchor) {
    if (!anchor) return "0"; 
    const stack = anchor.querySelector(".stack");
    if (!stack || stack.children.length === 0) return "0";  
    const block = stack.children[0];
    if (!block) return "0";
    if (block.classList.contains("text-block")) {
        const input = block.querySelector(".text-input");
        return input && input.value.trim() !== "" ? input.value.trim() : "0"; 
    }
    return "0"; 
}

document.getElementById("run-btn").addEventListener("click", runH0Program);

function runH0Program() {
    consoleOutput.innerHTML = "";
    programState.variables = {};

    document.querySelectorAll(".variable").forEach(block => {
        const mode = block.querySelector(".var-mode").value;
        const valueAnchor = block.querySelector(".var-value-anchor");
        if (mode === "declare") {
            valueAnchor.style.display = "none";
        } else {
            valueAnchor.style.display = "block";
        }
    });

    const root = right.querySelector(".print");
    executeStack(root.querySelector(".stack"));
}

function executeStack(stack) {
    for (let block of stack.children) {
        executeBlock(block);
    }
}

function executeBlock(block) {
    if (block.classList.contains("variable")) {
        const mode = block.querySelector(".var-mode").value;
        const name = getValueFromAnchor(block.querySelector(".var-name-anchor"));
        const value = getValueFromAnchor(block.querySelector(".var-value-anchor"));

        if (!name) {
            logToConsole("Ошибка: имя переменной отсутствует");
            return;
        }

        if (mode === "declare") {
            programState.variables[name] = undefined;
            logToConsole("Переменная объявлена: " + name);
        }

        if (mode === "assign") {
            programState.variables[name] = value;
            logToConsole("Переменная: " + name + " = " + value);
        }
    }
    else if (block.classList.contains("text-block")) {
        const text = block.querySelector(".text-input").value;
        logToConsole("Текст: " + text);
    }
    else if (block.classList.contains("anchor")) {
        executeStack(block.querySelector(".stack"));
    }
}
