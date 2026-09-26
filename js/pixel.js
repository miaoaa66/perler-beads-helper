(function (PBH) {
  'use strict';
  const { nextTick } = Vue;
  const {
    fileInput, originalImage, isDraggingOver,
    pixelWidth, pixelHeight, cellSize, rulerWidth, rulerHeight,
    pixelData, flipH, flipV, pixelFont, colorCount,
    mainCanvas, imageInfo, canvasWidth, canvasHeight
  } = PBH.state;

        const processFile = (file) => {
          if (!file) return;

          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp', 'image/gif'];
          const maxSize = 20 * 1024 * 1024;

          if (!allowedTypes.includes(file.type)) {
            alert('不支持的图片格式，请上传 JPEG、PNG、WebP、AVIF、BMP 或 GIF 格式的图片');
            return;
          }

          if (file.size > maxSize) {
            alert('图片文件过大，请上传小于 20MB 的图片');
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              originalImage.value = img;
              imageInfo.value = { width: img.width, height: img.height };
              nextTick(() => {
                generatePixelArt();
              });
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        };

        const handleImageUpload = (event) => {
          processFile(event.target.files[0]);
        };

        const triggerFileInput = () => {
          fileInput.value?.click();
        };

        const onDragOver = () => {
          isDraggingOver.value = true;
        };

        const onDragLeave = () => {
          isDraggingOver.value = false;
        };

        const handleDrop = (event) => {
          isDraggingOver.value = false;
          processFile(event.dataTransfer.files[0]);
        };

        /**
         * 根据像素坐标获取颜色信息
         * @param {Object} pixel - 像素坐标对象 {x, y}
         * @returns {Object|null} 颜色对象 {r, g, b, hex} 或 null
         */
        const getPixelColor = (pixel) => {
          if (!pixel || !pixelData.value) return null;
          const { x, y } = pixel;
          const i = (y * pixelWidth.value + x) * 4;
          const r = pixelData.value.data[i];
          const g = pixelData.value.data[i + 1];
          const b = pixelData.value.data[i + 2];
          const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
          return { r, g, b, hex };
        };

        let originalPixelData = null;

        const applyColorQuantization = () => {
          if (!originalPixelData) return;

          const data = originalPixelData.data;
          const w = pixelWidth.value;
          const h = pixelHeight.value;

          const colorMap = new Map();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const r = data[i] >> 3;
            const g = data[i + 1] >> 3;
            const b = data[i + 2] >> 3;
            const key = (r << 10) | (g << 5) | b;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
          }

          const sortedColors = [...colorMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, colorCount.value)
            .map(([key]) => ({
              r: (key >> 10 & 31) << 3,
              g: (key >> 5 & 31) << 3,
              b: (key & 31) << 3
            }));

          const newData = new Uint8ClampedArray(data.length);
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) {
              newData[i] = 0;
              newData[i + 1] = 0;
              newData[i + 2] = 0;
              newData[i + 3] = 0;
              continue;
            }

            let minDist = Infinity;
            let closest = sortedColors[0] || { r: 0, g: 0, b: 0 };

            for (const color of sortedColors) {
              const dr = data[i] - color.r;
              const dg = data[i + 1] - color.g;
              const db = data[i + 2] - color.b;
              const dist = dr * dr + dg * dg + db * db;
              if (dist < minDist) {
                minDist = dist;
                closest = color;
              }
            }

            newData[i] = closest.r;
            newData[i + 1] = closest.g;
            newData[i + 2] = closest.b;
            newData[i + 3] = 255;
          }

          pixelData.value = new ImageData(newData, w, h);
          renderCanvas();
        };

        /**
         * 根据设置的宽高重新采样原始图片生成像素画
         * 支持按比例裁剪图片以适应目标尺寸，并按开关状态应用水平/垂直翻转
         */
        const generatePixelArt = () => {
          if (!originalImage.value) return;

          const img = originalImage.value;
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');

          const w = pixelWidth.value;
          const h = pixelHeight.value;
          tempCanvas.width = w;
          tempCanvas.height = h;

          const imgAspect = img.width / img.height;
          const canvasAspect = w / h;

          let drawX = 0, drawY = 0;
          let drawWidth = img.width;
          let drawHeight = img.height;

          if (imgAspect > canvasAspect) {
            drawWidth = img.height * canvasAspect;
            drawX = (img.width - drawWidth) / 2;
          } else {
            drawHeight = img.width / canvasAspect;
            drawY = (img.height - drawHeight) / 2;
          }

          // 以画布中心为轴镜像，保证像素对齐
          if (flipH.value || flipV.value) {
            tempCtx.translate(w / 2, h / 2);
            tempCtx.scale(flipH.value ? -1 : 1, flipV.value ? -1 : 1);
            tempCtx.translate(-w / 2, -h / 2);
          }

          tempCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight, 0, 0, w, h);

          pixelData.value = tempCtx.getImageData(0, 0, w, h);
          originalPixelData = pixelData.value;

          if (colorCount.value < 256) {
            applyColorQuantization();
          } else {
            renderCanvas();
          }
        };

        /**
         * 渲染画布：绘制背景、标尺、像素点、网格
         */
        const renderCanvas = () => {
          if (!mainCanvas.value || !pixelData.value) return;

          const canvas = mainCanvas.value;
          const ctx = canvas.getContext('2d');
          const data = pixelData.value.data;

          ctx.fillStyle = '#14141f';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          drawRuler(ctx);

          for (let y = 0; y < pixelHeight.value; y++) {
            for (let x = 0; x < pixelWidth.value; x++) {
              const i = (y * pixelWidth.value + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              ctx.fillStyle = a < 128
                ? 'transparent'
                : `rgba(${r}, ${g}, ${b}, 1)`;

              ctx.fillRect(
                rulerWidth.value + x * cellSize.value,
                rulerHeight.value + y * cellSize.value,
                cellSize.value,
                cellSize.value
              );
            }
          }

          drawGrid(ctx);
        };

        /**
         * 绘制左上角标尺区域
         * @param {CanvasRenderingContext2D} ctx - 画布上下文
         */
        const drawRuler = (ctx) => {
          ctx.fillStyle = '#14141f';
          ctx.fillRect(0, 0, rulerWidth.value, rulerHeight.value);

          ctx.strokeStyle = '#00d9ff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rulerWidth.value, 0);
          ctx.lineTo(rulerWidth.value, canvasHeight.value);
          ctx.moveTo(0, rulerHeight.value);
          ctx.lineTo(canvasWidth.value, rulerHeight.value);
          ctx.stroke();

          ctx.fillStyle = '#00d9ff';
          ctx.font = pixelFont.value
            ? '9px "Press Start 2P", monospace'
            : '10px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          for (let x = 0; x < pixelWidth.value; x++) {
            const labelX = rulerWidth.value + x * cellSize.value + cellSize.value / 2;
            ctx.fillText((x + 1).toString(), labelX, rulerHeight.value / 2);
          }

          ctx.textAlign = 'right';
          for (let y = 0; y < pixelHeight.value; y++) {
            const labelY = rulerHeight.value + y * cellSize.value + cellSize.value / 2;
            ctx.fillText((y + 1).toString(), rulerWidth.value - 5, labelY);
          }
        };

        /**
         * 绘制像素网格线
         * @param {CanvasRenderingContext2D} ctx - 画布上下文
         */
        const drawGrid = (ctx) => {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;

          for (let x = 0; x <= pixelWidth.value; x++) {
            ctx.beginPath();
            ctx.moveTo(rulerWidth.value + x * cellSize.value, rulerHeight.value);
            ctx.lineTo(rulerWidth.value + x * cellSize.value, rulerHeight.value + pixelHeight.value * cellSize.value);
            ctx.stroke();
          }

          for (let y = 0; y <= pixelHeight.value; y++) {
            ctx.beginPath();
            ctx.moveTo(rulerWidth.value, rulerHeight.value + y * cellSize.value);
            ctx.lineTo(rulerWidth.value + pixelWidth.value * cellSize.value, rulerHeight.value + y * cellSize.value);
            ctx.stroke();
          }
        };

  Object.assign(PBH.fn, {
    processFile, handleImageUpload, triggerFileInput, onDragOver, onDragLeave, handleDrop,
    getPixelColor, applyColorQuantization, generatePixelArt, renderCanvas, drawRuler, drawGrid
  });
})(window.PBH);
