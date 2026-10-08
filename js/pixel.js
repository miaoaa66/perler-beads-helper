(function (PBH) {
  'use strict';
  const { nextTick } = Vue;
  const {
    fileInput, originalImage, isDraggingOver,
    pixelWidth, pixelHeight, cellSize, rulerWidth, rulerHeight,
    pixelData, flipH, flipV, pixelFont, colorCount,
    mainCanvas, imageInfo, canvasWidth, canvasHeight,
    hoveredPixel, selectedPixel, isGenerating, canvasError,
    activePalette, hasPaletteColors,
    highlightKey, highlightOnly, guideRow,
    offsetX, offsetY, scale
  } = PBH.state;

        const processFile = (file) => {
          if (!file) return;

          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp', 'image/gif'];
          const maxSize = 20 * 1024 * 1024;

          if (!allowedTypes.includes(file.type)) {
            canvasError.value = '不支持的图片格式，请上传 JPEG、PNG、WebP、AVIF、BMP 或 GIF 格式的图片';
            return;
          }

          if (file.size > maxSize) {
            canvasError.value = '图片文件过大，请上传小于 20MB 的图片';
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
         * 在当前豆色板中按 RGB 精确匹配色卡项
         * @param {number} r - 红
         * @param {number} g - 绿
         * @param {number} b - 蓝
         * @returns {Object|null} 色卡项 {code, name, hex} 或 null
         */
        const findPaletteColor = (r, g, b) => {
          const palette = activePalette.value;
          if (!palette) return null;
          const key = (r << 16) | (g << 8) | b;
          for (const c of palette.colors) {
            if (((c.r << 16) | (c.g << 8) | c.b) === key) return c;
          }
          return null;
        };

        /**
         * 根据像素坐标获取颜色信息
         * @param {Object} pixel - 像素坐标对象 {x, y}
         * @returns {Object|null} 颜色对象 {r, g, b, hex, code, name} 或 null
         */
        const getPixelColor = (pixel) => {
          if (!pixel || !pixelData.value) return null;
          const { x, y } = pixel;
          const i = (y * pixelWidth.value + x) * 4;
          const r = pixelData.value.data[i];
          const g = pixelData.value.data[i + 1];
          const b = pixelData.value.data[i + 2];
          const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
          const matched = findPaletteColor(r, g, b);
          return { r, g, b, hex, code: matched ? matched.code : '', name: matched ? matched.name : '' };
        };

        let originalPixelData = null;

        /**
         * 生成任务调度：先亮起 loading 态并让浏览器完成一次绘制，
         * 再执行同步的重活，避免界面在计算期间假死且没有任何反馈
         * @param {Function} task - 同步任务
         */
        let pendingTasks = 0;
        const runTask = (task) => {
          pendingTasks++;
          isGenerating.value = true;
          nextTick(() => {
            // 双重 rAF：第一帧提交 DOM 更新，第二帧确保 loading 已绘制
            requestAnimationFrame(() => requestAnimationFrame(() => {
              try {
                task();
              } catch (err) {
                canvasError.value = '生成失败：' + (err && err.message ? err.message : '未知错误');
              } finally {
                pendingTasks = Math.max(0, pendingTasks - 1);
                if (pendingTasks === 0) isGenerating.value = false;
              }
            }));
          });
        };

        /**
         * 简单防抖：滑块连续拖动时只保留最后一次调用
         * @param {Function} fn - 目标函数
         * @param {number} wait - 等待毫秒数
         * @returns {Function} 防抖后的函数
         */
        const debounce = (fn, wait) => {
          let timer = null;
          return (...args) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              timer = null;
              fn(...args);
            }, wait);
          };
        };

        /**
         * 颜色量化（同步核心）
         * - 原始色模式：5bit 分桶统计，取用量前 colorCount 个色
         * - 豆色板模式：先映射到色板最近色，再按用量取前 colorCount 个，
         *   被淘汰的颜色就近回映射到保留色，保证只出现真实豆色
         */
        const quantizeColors = () => {
          if (!originalPixelData) return;

          const data = originalPixelData.data;
          const w = pixelWidth.value;
          const h = pixelHeight.value;
          const paletteColors = hasPaletteColors.value ? activePalette.value.colors : null;

          let candidates;
          if (paletteColors) {
            candidates = paletteColors.map((c) => ({ r: c.r, g: c.g, b: c.b, count: 0 }));
          } else {
            const colorMap = new Map();
            for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] < 128) continue;
              const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
              colorMap.set(key, (colorMap.get(key) || 0) + 1);
            }
            candidates = [...colorMap.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, colorCount.value)
              .map(([key]) => ({
                r: (key >> 10 & 31) << 3,
                g: (key >> 5 & 31) << 3,
                b: (key & 31) << 3,
                count: 0
              }));
          }

          // 逐像素映射到最近候选色，-1 表示透明格
          const newData = new Uint8ClampedArray(data.length);
          const assignment = new Int16Array(w * h).fill(-1);
          for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            if (data[i + 3] < 128) continue;

            let minDist = Infinity;
            let best = 0;
            for (let c = 0; c < candidates.length; c++) {
              const color = candidates[c];
              const dr = data[i] - color.r;
              const dg = data[i + 1] - color.g;
              const db = data[i + 2] - color.b;
              const dist = dr * dr + dg * dg + db * db;
              if (dist < minDist) {
                minDist = dist;
                best = c;
              }
            }
            candidates[best].count++;
            assignment[p] = best;
          }

          // 豆色板模式：按用量裁剪到 colorCount 个色，其余像素就近回映射
          if (paletteColors && candidates.length > colorCount.value) {
            const kept = candidates
              .map((c, i) => i)
              .sort((a, b) => candidates[b].count - candidates[a].count)
              .slice(0, colorCount.value);
            const keptSet = new Set(kept);
            const remap = new Map();
            for (let i = 0; i < candidates.length; i++) {
              if (keptSet.has(i)) continue;
              let minDist = Infinity;
              let best = kept[0];
              for (const k of kept) {
                const dr = candidates[i].r - candidates[k].r;
                const dg = candidates[i].g - candidates[k].g;
                const db = candidates[i].b - candidates[k].b;
                const dist = dr * dr + dg * dg + db * db;
                if (dist < minDist) {
                  minDist = dist;
                  best = k;
                }
              }
              remap.set(i, best);
            }
            for (let p = 0; p < assignment.length; p++) {
              if (assignment[p] >= 0 && remap.has(assignment[p])) {
                assignment[p] = remap.get(assignment[p]);
              }
            }
          }

          for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            const color = assignment[p] >= 0 ? candidates[assignment[p]] : null;
            if (!color) continue; // 透明格保持全 0（alpha=0）
            newData[i] = color.r;
            newData[i + 1] = color.g;
            newData[i + 2] = color.b;
            newData[i + 3] = 255;
          }

          pixelData.value = new ImageData(newData, w, h);
          renderCanvas();
        };

        /** 应用颜色量化（对外入口，带 loading 态） */
        const applyColorQuantization = () => {
          if (!originalPixelData) return;
          runTask(quantizeColors);
        };

        /** COLORS 滑块：防抖后量化，避免拖动过程中反复全量计算 */
        const handleColorCountInput = debounce(applyColorQuantization, 120);

        /**
         * 根据设置的宽高重新采样原始图片生成像素画
         * 支持按比例裁剪图片以适应目标尺寸，并按开关状态应用水平/垂直翻转
         */
        const generatePixelArt = () => {
          if (!originalImage.value) return;

          // 尺寸/图片已变，清掉上一轮的悬浮与选中残留
          hoveredPixel.value = null;
          selectedPixel.value = null;
          canvasError.value = '';

          runTask(() => {
            const img = originalImage.value;
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
              canvasError.value = '画布初始化失败：无法获取绘图上下文，请更换浏览器重试';
              return;
            }

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

            // 选了豆色板时即使取全量颜色也要映射到真实豆色
            if (colorCount.value < 256 || hasPaletteColors.value) {
              quantizeColors();
            } else {
              renderCanvas();
            }
          });
        };

        /**
         * 透明格占位图案：棋盘格，避免透明区露出底色而被误认成深色豆
         * @param {CanvasRenderingContext2D} ctx - 画布上下文
         * @returns {CanvasPattern|string} 棋盘格图案，创建失败时退回纯色
         */
        const createEmptyPattern = (ctx) => {
          const tile = document.createElement('canvas');
          tile.width = 16;
          tile.height = 16;
          const tileCtx = tile.getContext('2d');
          if (!tileCtx || !ctx.createPattern) return '#2a2a38';
          tileCtx.fillStyle = '#c9c9d4';
          tileCtx.fillRect(0, 0, 16, 16);
          tileCtx.fillStyle = '#a5a5b6';
          tileCtx.fillRect(0, 0, 8, 8);
          tileCtx.fillRect(8, 8, 8, 8);
          return ctx.createPattern(tile, 'repeat') || '#2a2a38';
        };

        /**
         * 校验画布是否真正可用：尺寸超限时浏览器会静默给出空白画布，
         * 通过探测背景像素来判断并给出提示
         * @param {CanvasRenderingContext2D} ctx - 画布上下文
         * @param {HTMLCanvasElement} canvas - 画布元素
         * @returns {boolean} 是否可继续渲染
         */
        const verifyCanvas = (ctx, canvas) => {
          try {
            if (ctx.getImageData(0, 0, 1, 1).data[3] === 0) {
              canvasError.value = `画布渲染失败：${canvas.width} × ${canvas.height} 超出浏览器上限，请减小像素尺寸后重试`;
              return false;
            }
          } catch (err) {
            return true; // 探测失败不阻断正常渲染
          }
          return true;
        };

        /**
         * 判断某格在当前高亮/引导模式下是否应被淡化
         * @param {number} x - 列坐标
         * @param {number} y - 行坐标
         * @param {number} key - 该格颜色的 RGB 打包值
         * @returns {boolean} true 表示需要淡化
         */
        const shouldDim = (x, y, key) => {
          // 逐行引导优先级最高：只点亮当前行
          if (guideRow.value >= 0) {
            return y !== guideRow.value;
          }
          if (highlightKey.value === null) return false;
          return key !== highlightKey.value;
        };

        /**
         * 渲染画布：绘制背景、标尺、像素点、网格、豆板分区线
         */
        const renderCanvas = () => {
          if (!mainCanvas.value || !pixelData.value) return;

          const canvas = mainCanvas.value;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            canvasError.value = '画布初始化失败：无法获取绘图上下文，请更换浏览器重试';
            return;
          }
          const data = pixelData.value.data;

          ctx.fillStyle = '#14141f';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (!verifyCanvas(ctx, canvas)) return;
          canvasError.value = '';

          drawRuler(ctx);

          const emptyPattern = createEmptyPattern(ctx);
          const dimming = highlightKey.value !== null || guideRow.value >= 0;
          // 隔离模式下被淡化的格子直接画底色，高亮格子保留原色
          const dimColor = highlightOnly.value ? '#14141f' : 'rgba(20, 20, 31, 0.72)';

          for (let y = 0; y < pixelHeight.value; y++) {
            for (let x = 0; x < pixelWidth.value; x++) {
              const i = (y * pixelWidth.value + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];
              const px = rulerWidth.value + x * cellSize.value;
              const py = rulerHeight.value + y * cellSize.value;

              if (dimming && shouldDim(x, y, (r << 16) | (g << 8) | b)) {
                ctx.fillStyle = a < 128 ? dimColor : dimColor;
                ctx.fillRect(px, py, cellSize.value, cellSize.value);
                continue;
              }

              ctx.fillStyle = a < 128
                ? emptyPattern
                : `rgba(${r}, ${g}, ${b}, 1)`;

              ctx.fillRect(px, py, cellSize.value, cellSize.value);
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

          // 格子过小时按倍数抽稀刻度：以三位数宽度为准，避免相邻数字挤在一起
          const labelStep = Math.max(1, Math.ceil((ctx.measureText('000').width + 4) / cellSize.value));

          for (let x = 0; x < pixelWidth.value; x++) {
            if (x % labelStep !== 0) continue;
            const labelX = rulerWidth.value + x * cellSize.value + cellSize.value / 2;
            ctx.fillText((x + 1).toString(), labelX, rulerHeight.value / 2);
          }

          ctx.textAlign = 'right';
          for (let y = 0; y < pixelHeight.value; y++) {
            if (y % labelStep !== 0) continue;
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

  /**
         * 重置工作区：清除图片与像素结果，回到空状态。
         * 存盘模块在「清除存档」时复用，避免重复清理逻辑。
         */
        const resetWorkspace = () => {
          originalImage.value = null;
          pixelData.value = null;
          originalPixelData = null;
          imageInfo.value = null;
          hoveredPixel.value = null;
          selectedPixel.value = null;
          canvasError.value = '';
          highlightKey.value = null;
          guideRow.value = -1;
          offsetX.value = 0;
          offsetY.value = 0;
          scale.value = 1;
        };

  Object.assign(PBH.fn, {
    processFile, handleImageUpload, triggerFileInput, onDragOver, onDragLeave, handleDrop,
    getPixelColor, applyColorQuantization, handleColorCountInput, generatePixelArt,
    renderCanvas, drawRuler, drawGrid, shouldDim, resetWorkspace
  });
})(window.PBH);
