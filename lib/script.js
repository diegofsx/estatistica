// lib/script.js

document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.nav-button');
  
    buttons.forEach(button => {
      button.addEventListener('mouseover', () => {
        button.classList.add('hovered');
      });
  
      button.addEventListener('mouseout', () => {
        button.classList.remove('hovered');
      });
    });
  });
  