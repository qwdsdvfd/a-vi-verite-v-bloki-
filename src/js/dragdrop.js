import { programState } from "./evaluator.js";

const left = document.getElementById("left");
const right = document.getElementById("right");

let dragged = null;
let fromPalette = false;
let placeholder = null;
let originalParent = null;
let originalNextSibling = null;
let lastRejectedStack = null;

function getBlockType(block) {
  return block?.dataset.blockType ?? "any";
}

function stackAccepts(stack) {
  return stack.closest("[data-accepts]")?.dataset.accepts ?? "any";
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
  if (accepts !== "any" && blockType !== "any" && accepts !== blockType) return false;
  const limit = getStackLimit(stack);
  if (isFinite(limit)) {
    const realChildren = [...stack.children].filter(
      (c) => !c.classList.contains("drop-placeholder")
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
  placeholder?.parentNode?.removeChild(placeholder);
  placeholder = null;
}

function getInsertionPoint(stack, clientY) {
  const children = [...stack.children].filter(
    (c) => !c.classList.contains("drop-placeholder")
  );
  for (const child of children) {
    const rect = child.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return child;
  }
  return null;
}

function findTargetStack(target) {
  let el = target;
  while (el && el !== document) {
    if (dragged && el === dragged) break;
    if (el.classList?.contains("stack") && right.contains(el)) {
      if (!dragged?.contains(el)) return el;
    }
    if (el.classList?.contains("anchor") && right.contains(el)) {
      const s = el.querySelector(":scope > .stack");
      if (s && !dragged?.contains(s)) return s;
    }
    el = el.parentElement;
  }
  const rootAnchor = right.querySelector(".anchor-H0");
  return rootAnchor?.querySelector(".stack") ?? null;
}

function showRejectFeedback(stack) {
  if (lastRejectedStack === stack) return;
  clearRejectFeedback();
  lastRejectedStack = stack;
  stack.closest("[data-accepts]")?.classList.add("reject-drop");
}

function clearRejectFeedback() {
  if (!lastRejectedStack) return;
  lastRejectedStack.closest("[data-accepts]")?.classList.remove("reject-drop");
  lastRejectedStack = null;
}

function initClonedBlock(block) {
  block.setAttribute("draggable", "true");

  block.querySelectorAll("input, select").forEach((inp) => {
    inp.disabled = false;
    inp.addEventListener("mousedown", (e) => e.stopPropagation());
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
    valueAnchor.style.display = modeSelect.value === "declare" ? "none" : "block";
    modeSelect.addEventListener("change", () => {
      valueAnchor.style.display = modeSelect.value === "declare" ? "none" : "block";
    });
  }

  const condBoolToggle = block.querySelector(".cond-bool-toggle");
  if (condBoolToggle) {
    const numericRow = block.querySelector(".cond-numeric-row");
    const boolRow = block.querySelector(".cond-bool-row");
    const boolOpSelect = block.querySelector(".cond-bool-operator");

    const updateCondRightB = () => {
      const rightAnchorB = block.querySelector(".cond-right-anchor-b");
      if (boolOpSelect.value === "!") {
        rightAnchorB.style.display = "none";
        rightAnchorB.querySelector(".stack").innerHTML = "";
      } else {
        rightAnchorB.style.display = "";
      }
    };

    boolOpSelect.addEventListener("change", updateCondRightB);
    condBoolToggle.addEventListener("change", () => {
      if (condBoolToggle.checked) {
        numericRow.style.display = "none";
        boolRow.style.display = "flex";
        updateCondRightB();
      } else {
        numericRow.style.display = "flex";
        boolRow.style.display = "none";
      }
    });
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
  dragged?.classList.remove("dragging");
  dragged = null;
  removePlaceholder();
  clearRejectFeedback();
});

right.addEventListener("dragover", (e) => {
  e.preventDefault();

  const overDragged =
    !fromPalette && dragged && (e.target === dragged || dragged.contains(e.target));

  if (overDragged) {
    clearRejectFeedback();
    if (!placeholder) placeholder = createPlaceholder();
    if (originalNextSibling) originalParent.insertBefore(placeholder, originalNextSibling);
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
    initClonedBlock(block);
  } else {
    block = dragged;
  }

  block.classList.remove("dragging");

  if (placeholder?.parentNode) {
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
  if (dragged && !fromPalette) dragged.remove();
});