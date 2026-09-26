(function (PBH) {
  'use strict';
  const { createApp } = Vue;
  const { pixelWidth, pixelHeight } = PBH.state;
  const { generatePixelArt } = PBH.fn;

        /**
         * 尺寸输入：只接受整数，输入小数时向下取整后回填
         * @param {Event} event - 输入事件
         * @param {'width'|'height'} dimension - 目标维度
         */
        const handleSizeInput = (event, dimension) => {
          const raw = event.target.value;
          if (raw === '') return; // 允许清空，方便重新输入
          const value = Math.floor(Number(raw));
          if (!Number.isFinite(value)) return;
          const target = dimension === 'width' ? pixelWidth : pixelHeight;
          target.value = value;
          // 直接回填 DOM：若 ref 值未变化，:value 绑定不会触发 DOM 更新
          if (event.target.value !== String(value)) {
            event.target.value = String(value);
          }
          generatePixelArt();
        };

  Object.assign(PBH.fn, { handleSizeInput });

  createApp({
    setup() {
      return Object.assign({}, PBH.state, PBH.fn);
    }
  }).mount('#app');
})(window.PBH);
