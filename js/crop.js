(function (PBH) {
  'use strict';
  const { nextTick } = Vue;
  const {
    cropModalOpen, cropImage, cropImageSrc, cropImageEl, cropStage,
    cropAspectRatio, activeRatio, cropType,
    customRatioW, customRatioH, customPxW, customPxH,
    cropRect, cropDragMode, cropDragStart, cropFlipH, cropFlipV, cropDragOver,
    presetRatios
  } = PBH.state;

        // ==================== 图片裁剪 ====================

        /** 打开裁剪弹窗，重置裁剪状态 */
        const openCropModal = () => {
          cropModalOpen.value = true;
          cropImage.value = null;
          cropImageSrc.value = '';
          cropAspectRatio.value = null;
          activeRatio.value = '';
          cropType.value = 'free';
          cropRect.value = { x: 0, y: 0, w: 100, h: 100 };
          cropDragMode.value = null;
          cropFlipH.value = false;
          cropFlipV.value = false;
          cropDragOver.value = false;
        };

        /** 关闭裁剪弹窗 */
        const closeCropModal = () => {
          cropModalOpen.value = false;
          cropImage.value = null;
          cropImageSrc.value = '';
        };

        /** 获取图片在 stage 内的显示位置与尺寸 */
        const getCropImgRect = () => {
          if (!cropImageEl.value || !cropStage.value) return null;
          const imgRect = cropImageEl.value.getBoundingClientRect();
          const stageRect = cropStage.value.getBoundingClientRect();
          return {
            left: imgRect.left - stageRect.left,
            top: imgRect.top - stageRect.top,
            width: imgRect.width,
            height: imgRect.height
          };
        };

        /** 初始化裁剪框（按图片显示尺寸居中，占 80% 或满足比例） */
        const initCropRect = () => {
          const ir = getCropImgRect();
          if (!ir) return;

          let w, h;
          if (cropAspectRatio.value) {
            const ratio = cropAspectRatio.value;
            if (ir.width / ir.height > ratio) {
              h = ir.height;
              w = h * ratio;
            } else {
              w = ir.width;
              h = w / ratio;
            }
          } else {
            w = ir.width * 0.8;
            h = ir.height * 0.8;
          }
          const x = ir.left + (ir.width - w) / 2;
          const y = ir.top + (ir.height - h) / 2;
          cropRect.value = { x, y, w, h };
        };

        /** 读取裁剪用的图片文件（选择与拖拽共用） */
        const processCropFile = (file) => {
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
              cropImage.value = img;
              cropImageSrc.value = e.target.result;
              nextTick(() => {
                initCropRect();
              });
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        };

        /** 裁剪弹窗：选择文件上传 */
        const handleCropImageUpload = (event) => {
          processCropFile(event.target.files[0]);
        };

        /** 裁剪弹窗：拖拽进入上传区 */
        const onCropDragOver = () => {
          cropDragOver.value = true;
        };

        /** 裁剪弹窗：拖拽离开上传区（移到子元素上时不算离开） */
        const onCropDragLeave = (event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            cropDragOver.value = false;
          }
        };

        /** 裁剪弹窗：拖拽释放上传 */
        const onCropDrop = (event) => {
          cropDragOver.value = false;
          processCropFile(event.dataTransfer.files[0]);
        };

        /** 设置预设比例 */
        const setPresetRatio = (p) => {
          activeRatio.value = p.label;
          cropAspectRatio.value = p.ratio;
          fitCropRectToRatio();
        };

        /** 切换裁剪类型：自由 / 宽高比 / 像素比 */
        const setCropType = (type) => {
          cropType.value = type;
          if (type === 'free') {
            cropAspectRatio.value = null;
            activeRatio.value = '';
          } else if (type === 'ratio') {
            // 有预设则按预设，否则用当前自定义比例
            if (activeRatio.value) {
              const p = presetRatios.find((r) => r.label === activeRatio.value);
              cropAspectRatio.value = p ? p.ratio : 1;
            } else if (customRatioW.value > 0 && customRatioH.value > 0) {
              cropAspectRatio.value = customRatioW.value / customRatioH.value;
            } else {
              cropAspectRatio.value = 1;
            }
            fitCropRectToRatio();
          } else if (type === 'pixel') {
            if (customPxW.value > 0 && customPxH.value > 0) {
              cropAspectRatio.value = customPxW.value / customPxH.value;
            } else {
              cropAspectRatio.value = 1;
            }
            activeRatio.value = '';
            fitCropRectToRatio();
          }
        };

        /** 应用自定义比例 */
        const applyCustomRatio = () => {
          if (customRatioW.value > 0 && customRatioH.value > 0) {
            cropAspectRatio.value = customRatioW.value / customRatioH.value;
            activeRatio.value = '';
            fitCropRectToRatio();
          }
        };

        /** 应用自定义宽高像素（等价锁定比例） */
        const applyCustomPixels = () => {
          if (customPxW.value > 0 && customPxH.value > 0) {
            cropAspectRatio.value = customPxW.value / customPxH.value;
            activeRatio.value = '';
            fitCropRectToRatio();
          }
        };

        /** 让当前裁剪框按锁定比例调整（保持中心与最大可用范围） */
        const fitCropRectToRatio = () => {
          const ir = getCropImgRect();
          if (!ir) return;
          const ratio = cropAspectRatio.value;
          if (!ratio) return;

          const cx = cropRect.value.x + cropRect.value.w / 2;
          const cy = cropRect.value.y + cropRect.value.h / 2;

          let w, h;
          if (ir.width / ir.height > ratio) {
            h = ir.height;
            w = h * ratio;
          } else {
            w = ir.width;
            h = w / ratio;
          }

          let x = cx - w / 2;
          let y = cy - h / 2;
          x = Math.max(ir.left, Math.min(x, ir.left + ir.width - w));
          y = Math.max(ir.top, Math.min(y, ir.top + ir.height - h));
          cropRect.value = { x, y, w, h };
        };

        /** 开始移动裁剪框 */
        const startMoveCrop = (event) => {
          cropDragMode.value = 'move';
          cropDragStart.value = {
            mouseX: event.clientX,
            mouseY: event.clientY,
            rect: { ...cropRect.value }
          };
        };

        /** 开始缩放手柄 */
        const startResizeCrop = (handle, event) => {
          cropDragMode.value = handle;
          cropDragStart.value = {
            mouseX: event.clientX,
            mouseY: event.clientY,
            rect: { ...cropRect.value }
          };
        };

        /** 裁剪区域鼠标按下（空区域无操作） */
        const handleCropMouseDown = () => {};

        /** 裁剪区域鼠标移动 */
        const handleCropMouseMove = (event) => {
          if (!cropDragMode.value) return;

          const ir = getCropImgRect();
          if (!ir) return;

          const dx = event.clientX - cropDragStart.value.mouseX;
          const dy = event.clientY - cropDragStart.value.mouseY;
          const start = cropDragStart.value.rect;
          const mode = cropDragMode.value;
          const ratio = cropAspectRatio.value;

          const minSize = 10;
          let x = start.x;
          let y = start.y;
          let w = start.w;
          let h = start.h;

          if (mode === 'move') {
            x = start.x + dx;
            y = start.y + dy;
            x = Math.max(ir.left, Math.min(x, ir.left + ir.width - w));
            y = Math.max(ir.top, Math.min(y, ir.top + ir.height - h));
            cropRect.value = { x, y, w, h };
            return;
          }

          // 缩放
          const growsLeft = mode.includes('w');
          const growsRight = mode.includes('e');
          const growsTop = mode.includes('n');
          const growsBottom = mode.includes('s');

          let left = start.x;
          let right = start.x + start.w;
          let top = start.y;
          let bottom = start.y + start.h;

          if (growsLeft) left = start.x + dx;
          if (growsRight) right = start.x + start.w + dx;
          if (growsTop) top = start.y + dy;
          if (growsBottom) bottom = start.y + start.h + dy;

          // 边界约束
          left = Math.max(ir.left, Math.min(left, right - minSize));
          right = Math.min(ir.left + ir.width, Math.max(right, left + minSize));
          top = Math.max(ir.top, Math.min(top, bottom - minSize));
          bottom = Math.min(ir.top + ir.height, Math.max(bottom, top + minSize));

          w = right - left;
          h = bottom - top;

          // 比例锁定
          if (ratio) {
            // 以对角锚点或中心调整比例
            if (growsLeft && growsTop) {
              // 固定右下角
              const bw = Math.max(w, h * ratio);
              const bh = Math.max(w / ratio, h);
              if (bw / bh > ratio) { w = bh * ratio; h = bh; } else { h = bw / ratio; w = bw; }
              left = right - w;
              top = bottom - h;
            } else if (growsRight && growsBottom) {
              // 固定左上角
              const bw = Math.max(w, h * ratio);
              const bh = Math.max(w / ratio, h);
              if (bw / bh > ratio) { w = bh * ratio; h = bh; } else { h = bw / ratio; w = bw; }
              right = left + w;
              bottom = top + h;
            } else if (growsRight && growsTop) {
              // 固定左下角
              w = h * ratio;
              right = left + w;
              top = bottom - h;
            } else if (growsLeft && growsBottom) {
              // 固定右上角
              w = h * ratio;
              left = right - w;
              bottom = top + h;
            } else {
              // 单边手柄，按比例调整另一边（保持中心）
              if (growsLeft || growsRight) {
                h = w / ratio;
                const centerY = top + h / 2;
                top = centerY - h / 2;
                bottom = top + h;
              } else {
                w = h * ratio;
                const centerX = left + w / 2;
                left = centerX - w / 2;
                right = left + w;
              }
              // 再次边界约束
              if (left < ir.left) { left = ir.left; right = left + w; }
              if (right > ir.left + ir.width) { right = ir.left + ir.width; w = right - left; h = w / ratio; }
              if (top < ir.top) { top = ir.top; bottom = top + h; }
              if (bottom > ir.top + ir.height) { bottom = ir.top + ir.height; h = bottom - top; w = h * ratio; }
            }
          }

          x = left;
          y = top;
          cropRect.value = { x, y, w, h };
        };

        /** 裁剪区域鼠标释放 */
        const handleCropMouseUp = () => {
          cropDragMode.value = null;
        };

        /** 确认裁剪并保存到本地 */
        const applyCrop = () => {
          if (!cropImage.value) return;

          const ir = getCropImgRect();
          if (!ir) return;

          const scale = cropImage.value.naturalWidth / ir.width;
          const sx = (cropRect.value.x - ir.left) * scale;
          const sy = (cropRect.value.y - ir.top) * scale;
          const sw = cropRect.value.w * scale;
          const sh = cropRect.value.h * scale;

          // 像素比模式：输出尺寸严格等于用户输入的宽×高
          let outW, outH;
          if (cropType.value === 'pixel' && customPxW.value > 0 && customPxH.value > 0) {
            outW = customPxW.value;
            outH = customPxH.value;
          } else {
            outW = Math.round(sw);
            outH = Math.round(sh);
          }

          const outCanvas = document.createElement('canvas');
          outCanvas.width = outW;
          outCanvas.height = outH;
          const ctx = outCanvas.getContext('2d');

          // 应用翻转：翻转输出画布，使裁剪结果与预览中看到的翻转后图像一致
          ctx.save();
          if (cropFlipH.value) {
            ctx.translate(outW, 0);
            ctx.scale(-1, 1);
          }
          if (cropFlipV.value) {
            ctx.translate(0, outH);
            ctx.scale(1, -1);
          }
          ctx.drawImage(cropImage.value, sx, sy, sw, sh, 0, 0, outW, outH);
          ctx.restore();

          const link = document.createElement('a');
          link.download = `拼豆裁剪_${outW}x${outH}.png`;
          link.href = outCanvas.toDataURL('image/png');
          link.click();

          closeCropModal();
        };

  Object.assign(PBH.fn, {
    openCropModal, closeCropModal, getCropImgRect, initCropRect, processCropFile,
    handleCropImageUpload, onCropDragOver, onCropDragLeave, onCropDrop,
    setPresetRatio, setCropType, applyCustomRatio, applyCustomPixels, fitCropRectToRatio,
    startMoveCrop, startResizeCrop, handleCropMouseDown, handleCropMouseMove, handleCropMouseUp, applyCrop
  });
})(window.PBH);
