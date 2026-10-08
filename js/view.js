(function (PBH) {
  'use strict';
  const {
    scale, pixelData, pixelWidth, pixelHeight, cellSize, mainCanvas, previewContainer,
    canvasWidth, canvasHeight, rulerWidth, rulerHeight,
    selectedPixel, hoveredPixel, isDragging, lastMouseX, lastMouseY, offsetX, offsetY,
    highlightKey, guideRow, highlightOnly, colorUsage, totalBeads, canvasError
  } = PBH.state;

        const handleWheel = (event) => {
          const delta = event.deltaY > 0 ? -0.1 : 0.1;
          const newScale = Math.max(0.1, Math.min(5, scale.value + delta));
          scale.value = parseFloat(newScale.toFixed(1));
        };

        /** 下载画布：统一用 Blob，避免 toDataURL 的 base64 膨胀与内存峰值 */
        const downloadCanvas = (canvas, filename) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              canvasError.value = '导出失败：画布过大或浏览器内存不足，请减小像素尺寸后重试';
              return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            // 交给浏览器读取后再释放，立即 revoke 会导致部分浏览器下载空文件
            setTimeout(() => URL.revokeObjectURL(url), 4000);
          }, 'image/png');
        };

        const downloadPixelArt = () => {
          if (!pixelData.value) return;

          const pixelCanvas = document.createElement('canvas');
          const downloadCtx = pixelCanvas.getContext('2d');
          pixelCanvas.width = pixelWidth.value * cellSize.value;
          pixelCanvas.height = pixelHeight.value * cellSize.value;

          const data = pixelData.value.data;

          for (let y = 0; y < pixelHeight.value; y++) {
            for (let x = 0; x < pixelWidth.value; x++) {
              const i = (y * pixelWidth.value + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              downloadCtx.fillStyle = a < 128
                ? 'transparent'
                : `rgba(${r}, ${g}, ${b}, 1)`;

              downloadCtx.fillRect(
                x * cellSize.value,
                y * cellSize.value,
                cellSize.value,
                cellSize.value
              );
            }
          }

          downloadCanvas(pixelCanvas, `拼豆像素画_${pixelWidth.value}x${pixelHeight.value}.png`);
        };

        // ===== 高亮定位 =====

        /**
         * 切换某个色号的高亮定位：再次点击同一行取消高亮
         * @param {Object} color - colorUsage 中的一项
         */
        const toggleHighlight = (color) => {
          if (!color) return;
          // 高亮与逐行引导互斥，避免两套规则叠加导致看不出重点
          if (highlightKey.value === color.key) {
            highlightKey.value = null;
          } else {
            guideRow.value = -1;
            highlightKey.value = color.key;
          }
        };

        /** 清除高亮与引导，回到完整画面 */
        const clearHighlight = () => {
          highlightKey.value = null;
          guideRow.value = -1;
        };

        /** 当前是否处于任一聚焦模式（高亮或逐行引导） */
        const isFocusMode = () => highlightKey.value !== null || guideRow.value >= 0;

        /**
         * 「定位 / 清除定位」按钮的唯一入口，行为必须与按钮文案一致。
         * 不能直接用 toggleHighlight(colorUsage[0])：那是以「首个色号」为基准做切换，
         * 当高亮的是其他色号时点击会跳到第一个色号，而不是清除定位。
         */
        const onFocusButtonClick = () => {
          if (highlightKey.value !== null) {
            clearHighlight();
          } else {
            toggleHighlight(colorUsage.value[0]);
          }
        };

        // ===== 逐行引导 =====

        /** 进入逐行引导，从第一行开始 */
        const startRowGuide = () => {
          highlightKey.value = null;
          guideRow.value = 0;
        };

        /**
         * 逐行引导前进 / 后退
         * @param {number} delta - 步长，1 为下一行，-1 为上一行
         */
        const stepGuideRow = (delta) => {
          if (guideRow.value < 0) {
            startRowGuide();
            return;
          }
          const next = guideRow.value + delta;
          // 越过末行后退出引导，避免卡在空状态
          if (next >= pixelHeight.value) {
            guideRow.value = -1;
          } else if (next < 0) {
            guideRow.value = 0;
          } else {
            guideRow.value = next;
          }
        };

        /** 退出逐行引导 */
        const stopRowGuide = () => {
          guideRow.value = -1;
        };

        /**
         * 换算图纸导出的格子边长：图幅过大时自动缩小，
         * 避免创建超出浏览器上限的画布
         * @param {number} cols - 列数
         * @param {number} rows - 行数
         * @returns {number} 每格边长（像素）
         */
        const chartCellSize = (cols, rows) => {
          const MAX_GRID_SIDE = 6000;
          const longest = Math.max(cols, rows, 1);
          return Math.max(12, Math.min(40, Math.floor(MAX_GRID_SIDE / longest)));
        };

        /**
         * 导出带编号的网格图纸：每格标注豆色号（无豆色板时为用量序号），
         * 底部附颜色图例（色块 + 色号 + HEX + 颗数）
         */
        const downloadChart = () => {
          const usage = colorUsage.value;
          if (!pixelData.value || !usage.length) return;

          const cols = pixelWidth.value;
          const rows = pixelHeight.value;
          const cell = chartCellSize(cols, rows);
          const fontSize = Math.max(7, Math.round(cell * 0.32));
          const pad = 24;
          const titleH = 30;
          const gridW = cols * cell;
          const gridH = rows * cell;

          // 图例按可用宽度分列排布
          const legendCols = Math.max(1, Math.min(4, Math.floor(gridW / 240) || 1));
          const legendItemH = 26;
          const legendRows = Math.ceil(usage.length / legendCols);
          const legendTop = pad + titleH + gridH + pad;

          const canvas = document.createElement('canvas');
          canvas.width = gridW + pad * 2;
          canvas.height = legendTop + legendRows * legendItemH + pad;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // 标题
          ctx.fillStyle = '#111111';
          ctx.font = 'bold 16px "Microsoft YaHei", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            `拼豆图纸  ${cols} × ${rows}  ·  ${usage.length} 色  ·  共 ${totalBeads.value} 颗`,
            pad, pad + titleH / 2
          );

          const gridTop = pad + titleH;
          const orderIndex = new Map();
          usage.forEach((c, i) => orderIndex.set(c.key, i));

          // 网格：填充色块并写入色号 / 序号
          const data = pixelData.value.data;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${fontSize}px "Microsoft YaHei", monospace`;
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const i = (y * cols + x) * 4;
              const px = pad + x * cell;
              const py = gridTop + y * cell;

              // 空白格（透明）：浅色棋盘格，和豆色格区分
              if (data[i + 3] < 128) {
                ctx.fillStyle = ((x + y) % 2 === 0) ? '#f2f2f4' : '#fafafb';
                ctx.fillRect(px, py, cell, cell);
                continue;
              }

              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
              ctx.fillRect(px, py, cell, cell);

              const item = usage[orderIndex.get((r << 16) | (g << 8) | b)];
              // 按底色明暗自动切换字色，保证编号可读
              ctx.fillStyle = (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111111' : '#ffffff';
              ctx.fillText(item ? item.label : '', px + cell / 2, py + cell / 2 + 1);
            }
          }

          // 网格线
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.lineWidth = 1;
          for (let x = 0; x <= cols; x++) {
            ctx.beginPath();
            ctx.moveTo(pad + x * cell, gridTop);
            ctx.lineTo(pad + x * cell, gridTop + gridH);
            ctx.stroke();
          }
          for (let y = 0; y <= rows; y++) {
            ctx.beginPath();
            ctx.moveTo(pad, gridTop + y * cell);
            ctx.lineTo(pad + gridW, gridTop + y * cell);
            ctx.stroke();
          }

          // 图例
          const itemW = gridW / legendCols;
          ctx.textAlign = 'left';
          ctx.font = '12px "Microsoft YaHei", monospace';
          usage.forEach((c, i) => {
            const ix = pad + (i % legendCols) * itemW;
            const iy = legendTop + Math.floor(i / legendCols) * legendItemH + legendItemH / 2;
            ctx.fillStyle = c.hex;
            ctx.fillRect(ix, iy - 9, 18, 18);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.strokeRect(ix + 0.5, iy - 8.5, 18, 18);
            ctx.fillStyle = '#111111';
            ctx.fillText(`${c.label}  ${c.hex}  ×${c.count}`, ix + 26, iy);
          });

          downloadCanvas(canvas, `拼豆图纸_${cols}x${rows}.png`);
        };

        /**
         * 将鼠标事件坐标转换为像素坐标
         * @param {MouseEvent} event - 鼠标事件
         * @returns {Object|null} 像素坐标 {x, y} 或超出范围时返回 null
         */
        const getPixelCoordsFromEvent = (event) => {
          const rect = mainCanvas.value.getBoundingClientRect();
          const scaleX = rect.width / canvasWidth.value;
          const scaleY = rect.height / canvasHeight.value;

          const x = (event.clientX - rect.left) / scaleX;
          const y = (event.clientY - rect.top) / scaleY;

          const px = Math.floor((x - rulerWidth.value) / cellSize.value);
          const py = Math.floor((y - rulerHeight.value) / cellSize.value);

          if (px >= 0 && px < pixelWidth.value && py >= 0 && py < pixelHeight.value) {
            return { x: px, y: py };
          }
          return null;
        };

        /**
         * 处理画布点击事件：选中/取消选中像素点
         */
        const handleCanvasClick = (event) => {
          const coords = getPixelCoordsFromEvent(event);
          if (!coords) return;

          if (selectedPixel.value && selectedPixel.value.x === coords.x && selectedPixel.value.y === coords.y) {
            selectedPixel.value = null;
          } else {
            selectedPixel.value = coords;
          }
        };

        /**
         * 处理画布鼠标移动事件：更新悬浮像素点
         */
        const handleCanvasHover = (event) => {
          hoveredPixel.value = getPixelCoordsFromEvent(event);
        };

        const handleCanvasLeave = () => {
          hoveredPixel.value = null;
        };

        /** 鼠标按下：开始拖拽画布 */
        const handleMouseDown = (event) => {
          if (event.button === 0) {
            isDragging.value = true;
            lastMouseX.value = event.clientX;
            lastMouseY.value = event.clientY;
          }
        };

        /** 鼠标移动：拖拽画布 */
        const handleMouseMove = (event) => {
          if (isDragging.value) {
            const deltaX = event.clientX - lastMouseX.value;
            const deltaY = event.clientY - lastMouseY.value;
            offsetX.value += deltaX;
            offsetY.value += deltaY;
            lastMouseX.value = event.clientX;
            lastMouseY.value = event.clientY;
          }
        };

        /** 鼠标释放：停止拖拽 */
        const handleMouseUp = () => {
          isDragging.value = false;
        };

        /**
         * 重置画布位置：能完整显示的方向居中，超出预览区的方向左上角对齐并留出内边距，
         * 保证行号/列号标尺原点可见
         */
        const resetPosition = () => {
          const wrapper = mainCanvas.value && mainCanvas.value.parentElement;
          const container = previewContainer.value;

          if (!wrapper || !container) {
            offsetX.value = 0;
            offsetY.value = 0;
            return;
          }

          const pad = 16;
          const layoutW = wrapper.offsetWidth;
          const layoutH = wrapper.offsetHeight;
          const scaledW = layoutW * scale.value;
          const scaledH = layoutH * scale.value;

          // offsetLeft/Top 相对预览区 padding 边，且不受 transform 影响；
          // transformOrigin 为 top left，故可视左上角 = 布局左上角 + 平移量
          offsetX.value = scaledW <= container.clientWidth - pad * 2
            ? container.clientWidth / 2 - wrapper.offsetLeft - scaledW / 2
            : pad - wrapper.offsetLeft;

          offsetY.value = scaledH <= container.clientHeight - pad * 2
            ? container.clientHeight / 2 - wrapper.offsetTop - scaledH / 2
            : pad - wrapper.offsetTop;
        };

  Object.assign(PBH.fn, {
    handleWheel, downloadPixelArt, downloadChart, chartCellSize,
    getPixelCoordsFromEvent, handleCanvasClick,
    handleCanvasHover, handleCanvasLeave, handleMouseDown, handleMouseMove, handleMouseUp, resetPosition,
    toggleHighlight, clearHighlight, isFocusMode, onFocusButtonClick,
    startRowGuide, stepGuideRow, stopRowGuide
  });
})(window.PBH);
