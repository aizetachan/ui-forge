const cssText = ".Button_button:hover {\n  background-color: var(--primary-hover);\n}";
const pseudo = ":hover";
console.log(cssText.replace(new RegExp(':' + pseudo.substring(1), 'g'), ''));
console.log(cssText.replace(/;/g, ' !important;'));
