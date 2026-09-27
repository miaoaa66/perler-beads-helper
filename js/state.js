window.PBH = window.PBH || { state: {}, fn: {} };
(function (PBH) {
  'use strict';
  const { ref, computed, watch } = Vue;

        const fileInput = ref(null);
        const cropFileInput = ref(null);
        const mainCanvas = ref(null);
        const previewContainer = ref(null);
        const originalImage = ref(null);
        const pixelWidth = ref(52);
        const pixelHeight = ref(52);
        const rulerWidth = ref(48);
        const rulerHeight = ref(26);

        // 画布面积上限：浏览器对单个 canvas 有尺寸与内存限制，超出会创建失败（画面空白）
        const DEFAULT_CELL_SIZE = 36;
        const MAX_CANVAS_AREA = 64 * 1024 * 1024;

        /**
         * 单元格尺寸：常规尺寸用默认格子；尺寸过大时按面积上限自动缩小，
         * 保证画布始终不超过浏览器 canvas 限制
         */
        const cellSize = computed(() => {
          for (let size = DEFAULT_CELL_SIZE; size > 1; size--) {
            const w = pixelWidth.value * size + rulerWidth.value;
            const h = pixelHeight.value * size + rulerHeight.value;
            if (w * h <= MAX_CANVAS_AREA) return size;
          }
          return 1;
        });
        const scale = ref(1);
        const pixelData = ref(null);
        const hoveredPixel = ref(null);
        const selectedPixel = ref(null);
        const isDragging = ref(false);
        const isDraggingOver = ref(false);
        const offsetX = ref(0);
        const offsetY = ref(0);
        const lastMouseX = ref(0);
        const lastMouseY = ref(0);

        // 界面开关
        const panelOpen = ref(true);   // 左侧操作面板展开状态，默认展开
        const pixelFont = ref(true);   // 是否启用像素字体，默认启用
        const flipH = ref(false);      // 水平翻转
        const flipV = ref(false);      // 垂直翻转

        // 图片裁剪弹窗
        const cropModalOpen = ref(false);
        const cropImage = ref(null);
        const cropImageSrc = ref('');
        const cropImageEl = ref(null);
        const cropStage = ref(null);
        const cropAspectRatio = ref(null);
        const activeRatio = ref('');
        const cropType = ref('free');
        const customRatioW = ref(1);
        const customRatioH = ref(1);
        const customPxW = ref(1);
        const customPxH = ref(1);
        const cropRect = ref({ x: 0, y: 0, w: 100, h: 100 });
        const cropDragMode = ref(null);
        const cropDragStart = ref({ mouseX: 0, mouseY: 0, rect: { x: 0, y: 0, w: 0, h: 0 } });
        const cropFlipH = ref(false);
        const cropFlipV = ref(false);
        const cropDragOver = ref(false);

        const cropTransform = computed(() => {
          const parts = [];
          if (cropFlipH.value) parts.push('scaleX(-1)');
          if (cropFlipV.value) parts.push('scaleY(-1)');
          return parts.join(' ');
        });

        const presetRatios = [
          { label: '1:1', ratio: 1 },
          { label: '4:3', ratio: 4 / 3 },
          { label: '3:4', ratio: 3 / 4 },
          { label: '16:9', ratio: 16 / 9 },
          { label: '9:16', ratio: 9 / 16 },
          { label: '3:2', ratio: 3 / 2 },
          { label: '2:3', ratio: 2 / 3 }
        ];
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

        // 常用豆板尺寸：选中后直接写入宽高输入框
        const boardPreset = ref('');
        const boardPresets = [
          { label: '15×15 小方板', w: 15, h: 15 },
          { label: '29×29 标准方板（5mm）', w: 29, h: 29 },
          { label: '52×52 迷你方板（2.6mm）', w: 52, h: 52 },
          { label: '58×58 四板拼接', w: 58, h: 58 },
          { label: '78×78 迷你大方板（2.6mm）', w: 78, h: 78 },
          { label: '104×104 迷你特大板（2.6mm）', w: 104, h: 104 },
          { label: '156×156 78×78 四板拼接', w: 156, h: 156 },
          { label: '208×208 104×104 四板拼接', w: 208, h: 208 },
          { label: '232×232 29×29 八板拼接', w: 232, h: 232 }
        ];

        const cropBoxStyle = computed(() => ({
          left: cropRect.value.x + 'px',
          top: cropRect.value.y + 'px',
          width: cropRect.value.w + 'px',
          height: cropRect.value.h + 'px'
        }));

        // 图片在裁剪舞台内的实际显示区域（用于把裁剪框换算成真实像素）
        const cropImgRect = ref(null);

        /**
         * 裁剪框对应的输出像素尺寸：与 applyCrop 的换算一致
         * 像素比模式输出尺寸固定为输入值
         */
        const cropOutputSize = computed(() => {
          const rect = cropImgRect.value;
          const img = cropImage.value;
          if (!rect || !img || rect.width <= 0) return null;
          if (cropType.value === 'pixel' && customPxW.value > 0 && customPxH.value > 0) {
            return { w: customPxW.value, h: customPxH.value };
          }
          const k = img.naturalWidth / rect.width;
          return { w: Math.round(cropRect.value.w * k), h: Math.round(cropRect.value.h * k) };
        });

        const canvasWidth = computed(() => pixelWidth.value * cellSize.value + rulerWidth.value);
        const canvasHeight = computed(() => pixelHeight.value * cellSize.value + rulerHeight.value);

        const imageInfo = ref(null);
        const imageRatio = computed(() => {
          if (!imageInfo.value) return '';
          const { width, height } = imageInfo.value;
          const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
          const g = gcd(width, height);
          return `${width} × ${height} (${width/g}:${height/g})`;
        });

        const hoveredPixelColor = computed(() => PBH.fn.getPixelColor(hoveredPixel.value));
        const selectedPixelColor = computed(() => PBH.fn.getPixelColor(selectedPixel.value));
        const colorCount = ref(256);

  // 状态装配：其他模块与 setup() 通过 PBH.state 共享同一批 ref / computed
  PBH.state = {
    fileInput, cropFileInput, mainCanvas, previewContainer, originalImage, pixelWidth, pixelHeight, cellSize, rulerWidth, rulerHeight, scale, pixelData, hoveredPixel, selectedPixel, isDragging, isDraggingOver, offsetX, offsetY, lastMouseX, lastMouseY, panelOpen, pixelFont, flipH, flipV, cropModalOpen, cropImage, cropImageSrc, cropImageEl, cropStage, cropAspectRatio, activeRatio, cropType, customRatioW, customRatioH, customPxW, customPxH, cropRect, cropDragMode, cropDragStart, cropFlipH, cropFlipV, cropDragOver, cropTransform, presetRatios, handles, boardPreset, boardPresets, cropBoxStyle, cropImgRect, cropOutputSize, canvasWidth, canvasHeight, imageInfo, imageRatio, hoveredPixelColor, selectedPixelColor, colorCount
  };

        /** 监听尺寸变化，重新渲染画布 */
        watch([pixelWidth, pixelHeight, cellSize], () => {
          if (pixelData.value) {
            PBH.fn.renderCanvas();
          }
        });

        /** 监听翻转开关，重新生成像素画 */
        watch([flipH, flipV], () => {
          if (originalImage.value) {
            PBH.fn.generatePixelArt();
          }
        });

        /** 监听像素字体开关，切换全局字体并重绘标尺 */
        watch(pixelFont, (enabled) => {
          document.body.classList.toggle('no-pixel-font', !enabled);
          if (pixelData.value) {
            PBH.fn.renderCanvas();
          }
        }, { immediate: true });

        /** 像素字体加载完成后重绘画布标尺，避免 fallback 字体残留 */
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => {
            if (pixelData.value) PBH.fn.renderCanvas();
          });
        }
})(window.PBH);
