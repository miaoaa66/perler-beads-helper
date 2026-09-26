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
        const cellSize = ref(20);
        const rulerWidth = ref(40);
        const rulerHeight = ref(24);
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

        const cropBoxStyle = computed(() => ({
          left: cropRect.value.x + 'px',
          top: cropRect.value.y + 'px',
          width: cropRect.value.w + 'px',
          height: cropRect.value.h + 'px'
        }));

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
    fileInput, cropFileInput, mainCanvas, previewContainer, originalImage, pixelWidth, pixelHeight, cellSize, rulerWidth, rulerHeight, scale, pixelData, hoveredPixel, selectedPixel, isDragging, isDraggingOver, offsetX, offsetY, lastMouseX, lastMouseY, panelOpen, pixelFont, flipH, flipV, cropModalOpen, cropImage, cropImageSrc, cropImageEl, cropStage, cropAspectRatio, activeRatio, cropType, customRatioW, customRatioH, customPxW, customPxH, cropRect, cropDragMode, cropDragStart, cropFlipH, cropFlipV, cropDragOver, cropTransform, presetRatios, handles, cropBoxStyle, canvasWidth, canvasHeight, imageInfo, imageRatio, hoveredPixelColor, selectedPixelColor, colorCount
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
