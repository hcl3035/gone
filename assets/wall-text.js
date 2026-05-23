// wall-text.js - 文字注释功能
(function() {
    'use strict';

    const State = window.WallState;
    const Utils = window.WallUtils;

    window.WallText = {
        setupInput: function(modal) {
            const textInputContainer = modal.querySelector('.text-input-container');
            const textInput = modal.querySelector('.text-annotation-input');
            const textConfirmBtn = modal.querySelector('.text-confirm-btn');

            textConfirmBtn.onclick = function() {
                const text = textInput.value.trim();
                if (text) {
                    this.addAnnotation(text);
                }
                textInputContainer.style.display = 'none';
                textInput.value = '';
            }.bind(this);

            textInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    textConfirmBtn.click();
                }
                if (e.key === 'Escape') {
                    textInputContainer.style.display = 'none';
                    textInput.value = '';
                }
            });
        },

        showInput: function(clientX, clientY) {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            const textInputContainer = modal.querySelector('.text-input-container');
            const textInput = modal.querySelector('.text-annotation-input');

            // 获取图片元素
            const img = modal.querySelector('.modal-image');
            if (!img) return;

            // 关键修复：使用layers-container的位置
            const layersContainer = modal.querySelector('.layers-container');
            const containerRect = layersContainer.getBoundingClientRect();
            
            // 计算鼠标在container显示区域内的相对位置（0-1之间）
            const relativeX = (clientX - containerRect.left) / containerRect.width;
            const relativeY = (clientY - containerRect.top) / containerRect.height;
            
            // 转换为原始图片坐标（和图片原始尺寸相乘）
            const originalX = relativeX * img.naturalWidth;
            const originalY = relativeY * img.naturalHeight;

            console.log('=== 文字输入坐标调试 ===');
            console.log('鼠标位置:', clientX, clientY);
            console.log('layers-container位置:', containerRect.left, containerRect.top, containerRect.width, containerRect.height);
            console.log('图片原始尺寸:', img.naturalWidth, 'x', img.naturalHeight);
            console.log('相对位置:', relativeX.toFixed(4), relativeY.toFixed(4));
            console.log('State.scale:', State.currentScale);
            console.log('State.translate:', State.translateX, State.translateY);
            console.log('原始图片坐标:', originalX.toFixed(2), originalY.toFixed(2));

            // 输入框位置 - 相对于视口，使用固定定位
            textInputContainer.style.display = 'block';
            textInputContainer.style.position = 'fixed';
            textInputContainer.style.left = clientX + 'px';
            textInputContainer.style.top = clientY + 'px';
            
            textInput.value = '';
            
            textInputContainer.dataset.originalX = originalX;
            textInputContainer.dataset.originalY = originalY;
            
            setTimeout(function() {
                textInput.focus();
            }, 50);
        },

        addAnnotation: function(text) {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            const textInputContainer = modal.querySelector('.text-input-container');
            
            // 使用原始图片坐标
            const originalX = parseFloat(textInputContainer.dataset.originalX) || 0;
            const originalY = parseFloat(textInputContainer.dataset.originalY) || 0;

            const fontSize = State.drawWidth * 5 + 10;

            State.textAnnotations.push({
                layer: State.activeCanvasIndex,
                text: text,
                x: originalX,
                y: originalY,
                color: State.drawColor,
                size: fontSize,
                opacity: State.drawOpacity
            });

            // 关键修复：直接在Canvas上绘制文字，调整y坐标补偿基线
            const canvas = State.layerCanvases[State.activeCanvasIndex];
            if (canvas && canvas.ctx) {
                const ctx = canvas.ctx;
                ctx.save();
                ctx.globalAlpha = State.drawOpacity;
                ctx.font = fontSize + 'px Arial';
                ctx.fillStyle = State.drawColor;
                // 关键修复：y坐标减去fontSize的约1/4，因为fillText的y是基线位置
                ctx.fillText(text, originalX, originalY + fontSize * 0.75);
                ctx.restore();
                
                window.WallDrawing.saveState();
            }

            if (window.refreshTextAnnotations) {
                window.refreshTextAnnotations();
            }
        },

        makeMovable: function() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            // 关键修复：文字现在直接在Canvas上绘制，不需要HTML元素
            // 只需要提供刷新函数接口
            function refreshTextElements() {
                // 文字已经在Canvas上绘制，不需要额外处理
            }

            window.refreshTextAnnotations = refreshTextElements;
        }
    };
})();
