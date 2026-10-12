/**
 * Hama 色卡（丹麦 · 5mm midi · 46 色）
 *
 * 由 palette.js 统一注册；数据来源与免责声明见 palette.js 文件头。
 * 屏幕 HEX 与实物豆子存在批次/光线差异，仅作选色参考。
 */
(function (PBH) {
  'use strict';

  PBH.definePalette('hama', 'Hama', '丹麦 · 5mm midi · 46 色', [
    { code: 'H01',  name: 'White',            hex: '#FFFFFF', r: 255, g: 255, b: 255 },
    { code: 'H02',  name: 'Cream',            hex: '#F6E7C1', r: 246, g: 231, b: 193 },
    { code: 'H75',  name: 'Tan',              hex: '#D9B380', r: 217, g: 179, b: 128 },
    { code: 'H77',  name: 'Light Gray',       hex: '#CFCFCF', r: 207, g: 207, b: 207 },
    { code: 'H17',  name: 'Gray',             hex: '#8A8C8E', r: 138, g: 140, b: 142 },
    { code: 'H71',  name: 'Dark Gray',        hex: '#58595B', r:  88, g:  89, b:  91 },
    { code: 'H18',  name: 'Black',            hex: '#000000', r:   0, g:   0, b:   0 },
    { code: 'H21',  name: 'Light Brown',      hex: '#B5835A', r: 181, g: 131, b:  90 },
    { code: 'H12',  name: 'Dark Brown',       hex: '#4A3122', r:  74, g:  49, b:  34 },
    { code: 'H20',  name: 'Rust',             hex: '#9C4A24', r: 156, g:  74, b:  36 },
    { code: 'H76',  name: 'Gingerbread',      hex: '#7C4A1E', r: 124, g:  74, b:  30 },
    { code: 'H05',  name: 'Red',              hex: '#E1141C', r: 225, g:  20, b:  28 },
    { code: 'H44',  name: 'Hot Coral',        hex: '#F15F5A', r: 241, g:  95, b:  90 },
    { code: 'H26',  name: 'Salmon',           hex: '#FF8C7A', r: 255, g: 140, b: 122 },
    { code: 'H79',  name: 'Orange',           hex: '#F36F21', r: 243, g: 111, b:  33 },
    { code: 'H60',  name: 'Butterscotch',     hex: '#F0A93B', r: 240, g: 169, b:  59 },
    { code: 'H03',  name: 'Yellow',           hex: '#FBE122', r: 251, g: 225, b:  34 },
    { code: 'H43',  name: 'Pastel Yellow',    hex: '#F6EFA6', r: 246, g: 239, b: 166 },
    { code: 'H104', name: 'Kiwi Lime',        hex: '#C7E94F', r: 199, g: 233, b:  79 },
    { code: 'H115', name: 'Bright Green',     hex: '#8DC63F', r: 141, g: 198, b:  63 },
    { code: 'H11',  name: 'Light Green',      hex: '#A8DCA0', r: 168, g: 220, b: 160 },
    { code: 'H47',  name: 'Pastel Green',     hex: '#BFE6B3', r: 191, g: 230, b: 179 },
    { code: 'H10',  name: 'Dark Green',       hex: '#0A7C3E', r:  10, g: 124, b:  62 },
    { code: 'H98',  name: 'Toothpaste',       hex: '#8FD9C0', r: 143, g: 217, b: 192 },
    { code: 'H31',  name: 'Turquoise',        hex: '#00A99D', r:   0, g: 169, b: 157 },
    { code: 'H49',  name: 'Robin Egg',        hex: '#5BC2D6', r:  91, g: 194, b: 214 },
    { code: 'H46',  name: 'Pastel Blue',      hex: '#A4D4E6', r: 164, g: 212, b: 230 },
    { code: 'H119', name: 'Blue',             hex: '#1B75BB', r:  27, g: 117, b: 187 },
    { code: 'H08',  name: 'Cobalt',           hex: '#1C3F94', r:  28, g:  63, b: 148 },
    { code: 'H116', name: 'Navy',             hex: '#16224A', r:  22, g:  34, b:  74 },
    { code: 'H107', name: 'Lavender',         hex: '#B3A0D4', r: 179, g: 160, b: 212 },
    { code: 'H106', name: 'Pastel Lavender',  hex: '#CBB7E0', r: 203, g: 183, b: 224 },
    { code: 'H07',  name: 'Purple',           hex: '#7B3F98', r: 123, g:  63, b: 152 },
    { code: 'H82',  name: 'Plum',             hex: '#6C3082', r: 108, g:  48, b: 130 },
    { code: 'H06',  name: 'Pink',             hex: '#F7A8C4', r: 247, g: 168, b: 196 },
    { code: 'H112', name: 'Blush',            hex: '#F4B9C2', r: 244, g: 185, b: 194 },
    { code: 'H118', name: 'Berry',            hex: '#8C2A4A', r: 140, g:  42, b:  74 },
    { code: 'H27',  name: 'Flesh',            hex: '#FBD0A8', r: 251, g: 208, b: 168 },
    { code: 'H78',  name: 'Peach',            hex: '#FCD5B5', r: 252, g: 213, b: 181 },
    { code: 'H34',  name: 'Neon Yellow',      hex: '#EAFF00', r: 234, g: 255, b:   0 },
    { code: 'H37',  name: 'Neon Green',       hex: '#5CFF5C', r:  92, g: 255, b:  92 },
    { code: 'H38',  name: 'Neon Orange',      hex: '#FF7A00', r: 255, g: 122, b:   0 },
    { code: 'H32',  name: 'Neon Pink',        hex: '#FF4FA3', r: 255, g:  79, b: 163 },
    { code: 'H64',  name: 'Pearl White',      hex: '#F4F1EA', r: 244, g: 241, b: 234 },
    { code: 'H61',  name: 'Gold',             hex: '#C9A227', r: 201, g: 162, b:  39 },
    { code: 'H62',  name: 'Silver',           hex: '#C0C0C4', r: 192, g: 192, b: 196 }
  ], { url: 'https://hama.dk/', origin: '丹麦', size: 5 });
})(window.PBH);
