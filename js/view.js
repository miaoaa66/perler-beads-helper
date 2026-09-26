(function (PBH) {
  'use strict';
  const {
    scale, pixelData, pixelWidth, pixelHeight, cellSize, mainCanvas, previewContainer,
    canvasWidth, canvasHeight, rulerWidth, rulerHeight,
    selectedPixel, hoveredPixel, isDragging, lastMouseX, lastMouseY, offsetX, offsetY
  } = PBH.state;

        const handleWheel = (event) => {
          const delta = event.deltaY > 0 ? -0.1 : 0.1;
          const newScale = Math.max(0.2, Math.min(5, scale.value + delta));
          scale.value = parseFloat(newScale.toFixed(1));
        };

        const downloadPixelArt = () => {
          if (!pixelData.value) return;

          const downloadCanvas = document.createElement('canvas');
          const downloadCtx = downloadCanvas.getContext('2d');
          downloadCanvas.width = pixelWidth.value * cellSize.value;
          downloadCanvas.height = pixelHeight.value * cellSize.value;

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

          const link = document.createElement('a');
          link.download = `拼豆像素画_${pixelWidth.value}x${pixelHeight.value}.png`;
          link.href = downloadCanvas.toDataURL('image/png');
          link.click();
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
    handleWheel, downloadPixelArt, getPixelCoordsFromEvent, handleCanvasClick,
    handleCanvasHover, handleCanvasLeave, handleMouseDown, handleMouseMove, handleMouseUp, resetPosition
  });
})(window.PBH);
