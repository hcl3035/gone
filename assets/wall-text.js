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
            textInputContainer.style.zIndex = '99999';
            textInputContainer.style.backgroundColor = 'white';
            textInputContainer.style.padding = '5px';
            textInputContainer.style.borderRadius = '3px';
            textInputContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
            
            textInput.value = '';
            
            textInputContainer.dataset.originalX = originalX;
            textInputContainer.dataset.originalY = originalY;
            
            console.log('输入框已显示:', textInputContainer.style.display);
            console.log('输入框位置:', clientX, clientY);
            
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

            // 关键修复：不再在Canvas上绘制，而是通过refreshTextAnnotations创建DOM元素
            if (window.refreshTextAnnotations) {
                window.refreshTextAnnotations();
            }
        },

        makeMovable: function() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            let selectedTextElement = null;
            let isDraggingText = false;
            let dragStartX = 0;
            let dragStartY = 0;
            let initialLeft = 0;
            let initialTop = 0;

            // 文字容器在modal-image-container内，与layers-container平级
            let textContainer = modal.querySelector('.text-annotations-container');
            if (!textContainer) {
                textContainer = document.createElement('div');
                textContainer.className = 'text-annotations-container';
                textContainer.style.position = 'absolute';
                textContainer.style.top = '0';
                textContainer.style.left = '0';
                textContainer.style.width = '100%';
                textContainer.style.height = '100%';
                textContainer.style.pointerEvents = 'none';
                textContainer.style.zIndex = '100';
                textContainer.style.transformOrigin = '0 0';

                const container = modal.querySelector('.modal-image-container');
                container.appendChild(textContainer);
            }

            const self = this;

            function createTextElement(annotation, index) {
                const div = document.createElement('div');
                div.className = 'text-annotation-element';
                div.textContent = annotation.text;
                div.style.position = 'absolute';
                div.style.left = annotation.x + 'px';
                div.style.top = annotation.y + 'px';
                div.style.fontSize = annotation.size + 'px';
                div.style.color = annotation.color;
                div.style.fontFamily = 'Arial';
                div.style.pointerEvents = 'auto';
                div.style.cursor = 'move';
                div.style.userSelect = 'none';
                div.style.whiteSpace = 'nowrap';
                div.style.opacity = annotation.opacity || 1;
                div.style.lineHeight = '1';
                div.style.margin = '0';
                div.style.padding = '0';
                div.dataset.annotationIndex = index;

                return div;
            }

            function refreshTextElements() {
                textContainer.innerHTML = '';

                State.textAnnotations.forEach(function(annotation, index) {
                    if (annotation.layer === State.activeCanvasIndex) {
                        const elem = createTextElement(annotation, index);

                        // 鼠标事件（桌面端）
                        elem.addEventListener('mousedown', function(e) {
                            if (State.currentTool !== 'select' && State.currentTool !== 'text') return;

                            selectedTextElement = elem;
                            isDraggingText = true;
                            dragStartX = e.clientX;
                            dragStartY = e.clientY;
                            initialLeft = parseFloat(elem.style.left);
                            initialTop = parseFloat(elem.style.top);

                            e.stopPropagation();
                            e.preventDefault();
                        });

                        // 关键修复：添加触摸事件支持（移动端）
                        let touchTimer = null;
                        let isLongPress = false;
                        let touchStartX = 0;
                        let touchStartY = 0;
                        
                        elem.addEventListener('touchstart', function(e) {
                            if (State.currentTool !== 'select' && State.currentTool !== 'text') return;
                            
                            const touch = e.touches[0];
                            touchStartX = touch.clientX;
                            touchStartY = touch.clientY;
                            isLongPress = false;
                            
                            // 设置长按定时器（500ms）
                            touchTimer = setTimeout(function() {
                                isLongPress = true;
                                selectedTextElement = elem;
                                isDraggingText = true;
                                dragStartX = touchStartX;
                                dragStartY = touchStartY;
                                initialLeft = parseFloat(elem.style.left);
                                initialTop = parseFloat(elem.style.top);
                                
                                // 关键修复：添加振动反馈
                                if (navigator.vibrate) {
                                    navigator.vibrate(50); // 振动50ms
                                }
                                
                                // 视觉反馈：放大文字
                                elem.style.transform = 'scale(1.1)';
                                elem.style.transition = 'transform 0.2s ease';
                                
                                e.preventDefault();
                            }, 500);
                            
                            e.stopPropagation();
                        }, { passive: false });
                        
                        elem.addEventListener('touchmove', function(e) {
                            if (!isLongPress) {
                                // 如果移动距离超过10px，取消长按
                                const touch = e.touches[0];
                                const moveDistance = Math.sqrt(
                                    Math.pow(touch.clientX - touchStartX, 2) + 
                                    Math.pow(touch.clientY - touchStartY, 2)
                                );
                                
                                if (moveDistance > 10) {
                                    clearTimeout(touchTimer);
                                    isLongPress = false;
                                }
                                return;
                            }
                            
                            // 长按后拖动
                            const touch = e.touches[0];
                            const deltaX = touch.clientX - dragStartX;
                            const deltaY = touch.clientY - dragStartY;
                            
                            // 考虑缩放比例
                            const scaledDeltaX = deltaX / State.currentScale;
                            const scaledDeltaY = deltaY / State.currentScale;
                            
                            const newLeft = initialLeft + scaledDeltaX;
                            const newTop = initialTop + scaledDeltaY;
                            
                            elem.style.left = newLeft + 'px';
                            elem.style.top = newTop + 'px';
                            
                            const annotationIndex = parseInt(elem.dataset.annotationIndex);
                            const annotation = State.textAnnotations[annotationIndex];
                            
                            annotation.x = newLeft;
                            annotation.y = newTop + annotation.size;
                            
                            e.preventDefault();
                        }, { passive: false });
                        
                        elem.addEventListener('touchend', function(e) {
                            clearTimeout(touchTimer);
                            
                            if (isLongPress) {
                                // 恢复文字大小
                                elem.style.transform = 'scale(1)';
                                
                                isDraggingText = false;
                                selectedTextElement = null;
                                isLongPress = false;
                                
                                // 振动反馈
                                if (navigator.vibrate) {
                                    navigator.vibrate(30); // 振动30ms
                                }
                            }
                            
                            e.stopPropagation();
                        });

                        textContainer.appendChild(elem);
                    }
                });
            }

            document.addEventListener('mousemove', function(e) {
                if (!isDraggingText || !selectedTextElement) return;

                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;

                // 考虑缩放比例
                const scaledDeltaX = deltaX / State.currentScale;
                const scaledDeltaY = deltaY / State.currentScale;

                const newLeft = initialLeft + scaledDeltaX;
                const newTop = initialTop + scaledDeltaY;

                selectedTextElement.style.left = newLeft + 'px';
                selectedTextElement.style.top = newTop + 'px';

                const index = parseInt(selectedTextElement.dataset.annotationIndex);
                const annotation = State.textAnnotations[index];
                
                annotation.x = newLeft;
                annotation.y = newTop + annotation.size;
            });

            document.addEventListener('mouseup', function() {
                if (isDraggingText) {
                    isDraggingText = false;
                    selectedTextElement = null;
                }
            });

            window.refreshTextAnnotations = refreshTextElements;
            refreshTextElements();
        }
    };
})();
