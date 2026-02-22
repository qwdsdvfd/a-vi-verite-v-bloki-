const left = document.getElementById("left");
const right = document.getElementById("right");

let dragged = null;
let fromPalette = false;

document.addEventListener("dragstart", e=>{
  const block = e.target.closest(".block");
  if(!block) return;

  if(e.target.tagName === "INPUT"){
    e.preventDefault();
    return;
  }

  dragged = block;
  fromPalette = left.contains(block);
  block.classList.add("dragging");
});

document.addEventListener("dragend", ()=>{
  if(dragged){
    dragged.classList.remove("dragging");
  }
  dragged = null;
});

right.addEventListener("dragover", e=>{
  e.preventDefault();
});

right.addEventListener("drop", e=>{
  e.preventDefault();
  if(!dragged) return;

  let block;

  if(fromPalette){
    block = dragged.cloneNode(true);
    block.setAttribute("draggable","true");

    const input = block.querySelector("input");
    if(input){
      input.disabled = false;
      input.addEventListener("mousedown", ev=>{
        ev.stopPropagation();
      });
    }

  } else {
    block = dragged;
  }

  block.classList.remove("dragging");

  const container = e.target.closest(".anchor");

  if(container && right.contains(container)){
      const stack = container.querySelector(".stack");
      stack.appendChild(block);
  } else {
      right.appendChild(block);
  }
});

left.addEventListener("dragover", e=>{
  e.preventDefault();
});

left.addEventListener("drop", e=>{
  e.preventDefault();

  if(dragged && !fromPalette){
    dragged.remove();
  }
});
