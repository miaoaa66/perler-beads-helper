(function (PBH) {
  'use strict';
  const { createApp } = Vue;
  const { pixelWidth, pixelHeight, boardPreset, boardPresets } = PBH.state;
  const { generatePixelArt } = PBH.fn;

        /**
         * 应用常用豆板尺寸：按所选预设写入宽高并重新生成像素画
         */
        const applyBoardPreset = () => {
          const preset = boardPresets.find((p) => p.label === boardPreset.value);
          if (!preset) return;
          pixelWidth.value = preset.w;
          pixelHeight.value = preset.h;
          generatePixelArt();
        };

        /**
         * 尺寸输入：只接受整数，向下取整并限制在 5–300 之间后回填
         * （上限与输入框 min/max 一致；画布大小由 cellSize 自适应控制）
         * @param {Event} event - 输入事件
         * @param {'width'|'height'} dimension - 目标维度
         */
        const handleSizeInput = (event, dimension) => {
          const raw = event.target.value;
          if (raw === '') return; // 允许清空，方便重新输入
          const parsed = Math.floor(Number(raw));
          if (!Number.isFinite(parsed)) return;
          const value = Math.max(5, Math.min(300, parsed));
          const target = dimension === 'width' ? pixelWidth : pixelHeight;
          target.value = value;
          // 直接回填 DOM：若 ref 值未变化，:value 绑定不会触发 DOM 更新
          if (event.target.value !== String(value)) {
            event.target.value = String(value);
          }
          generatePixelArt();
        };

  Object.assign(PBH.fn, { handleSizeInput, applyBoardPreset });

  createApp({
    setup() {
      return Object.assign({}, PBH.state, PBH.fn);
    }
  }).mount('#app');
})(window.PBH);
