/*Block B1 - Объявление переменных и констант*/
const left = document.getElementById("left");
const right = document.getElementById("right");

let dragged = null;
let fromPalette = false;

document.addEventListener("dragstart", e=>{
  const block = e.target.closest(".block");
  if(!block) return;

/*Block B2 - Выдача состояния*/
  if(e.target.tagName === "INPUT"){
    e.preventDefault();
    return;
  }

  dragged = block;
  fromPalette = left.contains(block);
  block.classList.add("dragging");
});

/*Block B3 - Редактирование состояния*/
document.addEventListener("dragend", ()=>{
  if(dragged){
    dragged.classList.remove("dragging");
  }
  dragged = null;
});

/*Block B4 - Разрешение переноса в рабочию зону*/
right.addEventListener("dragover", e=>{
  e.preventDefault();
});

/*Block B5 - Проверка*/
right.addEventListener("drop", e=>{
  e.preventDefault();
  if(!dragged) return;

/*Block B6 - Создание клона и выдача атрибута*/
let block;
if(fromPalette){
  block = dragged.cloneNode(true);
  block.setAttribute("draggable","true");

  /*Block B7 - Включение возможности ввода текста, а если это не нужно просто ставит блок*/
  const inputs = block.querySelectorAll("input");
  inputs.forEach(inp=>{
    inp.disabled = false;
    inp.addEventListener("mousedown", ev=>{
      ev.stopPropagation();
    });
  });

} else {
  block = dragged;
}

/*Block B8 - Удаление класс*/
  block.classList.remove("dragging");

/*Block B9 - Создание функционала контейнеров*/
  const container = e.target.closest(".anchor");
  if(container && right.contains(container)){
    const stack = container.querySelector(".stack");
    stack.appendChild(block);
  } else {
    right.appendChild(block);
  }
});

/*Block B10 - Удаление блоков при их переносе в палитру*/
left.addEventListener("dragover", e=>{
  e.preventDefault();
});

left.addEventListener("drop", e=>{
  e.preventDefault();

  if(dragged && !fromPalette){
    dragged.remove();
  }
});

/*Block B11 - Функционал псевдо-консоли*/

const consoleOutput = document.getElementById("console-out");

function logToConsole(message){
  const line = document.createElement("div");
  line.textContent = message;
  consoleOutput.appendChild(line);
}

/*Block B11 - Модель поведения переменных*/
const programState = {
  variables:{}
};

right.addEventListener("drop", ()=>{
  srVars();
});


function srVars(){

  const vars = right.querySelectorAll(".variable");

  vars.forEach(v=>{
    const name = v.querySelector(".var-name").value.trim();
    const value = v.querySelector(".var-value").value.trim();

    if(name){
      programState.variables[name] = value;
      logToConsole("Переменная: "+name+" = "+value);
    }
  });

}


